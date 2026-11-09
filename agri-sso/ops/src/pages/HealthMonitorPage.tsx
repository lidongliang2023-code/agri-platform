import {useEffect,useRef,useState} from 'react'
import {Alert,Button,Card,Collapse,Input,Select,Space,Tag} from 'antd'
import {healthMonitor} from '../api'
import './health-monitor.css'
export interface HealthSnapshot {checkedAt:string;intervalSeconds:number;services:Array<{id:string;name:string;status:string;checkedAt:string;probes:Array<{name:string;status:string;message:string;httpCode:number;latencyMs:number}>}>;events:Array<{name:string;from:string;to:string;at:string}>}
const label=(s:string)=>({UP:'正常',ATTENTION:'需要处理',UNCONFIGURED:'未配置',MISSING:'探针缺失',DOWN:'未就绪',DENIED:'访问受限',TIMEOUT:'超时',UNREACHABLE:'无法连接',INVALID:'响应异常',ERROR:'探测失败'}[s]||s)
export function HealthMonitorPage(){
 const [data,setData]=useState<HealthSnapshot|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[revision,setRevision]=useState(0),[keyword,setKeyword]=useState(''),[filter,setFilter]=useState('all')
 const lastSuccess=useRef(0)
 useEffect(()=>{let active=true,busy=false
  const load=async()=>{if(busy)return;busy=true;if(active)setLoading(true)
   try{const next=await healthMonitor();if(active){setData(next);setError('');lastSuccess.current=Date.now()}}
   catch(e){if(active)setError(e instanceof Error?e.message:'监控数据读取失败')}
   finally{busy=false;if(active)setLoading(false)}}
  void load();const timer=window.setInterval(()=>{if(!document.hidden)void load()},30000)
  const visible=()=>{if(!document.hidden)void load()};document.addEventListener('visibilitychange',visible)
  return()=>{active=false;clearInterval(timer);document.removeEventListener('visibilitychange',visible)}
 },[revision])
 const rows=data?.services||[],good=rows.filter(x=>x.status==='UP').length,missing=rows.filter(x=>x.status==='UNCONFIGURED').length
 const stale=Boolean(data?.checkedAt&&Date.now()-Date.parse(data.checkedAt)>90000)
 const shown=rows.filter(x=>x.name.includes(keyword.trim())&&(filter==='all'||(filter==='issues'?x.status!=='UP':x.status==='UP')))
 return <div className="health-monitor"><header><div><small>平台运维</small><h1>统一健康监控</h1><p>后台持续巡检 · 综合健康、存活、就绪分别判断</p></div><Button loading={loading} onClick={()=>setRevision(x=>x+1)}>刷新监控快照</Button></header>
 {error&&<Alert type="error" showIcon message="监控数据读取失败" description={`${error}。当前展示可能是上次成功结果，不代表服务仍然健康。`}/>}
 {stale&&<Alert type="warning" showIcon message="巡检结果已超过 90 秒未更新，请检查核心平台监控任务"/>}
 <div className="health-summary">{[['纳管服务',rows.length],['正常',good],['需要处理',rows.length-good-missing],['未配置',missing]].map(([name,value])=><Card key={name}><span>{name}</span><strong>{value}</strong></Card>)}</div>
 <Alert type="info" showIcon message="健康状态不等于业务闭环验证通过" description="核心平台每轮完成后间隔 30 秒巡检；页面每 30 秒读取快照。异常仅在本页及服务日志记录，不自动重启服务，也未接入短信、邮件或外部告警。监控自身不可访问时，本页会提示读取失败。"/>
 <div className="health-tools"><Input placeholder="搜索子系统" value={keyword} onChange={e=>setKeyword(e.target.value)}/><Select value={filter} onChange={setFilter} options={[{value:'all',label:'全部服务'},{value:'issues',label:'只看异常 / 未配置'},{value:'healthy',label:'只看正常'}]}/><span>最近巡检：{data?.checkedAt?new Date(data.checkedAt).toLocaleString():'等待首轮巡检'}</span></div>
 {!shown.length&&<Card>{loading?'正在读取…':rows.length?'没有符合筛选条件的服务':'后台正在准备首轮巡检，请稍后刷新'}</Card>}
 <div className="health-grid">{shown.map(s=><Card key={s.id} title={s.name} extra={<Tag color={s.status==='UP'?'green':s.status==='UNCONFIGURED'?'default':'orange'}>{label(s.status)}</Tag>}>
 {s.status==='UNCONFIGURED'?<p>尚未确认独立运行地址。部署时配置对应服务目标后纳入巡检；不计为健康。</p>:s.probes.map(p=><div className="health-probe" key={p.name}><div><b>{p.name}</b><Tag color={p.status==='UP'?'green':'red'}>{label(p.status)}</Tag></div><p>{p.message}</p><small>{p.latencyMs} ms{Number(p.httpCode)>0?` · HTTP ${p.httpCode}`:''}</small></div>)}
 </Card>)}</div>
 <Collapse items={[{key:'events',label:'最近状态变化（本次服务运行期间最多 100 条）',children:<Space direction="vertical">{data?.events.map((e,i)=><div key={`${e.at}-${i}`}><b>{e.name}</b> · {label(e.from)} → {label(e.to)} <small>{new Date(e.at).toLocaleString()}</small></div>)}{!data?.events.length&&'尚无状态变化记录'}</Space>}]}/>
 </div>
}
