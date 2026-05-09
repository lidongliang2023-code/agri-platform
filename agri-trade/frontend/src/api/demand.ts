import axios from 'axios'

export interface DemandQuery {
  pageNum: number
  pageSize: number
  demandNo?: string
  buyerId?: string
  categoryId?: string
  demandStatus?: string
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
  const response = await axios.get('/api/trade/demand/list', { params })
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