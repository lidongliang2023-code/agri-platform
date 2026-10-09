/**
 * 运营端 - 租户管理 API（含配额与分层）
 */
import { http } from '@/utils/request'
import type { BizId, PageQuery, PageResult } from '@/types'
import type { Tenant, TenantQuota, TenantSegment } from '@/types'
import type {
  OpsQuotaItem,
  OpsTenant,
  OpsTenantQuotaRow,
  TenantFarmItem,
  TenantOperationLog,
  TenantSegmentProfile,
  TenantSegmentSummary,
} from '@/types'

const BASE = '/admin/tenants'

/** 租户列表查询参数 */
export interface TenantListParams extends PageQuery {
  tenantName?: string
  tenantLevel?: number
  status?: number
}

/** 分页查询租户列表 */
export function listTenants(params: TenantListParams): Promise<PageResult<Tenant>> {
  return http.get<PageResult<Tenant>>(BASE, params)
}

/** 查询租户详情 */
export function getTenant(tenantId: BizId): Promise<Tenant> {
  return http.get<Tenant>(`${BASE}/${tenantId}`)
}

/** 新增租户 */
export function createTenant(payload: Partial<Tenant>): Promise<string> {
  return http.post<string>(BASE, payload)
}

/** 更新租户 */
export function updateTenant(tenantId: BizId, payload: Partial<Tenant>): Promise<Tenant> {
  return http.put<Tenant>(`${BASE}/${tenantId}`, payload)
}

/** 删除租户 */
export function deleteTenant(tenantId: BizId): Promise<void> {
  return http.delete<void>(`${BASE}/${tenantId}`)
}

/** 冻结 / 解冻租户 */
export function updateTenantStatus(tenantId: BizId, status: number): Promise<boolean> {
  return http.patch<boolean>(`${BASE}/${tenantId}/status`, { status })
}

/** 分页查询租户配额 */
export function listTenantQuotas(
  params: PageQuery & { tenantId?: string; quotaType?: number },
): Promise<PageResult<TenantQuota>> {
  return http.get<PageResult<TenantQuota>>(`${BASE}/quotas`, params)
}

/** 调整租户配额 */
export function updateTenantQuota(
  quotaId: BizId,
  payload: Partial<TenantQuota>,
): Promise<TenantQuota> {
  return http.put<TenantQuota>(`${BASE}/quotas/${quotaId}`, payload)
}

/** 分页查询租户分层 */
export function listTenantSegments(
  params: PageQuery & { segmentName?: string },
): Promise<PageResult<TenantSegment>> {
  return http.get<PageResult<TenantSegment>>(`${BASE}/segments`, params)
}

/** 新增租户分层 */
export function createTenantSegment(payload: Partial<TenantSegment>): Promise<TenantSegment> {
  return http.post<TenantSegment>(`${BASE}/segments`, payload)
}

/** 更新租户分层 */
export function updateTenantSegment(
  segmentId: BizId,
  payload: Partial<TenantSegment>,
): Promise<TenantSegment> {
  return http.put<TenantSegment>(`${BASE}/segments/${segmentId}`, payload)
}

/** 删除租户分层 */
export function deleteTenantSegment(segmentId: BizId): Promise<boolean> {
  return http.delete<boolean>(`${BASE}/segments/${segmentId}`)
}

/* ==================== 运营端页面扩展查询（追加） ==================== */
/* 说明：读接口统一 silent，后端未就绪时页面降级到原型示例数据；
 * 写接口保持默认行为（错误需显式提示用户）。 */

/** 运营端租户列表查询参数（对齐原型 P2 筛选项） */
export interface OpsTenantListParams extends PageQuery {
  /** 租户名称 / 编号关键字 */
  tenantName?: string
  /** 租户等级：1 普通 2 银牌 3 金牌 4 钻石 */
  tenantLevel?: number
  /** 状态：1 正常 2 待审核 3 已冻结 */
  status?: number
  /** 区域 */
  region?: string
  /** 注册起始日期 yyyy-MM-dd */
  startDate?: string
  /** 注册截止日期 yyyy-MM-dd */
  endDate?: string
}

/** 后端分页原始结构（兼容 records/page/size 与 list/pageNum/pageSize） */
interface RawOpsPageResult<T> {
  list?: T[]
  records?: T[]
  total?: number
  pageNum?: number
  page?: number
  pageSize?: number
  size?: number
  pages?: number
}

/**
 * 将后端分页结果归一化为前端 PageResult 结构。
 *
 * @param raw 后端返回体
 * @param pageNum 当前页码（后端缺失时使用）
 * @param pageSize 每页条数（后端缺失时使用）
 * @returns 归一化后的分页结果
 */
function normalizeOpsPage<T>(
  raw: RawOpsPageResult<T> | T[] | null | undefined,
  pageNum: number,
  pageSize: number,
): PageResult<T> {
  const list = Array.isArray(raw) ? raw : (raw?.records ?? raw?.list ?? [])
  const total = Array.isArray(raw) ? list.length : Number(raw?.total ?? list.length) || 0
  const size = Array.isArray(raw)
    ? pageSize
    : Number(raw?.size ?? raw?.pageSize ?? pageSize) || pageSize
  const current = Array.isArray(raw)
    ? pageNum
    : Number(raw?.pageNum ?? raw?.page ?? pageNum) || pageNum
  return {
    pageNum: current,
    pageSize: size,
    total,
    pages: Math.max(1, Math.ceil(total / (size || 1))),
    list,
  }
}

/** 分页查询运营端租户列表 */
export function listOpsTenants(params: OpsTenantListParams): Promise<PageResult<OpsTenant>> {
  return http
    .get<RawOpsPageResult<OpsTenant>>(BASE, params, { silent: true })
    .then((raw) => normalizeOpsPage<OpsTenant>(raw, params.pageNum, params.pageSize))
}

/** 分页查询租户农场列表（租户详情 Tab2） */
export function listTenantFarms(
  tenantId: string,
  params: PageQuery,
): Promise<PageResult<TenantFarmItem>> {
  return http
    .get<RawOpsPageResult<TenantFarmItem>>(`${BASE}/${tenantId}/farms`, params, { silent: true })
    .then((raw) => normalizeOpsPage<TenantFarmItem>(raw, params.pageNum, params.pageSize))
}

/** 分页查询租户操作日志（租户详情 Tab4） */
export function listTenantOperationLogs(
  tenantId: string,
  params: PageQuery,
): Promise<PageResult<TenantOperationLog>> {
  return http
    .get<RawOpsPageResult<TenantOperationLog>>(`${BASE}/${tenantId}/logs`, params, { silent: true })
    .then((raw) => normalizeOpsPage<TenantOperationLog>(raw, params.pageNum, params.pageSize))
}

/** 查询租户配额概览（原型 4 项） */
export function getTenantQuotaOverview(tenantId: string): Promise<OpsQuotaItem[]> {
  return http.get<OpsQuotaItem[]>(`${BASE}/${tenantId}/quota-overview`, undefined, { silent: true })
}

/** 调整租户配额（整体提交 4 项上限） */
export function updateTenantQuotaLimits(
  tenantId: string,
  payload: {
    farmLimit?: number
    traceCodeLimit?: number
    storageLimit?: number
    apiLimit?: number
    remark?: string
  },
): Promise<boolean> {
  return http.put<boolean>(`${BASE}/${tenantId}/quota-limits`, payload)
}

/** 批量调整租户配额（配额管理页批量操作） */
export function batchUpdateQuotaLimits(payload: {
  tenantIds: string[]
  farmLimit?: number
  traceCodeLimit?: number
  storageLimit?: number
  apiLimit?: number
  remark?: string
}): Promise<boolean> {
  return http.put<boolean>(`${BASE}/quota-limits/batch`, payload)
}

/** 重置租户已用配额（按实际业务数据重算） */
export function resetTenantQuotaUsage(tenantId: string): Promise<boolean> {
  return http.post<boolean>(`${BASE}/${tenantId}/quota-usage/reset`)
}

/**
 * 分页查询全平台租户配额一览（配额管理页）。
 *
 * 说明：后端 `GET /admin/tenants/quota-overview` 仅支持 `page` / `size` / `tenantName` / `onlyWarning`，
 * **不支持 `segment` 参数**（后端 OpsTenantQuotaRow.segment 恒为 null，无分层数据源），
 * 故此处不再声明 `segment`，避免前端传入一个被后端静默忽略的假筛选条件。
 */
export function listOpsQuotaOverview(
  params: PageQuery & { tenantName?: string; onlyWarning?: boolean },
): Promise<PageResult<OpsTenantQuotaRow>> {
  return http
    .get<RawOpsPageResult<OpsTenantQuotaRow>>(`${BASE}/quota-overview`, params, { silent: true })
    .then((raw) => normalizeOpsPage<OpsTenantQuotaRow>(raw, params.pageNum, params.pageSize))
}

/** 分页查询租户分层画像（分层运营页） */
export function listTenantProfiles(
  params: PageQuery & { tenantName?: string; segment?: string; tag?: string },
): Promise<PageResult<TenantSegmentProfile>> {
  return http
    .get<RawOpsPageResult<TenantSegmentProfile>>(`${BASE}/profiles`, params, { silent: true })
    .then((raw) => normalizeOpsPage<TenantSegmentProfile>(raw, params.pageNum, params.pageSize))
}

/** 更新租户分层与运营标签 */
export function updateTenantProfile(
  tenantId: string,
  payload: { segment?: string; tags?: string[]; strategy?: string },
): Promise<boolean> {
  return http.put<boolean>(`${BASE}/${tenantId}/profile`, payload)
}

/** 查询分层汇总统计（分层运营页统计卡） */
export function listTenantSegmentSummary(): Promise<TenantSegmentSummary[]> {
  return http.get<TenantSegmentSummary[]>(`${BASE}/segment-summary`, undefined, { silent: true })
}

/* ==================== 租户概览（后端 TenantOverviewService） ==================== */

/** 租户概览：单租户明细行 */
export interface TenantOverviewRow {
  /** 租户 ID（后端 Long 全局序列化为字符串，故用 BizId） */
  tenantId: BizId
  /** 租户编码，未登记配额时为 TENANT-<id> */
  tenantCode: string
  /** 租户名称，未登记配额时为「未登记租户」 */
  tenantName: string
  /** 配额状态：1 正常 / 0 停用 / null 未登记 */
  status: number | null
  /** 是否已在配额表登记 */
  registered: boolean
  farmCount: number
  plotCount: number
  deviceCount: number
  /** 在线设备数（online_flag=1 且心跳在 10 分钟内） */
  deviceOnlineCount: number
  /** 待处理告警数（prod_alert_info.status = PENDING） */
  pendingAlertCount: number
  /** 在种计划数（status = 2） */
  growingPlanCount: number
  /** 农场数上限，未配置时为 null */
  farmLimit: number | null
  /** 农场配额使用率（百分比，2 位小数；无限额时为 0） */
  farmUsageRate: number
  /** 使用率 ≥ 80% 时为 true */
  quotaWarning: boolean
}

/** 租户概览：平台级汇总卡片 + 逐租户明细 */
export interface TenantOverview {
  tenantTotal: number
  activeTenantCount: number
  disabledTenantCount: number
  /** 有业务数据但未登记配额的租户数 */
  unregisteredTenantCount: number
  farmTotal: number
  plotTotal: number
  deviceTotal: number
  deviceOnlineCount: number
  pendingAlertCount: number
  growingPlanCount: number
  quotaWarningCount: number
  /** 按农场数倒序 */
  rows: TenantOverviewRow[]
}

/** 查询平台级租户概览（GET /admin/tenants/overview） */
export function getTenantOverview(): Promise<TenantOverview> {
  return http.get<TenantOverview>(`${BASE}/overview`, undefined, { silent: true })
}

/** 查询单租户概览（GET /admin/tenants/overview/{tenantId}） */
export function getTenantOverviewById(tenantId: BizId): Promise<TenantOverviewRow> {
  return http.get<TenantOverviewRow>(`${BASE}/overview/${tenantId}`, undefined, { silent: true })
}
