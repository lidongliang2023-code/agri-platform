/**
 * 区块链上链 API
 */
import { http } from '@/utils/request'
import type { PageQuery, PageResult } from '@/types'
import type {
  BlockchainBizRecord,
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

/** by-biz 查询入参 */
export interface BlockchainByBizParams {
  /**
   * 业务类型。
   * ⚠️ 后端 bizType 与 bizNo 是**成对**的，两边口径必须匹配，否则恒返回 []：
   * TRACE→溯源码、INSPECTION→质检单号(inspection_no)、HARVEST→批次号(batch_no)。
   */
  bizType: 'TRACE' | 'INSPECTION' | 'HARVEST'
  /** 业务单号（见 bizType 注释里的口径） */
  bizNo: string
}

/**
 * 按业务类型 + 业务单号查询存证记录（GET /blockchain/by-biz）。
 *
 * ⚠️ 这是**非分页**端点：返回后端裸数组（`ApiResponse<List<BlockchainRecordEntity>>`），
 * 无匹配记录时返回 `[]`。因此**不要**套 `toPageResult` —— 套上去会凭空引入
 * 「按 pageNum/pageSize 切片」的语义，让调用方误以为后端支持分页并丢数据。
 *
 * ⚠️ 关联键实测结论（2026-10-10 连服）：`bizNo` 必须传 **batch_no** 不能传 batch_id ——
 * 传 `DEMO-BATCH-001` 返回 `[]`，传同批次的 `DEMO-BATCHN-001` 才有数据。
 *
 * @param params 业务类型 + 业务单号
 * @returns 存证记录数组；无记录时为空数组（不是 undefined / null）
 */
export function listBlockchainByBiz(
  params: BlockchainByBizParams,
): Promise<BlockchainBizRecord[]> {
  return http.get<BlockchainBizRecord[]>(`${BASE}/by-biz`, params)
}
