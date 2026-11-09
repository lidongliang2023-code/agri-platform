/**
 * 产销对接 API（生产侧）。
 *
 * <p>生产端只发布「可供事实」，价格 / 商品 / 订单归交易撮合；这里的接口不返回成交价格。</p>
 */
import axios from 'axios'
import { http } from '@/utils/request'
import useAuthStore from '@/store/auth'
import type { PageQuery, PageResult } from '@/types'

const BASE = '/p2t'

/** 品种 → 交易品类映射 */
export interface P2tVarietyMap {
  id: number
  cropId?: number
  cropCode?: string
  cropName: string
  varietyName?: string
  categoryCode: string
  categoryName?: string
  specStandard?: string
  gradeRule?: string
  mainOrigin?: string
  windowStart?: string
  windowEnd?: string
  conversionRate?: number
  status: number
  version?: string
  remark?: string
  updateTime?: string
}

/** 采收批次 + 产销口径 */
export interface P2tBatchRow {
  batchId: number
  batchNo: string
  cropId?: number
  cropName?: string
  cropVariety?: string
  farmId?: number
  farmName?: string
  plotName?: string
  harvestDate?: string
  quantity: number
  unit: string
  grade?: string
  inspectionNo?: string
  qualityJudged: boolean
  publishedQty: number
  reservedQty: number
  publishableQty: number
  mapped: boolean
  categoryCodes: string[]
  stockQty: number
  frozenQty: number
  unusableQty: number
  availableStockQty: number
  stockShortfallQty: number
  stockUnitMismatch: boolean
  publishable: boolean
}

/** 供给意向 */
export interface P2tOffer {
  id: number
  offerNo: string
  batchId: number
  batchNo: string
  cropId?: number
  cropName?: string
  varietyName?: string
  categoryCode?: string
  categoryName?: string
  farmId?: number
  farmName?: string
  origin?: string
  unit: string
  availableQty: number
  reservedQty: number
  remainingQty: number
  minOrderQty?: number
  deliveryType?: string
  windowStart?: string
  windowEnd?: string
  gradeARatio?: number
  gradeBRatio?: number
  gradeCRatio?: number
  qualityNo?: string
  qualityValidUntil?: string
  traceCodeSeg?: string
  priceRefMin?: number
  priceRefMax?: number
  auditStatus: string
  auditRemark?: string
  auditTime?: string
  auditor?: string
  tradeStatus: string
  productCode?: string
  productName?: string
  listedQty?: number
  listedPrice?: number
  listedTime?: string
  publishTime?: string
  remark?: string
  createTime?: string
}

/** 认购回写流水 */
export interface P2tSubscription {
  id: number
  offerNo: string
  batchNo?: string
  orderNo: string
  buyerName?: string
  buyerType?: string
  qty: number
  grade?: string
  lockFrom?: string
  lockTo?: string
  eventType: string
  writebackStatus: string
  writebackMessage?: string
  paidAt?: string
  createTime?: string
}

/** 认购汇总行 */
export interface P2tSubscriptionSummary {
  offerNo: string
  cropName?: string
  varietyName?: string
  categoryName?: string
  availableQty: number
  reservedQty: number
  remainingQty: number
  subscriptionRate: number
  unit: string
  tradeStatus: string
  auditStatus: string
  latestWriteback?: string
}

/** 需求信号 */
export interface P2tDemandSignal {
  periodPaidQty: number
  periodReleasedQty: number
  periodNetQty: number
  openingNetQty: number
  unit: string
  paidQty: number
  releasedQty: number
  dataAnomaly: boolean
  categoryCode: string
  categoryName?: string
  cropName?: string
  tradedQty: number
  subscriptionRate: number
  supplyQty: number
  onSaleQty: number
  offerCount: number
  judgement: string
  suggestion: string
}

/** 差异工单 */
export interface P2tDiffTicket {
  id: number
  ticketNo: string
  diffType: string
  offerNo?: string
  orderNo?: string
  diffQty?: number
  discoveredAt?: string
  ownerSide: string
  status: string
  handleWay?: string
  handleRemark?: string
  handleTime?: string
}

/** 产销总览 */
export interface P2tOverview {
  supplyByUnit: Record<string, number>
  reservedByUnit: Record<string, number>
  harvestByUnit: Record<string, number>
  supplyQty: number
  reservedQty: number
  subscriptionRate: number
  pendingAudit: number
  pendingDiff: number
  mappedVarieties: number
  batchCount: number
  batchQuantity: number
  offerCount: number
  listedCount: number
}

/** 供给意向新增 / 变更入参 */
export interface P2tOfferPayload {
  batchId?: number
  categoryCode?: string
  availableQty?: number
  minOrderQty?: number
  deliveryType?: string
  windowStart?: string
  windowEnd?: string
  gradeARatio?: number
  gradeBRatio?: number
  gradeCRatio?: number
  priceRefMin?: number
  priceRefMax?: number
  remark?: string
}

/** 产销对接总览 */
export function fetchP2tOverview(): Promise<P2tOverview> {
  return http.get<P2tOverview>(`${BASE}/overview`)
}

/** 品种映射列表 */
export function listVarietyMaps(
  params: PageQuery & { keyword?: string; status?: number },
): Promise<PageResult<P2tVarietyMap>> {
  return http.get<PageResult<P2tVarietyMap>>(`${BASE}/varieties`, params)
}

/** 新增 / 编辑品种映射 */
export function saveVarietyMap(payload: Partial<P2tVarietyMap>): Promise<P2tVarietyMap> {
  if (payload.id) {
    return http.put<P2tVarietyMap>(`${BASE}/varieties/${payload.id}`, payload)
  }
  return http.post<P2tVarietyMap>(`${BASE}/varieties`, payload)
}

/** 删除品种映射 */
export function removeVarietyMap(id: number): Promise<void> {
  return http.delete<void>(`${BASE}/varieties/${id}`)
}

/** 某作物在用的品类映射（发布供给时必须指定品类） */
export function listVarietyMapsOfCrop(params: {
  cropId?: number
  cropName?: string
}): Promise<P2tVarietyMap[]> {
  return http.get<P2tVarietyMap[]>(`${BASE}/varieties/by-crop`, params)
}

/** 批次与可售量 */
export function listP2tBatches(
  params: PageQuery & { keyword?: string },
): Promise<PageResult<P2tBatchRow>> {
  return http.get<PageResult<P2tBatchRow>>(`${BASE}/batches`, params)
}

/** 供给意向列表 */
export function listP2tOffers(
  params: PageQuery & { keyword?: string; auditStatus?: string; tradeStatus?: string; batchId?: string },
): Promise<PageResult<P2tOffer>> {
  return http.get<PageResult<P2tOffer>>(`${BASE}/offers`, params)
}

/** 当前经营主体的供给详情。 */
export function getP2tOffer(offerNo: string): Promise<P2tOffer> {
  return http.get<P2tOffer>(`${BASE}/offers/by-no/${encodeURIComponent(offerNo)}`)
}

/** 新增供给意向 */
export function createP2tOffer(payload: P2tOfferPayload): Promise<P2tOffer> {
  return http.post<P2tOffer>(`${BASE}/offers`, payload)
}

/** 变更供给意向（重新提交审核） */
export function updateP2tOffer(id: number, payload: P2tOfferPayload): Promise<P2tOffer> {
  return http.put<P2tOffer>(`${BASE}/offers/${id}`, payload)
}

/** 提交审核 */
export function submitP2tOffer(id: number): Promise<P2tOffer> {
  return http.post<P2tOffer>(`${BASE}/offers/${id}/submit`)
}

/** 关闭供给单 */
export function closeP2tOffer(id: number): Promise<P2tOffer> {
  return http.post<P2tOffer>(`${BASE}/offers/${id}/close`)
}

/** 删除供给单 */
export function removeP2tOffer(id: number): Promise<void> {
  return http.delete<void>(`${BASE}/offers/${id}`)
}

/** 认购汇总 */
export function listP2tSubscriptions(
  params: PageQuery & { keyword?: string },
): Promise<PageResult<P2tSubscriptionSummary>> {
  return http.get<PageResult<P2tSubscriptionSummary>>(`${BASE}/subscriptions`, params)
}

/** 认购流水 */
export function listP2tSubscriptionFlows(
  params: PageQuery & { keyword?: string; offerNo?: string; eventType?: string; writebackStatus?: string },
): Promise<PageResult<P2tSubscription>> {
  return http.get<PageResult<P2tSubscription>>(`${BASE}/subscriptions/flows`, params)
}

/** 需求信号 */
export function fetchP2tDemandSignals(params?: { startDate?: string; endDate?: string }): Promise<P2tDemandSignal[]> {
  return http.get<P2tDemandSignal[]>(`${BASE}/demand-signals`, params)
}

/** 差异工单 */
export function listP2tDiffs(
  params: PageQuery & { status?: string; diffType?: string; keyword?: string },
): Promise<PageResult<P2tDiffTicket>> {
  return http.get<PageResult<P2tDiffTicket>>(`${BASE}/diffs`, params)
}

/** 处置差异 */
export function handleP2tDiff(
  id: number,
  payload: { status?: string; handleWay?: string; remark: string; evidenceNo?: string; expectedStatus: string },
): Promise<P2tDiffTicket> {
  return http.post<P2tDiffTicket>(`${BASE}/diffs/${id}/handle`, payload)
}

/** 产销对账（供给/成交口径） */
export function fetchP2tReconciliation(): Promise<
  Array<{
    offerNo: string
    cropName?: string
    unit: string
    supplyByUnit: Record<string, number>
  reservedByUnit: Record<string, number>
  harvestByUnit: Record<string, number>
  supplyQty: number
    tradedQty: number
    remainingQty: number
    tradeRate: number
    auditStatus: string
    tradeStatus: string
    productCode?: string
    batchNo?: string
  }>
> {
  return http.get(`${BASE}/reconciliation`)
}

/** 全链路（按批次号） */
export function fetchP2tTrace(batchNo: string, includeSubscriptions = true): Promise<Record<string, unknown>> {
  return http.get(`${BASE}/trace`, { batchNo, includeSubscriptions })
}

/** 交易端商品品类字典（agri_trade_category，只读） */
export interface TradeCategory {
  id: number
  parentId?: number | null
  categoryCode?: string
  categoryName: string
  level?: number
}

/**
 * 读取交易端启用中的品类字典。
 * 交易域接口返回 code=200，不走生产域拦截器（其成功码为 0），这里单独解包。
 */
export async function listTradeCategories(): Promise<TradeCategory[]> {
  const token = useAuthStore.getState().token
  const response = await axios.get('/api/trade/product/category/list', {
    timeout: 15000,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  const body = response.data as { code?: number; message?: string; data?: TradeCategory[] }
  if (body?.code !== 200 || !Array.isArray(body.data)) throw new Error(body?.message || '交易品类字典加载失败')
  return body.data
}

