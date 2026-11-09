import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  AlertOutlined,
  AppstoreOutlined,
  AuditOutlined,
  BarChartOutlined,
  BellOutlined,
  BookOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  FileSearchOutlined,
  FundOutlined,
  InsuranceOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SettingOutlined,
  ShopOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { App as AntApp, Avatar, Badge, Button, Dropdown, Form, Input, Modal, Progress, Select, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  opsApi,
  ORDER_STATUS,
  POLICY_STATUS,
  PROVIDER_STATUS,
  type Campaign,
  type Complaint,
  type DispatchDemand,
  type InsuranceClaim,
  type OpsOrder,
  type OpsOverview,
  type OpsProvider,
  type OpLog,
  type PolicyApplication,
  type QualityAlert,
  type ServiceItem,
  type Settlement,
  type Strategy,
  type TeamMember,
} from './api'
import { logoutUnified, useUnifiedUser } from '../../frontend/src/sso'

type Page = 'dashboard' | 'providers' | 'provider-detail' | 'catalog' | 'orders' | 'dispatch'
  | 'disputes' | 'quality' | 'policies' | 'insurance' | 'settlement' | 'ai' | 'campaigns'
  | 'reports' | 'team' | 'logs'

interface Route { page: Page; id?: number }

const PAGES: Page[] = ['dashboard', 'providers', 'provider-detail', 'catalog', 'orders', 'dispatch', 'disputes', 'quality', 'policies', 'insurance', 'settlement', 'ai', 'campaigns', 'reports', 'team', 'logs']

const TITLES: Record<Page, string> = {
  dashboard: '运营大盘', providers: '服务商管理', 'provider-detail': '服务商详情档案', catalog: '服务商品审核',
  orders: '全量订单', dispatch: '调度派单', disputes: '投诉与仲裁', quality: '质量与评价预警',
  policies: '政策项目运营', insurance: '农险理赔运营', settlement: '结算与分账', ai: 'AI 运营与策略',
  campaigns: '营销与优惠券', reports: '数据报表中心', team: '角色与权限', logs: '操作审计日志',
}

const NAV: Array<{ group: string; items: Array<{ page: Page; label: string; icon: ReactNode }> }> = [
  { group: '仪表盘', items: [{ page: 'dashboard', label: '运营大盘', icon: <BarChartOutlined /> }] },
  {
    group: '服务商管理',
    items: [
      { page: 'providers', label: '入驻审核与列表', icon: <AuditOutlined /> },
      { page: 'quality', label: '等级与质量预警', icon: <SafetyCertificateOutlined /> },
    ],
  },
  {
    group: '服务供给',
    items: [
      { page: 'catalog', label: '品类与商品审核', icon: <AppstoreOutlined /> },
      { page: 'campaigns', label: '营销与优惠券', icon: <ShopOutlined /> },
    ],
  },
  {
    group: '调度与履约',
    items: [
      { page: 'dispatch', label: '调度看板', icon: <ThunderboltOutlined /> },
      { page: 'orders', label: '全量订单', icon: <FileSearchOutlined /> },
      { page: 'disputes', label: '投诉与仲裁', icon: <WarningOutlined /> },
    ],
  },
  {
    group: '质量·内容·资金',
    items: [
      { page: 'policies', label: '政策项目', icon: <BookOutlined /> },
      { page: 'insurance', label: '农险理赔', icon: <InsuranceOutlined /> },
      { page: 'settlement', label: '结算与分账', icon: <DollarOutlined /> },
    ],
  },
  {
    group: 'AI·数据·系统',
    items: [
      { page: 'ai', label: 'AI 运营策略', icon: <RobotOutlined /> },
      { page: 'reports', label: '数据报表中心', icon: <FundOutlined /> },
      { page: 'team', label: '角色与权限', icon: <TeamOutlined /> },
      { page: 'logs', label: '操作审计日志', icon: <SettingOutlined /> },
    ],
  },
]

function parseRoute(): Route {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/')
  const page = PAGES.includes(parts[0] as Page) ? parts[0] as Page : 'dashboard'
  const id = Number(parts[1])
  return { page, id: Number.isFinite(id) ? id : undefined }
}

function go(page: Page, id?: number): void {
  window.location.hash = `/${page}${id === undefined ? '' : `/${id}`}`
}

function PageTitle({ title, description, actions }: { title: string; description: string; actions?: ReactNode }): JSX.Element {
  return <div className="ops-page-title"><div><span>COMPREHENSIVE SERVICE · OPERATIONS</span><h1>{title}</h1><p>{description}</p></div>{actions && <div className="ops-page-actions">{actions}</div>}</div>
}

function Status({ status, labels }: { status: string; labels: Record<string, { label: string; tone: string }> }): JSX.Element {
  const item = labels[status] ?? { label: status, tone: 'gray' }
  return <Tag className={`ops-status tone-${item.tone}`}>{item.label}</Tag>
}

function MetricCard({ label, value, hint, icon, tone }: { label: string; value: string; hint: string; icon: ReactNode; tone: string }): JSX.Element {
  return <div className={`ops-metric tone-${tone}`}><span>{icon}</span><div><small>{label}</small><b>{value}</b><em>{hint}</em></div></div>
}

function LoadingBlock(): JSX.Element {
  return <div className="ops-loading"><i /><i /><i /></div>
}

/** 真下载：把当前筛选结果拼成 CSV 交给浏览器，而不是弹一句"已导出"。 */
function downloadCsv(rows: Array<Array<string | number>>, filename: string): void {
  const body = rows.map((cells) => cells.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([`﻿${body}`], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10)
}

function DashboardPage(): JSX.Element {
  const { message } = AntApp.useApp()
  const [data, setData] = useState<OpsOverview | null>(null)

  useEffect(() => {
    opsApi.overview().then(setData).catch((error: Error) => message.error(error.message))
  }, [message])

  if (!data) return <LoadingBlock />
  const maxGmv = Math.max(...data.trend.map((item) => Number(item.gmv)), 1)
  return (
    <div className="ops-page">
      <PageTitle title="运营大盘" description="服务交易、供给质量、履约风险与政策项目的实时运营视角。" actions={<><Button onClick={() => go('reports')}>导出经营报表</Button><Button type="primary" onClick={() => go('dispatch')}>进入调度台</Button></>} />
      <div className="ops-metrics-grid">
        <MetricCard label="认证服务商" value={data.metrics.providers.toLocaleString()} hint={`${data.metrics.pendingProviders} 家待审核 · ${data.metrics.unboundProviders} 家未绑定平台主体`} icon={<TeamOutlined />} tone="green" />
        <MetricCard label="服务 GMV" value={`¥${(data.metrics.gmv / 10000).toFixed(1)}万`} hint={`平台服务费 ¥${data.metrics.platformFee.toLocaleString()}`} icon={<FundOutlined />} tone="blue" />
        <MetricCard label="履约订单" value={String(data.metrics.activeOrders)} hint={`累计 ${data.metrics.totalOrders} 单`} icon={<ClockCircleOutlined />} tone="amber" />
        <MetricCard label="待处理风险" value={String(data.metrics.openComplaints)} hint={`${data.metrics.pendingClaims} 笔理赔待跟进`} icon={<AlertOutlined />} tone="red" />
      </div>

      <div className="ops-dashboard-main">
        <section className="ops-card ops-trend-card">
          <div className="ops-card-head"><div><b>近 7 日服务交易趋势</b><small>订单量与 GMV 日趋势</small></div><div className="legend"><span><i className="green" />GMV</span><span><i className="blue" />订单</span></div></div>
          <div className="ops-chart">
            {data.trend.map((item) => <div className="ops-chart-col" key={item.date}><div className="ops-chart-bars"><span style={{ height: `${Math.max(16, Number(item.gmv) / maxGmv * 100)}%` }} /><i style={{ height: `${Math.max(12, item.orders / 260 * 100)}%` }} /></div><small>{item.date.slice(5)}</small><em>{Math.round(Number(item.gmv) / 1000)}k</em></div>)}
          </div>
        </section>
        <section className="ops-card ops-todo-card">
          <div className="ops-card-head"><div><b>今日待办</b><small>按业务实数聚合</small></div><Tag color="orange">{data.todos.reduce((sum, item) => sum + Number(item.count || 0), 0)} 项</Tag></div>
          {data.todos.map((todo) => <button type="button" key={todo.route} onClick={() => go(todo.route as Page)}><span>{todo.count}</span><div><b>{todo.title}</b><small>{todo.description}</small></div><em>处理 ›</em></button>)}
          {data.todos.length === 0 && <div className="ops-empty">当前没有待办事项</div>}
        </section>
      </div>

      <div className="ops-dashboard-lower">
        <section className="ops-card">
          <div className="ops-card-head"><div><b>风险与质量预警</b><small>AI 与规则引擎共同识别</small></div><Button size="small" onClick={() => go('quality')}>查看全部</Button></div>
          <div className="ops-alert-list">{data.alerts.map((alert) => <button type="button" key={alert.id} className={`level-${alert.level}`} onClick={() => go('quality')}><span>{alert.level === 'high' ? <WarningOutlined /> : <AlertOutlined />}</span><div><b>{alert.type} · {alert.providerName}</b><p>{alert.content}</p><small>{alert.createdAt} · AI 风险分 {alert.score}</small></div><em>{alert.level === 'high' ? '高优' : '跟进'}</em></button>)}</div>
        </section>
        <section className="ops-card ops-region-card">
          <div className="ops-card-head"><div><b>区域服务供给</b><small>服务商与平均评分</small></div><Button size="small" onClick={() => go('reports')}>区域报表</Button></div>
          {data.regions.slice(0, 5).map((region) => <div key={region.name}><span>{region.name}</span><div><i style={{ width: `${Math.min(100, region.providers * 28)}%` }} /></div><b>{region.providers} 家</b><em>★ {region.rating}</em></div>)}
        </section>
      </div>

      <section className="ops-ai-brief">
        <span><RobotOutlined /></span>
        <div>
          <small>需要你处理的事实</small>
          <p>
            预警池共 {data.alerts.length} 条（高风险 {data.alerts.filter((item) => item.level === 'high').length} 条）；
            未绑定平台主体的服务商 {data.metrics.unboundProviders} 家，这些档案的账号进不了工作台；
            待办合计 {data.todos.reduce((sum, item) => sum + Number(item.count || 0), 0)} 项。
          </p>
        </div>
        <Button onClick={() => go('quality')}>进入预警处置</Button>
      </section>
    </div>
  )
}

function ProvidersPage(): JSX.Element {
  const { message } = AntApp.useApp()
  const [items, setItems] = useState<OpsProvider[]>([])
  const [status, setStatus] = useState('all')
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [target, setTarget] = useState<OpsProvider | null>(null)
  const [binding, setBinding] = useState<OpsProvider | null>(null)
  const [merchantId, setMerchantId] = useState('')
  const [reviewStatus, setReviewStatus] = useState('available')
  const [reason, setReason] = useState('资质材料完整，审核通过')
  const [submitting, setSubmitting] = useState(false)

  const load = (): void => {
    setLoading(true)
    opsApi.providers({ status: status === 'all' ? undefined : status, keyword: keyword || undefined })
      .then(setItems).catch((error: Error) => message.error(error.message)).finally(() => setLoading(false))
  }
  useEffect(load, [status])

  const openReview = (provider: OpsProvider): void => {
    setTarget(provider)
    setReviewStatus(provider.status === 'pending' ? 'available' : provider.status === 'available' ? 'restricted' : 'available')
    setReason('')
  }
  const submitReview = async (): Promise<void> => {
    if (!target) return
    if (!reason.trim()) {
      message.warning('请填写审核意见或处置原因')
      return
    }
    setSubmitting(true)
    try {
      await opsApi.reviewProvider(target.id, { status: reviewStatus, reason })
      setTarget(null)
      message.success('审核结果已保存并写入审计日志')
      load()
    } catch (error) { message.error(error instanceof Error ? error.message : '审核失败') }
    finally { setSubmitting(false) }
  }

  const openBinding = (provider: OpsProvider): void => {
    setBinding(provider)
    setMerchantId(provider.merchantId ?? '')
  }

  const submitBinding = async (): Promise<void> => {
    if (!binding) return
    setSubmitting(true)
    try {
      const updated = await opsApi.bindMerchant(binding.id, merchantId.trim())
      setBinding(null)
      message.success(updated.merchantId
        ? `「${updated.name}」已绑定经营主体 ${updated.merchantId}`
        : `「${updated.name}」已解除主体绑定，其账号将无法进入服务商工作台`)
      load()
    } catch (error) { message.error(error instanceof Error ? error.message : '绑定失败') }
    finally { setSubmitting(false) }
  }

  const exportCsv = (): void => {
    if (items.length === 0) {
      message.warning('当前筛选结果为空，没有可导出的名录')
      return
    }
    const header = ['服务商编号', '名称', '服务类型', '覆盖区域', '信用分', '评分', '取消率', '状态', '平台主体号']
    const rows = items.map((row) => [
      `SV${row.id}`, row.name, row.category, row.region, String(row.creditScore), String(row.rating),
      String(row.cancelRate), PROVIDER_STATUS[row.status]?.label ?? row.status, row.merchantId ?? '未绑定',
    ])
    const body = [header, ...rows].map((cells) => cells.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([`﻿${body}`], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `service-providers-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    message.success(`已导出当前 ${items.length} 条服务商名录`)
  }

  const columns: ColumnsType<OpsProvider> = [
    { title: '服务商', dataIndex: 'name', render: (_, row) => <button type="button" className="ops-entity" onClick={() => go('provider-detail', row.id)}><span>{row.categoryIcon}</span><div><b>{row.name}</b><small>{row.creditCode ?? `SV${row.id}`}</small></div></button> },
    { title: '服务类型', dataIndex: 'category', render: (value) => <Tag>{value}</Tag> },
    { title: '覆盖区域', dataIndex: 'region' },
    {
      title: '平台主体',
      dataIndex: 'merchantId',
      render: (value) => value ? <Tag color="green">已绑定</Tag> : <Tag color="red">未绑定</Tag>,
    },
    { title: '信用分', dataIndex: 'creditScore', sorter: (a, b) => a.creditScore - b.creditScore, render: (value) => <b className={value < 70 ? 'text-red' : value > 90 ? 'text-green' : ''}>{value}</b> },
    { title: '评分', dataIndex: 'rating', render: (value) => <span className="ops-rating">★ {value}</span> },
    { title: '取消率', dataIndex: 'cancelRate', render: (value) => <span className={Number(value) > 10 ? 'text-red' : ''}>{value}%</span> },
    { title: '状态', dataIndex: 'status', render: (value) => <Status status={value} labels={PROVIDER_STATUS} /> },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      width: 200,
      render: (_, row) => <>
        <Button type="link" size="small" onClick={() => go('provider-detail', row.id)}>档案</Button>
        <Button type="link" size="small" onClick={() => openReview(row)}>{row.status === 'pending' ? '审核' : '处置'}</Button>
        <Button type="link" size="small" onClick={() => openBinding(row)}>主体绑定</Button>
      </>,
    },
  ]

  return (
    <div className="ops-page">
      <PageTitle title="服务商管理" description="主体资质、经营状态、信用等级与平台账号绑定统一管理。" actions={<Button onClick={exportCsv}>导出当前名录</Button>} />
      <section className="ops-card ops-filter">
        <div className="ops-tabs">{['all', 'pending', 'available', 'restricted', 'frozen', 'removed'].map((key) => <button type="button" key={key} className={status === key ? 'on' : ''} onClick={() => setStatus(key)}>{key === 'all' ? '全部' : PROVIDER_STATUS[key]?.label}</button>)}</div>
        <Input prefix={<SearchOutlined />} value={keyword} onChange={(event) => setKeyword(event.target.value)} onPressEnter={load} placeholder="搜索名称、服务类型或区域" />
        <Button type="primary" onClick={load}>查询</Button>
      </section>
      <section className="ops-card ops-table-card"><Table rowKey="id" loading={loading} columns={columns} dataSource={items} scroll={{ x: 1240 }} pagination={{ pageSize: 8 }} /></section>
      <Modal title={`服务商处置 · ${target?.name ?? ''}`} open={Boolean(target)} onCancel={() => setTarget(null)} onOk={() => void submitReview()} confirmLoading={submitting} okText="确认提交">
        <Form layout="vertical">
          <Form.Item label="审核后状态"><Select value={reviewStatus} onChange={setReviewStatus} options={Object.entries(PROVIDER_STATUS).map(([value, item]) => ({ value, label: item.label }))} /></Form.Item>
          <Form.Item label="审核意见 / 处置原因" required><Input.TextArea rows={4} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="必填：写清依据，这段文字会进审计日志与服务商通知" /></Form.Item>
        </Form>
        <div className="ops-notice warn">状态变更会写入审计留痕；存在未完结工单的服务商不能直接冻结或清退，需要先处理在途订单。</div>
      </Modal>
      <Modal title={`平台主体绑定 · ${binding?.name ?? ''}`} open={Boolean(binding)} onCancel={() => setBinding(null)} onOk={() => void submitBinding()} confirmLoading={submitting} okText="保存绑定">
        <Form layout="vertical">
          <Form.Item label="平台经营主体号（merchantId）">
            <Input value={merchantId} onChange={(event) => setMerchantId(event.target.value)} placeholder="填平台侧的商户号；清空并保存即解除绑定" />
          </Form.Item>
        </Form>
        <div className="ops-notice">
          当前档案：{binding?.name ?? ''}（id={binding?.id}）· 现绑定 {binding?.merchantId ?? '无'}。
          服务商移动工作台的身份由「登录账号所属经营主体 → 这条绑定」解析；一个主体只能绑一家服务商。
        </div>
      </Modal>
    </div>
  )
}

function ProviderDetailPage(): JSX.Element {
  const { message } = AntApp.useApp()
  const [provider, setProvider] = useState<OpsProvider | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [nextStatus, setNextStatus] = useState('available')
  const [reason, setReason] = useState('')
  const route = parseRoute()
  const load = (): void => { if (route.id) opsApi.provider(route.id).then(setProvider).catch((error: Error) => message.error(error.message)) }
  useEffect(load, [route.id])
  if (!provider) return <LoadingBlock />
  const submit = async (): Promise<void> => {
    if (!reason.trim()) {
      message.warning('请填写处置原因')
      return
    }
    try { await opsApi.reviewProvider(provider.id, { status: nextStatus, reason }); setModalOpen(false); message.success('处置已生效，操作人记为当前登录账号'); load() }
    catch (error) { message.error(error instanceof Error ? error.message : '操作失败') }
  }
  return (
    <div className="ops-page">
      <button type="button" className="ops-back" onClick={() => go('providers')}>← 返回服务商列表</button>
      <section className="ops-provider-hero">
        <span>{provider.categoryIcon}</span>
        <div><div><Status status={provider.status} labels={PROVIDER_STATUS} /><Tag>{provider.badge}</Tag></div><h1>{provider.name}</h1><p>{provider.creditCode ?? '统一社会信用代码待补'} · {provider.region} · {provider.category}</p><em>信用分 {provider.creditScore} · 服务 {provider.orderCount} 单 · ★ {provider.rating} · 取消率 {provider.cancelRate}%</em></div>
        <div><Button onClick={() => go('catalog')}>查看其服务商品</Button><Button type="primary" onClick={() => { setNextStatus(provider.status === 'available' ? 'restricted' : 'available'); setReason(''); setModalOpen(true) }}>调整经营状态</Button></div>
      </section>
      <div className="ops-provider-grid">
        <section className="ops-card"><div className="ops-card-head"><div><b>经营与风险概况</b><small>近 7 日指标</small></div></div><div className="ops-kv-grid"><span><small>信用等级</small><b>{provider.creditScore >= 90 ? 'A / 优质' : provider.creditScore >= 75 ? 'B / 正常' : 'C / 风险'}</b></span><span><small>接单取消率</small><b className={provider.cancelRate > 10 ? 'text-red' : ''}>{provider.cancelRate}%</b></span><span><small>响应时效</small><b>档案未记录</b></span><span><small>平台主体</small><b>{provider.merchantId ?? '未绑定'}</b></span><span><small>风险等级</small><b>{provider.riskLevel}</b></span><span><small>联系人</small><b>{provider.contactName ?? '待补'}</b></span><span><small>联系电话</small><b>{provider.contactPhone ?? '待补'}</b></span></div></section>
        <section className="ops-card"><div className="ops-card-head"><div><b>最近订单</b><small>履约与结算概况</small></div></div><div className="ops-mini-list">{provider.orders?.map((order) => <div key={order.id}><span>{order.orderNo}</span><b>{order.serviceName}</b><Status status={order.status} labels={ORDER_STATUS} /><em>¥{order.totalAmount.toLocaleString()}</em></div>)}</div></section>
      </div>
      <section className="ops-card ops-table-card"><div className="ops-card-head"><div><b>服务商品与目录</b><small>审核状态与近期选择量</small></div></div><Table rowKey="id" pagination={false} dataSource={provider.items ?? []} columns={[{ title: '服务项目', dataIndex: 'name' }, { title: '价格', render: (_, row: ServiceItem) => `¥${row.price} / ${row.unit}` }, { title: '审核', dataIndex: 'auditStatus', render: (value) => <Tag color={value === 'approved' ? 'green' : 'orange'}>{value === 'approved' ? '已通过' : value === 'rejected' ? '已驳回' : '待审核'}</Tag> }, { title: 'AI 预检', dataIndex: 'aiScore', render: (value) => `${value} 分` }, { title: '近 30 天', dataIndex: 'selectedCount', render: (value) => `${value} 人` }]} /></section>
      <Modal title="调整服务商经营状态" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => void submit()} okText="确认处置"><Form layout="vertical"><Form.Item label="处置状态"><Select value={nextStatus} onChange={setNextStatus} options={Object.entries(PROVIDER_STATUS).map(([value, item]) => ({ value, label: item.label }))} /></Form.Item><Form.Item label="原因"><Input.TextArea rows={4} value={reason} onChange={(event) => setReason(event.target.value)} /></Form.Item></Form></Modal>
    </div>
  )
}

function CatalogPage(): JSX.Element {
  const { message } = AntApp.useApp()
  const [items, setItems] = useState<ServiceItem[]>([])
  const [tab, setTab] = useState('pending')
  const [target, setTarget] = useState<ServiceItem | null>(null)
  const [result, setResult] = useState('approved')
  const [reason, setReason] = useState('')
  const load = (): void => { opsApi.serviceItems({ auditStatus: tab === 'all' ? undefined : tab }).then(setItems).catch((error: Error) => message.error(error.message)) }
  useEffect(load, [tab])
  const submit = async (): Promise<void> => {
    if (!target) return
    if (!reason.trim()) {
      message.warning('请填写审核意见，驳回时要说清缺什么')
      return
    }
    try { await opsApi.reviewServiceItem(target.id, { auditStatus: result, reason }); setTarget(null); message.success('审核结果已保存'); load() }
    catch (error) { message.error(error instanceof Error ? error.message : '审核失败') }
  }
  const exportCsv = (): void => {
    if (items.length === 0) {
      message.warning('当前筛选结果为空')
      return
    }
    downloadCsv([
      ['商品编号', '服务商品', '服务商', '品类', '价格', '单位', 'AI 预检分', '审核状态', '审核说明'],
      ...items.map((row) => [`ITEM${row.id}`, row.name, row.providerName, row.category, String(row.price), row.unit, String(row.aiScore), row.auditStatus, row.auditReason]),
    ], `service-items-${tab}-${todayStamp()}.csv`)
    message.success(`已导出当前 ${items.length} 条商品`)
  }
  const columns: ColumnsType<ServiceItem> = [
    { title: '服务商品', dataIndex: 'name', render: (_, row) => <div className="ops-table-entity"><b>{row.name}</b><small>{row.providerName}</small></div> },
    { title: '品类', dataIndex: 'category' },
    { title: '指导价格', render: (_, row) => `¥${row.price} / ${row.unit}` },
    { title: 'AI 预检', dataIndex: 'aiScore', render: (value) => <b className={value < 70 ? 'text-red' : 'text-green'}>{value} 分</b> },
    { title: '审核状态', dataIndex: 'auditStatus', render: (value) => <Tag color={value === 'approved' ? 'green' : value === 'rejected' ? 'red' : 'orange'}>{value === 'approved' ? '已上架' : value === 'rejected' ? '已驳回' : '待审核'}</Tag> },
    { title: '说明', dataIndex: 'auditReason', ellipsis: true },
    { title: '操作', render: (_, row) => <Button type="link" onClick={() => { setTarget(row); setResult(row.aiScore >= 75 ? 'approved' : 'rejected'); setReason('') }}>审核</Button> },
  ]
  return (
    <div className="ops-page">
      <PageTitle title="服务商品审核" description="服务内容、价格区间、资质与版权材料统一审核。" actions={<Button onClick={exportCsv}>导出当前清单</Button>} />
      <section className="ops-card ops-filter"><div className="ops-tabs">{['pending', 'approved', 'rejected', 'all'].map((key) => <button type="button" key={key} className={tab === key ? 'on' : ''} onClick={() => setTab(key)}>{key === 'pending' ? '待审核' : key === 'approved' ? '已上架' : key === 'rejected' ? '已驳回' : '全部'}</button>)}</div><Button onClick={load}>刷新</Button></section>
      <section className="ops-card ops-table-card"><Table rowKey="id" columns={columns} dataSource={items} scroll={{ x: 960 }} /></section>
      <Modal title={`商品审核 · ${target?.name ?? ''}`} open={Boolean(target)} onCancel={() => setTarget(null)} onOk={() => void submit()} okText="提交审核"><div className="ops-review-summary"><span>AI 预检 {target?.aiScore} 分</span><p>{target?.description}</p></div><Form layout="vertical"><Form.Item label="审核结果"><Select value={result} onChange={setResult} options={[{ value: 'approved', label: '通过上架' }, { value: 'rejected', label: '驳回或退回补件' }]} /></Form.Item><Form.Item label="审核意见"><Input.TextArea rows={4} value={reason} onChange={(event) => setReason(event.target.value)} /></Form.Item></Form><div className="ops-notice">审核结果将同步给服务商并写入审计日志。</div></Modal>
    </div>
  )
}

function OrdersPage(): JSX.Element {
  const { message } = AntApp.useApp()
  const [orders, setOrders] = useState<OpsOrder[]>([])
  const [providers, setProviders] = useState<OpsProvider[]>([])
  const [status, setStatus] = useState('all')
  const [keyword, setKeyword] = useState('')
  const [target, setTarget] = useState<OpsOrder | null>(null)
  const [providerId, setProviderId] = useState<number>()
  const [note, setNote] = useState('')
  const load = (): void => { opsApi.orders({ status: status === 'all' ? undefined : status, keyword: keyword || undefined }).then(setOrders).catch((error: Error) => message.error(error.message)) }
  useEffect(load, [status])
  useEffect(() => { opsApi.providers({ status: 'available' }).then(setProviders).catch(() => undefined) }, [])
  const dispatch = async (): Promise<void> => {
    if (!target || !providerId) { message.warning('请点名目标服务商'); return }
    if (!note.trim()) { message.warning('请填写派单说明'); return }
    try { await opsApi.dispatchOrder(target.id, providerId, note); setTarget(null); message.success('订单已改派并写入审计日志'); load() }
    catch (error) { message.error(error instanceof Error ? error.message : '派单失败') }
  }
  const columns: ColumnsType<OpsOrder> = [
    { title: '订单', dataIndex: 'orderNo', render: (_, row) => <div className="ops-table-entity"><b>{row.orderNo}</b><small>{row.serviceName} · {row.category}</small></div> },
    { title: '服务商', dataIndex: 'providerName' },
    { title: '服务地点', dataIndex: 'location', ellipsis: true },
    { title: '预约时间', dataIndex: 'appointmentDate' },
    { title: '金额', dataIndex: 'totalAmount', render: (value) => <b>¥{Number(value).toLocaleString()}</b> },
    { title: '履约', dataIndex: 'status', render: (value) => <Status status={value} labels={ORDER_STATUS} /> },
    { title: '风险', dataIndex: 'riskFlag', render: (value) => value ? <Tag color="red">{value}</Tag> : <span className="muted">正常</span> },
    { title: '操作', fixed: 'right', render: (_, row) => <Button type="link" onClick={() => { setTarget(row); setProviderId(undefined); setNote('') }}>派单 / 改派</Button> },
  ]
  return (
    <div className="ops-page">
      <PageTitle title="全量服务订单" description="查看全量订单、风险订单与派单状态，并支持人工改派。" actions={<Button onClick={() => go('dispatch')}>进入调度看板</Button>} />
      <section className="ops-card ops-filter"><div className="ops-tabs">{['all', 'confirmed', 'in_progress', 'completed', 'cancelled'].map((key) => <button type="button" key={key} className={status === key ? 'on' : ''} onClick={() => setStatus(key)}>{key === 'all' ? '全部' : ORDER_STATUS[key]?.label}</button>)}</div><Input prefix={<SearchOutlined />} value={keyword} onChange={(event) => setKeyword(event.target.value)} onPressEnter={load} placeholder="订单号 / 服务商 / 服务项目" /><Button onClick={load}>查询</Button></section>
      <section className="ops-card ops-table-card"><Table rowKey="id" columns={columns} dataSource={orders} scroll={{ x: 1160 }} /></section>
      <Modal title={`派单 · ${target?.orderNo ?? ''}`} open={Boolean(target)} onCancel={() => setTarget(null)} onOk={() => void dispatch()} okText="确认派单"><Form layout="vertical"><Form.Item label="指派服务商（必选）"><Select showSearch optionFilterProp="label" placeholder="点名一家在营服务商" value={providerId} onChange={setProviderId} options={providers.map((provider) => ({ value: provider.id, label: `${provider.name} · ${provider.category} · ★${provider.rating}` }))} /></Form.Item><Form.Item label="派单说明（必填）"><Input.TextArea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="写明改派原因与约束，会写入订单动态并通知下单主体" /></Form.Item></Form><div className="ops-notice warn">改派只允许派给状态为「正常经营」的服务商；目标服务商当前不可接单会被服务端拒绝。</div></Modal>
    </div>
  )
}

function DispatchPage(): JSX.Element {
  const { message } = AntApp.useApp()
  const [demands, setDemands] = useState<DispatchDemand[]>([])
  const [providers, setProviders] = useState<OpsProvider[]>([])
  const [orders, setOrders] = useState<OpsOrder[]>([])
  const [target, setTarget] = useState<DispatchDemand | null>(null)
  const [providerId, setProviderId] = useState<number>()
  const load = (): void => {
    Promise.all([opsApi.dispatchDemands(), opsApi.providers({ status: 'available' }), opsApi.orders({ status: 'confirmed' })])
      .then(([d, p, o]) => { setDemands(d); setProviders(p); setOrders(o) }).catch((error: Error) => message.error(error.message))
  }
  useEffect(load, [])
  const assign = async (): Promise<void> => {
    if (!target || !providerId) { message.warning('请选择服务商'); return }
    try { await opsApi.assignDemand(target.id, providerId); setTarget(null); message.success('需求已指派并生成订单'); load() }
    catch (error) { message.error(error instanceof Error ? error.message : '指派失败') }
  }
  return (
    <div className="ops-page">
      <PageTitle title="服务调度看板" description="待分配需求、可用服务能力与风险工单的实时调度。" actions={<Button type="primary" onClick={load}>刷新看板</Button>} />
      <div className="ops-kanban-head"><div><span>待调度需求</span><b>{demands.length}</b></div><div><span>可用服务商</span><b>{providers.length}</b></div><div><span>履约中工单</span><b>{orders.length}</b></div><div><span>平均响应</span><b>6.8<small>分钟</small></b></div></div>
      <div className="ops-kanban">
        <section><header><span /><b>待分配需求</b><em>{demands.length}</em></header>{demands.map((demand) => <article key={demand.id}><div><Tag color="orange">{demand.category}</Tag><small>{demand.preferredDate}</small></div><b>{demand.serviceName}</b><p>{demand.description}</p><footer><span>{demand.location} · {demand.area}<br />¥{demand.budgetMin}-{demand.budgetMax}</span><Button size="small" type="primary" onClick={() => { setTarget(demand); setProviderId(providers[0]?.id) }}>指派</Button></footer></article>)}</section>
        <section><header><span /><b>可调度服务能力</b><em>{providers.length}</em></header>{providers.map((provider) => <article key={provider.id}><div><Tag color="green">{provider.category}</Tag><small>{provider.region}</small></div><b>{provider.name}</b><p>★ {provider.rating} · 信用 {provider.creditScore} · {provider.cancelRate}% 取消率</p><footer><span>¥{provider.price}/{provider.unit.replace('元/', '')}</span><Button size="small" onClick={() => go('provider-detail', provider.id)}>档案</Button></footer></article>)}</section>
        <section><header><span /><b>履约与风险工单</b><em>{orders.length}</em></header>{orders.map((order) => <article key={order.id} className={order.riskFlag ? 'risk' : ''}><div><Tag color={order.riskFlag ? 'red' : 'blue'}>{order.category}</Tag><small>{order.appointmentDate}</small></div><b>{order.serviceName}</b><p>{order.providerName} · {order.location}</p>{order.riskFlag && <em className="risk-flag">{order.riskFlag}</em>}<footer><span>进度 {order.progress}%</span><Button size="small" onClick={() => go('orders')}>处理</Button></footer></article>)}</section>
      </div>
      <Modal title="指派服务商" open={Boolean(target)} onCancel={() => setTarget(null)} onOk={() => void assign()} okText="确认指派"><div className="ops-review-summary"><b>{target?.serviceName}</b><span>{target?.location} · {target?.area} · ¥{target?.budgetMin}-{target?.budgetMax}</span></div><Form layout="vertical"><Form.Item label="服务商"><Select value={providerId} onChange={setProviderId} options={providers.map((provider) => ({ value: provider.id, label: `${provider.name} · 信用 ${provider.creditScore} · ★${provider.rating}` }))} /></Form.Item></Form><div className="ops-notice">确认后将自动生成服务工单，并通知服务商和需求方。</div></Modal>
    </div>
  )
}

function DisputesPage(): JSX.Element {
  const { message } = AntApp.useApp()
  const [items, setItems] = useState<Complaint[]>([])
  const [target, setTarget] = useState<Complaint | null>(null)
  const [resolution, setResolution] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const load = (): void => { opsApi.complaints().then(setItems).catch((error: Error) => message.error(error.message)) }
  useEffect(load, [])
  const resolve = async (): Promise<void> => {
    if (!target) return
    if (!resolution.trim()) {
      message.warning('请填写处理结论，这段文字会原样通知投诉方')
      return
    }
    setSubmitting(true)
    try {
      // 处理人由后端从令牌取，前端不再自称某个仲裁员
      await opsApi.resolveComplaint(target.id, { status: 'resolved', resolution })
      setTarget(null)
      message.success('投诉已办结，处理人取当前登录账号')
      load()
    } catch (error) { message.error(error instanceof Error ? error.message : '处理失败') }
    finally { setSubmitting(false) }
  }
  return (
    <div className="ops-page">
      <PageTitle title="投诉与仲裁" description="集中处理服务时效、作业质量、结算争议与赔付事项。" />
      <div className="ops-dispute-grid">
        {items.map((item) => <section className="ops-card" key={item.id}><div className="ops-card-head"><div><b>{item.complaintNo}</b><small>{item.orderNo} · {item.category}</small></div><Tag color={item.status === 'resolved' ? 'green' : 'orange'}>{item.status === 'resolved' ? '已办结' : '处理中'}</Tag></div><p className="ops-dispute-desc">{item.description}</p><div className="ops-demand-box"><small>用户诉求</small><b>{item.demand || '未填写'}</b></div><Progress percent={item.progress} showInfo={false} strokeColor="#159a5e" />{item.resolution && <div className="ops-demand-box"><small>处理结论</small><b>{item.resolution}</b></div>}<footer><span>{item.handler ?? '待分配'} · {item.createdAt}</span>{item.status !== 'resolved' && <Button type="primary" size="small" onClick={() => { setTarget(item); setResolution('') }}>处理工单</Button>}</footer></section>)}
        {items.length === 0 && <div className="ops-empty">当前没有投诉工单</div>}
      </div>
      <Modal title={`处理投诉 · ${target?.complaintNo ?? ''}`} open={Boolean(target)} onCancel={() => setTarget(null)} onOk={() => void resolve()} confirmLoading={submitting} okText="确认办结">
        <div className="ops-ai-suggestion"><WarningOutlined /><span><b>事实与诉求</b><p>{target?.orderNo}：{target?.description}；诉求「{target?.demand || '未填写'}」。处理结论将作为平台答复发给投诉方，并把处理人记为当前登录账号。</p></span></div>
        <Form layout="vertical"><Form.Item label="处理结论" required><Input.TextArea rows={5} value={resolution} onChange={(event) => setResolution(event.target.value)} placeholder="例如：安排服务商补收漏作业 0.8 亩，并按合同核减作业费用 ¥48" /></Form.Item></Form>
      </Modal>
    </div>
  )
}

function QualityPage(): JSX.Element {
  const { message } = AntApp.useApp()
  const [items, setItems] = useState<QualityAlert[]>([])
  const [target, setTarget] = useState<QualityAlert | null>(null)
  const [note, setNote] = useState('')
  const load = (): void => { opsApi.alerts().then(setItems).catch((error: Error) => message.error(error.message)) }
  useEffect(load, [])
  const resolve = async (): Promise<void> => {
    if (!target) return
    if (!note.trim()) {
      message.warning('请填写复核结论，关闭预警要留下依据')
      return
    }
    try {
      await opsApi.resolveAlert(target.id, note)
      setTarget(null)
      message.success('预警已关闭，结论已写入审计日志')
      load()
    } catch (error) { message.error(error instanceof Error ? error.message : '处理失败') }
  }
  return (
    <div className="ops-page">
      <PageTitle title="质量与评价预警" description="基于评分、取消率与投诉真实性的运营风险队列；预警条目由平台规则与人工登记产生。" />
      <div className="ops-quality-list">{items.map((item) => <section className={`ops-quality-alert level-${item.level}`} key={item.id}><span>{item.level === 'high' ? <WarningOutlined /> : <AlertOutlined />}</span><div><div><Tag color={item.level === 'high' ? 'red' : item.level === 'medium' ? 'orange' : 'blue'}>{item.type}</Tag><small>{item.createdAt}</small></div><h3>{item.providerName}</h3><p>{item.content}</p><em>风险分 {item.score}</em></div><div><Tag color={item.status === 'closed' ? 'green' : 'orange'}>{item.status === 'closed' ? '已处理' : item.status === 'processing' ? '跟进中' : '待处理'}</Tag>{item.status !== 'closed' && <><Button size="small" onClick={() => item.providerId && go('provider-detail', item.providerId)}>服务商档案</Button><Button size="small" type="primary" onClick={() => { setTarget(item); setNote('') }}>复核关闭</Button></>}</div></section>)}</div>
      {items.length === 0 && <div className="ops-empty">当前没有质量预警</div>}
      <Modal title={`复核预警 · ${target?.providerName ?? ''}`} open={Boolean(target)} onCancel={() => setTarget(null)} onOk={() => void resolve()} okText="确认关闭">
        <div className="ops-ai-suggestion"><WarningOutlined /><span><b>{target?.type}</b><p>{target?.content}</p></span></div>
        <Form layout="vertical"><Form.Item label="复核结论" required><Input.TextArea rows={4} value={note} onChange={(event) => setNote(event.target.value)} placeholder="例如：已电话核实机手排班，取消率因天气导致，恢复观察 7 天" /></Form.Item></Form>
      </Modal>
    </div>
  )
}

function PoliciesPage(): JSX.Element {
  const { message } = AntApp.useApp()
  const [items, setItems] = useState<PolicyApplication[]>([])
  const [target, setTarget] = useState<PolicyApplication | null>(null)
  const [status, setStatus] = useState('town_review')
  const [note, setNote] = useState('材料完整，进入下一审核节点')
  const load = (): void => { opsApi.policies().then(setItems).catch((error: Error) => message.error(error.message)) }
  useEffect(load, [])
  const submit = async (): Promise<void> => {
    if (!target) return
    try { await opsApi.reviewPolicy(target.id, { status, note }); setTarget(null); message.success('政策审核节点已更新'); load() }
    catch (error) { message.error(error instanceof Error ? error.message : '审核失败') }
  }
  return (
    <div className="ops-page">
      <PageTitle title="政策项目运营" description="匹配结果、主体资格、材料核验与补贴兑付进度。" />
      <section className="ops-card ops-table-card"><Table<PolicyApplication> rowKey="id" dataSource={items} pagination={false} columns={[
        { title: '申报单', dataIndex: 'applicationNo', render: (_, row) => <div className="ops-table-entity"><b>{row.applicationNo}</b><small>{row.policyTitle}</small></div> },
        { title: '申报主体', dataIndex: 'applicant' },
        { title: '预计金额', dataIndex: 'amountText', render: (value) => <b>{value}</b> },
        { title: '进度', render: (_, row) => <Progress percent={row.progress} size="small" strokeColor="#159a5e" /> },
        { title: '状态', dataIndex: 'status', render: (value) => <Status status={value} labels={POLICY_STATUS} /> },
        { title: '提交时间', dataIndex: 'submittedAt' },
        { title: '操作', render: (_, row) => <Button type="link" onClick={() => { setTarget(row); setStatus(row.status === 'town_review' ? 'county_review' : 'paid'); setNote('材料完整，审核通过') }}>审核 / 兑付</Button> },
      ]} /></section>
      <Modal title="政策申报审核" open={Boolean(target)} onCancel={() => setTarget(null)} onOk={() => void submit()} okText="确认更新"><div className="ops-review-summary"><b>{target?.policyTitle}</b><span>{target?.applicant} · {target?.amountText}</span></div><Form layout="vertical"><Form.Item label="审核节点"><Select value={status} onChange={setStatus} options={Object.entries(POLICY_STATUS).map(([value, item]) => ({ value, label: item.label }))} /></Form.Item><Form.Item label="审核意见"><Input.TextArea rows={3} value={note} onChange={(event) => setNote(event.target.value)} /></Form.Item></Form><div className="ops-notice warn">标记为已兑付属于资金状态变更，正式环境应接入双人复核。</div></Modal>
    </div>
  )
}

function InsurancePage(): JSX.Element {
  const { message } = AntApp.useApp()
  const [items, setItems] = useState<InsuranceClaim[]>([])
  const [target, setTarget] = useState<InsuranceClaim | null>(null)
  const [status, setStatus] = useState('surveying')
  const [note, setNote] = useState('查勘员已安排现场查勘')
  const load = (): void => { opsApi.claims().then(setItems).catch((error: Error) => message.error(error.message)) }
  useEffect(load, [])
  const submit = async (): Promise<void> => {
    if (!target) return
    try { await opsApi.reviewClaim(target.id, { status, note }); setTarget(null); message.success('理赔节点已更新'); load() }
    catch (error) { message.error(error instanceof Error ? error.message : '更新失败') }
  }
  return (
    <div className="ops-page">
      <PageTitle title="农险理赔运营" description="跟进报案、查勘、定损、公示与赔付节点；节点推进受状态机约束，不能跳步。" actions={<Button onClick={() => {
        if (items.length === 0) { message.warning('当前没有理赔案件'); return }
        downloadCsv([
          ['案件号', '保单号', '灾害类型', '受灾面积', '状态', '进度', '报案时间', '说明'],
          ...items.map((row) => [row.claimNo, row.policyNo, row.disasterType, row.lossArea, row.status, `${row.progress}%`, row.createdAt, row.description]),
        ], `insurance-claims-${todayStamp()}.csv`)
        message.success(`已导出 ${items.length} 条理赔案件`)
      }}>导出理赔清单</Button>} />
      <div className="ops-claim-grid">{items.map((claim) => <section className="ops-card" key={claim.id}><div className="ops-card-head"><div><b>{claim.disasterType}</b><small>{claim.claimNo} · {claim.policyNo}</small></div><Tag color={claim.status === 'paid' ? 'green' : 'orange'}>{claim.status === 'paid' ? '已赔付' : '处理中'}</Tag></div><p>{claim.description}</p><div className="ops-claim-meta"><span><small>受灾面积</small><b>{claim.lossArea}</b></span><span><small>报案时间</small><b>{claim.createdAt}</b></span></div><Progress percent={claim.progress} showInfo={false} strokeColor="#159a5e" /><footer><Button type="primary" size="small" onClick={() => { setTarget(claim); setStatus('assessing'); setNote('查勘完成，进入定损核算') }}>更新理赔进度</Button></footer></section>)}</div>
      <Modal title="更新理赔进度" open={Boolean(target)} onCancel={() => setTarget(null)} onOk={() => void submit()} okText="保存"><Form layout="vertical"><Form.Item label="案件节点"><Select value={status} onChange={setStatus} options={[['submitted','已报案'],['surveying','查勘中'],['assessing','定损中'],['publicity','公示中'],['paid','已赔付'],['rejected','已驳回']].map(([value, label]) => ({ value, label }))} /></Form.Item><Form.Item label="处理说明"><Input.TextArea rows={4} value={note} onChange={(event) => setNote(event.target.value)} /></Form.Item></Form></Modal>
    </div>
  )
}

function SettlementPage(): JSX.Element {
  const { message } = AntApp.useApp()
  const [items, setItems] = useState<Settlement[]>([])
  const [target, setTarget] = useState<Settlement | null>(null)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const load = (): void => { opsApi.settlements().then(setItems).catch((error: Error) => message.error(error.message)) }
  useEffect(load, [])
  const approve = async (): Promise<void> => {
    if (!target) return
    if (!note.trim()) {
      message.warning('请填写复核说明，复核结论要能追溯到依据')
      return
    }
    setSubmitting(true)
    try {
      // 复核人由后端从令牌取，前端不再自称某个结算专员
      await opsApi.reviewSettlement(target.id, { status: 'approved', note })
      setTarget(null)
      message.success('批次复核已保存，复核人记为当前登录账号')
      load()
    } catch (error) { message.error(error instanceof Error ? error.message : '复核失败') }
    finally { setSubmitting(false) }
  }
  return (
    <div className="ops-page">
      <PageTitle title="结算与分账" description="按批次复核交易额与佣金；本版本只落复核结论，不执行真实资金动作。" actions={<Button onClick={() => load()}>重新拉取批次</Button>} />
      <section className="ops-card ops-table-card"><Table<Settlement> rowKey="id" dataSource={items} pagination={false} columns={[
        { title: '批次', dataIndex: 'batchNo', render: (_, row) => <div className="ops-table-entity"><b>{row.batchNo}</b><small>{row.period}</small></div> },
        { title: '订单数', dataIndex: 'orderCount', render: (value) => Number(value).toLocaleString() },
        { title: '交易金额', dataIndex: 'amount', render: (value) => <b>¥{Number(value).toLocaleString()}</b> },
        { title: '平台佣金', dataIndex: 'commission', render: (value) => `¥${Number(value).toLocaleString()}` },
        { title: '状态', dataIndex: 'status', render: (value) => <Tag color={value === 'approved' ? 'green' : 'orange'}>{value === 'approved' ? '已复核' : '待复核'}</Tag> },
        { title: '复核人', render: (_, row) => row.reviewedBy ?? '—' },
        { title: '操作', render: (_, row) => row.status === 'pending' ? <Button type="link" onClick={() => { setTarget(row); setNote('') }}>复核</Button> : <span className="muted">{row.reviewedAt}</span> },
      ]} /></section>
      <Modal title="结算批次复核" open={Boolean(target)} onCancel={() => setTarget(null)} onOk={() => void approve()} confirmLoading={submitting} okText="复核通过"><div className="ops-settlement-summary"><div><small>批次</small><b>{target?.batchNo}</b></div><div><small>订单</small><b>{target?.orderCount}</b></div><div><small>交易额</small><b>¥{target?.amount.toLocaleString()}</b></div><div><small>佣金</small><b>¥{target?.commission.toLocaleString()}</b></div></div><div className="ops-notice warn">本版本只记录复核结论与复核人，不触发真实打款；同一批次不能重复复核。</div><Form layout="vertical"><Form.Item label="复核说明" required><Input.TextArea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="例如：抽查 20 笔已验收，差异 0，佣金按 1% 计提" /></Form.Item></Form></Modal>
    </div>
  )
}

function AiPage(): JSX.Element {
  const { message } = AntApp.useApp()
  const [items, setItems] = useState<Strategy[]>([])
  const [editing, setEditing] = useState<Strategy | null>(null)
  const [value, setValue] = useState('')
  const load = (): void => { opsApi.strategies().then(setItems).catch((error: Error) => message.error(error.message)) }
  useEffect(load, [])
  const submit = async (): Promise<void> => {
    if (!editing) return
    try { setItems(await opsApi.updateStrategy(editing.key, value)); setEditing(null); message.success('策略参数已发布') }
    catch (error) { message.error(error instanceof Error ? error.message : '发布失败') }
  }
  return (
    <div className="ops-page">
      <PageTitle title="匹配与自动化策略" description="撮合权重与自动派单规则的真实配置项；改动即时生效并写入审计日志。" actions={<Tag color="blue">共 {items.length} 项参数</Tag>} />
      <section className="ops-ai-hero">
        <span><RobotOutlined /></span>
        <div>
          <small>MATCHING CONFIG</small>
          <h2>当前撮合口径</h2>
          <p>{items.filter((item) => item.key.includes('weight')).map((item) => `${item.label} ${item.value}`).join(' · ') || '尚未配置匹配权重'}</p>
        </div>
        <div><b>{items.find((item) => item.key === 'auto_dispatch')?.value === 'enabled' ? '已开启' : '未开启'}</b><small>自动派单</small></div>
      </section>
      <div className="ops-strategy-grid">{items.map((item) => <section className="ops-card ops-strategy" key={item.key}><div><span><ThunderboltOutlined /></span><small>{item.key.includes('weight') ? '匹配权重' : '自动化规则'}</small></div><h3>{item.label}</h3><b>{item.value}</b><p>{item.description}</p><footer><small>更新于 {item.updatedAt}</small><Button size="small" onClick={() => { setEditing(item); setValue(item.value) }}>调整</Button></footer></section>)}</div>
      {items.length === 0 && <div className="ops-empty">策略表为空，请先在服务域初始化 service_strategy 配置</div>}
      <Modal title={`调整策略 · ${editing?.label ?? ''}`} open={Boolean(editing)} onCancel={() => setEditing(null)} onOk={() => void submit()} okText="保存参数">
        <Form layout="vertical"><Form.Item label="参数值"><Input value={value} onChange={(event) => setValue(event.target.value)} /></Form.Item></Form>
        <div className="ops-notice">保存后立刻影响需求撮合口径；本版本没有 A/B 分流，也没有调用量与命中率统计，请勿据此判断模型效果。</div>
      </Modal>
    </div>
  )
}

function CampaignsPage(): JSX.Element {
  const { message } = AntApp.useApp()
  const [items, setItems] = useState<Campaign[]>([])
  const load = (): void => { opsApi.campaigns().then(setItems).catch((error: Error) => message.error(error.message)) }
  useEffect(load, [])
  const toggle = async (campaign: Campaign): Promise<void> => {
    const next = campaign.status === 'running' ? 'paused' : 'running'
    try { await opsApi.updateCampaign(campaign.id, next); message.success(next === 'running' ? '活动已恢复' : '活动已暂停'); load() }
    catch (error) { message.error(error instanceof Error ? error.message : '操作失败') }
  }
  return (
    <div className="ops-page">
      <PageTitle title="营销与优惠券" description="活动额度与领取进度按平台配置展示；本版本只支持启停，不支持在此新建活动。" actions={<Button onClick={load}>重新拉取活动</Button>} />
      <div className="ops-campaign-grid">{items.map((item) => <section className="ops-card ops-campaign" key={item.id}><div className="ops-card-head"><div><b>{item.name}</b><small>{item.scope}</small></div><Tag color={item.status === 'running' ? 'green' : item.status === 'government' ? 'blue' : 'orange'}>{item.status === 'running' ? '进行中' : item.status === 'government' ? '政府补贴' : item.status === 'scheduled' ? '待开始' : '已暂停'}</Tag></div><div className="ops-campaign-figures"><span><small>领取 / 发放</small><b>{item.claimed.toLocaleString()} / {item.quota.toLocaleString()}</b></span><span><small>预算</small><b>¥{item.budget.toLocaleString()}</b></span></div><Progress percent={item.quota ? Math.round(item.claimed / item.quota * 100) : 0} showInfo={false} strokeColor="#159a5e" /><footer><span>{item.startsAt} 至 {item.endsAt}</span>{item.status !== 'government' && <Button size="small" onClick={() => void toggle(item)}>{item.status === 'running' ? '暂停' : '启用'}</Button>}</footer></section>)}</div>
      {items.length === 0 && <div className="ops-empty">当前没有配置活动</div>}
    </div>
  )
}

function ReportsPage(): JSX.Element {
  const { message } = AntApp.useApp()
  const [data, setData] = useState<{ trend: OpsOverview['trend']; categories: Array<{ category: string; orderCount: number; gmv: number; avgRating: number }>; providers: OpsProvider[] } | null>(null)
  useEffect(() => { opsApi.report().then(setData).catch((error: Error) => message.error(error.message)) }, [message])
  if (!data) return <LoadingBlock />
  const max = Math.max(...data.categories.map((item) => Number(item.gmv)), 1)

  const exportCsv = (): void => {
    const lines = [
      ['品类', '订单数', 'GMV', '平均评分'],
      ...data.categories.map((item) => [item.category, String(item.orderCount), String(item.gmv), String(item.avgRating)]),
      [],
      ['日期', '订单', 'GMV', '服务商数', '投诉数'],
      ...data.trend.map((item) => [item.date, String(item.orders), String(item.gmv), String(item.providers), String(item.complaints)]),
    ]
    const body = lines.filter((row) => row.length > 0)
      .map((cells) => cells.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([`﻿${body}`], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `service-report-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    message.success(`已导出 ${data.categories.length} 个品类与 ${data.trend.length} 天趋势`)
  }
  return (
    <div className="ops-page">
      <PageTitle title="数据报表中心" description="交易规模、品类结构、服务商经营与区域供给运营报表。" actions={<Button type="primary" onClick={exportCsv}>导出经营报表</Button>} />
      <div className="ops-report-grid">
        <section className="ops-card"><div className="ops-card-head"><div><b>品类 GMV 结构</b><small>按订单金额</small></div></div><div className="ops-horizontal-bars">{data.categories.map((item) => <div key={item.category}><span>{item.category}</span><div><i style={{ width: `${Number(item.gmv) / max * 100}%` }} /></div><b>¥{Number(item.gmv).toLocaleString()}</b></div>)}</div></section>
        <section className="ops-card"><div className="ops-card-head"><div><b>订单日趋势</b><small>近 7 日</small></div></div><div className="ops-report-trend">{data.trend.map((item) => <div key={item.date}><i style={{ height: `${item.orders / 260 * 100}%` }} /><span>{item.date.slice(5)}</span><b>{item.orders}</b></div>)}</div></section>
      </div>
      <section className="ops-card ops-table-card"><div className="ops-card-head"><div><b>服务商经营排行</b><small>评分与订单贡献</small></div></div><Table rowKey="id" pagination={false} dataSource={data.providers} columns={[{ title: '服务商', dataIndex: 'name' }, { title: '品类', dataIndex: 'category' }, { title: '订单数', dataIndex: 'orderCount' }, { title: '评分', dataIndex: 'rating', render: (value) => `★ ${value}` }, { title: '信用分', dataIndex: 'creditScore' }, { title: '取消率', dataIndex: 'cancelRate', render: (value) => `${value}%` }]} /></section>
    </div>
  )
}

function TeamPage(): JSX.Element {
  const { message } = AntApp.useApp()
  const [items, setItems] = useState<TeamMember[]>([])
  const [identity, setIdentity] = useState<{ operatorName?: string; operatorRole?: string } | null>(null)
  useEffect(() => {
    opsApi.team().then(setItems).catch((error: Error) => message.error(error.message))
    opsApi.identity().then(setIdentity).catch(() => setIdentity(null))
  }, [message])
  return (
    <div className="ops-page">
      <PageTitle
        title="岗位与权限说明"
        description="这里列出综合服务运营侧的岗位定义；真正的账号与授权在平台管理后台维护，本模块只按令牌判定。"
        actions={<Tag color="blue">当前登录：{identity?.operatorName ?? '解析中…'}{identity?.operatorRole ? ` · ${identity.operatorRole}` : ''}</Tag>}
      />
      <div className="ops-notice">
        运营端接口按平台 RBAC 校验（service:ops 可进运营接口，service:provider 只能进服务商工作台）。
        审核意见、派单说明、投诉结论与结算复核都是必填项，服务端会把操作人与来源 IP 写入审计日志。
      </div>
      <div className="ops-role-grid">{items.map((item) => <section className="ops-card ops-role" key={item.id}><div className="ops-role-head"><Avatar icon={<UserOutlined />} /><div><b>{item.role}</b><span>{item.name} · {item.scope}</span></div><Tag color={item.status === 'active' ? 'green' : 'orange'}>{item.status === 'active' ? '在编' : item.status}</Tag></div><div>{item.permissions.map((permission) => <Tag key={permission}>{permission}</Tag>)}</div></section>)}</div>
      {items.length === 0 && <div className="ops-empty">尚未配置运营岗位</div>}
    </div>
  )
}

function LogsPage(): JSX.Element {
  const { message } = AntApp.useApp()
  const [items, setItems] = useState<OpLog[]>([])
  useEffect(() => { opsApi.logs().then(setItems).catch((error: Error) => message.error(error.message)) }, [message])

  const exportCsv = (): void => {
    if (items.length === 0) {
      message.warning('暂无审计日志可导出')
      return
    }
    const header = ['时间', '操作人', '角色', '动作', '对象', '说明', '来源IP']
    const rows = items.map((row) => [row.createdAt, row.operator, row.role, row.action, row.target, row.detail, row.ip])
    const body = [header, ...rows].map((cells) => cells.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([`﻿${body}`], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `service-op-log-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    message.success(`已导出 ${items.length} 条审计日志`)
  }

  return (
    <div className="ops-page">
      <PageTitle title="操作审计日志" description="审核、派单、仲裁、政策与结算等敏感操作留痕；操作人与来源 IP 均由服务端从访问令牌和请求头解析。" actions={<Button onClick={exportCsv}>导出当前日志</Button>} />
      <section className="ops-card ops-table-card"><Table rowKey="id" dataSource={items} pagination={{ pageSize: 10 }} columns={[
        { title: '时间', dataIndex: 'createdAt' },
        { title: '操作人', render: (_, row: OpLog) => <div className="ops-table-entity"><b>{row.operator}</b><small>{row.role}</small></div> },
        { title: '动作', dataIndex: 'action', render: (value) => <Tag>{value}</Tag> },
        { title: '对象', dataIndex: 'target' },
        { title: '说明', dataIndex: 'detail', ellipsis: true },
        { title: '来源 IP', dataIndex: 'ip' },
      ]} /></section>
    </div>
  )
}

export function App(): JSX.Element {
  const { user } = useUnifiedUser()
  const [route, setRoute] = useState<Route>(parseRoute)
  const [collapsed, setCollapsed] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [pendingTodos, setPendingTodos] = useState<Array<{ title: string; count: number }>>([])
  const displayName = user.nickname || user.username
  const todayText = useMemo(() => {
    const now = new Date()
    const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()]
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${weekday}`
  }, [route.page])
  useEffect(() => {
    opsApi.overview()
      .then((data) => setPendingTodos(data.todos))
      .catch(() => setPendingTodos([]))
  }, [route.page])
  useEffect(() => {
    const onChange = (): void => { setRoute(parseRoute()); window.scrollTo({ top: 0 }) }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  const content = useMemo(() => {
    switch (route.page) {
      case 'providers': return <ProvidersPage />
      case 'provider-detail': return <ProviderDetailPage />
      case 'catalog': return <CatalogPage />
      case 'orders': return <OrdersPage />
      case 'dispatch': return <DispatchPage />
      case 'disputes': return <DisputesPage />
      case 'quality': return <QualityPage />
      case 'policies': return <PoliciesPage />
      case 'insurance': return <InsurancePage />
      case 'settlement': return <SettlementPage />
      case 'ai': return <AiPage />
      case 'campaigns': return <CampaignsPage />
      case 'reports': return <ReportsPage />
      case 'team': return <TeamPage />
      case 'logs': return <LogsPage />
      default: return <DashboardPage />
    }
  }, [route.page])
  return (
    <div className={`ops-shell${collapsed ? ' collapsed' : ''}`}>
      <aside className="ops-sidebar">
        <button type="button" className="ops-brand" onClick={() => go('dashboard')}><img className="ops-brand-logo" src={`${import.meta.env.BASE_URL}fengchain.svg`} alt="丰链云" />{!collapsed && <div><b>丰链云</b><small>FENGCHAIN · AGRI</small></div>}</button>
        <nav>{NAV.map((group) => <section key={group.group}>{!collapsed && <h3>{group.group}</h3>}{group.items.map((item) => <button type="button" key={item.page} className={route.page === item.page ? 'on' : ''} onClick={() => go(item.page)} title={item.label}>{item.icon}{!collapsed && <span>{item.label}</span>}</button>)}</section>)}</nav>
        <div className="ops-side-foot">{!collapsed && <div><b>运营值守</b><small>今日 09:00-21:00</small></div>}<button type="button" onClick={() => setCollapsed(!collapsed)}>{collapsed ? <MenuUnfoldOutlined /> : <><MenuFoldOutlined /> 收起导航</>}</button></div>
      </aside>
      <div className="ops-main">
        <header className="ops-header">
          <div><span>综合服务</span><b>/</b><strong>{TITLES[route.page]}</strong></div>
          <form onSubmit={(event) => { event.preventDefault(); if (keyword.trim()) go('providers') }}><SearchOutlined /><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索服务商 / 订单 / 工单号" /></form>
          <div className="ops-header-right"><span className="ops-date">{todayText}</span><button type="button" className="ops-bell" onClick={() => go('dispatch')} title="待办事项"><Badge count={pendingTodos.reduce((sum, item) => sum + Number(item.count || 0), 0)} size="small"><BellOutlined /></Badge></button><Dropdown menu={{ items: [{ key: 'team', label: '岗位与权限', onClick: () => go('team') }, { key: 'logs', label: '操作审计', onClick: () => go('logs') }, { key: 'logout', label: '退出统一登录', onClick: () => void logoutUnified('service-ops') }] }}><button type="button" className="ops-user"><Avatar size={30} className="ops-avatar">{displayName.slice(0, 1)}</Avatar><span><b>{displayName}</b><small>统一账号 · 运营端</small></span></button></Dropdown></div>
        </header>
        <main>{content}</main>
      </div>
    </div>
  )
}
