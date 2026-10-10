/**
 * 运营端 - 审批管理 API
 */
import { http, toPageResult } from '@/utils/request'
import type { PageQuery, PageResult } from '@/types'
import type { Approval, ApprovalFlowConfig } from '@/types'

const BASE = '/admin/approvals'

/**
 * 审批列表查询参数。
 *
 * `approvalType` 在后端是 `prod_approval.biz_type` **字符串枚举**
 * （CERT / RECALL / QUOTA），不是数字；历史页按字符串传值，
 * 故此处放宽为 `number | string`（旧数字口径调用方不受影响）。
 */
export interface ApprovalListParams extends PageQuery {
  approvalType?: number | string
  status?: number
  tenantId?: string
  applicantName?: string
}

/** 分页查询待审批列表 */
export function listApprovals(params: ApprovalListParams): Promise<PageResult<Approval>> {
  return http.get<PageResult<Approval>>(BASE, params)
}

/** 查询审批详情 */
export function getApproval(approvalId: string): Promise<Approval> {
  return http.get<Approval>(`${BASE}/${approvalId}`)
}

/** 审批通过 */
export function approveApproval(
  approvalId: string,
  payload: { remark?: string },
): Promise<boolean> {
  return http.patch<boolean>(`${BASE}/${approvalId}/approve`, payload)
}

/** 审批驳回 */
export function rejectApproval(
  approvalId: string,
  payload: { remark: string },
): Promise<boolean> {
  return http.patch<boolean>(`${BASE}/${approvalId}/reject`, payload)
}

/** 批量审批 */
export function batchApprove(
  approvalIds: string[],
  payload: { remark?: string },
): Promise<boolean> {
  return http.patch<boolean>(`${BASE}/batch-approve`, { approvalIds, ...payload })
}

/** 分页查询审批历史 */
export function listApprovalHistory(
  params: ApprovalListParams,
): Promise<PageResult<Approval>> {
  return http.get<PageResult<Approval>>(`${BASE}/history`, params)
}

/**
 * 分页查询审批流程配置
 *
 * ⚠️ 实测（core-app 直连）：`GET /api/v1/production/admin/approvals/config`
 * 返回 `{ code: 0, data: [...] }`——`data` 是**裸数组**而非 PageResult
 * （后端 AdminApprovalController#config 直接返回 List，且不接受 page/size）。
 * 响应拦截器的 `normalizePageData` 只认 `{ records: [...] }`，裸数组会原样透传，
 * 调用方解构出的 `list` 恒为 undefined。故在此统一用 `toPageResult` 补成分页结构。
 *
 * 函数签名保持 `Promise<PageResult<ApprovalFlowConfig>>` 不变，
 * 页面（ApprovalConfig.tsx）无需改动。
 */
export async function listApprovalFlows(
  params: PageQuery & { approvalType?: number },
): Promise<PageResult<ApprovalFlowConfig>> {
  const raw = await http.get<unknown>(`${BASE}/config`, params)
  return toPageResult<ApprovalFlowConfig>(raw, params)
}

/** 查询审批流程配置详情 */
export function getApprovalFlow(flowId: string): Promise<ApprovalFlowConfig> {
  return http.get<ApprovalFlowConfig>(`${BASE}/config/${flowId}`)
}

/** 新增审批流程配置 */
export function createApprovalFlow(
  payload: Partial<ApprovalFlowConfig>,
): Promise<ApprovalFlowConfig> {
  return http.post<ApprovalFlowConfig>(`${BASE}/config`, payload)
}

/** 更新审批流程配置 */
export function updateApprovalFlow(
  flowId: string,
  payload: Partial<ApprovalFlowConfig>,
): Promise<ApprovalFlowConfig> {
  return http.put<ApprovalFlowConfig>(`${BASE}/config/${flowId}`, payload)
}

/** 删除审批流程配置 */
export function deleteApprovalFlow(flowId: string): Promise<boolean> {
  return http.delete<boolean>(`${BASE}/config/${flowId}`)
}
