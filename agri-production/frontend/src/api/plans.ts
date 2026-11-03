/**
 * 种养计划 API（含农事日历）
 */
import { http } from '@/utils/request'
import type { PageQuery, PageResult } from '@/types'
import type { Plan, PlanStage } from '@/types'

const BASE = '/plans'

/** 种养计划列表查询参数 */
export interface PlanListParams extends PageQuery {
  farmId?: string
  planName?: string
  cropId?: string
  status?: number
  startDate?: string
  endDate?: string
}

/** 种养计划新增 / 编辑入参 */
export type PlanPayload = Partial<Plan>

/** 分页查询种养计划列表 */
export function listPlans(params: PlanListParams): Promise<PageResult<Plan>> {
  return http.get<PageResult<Plan>>(BASE, params)
}

/** 查询种养计划详情 */
export function getPlan(planId: string): Promise<Plan> {
  return http.get<Plan>(`${BASE}/${planId}`)
}

/** 新增种养计划 */
export function createPlan(payload: PlanPayload): Promise<string> {
  return http.post<string>(BASE, payload)
}

/** 更新种养计划 */
export function updatePlan(planId: string, payload: PlanPayload): Promise<Plan> {
  return http.put<Plan>(`${BASE}/${planId}`, payload)
}

/** 删除种养计划 */
export function deletePlan(planId: string): Promise<void> {
  return http.delete<void>(`${BASE}/${planId}`)
}

/** 提交种养计划审批 */
export function submitPlan(planId: string): Promise<boolean> {
  return http.patch<boolean>(`${BASE}/${planId}/submit`)
}

/**
 * 查询计划阶段列表。
 *
 * <p>必须走 `/plans/{id}/stages/list`：不带 `/list` 的那条是**分页接口**，
 * 返回 `{ records, total, page, size }` 对象。此前这里按数组声明、页面直接 `.map()`，
 * 选择种养计划后阶段查询一返回就抛 `(intermediate value).map is not a function`，
 * 新建任务页整页报错（2026-11-02 实测）。</p>
 */
export function listPlanStages(planId: string): Promise<PlanStage[]> {
  return http.get<PlanStage[]>(`${BASE}/${planId}/stages/list`)
}

/** 查询农事日历（按时间区间聚合阶段） */
export function listCalendar(params: {
  farmId?: string
  startDate: string
  endDate: string
}): Promise<PlanStage[]> {
  return http.get<PlanStage[]>(`${BASE}/calendar`, params)
}
