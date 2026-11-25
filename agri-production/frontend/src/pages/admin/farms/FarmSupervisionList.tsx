import './FarmSupervisionCompact.css'
import '@/components/ProductionListDense.css'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, Button, Input, Segmented, Select, Tag } from 'antd'
import type { ProColumns } from '@ant-design/pro-components'
import type { Farm } from '@/types'
import PageContainer from '@/components/ProductionPageContainer'
import ProTable from '@/components/ProductionTable'
import ListRowActions from '@/components/ListRowActions'
import { supervisionFarms } from '@/api/admin/farm-supervision'
import FarmGisMap from './FarmGisMap'
import Card from '@/components/SectionCard'
export default function FarmSupervisionList({ initialView = 'list' }: { initialView?: 'list' | 'map' }):JSX.Element {
 const [params, setParams] = useSearchParams()
 const [view, setView] = useState<'list' | 'map'>(() => params.has('farmId') || params.get('view') === 'map' ? 'map' : initialView)
 useEffect(() => { setView(params.has('farmId') || params.get('view') === 'map' ? 'map' : initialView) }, [params, initialView])
 const navigate=useNavigate();const [page,setPage]=useState(1);const [size,setSize]=useState(20);const [keyword,setKeyword]=useState('');const [tenant,setTenant]=useState('');const [status,setStatus]=useState<string>()
 const q=useQuery({queryKey:['farm-supervision',page,size,keyword,tenant,status],queryFn:()=>supervisionFarms({pageNum:page,pageSize:size,keyword,tenantId:tenant||undefined,status}),retry:false,refetchOnWindowFocus:true,enabled:view==='list'})
 const columns:ProColumns<Farm>[]=[
  {title:'农场名称',dataIndex:'farmName',width:220,ellipsis:true,render:(_,r)=><Button type="link" className="production-dense-cell-link" title={r.farmName} onClick={()=>navigate(`/admin/production/farms/${r.farmId}`)}>{r.farmName}</Button>},
  {title:'农场编号',dataIndex:'farmCode',width:160,ellipsis:true},
  {title:'所属经营主体',dataIndex:'tenantName',width:220,ellipsis:true,render:(_,r)=>{const label=r.tenantName||'主体名称暂不可用';return <span className="production-dense-link-ellipsis" title={label}>{label}</span>}},
  {title:'区域',width:200,ellipsis:true,render:(_,r)=>{const area=[r.province,r.city,r.district].filter(Boolean).join(' / ')||'未登记';return <span className="production-dense-link-ellipsis" title={area}>{area}</span>}},
  {title:'面积（亩）',dataIndex:'areaTotal',width:120,ellipsis:true},
  {title:'经营状态',width:110,render:(_,r)=><Tag color={Number(r.status)===1?'green':'default'}>{Number(r.status)===1?'启用':'停用'}</Tag>},
  {title:'操作',valueType:'option',fixed:'right',width:170,render:(_,r)=><ListRowActions items={[<Button key="detail" type="link" size="small" onClick={()=>navigate(`/admin/production/farms/${r.farmId}`)}>监管详情</Button>,<Button key="check" type="link" size="small" onClick={()=>navigate(`/admin/production/farms/compliance?farmId=${r.farmId}`)}>检查整改</Button>]}/>}
 ]
 return <PageContainer
  className="farm-supervision-compact production-list-dense production-member-list"
  title="农场监管"
  subTitle="统一查看农场监管台账、地理分布，维护坐标与边界"
  extra={<Segmented value={view} onChange={key=>{setView(key as 'list' | 'map');setParams(current=>{const next=new URLSearchParams(current);next.set('view',String(key));next.delete('farmId');next.delete('edit');return next},{replace:true})}} options={[{value:'list',label:'监管列表'},{value:'map',label:'地图监管'}]} />}
 >
  {view==='map'?<FarmGisMap embedded />:<>
   {q.isError&&<Alert type="error" style={{marginBottom:8}} message="农场读取失败" description={(q.error as Error).message}/>}
   <Card className="production-dense-filter-card">
    <div className="production-filter-grid">
     <div className="production-filter-field"><label>农场名称 / 编号</label><Input value={keyword} allowClear placeholder="请输入农场名称或编号" onChange={e=>{setKeyword(e.target.value);setPage(1)}}/></div>
     <div className="production-filter-field"><label>经营主体 ID</label><Input value={tenant} allowClear placeholder="请输入经营主体 ID" onChange={e=>{setTenant(e.target.value);setPage(1)}}/></div>
     <div className="production-filter-field"><label>经营状态</label><Select value={status} allowClear placeholder="全部" options={[{label:'运营中',value:'active'},{label:'已停用',value:'inactive'}]} onChange={v=>{setStatus(v);setPage(1)}}/></div>
     <div className="production-filter-actions">
      <Button onClick={()=>{setKeyword('');setTenant('');setStatus(undefined);setPage(1)}}>重置</Button>
      <Button type="primary" loading={q.isFetching} onClick={()=>{setPage(1);void q.refetch()}}>查询</Button>
     </div>
    </div>
   </Card>
   <Card>
    <ProTable<Farm> rowKey="farmId" memberListToolbar rowSelection={{}} cardProps={false} headerTitle={<span className="production-dense-summary-note">共 {q.data?.total??0} 家 · 农场状态与用户端共用生产台账，监管风险以实际检查问题为依据</span>} columns={columns} dataSource={q.isError?[]:q.data?.list??[]} loading={q.isFetching} search={false} scroll={{x:1200}} columnWidthStorageKey="supervision-farms" columnsState={{persistenceKey:'supervision-farms-columns',persistenceType:'localStorage'}} options={{reload:()=>void q.refetch()}} pagination={{current:page,pageSize:size,total:q.data?.total??0,showSizeChanger:true,onChange:(p,s)=>{setPage(s===size?p:1);setSize(s)}}}/>
   </Card>
  </>}
 </PageContainer>
}
