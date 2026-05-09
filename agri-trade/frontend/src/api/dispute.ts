import axios from 'axios'

export interface DisputeQuery {
  pageNum: number
  pageSize: number
  disputeNo?: string
  orderId?: string
  applicantId?: string
  disputeStatus?: string
}

export interface DisputeVO {
  id: number
  disputeNo: string
  orderId: number
  applicantId: number
  applicantName: string
  respondentId: number
  respondentName: string
  disputeType: string
  disputeAmount: number
  claimAmount: number
  disputeContent: string
  disputeStatus: string
  createTime: string
  updateTime: string
}

export async function getDisputeList(params: DisputeQuery) {
  const response = await axios.get('/api/trade/dispute/list', { params })
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