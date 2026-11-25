import '@/components/ProductionListDense.css'
import { useState } from 'react'
import { Alert, Button, Drawer, Form, Input, Select, Space, Tag } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import PageContainer from '@/components/ProductionPageContainer'
import Card from '@/components/SectionCard'
import Table from '@/components/ProductionTable'
import ListRowActions from '@/components/ListRowActions'
import DetailInfoGrid from '@/components/DetailInfoGrid'
import { listApprovals } from '@/api/admin/approvals'
import type { Approval } from '@/types'
import '../quality/QualityCompact.css'
const types: Record<string,string> = {PLAN:'农事计划', CERT:'历史认证申请', RECALL:'历史召回申请', QUOTA:'历史配额申请'}
const states: Record<string,string> = {PENDING:'原待审（已停办）',APPROVED:'原已通过',REJECTED:'原已驳回',WITHDRAWN:'原已撤回'}
const time = (v?:string) => v ? v.replace('T',' ').slice(0,19) : '—'
export default function ApprovalHistory() {
 const navigate=useNavigate()
 const [form]=Form.useForm()
 const [filters,setFilters]=useState<{keyword?:string;approvalType?:string;status?:number}>({})
 const [page,setPage]=useState({pageNum:1,pageSize:20})
 const [detail,setDetail]=useState<Approval>()
 const query=useQuery({queryKey:['approval-archive',filters,page],queryFn:()=>listApprovals({...filters,...page}),retry:false})
 return <PageContainer className="quality-workbench production-list-dense production-member-list" title="历史审批档案" subTitle="保留原单据，不作为当前身份、计划、质量或配额状态依据" extra={<Button onClick={()=>navigate('/admin/production/approvals')}>业务办理入口</Button>}>
 <Space direction="vertical" size={10} style={{width:'100%'}}>
 <Alert showIcon type="warning" message="历史记录仅供核查，原待审单已停止办理；需要办理时请在对应模块核实并提交真实业务申请。"/>
 {query.isError&&<Alert type="error" showIcon message="历史档案加载失败" description={String(query.error)} action={<Button onClick={()=>void query.refetch()}>重试</Button>}/>}
 <Card className="production-dense-filter-card"><Form form={form} className="production-filter-grid" onFinish={values=>{setFilters(values);setPage(p=>({...p,pageNum:1}))}}>
 <Form.Item name="keyword" label="关键词"><Input allowClear placeholder="审批编号、标题或申请人"/></Form.Item>
 <Form.Item name="approvalType" label="业务类型"><Select allowClear placeholder="全部" options={Object.entries(types).map(([value,label])=>({value,label}))}/></Form.Item>
 <Form.Item name="status" label="原单状态"><Select allowClear placeholder="全部" options={[{value:1,label:states.PENDING},{value:2,label:states.APPROVED},{value:3,label:states.REJECTED},{value:4,label:states.WITHDRAWN}]}/></Form.Item>
 <Form.Item className="production-filter-actions"><Space size={8}><Button onClick={()=>{form.resetFields();setFilters({});setPage(p=>({...p,pageNum:1}))}}>重置</Button><Button type="primary" htmlType="submit" loading={query.isFetching}>查询</Button></Space></Form.Item>
 </Form></Card>
 <Card><Table<Approval,Record<string,unknown>> rowKey="approvalId" memberListToolbar rowSelection={{}} cardProps={false} headerTitle="历史单据" search={false} loading={query.isFetching} dataSource={query.data?.list??[]} scroll={{x:1000}} options={{reload:()=>{void query.refetch()}}} pagination={{current:page.pageNum,pageSize:page.pageSize,total:query.data?.total??0,showSizeChanger:true,onChange:(pageNum,pageSize)=>setPage({pageNum,pageSize})}} columns={[
 {title:'审批编号',dataIndex:'approvalId',width:180},{title:'事项',dataIndex:'title',width:240},{title:'类型',dataIndex:'bizType',render:(_,r)=>types[r.bizType??'']??r.bizType??'—'},
 {title:'主体标识',dataIndex:'tenantId',width:140},{title:'申请人',dataIndex:'applicantName'},
 {title:'原单状态',dataIndex:'status',width:160,render:(_,r)=><Tag>{states[String(r.status).toUpperCase()]??String(r.status)}</Tag>},
 {title:'提交时间',dataIndex:'submitAt',width:170,render:(_,r)=>time(r.submitAt??r.submittedAt)},
 {title:'操作',valueType:'option',width:100,render:(_,r)=><ListRowActions items={[<Button key="view" type="link" size="small" onClick={()=>setDetail(r)}>查看</Button>]}/>}
 ]}/></Card></Space>
 <Drawer title="历史审批详情" rootClassName="quality-dialog quality-detail" open={!!detail} width={760} onClose={()=>setDetail(undefined)}>
 {detail&&<DetailInfoGrid items={[
 {label:'审批编号',value:detail.approvalId},{label:'原单状态',value:states[String(detail.status).toUpperCase()]??String(detail.status)},
 {label:'事项',value:detail.title,fullWidth:true},{label:'业务类型',value:types[detail.bizType??'']??detail.bizType},
 {label:'主体标识',value:detail.tenantId},{label:'关联业务标识',value:detail.bizId},{label:'申请人',value:detail.applicantName},
 {label:'原审批人标识',value:detail.currentApproverId},{label:'提交时间',value:time(detail.submitAt??detail.submittedAt)},
 {label:'审批时间',value:time(detail.approveAt??detail.approvedAt)},{label:'原审批意见',value:detail.approveOpinion??detail.approveRemark,fullWidth:true}
 ]}/>}
 </Drawer></PageContainer>
}
