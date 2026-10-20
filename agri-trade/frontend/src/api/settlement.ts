import axios from 'axios'

/**
 * 结算与分账（运营端）。
 *
 * 口径：订单**确认收货之后**才可结算；平台服务费按**货款**计（费率由后端配置），
 * 卖家应收 = 订单总额 − 平台服务费。金额一律由服务端重算，这里不传任何金额。
 */
export interface SettlementSummary {
  /** 平台服务费率（按货款计），例如 0.005 = 0.5% */
  platformFeeRate: number
  pendingCount: number
  pendingAmount: number
  pendingPlatformFee: number
  pendingSellerReceivable: number
  settledCount: number
  settledAmount: number
  settledPlatformFee: number
  settledSellerReceivable: number
}

/** 待结算行 = 订单 + 按当前费率的预估分账 */
export interface PendingSettlementRow {
  orderId: number
  orderNo: string
  buyerId: number
  buyerName: string
  sellerId: number
  sellerName: string
  goodsAmount: number
  freightAmount: number
  totalAmount: number
  orderStatus: string
  platformFeeRate: number
  platformFee: number
  sellerReceivable: number
}

/** 已结算记录 */
export interface SettlementRow {
  id: number
  settlementNo: string
  orderId: number
  orderNo: string
  buyerName: string
  sellerName: string
  goodsAmount: number
  freightAmount: number
  totalAmount: number
  platformFeeRate: number
  platformFee: number
  sellerReceivable: number
  settleStatus: string
  settleTime: string
  settleBy: string
}

export async function getSettlementSummary() {
  const response = await axios.get('/api/trade/admin/settlement/summary')
  return response.data
}

export async function getPendingSettlements(params: { pageNum: number; pageSize: number }) {
  const response = await axios.get('/api/trade/admin/settlement/pending', { params })
  return response.data
}

export async function getSettledSettlements(params: { pageNum: number; pageSize: number; sellerId?: number }) {
  const response = await axios.get('/api/trade/admin/settlement/page', { params })
  return response.data
}

export async function settleOrder(orderId: number) {
  const response = await axios.post(`/api/trade/admin/settlement/${orderId}/settle`)
  return response.data
}

/* ------------------------------ 卖家侧 ------------------------------ */

export interface SellerSettlementSummary {
  pendingCount: number
  settledCount: number
  pendingAmount: number
  pendingFee: number
  pendingReceivable: number
  settledAmount: number
  settledFee: number
  settledReceivable: number
}

export interface SellerPendingSettlementRow {
  orderId: number
  orderNo: string
  sellerId: number
  sellerName: string
  buyerName: string
  totalAmount: number
  platformFeeRate: number
  platformFee: number
  sellerReceivable: number
  orderStatus: string
}

export interface SellerSettlementView {
  summary: SellerSettlementSummary
  pending: SellerPendingSettlementRow[]
  settled: SettlementRow[]
}

export interface SellerSettlementResult {
  code: number
  message?: string
  data?: SellerSettlementView
}

/** 我的结算（范围由服务端按登录身份推导）。 */
export async function getMySettlement(): Promise<SellerSettlementResult> {
  const response = await axios.get('/api/trade/settlement/mine')
  return response.data
}
