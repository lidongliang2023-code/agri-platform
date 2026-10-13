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
