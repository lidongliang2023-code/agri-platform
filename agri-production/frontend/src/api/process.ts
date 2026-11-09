/**
 * 加工记录 API（采收之后的真实工序）
 *
 * <p>「种植 → 采收 → 加工」的加工环节只在这里读写；溯源链路（全链路页与公众核验）
 * 读的是同一批记录，不存在页面上第二段拼装出来的"加工信息"。</p>
 */
import { http } from '@/utils/request'
import type { PageQuery, PageResult } from '@/types'

const BASE = '/process'

/** 加工类型词表（与后端 ProcessServiceImpl 一致，不在表里的后端会拒） */
export const PROCESS_TYPES = [
  { value: 'PRECOOL', label: '预冷' },
  { value: 'SORTING', label: '分选清洗' },
  { value: 'GRADING', label: '分级' },
  { value: 'DRYING', label: '烘干' },
  { value: 'PACKAGING', label: '分装' },
  { value: 'CUTING', label: '净切' },
] as const

export const PROCESS_STATUS = [
  { value: 'DOING', label: '进行中' },
  { value: 'DONE', label: '已完成' },
  { value: 'CANCELED', label: '已取消' },
] as const

export interface ProcessRecord {
  id: number
  processRecordId?: string
  processCode: string
  batchId: number
  batchNo?: string
  processType: string
  processTypeName?: string
  processName?: string
  location?: string
  operatorName?: string
  startedAt?: string
  finishedAt?: string
  inputQuantity?: number
  inputUnit?: string
  outputQuantity?: number
  outputUnit?: string
  /** 投入与产出都填了且同单位时后端才算，null 表示"系统并不知道损耗" */
  lossQuantity?: number | null
  processParams?: string
  photos?: string
  status: string
  remark?: string
  createTime?: string
  updateTime?: string
}

export interface ProcessSavePayload {
  batchId: string
  processType: string
  processName?: string
  location?: string
  operatorName?: string
  startedAt?: string
  finishedAt?: string
  inputQuantity?: number
  inputUnit?: string
  outputQuantity?: number
  outputUnit?: string
  processParams?: string
  photos?: string
  status?: string
  remark?: string
}

/** 某批次的全部加工工序（批次主键或批次号都可） */
export function listProcessByBatch(batchKey: string): Promise<ProcessRecord[]> {
  return http.get<ProcessRecord[]>(`${BASE}/batch/${encodeURIComponent(batchKey)}`)
}

/** 本主体加工记录分页 */
export function pageProcess(params: PageQuery & { batchNo?: string; type?: string; status?: string }):
  Promise<PageResult<ProcessRecord>> {
  return http.get<PageResult<ProcessRecord>>(`${BASE}/records`, params)
}

export function createProcess(payload: ProcessSavePayload): Promise<ProcessRecord> {
  return http.post<ProcessRecord>(BASE, payload)
}

export function updateProcess(id: number, payload: ProcessSavePayload): Promise<ProcessRecord> {
  return http.put<ProcessRecord>(`${BASE}/${id}`, payload)
}

export function deleteProcess(id: number): Promise<void> {
  return http.delete<void>(`${BASE}/${id}`)
}
