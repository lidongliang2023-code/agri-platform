import { http } from '@/utils/request'

export interface ProcessOptimizationRequest {
  batchId?: string
  batchNo: string
  category: string
  grade?: string
  moisture: number
  uniformity: number
  inputQuantity: number
  inputUnit?: string
  rainAffected?: boolean
  mixedBatch?: boolean
  killerCount?: number
  rollerCount?: number
  dryerCount?: number
  allDevicesOnline?: boolean
}

export interface ProcessOptimizationDetail {
  id: string
  batchNo: string
  batchId?: number
  category: string
  grade?: string
  moisture: number
  uniformity: number
  inputQuantity: number
  inputUnit: string
  rainAffected: number
  equipmentSnapshot: Record<string, unknown>
  input: Record<string, unknown>
  recommendation: {
    segments: Array<Record<string, unknown>>
    notice: string
    manualRequired: boolean
    deviceDispatch: boolean
    version: string
  }
  status: string
  sourceVersion: string
  events: Array<Record<string, unknown>>
  deviations: Array<Record<string, unknown>>
  results: Array<Record<string, unknown>>
}

const BASE = '/process-optimizations'
export const listProcessOptimizations = (params: { pageNum: number; pageSize: number; status?: string }) =>
  http.get<{ list: Array<Record<string, unknown>>; total: number }>(BASE, params)
export const getProcessOptimization = (id: string) => http.get<ProcessOptimizationDetail>(`${BASE}/${encodeURIComponent(id)}`)
export const inferProcessOptimization = (payload: ProcessOptimizationRequest) => http.post<ProcessOptimizationDetail>(`${BASE}/infer`, payload)
export const confirmProcessOptimization = (id: string, approved: boolean, reason?: string) =>
  http.post<ProcessOptimizationDetail>(`${BASE}/${encodeURIComponent(id)}/confirm`, { approved, reason })
export const dispatchProcessOptimization = (id: string) => http.post<ProcessOptimizationDetail>(`${BASE}/${encodeURIComponent(id)}/dispatch`)
export const recordProcessDeviation = (id: string, payload: { metric: string; targetValue?: string; actualValue?: string; action: string }) =>
  http.post<ProcessOptimizationDetail>(`${BASE}/${encodeURIComponent(id)}/deviations`, payload)
export const recordProcessResult = (id: string, payload: { finalMoisture?: number; brokenRate?: number; colorScore?: number; finalGrade?: string; note?: string }) =>
  http.post<ProcessOptimizationDetail>(`${BASE}/${encodeURIComponent(id)}/result`, payload)
