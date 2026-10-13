import axios from 'axios'

/**
 * 信用管理（运营端）：评价监管 + 申诉处理。
 *
 * 路径都在 /api/trade/admin/ 下，受运营角色校验保护。
 */
export interface CreditEvaluation {
  id: number
  evaluationNo: string
  orderId: number
  evaluatorName: string
  evaluateeName: string
  ratingOverall: number
  evaluationContent: string
  evaluationStatus: string
  hideReason: string
  isAnonymous: number
  createTime: string
}

export interface CreditAppeal {
  id: number
  appealNo: string
  evaluationId: number
  appealType: string
  appealReason: string
  appealEvidence: string
  appellantName: string
  appealStatus: string
  reviewer: string
  reviewTime: string
  reviewRemark: string
  createTime: string
  // 关联评价（服务端补齐，避免列表上只有一串编号没法判断）
  evaluationNo: string
  orderId: number
  evaluatorName: string
  evaluateeName: string
  ratingOverall: number
  evaluationStatus: string
  evaluationContent: string
}

export async function getCreditEvaluations(params: {
  pageNum: number
  pageSize: number
  evaluationNo?: string
  ratingOverall?: number
  evaluationStatus?: string
}) {
  const response = await axios.get('/api/trade/admin/credit/evaluation/page', { params })
  return response.data
}

export async function changeEvaluationStatus(id: number, action: 'hide' | 'restore', reason?: string) {
  const response = await axios.post(`/api/trade/admin/credit/evaluation/${id}/status`, { action, reason })
  return response.data
}

export async function getCreditAppeals(params: { pageNum: number; pageSize: number; appealStatus?: string }) {
  const response = await axios.get('/api/trade/admin/credit/appeal/page', { params })
  return response.data
}

export async function auditCreditAppeal(id: number, status: 'approved' | 'rejected', remark?: string) {
  const response = await axios.post(`/api/trade/admin/credit/appeal/${id}/audit`, { status, remark })
  return response.data
}
