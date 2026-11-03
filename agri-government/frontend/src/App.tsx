import { useEffect, useState, type ReactNode } from 'react'
import {
  AuditOutlined, BankOutlined, BellOutlined, CheckCircleFilled, CreditCardOutlined,
  FileProtectOutlined, FileSearchOutlined, HomeOutlined, IdcardOutlined, MenuFoldOutlined,
  MenuUnfoldOutlined, MessageOutlined, SafetyCertificateOutlined, SearchOutlined, SolutionOutlined,
  TeamOutlined, WarningOutlined,
} from '@ant-design/icons'
import { App as AntApp, Button, Form, Input, InputNumber, Modal, Progress, Select, Tabs, Tag } from 'antd'
import {
  govApi, SUBJECT_STATUS, type Complaint, type CreditProfile, type HomeData, type IdentityCard,
  type Inspection, type License, type Penalty, type Policy, type Rectification, type Report,
  type Subject, type Subsidy,
} from './api'
import { logoutUnified, useUnifiedUser } from './sso'

type Page = 'home' | 'workbench' | 'subject' | 'reports' | 'self-check' | 'credit' | 'enforcement'
  | 'policies' | 'public' | 'interaction' | 'messages' | 'logs'
const PAGES: Page[] = ['home', 'workbench', 'subject', 'reports', 'self-check', 'credit', 'enforcement', 'policies', 'public', 'interaction', 'messages', 'logs']
const TITLES: Record<Page, string> = {
  home: '监管服务门户', workbench: '我的监管工作台', subject: '主体信息与资质', reports: '数据报送',
  'self-check': 'AI 合规自查', credit: '信用与修复', enforcement: '检查整改与处罚',
  policies: '政策与补贴', public: '公众查询', interaction: '投诉举报与建议', messages: '消息通知', logs: '操作记录',
}
const NAV: Array<{ group: string; items: Array<{ page: Page; label: string; icon: ReactNode }> }> = [
  { group: '门户', items: [{ page: 'home', label: '监管服务首页', icon: <HomeOutlined /> }, { page: 'workbench', label: '我的监管工作台', icon: <AuditOutlined /> }] },
  { group: '主体办事', items: [
    { page: 'subject', label: '主体信息与资质', icon: <IdcardOutlined /> },
    { page: 'reports', label: '数据报送', icon: <FileSearchOutlined /> },
    { page: 'self-check', label: 'AI 合规自查', icon: <SafetyCertificateOutlined /> },
  ] },
  { group: '信用与执法', items: [
    { page: 'credit', label: '信用档案与修复', icon: <CreditCardOutlined /> },
    { page: 'enforcement', label: '检查整改与处罚', icon: <FileProtectOutlined /> },
  ] },
  { group: '政策与公开', items: [
    { page: 'policies', label: '政策项目与补贴', icon: <BankOutlined /> },
    { page: 'public', label: '公众查询与公示', icon: <SearchOutlined /> },
    { page: 'interaction', label: '投诉举报与建议', icon: <MessageOutlined /> },
  ] },
  { group: '我的', items: [
    { page: 'messages', label: '消息通知', icon: <BellOutlined /> },
    { page: 'logs', label: '操作记录', icon: <SolutionOutlined /> },
  ] },
]

function parsePage(): Page {
  const key = window.location.hash.replace(/^#\/?/, '').split('?')[0] as Page
  return PAGES.includes(key) ? key : 'home'
}
/** 顶栏搜索要把词带到公众查询页，否则按回车只是切了个标签页。 */
const transfer = { keyword: '' }
function go(page: Page) { window.location.hash = `/${page}` }
function Status({ value }: { value: string }) {
  const item = SUBJECT_STATUS[value] ?? { label: value, tone: 'gray' }
  return <Tag className={`g-status tone-${item.tone}`}>{item.label}</Tag>
}
function SectionTitle({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return <div className="g-title"><div>{eyebrow && <small>{eyebrow}</small>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div>{actions}</div>}</div>
}
function Loading() { return <div className="g-loading"><i /><i /><i /></div> }

function HomePage() {
  const { message } = AntApp.useApp()
  const [data, setData] = useState<HomeData | null>(null)
  useEffect(() => { govApi.home().then(setData).catch((e: Error) => message.error(e.message)) }, [message])
  if (!data) return <Loading />
  return <div className="g-page">
    <section className="g-home-hero">
      <div><span className="g-kicker"><i /> 农业产业政府监管服务</span><h1>让监管更透明，让办事更简单</h1><p>主体档案、数据报送、信用修复、政策补贴、执法协同与公众查询，一站办理。</p><div><Button type="primary" onClick={() => go('workbench')}>进入我的工作台</Button><Button onClick={() => go('public')}>公众查询</Button></div></div>
      <div className="g-home-subject"><span><BankOutlined /></span><small>当前主体</small><b>{data.subject.subjectName}</b><p>{data.subject.creditCode}</p><em>信用 {data.stats.creditScore} 分 · {data.subject.creditLevel} 级</em></div>
    </section>
    <section className="g-metrics">
      <Metric icon={<CreditCardOutlined />} label="信用分" value={String(data.stats.creditScore)} hint={`${data.subject.creditLevel} 级守信主体`} tone="green" />
      <Metric icon={<WarningOutlined />} label="待办事项" value={String(data.stats.pendingTasks)} hint="整改、补贴与信用事项" tone="amber" />
      <Metric icon={<SafetyCertificateOutlined />} label="证照提醒" value={String(data.stats.licenseAlerts)} hint="全部证照状态持续监测" tone="blue" />
      <Metric icon={<BellOutlined />} label="未读消息" value={String(data.stats.unreadMessages)} hint="监管文书与政策提醒" tone="purple" />
    </section>
    <div className="g-home-grid">
      <section className="g-card"><div className="g-card-head"><div><small>MY TASKS</small><b>我的监管待办</b></div><Button size="small" onClick={() => go('workbench')}>全部</Button></div>{data.todos.map((todo, i) => <button type="button" className="g-todo" key={todo.title} onClick={() => go(todo.route as Page)}><span className={`g-dot tone-${i}`} /><div><b>{todo.title}</b><p>{todo.content}</p></div><em>{todo.progress}</em></button>)}</section>
      <section className="g-ai-card"><span><SafetyCertificateOutlined /></span><small>AI 合规助手</small><h2>提前发现风险<br />比事后整改更重要</h2><p>基于主体资质、生产记录、信用和执法数据完成体检，结果仅主体可见。</p><Button onClick={() => go('self-check')}>开始 AI 合规自查</Button></section>
    </div>
    <div className="g-home-grid">
      <section className="g-card"><div className="g-card-head"><div><small>POLICIES</small><b>最新政策</b></div><Button size="small" onClick={() => go('policies')}>更多</Button></div>{data.policies.map((policy) => <button type="button" className="g-policy-mini" key={policy.id} onClick={() => go('policies')}><Tag>{policy.level}</Tag><b>{policy.title}</b><small>{policy.publishDate}</small></button>)}</section>
      <section className="g-card"><div className="g-card-head"><div><small>PUBLIC NOTICE</small><b>抽检结果公示</b></div><Button size="small" onClick={() => go('public')}>查看</Button></div>{data.publicNotices.map((item) => <div className="g-notice-row" key={item.samplingNo}><span className={item.result === '合格' ? 'ok' : 'bad'}>{item.result}</span><div><b>{item.productName} · {item.subjectName}</b><small>{item.samplingNo} · {item.disposition}</small></div></div>)}</section>
    </div>
  </div>
}

function Metric({ icon, label, value, hint, tone }: { icon: ReactNode; label: string; value: string; hint: string; tone: string }) {
  return <div className={`g-metric tone-${tone}`}><span>{icon}</span><div><small>{label}</small><b>{value}</b><em>{hint}</em></div></div>
}

function WorkbenchPage() {
  const { message } = AntApp.useApp()
  const [home, setHome] = useState<HomeData | null>(null)
  const [licenses, setLicenses] = useState<License[]>([])
  useEffect(() => { Promise.all([govApi.home(), govApi.licenses()]).then(([a, b]) => { setHome(a); setLicenses(b) }).catch((e: Error) => message.error(e.message)) }, [message])
  if (!home) return <Loading />
  return <div className="g-page"><SectionTitle eyebrow="SUBJECT WORKBENCH" title="我的监管工作台" description={`${home.subject.subjectName} · ${home.subject.creditCode} · ${home.subject.subjectType}`} actions={<Button type="primary" onClick={() => go('self-check')}>AI 合规体检</Button>} />
    <section className="g-subject-banner"><span><BankOutlined /></span><div><Status value={home.subject.supervisionStatus} /><h2>{home.subject.subjectName}</h2><p>{home.subject.address} · {home.subject.industry} · {home.subject.scale}</p></div><div><small>信用等级</small><b>{home.subject.creditLevel}</b><em>{home.subject.creditScore} 分</em></div><div><small>年报状态</small><b>{home.subject.annualReportStatus === 'completed' ? '已完成' : '待补报'}</b><em>更新时间 {home.subject.updatedAt}</em></div></section>
    <div className="g-two-grid"><section className="g-card"><div className="g-card-head"><div><small>TO-DO</small><b>事项进度</b></div></div>{home.todos.map((todo) => <div className="g-progress-item" key={todo.title}><div><b>{todo.title}</b><span>{todo.content}</span></div><strong>{todo.progress}</strong><Progress percent={Number(todo.progress.replace('%',''))} showInfo={false} strokeColor="#159a5e" /></div>)}</section>
      <section className="g-card"><div className="g-card-head"><div><small>LICENSES</small><b>电子证照</b></div><Button size="small" onClick={() => go('subject')}>管理</Button></div>{licenses.slice(0,4).map((license) => <div className="g-license-row" key={license.id}><span><FileProtectOutlined /></span><div><b>{license.licenseName}</b><small>{license.licenseNo}</small></div><Status value={license.status} /></div>)}</section></div>
    <section className="g-quick-grid"><button onClick={() => go('reports')}><FileSearchOutlined /><b>数据报送</b><span>检测、台账与追溯</span></button><button onClick={() => go('credit')}><CreditCardOutlined /><b>信用档案</b><span>评分、记录与修复</span></button><button onClick={() => go('enforcement')}><FileProtectOutlined /><b>执法协同</b><span>检查、整改与申辩</span></button><button onClick={() => go('policies')}><BankOutlined /><b>政策项目</b><span>匹配与补贴申报</span></button></section>
  </div>
}

function SubjectPage() {
  const { message } = AntApp.useApp()
  const [subject, setSubject] = useState<Subject | null>(null)
  const [licenses, setLicenses] = useState<License[]>([])
  const [preview, setPreview] = useState<License | null>(null)
  useEffect(() => { Promise.all([govApi.me(), govApi.licenses()]).then(([a,b]) => { setSubject(a); setLicenses(b) }).catch((e: Error) => message.error(e.message)) }, [message])
  if (!subject) return <Loading />
  return <div className="g-page"><SectionTitle title="主体信息与资质" description="亮照经营、电子证照与信息变更统一归集到监管档案。" />
    <div className="g-two-grid"><section className="g-card g-detail-card"><div className="g-card-head"><div><small>SUBJECT PROFILE</small><b>主体基础信息</b></div><Status value={subject.supervisionStatus} /></div><div className="g-info-grid"><span><small>主体名称</small><b>{subject.subjectName}</b></span><span><small>统一社会信用代码</small><b>{subject.creditCode}</b></span><span><small>主体类型</small><b>{subject.subjectType}</b></span><span><small>法定代表人</small><b>{subject.legalPerson}</b></span><span><small>联系电话</small><b>{subject.contactPhone}</b></span><span><small>所属行业</small><b>{subject.industry}</b></span><span><small>经营规模</small><b>{subject.scale}</b></span><span><small>登记地址</small><b>{subject.address}</b></span></div></section>
      <section className="g-card"><div className="g-card-head"><div><small>CREDIT</small><b>主体画像</b></div></div><div className="g-score-ring"><b>{subject.creditScore}</b><span>信用分</span></div><div className="g-score-meta"><span><small>信用等级</small><b>{subject.creditLevel}</b></span><span><small>风险等级</small><b>{subject.riskLevel}</b></span><span><small>年报状态</small><b>{subject.annualReportStatus}</b></span></div></section></div>
    <section className="g-card"><div className="g-card-head"><div><small>E-LICENSES</small><b>电子证照</b></div><span className="muted-copy">证照由监管端核发，信息变更请携材料联系平台运营</span></div><div className="g-license-grid">{licenses.map((license) => <article key={license.id}><span><FileProtectOutlined /></span><div><Status value={license.status} /><h3>{license.licenseName}</h3><p>{license.licenseNo}</p><small>{license.authority} · 有效期至 {license.expireDate}</small></div><Button size="small" onClick={() => setPreview(license)}>查看</Button></article>)}</div></section><Modal title={preview?.licenseName} open={Boolean(preview)} footer={null} onCancel={()=>setPreview(null)}>{preview&&<div className="g-info-grid"><span><small>证照编号</small><b>{preview.licenseNo}</b></span><span><small>发证机关</small><b>{preview.authority}</b></span><span><small>发证日期</small><b>{preview.issueDate}</b></span><span><small>有效期至</small><b>{preview.expireDate}</b></span><span><small>状态</small><b>{SUBJECT_STATUS[preview.status]?.label ?? preview.status}</b></span><span><small>附件</small><b>{preview.attachmentName||'暂无上传附件'}</b></span></div>}</Modal>
  </div>
}

function ReportsPage() {
  const { message } = AntApp.useApp()
  const [items, setItems] = useState<Report[]>([])
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const load = () => { govApi.reports().then(setItems).catch((e: Error) => message.error(e.message)) }
  useEffect(() => { void load() }, [])
  const submit = async () => { try { const values = await form.validateFields(); await govApi.createReport(values); setOpen(false); form.resetFields(); message.success('报送成功并完成 AI 质量校验'); load() } catch (e) { if (e instanceof Error) message.error(e.message) } }
  return <div className="g-page"><SectionTitle title="数据报送" description="检测、进销货台账与追溯数据经 AI 校验后归集入监管档案。" actions={<Button type="primary" onClick={() => setOpen(true)}>+ 新增报送</Button>} /><section className="g-card g-table-wrap"><table><thead><tr><th>报送编号</th><th>类型 / 标题</th><th>周期</th><th>AI 校验</th><th>状态</th><th>提交时间</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><b>{item.reportNo}</b></td><td>{item.reportType}<small>{item.title}</small></td><td>{item.period}</td><td><b className={item.aiScore >= 90 ? 'green' : 'amber'}>{item.aiScore} 分</b></td><td><Status value={item.status} /></td><td>{item.submittedAt}</td></tr>)}</tbody></table></section><Modal title="新增数据报送" open={open} onCancel={() => setOpen(false)} onOk={() => void submit()} okText="提交报送"><Form form={form} layout="vertical"><Form.Item label="报送类型" name="reportType" rules={[{required:true}]}><Select options={['农产品检测数据','进销货台账','溯源数据','生产记录'].map(v=>({value:v,label:v}))}/></Form.Item><Form.Item label="报送标题" name="title" rules={[{required:true}]}><Input/></Form.Item><Form.Item label="所属周期" name="period"><Input placeholder="2026-10"/></Form.Item><Form.Item label="说明" name="description"><Input.TextArea rows={4}/></Form.Item></Form></Modal></div>
}

function SelfCheckPage() {
  const { message } = AntApp.useApp()
  const [data, setData] = useState<Awaited<ReturnType<typeof govApi.selfCheck>> | null>(null)
  const [loading, setLoading] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const load = () => govApi.selfCheck().then(setData).catch((e: Error) => message.error(e.message))
  useEffect(() => { void load() }, [])
  const run = async () => { setLoading(true); try { await govApi.runSelfCheck(); message.success('AI 合规自查完成'); load() } catch(e) { message.error(e instanceof Error ? e.message : '自查失败') } finally { setLoading(false) } }
  if (!data) return <Loading />
  return <div className="g-page"><SectionTitle eyebrow="AI COMPLIANCE" title="AI 合规自查" description="基于主体资质、生产记录、质量控制、追溯和信用数据生成合规体检结果。" actions={<Button type="primary" loading={loading} onClick={() => void run()}>重新体检</Button>} /><section className="g-self-hero"><div><small>本次自查评分</small><b>{data.score}<em>分</em></b><p>{data.resultText}</p></div><div><span>{data.riskCount}</span><small>低风险提醒</small><Button onClick={()=>setReportOpen(true)}>查看体检摘要</Button></div></section><Modal title="合规体检摘要" open={reportOpen} footer={null} onCancel={()=>setReportOpen(false)}><div className="g-info-grid"><span><small>总分</small><b>{data.score}</b></span><span><small>结论</small><b>{data.resultText}</b></span>{data.dimensions.map((item)=><span key={item.name}><small>{item.name}</small><b>{item.score} · {item.detail}</b></span>)}</div></Modal><section className="g-card"><div className="g-card-head"><div><small>DIMENSIONS</small><b>合规维度</b></div></div><div className="g-dimension-grid">{data.dimensions.map((item) => <div key={item.name}><div><b>{item.name}</b><strong>{item.score}</strong></div><Progress percent={item.score} showInfo={false} strokeColor={item.score<80?'#d18817':'#159a5e'} /><small>{item.detail}</small></div>)}</div></section><section className="g-card"><div className="g-card-head"><div><small>RISK ITEMS</small><b>整改建议</b></div></div>{data.items.map((item, index) => <div className="g-risk-item" key={item}><span>{index+1}</span><div><b>{item}</b><p>建议在 7 日内补充材料并完成记录关联，平台将自动复核。</p></div><Button size="small" onClick={() => go('enforcement')}>查看整改通知</Button></div>)}</section></div>
}

function CreditPage() {
  const { message } = AntApp.useApp()
  const [data, setData] = useState<CreditProfile | null>(null)
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const load = () => govApi.credit().then(setData).catch((e: Error) => message.error(e.message))
  useEffect(() => { void load() }, [])
  const submit = async () => { try { await govApi.createRepair(await form.validateFields()); setOpen(false); form.resetFields(); message.success('修复申请已提交'); load() } catch(e) { if(e instanceof Error) message.error(e.message) } }
  if (!data) return <Loading />
  return <div className="g-page"><SectionTitle title="信用档案与修复" description="五维动态信用评价、守信激励、失信记录和在线修复。" actions={<Button type="primary" onClick={() => setOpen(true)}>申请信用修复</Button>} /><section className="g-credit-hero"><div className="g-score-ring large"><b>{data.score}</b><span>信用分</span></div><div><Status value="approved" /><h2>{data.level} 级守信主体</h2><p>风险等级：{data.riskLevel} · 档案更新：{data.updatedAt}</p></div><div className="g-credit-dimensions">{data.dimensions.map((item) => <span key={item.name}><small>{item.name}</small><b>{item.score}</b></span>)}</div></section><div className="g-two-grid"><section className="g-card"><div className="g-card-head"><div><small>CREDIT EVENTS</small><b>信用记录</b></div></div>{data.events.map((event) => <div className="g-event" key={event.id}><span className={event.scoreChange>=0?'plus':'minus'}>{event.scoreChange>0?'+':''}{event.scoreChange}</span><div><b>{event.title}</b><p>{event.detail}</p><small>{event.source} · {event.eventDate}</small></div></div>)}</section><section className="g-card"><div className="g-card-head"><div><small>REPAIRS</small><b>修复申请</b></div></div>{data.repairs.map((repair) => <div className="g-repair" key={repair.id}><div><b>{repair.repairType}</b><Status value={repair.status}/></div><p>{repair.reason}</p><Progress percent={repair.progress} showInfo={false} strokeColor="#159a5e"/><small>{repair.repairNo} · {repair.submittedAt}</small></div>)}{data.repairs.length===0&&<p className="muted-copy">暂无修复申请</p>}</section></div><Modal title="申请信用修复" open={open} onCancel={()=>setOpen(false)} onOk={()=>void submit()} okText="提交申请"><Form form={form} layout="vertical"><Form.Item label="修复类型" name="repairType"><Select options={['整改完成修复','异议申诉修复','到期自动修复'].map(v=>({value:v,label:v}))}/></Form.Item><Form.Item label="修复理由" name="reason" rules={[{required:true}]}><Input.TextArea rows={5}/></Form.Item></Form></Modal></div>
}

function EnforcementPage() {
  const { message } = AntApp.useApp()
  const [inspections, setInspections] = useState<Inspection[]>([])
  const [rectifications, setRectifications] = useState<Rectification[]>([])
  const [penalties, setPenalties] = useState<Penalty[]>([])
  const [action, setAction] = useState<{ type: 'feedback'|'statement'; id: number; title: string } | null>(null)
  const [text, setText] = useState('')
  const load = () => Promise.all([govApi.inspections(), govApi.rectifications(), govApi.penalties()]).then(([a,b,c])=>{setInspections(a);setRectifications(b);setPenalties(c)}).catch((e:Error)=>message.error(e.message))
  useEffect(() => { void load() }, [])
  const submit = async () => { if(!action) return; try { if(action.type==='feedback') await govApi.feedbackRectification(action.id,{feedback:text}); else await govApi.submitStatement(action.id,{statement:text}); setAction(null); setText(''); message.success('材料已提交'); load() } catch(e) { message.error(e instanceof Error?e.message:'提交失败') } }
  return <div className="g-page"><SectionTitle title="检查整改与处罚" description="双随机检查、责令整改、处罚电子送达和在线陈述申辩。" /><div className="g-two-grid"><section className="g-card"><div className="g-card-head"><div><small>INSPECTIONS</small><b>检查记录</b></div></div>{inspections.map(item=><div className="g-enforcement-row" key={item.id}><span><AuditOutlined/></span><div><b>{item.inspectionType} · {item.inspectionNo}</b><p>{item.resultText}</p><small>{item.inspectors} · {item.inspectionDate}</small></div><Status value={item.status}/></div>)}</section><section className="g-card"><div className="g-card-head"><div><small>RECTIFICATION</small><b>整改通知</b></div></div>{rectifications.map(item=><div className="g-rectify" key={item.id}><div><b>{item.issueText}</b><Status value={item.status}/></div><p>{item.requirement}</p><small>截止：{item.deadline}</small><Progress percent={item.progress} showInfo={false} strokeColor="#d18817"/>{item.status!=='closed'&&<Button size="small" onClick={()=>{setAction({type:'feedback',id:item.id,title:'整改反馈'});setText(item.feedbackText||'')}}>提交反馈</Button>}</div>)}</section></div><section className="g-card"><div className="g-card-head"><div><small>PENALTIES</small><b>处罚记录</b></div></div>{penalties.map(item=><div className="g-penalty" key={item.id}><div><span><WarningOutlined/></span><div><b>{item.violationText}</b><small>{item.penaltyNo} · {item.documentDate} · {item.legalBasis}</small></div><b>¥{item.amount.toLocaleString()}</b></div><p>{item.penaltyText}</p><footer><Status value={item.status}/><Button size="small" onClick={()=>{setAction({type:'statement',id:item.id,title:'陈述申辩'});setText(item.statementText||'')}}>在线陈述申辩</Button></footer></div>)}</section><Modal title={action?.title} open={Boolean(action)} onCancel={()=>setAction(null)} onOk={()=>void submit()} okText="提交"><Input.TextArea rows={6} value={text} onChange={(e)=>setText(e.target.value)} placeholder="填写整改情况、证明材料说明或陈述申辩意见"/></Modal></div>
}

function PoliciesPage() {
  const { message } = AntApp.useApp()
  const [policies, setPolicies] = useState<Policy[]>([])
  const [subsidies, setSubsidies] = useState<Subsidy[]>([])
  const [selected, setSelected] = useState<Policy|null>(null)
  const [form] = Form.useForm()
  const load = () => Promise.all([govApi.policies(),govApi.subsidies()]).then(([a,b])=>{setPolicies(a);setSubsidies(b)}).catch((e:Error)=>message.error(e.message))
  useEffect(() => { void load() }, [])
  const submit=async()=>{if(!selected)return;try{await govApi.createSubsidy({policyId:selected.id,...await form.validateFields()});setSelected(null);form.resetFields();message.success('项目申报已提交');load()}catch(e){if(e instanceof Error)message.error(e.message)}}
  return <div className="g-page"><SectionTitle title="政策与补贴" description="政策公开、智能匹配、项目申报及遥感核查进度。" /><div className="g-two-grid"><section className="g-card"><div className="g-card-head"><div><small>POLICY LIBRARY</small><b>政策库</b></div></div>{policies.map(policy=><article className="g-policy-card" key={policy.id}><div><Tag>{policy.level}</Tag><Tag>{policy.category}</Tag></div><h3>{policy.title}</h3><p>{policy.summary}</p><footer><small>{policy.authority} · {policy.publishDate}</small><Button size="small" onClick={()=>{setSelected(policy);form.setFieldsValue({projectName:'',amount:50000})}}>申报项目</Button></footer></article>)}</section><section className="g-card"><div className="g-card-head"><div><small>MY APPLICATIONS</small><b>我的项目申报</b></div></div>{subsidies.map(item=><div className="g-subsidy" key={item.id}><div><b>{item.projectName}</b><Status value={item.status}/></div><p>{item.applicationNo} · {item.remoteCheckStatus}</p><strong>¥{item.amount.toLocaleString()}</strong><Progress percent={item.progress} showInfo={false} strokeColor="#159a5e"/><small>{item.submittedAt}</small></div>)}</section></div><Modal title={`申报 · ${selected?.title??''}`} open={Boolean(selected)} onCancel={()=>setSelected(null)} onOk={()=>void submit()} okText="提交申报"><Form form={form} layout="vertical"><Form.Item label="项目名称" name="projectName" rules={[{required:true}]}><Input/></Form.Item><Form.Item label="申请金额" name="amount"><InputNumber min={0} addonAfter="元" style={{width:'100%'}}/></Form.Item><div className="g-info-note">提交后将进入材料完整性、遥感面积和主体资格核查。</div></Form></Modal></div>
}

/**
 * 溯源时间线的一条副信息：地点 / 时间 / 链上凭证。
 *
 * 生产域的链路节点**没有"地点"这一列**（只有批次、质检单、库存流水与投入品记录），
 * 所以这里必须跳过空值 —— 以前直接插值，页面上会出现 "undefined · 2026-06-01 · 0x1a2b3c01"。
 */
const traceEventMeta = (event: { location?: string; eventTime?: string; chainHash?: string }): string =>
  [event.location, event.eventTime, event.chainHash].filter(Boolean).join(' · ')

function PublicPage() {
  const { message } = AntApp.useApp()
  const [tab,setTab]=useState('credit')
  const [keyword,setKeyword]=useState(transfer.keyword)
  const [credit,setCredit]=useState<Subject[]>([])
  // 默认值曾是 370783202610200001 —— 那是本域种子表里的码，改成读生产域真实存证之后
  // 它必然查不到，页面就会一进来报"未查询到该溯源码"。空着，让用户输自己手上的码。
  const [traceCode,setTraceCode]=useState('')
  const [trace,setTrace]=useState<Awaited<ReturnType<typeof govApi.trace>>|null>(null)
  const [samplings,setSamplings]=useState<Array<{id:number;samplingNo:string;productName:string;subjectName:string;region:string;sampleDate:string;testItems:string;result:string;disposition:string}>>([])
  const [lists,setLists]=useState<{red:Subject[];black:Subject[]}|null>(null)
  const [publicity,setPublicity]=useState<{licenses:License[];penalties:Penalty[]}|null>(null)
  useEffect(()=>{govApi.samplings().then(setSamplings);govApi.publicLists().then(setLists);govApi.publicity().then(setPublicity)},[])
  const searchCredit=async()=>{try{setCredit((await govApi.publicCredit(keyword)).items)}catch(e){message.error(e instanceof Error?e.message:'查询失败')}}
  const searchTrace=async()=>{
    if(!traceCode.trim()){message.warning('请输入溯源码');return}
    try{setTrace(await govApi.trace(traceCode.trim()))}catch(e){setTrace(null);message.error(e instanceof Error?e.message:'查询失败')}}
  // 顶栏带过来的检索词：进页面就查一次，不要让公众以为搜过了
  useEffect(()=>{if(transfer.keyword){const word=transfer.keyword;transfer.keyword='';setKeyword(word);void govApi.publicCredit(word).then(r=>setCredit(r.items)).catch((e:Error)=>message.error(e.message))}},[message])
  return <div className="g-page"><SectionTitle title="公众查询与公示" description="免登录查询主体信用、农产品溯源、抽检结果、红黑榜和双公示信息。" /><section className="g-card g-public-tabs"><Tabs activeKey={tab} onChange={setTab} items={[{key:'credit',label:'企业信用查询'},{key:'trace',label:'农产品溯源'},{key:'sampling',label:'抽检公示'},{key:'lists',label:'信用红黑榜'},{key:'publicity',label:'双公示'}]} />{tab==='credit'&&<div><div className="g-search-line"><Input prefix={<SearchOutlined/>} value={keyword} onChange={e=>setKeyword(e.target.value)} placeholder="企业名称或统一社会信用代码"/><Button type="primary" onClick={()=>void searchCredit()}>查询</Button></div><div className="g-public-list">{credit.map(item=><article key={item.id}><div><b>{item.subjectName}</b><p>{item.creditCode} · {item.region} · {item.industry}</p></div><Status value={item.supervisionStatus}/><strong>{item.creditScore}</strong><small>{item.creditLevel} 级</small></article>)}</div></div>}{tab==='trace'&&<div><div className="g-search-line"><Input value={traceCode} onChange={e=>setTraceCode(e.target.value)} placeholder="输入溯源码（生产域登记的码）" onPressEnter={()=>void searchTrace()}/><Button type="primary" onClick={()=>void searchTrace()}>核验</Button></div>{trace&&<div className="g-trace-result"><div className="g-trace-head">{trace.verified?<CheckCircleFilled/>:<WarningOutlined/>}<div><b>{trace.productName||'未知产品'} · {trace.batchNo||'无批次号'}</b><p>{(trace.subjectName||'生产主体未登记')+' · 码状态 '+(trace.statusText||trace.status||'未知')+' · '+trace.chainSummary}</p></div><Tag color={trace.verified?'green':trace.verifiable?'orange':'red'}>{trace.verified?'核验通过':trace.verifiable?'存证不完整':'码状态 '+ (trace.statusText||trace.status||'未知')}</Tag></div><div className="g-trace-timeline">{trace.events.map((event,i)=><div key={`${event.stageName}-${i}`}><i>{i+1}</i><div><b>{event.stageName} · {event.eventTitle}</b><p>{event.evidence}</p><small>{traceEventMeta(event)}</small></div><Tag color={event.onChain?'green':event.attested?'orange':'default'}>{event.onChain?'已上链':event.attested?'存证'+(event.chainStatus||'中'):'未上链'}</Tag></div>)}</div></div>}</div>}{tab==='sampling'&&<div className="g-table-wrap"><table><thead><tr><th>抽样编号</th><th>产品 / 主体</th><th>抽检项目</th><th>结果</th><th>处置</th></tr></thead><tbody>{samplings.map(item=><tr key={item.id}><td>{item.samplingNo}</td><td><b>{item.productName}</b><small>{item.subjectName} · {item.region}</small></td><td>{item.testItems}</td><td><Tag color={item.result==='合格'?'green':'red'}>{item.result}</Tag></td><td>{item.disposition}</td></tr>)}</tbody></table></div>}{tab==='lists'&&lists&&<div className="g-two-grid"><div className="g-list-box red"><h3>红名单 · 守信激励</h3>{lists.red.map(item=><div key={item.id}><b>{item.subjectName}</b><span>{item.creditScore} 分 · {item.creditLevel} 级</span></div>)}</div><div className="g-list-box black"><h3>黑名单 · 失信惩戒</h3>{lists.black.map(item=><div key={item.id}><b>{item.subjectName}</b><span>{item.creditScore} 分 · {item.riskLevel}</span></div>)}</div></div>}{tab==='publicity'&&publicity&&<div className="g-two-grid"><section className="g-card"><div className="g-card-head"><div><small>ADMIN LICENSES</small><b>行政许可公示</b></div></div>{publicity.licenses.slice(0,6).map(item=><div className="g-notice-row" key={item.id}><span className="ok">许可</span><div><b>{item.licenseName}</b><small>{item.licenseNo} · {item.authority}</small><small>{item.subjectName} · 有效期至 {item.expireDate}</small></div></div>)}</section><section className="g-card"><div className="g-card-head"><div><small>PENALTIES</small><b>行政处罚公示</b></div></div>{publicity.penalties.map(item=><div className="g-notice-row" key={item.id}><span className="bad">处罚</span><div><b>{item.subjectName}</b><small>{item.penaltyNo} · {item.violationText}</small></div></div>)}</section></div>}</section></div>
}

function InteractionPage() {
  const {message}=AntApp.useApp()
  const [items,setItems]=useState<Complaint[]>([])
  const [open,setOpen]=useState(false)
  const [form]=Form.useForm()
  const load=()=>govApi.complaints().then(setItems).catch((e:Error)=>message.error(e.message))
  useEffect(()=>{void load()},[])
  const submit=async()=>{try{await govApi.createComplaint(await form.validateFields());setOpen(false);form.resetFields();message.success('举报已提交，受理进度可在线查询');load()}catch(e){if(e instanceof Error)message.error(e.message)}}
  return <div className="g-page"><SectionTitle title="投诉举报与建议" description="食品安全、价格违法和违规经营线索受理，严格保护举报人信息。" actions={<Button type="primary" onClick={()=>setOpen(true)}>我要举报</Button>}/><div className="g-four-actions"><button onClick={()=>setOpen(true)}><WarningOutlined/><b>投诉举报</b><span>在线提交线索</span></button><button onClick={()=>{setOpen(true);form.setFieldsValue({complaintType:'其他'})}}><MessageOutlined/><b>咨询建议</b><span>以「其他」类型提交，监管端同池办理</span></button><button onClick={()=>message.info('依申请公开由监管运营端受理，可在「投诉举报」提交诉求或拨打 12345')}><FileSearchOutlined/><b>信息公开</b><span>依申请公开</span></button><button onClick={()=>message.info('政务服务热线：12345')}><TeamOutlined/><b>政务热线</b><span>12345 多渠道受理</span></button></div><section className="g-card"><div className="g-card-head"><div><small>MY REPORTS</small><b>我的举报记录</b></div></div>{items.map(item=><article className="g-complaint" key={item.id}><div><Tag color={item.priority==='high'?'red':'blue'}>{item.complaintType}</Tag><b>{item.title}</b><Status value={item.status}/></div><p>{item.content}</p><footer><span>{item.complaintNo} · {item.createdAt}</span><small>{item.handleNote||'等待监管部门受理'}</small></footer></article>)}</section><Modal title="投诉举报" open={open} onCancel={()=>setOpen(false)} onOk={()=>void submit()} okText="提交举报"><Form form={form} layout="vertical"><Form.Item label="举报类型" name="complaintType"><Select options={['食品质量安全','农资经营','价格违法','补贴发放','其他'].map(v=>({value:v,label:v}))}/></Form.Item><Form.Item label="标题" name="title" rules={[{required:true}]}><Input/></Form.Item><Form.Item label="涉及对象" name="targetName"><Input/></Form.Item><Form.Item label="详细情况" name="content" rules={[{required:true}]}><Input.TextArea rows={5}/></Form.Item><Form.Item label="举报人" name="reporterName"><Input/></Form.Item><Form.Item label="联系电话" name="reporterPhone"><Input/></Form.Item></Form></Modal></div>
}

function MessagesPage(){const {message}=AntApp.useApp();const [items,setItems]=useState<Awaited<ReturnType<typeof govApi.messages>>>([]);const [open,setOpen]=useState<Awaited<ReturnType<typeof govApi.messages>>[number]|null>(null);const load=()=>govApi.messages().then(setItems).catch((e:Error)=>message.error(e.message));useEffect(()=>{void load()},[]);const readAll=async()=>{try{await govApi.readAll();setItems(items.map(i=>({...i,read:true})));message.success('收件箱已全部标为已读')}catch(e){message.error(e instanceof Error?e.message:'操作失败')}};return <div className="g-page"><SectionTitle title="消息通知" description="监管文书、办事提醒、政策推送和系统通知统一收件箱。" actions={<Button onClick={()=>void readAll()} disabled={!items.some(i=>!i.read)}>全部已读</Button>}/><section className="g-card g-message-list">{items.map(item=><button type="button" key={item.id} className={item.read?'read':''} onClick={()=>setOpen(item)}><span><BellOutlined/></span><div><b>{item.title}{!item.read&&<i/>}</b><p>{item.content}</p><small>{item.createdAt}{item.bizNo?` · 关联单号 ${item.bizNo}`:''}</small></div></button>)}{!items.length&&<p className="muted-copy">当前主体暂无监管消息</p>}</section><Modal title={open?.title} open={Boolean(open)} footer={null} onCancel={()=>setOpen(null)}>{open&&<div className="g-message-detail"><p>{open.content}</p><small>{open.createdAt}{open.bizType?` · ${open.bizType}`:''}{open.bizNo?` · ${open.bizNo}`:''}</small><p className="muted-copy">单条已读暂未开放，可用「全部已读」清空收件箱。</p></div>}</Modal></div>}

function LogsPage(){const {message}=AntApp.useApp();const [items,setItems]=useState<Array<{id:number;operator:string;role:string;action:string;target:string;detail:string;ip:string;createdAt:string}>>([]);useEffect(()=>{govApi.logs().then(setItems).catch((e:Error)=>message.error(e.message))},[message]);return <div className="g-page"><SectionTitle title="操作记录" description="主体账号关键操作全程留痕，敏感操作支持区块链存证核验。"/><section className="g-card g-table-wrap"><table><thead><tr><th>时间</th><th>操作人 / 角色</th><th>动作</th><th>对象</th><th>说明</th><th>IP</th></tr></thead><tbody>{items.map(item=><tr key={item.id}><td>{item.createdAt}</td><td><b>{item.operator}</b><small>{item.role}</small></td><td><Tag>{item.action}</Tag></td><td>{item.target}</td><td>{item.detail}</td><td>{item.ip}</td></tr>)}</tbody></table></section></div>}

export default function App(): JSX.Element {
  const { message } = AntApp.useApp()
  const { user } = useUnifiedUser()
  const displayName = user.nickname || user.username
  const [page,setPage]=useState<Page>(parsePage)
  const [collapsed,setCollapsed]=useState(false)
  const [keyword,setKeyword]=useState('')
  const [identity,setIdentity]=useState<IdentityCard|null>(null)
  const [unread,setUnread]=useState(0)
  useEffect(()=>{const onChange=()=>{setPage(parsePage());window.scrollTo({top:0})};window.addEventListener('hashchange',onChange);return()=>window.removeEventListener('hashchange',onChange)},[])
  // 顶栏的"我是谁/几条未读"必须来自后端解析，写死会让所有主体都显示同一家企业
  useEffect(()=>{
    govApi.identity().then(setIdentity).catch((e:Error)=>setIdentity({subjectError:e.message}))
    govApi.messages().then(rows=>setUnread(rows.filter(row=>!row.read).length)).catch(()=>setUnread(0))
  },[page])
  let content: JSX.Element
  switch(page){case 'workbench':content=<WorkbenchPage/>;break;case 'subject':content=<SubjectPage/>;break;case 'reports':content=<ReportsPage/>;break;case 'self-check':content=<SelfCheckPage/>;break;case 'credit':content=<CreditPage/>;break;case 'enforcement':content=<EnforcementPage/>;break;case 'policies':content=<PoliciesPage/>;break;case 'public':content=<PublicPage/>;break;case 'interaction':content=<InteractionPage/>;break;case 'messages':content=<MessagesPage/>;break;case 'logs':content=<LogsPage/>;break;default:content=<HomePage/>}
  return <div className={`g-shell${collapsed?' collapsed':''}`}><aside className="g-sidebar"><button type="button" className="g-brand" onClick={()=>go('home')}><span>丰</span>{!collapsed&&<div><b>丰链云</b><small>政府监管服务</small></div>}</button><nav>{NAV.map(group=><section key={group.group}>{!collapsed&&<h3>{group.group}</h3>}{group.items.map(item=><button type="button" key={item.page} className={page===item.page?'on':''} onClick={()=>go(item.page)} title={item.label}>{item.icon}{!collapsed&&<span>{item.label}</span>}</button>)}</section>)}</nav><div className="g-side-foot">{!collapsed&&<div><b>监管服务在线</b><small>工作日 09:00-18:00</small></div>}<button type="button" onClick={()=>setCollapsed(!collapsed)}>{collapsed?<MenuUnfoldOutlined/>:<><MenuFoldOutlined/>收起导航</>}</button></div></aside><div className="g-main"><header className="g-header"><div><span>政府监管服务</span><b>/</b><strong>{TITLES[page]}</strong></div><form onSubmit={e=>{e.preventDefault();if(!keyword.trim()){message.warning('请输入企业名称、统一社会信用代码或溯源码');return}transfer.keyword=keyword.trim();go('public')}}><SearchOutlined/><input value={keyword} onChange={e=>setKeyword(e.target.value)} placeholder="搜索主体信用代码（溯源码请在公众查询页核验）"/></form><div className="g-header-right"><span title="当前登录主体">{identity ? (identity.subjectName ?? '监管档案未绑定') : '身份解析中'}</span><button type="button" onClick={()=>go('messages')} title={`未读消息 ${unread} 条`}><BellOutlined/>{unread>0&&<i>{unread}</i>}</button><button type="button" className="g-user" onClick={() => void logoutUnified('gov')} title="退出统一登录"><span>{displayName.slice(0,1)}</span><div><b>{displayName}</b><small>统一账号 · 政府监管</small></div></button></div></header><main><div className="g-crumb"><HomeOutlined/><button type="button" onClick={()=>go('home')}>监管服务</button><span>/</span><b>{TITLES[page]}</b></div>{content}</main><footer>© 2026 农业产业互联网平台 · 政府监管服务</footer></div></div>
}
