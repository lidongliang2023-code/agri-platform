import dayjs from 'dayjs'
import type { HarvestWeatherHour, HarvestWeatherInfo, HarvestWindowDispatch } from '@/api/harvest-window'
import { shiftHour, weatherDispatchKey } from './hourly-weather-shifts'

export type ShiftRiskStatus = 'RISK' | 'MISSING' | 'PENDING' | 'INVALID' | 'CLEAR' | 'INACTIVE'
export interface ShiftRiskPeriod { start: number; end: number; kind: 'risk' | 'missing' | 'pending'; reason: string }
export interface ShiftWeatherRisk {
  key: string
  dispatch: HarvestWindowDispatch
  active: boolean
  status: ShiftRiskStatus
  hours: number
  riskHours: number
  missingHours: number
  pendingHours: number
  riskMinutes: number
  remainingArea: number
  periods: ShiftRiskPeriod[]
  reasons: string[]
}
const FIELDS = ['temperature', 'humidity', 'rainMm', 'precipitationProbability', 'windSpeedMs', 'windGustMs', 'weatherCode'] as const
const CODES = new Set([0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99])
function complete(hour: HarvestWeatherHour): boolean {
  return FIELDS.every((key) => typeof hour[key] === 'number' && Number.isFinite(hour[key]))
    && hour.temperature! >= -90 && hour.temperature! <= 70 && hour.humidity! >= 0 && hour.humidity! <= 100
    && hour.rainMm! >= 0 && hour.precipitationProbability! >= 0 && hour.precipitationProbability! <= 100
    && hour.windSpeedMs! >= 0 && hour.windGustMs! >= 0 && CODES.has(hour.weatherCode!)
}
function canonical(value: string): string | undefined {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:00(?::00)?$/.test(value) ? value.slice(0, 16) : undefined
}
export function formatRiskTime(hour: number): string {
  const seconds = Math.round(hour * 3600)
  const base = `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds % 3600 / 60)).padStart(2, '0')}`
  return seconds % 60 ? `${base}:${String(seconds % 60).padStart(2, '0')}` : base
}

/** 展示层聚合后端风险结果，不替代发布、开工时的服务端核验。now 参数便于固定时间验证。 */
export function summarizeShiftWeather(dispatches: HarvestWindowDispatch[], weather: HarvestWeatherInfo | undefined, now = dayjs().format('YYYY-MM-DDTHH:mm:ss')): ShiftWeatherRisk[] {
  const groups = new Map<string, HarvestWeatherHour[]>()
  for (const hour of weather?.hours ?? []) {
    const key = canonical(hour.periodStart)
    if (key) groups.set(key, [...(groups.get(key) ?? []), hour])
  }
  const fresh = Boolean(weather?.usable && weather.status === 'SUCCESS' && weather.snapshotId
    && weather.expiresAt && dayjs(weather.expiresAt).isValid() && dayjs(weather.expiresAt).isAfter(dayjs(now)))
  return dispatches.map((dispatch, index) => {
    const active = !['DONE', 'RESCHEDULED', 'DEFERRED'].includes(dispatch.status)
    const start = shiftHour(dispatch.shiftStart), end = shiftHour(dispatch.shiftEnd)
    const result: ShiftWeatherRisk = {
      key: weatherDispatchKey(dispatch, index), dispatch, active, status: 'CLEAR', hours: 0, riskHours: 0,
      missingHours: 0, pendingHours: 0, riskMinutes: 0, remainingArea: Math.max(0, Number(dispatch.area || 0) - Number(dispatch.actualArea || 0)), periods: [], reasons: [],
    }
    const reasons = new Set<string>()
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(dispatch.dispatchDate) && dayjs(dispatch.dispatchDate).isValid() && dayjs(dispatch.dispatchDate).format('YYYY-MM-DD') === dispatch.dispatchDate
    if (!validDate || start === undefined || end === undefined || end <= start) {
      result.status = active ? 'INVALID' : 'INACTIVE'
      result.reasons = ['日期或班次缺失、起止无效；跨夜班次需拆单']
      return result
    }
    const day = weather?.days.find((item) => item.date === dispatch.dispatchDate)
    if (!fresh) reasons.add(weather?.error || '天气快照未核验或已过期，请刷新真实天气')
    if (!day) reasons.add('当日预报缺失或超出覆盖范围')
    const dailyBlocked = fresh && Boolean(day && (day.dailyUsable === false || (day.dailyUsable === undefined && !day.usable)))
    if (dailyBlocked) reasons.add(day?.note || '整日天气或恢复期不满足条件')
    if (dispatch.weatherBlockReason) reasons.add(`派单核验提示：${dispatch.weatherBlockReason}`)
    const snapshotPending = Boolean(weather?.snapshotId && dispatch.weatherSnapshotId !== weather.snapshotId)
    if (snapshotPending) reasons.add('派单尚未引用当前天气快照，需重新核验')
    const past = dispatch.dispatchDate < now.slice(0, 10)
    if (past) reasons.add('原日期已过；未完成作业需重排，当前预报不作为历史天气证明')
    for (let hour = Math.floor(start); hour < end; hour += 1) {
      result.hours += 1
      const key = `${dispatch.dispatchDate}T${String(hour).padStart(2, '0')}:00`
      const matches = groups.get(key) ?? []
      const row = matches.length === 1 ? matches[0] : undefined
      const expectedEnd = hour === 23 ? `${dayjs(dispatch.dispatchDate).add(1, 'day').format('YYYY-MM-DD')}T00:00` : `${dispatch.dispatchDate}T${String(hour + 1).padStart(2, '0')}:00`
      let kind: ShiftRiskPeriod['kind'] | undefined
      let reason = ''
      if (!row || canonical(row.periodEnd) !== expectedEnd || !complete(row)) {
        kind = 'missing'; reason = matches.length > 1 ? '小时预报时段重复' : !row ? '缺少连续逐小时预报' : '小时区间或关键字段无效、缺失'
        result.missingHours += 1
      } else if (!fresh || !row.weatherVerified || row.snapshotId !== weather?.snapshotId) {
        kind = 'pending'; reason = !fresh ? '天气快照未通过有效性核验' : '小时预报未核验或快照不一致'
        result.pendingHours += 1
      } else if (!row.usable) {
        kind = 'risk'; reason = row.note || '后端判定小时气象条件不满足'
        result.riskHours += 1
        result.riskMinutes += (Math.min(end, hour + 1) - Math.max(start, hour)) * 60
      }
      if (kind) {
        const segment = { start: Math.max(start, hour), end: Math.min(end, hour + 1), kind, reason }
        const prior = result.periods[result.periods.length - 1]
        if (prior && prior.kind === kind && prior.reason === reason && prior.end === segment.start) prior.end = segment.end
        else result.periods.push(segment)
      }
    }
    if (result.riskHours) reasons.add('班次内存在后端判定的小时气象风险')
    if (result.missingHours) reasons.add('班次内有缺测、重复或无效字段，不能视为无风险')
    if (result.pendingHours) reasons.add('班次内小时预报尚未通过核验')
    result.reasons = [...reasons]
    result.status = !active ? 'INACTIVE' : result.riskHours || dailyBlocked ? 'RISK' : result.missingHours ? 'MISSING'
      : !fresh || !day || snapshotPending || past || dispatch.weatherBlockReason || result.pendingHours ? 'PENDING' : 'CLEAR'
    return result
  })
}
