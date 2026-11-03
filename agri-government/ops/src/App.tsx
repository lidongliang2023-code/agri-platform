import { useEffect,useMemo,useState,type ReactNode } from 'react'
import {
  AlertOutlined,AuditOutlined,BarChartOutlined,BellOutlined,CheckCircleFilled,CreditCardOutlined,
  DatabaseOutlined,FileProtectOutlined,FundOutlined,HomeOutlined,MenuFoldOutlined,MenuUnfoldOutlined,
  SafetyCertificateOutlined,SearchOutlined,ShareAltOutlined,TeamOutlined,WarningOutlined,
} from '@ant-design/icons'
import { App as AntApp,Avatar,Button,Dropdown,Form,Input,Modal,Progress,Select,Switch,Table,Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  opsApi,STATUS,type Case,type CheckItem,type Complaint,type DataShare,type IdentityCard,
  type Overview,type Rectification,type Repair,type Sampling,type Subject,type Subsidy,type Task,type Warning,
} from './api'
import { logoutUnified,useUnifiedUser } from '../../frontend/src/sso'

interface StaffRow{id:number;name:string;role:string;organization:string;grid:string;status:string;certificateNo?:string;platformUserId?:string}
type Page='dashboard'|'subjects'|'warnings'|'tasks'|'items'|'cases'|'repairs'|'subsidies'|'complaints'|'samplings'|'sharing'|'statistics'|'users'|'logs'
const PAGES:Page[]=['dashboard','subjects','warnings','tasks','items','cases','repairs','subsidies','complaints','samplings','sharing','statistics','users','logs']
const TITLES:Record<Page,string>={dashboard:'监管工作台',subjects:'市场主体监管',warnings:'AI 预警处置',tasks:'执法检查任务',items:'执法事项清单',cases:'案件管理',repairs:'信用修复复核',subsidies:'补贴项目监管',complaints:'举报处理',samplings:'监督抽检',sharing:'跨部门数据共享',statistics:'统计报表中心',users:'组织与权限',logs:'操作审计日志'}
const NAV:Array<{group:string;items:Array<{page:Page;label:string;icon:ReactNode}>}>= [
  {group:'监管指挥',items:[{page:'dashboard',label:'监管工作台',icon:<HomeOutlined/>},{page:'statistics',label:'统计报表中心',icon:<BarChartOutlined/>}]},
  {group:'运行监测',items:[{page:'warnings',label:'AI 预警处置',icon:<AlertOutlined/>},{page:'tasks',label:'执法检查任务',icon:<AuditOutlined/>},{page:'items',label:'执法事项清单',icon:<CheckCircleFilled/>},{page:'cases',label:'案件管理',icon:<FileProtectOutlined/>}]},
  {group:'信用与主体',items:[{page:'subjects',label:'市场主体监管',icon:<TeamOutlined/>},{page:'repairs',label:'信用修复复核',icon:<CreditCardOutlined/>}]},
  {group:'质量与政策',items:[{page:'samplings',label:'监督抽检',icon:<SafetyCertificateOutlined/>},{page:'subsidies',label:'补贴项目监管',icon:<FundOutlined/>},{page:'complaints',label:'举报处理',icon:<WarningOutlined/>}]},
  {group:'数据与系统',items:[{page:'sharing',label:'跨部门数据共享',icon:<ShareAltOutlined/>},{page:'users',label:'组织与权限',icon:<TeamOutlined/>},{page:'logs',label:'操作审计日志',icon:<DatabaseOutlined/>}]},
]
/** 顶栏检索要把词带到主体台账，否则回车只是换了个页面。 */
const transfer={keyword:''}
function parse():Page{const p=location.hash.replace(/^#\/?/,'').split('?')[0] as Page;return PAGES.includes(p)?p:'dashboard'}
function go(page:Page){location.hash=`/${page}`}
function Status({value}:{value:string}){const s=STATUS[value]??{label:value,tone:'gray'};return <Tag className={`o-status tone-${s.tone}`}>{s.label}</Tag>}
function Title({title,desc,actions}:{title:string;desc:string;actions?:ReactNode}){return <div className="o-title"><div><span>GOVERNMENT REGULATION · OPERATIONS</span><h1>{title}</h1><p>{desc}</p></div>{actions&&<div className="o-actions">{actions}</div>}</div>}
function Loading(){return <div className="o-loading"><i/><i/><i/></div>}
function Head({title,sub}:{title:string;sub:string}){return <div className="o-card-head"><div><b>{title}</b><small>{sub}</small></div></div>}
const todayText=()=>new Date().toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'})
/** 导出必须是真文件：把当前结果写成 CSV 下载，而不是弹一句"已生成"。 */
function downloadCsv(filename:string,rows:Array<Record<string,unknown>>){
  if(!rows.length)throw new Error('当前没有可导出的数据')
  const headers=Object.keys(rows[0])
  const escape=(v:unknown)=>`"${String(v??'').replace(/"/g,'""')}"`
  const csv=''+[headers.map(escape).join(','),...rows.map(r=>headers.map(h=>escape(r[h])).join(','))].join('\r\n')
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}))
  const a=document.createElement('a');a.href=url;a.download=filename;a.click()
  URL.revokeObjectURL(url)
}

function Dashboard({data}:{data:Overview|null}){
  const {message}=AntApp.useApp()
  if(!data)return <Loading/>
  const max=Math.max(...data.trend.map(t=>t.warnings),1)
  const exportWeekly=()=>{try{downloadCsv('监管周报.csv',data.trend.map(t=>({日期:t.date,监管主体:t.subjects,预警:t.warnings,检查量:t.inspections,抽检合格率:t.samplingRate,案件:t.cases})));message.success('监管周报已下载')}catch(e){message.error(e instanceof Error?e.message:'导出失败')}}
  return <div className="o-page"><Title title="监管工作台" desc="辖区主体、风险预警、执法案件和质量安全的实时运营视角。" actions={<><Button onClick={exportWeekly}>导出周报</Button><Button type="primary" onClick={()=>go('warnings')}>进入预警处置</Button></>}/>
    <div className="o-metrics">
      <Metric icon={<TeamOutlined/>} label="辖区监管主体" value={data.metrics.subjects.toLocaleString()} hint="按监管档案统计" tone="green"/>
      <Metric icon={<AlertOutlined/>} label="待处置预警" value={String(data.metrics.pendingWarnings)} hint="红警与在办核查" tone="red"/>
      <Metric icon={<SafetyCertificateOutlined/>} label="抽检合格率" value={`${data.metrics.samplingPassRate}%`} hint="已出结果的监督抽检" tone="blue"/>
      <Metric icon={<FileProtectOutlined/>} label="在办案件" value={String(data.metrics.openCases)} hint="立案调查与处罚" tone="amber"/>
      <Metric icon={<CheckCircleFilled/>} label="AI今日辅助" value={String(data.metrics.aiAssistCount)} hint="预警核查与整改复核留痕" tone="purple"/>
    </div>
    <div className="o-dashboard-grid">
      <section className="o-card o-trend"><Head title="辖区运行趋势" sub="主体、预警与检查量"/><div className="o-bars">{data.trend.map(t=><div key={t.date}><div><span style={{height:`${Math.max(16,t.warnings/max*100)}%`}}/><i style={{height:`${Math.max(20,Math.min(100,t.inspections/40*100))}%`}}/></div><small>{t.date.slice(5)}</small><em>{t.warnings} 预警</em></div>)}</div></section>
      <section className="o-card"><Head title="今日待办" sub="按紧急度排序"/>{data.todos.map(t=><button type="button" className="o-todo" key={t.route} onClick={()=>go(t.route as Page)}><span>{t.count}</span><div><b>{t.title}</b><small>{t.description}</small></div><em>处理 ›</em></button>)}{!data.todos.length&&<p className="muted">当前没有待办事项</p>}</section>
    </div>
    <div className="o-dashboard-grid">
      <section className="o-card"><Head title="最新风险预警" sub="AI 与规则引擎共同识别"/>{data.warnings.slice(0,3).map(w=><button type="button" className="o-warning-row" key={w.id} onClick={()=>go('warnings')}><span className={w.level==='red'?'high':''}><WarningOutlined/></span><div><b>{w.title}</b><p>{w.content}</p><small>{w.warningNo} · AI 置信度 {w.aiConfidence}%</small></div><Tag color={w.level==='red'?'red':'orange'}>{w.level==='red'?'高风险':'关注'}</Tag></button>)}</section>
      <section className="o-ai-brief"><span><SafetyCertificateOutlined/></span><small>AI 监管早报</small><h2>从阈值告警<br/>升级为智能研判</h2>{data.aiBrief.map(item=><p key={item}>• {item}</p>)}</section>
    </div>
  </div>
}
function Metric({icon,label,value,hint,tone}:{icon:ReactNode;label:string;value:string;hint:string;tone:string}){return <div className={`o-metric tone-${tone}`}><span>{icon}</span><div><small>{label}</small><b>{value}</b><em>{hint}</em></div></div>}

function Subjects(){
  const {message}=AntApp.useApp()
  const [items,setItems]=useState<Subject[]>([]),[risk,setRisk]=useState('all'),[keyword,setKeyword]=useState(transfer.keyword),[target,setTarget]=useState<Subject|null>(null),[merchantId,setMerchantId]=useState('')
  const load=(word:string)=>opsApi.subjects(word,risk).then(setItems).catch((e:Error)=>message.error(e.message))
  useEffect(()=>{const word=transfer.keyword;transfer.keyword='';if(word)setKeyword(word);load(word)},[risk])
  const applyBinding=async(subject:Subject,value:string)=>{
    try{
      await opsApi.bindSubjectMerchant(subject.id,value)
      message.success(value?'已绑定平台经营主体：该主体账号现在能在主体端看到自己的证照、整改与通知':'已解除绑定：主体端会明确提示档案未登记该经营主体')
      setTarget(null);opsApi.subjects(keyword,risk).then(setItems).catch((e:Error)=>message.error(e.message))
    }catch(e){message.error(e instanceof Error?e.message:'绑定失败')}
  }
  const exportRows=()=>{try{downloadCsv('市场主体台账.csv',items as unknown as Array<Record<string,unknown>>);message.success('已导出当前筛选结果')}catch(e){message.error(e instanceof Error?e.message:'导出失败')}}
  const columns:ColumnsType<Subject>=[
    {title:'主体',dataIndex:'subjectName',render:(_,r)=><div className="o-entity"><b>{r.subjectName}</b><small>{r.creditCode}</small></div>},
    {title:'类型',dataIndex:'subjectType'},
    {title:'行业 / 区域',render:(_,r)=>`${r.industry} · ${r.region}`},
    {title:'信用分',dataIndex:'creditScore',sorter:(a,b)=>a.creditScore-b.creditScore,render:v=><b className={Number(v)<75?'red':'green'}>{v}</b>},
    {title:'等级',dataIndex:'creditLevel'},
    {title:'风险',dataIndex:'riskLevel',render:v=><Status value={v}/>},
    {title:'年报',dataIndex:'annualReportStatus',render:v=><Status value={v}/>},
    {title:'平台经营主体',dataIndex:'merchantId',render:v=>v?<Tag color="green">已绑定 {String(v)}</Tag>:<Tag>未绑定</Tag>},
    {title:'操作',render:(_,r)=><span><Button type="link" onClick={()=>{setTarget(r);setMerchantId(r.merchantId??'')}}>{r.merchantId?'变更绑定':'绑定经营主体'}</Button>{r.merchantId&&<Button type="link" danger onClick={()=>void applyBinding(r,'')}>解除</Button>}</span>},
  ]
  return <div className="o-page"><Title title="市场主体监管" desc="辖区农业生产经营主体全量档案、风险等级与分级分类监管。" actions={<Button onClick={exportRows}>导出台账</Button>}/>
    <section className="o-card o-filter"><div className="o-tabs">{['all','low','medium','high'].map(k=><button type="button" key={k} className={risk===k?'on':''} onClick={()=>setRisk(k)}>{k==='all'?'全部':k==='high'?'高风险':k==='medium'?'中风险':'低风险'}</button>)}</div><Input prefix={<SearchOutlined/>} value={keyword} onChange={e=>setKeyword(e.target.value)} onPressEnter={()=>load(keyword)} placeholder="主体名称 / 信用代码"/><Button type="primary" onClick={()=>load(keyword)}>查询</Button></section>
    <section className="o-card o-table"><Table rowKey="id" dataSource={items} columns={columns} scroll={{x:1120}}/></section>
    <Modal title={'绑定平台经营主体 · '+(target?.subjectName ?? '')} open={Boolean(target)} onCancel={()=>setTarget(null)} onOk={()=>void applyBinding(target as Subject,merchantId.trim())} okText="确认绑定">
      <p className="muted">监管档案与平台经营主体是两条业务线各自的数据，绑定关系由运营显式建立：绑定后该主体下的账号才能在主体端看到自己的证照、整改、处罚与通知；不按名字猜同一家（同名不等于同一家）。</p>
      <Input value={merchantId} onChange={e=>setMerchantId(e.target.value)} placeholder="平台经营主体号（例如 2001）"/>
    </Modal>
  </div>
}

function Warnings(){
  const {message}=AntApp.useApp()
  const [items,setItems]=useState<Warning[]>([]),[target,setTarget]=useState<Warning|null>(null),[note,setNote]=useState(''),[assignee,setAssignee]=useState<number|undefined>(undefined),[staff,setStaff]=useState<StaffRow[]>([])
  const load=()=>opsApi.warnings().then(setItems).catch((e:Error)=>message.error(e.message))
  useEffect(()=>{
    opsApi.users().then(rows=>setStaff(rows.filter(row=>row.status==='active'))).catch(()=>setStaff([]))
    void load()
  },[])
  const submit=async()=>{
    if(!target)return
    try{await opsApi.handleWarning(target.id,{status:'processing',assigneeId:assignee,note});setTarget(null);message.success('预警已分派，承办人在移动执法端可看到');void load()}
    catch(e){message.error(e instanceof Error?e.message:'操作失败')}
  }
  return <div className="o-page"><Title title="AI 预警处置" desc="价格、质量、追溯、信用与舆情预警统一受理、分派和闭环。"/>
    <div className="o-warning-grid">{items.map(w=><section className={`o-card o-warning-card level-${w.level}`} key={w.id}><div className="o-card-head"><div><b>{w.type}</b><small>{w.warningNo} · {w.createdAt}</small></div><Tag color={w.level==='red'?'red':'orange'}>{w.level==='red'?'高风险':'关注'}</Tag></div><h3>{w.title}</h3><p>{w.content}</p><div className="o-ai-note"><SafetyCertificateOutlined/><span>AI 置信度 {w.aiConfidence}% · {w.location}</span></div><div className="o-summary"><span>承办：{w.assignedTo||'未分派'}</span>{w.handleNote&&<span>{w.handleNote}</span>}</div><footer><Status value={w.status}/>{w.status!=='closed'&&<Button size="small" type="primary" onClick={()=>{setTarget(w);setNote('');setAssignee(undefined)}}>分派处置</Button>}</footer></section>)}</div>
    {!items.length&&<p className="muted">当前没有预警记录</p>}
    <Modal title="分派预警处置" open={Boolean(target)} onCancel={()=>setTarget(null)} onOk={()=>void submit()} okText="确认分派">
      <div className="o-summary"><b>{target?.title}</b><span>{target?.content}</span></div>
      <Form layout="vertical">
        <Form.Item label="承办执法人员" required><Select showSearch value={assignee} onChange={value=>setAssignee(value as number)} optionFilterProp="label" placeholder="从执法人员档案里选择" options={staff.map(v=>({value:v.id,label:`${v.name} · ${v.role} · ${v.grid||'未分配网格'}`}))}/></Form.Item>
        <Form.Item label="处置要求"><Input.TextArea rows={4} value={note} onChange={e=>setNote(e.target.value)} placeholder="写清核查事项、完成时限与反馈要求"/></Form.Item>
      </Form>
    </Modal>
  </div>
}

function Tasks(){
  const {message}=AntApp.useApp()
  const [items,setItems]=useState<Task[]>([]),[open,setOpen]=useState(false),[form]=Form.useForm()
  const [staff,setStaff]=useState<StaffRow[]>([])
  const [subjects,setSubjects]=useState<Subject[]>([])
  const [rects,setRects]=useState<Rectification[]>([])
  const [review,setReview]=useState<{row:Rectification;status:'closed'|'pending'}|null>(null)
  const [reviewNote,setReviewNote]=useState('')
  const load=()=>opsApi.tasks().then(setItems).catch((e:Error)=>message.error(e.message))
  const loadRects=()=>opsApi.rectifications('feedback').then(setRects).catch(()=>setRects([]))
  useEffect(()=>{
    opsApi.users().then(rows=>setStaff(rows.filter(row=>row.status==='active'))).catch(()=>setStaff([]))
    opsApi.subjects().then(setSubjects).catch(()=>setSubjects([]))
    void load();loadRects()
  },[])
  const submitReview=async()=>{
    if(!review)return
    try{
      await opsApi.reviewRectification(review.row.id,{status:review.status,note:reviewNote})
      message.success(review.status==='closed'?'整改已结案，主体端同步收到结论':'已退回主体重新反馈')
      setReview(null);setReviewNote('');loadRects()
    }catch(e){message.error(e instanceof Error?e.message:'复核失败')}
  }
  const create=async()=>{
    try{await opsApi.createTask(await form.validateFields());setOpen(false);form.resetFields();message.success('执法任务已创建并按清单模板展开检查项');void load()}
    catch(e){if(e instanceof Error)message.error(e.message)}
  }
  return <div className="o-page"><Title title="执法检查任务" desc="任务创建、分派、现场检查进度和整改跟踪。" actions={<Button type="primary" onClick={()=>setOpen(true)}>+ 新建任务</Button>}/>
    <div className="o-task-grid">{items.map(t=><section className="o-card o-task-card" key={t.id}><div className="o-card-head"><div><b>{t.taskType}</b><small>{t.taskNo} · {t.deadline}</small></div><Status value={t.status}/></div><h3>{t.subjectName}</h3><p>{t.address} · {t.distanceKm}km</p><div><small>检查进度</small><Progress percent={t.checklistTotal?Math.round(t.checklistDone/t.checklistTotal*100):0} showInfo={false} strokeColor="#159a5e"/></div><footer><span>承办：{t.assignedTo||'未分派'}</span><span>逐项 {t.checklistDone}/{t.checklistTotal}</span></footer>{t.result&&<p className="muted">结论：{t.result}</p>}</section>)}</div>
    {!items.length&&<p className="muted">当前没有执法任务</p>}
    <section className="o-card o-table" style={{marginTop:14}}><Head title="整改复核队列" sub="主体已反馈，待监管结案或退回"/><Table rowKey="id" dataSource={rects} pagination={false} scroll={{x:900}} columns={[
      {title:'整改单',dataIndex:'rectificationNo'},{title:'问题',dataIndex:'issueText'},
      {title:'整改要求',dataIndex:'requirement'},{title:'主体反馈',dataIndex:'feedbackText',ellipsis:true},
      {title:'状态',dataIndex:'status',render:v=><Status value={v}/>},
      {title:'操作',render:(_,r)=><span><Button type="link" onClick={()=>{setReview({row:r,status:'closed'});setReviewNote('材料齐全，同意结案')}}>结案</Button><Button type="link" danger onClick={()=>{setReview({row:r,status:'pending'});setReviewNote('材料不足，请补充后重新反馈')}}>退回</Button></span>},
    ]}/></section>
    <Modal title={review?`整改复核 · ${review.row.rectificationNo}`:''} open={Boolean(review)} onCancel={()=>setReview(null)} onOk={()=>void submitReview()} okText="提交复核">
      <div className="o-summary"><b>{review?.row.issueText}</b><span>主体反馈：{review?.row.feedbackText||'（未填写）'}</span></div>
      <Form layout="vertical"><Form.Item label="复核意见" required><Input.TextArea rows={4} value={reviewNote} onChange={e=>setReviewNote(e.target.value)}/></Form.Item></Form>
    </Modal>
    <Modal title="新建执法任务" open={open} onCancel={()=>setOpen(false)} onOk={()=>void create()} okText="创建任务"><Form form={form} layout="vertical">
      <Form.Item label="任务类型" name="taskType"><Select options={['双随机一公开','日常巡查','专项检查','抽样任务'].map(v=>({value:v,label:v}))}/></Form.Item>
      <Form.Item label="监管主体" name="subjectId" rules={[{required:true,message:'请从监管台账里选择主体'}]}><Select showSearch optionFilterProp="label" placeholder="这次检查属于哪一家主体" options={subjects.map(s=>({value:s.id,label:`${s.subjectName}（${s.region}）`}))}/></Form.Item>
      <Form.Item label="地址" name="address"><Input placeholder="留空则使用主体登记地址"/></Form.Item>
      <Form.Item label="截止时间" name="deadline"><Input placeholder="今日 18:00"/></Form.Item>
      <Form.Item label="承办执法人员" name="assigneeId" rules={[{required:true,message:'必须点名承办人——任务不会自动落到某个固定的人身上'}]}><Select showSearch optionFilterProp="label" options={staff.map(s=>({value:s.id,label:`${s.name} · ${s.role} · ${s.grid||'未分配网格'}`}))}/></Form.Item>
    </Form></Modal>
  </div>
}

function CheckItems(){
  const {message}=AntApp.useApp()
  const [items,setItems]=useState<CheckItem[]>([]),[target,setTarget]=useState<CheckItem|null>(null),[open,setOpen]=useState(false),[form]=Form.useForm()
  const load=()=>opsApi.checkItems().then(setItems).catch((e:Error)=>message.error(e.message))
  useEffect(()=>{void load()},[])
  const add=()=>{setTarget(null);form.resetFields();setOpen(true)}
  const edit=(item:CheckItem)=>{setTarget(item);form.setFieldsValue({itemName:item.itemName,note:item.note});setOpen(true)}
  const save=async()=>{
    let values:{itemName:string;note?:string}
    try{values=await form.validateFields()}catch{return}
    try{
      if(target)await opsApi.updateCheckItem(target.id,values);else await opsApi.createCheckItem(values)
      message.success(target?'检查项已更新，历史任务结论不受影响':'检查项已加入清单模板');setOpen(false);setTarget(null);form.resetFields();void load()
    }catch(e){message.error(e instanceof Error?e.message:'保存失败')}
  }
  const toggle=async(item:CheckItem,active:boolean)=>{
    try{await opsApi.toggleCheckItem(item.id,active);message.success(active?'已启用，新建任务会带上这一项':'已停用，仅影响新建任务');void load()}
    catch(e){message.error(e instanceof Error?e.message:'操作失败')}
  }
  return <div className="o-page"><Title title="执法事项清单" desc="现场检查看勾选项来自这张模板表；停用只影响新建任务，不改写历史结论。" actions={<Button type="primary" onClick={add}>+ 新增检查项</Button>}/>
    <section className="o-card o-table"><Table rowKey="id" dataSource={items} pagination={false} scroll={{x:760}} columns={[
      {title:'顺序',dataIndex:'sortOrder',width:70},
      {title:'检查项',render:(_,r)=><div className="o-entity"><b>{r.itemName}</b><small>{r.note||'无说明'}</small></div>},
      {title:'状态',dataIndex:'status',render:v=><Tag color={v==='active'?'green':'default'}>{v==='active'?'启用':'停用'}</Tag>},
      {title:'启停',render:(_,r)=><Switch checked={r.status==='active'} onChange={checked=>void toggle(r,checked)}/>,width:90},
      {title:'操作',render:(_,r)=><Button type="link" onClick={()=>edit(r)}>编辑</Button>},
    ]}/></section>
    <Modal title={target?'编辑检查项':'新增检查项'} open={open} onCancel={()=>setOpen(false)} onOk={()=>void save()} okText="保存">
      <Form form={form} layout="vertical">
        <Form.Item label="检查项名称" name="itemName" rules={[{required:true,message:'请填写检查项名称'}]}><Input placeholder="例如：投入品仓储与使用台账"/></Form.Item>
        <Form.Item label="检查说明" name="note"><Input.TextArea rows={3} placeholder="执法人员现场看什么、如何判定"/></Form.Item>
      </Form>
    </Modal>
  </div>
}

function Cases(){
  const {message}=AntApp.useApp()
  const [items,setItems]=useState<Case[]>([])
  const load=()=>opsApi.cases().then(setItems).catch((e:Error)=>message.error(e.message))
  useEffect(()=>{void load()},[])
  const next=(c:Case)=>c.status==='filing'?'investigating':c.status==='investigating'?'evidence':c.status==='evidence'?'decision':'closed'
  const advance=async(c:Case)=>{
    try{await opsApi.advanceCase(c.id,{status:next(c),handler:c.handler});message.success('案件阶段已推进');void load()}
    catch(e){message.error(e instanceof Error?e.message:'操作失败')}
  }
  return <div className="o-page"><Title title="案件管理" desc="立案、调查取证、裁量、处罚、送达与结案归档。"/>
    <section className="o-card o-table"><Table rowKey="id" dataSource={items} columns={[
      {title:'案件',dataIndex:'caseNo',render:(_,r)=><div className="o-entity"><b>{r.caseNo}</b><small>{r.subjectName}</small></div>},
      {title:'类型',dataIndex:'caseType'},
      {title:'案情摘要',dataIndex:'summary',ellipsis:true},
      {title:'法律依据',dataIndex:'legalBasis',ellipsis:true},
      {title:'阶段',dataIndex:'status',render:v=><Status value={v}/>},
      {title:'进度',render:(_,r)=><Progress percent={r.progress} size="small" strokeColor="#159a5e"/>},
      {title:'承办',dataIndex:'handler'},
      {title:'操作',render:(_,r)=>r.status!=='closed'?<Button type="link" onClick={()=>void advance(r)}>推进到{STATUS[next(r)]?.label??next(r)}</Button>:<span className="muted">已归档</span>},
    ]}/></section>
  </div>
}

function Repairs(){
  const {message}=AntApp.useApp()
  const [items,setItems]=useState<Repair[]>([])
  const load=()=>opsApi.repairs().then(setItems).catch((e:Error)=>message.error(e.message))
  useEffect(()=>{void load()},[])
  const review=async(id:number,status:'approved'|'rejected',note:string)=>{
    try{await opsApi.reviewRepair(id,{status,note});message.success(status==='approved'?'修复已通过，主体端可见进度':'已驳回补件，主体端可见理由');void load()}
    catch(e){message.error(e instanceof Error?e.message:'操作失败')}
  }
  const ask=(r:Repair,status:'approved'|'rejected')=>{
    const note=window.prompt(status==='approved'?'同意修复的复核意见（主体端可见）':'驳回理由（主体端会原样看到）',status==='approved'?'整改材料完整，同意修复':'材料不足，请补充证明材料')
    if(note===null||!note.trim())return
    void review(r.id,status,note.trim())
  }
  return <div className="o-page"><Title title="信用修复复核" desc="整改完成、异议申诉与到期修复的 AI 初审和人工复核。"/>
    <div className="o-repair-grid">{items.map(r=><section className="o-card" key={r.id}><div className="o-card-head"><div><b>{r.repairNo}</b><small>{r.subjectName} · {r.submittedAt}</small></div><Status value={r.status}/></div><h3>{r.repairType}</h3><p>{r.reason}</p><Progress percent={r.progress} showInfo={false} strokeColor="#159a5e"/>{r.reviewNote&&<p className="muted">复核意见：{r.reviewNote}</p>}<footer><span>进度 {r.progress}%</span>{r.status!=='approved'&&r.status!=='rejected'&&<><Button size="small" danger onClick={()=>ask(r,'rejected')}>驳回补件</Button><Button size="small" type="primary" onClick={()=>ask(r,'approved')}>通过修复</Button></>}</footer></section>)}</div>
    {!items.length&&<p className="muted">暂无信用修复申请</p>}
  </div>
}

function Subsidies(){
  const {message}=AntApp.useApp()
  const [items,setItems]=useState<Subsidy[]>([])
  const load=()=>opsApi.subsidies().then(setItems).catch((e:Error)=>message.error(e.message))
  useEffect(()=>{void load()},[])
  const review=async(s:Subsidy,status:string)=>{
    try{await opsApi.reviewSubsidy(s.id,{status,note:'遥感与材料核验通过',remoteCheckStatus:'遥感核查通过'});message.success('项目审核状态已更新，主体端同步收到');void load()}
    catch(e){message.error(e instanceof Error?e.message:'操作失败')}
  }
  return <div className="o-page"><Title title="补贴项目监管" desc="补贴项目申报、遥感核查、审核节点与资金兑付跟踪。"/>
    <section className="o-card o-table"><Table rowKey="id" dataSource={items} columns={[
      {title:'项目',dataIndex:'projectName',render:(_,r)=><div className="o-entity"><b>{r.projectName}</b><small>{r.applicationNo} · {r.subjectName}</small></div>},
      {title:'金额',dataIndex:'amount',render:v=>`¥${Number(v).toLocaleString()}`},
      {title:'遥感核查',dataIndex:'remoteCheckStatus'},
      {title:'进度',render:(_,r)=><Progress percent={r.progress} size="small" strokeColor="#159a5e"/>},
      {title:'状态',dataIndex:'status',render:v=><Status value={v}/>},
      {title:'操作',render:(_,r)=>r.status!=='paid'?<><Button type="link" onClick={()=>void review(r,'county_review')}>通过复核</Button><Button type="link" onClick={()=>void review(r,'paid')}>标记兑付</Button></>:<span className="muted">已兑付</span>},
    ]}/></section>
  </div>
}

function Complaints(){
  const {message}=AntApp.useApp()
  const [items,setItems]=useState<Complaint[]>([]),[target,setTarget]=useState<Complaint|null>(null),[note,setNote]=useState('')
  const load=()=>opsApi.complaints().then(setItems).catch((e:Error)=>message.error(e.message))
  useEffect(()=>{void load()},[])
  const resolve=async()=>{
    if(!target)return
    if(!note.trim()){message.warning('请填写处理结论');return}
    try{await opsApi.handleComplaint(target.id,{status:'resolved',note,assignedOrg:target.assignedOrg||'县级农业农村局'});setTarget(null);message.success('举报已办结，处理结论已通知被举报主体');void load()}
    catch(e){message.error(e instanceof Error?e.message:'操作失败')}
  }
  return <div className="o-page"><Title title="举报处理" desc="12345 / 12315 多渠道受理、智能分流与办理闭环。"/>
    <div className="o-complaint-grid">{items.map(c=><section className="o-card" key={c.id}><div className="o-card-head"><div><b>{c.title}</b><small>{c.complaintNo} · {c.createdAt}</small></div><Tag color={c.priority==='high'?'red':'blue'}>{c.priority==='high'?'高优':'普通'}</Tag></div><p>{c.content}</p><div className="o-summary"><span>涉及主体：{c.targetName||'待核实'}</span><span>举报人：{c.anonymous?'匿名':c.reporterName}</span></div>{c.handleNote&&<p className="muted">结论：{c.handleNote}</p>}<footer><Status value={c.status}/>{c.status!=='resolved'&&<Button size="small" type="primary" onClick={()=>{setTarget(c);setNote('')}}>办理</Button>}</footer></section>)}</div>
    {!items.length&&<p className="muted">暂无举报线索</p>}
    <Modal title="办理举报" open={Boolean(target)} onCancel={()=>setTarget(null)} onOk={()=>void resolve()} okText="确认办结">
      <div className="o-summary"><b>{target?.title}</b><span>{target?.content}</span></div>
      <Form layout="vertical"><Form.Item label="处理结论" required><Input.TextArea rows={4} value={note} onChange={e=>setNote(e.target.value)} placeholder="核查事实、处理意见与反馈方式"/></Form.Item></Form>
    </Modal>
  </div>
}

function Samplings(){
  const {message}=AntApp.useApp()
  const [items,setItems]=useState<Sampling[]>([]),[open,setOpen]=useState(false),[form]=Form.useForm(),[subjects,setSubjects]=useState<Subject[]>([])
  const load=()=>opsApi.samplings().then(setItems).catch((e:Error)=>message.error(e.message))
  useEffect(()=>{
    opsApi.subjects().then(setSubjects).catch(()=>setSubjects([]))
    void load()
  },[])
  const create=async()=>{
    try{await opsApi.createSampling(await form.validateFields());setOpen(false);form.resetFields();message.success('抽样任务已创建，主体端已收到抽检通知');void load()}
    catch(e){if(e instanceof Error)message.error(e.message)}
  }
  return <div className="o-page"><Title title="监督抽检" desc="抽检计划、结果公示、不合格产品处置与风险区域分析。" actions={<Button type="primary" onClick={()=>setOpen(true)}>+ 新建抽样</Button>}/>
    <section className="o-card o-table"><Table rowKey="id" dataSource={items} columns={[
      {title:'抽样编号',dataIndex:'samplingNo'},
      {title:'产品 / 主体',render:(_,r)=><div className="o-entity"><b>{r.productName}</b><small>{r.subjectName} · {r.region}</small></div>},
      {title:'检测项目',dataIndex:'testItems'},
      {title:'结果',dataIndex:'result',render:v=><Tag color={v==='合格'?'green':v==='不合格'?'red':'default'}>{v}</Tag>},
      {title:'处置',dataIndex:'disposition'},
      {title:'抽样日期',dataIndex:'sampleDate'},
    ]}/></section>
    <Modal title="新建抽样任务" open={open} onCancel={()=>setOpen(false)} onOk={()=>void create()} okText="创建"><Form form={form} layout="vertical">
      <Form.Item label="监管主体" name="subjectId" rules={[{required:true,message:'抽检必须落到具体主体'}]}><Select showSearch optionFilterProp="label" placeholder="从监管台账选择" options={subjects.map(s=>({value:s.id,label:`${s.subjectName}（${s.region}）`}))}/></Form.Item>
      <Form.Item label="产品名称" name="productName" rules={[{required:true,message:'请填写产品名称'}]}><Input/></Form.Item>
      <Form.Item label="检测项目" name="testItems"><Input placeholder="农残常规检测"/></Form.Item>
      <Form.Item label="结果" name="result"><Select allowClear options={['待检','合格','不合格'].map(v=>({value:v,label:v}))}/></Form.Item>
    </Form></Modal>
  </div>
}

function Sharing(){
  const {message}=AntApp.useApp()
  const [items,setItems]=useState<DataShare[]>([])
  const load=()=>opsApi.dataShares().then(setItems).catch((e:Error)=>message.error(e.message))
  useEffect(()=>{void load()},[])
  const review=async(d:DataShare,status:'approved'|'rejected')=>{
    try{await opsApi.reviewDataShare(d.id,{status,note:'数据分级与共享范围已核验'});message.success(status==='approved'?'共享授权已通过':'已驳回该共享申请');void load()}
    catch(e){message.error(e instanceof Error?e.message:'操作失败')}
  }
  return <div className="o-page"><Title title="跨部门数据共享" desc="数据目录、授权审批、敏感分级与共享交换记录。"/>
    <section className="o-card o-table"><Table rowKey="id" dataSource={items} columns={[
      {title:'数据资源',dataIndex:'resourceName'},
      {title:'提供 / 接收方',render:(_,r)=>`${r.owner} → ${r.receiver}`},
      {title:'共享方式',dataIndex:'shareType'},
      {title:'敏感等级',dataIndex:'sensitiveLevel',render:v=><Tag color={v==='二级'?'orange':'blue'}>{v}</Tag>},
      {title:'记录数',dataIndex:'recordCount',render:v=>Number(v).toLocaleString()},
      {title:'状态',dataIndex:'status',render:v=><Status value={v}/>},
      {title:'更新时间',dataIndex:'updatedAt'},
      {title:'操作',render:(_,r)=>r.status==='pending'?<><Button type="link" onClick={()=>void review(r,'approved')}>授权</Button><Button type="link" danger onClick={()=>void review(r,'rejected')}>驳回</Button></>:<span className="muted">已配置</span>},
    ]}/></section>
  </div>
}

function Statistics(){
  const {message}=AntApp.useApp()
  const [data,setData]=useState<Awaited<ReturnType<typeof opsApi.statistics>>|null>(null)
  useEffect(()=>{opsApi.statistics().then(setData).catch((e:Error)=>message.error(e.message))},[message])
  if(!data)return <Loading/>
  const max=Math.max(...data.warningTypes.map(w=>w.value),1)
  const exportCases=()=>{try{downloadCsv('案件台账.csv',data.cases as unknown as Array<Record<string,unknown>>);message.success('案件台账已下载')}catch(e){message.error(e instanceof Error?e.message:'导出失败')}}
  return <div className="o-page"><Title title="统计报表中心" desc="主体、预警、抽检、案件与产业运行周期报表。" actions={<Button type="primary" onClick={exportCases}>导出案件台账</Button>}/>
    <div className="o-stats-grid">
      <section className="o-card"><Head title="预警类型分布" sub="按预警表实时统计"/><div className="o-horizontal">{data.warningTypes.map(w=><div key={w.name}><span>{w.name}</span><div><i style={{width:`${w.value/max*100}%`}}/></div><b>{w.value}</b></div>)}</div></section>
      <section className="o-card"><Head title="主体信用结构" sub="按信用等级"/><div className="o-credit-chart">{[...new Set(data.subjects.map(s=>s.creditLevel))].map(level=><div key={level}><b>{data.subjects.filter(s=>s.creditLevel===level).length}</b><span>{level} 级</span></div>)}</div></section>
    </div>
    <section className="o-card o-table"><Table rowKey="id" dataSource={data.cases} columns={[
      {title:'案件编号',dataIndex:'caseNo'},{title:'主体',dataIndex:'subjectName'},{title:'类型',dataIndex:'caseType'},
      {title:'状态',dataIndex:'status',render:v=><Status value={v}/>},{title:'承办人',dataIndex:'handler'},{title:'立案时间',dataIndex:'filedAt'},
    ]}/></section>
    <section className="o-card o-table" style={{marginTop:14}}><Head title="抽检结果" sub="已出结果的抽样"/><Table rowKey="id" dataSource={data.samplings.filter(s=>s.result!=='待检')} pagination={false} columns={[
      {title:'抽样编号',dataIndex:'samplingNo'},{title:'产品',dataIndex:'productName'},{title:'主体',dataIndex:'subjectName'},
      {title:'结果',dataIndex:'result',render:v=><Tag color={v==='合格'?'green':'red'}>{v}</Tag>},{title:'处置',dataIndex:'disposition'},
    ]}/></section>
  </div>
}

function Users(){
  const {message}=AntApp.useApp()
  const [items,setItems]=useState<StaffRow[]>([])
  const [target,setTarget]=useState<StaffRow|null>(null)
  const [platformUserId,setPlatformUserId]=useState('')
  const load=()=>opsApi.users().then(setItems).catch((e:Error)=>message.error(e.message))
  useEffect(()=>{void load()},[])
  const bind=async(user:StaffRow,value:string)=>{
    try{
      await opsApi.bindUserPlatform(user.id,value)
      message.success(value?'已绑定平台账号：该执法人员可用统一账号登录移动执法端':'已解除绑定：移动执法端将无法确认"我是谁"')
      setTarget(null);void load()
    }catch(e){message.error(e instanceof Error?e.message:'绑定失败')}
  }
  const columns:ColumnsType<StaffRow>=[
    {title:'姓名',dataIndex:'name'},
    {title:'角色',dataIndex:'role',render:v=><Tag>{String(v)}</Tag>},
    {title:'单位',dataIndex:'organization'},
    {title:'网格',dataIndex:'grid',render:v=>v||'未分配'},
    {title:'执法证号',dataIndex:'certificateNo',render:v=>v||<span className="muted">未登记</span>},
    {title:'平台账号',dataIndex:'platformUserId',render:v=>v?<Tag color="green">已绑定 {String(v)}</Tag>:<Tag>未绑定</Tag>},
    {title:'在岗',dataIndex:'status',render:v=><Tag color={v==='active'?'green':'default'}>{v==='active'?'在岗':'停用'}</Tag>},
    {title:'操作',render:(_,r)=><><Button type="link" onClick={()=>{setTarget(r);setPlatformUserId(r.platformUserId??'')}}>{r.platformUserId?'变更绑定':'绑定平台账号'}</Button>{r.platformUserId&&<Button type="link" danger onClick={()=>void bind(r,'')}>解除</Button>}</>},
  ]
  return <div className="o-page"><Title title="组织与权限" desc="跨部门组织、监管角色、辖区网格与统一账号绑定关系。"/>
    <section className="o-card o-table"><Table rowKey="id" dataSource={items} columns={columns} scroll={{x:1020}}/></section>
    <Modal title={'绑定平台账号 · '+(target?.name ?? '')} open={Boolean(target)} onCancel={()=>setTarget(null)} onOk={()=>void bind(target as StaffRow,platformUserId.trim())} okText="确认绑定">
      <p className="muted">移动执法端用统一账号登录后，要靠这条绑定确认"当前登录人是哪份执法档案"；没绑定的账号只会看到"未绑定执法档案"，任务与取证不会落到某个写死的人身上。权限点（gov:read / gov:write / gov:inspector / gov:admin）由平台运营端在角色权限矩阵里维护。</p>
      <Input value={platformUserId} onChange={e=>setPlatformUserId(e.target.value)} placeholder="平台用户 ID（例如 1007）"/>
    </Modal>
  </div>
}

function Logs(){
  const {message}=AntApp.useApp()
  const [items,setItems]=useState<Awaited<ReturnType<typeof opsApi.logs>>>([])
  useEffect(()=>{opsApi.logs().then(setItems).catch((e:Error)=>message.error(e.message))},[message])
  const exportLogs=()=>{try{downloadCsv('操作审计日志.csv',items as unknown as Array<Record<string,unknown>>);message.success('审计日志已下载')}catch(e){message.error(e instanceof Error?e.message:'导出失败')}}
  return <div className="o-page"><Title title="操作审计日志" desc="审核、分派、处罚、补贴与数据共享的敏感操作留痕。" actions={<Button onClick={exportLogs}>导出日志</Button>}/>
    <section className="o-card o-table"><Table rowKey="id" dataSource={items} columns={[
      {title:'时间',dataIndex:'createdAt'},
      {title:'操作人',render:(_,r)=><div className="o-entity"><b>{r.operator||'系统'}</b><small>{r.role}</small></div>},
      {title:'动作',dataIndex:'action',render:v=><Tag>{v}</Tag>},
      {title:'对象',dataIndex:'target'},
      {title:'说明',dataIndex:'detail',ellipsis:true},
      {title:'IP',dataIndex:'ip'},
    ]}/></section>
  </div>
}

export default function App(){
  const {user}=useUnifiedUser();const displayName=user.nickname||user.username
  const [page,setPage]=useState<Page>(parse),[collapsed,setCollapsed]=useState(false),[keyword,setKeyword]=useState('')
  const [overview,setOverview]=useState<Overview|null>(null)
  const [identity,setIdentity]=useState<IdentityCard|null>(null)
  useEffect(()=>{const h=()=>{setPage(parse());scrollTo({top:0})};addEventListener('hashchange',h);return()=>removeEventListener('hashchange',h)},[])
  useEffect(()=>{
    opsApi.overview().then(setOverview).catch(()=>setOverview(null))
    opsApi.identity().then(setIdentity).catch(()=>setIdentity(null))
  },[page])
  const content=useMemo(()=>{switch(page){
    case'subjects':return <Subjects/>;case'warnings':return <Warnings/>;case'tasks':return <Tasks/>;
    case'items':return <CheckItems/>;case'cases':return <Cases/>;case'repairs':return <Repairs/>;
    case'subsidies':return <Subsidies/>;case'complaints':return <Complaints/>;case'samplings':return <Samplings/>;
    case'sharing':return <Sharing/>;case'statistics':return <Statistics/>;case'users':return <Users/>;
    case'logs':return <Logs/>;default:return <Dashboard data={overview}/>}
  },[page,overview])
  const pending=overview?.metrics.pendingWarnings??0
  return <div className={`o-shell${collapsed?' collapsed':''}`}><aside className="o-sidebar"><button type="button" className="o-brand" onClick={()=>go('dashboard')}><span>丰</span>{!collapsed&&<div><b>丰链云</b><small>政府监管运营端</small></div>}</button><nav>{NAV.map(g=><section key={g.group}>{!collapsed&&<h3>{g.group}</h3>}{g.items.map(i=><button type="button" key={i.page} className={page===i.page?'on':''} onClick={()=>go(i.page)} title={i.label}>{i.icon}{!collapsed&&<span>{i.label}</span>}</button>)}</section>)}</nav><div className="o-side-foot">{!collapsed&&<div><b>监管指挥中心</b><small>值班 09:00-21:00</small></div>}<button type="button" onClick={()=>setCollapsed(!collapsed)}>{collapsed?<MenuUnfoldOutlined/>:<><MenuFoldOutlined/>收起导航</>}</button></div></aside>
    <div className="o-main"><header className="o-header"><div><span>政府监管</span><b>/</b><strong>{TITLES[page]}</strong></div>
      <form onSubmit={e=>{e.preventDefault();if(!keyword.trim()){return}transfer.keyword=keyword.trim();go('subjects')}}><SearchOutlined/><input value={keyword} onChange={e=>setKeyword(e.target.value)} placeholder="按主体名称或信用代码查台账"/></form>
      <div className="o-header-right"><span>{todayText()}</span>
        <button type="button" title={`待处置预警 ${pending} 条`} onClick={()=>go('warnings')}><BellOutlined/>{pending>0&&<i>{pending}</i>}</button>
        <Dropdown menu={{items:[{key:'users',label:'组织与权限',onClick:()=>go('users')},{key:'logs',label:'操作审计',onClick:()=>go('logs')},{key:'logout',label:'退出统一登录',onClick:()=>void logoutUnified('gov-ops')}]}}><button type="button" className="o-user-chip"><Avatar size={30} className="o-avatar">{displayName.slice(0,1)}</Avatar><span><b>{displayName}</b><small>{identity?.operatorName?`${identity.roles?.admin?'监管运营':'执法人员'} · ${identity.operatorName}`:'统一账号 · 监管运营'}</small></span></button></Dropdown>
      </div></header><main>{content}</main></div></div>
}
