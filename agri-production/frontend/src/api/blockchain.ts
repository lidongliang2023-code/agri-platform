/**
 * 区块链上链 API
 */
import { http } from '@/utils/request'
import type { PageQuery, PageResult } from '@/types'
import type {
  BlockchainCertRecord,
  BlockchainChainOverview,
  BlockchainOverview,
  BlockchainRecord,
} from '@/types'

const BASE = '/blockchain'

/** 上链记录查询参数 */
export interface ChainRecordListParams extends PageQuery {
  bizType?: number
  status?: number
  txHash?: string
}

/** 分页查询上链记录 */
export function listChainRecords(
  params: ChainRecordListParams,
): Promise<PageResult<BlockchainRecord>> {
  return http.get<PageResult<BlockchainRecord>>(
    `${BASE}/records`,
    params,
  )
}

/** 查询上链记录详情 */
export function getChainRecord(recordId: string): Promise<BlockchainRecord> {
  return http.get<BlockchainRecord>(`${BASE}/records/${recordId}`)
}

/** 提交上链 */
export function submitChain(
  payload: { bizId: string; bizType: number; bizSummary?: string },
): Promise<BlockchainRecord> {
  return http.post<BlockchainRecord>(`${BASE}/records`, payload)
}

/** 重试上链 */
export function retryChain(recordId: string): Promise<BlockchainRecord> {
  return http.patch<BlockchainRecord>(`${BASE}/records/${recordId}/retry`)
}

/** 链上数据验真 */
export function verifyChain(txHash: string): Promise<boolean> {
  return http.get<boolean>(`${BASE}/verify/${txHash}`)
}

/** 查询区块链概览统计 */
export function getBlockchainOverview(): Promise<BlockchainOverview> {
  return http.get<BlockchainOverview>(`${BASE}/overview`)
}

/* ============================================================================
 * 以下为「区块链存证（P27 ~ P30）」页面填充时追加的方法，纯新增。
 * ==========================================================================*/

/** 存证记录查询参数（对齐原型 P28 筛选区） */
export interface CertRecordListParams extends PageQuery {
  /** 业务类型编码 */
  bizType?: string
  /** 存证状态 */
  status?: string
  /** 关键字：存证编号 / 交易哈希 / 溯源码 */
  keyword?: string
  /** 起始日期 yyyy-MM-dd */
  startDate?: string
  /** 结束日期 yyyy-MM-dd */
  endDate?: string
}

/** 分页查询存证记录（GET /blockchain/records） */
export function listCertRecords(
  params: CertRecordListParams,
): Promise<PageResult<BlockchainCertRecord>> {
  return http.get<PageResult<BlockchainCertRecord>>(`${BASE}/records`, params)
}

/** 查询存证详情（GET /blockchain/{id}） */
export function getCertRecord(recordId: string): Promise<BlockchainCertRecord> {
  return http.get<BlockchainCertRecord>(`${BASE}/${recordId}`)
}

/** 提交上链（POST /blockchain/anchor） */
export function anchorRecord(payload: {
  bizType?: string
  bizNo?: string
  traceCode?: string
  bizSummary?: string
  payloadHash?: string
}): Promise<BlockchainCertRecord> {
  return http.post<BlockchainCertRecord>(`${BASE}/anchor`, payload)
}

/** 存证验真：支持存证编号 / 交易哈希 / 溯源码三种凭证（GET /blockchain/verify） */
export function verifyCertificate(params: {
  certNo?: string
  txHash?: string
  traceCode?: string
}): Promise<boolean> {
  return http.get<boolean>(`${BASE}/verify`, params)
}

/** 查询存证总览（原型 P27：指标卡 + 类型分布 + 链上健康度 + 待上链队列） */
export function getChainOverview(): Promise<BlockchainChainOverview> {
  return http.get<BlockchainChainOverview>(`${BASE}/overview`)
}
