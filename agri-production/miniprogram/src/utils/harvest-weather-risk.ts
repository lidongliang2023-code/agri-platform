import type { Row } from '@/api/native-business'

const inactive = new Set(['DONE', 'RESCHEDULED', 'DEFERRED'])
const codes = new Set([0,1,2,3,45,48,51,53,55,56,57,61,63,65,66,67,71,73,75,77,80,81,82,85,86,95,96,99])
export function clockMinutes(value: unknown): number {
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(String(value ?? ''))) return NaN
  const [h,m,s=0] = String(value).split(':').map(Number)
  return h < 24 && m < 60 && s < 60 ? h*60+m+s/60 : NaN
}
export function validDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false
  const d = new Date(day+'T00:00:00Z')
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === day
}
export function hourKey(value: unknown): string {
  const s=String(value ?? '').replace(' ','T')
  return /^\d{4}-\d{2}-\d{2}T\d{2}:00(:00)?$/.test(s) && validDay(s.slice(0,10)) && Number(s.slice(11,13))<24 ? s.slice(0,16) : ''
}
export function expectedHourEnd(start: string): string {
  if (!hourKey(start)) return ''
  return new Date(Date.parse(start+':00Z')+3600000).toISOString().slice(0,16)
}
export function completeHour(row: Row): boolean {
  const keys=['temperature','humidity','rainMm','precipitationProbability','windSpeedMs','windGustMs','weatherCode']
  return keys.every(k=>typeof row[k]==='number' && Number.isFinite(row[k])) && row.temperature>=-90 && row.temperature<=70 && row.humidity>=0 && row.humidity<=100 && row.rainMm>=0 && row.precipitationProbability>=0 && row.precipitationProbability<=100 && row.windSpeedMs>=0 && row.windGustMs>=0 && codes.has(row.weatherCode)
}
export function shiftOverlap(row: Row, dispatch?: Row): boolean {
  if (!dispatch || inactive.has(dispatch.status)) return false
  const start=hourKey(row.periodStart), end=hourKey(row.periodEnd)
  if (!start || end!==expectedHourEnd(start) || dispatch.dispatchDate!==start.slice(0,10)) return false
  const a=clockMinutes(dispatch.shiftStart), b=clockMinutes(dispatch.shiftEnd), h=Number(start.slice(11,13))*60
  return b>a && a<h+60 && b>h
}
export function weatherPoints(hours: Row[], date: string, metric: string, dispatch?: Row): Row[] {
  if (!validDay(date)) return []
  return Array.from({length:24},(_,i)=>{
    const time=date+'T'+String(i).padStart(2,'0')+':00'
    const matches=hours.filter(h=>hourKey(h.periodStart)===time)
    const row=matches.length===1?matches[0]:undefined
    const valid=!!row && hourKey(row.periodEnd)===expectedHourEnd(time) && completeHour(row)
    return {...(row||{}),time,value:valid?row![metric]??null:null,overlap:shiftOverlap({periodStart:time,periodEnd:expectedHourEnd(time)},dispatch),note:matches.length>1?'该小时预报重复':!row?'该小时缺测':!valid?'小时区间或关键字段无效':row.note}
  })
}
function beijingNow(): string { return new Date(Date.now()+8*3600000).toISOString().slice(0,19) }
export function dispatchWeatherRisk(dispatch: Row, weather?: Row, now=beijingNow()): {active:boolean;status:string;reasons:string[]} {
  if (inactive.has(dispatch.status)) return {active:false,status:'INACTIVE',reasons:[]}
  const a=clockMinutes(dispatch.shiftStart), b=clockMinutes(dispatch.shiftEnd), date=String(dispatch.dispatchDate||'')
  if (!validDay(date)||!Number.isFinite(a)||!Number.isFinite(b)||b<=a) return {active:true,status:'INVALID',reasons:['日期或班次无效；跨夜作业需拆单']}
  const expiry=String(weather?.expiresAt||'').replace(' ','T')
  const fresh=!!(weather?.usable && weather.status==='SUCCESS' && weather.snapshotId && Number.isFinite(Date.parse(expiry)) && Date.parse(expiry)>Date.parse(now))
  const reasons:string[]=[]
  const day=(weather?.days||[]).find((d:Row)=>d.date===date)
  const dailyBlocked=fresh && day && (day.dailyUsable===false || (day.dailyUsable===undefined && !day.usable))
  if (!fresh) reasons.push(weather?.error||'天气快照未核验或已过期')
  if (!day) reasons.push('当日预报缺失或超出覆盖范围')
  if (dailyBlocked) reasons.push(day.note||'整日天气或恢复期不满足条件')
  if (dispatch.weatherBlockReason) reasons.push(dispatch.weatherBlockReason)
  const pendingSnapshot=!!weather?.snapshotId && dispatch.weatherSnapshotId!==weather.snapshotId
  if (pendingSnapshot) reasons.push('派单尚未引用当前天气快照，需重新核验')
  const past=date<now.slice(0,10)
  if (past) reasons.push('原日期已过，未完成作业需重排')
  let missing=0,risk=0,pending=0
  const points=weatherPoints(weather?.hours||[],date,'temperature')
  for(let h=Math.floor(a/60);h<b/60;h++){
    const row=points[h]
    if (!row || row.value===null) missing++
    else if (!fresh || !row.weatherVerified || row.snapshotId!==weather?.snapshotId) pending++
    else if (!row.usable) risk++
  }
  if(missing) reasons.push(`班次内${missing}个小时缺测、重复或字段无效`)
  if(pending) reasons.push(`班次内${pending}个小时尚未通过核验`)
  if(risk) reasons.push(`班次内${risk}个小时存在气象风险`)
  return {active:true,status:risk||dailyBlocked?'RISK':missing?'MISSING':!fresh||!day||pendingSnapshot||past||dispatch.weatherBlockReason||pending?'PENDING':'CLEAR',reasons}
}
