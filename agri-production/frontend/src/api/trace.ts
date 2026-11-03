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
/**
 * 溯源码分页查询参数。
 *
 * ⚠️ 这些条件全部在**服务端**生效。以前只有 status 是服务端的，关键字与农场是前端在
 * 已取回的那 500 条里过滤 —— 超过 500 条后搜不到的码会被显示成"不存在"，
 * 而农场条件比的是出参里当时根本没有的 farmId，从来没生效过。
 */
export interface TraceCodePageParams {
  /** 状态过滤：generated / active / scanned / revoked / expired */
  status?: string
  /** 关键字：模糊匹配溯源码 / 批次号 / 产品名 */
  keyword?: string
  /** 农场主键 */
  farmId?: string
  /** 链上状态：onChain（已上链）/ unconfirmed（有存证未出块）/ none（无存证记录） */
  chain?: 'onChain' | 'unconfirmed' | 'none'
  /** 有效期：expired / valid / unset */
  expiry?: 'expired' | 'valid' | 'unset'
  /** 生成日期起（yyyy-MM-dd） */
  from?: string
  /** 生成日期止（yyyy-MM-dd） */
  to?: string
  /** 页码，从 1 开始 */
  pageNum?: number
  /** 每页条数 */
  pageSize?: number
}

/** 分页查询溯源码（后端 GET /trace/codes） */
export function fetchTraceCodePage(
  params: TraceCodePageParams = {},
): Promise<PageResult<RawTraceCode>> {
  return http.get<PageResult<RawTraceCode>>(`${BASE}/codes`, {
    page: params.pageNum ?? 1,
    size: params.pageSize ?? 10,
    status: params.status,
    keyword: params.keyword,
    farmId: params.farmId,
    chain: params.chain,
    expiry: params.expiry,
    from: params.from,
    to: params.to,
  })
}

/** 溯源码详情（后端 GET /trace/{code}） */
export function fetchTraceCodeDetail(code: string): Promise<RawTraceCode> {
  return http.get<RawTraceCode>(`${BASE}/${code}`)
}

/**
 * 为批次生成溯源码（后端 POST /trace/codes/generate?batchId=）
 *
 * 注意：后端**每次调用发一个新码、一个批次可以有多个码**
 * （prod_trace_code 的唯一键只有 uk_trace_code(code)，没有按批次的唯一约束）。
 * 唯一性由 uk_trace_code 保证，因此批量生成循环调用即可；
 * 只有当连续 10 次随机后缀碰撞时才会失败（业务码 3002）。
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

/**
 * 激活溯源码（后端 POST /trace/activate，会按口径写一条 prod.trace.activated 事件到 outbox）。
 *
 * ⚠️ {@code activatedBy} 只是入参透传：**表里没有这一列**，后端记日志但不落库，
 * 所以调用方不要传一个写死的名字冒充"操作人留痕"（运营端此前就传 '运营管理员'）。
 * 真要留痕，得先给表加列并让后端写它。
 */
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
