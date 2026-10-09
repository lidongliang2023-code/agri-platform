/**
 * 农场管理 API
 */
import { http } from '@/utils/request'
import type { Farm, FarmCert } from '@/types'
import type { PageQuery, PageResult } from '@/types'

const BASE = '/farms'

/** 农场列表查询参数 */
export interface FarmListParams extends PageQuery {
  farmName?: string
  farmType?: number
  status?: number
  province?: string
}

/** 农场新增 / 编辑入参 */
export type FarmPayload = Partial<Farm>

/** 分页查询农场列表 */
export function listFarms(params: FarmListParams): Promise<PageResult<Farm>> {
  return http.get<PageResult<Farm>>(BASE, params)
}

/** 查询全部农场（下拉用，不分页） */
export function listAllFarms(): Promise<Farm[]> {
  return http.get<Farm[]>(`${BASE}/all`)
}

/** 查询农场详情 */
export function getFarm(farmId: string): Promise<Farm> {
  return http.get<Farm>(`${BASE}/${farmId}`)
}

/**
 * 新增农场（POST /farms）。
 *
 * 后端 `FarmController.create` 返回 `ApiResponse<String>`，即**新农场的 farmId**，不是实体。
 *
 * @param payload 农场入参
 * @returns 新农场 ID
 */
export function createFarm(payload: FarmPayload): Promise<string> {
  return http.post<string>(BASE, payload)
}

/** 更新农场 */
export function updateFarm(farmId: string, payload: FarmPayload): Promise<Farm> {
  return http.put<Farm>(`${BASE}/${farmId}`, payload)
}

/**
 * 删除农场（DELETE /farms/{farmId}）。
 *
 * 后端返回 `ApiResponse<Void>`（data 为 null），成功与否由拦截器 reject 表达。
 */
export function deleteFarm(farmId: string): Promise<void> {
  return http.delete<void>(`${BASE}/${farmId}`)
}

/**
 * 启停农场（PATCH /farms/{farmId}/status）。
 *
 * ⚠️ 后端 `FarmController.changeStatus` 的 status 是 **`@RequestParam`**，
 * 不是 `@RequestBody`——塞进 JSON body 会被 Spring 判为缺失参数并返回 400。
 * 因此这里必须走 query 而不是 body。
 *
 * 后端返回 `ApiResponse<FarmInfoEntity>`（更新后的农场实体），不是 boolean。
 *
 * @param farmId 农场 ID
 * @param status 目标状态
 * @returns 更新后的农场信息
 */
export function updateFarmStatus(farmId: string, status: number): Promise<Farm> {
  return http.patch<Farm>(`${BASE}/${farmId}/status?status=${status}`)
}

/** 查询农场概况统计 */
export function getFarmSummary(farmId: string): Promise<Record<string, number>> {
  return http.get<Record<string, number>>(`${BASE}/${farmId}/summary`)
}

/* ============================================================================
 * 农场资质证照（对齐后端 FarmController）
 *   GET    /{farmId}/certs              → ApiResponse<PageResult<FarmCertEntity>>  真分页，支持 keyword / status
 *   POST   /{farmId}/certs              → ApiResponse<String>                      返回新 certId
 *   DELETE /{farmId}/certs/{certId}     → ApiResponse<Void>                        data 为 null
 *   POST   /{farmId}/certs/{certId}/verify → ApiResponse<FarmCertEntity>           审核 / 核验
 * ========================================================================== */

/** 资质证照新增 / 编辑入参（字段命名对齐后端 FarmCertEntity） */
export type FarmCertPayload = Partial<FarmCert>

/** 分页查询农场资质证照（GET /{farmId}/certs） */
export function listFarmCerts(
  farmId: string,
  params: PageQuery & { keyword?: string; status?: number },
): Promise<PageResult<FarmCert>> {
  return http.get<PageResult<FarmCert>>(`${BASE}/${farmId}/certs`, params)
}

/**
 * 新增农场资质证照（POST /{farmId}/certs）。
 *
 * 后端返回新记录的 certId。
 *
 * @param farmId 农场 ID
 * @param payload 证照入参
 * @returns 新证照 ID
 */
export function createFarmCert(farmId: string, payload: FarmCertPayload): Promise<string> {
  return http.post<string>(`${BASE}/${farmId}/certs`, payload)
}

/**
 * 删除农场资质证照（DELETE /{farmId}/certs/{certId}）。
 *
 * 后端返回 `ApiResponse<Void>`，成功与否由拦截器 reject 表达。
 */
export function deleteFarmCert(farmId: string, certId: string): Promise<void> {
  return http.delete<void>(`${BASE}/${farmId}/certs/${certId}`)
}

/** 核验 / 审核农场资质证照（POST /{farmId}/certs/{certId}/verify） */
export function verifyFarmCert(farmId: string, certId: string): Promise<FarmCert> {
  return http.post<FarmCert>(`${BASE}/${farmId}/certs/${certId}/verify`)
}
