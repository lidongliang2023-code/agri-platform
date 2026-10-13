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
  matchType?: string
}

/**
 * 撮合记录（列表用）。
 *
 * <p>注意这不是 MatchRecord 实体：记录表里只有 demandId/productId，没有商品名与供应商名。
 * 后端在 /match/list 里已经把名称补好再返回 —— 直接读实体字段只会得到两列空白。</p>
 */
export interface MatchRecordVO {
  id: number
  matchNo: string
  demandId: number
  demandNo: string
  demandName: string
  productId: number
  productName: string
  productCode: string
  sellerId: number
  sellerName: string
  matchType: string
  matchScore: number
  categoryScore: number
  priceScore: number
  distanceScore: number
  qualityScore: number
  matchReason: string
  recommendOrder: number
  inquiryStatus: string
  orderStatus: string
  orderId: number
  createTime: string
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
