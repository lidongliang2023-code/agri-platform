import type { ReactNode } from 'react'
import { ArrowRightOutlined } from '@ant-design/icons'
import { Button, Tag } from 'antd'

export function PageTitle({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}): JSX.Element {
  return (
    <div className="page-title-row">
      <div>
        {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  )
}

export function SectionHeading({
  kicker,
  title,
  action,
  onAction,
}: {
  kicker?: string
  title: string
  action?: string
  onAction?: () => void
}): JSX.Element {
  return (
    <div className="section-heading compact">
      <div>
        {kicker && <span className="section-kicker">{kicker}</span>}
        <h2>{title}</h2>
      </div>
      {action && onAction && (
        <button type="button" onClick={onAction}>{action} <ArrowRightOutlined /></button>
      )}
    </div>
  )
}

export function StatTile({
  label,
  value,
  unit,
  note,
  tone = 'default',
}: {
  label: string
  value: string | number
  unit?: string
  note?: ReactNode
  tone?: string
}): JSX.Element {
  return (
    <div className={`stat-tile tone-${tone}`}>
      <span className="stat-label">{label}</span>
      <b className="stat-value">{value}{unit && <small>{unit}</small>}</b>
      {note && <span className="stat-note">{note}</span>}
    </div>
  )
}

/**
 * 状态标签。
 *
 * <p>用户中心的状态词比资讯模块多得多（pending / approved / rejected / frozen / unfrozen /
 * appealed …），统一在这里映射，避免每个页面各写一套 if-else 导致同一个状态两种颜色。</p>
 */
const STATUS_MAP: Record<string, { label: string; tone: string }> = {
  // 通用单据
  pending: { label: '待审核', tone: 'amber' },
  submitted: { label: '已提交', tone: 'amber' },
  reviewing: { label: '审核中', tone: 'amber' },
  processing: { label: '处理中', tone: 'amber' },
  approved: { label: '已通过', tone: 'green' },
  rejected: { label: '已驳回', tone: 'up' },
  cancelled: { label: '已取消', tone: 'default' },
  completed: { label: '已完成', tone: 'green' },
  // 实名 / 身份。注意：通过态的值是 verified，不是 approved ——
  // 数据库里 platform_user_identity.status 实际取值是 draft / pending / verified / rejected。
  verified: { label: '已实名', tone: 'green' },
  none: { label: '未实名', tone: 'default' },
  unverified: { label: '未实名', tone: 'default' },
  // 账号
  frozen: { label: '已冻结', tone: 'up' },
  unfrozen: { label: '已解封', tone: 'green' },
  appealing: { label: '申诉中', tone: 'amber' },
  accepted: { label: '申诉受理', tone: 'purple' },
  // 应用 / 模板
  online: { label: '已上架', tone: 'green' },
  offline: { label: '已下架', tone: 'default' },
  enabled: { label: '启用', tone: 'green' },
  disabled: { label: '停用', tone: 'default' },
  // 推送
  draft: { label: '未提交', tone: 'default' },
  queued: { label: '待投递', tone: 'amber' },
  sending: { label: '发送中', tone: 'amber' },
  sent: { label: '已发送', tone: 'green' },
  failed: { label: '失败', tone: 'up' },
  // 日志
  success: { label: '成功', tone: 'green' },
  fail: { label: '失败', tone: 'up' },
  // 反馈
  replied: { label: '已回复', tone: 'green' },
  closed: { label: '已关闭', tone: 'default' },
}

export function StatusTag({ status }: { status?: string | null }): JSX.Element {
  const key = status ?? 'none'
  const hit = STATUS_MAP[key] ?? { label: key || '—', tone: 'default' }
  return <Tag className={`soft-tag tone-${hit.tone}`}>{hit.label}</Tag>
}

/** 身份类型的中文名。后端存的是角色码，界面要给人看的词。 */
export const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: '超级管理员',
  MARKET_OPS: '市场运营',
  FARMER: '农户',
  farm_owner: '农场主',
  tenant_admin: '租户管理员',
  farm_manager: '农场管理员',
  agronomist: '农艺师',
  worker: '作业员工',
  finance: '财务人员',
  S2B2C_SUPPLIER: '供应商',
  S2B2C_CHANNEL: '渠道商',
  FINANCE_FUND: '资金方',
  SERVICE_PROVIDER: '服务商',
  GOVERNMENT_INSPECTOR: '监管执法',
}

/**
 * 身份申请单的业务身份码 → 中文名。
 *
 * <p>同一张 `platform_identity_application` 表里，用户端申请写的是小写业务码
 * （wholesaler / coop_admin …），而历史种子与联调脚本写的是大写枚举
 * （WHOLESALER / PURCHASER …）。早期这里是大小写敏感的直接查表，且漏了
 * COOP_ADMIN / MALL_SUPPLIER，导致「申请身份」列落回原始枚举码；值为空时
 * 连兜底文案都没有，直接渲染成空白。统一按大写归一后再查表即可兼容两种写法。</p>
 */
export const IDENTITY_TYPE_LABEL: Record<string, string> = {
  PURCHASER: '收购商',
  WHOLESALER: '批发商',
  RETAILER: '零售商',
  FARMER: '农户',
  COOP_ADMIN: '合作社管理员',
  MALL_SUPPLIER: '商城供应商',
  SERVICE_PROVIDER: '服务商',
  GOVERNMENT: '政府人员',
}

/** 身份筛选下拉的可选项：值用后端写入的小写业务码，后端按大小写兼容匹配。 */
export const IDENTITY_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'wholesaler', label: '批发商' },
  { value: 'retailer', label: '零售商' },
  { value: 'farmer', label: '农户' },
  { value: 'coop_admin', label: '合作社管理员' },
  { value: 'mall_supplier', label: '商城供应商' },
  { value: 'service_provider', label: '服务商' },
  { value: 'government', label: '政府人员' },
]

/** 身份码转中文名：大小写无关，空值给「—」，未知码保留原值便于排查。 */
export function identityTypeText(code?: string | null): string {
  if (!code) return '—'
  const key = code.trim().toUpperCase()
  return IDENTITY_TYPE_LABEL[key] ?? code
}

export const FREEZE_TYPE_LABEL: Record<string, string> = {
  risk: '风控冻结',
  violation: '违规冻结',
  judicial: '司法协查',
  cancel: '申请注销',
}

export const ORG_TYPE_LABEL: Record<string, string> = {
  FARM: '生产主体',
  FARMER: '生产主体',
  COOP: '专业合作社',
  COMPANY: '企业',
  MERCHANT: '经营主体',
  BUYER: '采购主体',
}

export const AUDIENCE_LABEL: Record<string, string> = {
  all: '全部用户',
  realname: '已实名用户',
  enterprise: '企业账号',
  wholesaler: '批发商身份',
  inactive: '30 日未登录',
  cert_expiring: '资质临期',
}

export const SCENE_LABEL: Record<string, string> = {
  cert_audit: '认证审核',
  security: '安全提醒',
  cert_expire: '资质临期',
  identity: '身份变更',
  privacy: '隐私请求',
}

export const CHANNEL_LABEL: Record<string, string> = {
  station: '站内信',
  wechat: '微信服务通知',
  sms: '短信',
  app: 'APP 推送',
}

export function channelText(channels?: string | null): string {
  if (!channels) return '—'
  return channels
    .split(',')
    .map((item) => CHANNEL_LABEL[item.trim()] ?? item.trim())
    .filter(Boolean)
    .join(' + ')
}

export function roleText(code?: string | null): string {
  if (!code) return '—'
  return ROLE_LABEL[code] ?? code
}

/** 时间格式化：后端给的是 ISO 字符串（可能带 T），列表里统一成 yyyy-MM-dd HH:mm。 */
export function formatTime(value?: string | null): string {
  if (!value) return '—'
  const normalized = value.replace('T', ' ')
  return normalized.length >= 16 ? normalized.slice(0, 16) : normalized
}

export function formatDate(value?: string | null): string {
  if (!value) return '—'
  return value.replace('T', ' ').slice(0, 10)
}

/**
 * 会话时间格式化。
 *
 * <p>SSO 会话存在 Redis 里，时间只存了 epoch 毫秒（不是 ISO 字符串），
 * 而核心平台又把 Long 序列化成字符串 —— 于是前端拿到的是 "1793230971215"。
 * 直接丢给 {@link formatTime} 会原样显示一串数字，所以单独处理。</p>
 */
export function formatMillis(value?: string | number | null): string {
  if (value === null || value === undefined || value === '') return '—'
  const millis = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(millis) || millis <= 0) return String(value)
  const date = new Date(millis)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
    + `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function formatCount(value: number): string {
  if (value >= 10000) return `${(value / 10000).toFixed(1)}万`
  return String(value)
}

/**
 * 多序列折线图。
 *
 * <p>不引图表库：这个运营端只有两三个地方要画趋势，为它加 echarts 会让产物多 1MB，
 * 而 SVG 手画几十行就够，还能直接套主题色变量。</p>
 */
export interface Series {
  name: string
  color: string
  values: number[]
}

export function LineChart({
  labels,
  series,
  height = 220,
}: {
  labels: string[]
  series: Series[]
  height?: number
}): JSX.Element {
  if (!labels.length || !series.length) {
    return <div className="chart-empty">暂无趋势数据</div>
  }
  const width = 760
  const padding = { top: 18, right: 18, bottom: 28, left: 44 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const max = Math.max(...series.flatMap((item) => item.values), 1)
  const stepX = plotWidth / Math.max(labels.length - 1, 1)
  const labelStep = Math.max(Math.ceil(labels.length / 8), 1)

  const pathOf = (values: number[]): string =>
    values
      .map((value, index) => {
        const x = padding.left + stepX * index
        const y = padding.top + plotHeight - (value / max) * plotHeight
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')

  return (
    <>
      <svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="趋势图">
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
          <line
            key={ratio}
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + plotHeight * ratio}
            y2={padding.top + plotHeight * ratio}
            className="chart-grid"
          />
        ))}
        {series.map((item) => (
          <path key={item.name} d={pathOf(item.values)} fill="none" stroke={item.color} strokeWidth="2" />
        ))}
        {labels.map((label, index) =>
          // 末尾强制画一个"最新日期"，但倒数第二个步进标签若挨得太近就跳过 ——
          // 否则 30 天区间会出现「10-28」「10-29」两个数字叠在一起。
          (index % labelStep === 0 && index < labels.length - 1 - Math.max(1, Math.floor(labelStep / 2)))
          || index === labels.length - 1 ? (
            <text
              key={label}
              x={padding.left + stepX * index}
              y={height - 8}
              textAnchor="middle"
              className="chart-axis"
            >
              {label.slice(5)}
            </text>
          ) : null,
        )}
      </svg>
      <div className="chart-legend">
        {series.map((item) => (
          <span key={item.name}><i style={{ background: item.color }} />{item.name}</span>
        ))}
      </div>
    </>
  )
}

/** 横向条形：用于分布类数据，比饼图更容易读数。 */
export function BarList({
  items,
  max,
}: {
  items: Array<{ label: string; value: number; tone?: string }>
  max?: number
}): JSX.Element {
  const peak = max ?? Math.max(...items.map((item) => item.value), 1)
  if (!items.length) return <div className="chart-empty">暂无数据</div>
  return (
    <div className="stack">
      {items.map((item) => (
        <div className="bar-cell" key={item.label}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="small">{item.label}</span>
            <b className="small">{item.value}</b>
          </div>
          <div className="bar-track">
            <div
              className={`bar-fill ${item.tone ?? ''}`}
              style={{ width: `${Math.max((item.value / peak) * 100, item.value > 0 ? 3 : 0)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export function EmptyState({
  icon = '🗂️',
  title,
  description,
  action,
}: {
  icon?: string
  title: string
  description?: string
  action?: ReactNode
}): JSX.Element {
  return (
    <div className="empty-state">
      <span>{icon}</span>
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {action}
    </div>
  )
}

export function LoadingBlock({ rows = 3 }: { rows?: number }): JSX.Element {
  return (
    <div className="loading-list">
      {Array.from({ length: rows }, (_, index) => (
        <div className="skeleton-card" key={index}><i /><span /><span /></div>
      ))}
    </div>
  )
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }): JSX.Element {
  return (
    <EmptyState
      icon="🛠️"
      title="数据暂时未加载"
      description={message}
      action={<Button type="primary" onClick={onRetry ?? (() => window.location.reload())}>重新加载</Button>}
    />
  )
}
