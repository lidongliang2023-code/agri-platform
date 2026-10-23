import axios from 'axios'

/**
 * 报价转订单。
 *
 * <p>此前这条链路是断的：接受报价只改报价状态、不生成订单。
 * 接口幂等（同一报价重复调用返回同一张订单），金额由服务端按报价口径计算。</p>
 */
export async function convertQuoteToOrder(quoteId: number | string) {
  const response = await axios.post(`/api/trade/negotiation/quote/${quoteId}/convert`)
  return response.data
}

export interface QuoteQuery {
  pageNum: number
  pageSize: number
  quoteNo?: string
  productName?: string
  sellerId?: number
  buyerId?: number | string
  quoteStatus?: string
}

export interface QuoteVO {
  id: number
  quoteNo: string
  inquiryId: number
  productId: number
  productName: string
  sellerId: number
  sellerName: string
  buyerId: number
  buyerName: string
  unitPrice: number
  quantity: number
  unit: string
  totalAmount: number
  freightAmount?: number
  orderId?: number | null
  /**
   * 有效期至。
   *
   * 表里只有 valid_until 一个 datetime 列（没有"天数"列），所以这里就是绝对时间点。
   * 原先 VO 上写的是 validDays / expireTime 两个都不存在的字段 ——
   * 列表"有效期"一列因此永远显示 undefined天，而新增表单提交的 validDays 后端从来没收过。
   */
  validUntil: string
  /** 质量等级以中文标签存在 quality_description 里（表里没有独立的质量等级列） */
  qualityDescription: string
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
