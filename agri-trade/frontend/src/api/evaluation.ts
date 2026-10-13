import axios from 'axios'

export interface EvaluationQuery {
  pageNum: number
  pageSize: number
  evaluationNo?: string
  orderId?: string
  evaluatorId?: string
  evaluateeId?: string
  /** 综合评分：按整星等值匹配（后端就是等值查） */
  ratingOverall?: number
}

export interface EvaluationVO {
  id: number
  evaluationNo: string
  orderId: number
  evaluatorId: number
  evaluatorName: string
  evaluateeId: number
  evaluateeName: string
  ratingOverall: number
  ratingQuality: number
  ratingService: number
  ratingDelivery: number
  evaluationContent: string
  /** 被评价方的回复（只允许回一次） */
  replyContent: string | null
  replyTime: string | null
  evaluationStatus: string
  // 评价表里没有 appealStatus 这个字段（申诉是独立的 agri_trade_evaluation_appeal 表）。
  // 原先这里带着它，页面上"是否匿名"那一列就去读了一个永远不存在的键。
  isAnonymous: number
  createTime: string
  updateTime: string
}

export async function getEvaluationList(params: EvaluationQuery) {
  const response = await axios.get('/api/trade/evaluation/page', { params })
  return response.data
}

export async function getEvaluationById(id: number) {
  const response = await axios.get(`/api/trade/evaluation/${id}`)
  return response.data
}

export async function createEvaluation(data: any) {
  const response = await axios.post('/api/trade/evaluation', data)
  return response.data
}

export async function appealEvaluation(id: number, data: any) {
  const response = await axios.post(`/api/trade/evaluation/${id}/appeal`, data)
  return response.data
}

/**
 * 回复评价（被评价方的官方回应，只能回一次）。
 *
 * 服务端会判定"你是不是被评价方"——回复在页面上是挂着商家名的，
 * 不能谁都能替商家说一句。
 */
export async function replyEvaluation(id: number, content: string) {
  const response = await axios.put(`/api/trade/evaluation/${id}/reply`, { content })
  return response.data
}
