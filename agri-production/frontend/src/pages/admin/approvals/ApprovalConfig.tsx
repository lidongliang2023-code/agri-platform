import '@/components/ProductionListDense.css'
import { Alert, Button, Collapse, Space, Tag } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import PageContainer from '@/components/ProductionPageContainer'
import Card from '@/components/SectionCard'
import BusinessRecordList from '@/components/BusinessRecordList'
import { listApprovalFlows } from '@/api/admin/approvals'
import '../quality/QualityCompact.css'
export default function ApprovalConfig() {
 const navigate=useNavigate()
 const query=useQuery({queryKey:['legacy-approval-flows'],queryFn:()=>listApprovalFlows({pageNum:1,pageSize:200}),retry:false})
 return <PageContainer className="quality-workbench production-list-dense production-member-list" title="历史流程配置" subTitle="旧配置未驱动真实审批执行，仅供审计查阅" extra={<Button onClick={()=>navigate('/admin/production/approvals')}>业务办理入口</Button>}>
 <Space direction="vertical" size={10} style={{width:'100%'}}><Alert type="warning" showIcon message="流程设计器已停用" description="节点、条件和升级配置未接入执行引擎，不代表业务规则生效。公共认证沿用用户中心现有审核规则，计划沿用主体内部审批权限。"/>
 {query.isError&&<Alert type="error" message="旧配置加载失败" description={String(query.error)}/>}
 <Card><BusinessRecordList memberListToolbar rowSelection={{}} toolbarTitle="旧配置档案" rowKey="flowId" loading={query.isFetching} dataSource={query.data?.list??[]} onReload={()=>void query.refetch()} pagination={{defaultPageSize:20,showSizeChanger:true}} scroll={{x:650}} columns={[
 {title:'配置编号',dataIndex:'flowId',width:180},{title:'原流程名称',dataIndex:'flowName',width:220},{title:'原业务类型',dataIndex:'approvalType',width:160},
 {title:'执行状态',key:'execStatus',width:160,render:()=><Tag>已停用（只读档案）</Tag>}
 ]} expandable={{expandedRowRender:row=><Collapse items={[{key:'config',label:'查看原配置内容',children:<pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(row,null,2)}</pre>}]}/>}}/></Card>
 </Space></PageContainer>
}
