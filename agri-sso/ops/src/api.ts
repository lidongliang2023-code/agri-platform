import axios from 'axios'
import { attachUnifiedAuth } from './sso'
import type {
  ApiEnvelope,
  AuditLog,
  AuthRecord,
  CertificationRecord,
  DashboardData,
  DeviceLog,
  FeedbackRecord,
  FreezeRecord,
  IdentityApplication,
  IdentityPageData,
  IdentityRecord,
  MessageTemplate,
  OrgDetailData,
  OrgRecord,
  PageResult,
  PrivacyRecord,
  PushTask,
  RoleRecord,
  SecurityRiskData,
  SessionRow,
  StatsData,
  SystemConfig,
  ThirdPartyApp,
  UserDetailData,
  UserRow,
} from './types'

/**
 * 用户中心运营端统一走核心平台的 /api/v1/admin/**。
 *
 * <p>这里**没有** baseURL 前缀，而是把完整路径写在每个方法里 —— 因为这个运营端同时要用
 * 已有的 admin 接口（users / roles / identity-applications …）和新加的 uc 接口，
 * 后者与前者不在同一个前缀下，写死一个 baseURL 反而每次都要覆盖。</p>
 */
const client = axios.create({ timeout: 20000 })

attachUnifiedAuth(client, 'user-center-ops')

async function request<T>(promise: Promise<{ data: ApiEnvelope<T> }>): Promise<T> {
  const response = await promise
  const body = response.data
  if (body.code !== 0) {
    throw new Error(body.message || '请求失败')
  }
  return body.data
}

/**
 * 数值归一化。
 *
 * <p>核心平台把 Long 统一序列化成字符串（防止雪花 ID 超过 JS 安全整数后丢精度），
 * 副作用是**统计数字也变成了字符串**：`total: "29"`、`count: "3"`。
 * 前端一旦做加法就会变成字符串拼接（待办合计 `0+3+8+7+0` → "03870"）。
 * 因此统计类响应在这里统一转回 number，ID 类字段保持字符串不动。</p>
 */
const num = (value: unknown): number => {
  if (typeof value === 'number') return value
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

const numArray = (values: unknown): number[] =>
  Array.isArray(values) ? values.map(num) : []

/** 分页信封：total / page / size 都是 Long，必须转 number 才能给 antd 分页算页数。 */
function normalizePage<T>(data: PageResult<T>): PageResult<T> {
  return { ...data, total: num(data.total), page: num(data.page), size: num(data.size) }
}

const get = <T>(url: string, params?: Record<string, unknown>): Promise<T> =>
  request<T>(client.get(url, { params }))

const post = <T>(url: string, data?: unknown): Promise<T> =>
  request<T>(client.post(url, data))

const put = <T>(url: string, data?: unknown): Promise<T> =>
  request<T>(client.put(url, data))

function normalizeDashboard(data: DashboardData): DashboardData {
  return {
    ...data,
    metrics: Object.fromEntries(
      Object.entries(data.metrics).map(([key, value]) => [key, num(value)]),
    ) as unknown as DashboardData['metrics'],
    todos: (data.todos ?? []).map((todo) => ({ ...todo, count: num(todo.count) })),
    trend: {
      labels: data.trend?.labels ?? [],
      register: numArray(data.trend?.register),
      realname: numArray(data.trend?.realname),
      org: numArray(data.trend?.org),
    },
    roles: (data.roles ?? []).map((item) => ({ ...item, c: num(item.c) })),
    orgTypes: (data.orgTypes ?? []).map((item) => ({ ...item, c: num(item.c) })),
    identityStatus: (data.identityStatus ?? []).map((item) => ({ ...item, c: num(item.c) })),
  }
}

function normalizeStats(data: StatsData): StatsData {
  return {
    ...data,
    trend: {
      labels: data.trend?.labels ?? [],
      register: numArray(data.trend?.register),
      realname: numArray(data.trend?.realname),
      org: numArray(data.trend?.org),
    },
    summary: {
      register: num(data.summary?.register),
      realname: num(data.summary?.realname),
      org: num(data.summary?.org),
    },
    roles: (data.roles ?? []).map((item) => ({ ...item, c: num(item.c) })),
    orgTypes: (data.orgTypes ?? []).map((item) => ({ ...item, c: num(item.c) })),
    orgVerify: (data.orgVerify ?? []).map((item) => ({ ...item, c: num(item.c) })),
    regions: (data.regions ?? []).map((item) => ({ ...item, c: num(item.c) })),
  }
}

export const ucApi = {
  /* ---------- 总览 ---------- */
  dashboard: (days = 30) =>
    get<DashboardData>('/api/v1/admin/uc/dashboard', { days }).then(normalizeDashboard),

  /* ---------- 用户 ---------- */
  users: (params: {
    pageNum?: number
    pageSize?: number
    keyword?: string
    roleCode?: string
    realnameStatus?: string
    status?: number
  }) => get<PageResult<UserRow>>('/api/v1/admin/uc/users', params).then(normalizePage),

  userDetail: (id: string) => get<UserDetailData>(`/api/v1/admin/uc/users/${id}`),

  /** 启停用沿用既有接口，不另开一个「用户状态」写接口。 */
  setUserStatus: (id: string, status: number) =>
    put<void>(`/api/v1/admin/users/${id}/status`, { status }),

  /** 该账号的活跃会话（与用户端「登录设备」同一份数据） */
  userSessions: (id: string) =>
    get<SessionRow[]>(`/api/v1/admin/uc/users/${id}/sessions`),

  /** 强制下线：吊销全部 SSO 会话 + 全部令牌 */
  forceLogout: (id: string) =>
    post<{ sessions: number; message: string }>(`/api/v1/admin/uc/users/${id}/force-logout`),

  /** 重置密码：返回一次性临时密码（只显示这一次） */
  resetPassword: (id: string) =>
    post<{ tempPassword: string; sessions: number; message: string }>(
      `/api/v1/admin/uc/users/${id}/reset-password`,
    ),

  /* ---------- 身份 ---------- */
  identities: (params: { pageNum?: number; pageSize?: number; roleCode?: string }) =>
    get<IdentityPageData>('/api/v1/admin/uc/identities', params).then((data) => ({
      distribution: (data.distribution ?? []).map((item) => ({ ...item, c: num(item.c) })),
      page: normalizePage(data.page),
    })),

  /* ---------- 组织 ---------- */
  orgs: (params: {
    pageNum?: number
    pageSize?: number
    keyword?: string
    type?: string
    verifyStatus?: string
  }) => get<PageResult<OrgRecord>>('/api/v1/admin/uc/orgs', params).then(normalizePage),

  orgDetail: (id: string) => get<OrgDetailData>(`/api/v1/admin/uc/orgs/${id}`),

  /* ---------- 认证审核（复用既有 admin 接口） ---------- */
  identityApplications: (params: { pageNum?: number; pageSize?: number; status?: string }) =>
    get<PageResult<IdentityApplication>>('/api/v1/admin/identity-applications', params).then(normalizePage),

  reviewIdentityApplication: (id: string, approved: boolean, remark: string) =>
    post<void>(`/api/v1/admin/identity-applications/${id}/review`, { approved, remark }),

  realnameList: (params: { pageNum?: number; pageSize?: number; status?: string }) =>
    get<PageResult<IdentityRecord>>('/api/v1/admin/user-identities', params).then(normalizePage),

  reviewRealname: (id: string, approved: boolean, remark: string) =>
    post<void>(`/api/v1/admin/user-identities/${id}/review`, { approved, remark }),

  certifications: (params: {
    pageNum?: number
    pageSize?: number
    certStatus?: string
    merchantName?: string
  }) => get<PageResult<CertificationRecord>>('/api/v1/admin/merchant-certifications', params).then(normalizePage),

  auditCertification: (id: string, status: string, remark: string) =>
    post<void>(`/api/v1/admin/merchant-certifications/${id}/audit`, { status, remark }),

  /* ---------- 角色权限（复用既有 admin 接口） ---------- */
  roles: () => get<RoleRecord[]>('/api/v1/admin/roles'),

  rolePermissions: (code: string) =>
    get<string[]>(`/api/v1/admin/roles/${code}/permissions`),

  saveRolePermissions: (code: string, permissions: string[]) =>
    put<RoleRecord>(`/api/v1/admin/roles/${code}/permissions`, { permissions }),

  /* ---------- 第三方授权 ---------- */
  authApps: (params: { pageNum?: number; pageSize?: number; keyword?: string; status?: string }) =>
    get<PageResult<ThirdPartyApp>>('/api/v1/admin/uc/auth-apps', params).then(normalizePage),

  createAuthApp: (body: Record<string, unknown>) =>
    post<ThirdPartyApp>('/api/v1/admin/uc/auth-apps', body),

  reviewAuthApp: (id: string, approved: boolean, remark: string) =>
    post<ThirdPartyApp>(`/api/v1/admin/uc/auth-apps/${id}/review`, { approved, remark }),

  authRecords: (params: { pageNum?: number; pageSize?: number; keyword?: string }) =>
    get<PageResult<AuthRecord>>('/api/v1/admin/uc/auth-records', params).then(normalizePage),

  /* ---------- 消息 ---------- */
  templates: (scene?: string) =>
    get<MessageTemplate[]>('/api/v1/admin/uc/message-templates', { scene }),

  createTemplate: (body: Record<string, unknown>) =>
    post<MessageTemplate>('/api/v1/admin/uc/message-templates', body),

  updateTemplate: (id: string, body: Record<string, unknown>) =>
    put<MessageTemplate>(`/api/v1/admin/uc/message-templates/${id}`, body),

  pushes: (params: { pageNum?: number; pageSize?: number }) =>
    get<PageResult<PushTask>>('/api/v1/admin/uc/message-pushes', params).then(normalizePage),

  /** 预估触达：发之前先看会发给多少人，避免手滑全量群发 */
  audienceCount: (audience: string) =>
    get<{ audience: string; count: number }>('/api/v1/admin/uc/message-pushes/audience-count', { audience }),

  /** 只入队，投递由后台 worker 分批完成；前端轮询任务列表看进度 */
  sendPush: (body: Record<string, unknown>) =>
    post<{ taskId: string; status: string; message: string }>(
      '/api/v1/admin/uc/message-pushes',
      body,
    ),

  /* ---------- 安全 ---------- */
  risks: (days = 7) => get<SecurityRiskData>('/api/v1/admin/uc/security/risks', { days }),

  deviceLogs: (params: {
    pageNum?: number
    pageSize?: number
    keyword?: string
    result?: string
  }) => get<PageResult<DeviceLog>>('/api/v1/admin/uc/security/device-logs', params).then(normalizePage),

  /* ---------- 冻结 ---------- */
  freezes: (params: {
    pageNum?: number
    pageSize?: number
    status?: string
    keyword?: string
    appealStatus?: string
  }) => get<PageResult<FreezeRecord>>('/api/v1/admin/uc/freeze-records', params).then(normalizePage),

  /** 处理冻结申诉：受理即解封，驳回需填理由 */
  handleAppeal: (id: string, approved: boolean, remark: string) =>
    post<{ accepted: boolean; message: string }>(
      `/api/v1/admin/uc/freeze-records/${id}/appeal`,
      { approved, remark },
    ),

  freeze: (body: Record<string, unknown>) =>
    post<FreezeRecord>('/api/v1/admin/uc/freeze-records', body),

  unfreeze: (id: string, remark: string) =>
    post<FreezeRecord>(`/api/v1/admin/uc/freeze-records/${id}/unfreeze`, { remark }),

  /* ---------- 合规 ---------- */
  privacyRequests: (params: { pageNum?: number; pageSize?: number; status?: string }) =>
    get<PageResult<PrivacyRecord>>('/api/v1/admin/privacy-requests', params).then(normalizePage),

  handlePrivacy: (id: string, status: string, remark: string) =>
    post<void>(`/api/v1/admin/privacy-requests/${id}/handle`, { status, remark }),

  feedbacks: (params: { pageNum?: number; pageSize?: number; status?: string; type?: string }) =>
    get<PageResult<FeedbackRecord>>('/api/v1/admin/feedback', params).then(normalizePage),

  replyFeedback: (id: string, content: string) =>
    post<void>(`/api/v1/admin/feedback/${id}/reply`, { content }),

  /* ---------- 统计 / 配置 / 审计 ---------- */
  stats: (days = 30) =>
    get<StatsData>('/api/v1/admin/uc/stats', { days }).then(normalizeStats),

  configs: () => get<SystemConfig[]>('/api/v1/admin/uc/configs'),

  saveConfigs: (items: Array<{ key: string; value: string }>) =>
    put<{ changed: number; message: string }>('/api/v1/admin/uc/configs', items),

  auditLogs: (params: {
    pageNum?: number
    pageSize?: number
    keyword?: string
    actionPrefix?: string
  }) => get<PageResult<AuditLog>>('/api/v1/admin/uc/audit-logs', params).then(normalizePage),
}
