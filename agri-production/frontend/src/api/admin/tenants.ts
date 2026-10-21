/**
 * 运营端 - 主体管理 API（含配额与分层）
 */
import { http } from '@/utils/request'
import type { BizId, PageQuery, PageResult } from '@/types'
import type { Tenant, TenantQuota, TenantSegment, TenantStatus } from '@/types'
import type {
  OpsQuotaItem,
  OpsTenant,
  OpsTenantQuotaRow,
  TenantFarmItem,
  TenantOperationLog,
  TenantSegmentProfile,
  TenantSegmentSummary,
} from '@/types'

const BASE = '/admin/subjects'

/** 主体列表查询参数 */
export interface TenantListParams extends PageQuery {
  tenantName?: string
  keyword?: string
  memberType?: 'enterprise' | 'personal'
  tenantLevel?: number
  status?: number
}

/** 分页查询主体列表 */
export function listTenants(params: TenantListParams): Promise<PageResult<Tenant>> {
  return http.get<PageResult<Tenant>>(BASE, params)
}

/**
 * 查询主体详情（GET /admin/tenants/{id}）。
 *
 * ⚠️ 后端 `AdminTenantController#detail` 返回的是 **`TenantQuotaEntity`（配额记录）**，
 * 不是「主体档案实体」——库内没有主体主表，主体以配额记录为载体。
 * 实测（2026-10-10，端口 8096，code=0）返回键为：
 * `marketId, tenantId, createBy, updateBy, createdAt, updatedAt, deleted, quotaId,
 *  tenantCode, tenantName, farmLimit, plotLimit, deviceLimit, userLimit,
 *  storageLimitGb, traceCodeLimit, apiCallLimit, usedFarmCount, status`。
 *
 * 因此**没有**联系人 / 联系电话 / 区域 / 统一社会信用代码 / 法定代表人 / 地址 /
 * 经营范围 / 主体等级 / 成员数 / 设备数（实际值）/ 在田面积 / 活跃度 / 到期时间等字段。
 * 此前这里声明返回 `Tenant`（把上面这些字段标成必填或可选），
 * 前端于是用原型示例值补齐——页面上每一个"档案字段"都是编造的。
 *
 * @param tenantId 主体标识（后端 `quotaId`）
 * @returns 后端配额记录真实形态
 */
export function getTenant(tenantId: BizId): Promise<OpsTenantRow> {
  return http.get<OpsTenantRow>(`${BASE}/${tenantId}`)
}

/** 新增主体 */
export function createTenant(payload: Partial<Tenant>): Promise<string> {
  return http.post<string>(BASE, payload)
}

/** 主体运营字段；主体 ID、编码和主体类型由经营主体注册决定，不可在此改写。 */
export interface TenantSubjectUpdate {
  tenantName?: string
  industry?: string
  businessType?: string
  contactName?: string
  contactPhone?: string
  status?: TenantStatus
}

/** 更新经营主体主体资料 */
export function updateTenant(tenantId: BizId, payload: TenantSubjectUpdate): Promise<OpsTenantRow> {
  return http.put<OpsTenantRow>(`${BASE}/${tenantId}`, payload)
}

/** 启用 / 停用经营主体主体 */
export function updateTenantStatus(tenantId: BizId, status: TenantStatus): Promise<OpsTenantRow> {
  return http.put<OpsTenantRow>(`${BASE}/${tenantId}/status`, { status })
}

/** 删除主体 */
export function deleteTenant(tenantId: BizId): Promise<void> {
  return http.delete<void>(`${BASE}/${tenantId}`)
}

/*
 * `updateTenantStatus`（`PATCH /admin/tenants/{id}/status`）已删除（2026-10-10）。
 *
 * 判定依据（端点不存在 **且** 无调用方 → 删；端点不存在 **但** 有调用方 → 提后端单）：
 * - 端点实测不存在：`PATCH /admin/tenants/0/status` → `code=500`，
 *   日志 `NoResourceFoundException: No static resource api/v1/production/admin/tenants/0/status.`
 *   （`AdminTenantController` 只有 `PUT /{id}`，没有任何 `/{id}/status` 映射。）
 * - 调用方实测 0 处：全仓 grep `updateTenantStatus` 只命中本声明本身。
 *
 * 留着只会让人误以为"主体冻结/解冻有接口，只是暂时没接"。
 * 后端真做了该能力时再重新引入，并同步补 `PUT /{id}` 之外的语义。
 */

/** 分页查询主体配额 */
export function listTenantQuotas(
  params: PageQuery & { tenantId?: string; quotaType?: number },
): Promise<PageResult<TenantQuota>> {
  return http.get<PageResult<TenantQuota>>(`${BASE}/quotas`, params)
}

/** 调整主体配额 */
export function updateTenantQuota(
  quotaId: BizId,
  payload: Partial<TenantQuota>,
): Promise<TenantQuota> {
  return http.put<TenantQuota>(`${BASE}/quotas/${quotaId}`, payload)
}

/** 分页查询主体分层 */
export function listTenantSegments(
  params: PageQuery & { segmentName?: string },
): Promise<PageResult<TenantSegment>> {
  return http.get<PageResult<TenantSegment>>(`${BASE}/segments`, params)
}

/** 新增主体分层 */
export function createTenantSegment(payload: Partial<TenantSegment>): Promise<TenantSegment> {
  return http.post<TenantSegment>(`${BASE}/segments`, payload)
}

/** 更新主体分层 */
export function updateTenantSegment(
  segmentId: BizId,
  payload: Partial<TenantSegment>,
): Promise<TenantSegment> {
  return http.put<TenantSegment>(`${BASE}/segments/${segmentId}`, payload)
}

/** 删除主体分层 */
export function deleteTenantSegment(segmentId: BizId): Promise<boolean> {
  return http.delete<boolean>(`${BASE}/segments/${segmentId}`)
}

/* ==================== 运营端页面扩展查询（追加） ==================== */
/* 说明：读接口统一 silent，后端未就绪时页面降级到原型示例数据；
 * 写接口保持默认行为（错误需显式提示用户）。 */

/** 运营端主体列表查询参数（对齐原型 P2 筛选项） */
export interface OpsTenantListParams extends PageQuery {
  /** 主体名称 / 编号 / 联系人关键字 */
  keyword?: string
  /** 经营主体类型 */
  memberType?: 'enterprise' | 'personal'
  /** 主体等级：1 普通 2 银牌 3 金牌 4 钻石 */
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

/** 分页查询运营端主体列表 */
export function listOpsTenants(params: OpsTenantListParams): Promise<PageResult<OpsTenant>> {
  return http
    .get<RawOpsPageResult<OpsTenant>>(BASE, params, { silent: true })
    .then((raw) => normalizeOpsPage<OpsTenant>(raw, params.pageNum, params.pageSize))
}

/**
 * 运营端主体行：经营主体主档 + 可选配额配置。
 * 一个企业或个人经营主体就是一个主体，`tenantId` 等于 `platform_merchant.id`。
 */
export interface OpsTenantRow {
  /** 经营主体 ID，也是主体 ID */
  tenantId: string
  /** 经营主体编码，也是主体编码 */
  tenantCode?: string | null
  /** 经营主体名称，也是主体名称 */
  tenantName?: string | null
  /** enterprise 企业 / personal 个人 */
  memberType?: 'enterprise' | 'personal' | null
  industry?: string | null
  businessType?: string | null
  contactName?: string | null
  contactPhone?: string | null
  verifyStatus?: string | null
  /** 配额记录 ID；主体尚未配置配额时为空 */
  quotaId?: string | null
  /** 是否已建立配额配置 */
  quotaRegistered?: boolean
  /** 农场数上限 */
  farmLimit?: number | null
  /** 地块数上限 */
  plotLimit?: number | null
  /** 设备数上限 */
  deviceLimit?: number | null
  /** 用户数上限 */
  userLimit?: number | null
  /** 存储空间上限（GB） */
  storageLimitGb?: number | null
  /** 溯源码上限 */
  traceCodeLimit?: number | null
  /** 日 API 调用上限 */
  apiCallLimit?: number | null
  /** 已用农场数（真实用量列） */
  usedFarmCount?: number | null
  /** 状态：1 正常 / 0 停用 */
  status?: number | null
  /** 创建时间 */
  createdAt?: string | null
  /** 更新时间 */
  updatedAt?: string | null
}

/**
 * 分页查询运营端主体列表（返回后端 `TenantQuotaEntity` 原始形态）。
 *
 * 与 {@link listOpsTenants} 的区别：本函数不做任何字段改名 / 补位，
 * 后端返回什么就用什么，避免在类型层凭空造出后端没有的字段。
 *
 * @param params 分页与过滤参数（后端当前仅支持 status）
 * @returns 分页结果
 */
export function listOpsTenantRows(params: OpsTenantListParams): Promise<PageResult<OpsTenantRow>> {
  return http
    .get<RawOpsPageResult<OpsTenantRow>>(BASE, params, { silent: true })
    .then((raw) => normalizeOpsPage<OpsTenantRow>(raw, params.pageNum, params.pageSize))
}

/** 分页查询主体农场列表（主体详情 Tab2） */
export function listTenantFarms(
  tenantId: string,
  params: PageQuery,
): Promise<PageResult<TenantFarmItem>> {
  return http
    .get<RawOpsPageResult<TenantFarmItem>>(`${BASE}/${tenantId}/farms`, params, { silent: true })
    .then((raw) => normalizeOpsPage<TenantFarmItem>(raw, params.pageNum, params.pageSize))
}

/** 分页查询主体操作日志（主体详情 Tab4） */
export function listTenantOperationLogs(
  tenantId: string,
  params: PageQuery,
): Promise<PageResult<TenantOperationLog>> {
  return http
    .get<RawOpsPageResult<TenantOperationLog>>(`${BASE}/${tenantId}/logs`, params, { silent: true })
    .then((raw) => normalizeOpsPage<TenantOperationLog>(raw, params.pageNum, params.pageSize))
}

/** 查询主体配额概览（原型 4 项） */
export function getTenantQuotaOverview(tenantId: string): Promise<OpsQuotaItem[]> {
  return http.get<OpsQuotaItem[]>(`${BASE}/${tenantId}/quota-overview`, undefined, { silent: true })
}

/** 调整主体配额（整体提交 4 项上限） */
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

/** 批量调整主体配额（配额管理页批量操作） */
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

/**
 * 重置主体已用配额（按实际业务数据重算）。
 *
 * ⚠️ 路径曾写错：原实现打 `POST /admin/tenants/{tenantId}/quota-usage/reset`，
 * 而真端点是 `AdminTenantController` 的 `POST /admin/tenants/{quotaId}/reset-usage`
 * —— 端点一直存在，是**前端把路径写错了**，所以这个按钮此前必失败，
 * 而页面只显示"系统繁忙"，排障极易误判成"后端没做这个接口"。
 *
 * 成对实测（2026-10-10，core-app :8098，**同一个不存在的 id**，排除"id 无效"干扰）：
 * - `POST /admin/tenants/NOPE/reset-usage`         → `code=404「资源不存在」` → 端点存在，id 无效
 * - `POST /admin/tenants/NOPE/quota-usage/reset`   → `code=500「系统繁忙」`   → 端点不存在
 *   日志：`NoResourceFoundException: No static resource api/v1/production/admin/tenants/NOPE/quota-usage/reset.`
 *
 * ⚠️ 入参语义也变了：真端点要的是 **`quotaId`**（后端配额主键），不是 `tenantId`。
 * 传 tenantId 会拿到 404「资源不存在」（当前种子数据里 tenant_id 全库为 0，
 * 见 `docs/backend-tickets.md` BT-09）。
 *
 * @param quotaId 后端配额记录主键（如 `DEMO-QUOTA-001`）
 * @returns 服务端确认重算成功时返回 true
 */
export function resetTenantQuotaUsage(quotaId: string): Promise<boolean> {
  return http.post<boolean>(`${BASE}/${quotaId}/reset-usage`)
}

/**
 * 分页查询全平台主体配额一览（配额管理页）。
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

/** 分页查询主体分层画像（分层运营页） */
export function listTenantProfiles(
  params: PageQuery & { tenantName?: string; segment?: string; tag?: string },
): Promise<PageResult<TenantSegmentProfile>> {
  return http
    .get<RawOpsPageResult<TenantSegmentProfile>>(`${BASE}/profiles`, params, { silent: true })
    .then((raw) => normalizeOpsPage<TenantSegmentProfile>(raw, params.pageNum, params.pageSize))
}

/** 更新主体分层与运营标签 */
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

/* ==================== 主体概览（后端 TenantOverviewService） ==================== */

/** 主体概览：单主体明细行 */
export interface TenantOverviewRow {
  /** 主体 ID（后端 Long 全局序列化为字符串，故用 BizId） */
  tenantId: BizId
  /** 主体编码，未登记配额时为 TENANT-<id> */
  tenantCode: string
  /** 主体名称，未登记配额时为「未登记主体」 */
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

/** 主体概览：平台级汇总卡片 + 逐主体明细 */
export interface TenantOverview {
  tenantTotal: number
  activeTenantCount: number
  disabledTenantCount: number
  /** 有业务数据但未登记配额的主体数 */
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

/** 查询平台级主体概览（GET /admin/tenants/overview） */
export function getTenantOverview(): Promise<TenantOverview> {
  return http.get<TenantOverview>(`${BASE}/overview`, undefined, { silent: true })
}

/** 查询单主体概览（GET /admin/tenants/overview/{tenantId}） */
export function getTenantOverviewById(tenantId: BizId): Promise<TenantOverviewRow> {
  return http.get<TenantOverviewRow>(`${BASE}/overview/${tenantId}`, undefined, { silent: true })
}
