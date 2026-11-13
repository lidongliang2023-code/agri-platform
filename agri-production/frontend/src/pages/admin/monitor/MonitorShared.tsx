import { useQuery } from '@tanstack/react-query'
import { Alert, Select, Space, Statistic } from 'antd'
import { supervisionFarms } from '@/api/admin/farm-supervision'
import PageContainer from '@/components/ProductionPageContainer'
import Card from '@/components/SectionCard'
import type { ReactNode } from 'react'
import './MonitorCompact.css'
export { Card }
export function MonitorPage({title,subTitle,extra,children}:{title:string;subTitle:string;extra?:ReactNode;children:ReactNode}){return <PageContainer className="production-monitor-compact farm-supervision-compact" title={title} subTitle={subTitle} extra={extra}><Space direction="vertical" size={12} style={{width:'100%'}}>{children}</Space></PageContainer>}
export function QueryError({error}:{error:unknown}){return error?<Alert type="error" showIcon message="数据加载失败" description={error instanceof Error?error.message:'请稍后重试'} />:null}
export function FarmFilter({value,onChange}:{value?:string;onChange:(v:string|undefined)=>void}){
 const q=useQuery({queryKey:['monitor-farm-options'],queryFn:async()=>{let page=1,total=0;const rows:import('@/types').Farm[]=[];do{const r=await supervisionFarms({pageNum:page++,pageSize:100});rows.push(...r.list);total=r.total;if(!r.list.length)break}while(rows.length<total);return rows},retry:false})
 return <Space direction="vertical" size={2}><Select showSearch allowClear optionFilterProp="label" placeholder="全部农场" aria-label="监控农场" style={{width:220}} value={value} loading={q.isFetching} onChange={onChange} options={(q.data??[]).map(f=>({value:String(f.farmId),label:f.farmName}))}/>{q.isError&&<span style={{color:'#cf1322',fontSize:12}}>农场选项加载失败</span>}</Space>
}
export function Metrics({items}:{items:{title:string;value:string|number}[]}){return <div className="monitor-metrics">{items.map(i=><Card key={i.title}><Statistic title={i.title} value={i.value}/></Card>)}</div>}
export const statusNames:Record<string,string>={pending:'待派发',assigned:'已派发',doing:'执行中',executing:'执行中',done:'已完成',completed:'已完成',suspended:'已暂停',cancelled:'已取消',expired:'已过期',rejected:'已驳回',overdue:'已逾期'}
export const isFinal=(s:string)=>['done','completed','cancelled','expired','rejected'].includes(s)

export const iotOpsUrl=(page:string)=>{const u=new URL(window.location.href);u.port="8102";u.pathname=`/${page}`;u.search="";u.hash="";return u.toString()}

export const displayTime=(value?:string)=>value?value.replace("T"," ").slice(0,19):"—"
export const alertLevels:Record<string,string>={error:"紧急",CRITICAL:"紧急",critical:"紧急",urgent:"紧急",URGENT:"紧急",warn:"重要",WARN:"重要",warning:"重要",important:"重要",info:"一般",INFO:"一般",normal:"一般"}
