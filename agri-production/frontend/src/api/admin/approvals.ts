/**
 * 运营端 - 审批管理 API
 */
import { http } from '@/utils/request'
import type { PageQuery, PageResult } from '@/types'
import type { Approval, ApprovalFlowConfig } from '@/types'

const BASE = '/admin/approvals'

/** 审批列表查询参数 */
export interface ApprovalListParams extends PageQuery {
  approvalType?: number
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

/** 分页查询审批流程配置 */
export function listApprovalFlows(
  params: PageQuery & { approvalType?: number },
): Promise<PageResult<ApprovalFlowConfig>> {
  return http.get<PageResult<ApprovalFlowConfig>>(`${BASE}/config`, params)
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
