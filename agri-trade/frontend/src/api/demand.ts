import axios from 'axios'

export interface DemandQuery {
  pageNum: number
  pageSize: number
  demandNo?: string
  buyerId?: number | string
  categoryId?: number | string
  demandStatus?: string
  /** 模糊搜索：需求名称 / 商品名称 / 品种（后端 keyword 参数） */
  keyword?: string
}

export interface DemandVO {
  id: number
  demandNo: string
  buyerId: number
  buyerName: string
  categoryId: number
  categoryName: string
  variety: string
  quantity: number
  priceMin: number
  priceMax: number
  deliveryAddress: string
  demandStatus: string
  responseCount: number
  createTime: string
  updateTime: string
}

export async function getDemandList(params: DemandQuery) {
  const response = await axios.get('/api/trade/demand/page', { params })
  return response.data
}

export async function getDemandById(id: number) {
  const response = await axios.get(`/api/trade/demand/${id}`)
  return response.data
}

export async function createDemand(data: any) {
  const response = await axios.post('/api/trade/demand', data)
  return response.data
}

export async function updateDemand(id: number, data: any) {
  const response = await axios.put(`/api/trade/demand/${id}`, data)
  return response.data
}

export async function deleteDemand(id: number) {
  const response = await axios.delete(`/api/trade/demand/${id}`)
  return response.data
}

/** 对某条需求触发一次撮合，返回是否已生成匹配记录 */
export async function matchDemand(id: number) {
  const response = await axios.post(`/api/trade/demand/${id}/match`)
  return response.data
}

/** 某条需求的撮合结果 */
export async function getDemandMatches(id: number | string) {
  const response = await axios.get(`/api/trade/demand/${id}/matches`)
  return response.data
}

/** 自然语言解析结果（INlpParseService.ParsedDemandResult） */
export interface ParsedDemand {
  productName?: string
  quantity?: string
  unit?: string
  price?: string
  location?: string
  timeRange?: string
  quality?: string
  additionalRequirements?: string
}

/** 自然语言 → 结构化需求（PRD 第 11 章：需求发布支持 NLP 解析） */
export async function parseNaturalLanguage(text: string) {
  const response = await axios.post('/api/trade/nlp/parse', { text })
  return response.data
}
