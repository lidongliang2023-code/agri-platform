/**
 * 运营端 - 农场监管 API（含 GIS 与合规检查）
 */
import { http } from '@/utils/request'
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

/** 分页查询合规检查记录 */
export function listComplianceChecks(
  params: PageQuery & { farmId?: string; result?: number },
): Promise<PageResult<ComplianceCheck>> {
  return http.get<PageResult<ComplianceCheck>>(
    `${BASE}/compliance`,
    params,
  )
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
 * 登记合规检查任务（后端优先，端点未开放时返回 null 由页面降级为本地登记）
 *
 * 使用 silent 配置，避免端点未开放时弹出全局错误提示。
 */
export function createSupervisedComplianceTask(
  payload: Record<string, unknown>,
): Promise<ComplianceCheck | null> {
  return http
    .post<ComplianceCheck>(`${BASE}/compliance`, payload, { silent: true })
    .catch(() => null)
}

/**
 * 更新合规检查任务（后端优先，端点未开放时返回 null 由页面降级为本地登记）
 */
export function updateSupervisedComplianceTask(
  checkId: BizId,
  payload: Record<string, unknown>,
): Promise<ComplianceCheck | null> {
  return http
    .put<ComplianceCheck>(`${BASE}/compliance/${checkId}`, payload, { silent: true })
    .catch(() => null)
}
