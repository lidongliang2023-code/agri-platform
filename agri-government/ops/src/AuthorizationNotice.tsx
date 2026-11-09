import {useEffect,useState} from 'react'
import {Alert,Button,Collapse,Space,Tag} from 'antd'
import {opsApi,type IdentityCard,type PersonnelGrant,type RegulatoryScope} from './api'
import './scope-config.css'
const labels:Record<string,string>={inspection:'执法检查',sampling:'监督抽检',case:'案件处置',credit:'信用监管',complaint:'举报处理',statistics:'监管统计',subsidy:'补贴审核'}
const duties:Record<string,string>={warnings:'inspection',tasks:'inspection',cases:'case',repairs:'credit',subsidies:'subsidy',complaints:'complaint',samplings:'sampling',statistics:'statistics'}
const configPages=new Set(['users','scopes','personnel-grants','region-registry','items'])
function reason(g:PersonnelGrant,scopes:RegulatoryScope[],today:string){
 if(g.status!=='enabled')return '授权已停用'
 if(!/^\d{4}-\d{2}-\d{2}$/.test(g.validFrom)||!/^\d{4}-\d{2}-\d{2}$/.test(g.validUntil))return '有效期异常'
 if(today<g.validFrom)return '尚未生效'
 if(today>g.validUntil)return '授权已到期'
 const s=scopes.find(s=>s.id===g.scopeId)
 if(!s)return '机构登记不存在'
 if(s.status!=='enabled')return '机构已停用'
 if(!g.regions?.length)return '未配置辖区'
 if(g.regions.some(r=>!s.regions.some(a=>a.code===r.code&&(!r.includeChildren||a.includeChildren)&&r.duties.length>0&&r.duties.every(d=>a.duties.includes(d)))))return '机构范围已变化，需重新核对授权'
 return ''
}
export default function AuthorizationNotice({page}:{page:string}){
 const [data,setData]=useState<{identity:IdentityCard;grants:PersonnelGrant[];scopes:RegulatoryScope[]}|null>(null)
 const [error,setError]=useState(''),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0)
 useEffect(()=>{let active=true;setLoading(true);setError('');setData(null)
 Promise.all([opsApi.identity(),opsApi.grants(),opsApi.scopes()]).then(([identity,grants,scopes])=>{if(active)setData({identity,grants,scopes})}).catch(e=>{if(active)setError(e instanceof Error?e.message:'授权信息加载失败')}).finally(()=>{if(active)setLoading(false)})
 return()=>{active=false}},[page,revision])
 const refresh=<Button size="small" loading={loading} onClick={()=>setRevision(v=>v+1)}>刷新授权状态</Button>
 if(error)return <div className="scope-auth-notice"><Alert showIcon type="error" message="授权状态加载失败，不能据此判断没有权限" description={error} action={refresh}/></div>
 if(loading||!data)return <div className="scope-auth-notice"><Alert showIcon type="info" message="正在读取当前账号的辖区授权…"/></div>
 const {identity,grants,scopes}=data
 const now=new Date(),today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
 const mine=grants.filter(g=>String(g.personnelId)===String(identity.inspectorId))
 const available=mine.filter(g=>!reason(g,scopes,today)),required=duties[page]
 const capable=available.some(g=>g.regions.some(r=>!required||r.duties.includes(required)))
 const config=configPages.has(page)
 const title=!identity.inspectorId?'当前账号未绑定有效监管人员档案':!mine.length?'当前人员尚未登记辖区授权':!available.length?'当前人员没有生效的辖区授权':required&&!capable?`当前页面缺少「${labels[required]}」职责授权`:'当前人员已登记辖区授权'
 const details=!identity.inspectorId?'请在“组织与权限”中将当前平台账号绑定到启用的监管人员档案，再配置机构和人员授权。':!mine.length?'请先登记监管机构及辖区，再在“监管人员授权”中为当前人员配置职责和有效期。':!available.length?'请展开授权明细查看停用、到期或机构范围变化等原因，核实后修改对应登记。':required&&!capable?'请由授权管理员核实职责依据后调整授权；已有其他职责不代表可以办理本页业务。':'业务记录还须登记行政区划编码，且落在相应职责的授权辖区内。空列表也可能表示范围内暂无记录，不能据此判断全平台没有数据。'
 return <section className="scope-auth-notice" aria-label="当前辖区授权"><Alert showIcon type={capable||config?'info':'warning'} message={title} description={<><p>{identity.operatorName||'当前账号'}{identity.inspectorName?` · ${identity.inspectorName}`:''}。{details}</p><p>{config?'当前为配置管理页面，登记和管理权限不等于执法权限。':'平台管理员身份不自动获得全域执法权。'}{page==='dashboard'?' 工作台各项指标按对应职责过滤，部分指标可能为空。':''}{page==='statistics'?' 全域历史趋势和交易额尚无辖区映射，暂不提供。':''}{page==='sharing'?' 跨部门共享尚未建立可核实的范围映射，暂不开放审批。':''}</p><Space wrap><Button size="small" href="#/users">人员账号绑定</Button><Button size="small" href="#/scopes">机构与辖区</Button><Button size="small" href="#/personnel-grants">人员授权</Button><Button size="small" href="#/region-registry">业务辖区登记</Button>{refresh}</Space></>}/>{mine.length>0&&<Collapse size="small" items={[{key:'detail',label:`查看当前人员授权明细（${mine.length} 条）`,children:<><p>以下为登记状态提示；实际访问以服务端即时校验为准，有效期按服务端日期判定。</p>{mine.map(g=><div className="scope-auth-record" key={g.id}><strong>{scopes.find(s=>s.id===g.scopeId)?.organizationName||'机构登记不存在'}</strong> <Tag color={reason(g,scopes,today)?'orange':'green'}>{reason(g,scopes,today)||'登记范围有效'}</Tag><p>{g.validFrom} 至 {g.validUntil}</p>{g.regions.map(r=><p key={r.code}>{r.name}（{r.code}） · {r.includeChildren?'含下级地区':'仅本级'} · {r.duties.map(d=>labels[d]||d).join('、')}</p>)}</div>)}</>}]} />}</section>
}
