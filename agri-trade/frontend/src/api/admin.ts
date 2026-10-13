/**
 * 运营端接口（/admin/trade/*）。
 *
 * <p>与用户端接口分开一个文件：两者的数据范围不同，混在一起时很容易出现
 * "运营端页面调了用户端接口"这种越权调用。</p>
 */
import axios from 'axios'

export interface AdminSummary {
  orderCount: number
  totalAmount: number
  paidAmount: number
  pendingPaymentCount: number
  completedCount: number
  refundingCount: number
  avgOrderAmount: number
}

export interface AdminTodos {
  pendingProductCount: number
  openDisputeCount: number
  refundingOrderCount: number
}

export interface TrendPoint {
  date: string
  count: number
  amount: number
}

export interface GroupStat {
  name: string
  count: number
  amount: number
}

export interface AdminOverview {
  summary: AdminSummary
  todos: AdminTodos
  trend: TrendPoint[]
  categoryStats: GroupStat[]
  regionStats: GroupStat[]
}

export async function getAdminOverview() {
  const response = await axios.get('/admin/trade/dashboard/overview')
  return response.data
}

export async function getAdminProductPage(params: Record<string, unknown>) {
  const response = await axios.get('/admin/trade/product/page', { params })
  return response.data
}

/** 货源审核：approved=true 通过、false 驳回；auditRemark 是会留痕的审核意见 */
export async function auditProduct(id: number | string, approved: boolean, auditRemark?: string) {
  const response = await axios.post(`/admin/trade/product/${id}/audit`, { approved, auditRemark })
  return response.data
}

export async function getAdminOrderPage(params: Record<string, unknown>) {
  const response = await axios.get('/admin/trade/order/page', { params })
  return response.data
}

export async function getAdminOrderDetail(id: number | string) {
  const response = await axios.get(`/admin/trade/order/${id}`)
  return response.data
}
