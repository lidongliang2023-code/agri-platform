import { FactoryVisitReport } from '../components/FactoryVisitReport'
import { useEffect, useState, type FormEvent } from 'react'
import { PortalPageHero } from '../components/PortalPageHero'
import { FactoryPanorama } from '../components/FactoryPanorama'
import { getPlatformAccessToken } from '../utils/platformToken'
import { redirectToPlatformLogin } from '../utils'
import './cloud-factory.css'

type Media = { id: number; title: string; kind: string; url: string; capturedAt: string; description: string }
type Factory = { id: number; name: string; enterprise: string; region: string; category: string; description: string; baseRef: string; productKeyword: string; traceCode: string; media?: Media[] }
type Visit = { id: number; factoryName: string; requestedAt: string; status: string; purpose: string; note: string }
const labels: Record<string,string> = { pending: '待确认', confirmed: '已确认', completed: '已完成', rejected: '未通过', cancelled: '已取消', panorama: '360° 全景', video: '实景录像', live: '直播信号', image: '实景照片' }
async function api<T>(path: string, body?: unknown, privateRequest = false): Promise<T> {
  const headers: Record<string,string> = {}
  if (body) headers['Content-Type']='application/json'
  if (privateRequest) { const token=await getPlatformAccessToken(); if (!token) throw new Error('请先登录后预约或查看我的预约'); headers.Authorization=`Bearer ${token}` }
  const response=await fetch(`/api/v1/info/${path}`,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined})
  let result: {code:number;message:string;data:T}
  try { result=await response.json() as typeof result } catch { throw new Error(`云工厂服务暂不可用（HTTP ${response.status}），请稍后重试`) }
  if (!response.ok || ![0,200].includes(result.code)) throw new Error(result.message || '请求失败，请稍后再试')
  return result.data
}
export function CloudFactory(): JSX.Element {
  const [reportVisit,setReportVisit]=useState<number|null>(null)
  const [rows,setRows]=useState<Factory[]>([]),[selected,setSelected]=useState<Factory|null>(null),[media,setMedia]=useState<Media|null>(null)
  const [keyword,setKeyword]=useState(''),[category,setCategory]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false)
  const [visits,setVisits]=useState<Visit[]>([]),[showVisits,setShowVisits]=useState(false),[booking,setBooking]=useState(false),[message,setMessage]=useState('')
  useEffect(()=>{let active=true;setLoading(true);api<Factory[]>(`public/cloud-factories?keyword=${encodeURIComponent(keyword)}&category=${encodeURIComponent(category)}`).then(data=>{if(active){setRows(data);setError('')}}).catch(e=>{if(active)setError(String(e.message))}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[keyword,category])
  async function open(id: number): Promise<void> { setBusy(true);setError('');try{const d=await api<Factory>(`public/cloud-factories/${id}`);setSelected(d);setMedia(d.media?.[0]||null);setBooking(false)}catch(e){setError((e as Error).message)}finally{setBusy(false)} }
  async function myVisits(): Promise<void> {setError('');setBusy(true);try{setVisits(await api<Visit[]>('cloud-factory/visits',undefined,true));setShowVisits(true)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  async function submit(e: FormEvent<HTMLFormElement>): Promise<void> {e.preventDefault();if(!selected)return;const b=Object.fromEntries(new FormData(e.currentTarget));setBusy(true);setError('');try{await api(`cloud-factory/${selected.id}/visits`,b,true);setBooking(false);setMessage('验厂预约已提交，运营确认后可在“我的预约”查看安排。');await myVisits()}catch(err){setError((err as Error).message)}finally{setBusy(false)}}
  async function cancel(id:number):Promise<void>{setBusy(true);try{await api(`cloud-factory/visits/${id}/cancel`,{},true);await myVisits()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  return <main className="portal-channel-page factory-page">
    <PortalPageHero badge="VR CLOUD FACTORY" title="VR 云工厂" description="基地实景在线看货，远程验厂溯源。连接基地展示、交易货源与质量核验，让采购决策更有依据。"><div className="factory-actions"><a className="btn portal-page-btn-light" href="#factory-list">浏览实景基地</a><button className="btn portal-page-btn-ghost" disabled={busy} onClick={()=>void myVisits()}>我的验厂预约</button><button className="btn portal-page-btn-ghost" onClick={()=>void redirectToPlatformLogin()}>登录 / 切换账号</button></div></PortalPageHero>
    <div className="container factory-body">
      <div className="factory-workflow"><span>01 基地实景</span><span>02 在线看货</span><span>03 预约远程验厂</span><span>04 溯源核验</span></div>
      {error&&<p className="factory-error" role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
      {showVisits&&<section className="factory-panel"><div className="factory-heading"><h2>我的验厂预约</h2><button className="btn btn-outline" onClick={()=>setShowVisits(false)}>收起</button></div><p className="muted">预约时间按北京时间；确认不等于验厂通过，具体安排以运营回复为准。</p>{visits.length===0?<p>暂无预约记录。</p>:visits.map(v=><article className="factory-line" key={v.id}><div><strong>{v.factoryName}</strong> · {labels[v.status]}<p>{v.requestedAt.replace('T',' ')} · {v.purpose}</p><p className="muted">运营回复：{v.note||'等待处理'}</p><button className="btn btn-outline" disabled={busy} onClick={()=>setReportVisit(v.id)}>查看验厂报告</button></div>{['pending','confirmed'].includes(v.status)&&<button className="btn btn-outline" disabled={busy} onClick={()=>void cancel(v.id)}>取消预约</button>}</article>)}</section>}
      {reportVisit!==null&&<FactoryVisitReport visitId={reportVisit} load={()=>api(`cloud-factory/visits/${reportVisit}/report`,undefined,true)} onClose={()=>setReportVisit(null)}/>}
      <section id="factory-list" className="factory-panel"><div className="factory-heading"><div><h2>实景基地</h2><p className="muted">仅展示已审核发布资料，实景素材不替代现场检验或认证结论。</p></div><span>{rows.length} 个展示结果（最多200个）</span></div><div className="factory-filters"><input aria-label="搜索基地" placeholder="搜索基地、企业、地区、品种" value={keyword} onChange={e=>setKeyword(e.target.value)}/><select aria-label="产业筛选" value={category} onChange={e=>setCategory(e.target.value)}><option value="">全部产业</option>{['粮油产业','果蔬产业','畜禽产业','茶药产业','饲料农资','水产产业','预制菜','冷链物流'].map(c=><option key={c}>{c}</option>)}</select></div>
      {loading?<p>正在读取已发布基地…</p>:error&&rows.length===0?<p>基地列表暂未加载，请稍后刷新重试。</p>:rows.length===0?<div className="factory-empty"><h3>暂无符合条件的实景基地</h3><p>待运营配置真实、已授权素材并审核发布后展示。</p></div>:rows.map(f=><article className="factory-line" key={f.id}><div><span className="factory-tag">{f.category}</span><h3>{f.name}</h3><p>{f.enterprise} · {f.region}</p><p className="muted">{f.description.slice(0,130)}</p></div><button className="btn btn-primary" disabled={busy} onClick={()=>void open(f.id)}>进入云工厂</button></article>)}</section>
      {selected&&<section className="factory-panel"><div className="factory-heading"><div><span className="factory-tag">{selected.category}</span><h2>{selected.name}</h2><p>{selected.enterprise} · {selected.region}</p></div><button className="btn btn-outline" onClick={()=>setSelected(null)}>关闭详情</button></div><p>{selected.description}</p>
        <div className="factory-media-tabs">{selected.media?.map(m=><button key={m.id} className={`btn ${m.id===media?.id?'btn-primary':'btn-outline'}`} onClick={()=>setMedia(m)}>{labels[m.kind]} · {m.title}</button>)}</div>
        {media&&<div className="factory-viewer" key={media.id}>{media.kind==='panorama'?<FactoryPanorama url={media.url}/>:media.kind==='image'?<img src={media.url} alt={media.title}/>:<><video controls playsInline preload="metadata" src={media.url} onError={()=>setError('视频当前无法播放，请联系运营核验源状态及浏览器格式兼容性。')}/>{media.kind==='live'&&<p>直播可用性以播放器当前连接为准；不支持的推流格式需由媒体服务转换。</p>}</>}<p>{labels[media.kind]} · {media.title} · {media.kind==='live'?'配置时间':'拍摄时间'}：{media.capturedAt.replace('T',' ')}（北京时间）</p><p>{media.description}</p></div>}
        <div className="factory-actions">{selected.productKeyword&&<a className="btn btn-outline" href={`#/hall?q=${encodeURIComponent(selected.productKeyword)}`}>查找相关货源</a>}{selected.traceCode&&<a className="btn btn-outline" href={`#/quality-trace?code=${encodeURIComponent(selected.traceCode)}`}>核验关联溯源码</a>}<button className="btn btn-primary" onClick={()=>setBooking(!booking)}>预约远程验厂 / 看货</button></div>
        {booking&&<form className="factory-booking" onSubmit={e=>void submit(e)}><h3>远程验厂预约</h3><p>运营确认后协调远程会看与材料核验，联系电话仅本人及授权运营人员可见。</p><label>联系人<input name="contact" required maxLength={60}/></label><label>联系电话<input name="phone" type="tel" required maxLength={30}/></label><label>希望验厂时间（北京时间）<input name="requestedAt" type="datetime-local" required/></label><label>关注产品 / 批次与核验需求<textarea name="purpose" required maxLength={600} placeholder="请说明看货品种、批次及生产环境、质量材料等核验需求"/></label><button className="btn btn-primary" disabled={busy} type="submit">{busy?'处理中…':'提交预约'}</button></form>}
      </section>}
    </div>
  </main>
}
