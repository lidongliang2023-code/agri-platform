import axios from 'axios'

/**
 * 承运商管理（运营端）。
 *
 * 承运商是全平台共用的运力主数据。原先只有用户侧的 page/list/create，
 * 而"新增承运商"挂在用户侧路径上、没有任何校验 —— 任何登录用户都能往运力库里加一条。
 * 新增与启停归到运营端；用户侧保留读接口，物流编辑时选承运商要用。
 */
export interface CarrierRow {
  id: number
  carrierCode: string
  carrierName: string
  carrierType: string
  contactPerson: string
  contactPhone: string
  servicePhone: string
  province: string
  city: string
  address: string
  serviceScope: string
  coverageCities: string
  avgDeliveryHours: number
  rating: number
  orderCount: number
  onTimeRate: number
  damageRate: number
  status: number
  createTime: string
}

export async function getCarrierPage(params: {
  pageNum: number
  pageSize: number
  carrierName?: string
  status?: number
}) {
  const response = await axios.get('/api/trade/admin/carrier/page', { params })
  return response.data
}

export async function createCarrier(data: Partial<CarrierRow>) {
  const response = await axios.post('/api/trade/admin/carrier', data)
  return response.data
}

export async function changeCarrierStatus(id: number, status: number) {
  const response = await axios.post(`/api/trade/admin/carrier/${id}/status`, { status })
  return response.data
}
