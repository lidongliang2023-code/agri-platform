import { http } from '@/utils/request'
import type { PageData } from '@/utils/request'

export type LaborWorkerSource = 'VILLAGE' | 'NEIGHBORING' | 'AGENCY' | 'OTHER'
export type LaborWorkerSkill = 'HARVEST' | 'MACHINE' | 'DRIVER' | 'MIXED'
export type LaborWorkerStatus = 'ACTIVE' | 'INACTIVE'

export interface LaborWorker {
  id: string
  workerNo: string
  workerName: string
  phone?: string
  sourceType: LaborWorkerSource
  sourceName?: string
  skillType: LaborWorkerSkill
  dailyWage: number
  availabilityRate: number
  dailyCapacity: number
  maxHours: number
  availableWeekdays: string
  availableFrom?: string
  availableTo?: string
  status: LaborWorkerStatus
  note?: string
  createdAt?: string
  updatedAt?: string
}

export interface LaborWorkerSummary {
  date: string
  activeCount: number
  availableCount: number
  villageAvailable: number
  neighboringAvailable: number
  averageDailyWage: number
  source: string
}

export interface LaborWorkerPayload {
  farmId: string
  workerNo: string
  workerName: string
  phone?: string
  sourceType: LaborWorkerSource
  sourceName?: string
  skillType: LaborWorkerSkill
  dailyWage: number
  availabilityRate: number
  dailyCapacity: number
  maxHours: number
  availableWeekdays: string
  availableFrom?: string
  availableTo?: string
  status?: LaborWorkerStatus
  note?: string
}

const BASE = '/labor-workers'

export const listLaborWorkers = (params: {
  farmId: string
  pageNum: number
  pageSize: number
  keyword?: string
  sourceType?: LaborWorkerSource
  skillType?: LaborWorkerSkill
  status?: LaborWorkerStatus
}): Promise<PageData<LaborWorker>> => http.get(BASE, params)

export const getLaborWorkerSummary = (farmId: string, date?: string): Promise<LaborWorkerSummary> =>
  http.get(`${BASE}/summary`, { farmId, date })

export const createLaborWorker = (payload: LaborWorkerPayload): Promise<string> => http.post(BASE, payload)

export const updateLaborWorker = (id: string, payload: Partial<LaborWorkerPayload>): Promise<LaborWorker> =>
  http.put(`${BASE}/${id}`, payload)

export const deleteLaborWorker = (id: string): Promise<void> => http.delete(`${BASE}/${id}`)
