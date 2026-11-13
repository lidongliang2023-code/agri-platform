import { Alert, Button, Card, Col, Row, Space } from 'antd'
import { PageTitle } from '../components/ui'
import { useApp } from '../app-context'
import type { OpsPageKey } from '../types'
const audits: {key:OpsPageKey;title:string;description:string}[] = [
 {key:'identity-audit',title:'身份申请审核',description:'审核农户、合作社管理员等业务身份；审核结果参与平台业务能力判定。'},
 {key:'realname-audit',title:'实名认证审核',description:'审核个人实名材料并维护公共实名结果。'},
 {key:'qualification-audit',title:'经营主体资质审核',description:'审核经营主体认证材料、补正及审核记录，统一回写主体认证状态。'},
]
export function AuditWorkbench() {
 const {navigate}=useApp()
 const archive=new URL(window.location.href);archive.port='8190';archive.pathname='/admin/production/approvals/history';archive.search='';archive.hash=''
 return <div className="page-stack"><PageTitle title="审核工作台" eyebrow="公共认证" description="统一办理公共身份与主体认证，各业务模块继续负责自己的业务审批与执行。"/>
 <Alert showIcon type="info" message="复用既有审核记录和权限" description="工作台提供统一入口，各审核页面支持待审核、已通过、已驳回等记录查询。跳转不授予额外权限。"/>
 <Row gutter={[16,16]}>{audits.map(item=><Col xs={24} md={12} xl={8} key={item.key}><Card size="small" title={item.title}><Space direction="vertical"><p>{item.description}</p><Button type="primary" onClick={()=>navigate(item.key)}>进入审核与历史记录</Button></Space></Card></Col>)}</Row>
 <Card size="small" title="业务审批边界"><p>农事计划由经营主体负责人或具备计划审批权限的成员在生产用户端处理；不合格品管控由生产质量模块处理；交易订单、退款与物流由交易履约模块处理。</p><p>原生产审批中的配额单和流程设计未接入真实执行，不作为配额或流程生效依据。旧记录不转换为公共认证申请，避免材料缺失或重复审核。</p><Button href={archive.toString()}>查看生产历史审批档案（需生产运营权限）</Button></Card>
 </div>
}
