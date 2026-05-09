import axios from 'axios'

export interface LogisticsQuery {
  pageNum: number
  pageSize: number
  logisticsNo?: string
  orderId?: string
  carrierId?: string
  logisticsStatus?: string
}

export interface LogisticsVO {
  id: number
  logisticsNo: string
  orderId: number
  carrierId: number
  carrierName: string
  logisticsType: string
  freightAmount: number
  pickupAddress: string
  deliveryAddress: string
  logisticsStatus: string
  createTime: string
  updateTime: string
}

export async function getLogisticsList(params: LogisticsQuery) {
  const response = await axios.get('/api/trade/logistics/list', { params })
  return response.data
}

export async function getLogisticsById(id: number) {
  const response = await axios.get(`/api/trade/logistics/${id}`)
  return response.data
}

export async function createLogistics(data: any) {
  const response = await axios.post('/api/trade/logistics', data)
  return response.data
}

export async function updateLogisticsStatus(id: number, status: string) {
  const response = await axios.put(`/api/trade/logistics/${id}/status`, { status })
  return response.data
}