import '@/components/ProductionListDense.css'
import { Alert, Button, Space } from 'antd'
import { useNavigate } from 'react-router-dom'
import PageContainer from '@/components/ProductionPageContainer'
import Card from '@/components/SectionCard'
import BusinessRecordList from '@/components/BusinessRecordList'
import ListRowActions from '@/components/ListRowActions'
import '../quality/QualityCompact.css'
export function userCenterAuditUrl() {
  const url = new URL(window.location.href)
  url.port = '8115'; url.pathname = '/user-center-ops/'; url.search = ''; url.hash = '/audit-workbench'
  return url.toString()
}
/** 历史书签兼容入口。审批事实与结果由所属业务负责，不新建审批单。 */
export default function ApprovalPending() {
  const navigate = useNavigate()
  const rows = [
    { key: 'identity', name: '身份、实名及经营主体认证', owner: '用户中心', note: '复用公共认证申请、材料和审核记录；需具备用户中心权限。', action: <Button type="link" size="small" href={userCenterAuditUrl()}>进入审核工作台</Button> },
    { key: 'plan', name: '农事计划审批', owner: '生产管理 · 经营主体内部', note: '由主体负责人或具有计划审批权限的成员处理，平台运营不可代审。', action: <Button type="link" size="small" onClick={() => navigate('/production/plans')}>进入主体计划</Button> },
    { key: 'quality', name: '不合格品管控', owner: '生产管理 · 质量安全', note: '按真实检测单冻结批次、库存及溯源码；订单履约由交易模块负责。', action: <Button type="link" size="small" onClick={() => navigate('/admin/production/quality/recalls')}>进入不合格品处置</Button> },
    { key: 'quota', name: '历史配额调整申请', owner: '历史档案', note: '旧单未接入有效配额规则，不再审批；历史结果不代表已变更配额。', action: <Button type="link" size="small" onClick={() => navigate('/admin/production/approvals/history')}>查询旧记录</Button> },
  ]
  return <PageContainer className="quality-workbench production-list-dense production-member-list" title="审批业务入口" subTitle="公共认证已归并用户中心，业务审批回到所属模块">
    <Space direction="vertical" size={10} style={{ width: '100%' }}>
      <Alert showIcon type="info" message="原审批管理已收敛为业务入口，旧审批单与流程配置仅保留查询。" />
      <Card><BusinessRecordList memberListToolbar rowSelection={{}} toolbarTitle={<Space size={8}><Button onClick={() => navigate('/admin/production/approvals/history')}>历史审批档案</Button><Button onClick={() => navigate('/admin/production/approvals/config')}>历史流程配置</Button></Space>} pagination={{ defaultPageSize: 20, showSizeChanger: true }} rowKey="key" dataSource={rows} scroll={{ x: 760 }} columns={[
        {title:'事项',dataIndex:'name',width:210},{title:'办理模块',dataIndex:'owner',width:200},{title:'业务说明',dataIndex:'note'},{title:'操作',key:'action',width:170,render:(_:unknown,r:{action:JSX.Element})=><ListRowActions items={[r.action]}/>}
      ]}/></Card>
    </Space>
  </PageContainer>
}
