/**
 * 溯源管理 API（溯源码 / 全链路）
 */
import { http } from '@/utils/request'
import type { PageQuery, PageResult } from '@/types'
import type { TraceCode, TraceNode, TraceScanRecord } from '@/types'
/* 页面补充类型（追加导入，不改动既有定义） */
import type { RawTraceCode, TraceFullChainNode } from '@/types'

const BASE = '/trace'

/** 溯源码列表查询参数 */
export interface TraceCodeListParams extends PageQuery {
  /** 关联批次 ID（后端 Controller 签名 String，接口一律传 string） */
  batchId?: string
  code?: string
  status?: string
  codeType?: number
}

/** 分页查询溯源码 */
export function listTraceCodes(params: TraceCodeListParams): Promise<PageResult<TraceCode>> {
  return http.get<PageResult<TraceCode>>(`${BASE}/codes`, params)
}

/** 查询溯源码详情 */
export function getTraceCode(code: string): Promise<TraceCode> {
  return http.get<TraceCode>(`${BASE}/codes/${code}`)
}

/** 批量生成溯源码 */
export function generateTraceCodes(payload: {
  /** 关联批次 ID（后端 Controller 签名 String，接口一律传 string） */
  batchId: string
  codeType: number
  count: number
  expireDate?: string
}): Promise<string> {
  return http.post<string>(`${BASE}/codes/generate`, payload)
}

/** 激活溯源码 */
export function activateTraceCodes(codes: string[]): Promise<boolean> {
  return http.patch<boolean>(`${BASE}/codes/activate`, { codes })
}

/** 作废溯源码 */
export function expireTraceCodes(codes: string[]): Promise<boolean> {
  return http.patch<boolean>(`${BASE}/codes/expire`, { codes })
}

/** 查询扫码记录 */
export function listTraceScans(
  code: string,
  params: PageQuery,
): Promise<PageResult<TraceScanRecord>> {
  return http.get<PageResult<TraceScanRecord>>(
    `${BASE}/codes/${code}/scans`,
    params,
  )
}

/** 查询全链路溯源节点 */
export function listTraceNodes(batchId: string): Promise<TraceNode[]> {
  return http.get<TraceNode[]>(`${BASE}/full-chain/${batchId}/nodes`)
}

/** 追溯溯源码（消费者扫码视角） */
export function traceByCode(code: string): Promise<TraceNode[]> {
  return http.get<TraceNode[]>(`${BASE}/full-chain/trace/${code}`)
}

/* -------------------------------------------------------------------------- *
 * 以下方法为「溯源码管理 / 全链路溯源 / 溯源报告」页面补充，
 * 路径与后端 TraceController（/api/v1/production/trace）真实接口一一对齐：
 * - 分页入参统一转换为后端要求的 page / size；
 * - 状态流转接口均为 POST + RequestParam。
 * -------------------------------------------------------------------------- */

/** 溯源码分页查询参数（对齐后端 page / size / status） */
export interface TraceCodePageParams {
  /** 状态过滤：generated / active / scanned / revoked */
  status?: string
  /** 页码，从 1 开始 */
  pageNum?: number
  /** 每页条数 */
  pageSize?: number
}

/** 分页查询溯源码（后端 GET /trace/codes?page&size&status） */
export function fetchTraceCodePage(
  params: TraceCodePageParams = {},
): Promise<PageResult<RawTraceCode>> {
  return http.get<PageResult<RawTraceCode>>(`${BASE}/codes`, {
    page: params.pageNum ?? 1,
    size: params.pageSize ?? 10,
    status: params.status,
  })
}

/** 溯源码详情（后端 GET /trace/{code}） */
export function fetchTraceCodeDetail(code: string): Promise<RawTraceCode> {
  return http.get<RawTraceCode>(`${BASE}/${code}`)
}

/**
 * 为批次生成溯源码（后端 POST /trace/codes/generate?batchId=）
 *
 * 注意：后端同一批次仅允许存在一个溯源码，重复生成会抛 TRACE_CODE_DUPLICATED，
 * 批量生成时页面层需循环调用并按成功 / 失败分别提示。
 */
export function generateTraceCode(
  batchId: string | number,
  expireDate?: string,
): Promise<string> {
  return http.post<string>(`${BASE}/codes/generate`, undefined, {
    params: { batchId, expireDate },
  })
}

/** 备用路径：为批次生成溯源码（POST /trace/batches/{batchId}/generate） */
export function generateTraceCodeByBatch(batchId: string | number): Promise<string> {
  return http.post<string>(`${BASE}/batches/${batchId}/generate`)
}

/** 激活溯源码（后端 POST /trace/activate，触发 prod.trace.activated 事件） */
export function activateTraceCode(code: string, activatedBy?: string): Promise<RawTraceCode> {
  return http.post<RawTraceCode>(`${BASE}/activate`, undefined, {
    params: { code, activatedBy },
  })
}

/** 扫码累计（后端 POST /trace/scan，模拟消费者扫码） */
export function scanTraceCode(code: string): Promise<RawTraceCode> {
  return http.post<RawTraceCode>(`${BASE}/scan`, undefined, { params: { code } })
}

/** 作废溯源码（后端 POST /trace/{code}/revoke） */
export function revokeTraceCode(code: string): Promise<RawTraceCode> {
  return http.post<RawTraceCode>(`${BASE}/${code}/revoke`)
}

/** 查询批次下的溯源码（后端 GET /trace/batches/{batchId}） */
export function listCodesByBatch(batchId: string | number): Promise<RawTraceCode[]> {
  return http.get<RawTraceCode[]>(`${BASE}/batches/${batchId}`)
}

/** 查询全链路溯源节点（后端 GET /trace/full-chain/{batchId}/nodes） */
export function fetchFullChainNodes(batchId: string | number): Promise<TraceFullChainNode[]> {
  return http.get<TraceFullChainNode[]>(`${BASE}/full-chain/${batchId}/nodes`)
}
