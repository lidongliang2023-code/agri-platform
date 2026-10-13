import axios from 'axios'

export interface DisputeQuery {
  pageNum: number
  pageSize: number
  disputeNo?: string
  orderId?: string
  applicantId?: string
  disputeStatus?: string
  /** 参与方范围：申请人或被申请人是此人（用户端必传，后端不再允许全量查询） */
  participantId?: number | string
  complainantId?: number | string
  respondentId?: number | string
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
