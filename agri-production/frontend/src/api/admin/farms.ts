/**
 * 运营端 - 农场监管 API（含 GIS 与合规检查）
 */
import { asApiRequestError, http, httpStatusOf } from '@/utils/request'
import type { BizId, PageQuery, PageResult } from '@/types'
import type { ComplianceCheck, Farm } from '@/types'

const BASE = '/admin/farms'

/** 农场监管列表查询参数 */
export interface FarmSupervisionParams extends PageQuery {
  farmName?: string
  tenantId?: string
  farmType?: number
  status?: number
  region?: string
}

/** 分页查询农场监管列表 */
export function listSupervisedFarms(
  params: FarmSupervisionParams,
): Promise<PageResult<Farm>> {
  return http.get<PageResult<Farm>>(BASE, params)
}

/** 查询农场监管详情 */
export function getSupervisedFarm(farmId: string): Promise<Farm> {
  return http.get<Farm>(`${BASE}/${farmId}`)
}

/** 更新农场监管信息 */
export function updateSupervisedFarm(farmId: string, payload: Partial<Farm>): Promise<Farm> {
  return http.put<Farm>(`${BASE}/${farmId}`, payload)
}

/** 删除农场 */
export function deleteSupervisedFarm(farmId: string): Promise<boolean> {
  return http.delete<boolean>(`${BASE}/${farmId}`)
}

/** 启停农场 */
export function updateSupervisedFarmStatus(farmId: string, status: number): Promise<boolean> {
  return http.patch<boolean>(`${BASE}/${farmId}/status`, { status })
}

/** 查询 GIS 地图监管数据 */
export function listFarmMapPoints(params?: {
  tenantId?: string
  farmType?: number
}): Promise<{ farmId: string; farmName: string; longitude: number; latitude: number }[]> {
  return http.get<{ farmId: string; farmName: string; longitude: number; latitude: number }[]>(
    `${BASE}/map`,
    params,
  )
}

/**
 * 分页查询合规检查**任务台账**。
 *
 * ⚠️ 端点必须是 `GET /admin/farms/compliance/checks`，不是 `GET /admin/farms/compliance`。
 * 两者在后端 `AdminFarmController` 里是两个不同端点：
 * - `/compliance`        → 农场合规**画像清单**（`ApiResponse<List<Map>>`，非分页体）
 * - `/compliance/checks` → 检查任务**台账**（`ApiResponse<PageResult<FarmComplianceCheckEntity>>`）
 *
 * 打错端点的后果是"看起来能用、实际是假的"：画像清单是个数组，归一化后 `list` 为 undefined，
 * 页面拿到空列表；而新建时前端把 POST 的响应并进了本地 state，所以**提交完能看到、刷新就变 0 条**，
 * 用户会以为数据丢了。
 *
 * 返回结构：后端 `{ code, data: { records, total, page, size } }`，
 * 经 `src/utils/request.ts` 的 `normalizePageData` 归一化为 `{ list, total, pageNum, pageSize, pages }`，
 * 与 `PageResult<T>` 一致；入参 `pageNum` / `pageSize` 由后端 PageParamAliasFilter 映射为 `page` / `size`。
 *
 * @param params 分页与筛选参数
 * @returns 归一化后的分页结果
 */
export function listComplianceChecks(
  params: PageQuery & { farmId?: string; result?: number },
): Promise<PageResult<ComplianceCheck>> {
  return http.get<PageResult<ComplianceCheck>>(`${BASE}/compliance/checks`, params)
}

/** 新增合规检查记录 */
export function createComplianceCheck(
  payload: Partial<ComplianceCheck>,
): Promise<ComplianceCheck> {
  return http.post<ComplianceCheck>(`${BASE}/compliance`, payload)
}

/** 更新合规检查记录 */
export function updateComplianceCheck(
  checkId: string,
  payload: Partial<ComplianceCheck>,
): Promise<ComplianceCheck> {
  return http.put<ComplianceCheck>(`${BASE}/compliance/${checkId}`, payload)
}

/** 删除合规检查记录 */
export function deleteComplianceCheck(checkId: string): Promise<boolean> {
  return http.delete<boolean>(`${BASE}/compliance/${checkId}`)
}

/* ==================== 农场监管页面补齐端点（对齐 AdminFarmController） ==================== */

/**
 * 农场合规画像
 *
 * 对应 `GET /admin/farms/{farmId}/compliance`：地块数、认证数、
 * 临期/过期认证数与合规等级（OK / WARN / RISK）。
 */
export interface FarmComplianceProfile {
  /** 农场 ID */
  farmId: string
  /** 农场名称 */
  farmName?: string
  /** 地块数 */
  plotCount: number
  /** 认证数 */
  certCount: number
  /** 临期认证数（30 天内到期） */
  certExpiring: number
  /** 已过期认证数 */
  certExpired: number
  /** 合规等级：OK 正常 / WARN 预警 / RISK 风险 */
  complianceLevel?: 'OK' | 'WARN' | 'RISK'
}

/** 查询单个农场合规画像 */
export function getSupervisedFarmCompliance(farmId: BizId): Promise<FarmComplianceProfile> {
  return http.get<FarmComplianceProfile>(`${BASE}/${farmId}/compliance`)
}

/**
 * 查询全平台农场合规画像清单
 *
 * 对应 `GET /admin/farms/compliance?limit`，后端返回 List（非分页体），页面层直接使用数组。
 */
export function listSupervisedComplianceProfiles(limit = 200): Promise<FarmComplianceProfile[]> {
  return http.get<FarmComplianceProfile[]>(`${BASE}/compliance`, { limit })
}

/** 查询认证临期农场清单 */
export function listCertExpiringFarms(withinDays = 30): Promise<Farm[]> {
  return http.get<Farm[]>(`${BASE}/cert-expiring`, { withinDays })
}

/**
 * 监管停用 / 恢复农场
 *
 * 对应 `PUT /admin/farms/{farmId}/status?enable=true|false`。
 */
export function toggleSupervisedFarmStatus(farmId: BizId, enable: boolean): Promise<Farm> {
  return http.put<Farm>(`${BASE}/${farmId}/status`, undefined, { params: { enable } })
}

/**
 * GIS 地图点位
 *
 * 后端 `/admin/farms/map` 目前只返回省市区与面积，不含经纬度，
 * 故经纬度为可选字段，后续后端补齐可直接消费。
 */
export interface FarmMapPoint {
  /** 农场 ID */
  farmId: BizId
  /** 农场名称 */
  farmName: string
  /** 省份 */
  province?: string
  /** 城市 */
  city?: string
  /** 区县 */
  district?: string
  /** 面积（亩） */
  areaTotal?: number
  /** 经度（后端暂未返回） */
  longitude?: number
  /** 纬度（后端暂未返回） */
  latitude?: number
}

/** 查询农场地理分布 */
export function listSupervisedFarmMapPoints(): Promise<FarmMapPoint[]> {
  return http.get<FarmMapPoint[]>(`${BASE}/map`)
}

/**
 * 合规检查写操作结果。
 *
 * 设计前提（team-lead 对全仓空 catch 的裁决仍然成立）：**不改成 throw**——
 * 后端端点未全就绪时 throw 会让页面大面积转错误态。正确做法是保留可控降级、
 * 但让降级**可见且可区分**，因此这里把失败拆成两类：
 *
 * - `rejected`：请求已到达服务端，被明确拒绝（400 / 404 等 4xx，或 2003 这类自定义业务码）。
 *   这类失败**不应该**降级写本地——写本地等于把一条注定关联不上的任务留在用户机器上。
 * - `unreachable`：服务端根本没给出有效响应（断网 / 超时），或 HTTP 5xx / 业务码 5xx
 *   这类**服务端自身故障**。只有这类才可以离线兜底，且页面必须弹 warning 而不是 success。
 *
 * ⚠️ 判定口径：能不能降级，取决于"服务端是不是给了一个明确的答复"，而不是"有没有成功"。
 * 404（农场档案不存在）是明确答复 → 不降级；5xx 是服务端没干成活 → 可降级但要说清。
 */
export interface ComplianceWriteResult {
  /** 是否成功写入服务端 */
  ok: boolean
  /**
   * 失败性质：
   * - `rejected`：后端明确拒绝（请求已到达服务端，业务码非 0）
   * - `unreachable`：后端不可达（无响应 / 网络中断 / HTTP 5xx）
   * 成功时该字段为空。
   */
  kind?: 'rejected' | 'unreachable'
  /** 后端业务码或 HTTP 状态码（仅失败时有值） */
  code?: number
  /** 失败原因：业务拒绝时为后端 message，不可达时为网络/HTTP 描述 */
  message?: string
  /** 成功时服务端返回的任务 */
  remote?: ComplianceCheck
}

/**
 * 把写操作的未知异常归一化为可区分的失败结果。
 *
 * 判定顺序很关键：先看有没有后端业务码（说明服务端收到了请求），
 * 再看有没有 5xx 之外的 HTTP 状态码，最后才归为不可达。
 *
 * @param error catch 到的未知异常
 * @returns 失败结果（ok 恒为 false）
 */
function toComplianceWriteFailure(error: unknown): ComplianceWriteResult {
  const bizError = asApiRequestError(error)
  if (bizError) {
    const bizCode = bizError.bizCode ?? 0
    // 后端 ErrorCode 的取值约定：4xx 是 HTTP 语义码（BAD_REQUEST 400 / NOT_FOUND 404），
    // 5xx 是服务端故障，其余是 2003 这类自定义业务码（一律视为"服务端明确答复"）。
    // 只有服务端故障才允许离线兜底；明确答复的一律不写本地，避免留下永远同步不上去的记录。
    const kind: ComplianceWriteResult['kind'] =
      bizCode >= 500 && bizCode <= 599 ? 'unreachable' : 'rejected'
    return {
      ok: false,
      kind,
      code: bizCode,
      message: bizError.message || '后端拒绝了本次提交',
    }
  }

  const status = httpStatusOf(error)
  if (status > 0 && status < 500) {
    // 未经业务包装的 4xx（网关/鉴权拦截等）：同样是"服务端收到了并拒绝"
    return {
      ok: false,
      kind: 'rejected',
      code: status,
      message: (error as Error)?.message || `请求被拒绝（HTTP ${status}）`,
    }
  }

  if (status >= 500) {
    return {
      ok: false,
      kind: 'unreachable',
      code: status,
      message: `后端服务异常（HTTP ${status}）`,
    }
  }

  return {
    ok: false,
    kind: 'unreachable',
    message: (error as Error)?.message || '后端不可达（无响应，可能是网络中断或服务未启动）',
  }
}

/**
 * 登记合规检查任务（POST /admin/farms/compliance）。
 *
 * 不抛异常；失败时返回带 `kind` 的结果，由调用方区分
 * 「后端明确拒绝（不写本地）」与「后端不可达（可离线兜底，但必须告知）」，
 * 不能像旧实现那样一律返回 null 后弹成功提示——那是骗人。
 *
 * @param payload 检查任务字段
 * @returns 写操作结果
 */
export async function createSupervisedComplianceTask(
  payload: Record<string, unknown>,
): Promise<ComplianceWriteResult> {
  try {
    const remote = await http.post<ComplianceCheck>(`${BASE}/compliance`, payload, { silent: true })
    return { ok: true, remote }
  } catch (error) {
    return toComplianceWriteFailure(error)
  }
}

/**
 * 更新合规检查任务（PUT /admin/farms/compliance/{checkId}）。
 *
 * 与创建同理：失败原因必须可区分，不能一律降级还说成功。
 *
 * @param checkId 检查编号
 * @param payload 待更新字段
 * @returns 写操作结果
 */
export async function updateSupervisedComplianceTask(
  checkId: BizId,
  payload: Record<string, unknown>,
): Promise<ComplianceWriteResult> {
  try {
    const remote = await http.put<ComplianceCheck>(`${BASE}/compliance/${checkId}`, payload, {
      silent: true,
    })
    return { ok: true, remote }
  } catch (error) {
    return toComplianceWriteFailure(error)
  }
}
