import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Descriptions, Space, Spin } from 'antd'
import PageContainer from '@/components/ProductionPageContainer'
import FarmRectificationPanel from '@/components/FarmRectificationPanel'
import { supervisionDetail } from '@/api/admin/farm-supervision'
export default function FarmSupervisionDetail():JSX.Element {
 const {farmId}=useParams();const navigate=useNavigate();const q=useQuery({queryKey:['supervision-detail',farmId],queryFn:()=>supervisionDetail(farmId!),enabled:!!farmId,retry:false,refetchOnWindowFocus:true});const d=q.data;const farm=d?.farm
 return <PageContainer title={farm?.farmName||'农场监管详情'} onBack={()=>navigate('/admin/production/farms')} extra={<Button onClick={()=>void q.refetch()}>刷新档案</Button>}><Space direction="vertical" size={16} style={{width:'100%'}}>{q.isFetching&&<Spin/>}{q.isError&&<Alert type="error" message="农场档案读取失败" description={(q.error as Error).message}/>} {farm&&<><Descriptions bordered column={2} items={[{key:'code',label:'农场编号',children:farm.farmCode},{key:'tenant',label:'所属主体ID',children:farm.tenantId},{key:'status',label:'经营状态',children:Number(farm.status)===1?'启用':'停用'},{key:'area',label:'面积（亩）',children:farm.areaTotal},{key:'plots',label:'地块数',children:d?.plotCount},{key:'checks',label:'检查记录数',children:d?.checkCount},{key:'open',label:'未闭环问题',children:d?.openCount},{key:'review',label:'待复核',children:d?.reviewCount},{key:'address',label:'地址',children:[farm.province,farm.city,farm.district,farm.address].filter(Boolean).join(' ')}]}/><FarmRectificationPanel farmId={farmId}/></>}</Space></PageContainer>
}
