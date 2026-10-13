import axios from 'axios'

export interface QuoteQuery {
  pageNum: number
  pageSize: number
  quoteNo?: string
  productName?: string
  sellerId?: number
  quoteStatus?: string
}

export interface QuoteVO {
  id: number
  quoteNo: string
  demandId: number
  productId: number
  productName: string
  sellerId: number
  sellerName: string
  unitPrice: number
  quantity: number
  unit: string
  totalAmount: number
  validDays: number
  expireTime: string
  qualityLevel: string
  deliveryTime: string
  deliveryAddress: string
  remark: string
  quoteStatus: string
  createTime: string
  updateTime: string
}

export async function getQuoteList(params: QuoteQuery) {
  // 报价接口挂在 negotiation 下（/api/trade/quote/* 后端从未注册过）；
  // 分页端点是我这次补的 /negotiation/quote/page。
  const response = await axios.get('/api/trade/negotiation/quote/page', { params })
  return response.data
}

export async function getQuoteById(id: number) {
  const response = await axios.get(`/api/trade/negotiation/quote/${id}`)
  return response.data
}

export async function createQuote(data: Partial<QuoteVO>) {
  const response = await axios.post('/api/trade/negotiation/quote', data)
  return response.data
}

export async function updateQuote(id: number, data: Partial<QuoteVO>) {
  const response = await axios.put(`/api/trade/negotiation/quote/${id}`, data)
  return response.data
}

export async function deleteQuote(id: number) {
  const response = await axios.delete(`/api/trade/negotiation/quote/${id}`)
  return response.data
}

export async function acceptQuote(id: number) {
  const response = await axios.post(`/api/trade/negotiation/quote/${id}/accept`)
  return response.data
}

export async function rejectQuote(id: number, reason: string) {
  const response = await axios.post(`/api/trade/negotiation/quote/${id}/reject`, { reason })
  return response.data
}
