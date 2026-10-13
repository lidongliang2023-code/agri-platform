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
  /**
   * 收发地址用 sender_* / receiver_* 命名。
   * 原先这里写的是 pickupAddress / deliveryAddress —— 那是订单表的字段名，
   * 物流表里没有，页面上收货地址那一列因此永远是空的。
   */
  senderAddress: string
  receiverAddress: string
  receiverContact: string
  receiverPhone: string
  logisticsStatus: string
  currentLocation: string
  pickupTime: string
  deliveryTime: string
  signTime: string
  signReceiver: string
  createTime: string
  updateTime: string
}

export interface LogisticsTraceVO {
  id: number
  logisticsId: number
  traceNo: string
  traceTime: string
  traceStatus: string
  traceLocation: string
  traceDescription: string
}

export async function getLogisticsList(params: LogisticsQuery) {
  const response = await axios.get('/api/trade/logistics/page', { params })
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

export async function updateLogisticsStatus(
  id: number,
  status: string,
  extra?: { location?: string; signReceiver?: string }
) {
  // 后端注册的是 POST（与 /order/{id}/status 等同形），前端原来写的是 PUT ——
  // 方法对不上，请求会被拒成 405，页面上只会显示"更新失败"。
  const response = await axios.post(`/api/trade/logistics/${id}/status`, { status, ...extra })
  return response.data
}

/** 物流轨迹（后端 /{id}/traces 早就有了，前端一直没有入口调用）。 */
export async function getLogisticsTraces(id: number) {
  const response = await axios.get(`/api/trade/logistics/${id}/traces`)
  return response.data
}

export async function deleteLogistics(id: number) {
  const response = await axios.delete(`/api/trade/logistics/${id}`)
  return response.data
}

/**
 * 修改物流单（承运商、类型、运费、收发信息、预计送达）。
 *
 * 这个接口此前**根本不存在** —— 物流单一旦创建，承运商就再也改不了
 * （页面上的"编辑"只能改状态）。状态仍然走 /{id}/status（那会写轨迹）。
 */
export async function updateLogistics(id: number, data: Record<string, unknown>) {
  const response = await axios.put(`/api/trade/logistics/${id}`, data)
  return response.data
}

/** 承运商列表（物流编辑时选用）。 */
export interface CarrierVO {
  id: number
  carrierCode: string
  carrierName: string
  carrierType: string
  contactPerson: string
  contactPhone: string
  status: number
}

export async function getCarriers() {
  const response = await axios.get('/api/trade/logistics/carrier/list')
  return response.data
}
