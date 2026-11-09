import axios from 'axios'

/**
 * 产销对接 · 平台治理接口（交易运营端）。
 *
 * 只保留平台该做的事：回写状态与重试、产销对账、差异处置、全链路追踪、规则配置。
 *
 * <b>审核与建品不在这里了</b>：原先的 `getP2tPool / auditP2tOffer / buildP2tProduct /
 * getP2tProducts / updateP2tProductPrice` 是"运营替供应商接单"，已随
 * `/api/trade/admin/p2t/**` 那五条路由一起下线（返回 410），
 * 承接改到卖家中心自己的接口 {@link ./seller-p2t.ts}（`/api/trade/seller/p2t/**`）。
 */

const BASE = '/api/trade/admin/p2t'

/** 交易端统一响应壳：成功码是 200（生产端是 0），两边判据不能混用。 */
export interface TradeEnvelope<T> {
  code: number
  message?: string
  data?: T
}

/** 与生产有关的订单字段（订单主数据仍归交易端，本页只看回写状态）。 */
export interface P2tOrder {
  orderNo: string
  buyerName?: string
  productName?: string
  sourceOfferNo?: string
  totalQuantity?: number
  totalAmount?: number
  paymentStatus?: string
  p2tWritebackStatus?: string
  p2tWritebackError?: string
}

/** 差异工单：短装/降级/窗口过期/超卖，责任方分生产与交易。 */
export interface P2tDiffRow {
  id: number
  ticketNo: string
  diffType: string
  batchNo?: string
  offerNo?: string
  orderNo?: string
  diffQty?: number
  ownerSide?: string
  status?: string
  handleWay?: string
  handleRemark?: string
}

/** 对接规则（AUDIT / LISTING / WRITEBACK 三类，正文是 JSON 字符串）。 */
export interface P2tRule {
  id?: number
  ruleCode: string
  ruleName?: string
  ruleJson: string
  version?: string
  enabled?: number
  updateTime?: string
}

export async function getP2tOrders(query: {
  pageNum: number
  pageSize: number
  keyword?: string
  status?: string
}): Promise<TradeEnvelope<{ records: P2tOrder[]; total: number }>> {
  const res = await axios.get<TradeEnvelope<{ records: P2tOrder[]; total: number }>>(`${BASE}/orders`, { params: query })
  return res.data
}

/** 回写重试的结果：成功时给最终状态，失败时把生产端回的原因带回来。 */
export async function retryP2tWriteback(
  orderNo: string,
): Promise<TradeEnvelope<{ status?: string; message?: string }>> {
  const res = await axios.post<TradeEnvelope<{ status?: string; message?: string }>>(
    `${BASE}/orders/${encodeURIComponent(orderNo)}/retry`)
  return res.data
}

/**
 * 产销对账：供给量 / 成交量 / 入仓量三方汇聚，只读不改单。
 *
 * 返回刻意不做泛型约束——汇聚行的形状由后端拼装（且会随对账口径变），
 * 由使用方按自己那页的 ReconRow 注解；这里写死 unknown[] 反而会把调用方的注解判成类型不兼容。
 */
export async function getP2tRecon() {
  const res = await axios.get(`${BASE}/recon`)
  return res.data
}

export async function getP2tDiffs(query: {
  pageNum: number
  pageSize: number
  status?: string
}): Promise<TradeEnvelope<{ records: P2tDiffRow[]; total: number }>> {
  const res = await axios.get<TradeEnvelope<{ records: P2tDiffRow[]; total: number }>>(`${BASE}/diffs`, { params: query })
  return res.data
}

export async function handleP2tDiff(id: number, payload: {
  status: string
  handleWay: string
  remark: string
}): Promise<TradeEnvelope<unknown>> {
  const res = await axios.post<TradeEnvelope<unknown>>(`${BASE}/diffs/${id}/handle`, payload)
  return res.data
}

/** 按批次号回溯：这一批货从供给单到商品到订单的完整链路（形状由使用方按本页结构断言）。 */
export async function getP2tTrace(batchNo: string) {
  const res = await axios.get(`${BASE}/trace`, { params: { batchNo } })
  return res.data
}

export async function getP2tRules(): Promise<TradeEnvelope<P2tRule[]>> {
  const res = await axios.get<TradeEnvelope<P2tRule[]>>(`${BASE}/rules`)
  return res.data
}

export async function saveP2tRule(ruleCode: string, ruleJson: string, version?: string): Promise<TradeEnvelope<unknown>> {
  const res = await axios.put<TradeEnvelope<unknown>>(`${BASE}/rules/${encodeURIComponent(ruleCode)}`, { ruleJson, version })
  return res.data
}
