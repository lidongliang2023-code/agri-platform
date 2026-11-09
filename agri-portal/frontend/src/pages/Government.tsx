import { useState } from 'react'
import { Icon } from '../components/Icon'
import { governmentUrl, usePageMeta } from '../utils'
import './government.css'

type Audience = 'all' | 'public' | 'subject' | 'staff'
type Service = { title: string; description: string; icon: string; audience: Exclude<Audience, 'all'>; page: string; materials: string; steps: string[]; mobile?: boolean }
const audiences: { key: Audience; label: string }[] = [
  { key: 'all', label: '全部服务' }, { key: 'public', label: '我是公众' },
  { key: 'subject', label: '我是经营主体' }, { key: 'staff', label: '我是监管人员' },
]
const services: Service[] = [
  { title: '公众查询与公示', description: '查询主体信息、监督抽检与公开监管信息。', icon: 'search', audience: 'public', page: 'public', materials: '准备主体名称或统一社会信用代码，进入公众查询后检索。', steps: ['进入公众查询', '输入查询条件', '查看公开结果'] },
  { title: '农产品溯源核验', description: '核验溯源码有效性，查看生产链路与存证状态。', icon: 'shield', audience: 'public', page: 'public', materials: '准备产品包装上的溯源码，在公众查询页切换至溯源核验。', steps: ['准备溯源码', '进入溯源核验', '核对链路与存证'] },
  { title: '投诉举报与建议', description: '提交问题线索、投诉举报或服务建议。', icon: 'bell', audience: 'public', page: 'interaction', materials: '准备问题描述、涉及主体与相关线索；登录后按页面要求提交。', steps: ['登录统一账号', '填写问题线索', '查询办理反馈'] },
  { title: '主体信息与资质', description: '查看监管主体档案、电子证照及有效期。', icon: 'users', audience: 'subject', page: 'subject', materials: '账号需关联监管主体。证照信息变更请携材料联系监管运营人员办理。', steps: ['登录并关联主体', '查看主体档案', '核对电子证照'] },
  { title: '数据报送', description: '报送检测数据、进销货台账、溯源与生产记录。', icon: 'chart', audience: 'subject', page: 'reports', materials: '准备报送类型、标题、所属周期和业务说明，并核对原始记录。', steps: ['选择报送类型', '填写报送内容', '提交并查看结果'] },
  { title: 'AI 合规自查', description: '围绕资质、生产、质量和信用开展合规体检。', icon: 'cpu', audience: 'subject', page: 'self-check', materials: '请先完善主体资质及相关生产记录；自查结果用于辅助排查风险。', steps: ['核对主体资料', '发起合规体检', '查看整改建议'] },
  { title: '信用档案与修复', description: '查询信用记录，提交信用修复或异议申请。', icon: 'star', audience: 'subject', page: 'credit', materials: '准备修复类型与理由，结合信用记录说明整改情况或异议依据。', steps: ['查看信用档案', '填写修复申请', '跟踪审核进度'] },
  { title: '检查整改与处罚', description: '查看检查通知、反馈整改情况与提交申辩。', icon: 'alert', audience: 'subject', page: 'enforcement', materials: '根据具体整改通知准备反馈说明；申辩材料以实际文书要求为准。', steps: ['查看检查文书', '提交整改或申辩', '跟进办理状态'] },
  { title: '政策项目与补贴', description: '了解政策项目，办理补贴申报并跟踪进度。', icon: 'money', audience: 'subject', page: 'policies', materials: '先阅读政策项目的适用条件，再按实际项目要求准备申报信息。', steps: ['查阅政策项目', '提交补贴申请', '查看申报进度'] },
  { title: '风险预警处置', description: '查看风险线索，开展分派、核查与处置。', icon: 'activity', audience: 'staff', page: 'warnings', materials: '需具备监管运营权限，处理范围以账号获授权的业务范围为准。', steps: ['进入预警中心', '分派与核查', '记录处置结果'] },
  { title: '执法检查与案件', description: '统筹检查任务、案件办理与过程留痕。', icon: 'shield', audience: 'staff', page: 'tasks', materials: '需开通监管运营权限；现场检查可通过移动执法端开展。', steps: ['安排检查任务', '开展现场检查', '跟进整改与案件'] },
  { title: '移动执法工作台', description: '现场检查、扫码核验、拍照取证与案件办理。', icon: 'phone', audience: 'staff', page: 'pages/workbench/index', mobile: true, materials: '需开通执法账号、完成平台用户绑定并通过政府人员业务身份申请。', steps: ['登录执法账号', '领取现场任务', '检查取证与反馈'] },
]
function serviceUrl(service: Service): string {
  if (service.mobile) return `${window.location.protocol}//${window.location.hostname}:8109/#/${service.page}`
  if (service.audience === 'staff') return `${window.location.protocol}//${window.location.hostname}:8110/#/${service.page}`
  return governmentUrl(`/#/${service.page}`)
}
const faq = [
  ['公众查询需要登录吗？', '公众查询、公示和溯源核验支持免登录访问。主体办事与监管履职需使用丰链云统一账号，并由业务系统校验对应权限。'],
  ['登录后无法查看主体信息怎么办？', '主体办事账号需要与监管主体台账关联。若提示尚未绑定，请联系监管运营人员完成经营主体绑定。'],
  ['证照信息变更在哪里办理？', '当前主体端支持查看电子证照。证照信息变更请携相关材料联系监管运营人员，通过监管台账办理。'],
  ['溯源码有效，是否表示全部信息已上链？', '不一定。码的有效性和各链路节点的存证状态分别核验；未上链、处理中和失败都会按实际结果展示。查询服务异常时，不会给出核验通过结论。'],
]

export function Government(): JSX.Element {
  usePageMeta('政府监管服务', '丰链云农业监管服务门户，提供公众查询、溯源核验、主体办事、政策补贴与监管履职入口。')
  const [audience, setAudience] = useState<Audience>('all')
  const [keyword, setKeyword] = useState('')
  const [selected, setSelected] = useState(services[4])
  const filtered = services.filter(s => (audience === 'all' || s.audience === audience) && `${s.title}${s.description}`.includes(keyword.trim()))
  const showServices = (next: Audience) => {
    setAudience(next)
    setKeyword('')
    document.getElementById('gov-services')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const showGuide = (service: Service) => {
    setSelected(service)
    document.getElementById('gov-guide')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  return <div className="gp-page">
    <div className="container gp-breadcrumb"><a href="#/">首页</a><span> / </span><span>政府监管</span><span className="gp-platform-note">丰链云 · 农业产业监管服务</span></div>
    <section className="gp-hero">
      <div className="container gp-hero-inner">
        <div className="gp-hero-copy"><span className="gp-eyebrow"><i /> 透明监管 · 协同治理 · 便民惠企</span><h1>守护农业品质<br />让监管服务更有温度</h1><p>连接公众、经营主体与监管部门，<br />让信息可查询、办事有指引、监管可协同。</p><div className="gp-actions"><a className="gp-button gp-primary" href={governmentUrl('/#/workbench')}>进入主体工作台 <Icon name="arrow" size={17} /></a><button className="gp-button gp-outline" onClick={() => showServices('public')}>查公开信息</button></div><div className="gp-hero-tags"><span><Icon name="check" size={14} />统一账号</span><span><Icon name="check" size={14} />分类服务</span><span><Icon name="check" size={14} />全程留痕</span></div></div>
        <div className="gp-visual" aria-label="农业监管协同流程示意">
          <div className="gp-orbit gp-orbit-one" /><div className="gp-orbit gp-orbit-two" />
          <div className="gp-core"><Icon name="shield" size={56} /><b>农业监管协同</b><span>质量 · 信用 · 安全</span></div>
          <div className="gp-node gp-node-one"><Icon name="users" size={22} /><span>主体档案<small>一户一档</small></span></div>
          <div className="gp-node gp-node-two"><Icon name="search" size={22} /><span>溯源核验<small>链路可查</small></span></div>
          <div className="gp-node gp-node-three"><Icon name="activity" size={22} /><span>风险预警<small>协同处置</small></span></div>
          <div className="gp-node gp-node-four"><Icon name="shield" size={22} /><span>执法检查<small>过程留痕</small></span></div>
          <span className="gp-visual-caption">从生产记录到监管服务，连接每一份信任</span>
        </div>
      </div>
    </section>
    <div className="container gp-content">
      <section className="gp-audiences" aria-label="按身份查找服务">
        {[{ key: 'public' as const, icon: 'search', title: '公众查询', desc: '查主体 · 查公示 · 验溯源', badge: '公开服务' }, { key: 'subject' as const, icon: 'users', title: '主体办事', desc: '报数据 · 做自查 · 申补贴', badge: '统一登录' }, { key: 'staff' as const, icon: 'shield', title: '监管履职', desc: '查风险 · 管任务 · 办案件', badge: '授权访问' }].map(item => <button key={item.key} onClick={() => showServices(item.key)}><span className={`gp-role-icon ${item.key}`}><Icon name={item.icon} size={25} /></span><span><b>{item.title}</b><small>{item.desc}</small></span><em>{item.badge}</em><Icon name="arrow" size={18} /></button>)}
      </section>
      <div className="gp-notice"><Icon name="bell" size={18} /><b>服务提示</b><span>公众查询免登录；主体办事需关联监管主体，监管履职需开通相应权限。</span><a href={governmentUrl('/#/messages')}>我的消息 <span aria-hidden="true">→</span></a></div>
      <section id="gov-services" className="gp-section">
        <div className="gp-section-head"><div><span className="gp-kicker">一站式监管服务</span><h2>您要办理什么？</h2></div><label className="gp-search"><Icon name="search" size={18} /><input aria-label="搜索监管服务事项" value={keyword} onChange={event => setKeyword(event.target.value)} placeholder="搜索报送、信用、补贴等事项" />{keyword && <button aria-label="清空搜索" onClick={() => setKeyword('')}><Icon name="close" size={15} /></button>}</label></div>
        <div className="gp-filters" aria-label="服务对象筛选">{audiences.map(item => <button key={item.key} aria-pressed={audience === item.key} className={audience === item.key ? 'active' : ''} onClick={() => setAudience(item.key)}>{item.label}</button>)}<span aria-live="polite">共 {filtered.length} 项服务</span></div>
        <div className="gp-service-grid">{filtered.map(service => <article className="gp-service" data-audience={service.audience} key={service.title}><div className="gp-service-top"><span className="gp-service-icon"><Icon name={service.icon} size={23} /></span><small>{service.page === 'interaction' ? '登录后提交' : service.audience === 'public' ? '免登录查询' : service.audience === 'staff' ? '需监管权限' : '登录后办理'}</small></div><h3>{service.title}</h3><p>{service.description}</p><div className="gp-service-actions"><a href={serviceUrl(service)}>{service.page === 'interaction' ? '提交线索' : service.audience === 'public' ? '进入查询' : '进入服务'} <Icon name="arrow" size={14} /></a><button onClick={() => showGuide(service)}>办理指南</button></div></article>)}</div>
        {!filtered.length && <div className="gp-empty"><Icon name="search" size={30} /><h3>没有找到匹配的服务</h3><p>可尝试“信用”“报送”或切换服务对象。</p><button className="gp-button gp-primary" onClick={() => { setKeyword(''); setAudience('all') }}>查看全部服务</button></div>}
      </section>
      <section className="gp-section gp-public-grid">
        <div className="gp-public-panel"><div className="gp-section-head"><div><span className="gp-kicker">公开透明 · 放心选择</span><h2>公众查询与信息公示</h2></div><Icon name="shield" size={29} /></div><p>了解经营主体与农产品质量信息，让每一次选择都有依据。</p><div className="gp-public-links">{[['主体信息查询', '了解主体公开信息'], ['监督抽检公示', '查看抽检结果与处置'], ['农产品溯源核验', '核对有效性与真实存证']].map(([title, desc]) => <a key={title} href={governmentUrl('/#/public')}><span><b>{title}</b><small>{desc}</small></span><Icon name="arrow" size={18} /></a>)}</div><small className="gp-source-note">进入公众查询页后选择查询类型，结果以实际公开信息为准。</small></div>
        <div className="gp-policy-panel"><span className="gp-kicker">惠农政策 · 精准服务</span><h2>从了解政策<br />到办理补贴</h2><p>查看政策项目与申报条件，<br />在主体工作台跟踪申请进度。</p><div className="gp-policy-steps"><span>查政策</span><i>→</i><span>看条件</span><i>→</i><span>办申报</span></div><a className="gp-button gp-primary" href={governmentUrl('/#/policies')}>进入政策与补贴 <Icon name="arrow" size={16} /></a><small>申报条件与办理要求以对应政策项目为准</small></div>
      </section>
      <section id="gov-guide" className="gp-section gp-guide"><div className="gp-guide-intro"><span className="gp-kicker">办前有指引 · 办中可跟踪</span><h2>办事指南</h2><label htmlFor="gp-guide-select">选择服务事项</label><select id="gp-guide-select" value={selected.title} onChange={event => setSelected(services.find(s => s.title === event.target.value) || services[0])}>{services.map(service => <option key={service.title}>{service.title}</option>)}</select><a href={serviceUrl(selected)}>前往{selected.title} <Icon name="arrow" size={15} /></a></div><div className="gp-guide-detail"><h3>{selected.title}</h3><div className="gp-process">{selected.steps.map((step, index) => <div key={step}><span>0{index + 1}</span><b>{step}</b></div>)}</div><div className="gp-materials"><Icon name="alert" size={17} /><p><b>办理前请准备</b>{selected.materials}</p></div></div></section>
      <section className="gp-section gp-collaboration"><div><span className="gp-kicker">监管协同</span><h2>发现风险，也推动问题解决</h2><p>连接预警、检查、取证与处置，支持监管业务协同开展。</p></div><div className="gp-collab-links"><a href={serviceUrl(services[9])}><Icon name="activity" size={22} /><b>监管运营工作台</b><span>预警处置 / 任务管理 / 统计分析</span><Icon name="arrow" size={18} /></a><a href={serviceUrl(services[11])}><Icon name="phone" size={22} /><b>移动执法端</b><span>现场检查 / 扫码核验 / 拍照取证</span><Icon name="arrow" size={18} /></a></div></section>
      <section className="gp-section gp-faq"><div className="gp-section-head"><div><span className="gp-kicker">服务帮助</span><h2>常见问题</h2></div><a href={governmentUrl('/#/interaction')}>投诉举报与建议 →</a></div>{faq.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</section>
    </div>
  </div>
}
