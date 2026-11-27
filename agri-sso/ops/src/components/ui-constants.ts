export const STATUS_MAP: Record<string, { label: string; tone: string }> = {
  pending: { label: '待审核', tone: 'amber' },
  submitted: { label: '已提交', tone: 'amber' },
  reviewing: { label: '审核中', tone: 'amber' },
  processing: { label: '处理中', tone: 'amber' },
  approved: { label: '已通过', tone: 'green' },
  rejected: { label: '已驳回', tone: 'up' },
  cancelled: { label: '已取消', tone: 'default' },
  completed: { label: '已完成', tone: 'green' },
  verified: { label: '已实名', tone: 'green' },
  none: { label: '未实名', tone: 'default' },
  unverified: { label: '未实名', tone: 'default' },
  frozen: { label: '已冻结', tone: 'up' },
  unfrozen: { label: '已解封', tone: 'green' },
  appealing: { label: '申诉中', tone: 'amber' },
  accepted: { label: '申诉受理', tone: 'purple' },
  online: { label: '已上架', tone: 'green' },
  offline: { label: '已下架', tone: 'default' },
  enabled: { label: '启用', tone: 'green' },
  disabled: { label: '停用', tone: 'default' },
  draft: { label: '未提交', tone: 'default' },
  queued: { label: '待投递', tone: 'amber' },
  sending: { label: '发送中', tone: 'amber' },
  sent: { label: '已发送', tone: 'green' },
  failed: { label: '失败', tone: 'up' },
  success: { label: '成功', tone: 'green' },
  fail: { label: '失败', tone: 'up' },
  replied: { label: '已回复', tone: 'green' },
  closed: { label: '已关闭', tone: 'default' },
}

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

export const IDENTITY_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'wholesaler', label: '批发商' },
  { value: 'retailer', label: '零售商' },
  { value: 'farmer', label: '农户' },
  { value: 'coop_admin', label: '合作社管理员' },
  { value: 'mall_supplier', label: '商城供应商' },
  { value: 'service_provider', label: '服务商' },
  { value: 'government', label: '政府人员' },
]

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
  ENTERPRISE: '农业企业',
  MERCHANT: '经营主体',
  BUYER: '采购主体',
  SELLER: '销售主体',
  SUPPLIER: '供应主体',
  BOTH: '购销一体主体',
  PROVIDER: '服务商主体',
  BANK: '金融机构',
  GOVERNMENT: '监管机构',
  INDIVIDUAL: '个人主体',
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

export function formatTime(value?: string | null): string {
  if (!value) return '—'
  const normalized = value.replace('T', ' ')
  return normalized.length >= 16 ? normalized.slice(0, 16) : normalized
}

export function formatDate(value?: string | null): string {
  if (!value) return '—'
  return value.replace('T', ' ').slice(0, 10)
}

export function formatMillis(value?: string | number | null): string {
  if (value === null || value === undefined || value === '') return '—'
  const millis = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(millis) || millis <= 0) return String(value)
  const date = new Date(millis)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function formatCount(value: number): string {
  if (value >= 10000) return `${(value / 10000).toFixed(1)}万`
  return String(value)
}

export interface Series {
  name: string
  color: string
  values: number[]
}
