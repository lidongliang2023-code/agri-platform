import { http } from '@/utils/request'
import type { PageResult } from '@/types'

export interface YieldForecastRequest {
  farmId?: string
  plotId?: string
  cropName: string
  cropVariety?: string
  forecastDate?: string
  harvestStart?: string
  harvestEnd?: string
  dataCutoff?: string
  areaMu: number
  historyYield?: number
  expectedYieldPerMu?: number
  ndviScore?: number
  weatherFactor?: number
  marketQuoteId?: string
  priceLow?: string
  priceHigh?: string
  shipmentBatches?: number
}
export interface YieldShipment { sequence: number; ratio: number; quantity: number; suggestedDate: string; reason: string }
export interface YieldResult { predictedPerMu: number; predictedTotal: number; lowerTotal: number; upperTotal: number; errorPercent: number; earlyReferenceOnly: boolean; harvestStart: string; harvestEnd: string; priceLow: string; priceHigh: string; shipments: YieldShipment[]; notice: string; conflictDisclosure: string; priceKind?: string; priceNotice?: string; marketEvidence?: MarketQuote }
export interface YieldForecastDetail {
  id: string
  cropName: string
  cropVariety?: string
  forecastDate: string
  harvestStart: string
  harvestEnd: string
  dataCutoff: string
  validUntil: string
  status: string
  sourceVersion: string
  input: Record<string, unknown>
  result: YieldResult
  feedback: Array<Record<string, unknown>>
  events: Array<Record<string, unknown>>
}
const BASE = '/yield-forecasts'
export const listYieldForecasts = (params: { pageNum: number; pageSize: number; status?: string }): Promise<PageResult<Record<string, unknown>>> => http.get(BASE, params)
export const getYieldForecast = (id: string): Promise<YieldForecastDetail> => http.get(`${BASE}/${encodeURIComponent(id)}`)
export const inferYieldForecast = (payload: YieldForecastRequest): Promise<YieldForecastDetail> => http.post(`${BASE}/infer`, payload)
export const feedbackYieldForecast = (id: string, payload: { actualQuantity: number; unit: string; actualDate: string; note?: string }): Promise<YieldForecastDetail> => http.post(`${BASE}/${encodeURIComponent(id)}/feedback`, payload)
export const invalidateYieldForecast = (id: string, reason: string): Promise<YieldForecastDetail> => http.post(`${BASE}/${encodeURIComponent(id)}/invalidate`, { reason })

export interface MarketQuote { id: string; batchId: string; cropName: string; sourceName: string; specification: string; quoteDate: string; priceKg: number; unit: string; market: string; region: string; originalPrice: number; originalUnit: string; sourceUrl: string; fetchedAt: string; stale: boolean; kind: string; provider?: string }
export interface MarketQuoteResult { quotes: MarketQuote[]; notice: string; provider: string; market: string; sourceUrl: string }
export interface MarketSyncResult { status: string; provider?: string; duplicate?: boolean; parsedCount?: number; parsed_count?: number; skippedCount?: number; reportDate?: string; error?: string }
export const getYieldMarketQuotes = (crop: string): Promise<MarketQuoteResult> => http.get(`${BASE}/market`, { crop })
export const syncYieldMarketQuotes = (source = 'NX'): Promise<MarketSyncResult> => http.post(`${BASE}/market/sync`, undefined, { params: { source }, timeout: 75000 })
export const getYieldMarketBatches = (): Promise<Array<Record<string, unknown>>> => http.get(`${BASE}/market/batches`)
