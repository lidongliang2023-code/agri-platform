import axios from 'axios'

export interface DisputeQuery {
  pageNum: number
  pageSize: number
  orderId?: string
  disputeStatus?: string
  disputeNo?: string
}

export interface DisputeVO {
  id: number
  disputeNo: string
  orderId: number
  // 纠纷表的申请人是 complainant*（不是 applicant*），被申请人是 respondent*
  complainantId: number
  complainantName: string
  respondentId: number
  respondentName: string
  disputeType: string
  disputeReason: string
  disputeDescription: string
  claimAmount: number
  disputeStatus: string
  processStage: string
  mediationResult: string
  arbitrationResult: string
  compensationAmount: number
  closeTime: string
  closeReason: string
  createTime: string
  updateTime: string
}

export async function getDisputeList(params: DisputeQuery) {
  const response = await axios.get('/api/trade/dispute/page', { params })
  return response.data
}

export async function getDisputeById(id: number) {
  const response = await axios.get(`/api/trade/dispute/${id}`)
  return response.data
}

export async function createDispute(data: any) {
  const response = await axios.post('/api/trade/dispute', data)
  return response.data
}

export async function resolveDispute(id: number, data: any) {
  const response = await axios.post(`/api/trade/dispute/${id}/resolve`, data)
  return response.data
}
