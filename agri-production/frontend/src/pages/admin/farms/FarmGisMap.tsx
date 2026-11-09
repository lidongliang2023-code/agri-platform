import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, Card, Space } from 'antd'
import ReactECharts from 'echarts-for-react'
import type { ProColumns } from '@ant-design/pro-components'
import type { Farm } from '@/types'
import PageContainer from '@/components/ProductionPageContainer'
import ProTable from '@/components/ProductionTable'
import { supervisionFarms } from '@/api/admin/farm-supervision'
export default function FarmGisMap():JSX.Element {
 const [page,setPage]=useState(1);const navigate=useNavigate();const q=useQuery({queryKey:['supervision-map',page],queryFn:()=>supervisionFarms({pageNum:page,pageSize:100}),retry:false});const rows=q.isError?[]:q.data?.list??[]
 const valid=rows.filter(f=>f.longitude!=null&&f.latitude!=null&&Number.isFinite(Number(f.longitude))&&Number.isFinite(Number(f.latitude))&&Math.abs(Number(f.longitude))<=180&&Math.abs(Number(f.latitude))<=90)
 const columns:ProColumns<Farm>[]=[{title:'农场',dataIndex:'farmName',width:240},{title:'主体ID',dataIndex:'tenantId',width:180},{title:'经度',dataIndex:'longitude',width:150},{title:'纬度',dataIndex:'latitude',width:150},{title:'坐标状态',width:130,render:(_,r)=>valid.includes(r)?'已登记':'未登记有效坐标'},{title:'操作',valueType:'option',fixed:'right',width:120,render:(_,r)=><Button type="link" onClick={()=>navigate(`/admin/production/farms/${r.farmId}`)}>监管详情</Button>}]
 return <PageContainer title="农场地理分布" subTitle="真实经纬度分布与坐标缺失清单"><Space direction="vertical" size={16} style={{width:'100%'}}><Alert type="info" message={`当前第${page}页，展示${valid.length}个有效坐标，另有${rows.length-valid.length}个缺失或无效坐标`} description="图中只标记本页真实经纬度；当前未加载地理底图，不推算农场位置、设备或风险数据。可点击坐标进入监管详情。"/>{q.isError&&<Alert type="error" message="坐标查询失败" description={(q.error as Error).message}/>}<Card title="农场坐标分布" loading={q.isFetching}><ReactECharts style={{height:340}} onEvents={{click:(p:{data?:{farmId?:string}})=>{if(p.data?.farmId)navigate(`/admin/production/farms/${p.data.farmId}`)}}} option={{tooltip:{trigger:'item',formatter:(p:{data:{name:string;value:number[]}})=>`${p.data.value[0]}, ${p.data.value[1]}`},xAxis:{type:'value',name:'经度',scale:true},yAxis:{type:'value',name:'纬度',scale:true},series:[{type:'scatter',symbolSize:14,data:valid.map(f=>({name:f.farmName,farmId:String(f.farmId),value:[Number(f.longitude),Number(f.latitude)]})),itemStyle:{color:'#167b51'}}]}}/></Card><ProTable<Farm> rowKey="farmId" headerTitle="坐标台账" columns={columns} dataSource={rows} loading={q.isFetching} search={false} scroll={{x:1100}} columnWidthStorageKey="supervision-map" options={{reload:()=>void q.refetch()}} pagination={{current:page,pageSize:100,total:q.data?.total??0,showSizeChanger:false,onChange:setPage}}/></Space></PageContainer>
}
