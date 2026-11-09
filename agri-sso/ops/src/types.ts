/** 用户中心运营端的页面枚举。新增页面必须同时改这里与 AppShell 的 MENU。 */
export type OpsPageKey =
  | 'dashboard'
  | 'user-list'
  | 'user-detail'
  | 'user-identity'
  | 'identity-audit'
  | 'realname-audit'
  | 'qualification-audit'
  | 'org-list'
  | 'org-detail'
  | 'org-audit'
  | 'role-list'
  | 'perm-matrix'
  | 'auth-app'
  | 'auth-record'
  | 'message-push'
  | 'message-template'
  | 'security-risk'
  | 'device-log'
  | 'account-freeze'
  | 'privacy-request'
  | 'feedback-manage'
  | 'stats'
  | 'health-monitor'
  | 'config'
  | 'audit-log'

/** 统一响应：核心平台用 code=0 表示成功（不是 200）。 */
export interface ApiEnvelope<T> {
  code: number
  message: string
  data: T
}

export interface PageResult<T> {
  records: T[]
  total: number
  page: number
  size: number
}

/* ================= 总览 ================= */

export interface DashboardMetrics {
  userTotal: number
  todayNew: number
  identityTotal: number
  identityPending: number
  realnameRate: number
  merchantTotal: number
  merchantCertified: number
  activeUsers: number
  activeRate: number
  frozenCount: number
}

export interface TodoItem {
  key: string
  label: string
  count: number
  route: string
}

export interface TrendSeries {
  labels: string[]
  register: number[]
  realname: number[]
  org: number[]
}

export interface DashboardData {
  metrics: DashboardMetrics
  todos: TodoItem[]
  trend: TrendSeries
  roles: NameCount[]
  orgTypes: TypeCount[]
  identityStatus: StatusCount[]
  updatedAt: string
}

export interface NameCount {
  code: string
  name: string
  c: number
}

export interface TypeCount {
  type: string
  c: number
}

export interface StatusCount {
  status: string
  c: number
}

/* ================= 用户 ================= */

export interface UserRow {
  id: string
  username: string
  nickname: string | null
  phone: string | null
  email: string | null
  status: number
  createdAt: string
  roles: string[]
  realnameStatus: string
  realName: string | null
  orgCount: number
  orgNames: string[]
  frozen: boolean
  freezeType: string | null
}

export interface UserDetailData {
  user: {
    id: string
    username: string
    nickname: string | null
    phone: string | null
    email: string | null
    status: number
    createdAt: string
    updatedAt: string
  }
  roles: Array<{ code: string; name: string; permissions: string }>
  identity: IdentityRecord | null
  orgs: OrgRecord[]
  freeze: FreezeRecord | null
  recentLogs: OperationLog[]
}

/* ================= 会话 ================= */

/** 活跃会话。sessionKey 是 sid 的哈希前缀，不是原始 sid —— 原始 sid 就是登录凭据。 */
export interface SessionRow {
  sessionKey: string
  device: string
  userAgent: string | null
  ip: string | null
  loginAt: string | null
  lastActiveAt?: string | null
  current?: boolean
}

/* ================= 身份 / 实名 ================= */

export interface IdentityRecord {
  id: number | string
  userId: number | string
  realName: string | null
  idNoMasked: string | null
  status: string
  contactPhone: string | null
  address: string | null
  businessType: string | null
  policeVerified: boolean | null
  livenessVerified: boolean | null
  submitTime: string | null
  reviewerName: string | null
  reviewTime: string | null
  reviewRemark: string | null
  createdAt: string | null
}

export interface IdentityPageData {
  distribution: NameCount[]
  page: PageResult<{
    id: string
    userId: string
    username: string | null
    nickname: string | null
    roleCode: string | null
    roleName: string | null
    realnameStatus: string
    orgCount: number
  }>
}

/* ================= 组织 ================= */

export interface OrgRecord {
  id: string | number
  code: string | null
  name: string
  type: string | null
  memberType: string | null
  industry: string | null
  address: string | null
  creditCode: string | null
  contactName: string | null
  contactPhone: string | null
  status: number | null
  verifyStatus: string | null
  verifyTime: string | null
  verifyRemark?: string | null
  createdAt: string | null
  memberCount?: number
}

export interface OrgDetailData {
  org: OrgRecord
  members: Array<{
    userId: string
    username: string | null
    nickname: string | null
    phone: string | null
    roleInMerchant: string | null
    status: number | null
    joinedAt: string | null
  }>
  certifications: CertificationRecord[]
  applications: IdentityApplication[]
}

/* ================= 审核单据 ================= */

export interface IdentityApplication {
  id: number | string
  userId: number | string
  /** 申请人账号昵称（列表接口补的字段，详情可能为空） */
  applicantName?: string | null
  identityType: string
  merchantId: number | string | null
  subjectName: string | null
  creditCode: string | null
  businessPlace: string | null
  businessCategory: string | null
  annualVolume: string | null
  contactName: string | null
  contactPhone: string | null
  applyNote: string | null
  status: string
  reviewerName: string | null
  reviewTime: string | null
  reviewRemark: string | null
  /** 管理端列表接口返回的提交时间 */
  applyTime?: string | null
  /** 组织详情里直接透传实体时返回的创建时间 */
  createdAt?: string | null
}

export interface CertificationRecord {
  id: number | string
  merchantId: number | string
  merchantName: string | null
  certNo: string | null
  companyName: string | null
  creditCode: string | null
  legalPerson: string | null
  contactName: string | null
  contactPhone: string | null
  certStatus: string
  submitTime: string | null
  reviewer: string | null
  reviewTime: string | null
  reviewRemark: string | null
}

export interface PrivacyRecord {
  id: number | string
  userId: number | string
  requestType: string
  reason: string | null
  scope: string | null
  status: string
  handlerName: string | null
  handleTime: string | null
  handleRemark: string | null
  createdAt: string | null
}

export interface FeedbackRecord {
  id: string
  userId: string
  feedbackType: string
  title: string
  content: string | null
  contact: string | null
  pagePath: string | null
  status: string
  replyContent: string | null
  replierName: string | null
  createdAt: string | null
}

/* ================= 角色权限 ================= */

export interface RoleRecord {
  id: number | string
  code: string
  name: string
  /** 角色说明 */
  description?: string | null
  /** enabled / disabled */
  status?: string | null
  permissions: string
  /** 绑定该角色的用户数（列表接口回填） */
  memberCount?: number | null
  createdAt: string | null
  updatedAt?: string | null
}

export interface RolePermissionData {
  code?: string
  name?: string
  permissions: string[]
}

/* ================= 第三方授权 ================= */

export interface ThirdPartyApp {
  id: number | string
  appKey: string
  appName: string
  appType: string
  applicant: string | null
  contactName: string | null
  contactPhone: string | null
  scopes: string | null
  redirectUri: string | null
  status: string
  callCount: number
  lastCallAt: string | null
  reviewerName: string | null
  reviewTime: string | null
  reviewRemark: string | null
  createdAt: string | null
}

export interface AuthRecord {
  id: number | string
  userId: number | string
  userName: string | null
  appId: number | string | null
  appName: string | null
  scopes: string | null
  action: string
  ip: string | null
  createdAt: string | null
}

/* ================= 消息 ================= */

export interface MessageTemplate {
  id: number | string
  code: string
  scene: string
  channels: string | null
  title: string
  content: string | null
  variables: string | null
  status: string
}

export interface PushTask {
  id: number | string
  title: string
  content: string | null
  templateCode: string | null
  audience: string
  channels: string | null
  targetCount: number
  reachCount: number
  openRate: number
  status: string
  sendTime: string | null
  operatorName: string | null
  /** 投递失败原因；status=failed 时有值 */
  failReason?: string | null
}

/* ================= 安全 ================= */

export interface RiskCategory {
  key: string
  label: string
  count: number
  detail: string
}

export interface SecurityRiskData {
  total: number
  handled: number
  pending: number
  categories: RiskCategory[]
  severity: Array<{ level: string; label: string; count: number }>
  topIp: Array<{ ip: string; c: number }>
  trend: { labels: string[]; loginFail: number[] }
}

export interface DeviceLog {
  id: string
  userId: string
  username: string | null
  action: string
  actionLabel: string | null
  ip: string | null
  device: string
  userAgent: string | null
  result: string | null
  createdAt: string | null
}

export interface FreezeRecord {
  id: number | string
  userId: number | string
  username: string | null
  freezeType: string
  reason: string | null
  freezeTime: string | null
  expireTime: string | null
  status: string
  appealStatus: string
  operatorName: string | null
  unfreezeTime: string | null
  /** 用户申诉理由 */
  appealReason?: string | null
  appealTime?: string | null
  appealHandleTime?: string | null
  /** 运营处理意见；驳回理由会展示给用户 */
  appealRemark?: string | null
}

/* ================= 统计 / 配置 / 审计 ================= */

export interface StatsData {
  range: { from: string; to: string; days: number }
  trend: TrendSeries
  summary: { register: number; realname: number; org: number }
  roles: NameCount[]
  orgTypes: TypeCount[]
  orgVerify: StatusCount[]
  regions: Array<{ region: string; c: number }>
}

export interface SystemConfig {
  id: number | string
  configGroup: string
  configKey: string
  label: string | null
  configValue: string | null
  valueType: string
  options: string | null
  remark: string | null
  sortNo: number
}

export interface AuditLog {
  id: string
  operator: string
  action: string
  actionLabel: string | null
  target: string | null
  detail: string | null
  ip: string | null
  result: string | null
  createdAt: string | null
}

export interface OperationLog {
  id: number | string
  action: string
  actionLabel: string | null
  target: string | null
  detail: string | null
  ip: string | null
  result: string | null
  createdAt: string | null
}
