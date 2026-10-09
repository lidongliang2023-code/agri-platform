/**
 * 运营端 - 异常告警 API（告警 / 应急预案 / 灾害复盘）
 */
import { http } from '@/utils/request'
import type { PageQuery, PageResult } from '@/types'
import type { Alert, DisasterReview, EmergencyPlan } from '@/types'

const BASE = '/admin/alerts'

/** 分页查询告警中心列表 */
export function listAdminAlerts(
  params: PageQuery & { tenantId?: string; alertLevel?: number; status?: number },
): Promise<PageResult<Alert>> {
  return http.get<PageResult<Alert>>(BASE, params)
}

/** 查询告警详情 */
export function getAdminAlert(alertId: string): Promise<Alert> {
  return http.get<Alert>(`${BASE}/${alertId}`)
}

/** 指派告警处理人 */
export function dispatchAlert(alertId: string, handlerId: string): Promise<boolean> {
  return http.patch<boolean>(`${BASE}/${alertId}/dispatch`, { handlerId })
}

/** 关闭告警 */
export function closeAlert(alertId: string, remark?: string): Promise<boolean> {
  return http.patch<boolean>(`${BASE}/${alertId}/close`, { remark })
}

/** 分页查询应急预案 */
export function listEmergencyPlans(
  params: PageQuery & { alertType?: string; status?: number },
): Promise<PageResult<EmergencyPlan>> {
  return http.get<PageResult<EmergencyPlan>>(
    `${BASE}/emergency`,
    params,
  )
}

/** 查询应急预案详情 */
export function getEmergencyPlan(planId: string): Promise<EmergencyPlan> {
  return http.get<EmergencyPlan>(`${BASE}/emergency/${planId}`)
}

/** 新增应急预案 */
export function createEmergencyPlan(payload: Partial<EmergencyPlan>): Promise<EmergencyPlan> {
  return http.post<EmergencyPlan>(`${BASE}/emergency`, payload)
}

/** 更新应急预案 */
export function updateEmergencyPlan(
  planId: string,
  payload: Partial<EmergencyPlan>,
): Promise<EmergencyPlan> {
  return http.put<EmergencyPlan>(`${BASE}/emergency/${planId}`, payload)
}

/** 删除应急预案 */
export function deleteEmergencyPlan(planId: string): Promise<boolean> {
  return http.delete<boolean>(`${BASE}/emergency/${planId}`)
}

/** 分页查询灾害事件复盘 */
export function listDisasterReviews(
  params: PageQuery & { disasterType?: string },
): Promise<PageResult<DisasterReview>> {
  return http.get<PageResult<DisasterReview>>(`${BASE}/review`, params)
}

/** 新增灾害事件复盘 */
export function createDisasterReview(
  payload: Partial<DisasterReview>,
): Promise<DisasterReview> {
  return http.post<DisasterReview>(`${BASE}/review`, payload)
}

/** 更新灾害事件复盘 */
export function updateDisasterReview(
  reviewId: string,
  payload: Partial<DisasterReview>,
): Promise<DisasterReview> {
  return http.put<DisasterReview>(`${BASE}/review/${reviewId}`, payload)
}

/** 删除灾害事件复盘 */
export function deleteDisasterReview(reviewId: string): Promise<boolean> {
  return http.delete<boolean>(`${BASE}/review/${reviewId}`)
}
