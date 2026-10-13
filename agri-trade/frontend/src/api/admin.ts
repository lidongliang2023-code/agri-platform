/**
 * 运营端接口（/api/trade/admin/*）。
 *
 * <p>前缀刻意**不带 /admin/trade**：那个前缀是运营端的**页面路由**（/admin/trade/order 是页面）。
 * 接口与页面共用一个前缀时，网关没法区分"要一张页面"还是"要一份数据" ——
 * 放行接口就会让直接刷新页面变成 404。规则：页面归 /admin/**，接口一律归 /api/**。</p>
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
  const response = await axios.get('/api/trade/admin/dashboard/overview')
  return response.data
}

export async function getAdminProductPage(params: Record<string, unknown>) {
  const response = await axios.get('/api/trade/admin/product/page', { params })
  return response.data
}

/** 货源审核：approved=true 通过、false 驳回；auditRemark 是会留痕的审核意见 */
export async function auditProduct(id: number | string, approved: boolean, auditRemark?: string) {
  const response = await axios.post(`/api/trade/admin/product/${id}/audit`, { approved, auditRemark })
  return response.data
}

export async function getAdminOrderPage(params: Record<string, unknown>) {
  const response = await axios.get('/api/trade/admin/order/page', { params })
  return response.data
}

export async function getAdminOrderDetail(id: number | string) {
  const response = await axios.get(`/api/trade/admin/order/${id}`)
  return response.data
}

/* ------------------------------ 纠纷仲裁 ------------------------------ */

export async function getAdminDisputePage(params: Record<string, unknown>) {
  const response = await axios.get('/api/trade/admin/dispute/page', { params })
  return response.data
}

/**
 * 调解。
 *
 * <p>走的仍是用户端那套 dispute 接口：**读**要按数据范围分开（运营看全平台、用户看自己的），
 * 但**写**是针对具体某一单的操作、没有范围歧义，共享同一份实现可以避免两处逻辑漂移。
 * 后端语义：result 为 'agreed' 才结案，其余结果会转入仲裁阶段。</p>
 */
export async function mediateDispute(id: number | string, mediator: string, result: string) {
  const response = await axios.post(`/api/trade/dispute/${id}/mediation`, { mediator, result })
  return response.data
}

/** 仲裁：结果落库并把纠纷置为 resolved */
export async function arbitrateDispute(id: number | string, arbitrator: string, result: string) {
  const response = await axios.post(`/api/trade/dispute/${id}/arbitration`, { arbitrator, result })
  return response.data
}

/* ------------------------------ 退款审核 ------------------------------ */

export async function getAdminRefundPage(params: Record<string, unknown>) {
  const response = await axios.get('/api/trade/admin/refund/page', { params })
  return response.data
}

/**
 * 退款审核。
 *
 * <p>status='approved' 时后端会把订单置为 refunded、并把退款额累加进订单已退金额；
 * 驳回只改退款单状态，不动订单。</p>
 */
export async function auditRefund(
  id: number | string,
  status: 'approved' | 'rejected',
  reviewer: string,
  remark?: string
) {
  const response = await axios.post(`/api/trade/order/refund/${id}/audit`, { status, reviewer, remark })
  return response.data
}

/* ------------------------------ 赔付执行 ------------------------------ */

export async function getAdminCompensationPage(params: Record<string, unknown>) {
  const response = await axios.get('/api/trade/admin/compensation/page', { params })
  return response.data
}

/**
 * 新建赔付单。
 *
 * <p>这个接口此前**没有任何前端调用** —— 赔付执行页只有"核准/打款"，
 * 于是"要赔一笔钱"这件事只能靠人工写库。仲裁判了"支持申请人"之后，
 * 后端现在会自动落一张待审核的赔付单；运营也可以在这里手工补一张
 * （例如没有走纠纷的平台补偿）。</p>
 */
export async function createCompensation(data: Record<string, unknown>) {
  const response = await axios.post('/api/trade/compensation', data)
  return response.data
}

/** 赔付审核：reviewResult 取 approved / rejected，其余字段作为审核痕迹留库 */
export async function reviewCompensation(
  id: number | string,
  reviewResult: 'approved' | 'rejected',
  reviewer: string,
  remark?: string
) {
  const response = await axios.post(`/api/trade/compensation/${id}/review`, { reviewResult, reviewer, remark })
  return response.data
}

/**
 * 赔付打款。
 *
 * <p>后端只在状态为 approved 时允许执行，执行后置 paid 并生成打款流水号 ——
 * "核准"与"打款"是两个动作，页面上不合成一个按钮。</p>
 */
export async function executeCompensation(id: number | string) {
  const response = await axios.post(`/api/trade/compensation/${id}/execute`)
  return response.data
}


