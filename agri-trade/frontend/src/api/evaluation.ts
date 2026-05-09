import axios from 'axios'

export interface EvaluationQuery {
  pageNum: number
  pageSize: number
  evaluationNo?: string
  orderId?: string
  evaluatorId?: string
  evaluateeId?: string
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
  appealStatus: string
  createTime: string
  updateTime: string
}

export async function getEvaluationList(params: EvaluationQuery) {
  const response = await axios.get('/api/trade/evaluation/list', { params })
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