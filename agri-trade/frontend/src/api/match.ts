import axios from 'axios'

export interface MatchResult {
  id: number
  matchNo: string
  demandId: number
  productId: number
  productName: string
  sellerId: number
  sellerName: string
  matchScore: number
  categoryScore: number
  priceScore: number
  distanceScore: number
  qualityScore: number
  matchReason: string
  matchStatus: string
  createTime: string
}

export interface MatchQuery {
  pageNum: number
  pageSize: number
  demandId?: number
  productId?: number
  matchStatus?: string
}

export async function matchDemandToProducts(demandId: number, limit: number = 10) {
  const response = await axios.post(`/api/trade/match/demand/${demandId}`, null, {
    params: { limit }
  })
  return response.data
}

export async function matchProductToDemands(productId: number, limit: number = 10) {
  const response = await axios.post(`/api/trade/match/product/${productId}`, null, {
    params: { limit }
  })
  return response.data
}

export async function getMatchRecordsByDemand(demandId: number) {
  const response = await axios.get(`/api/trade/match/demand/${demandId}/records`)
  return response.data
}

export async function getMatchRecordsByProduct(productId: number) {
  const response = await axios.get(`/api/trade/match/product/${productId}/records`)
  return response.data
}

export async function updateMatchScore(recordId: number, score: number) {
  const response = await axios.put(`/api/trade/match/${recordId}/score`, { score })
  return response.data
}

export async function getMatchList(params: MatchQuery) {
  const response = await axios.get('/api/trade/match/list', { params })
  return response.data
}