/**
 * 区块链上链 API
 */
import { http } from '@/utils/request'
import type { PageQuery, PageResult } from '@/types'
import type {
  BlockchainBizRecord,
  BlockchainOverview,
  BlockchainRecord,
} from '@/types'

const BASE = '/blockchain'

/**
 * 链上存证总览（后端真实形状）。
 *
 * 后端 `BlockchainRecordService#overview()` 返回 `Map<String, Object>`，实际只有三个键：
 * `total` / `success` / `failed`。
 *
 * ⚠️ 实测（core-app 直连，2026-10-10）：三个值被序列化为**字符串** ——
 * `GET /api/v1/production/blockchain/overview` → `{"total":"4","success":"3","failed":"0"}`。
 * 因此类型标注为 `number | string`，消费方**必须**先 `toNumber` 再渲染或做算术：
 * 直接拿字符串做减法会得到 NaN，直接丢给 AntD `Statistic` 则会把字符串语义泄漏给下游。
 */
export interface BlockchainOverviewStat {
  /** 存证总条数（运行时可能是字符串） */
  total: number | string
  /** 上链成功条数（运行时可能是字符串） */
  success: number | string
  /** 上链失败条数（运行时可能是字符串） */
  failed: number | string
}

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

/**
 * 存证记录查询参数。
 *
 * ⚠️ 后端 `BlockchainController#records` 的签名只接收 `page` / `size` / `keyword` / `status`
 * 四个参数，其中 `keyword` 只做 `biz_no` 的模糊匹配。
 * 实测（2026-10-10）传 `bizType=TRACE` 后端**静默忽略**（仍返回全量 4 条），
 * 传 `startDate` / `endDate` 同样无效 —— 这几个参数已从类型中移除，
 * 避免调用方以为筛选生效（筛了不生效比没有筛选更误导）。
 */
export interface CertRecordListParams extends PageQuery {
  /** 存证状态：PENDING / SUCCESS / FAILED */
  status?: string
  /** 关键字：后端仅按 biz_no（业务单号）模糊匹配 */
  keyword?: string
}

/** 分页查询存证记录（GET /blockchain/records） */
export function listCertRecords(
  params: CertRecordListParams,
): Promise<PageResult<BlockchainBizRecord>> {
  return http.get<PageResult<BlockchainBizRecord>>(`${BASE}/records`, params)
}

/** 查询存证详情（GET /blockchain/{id}） */
export function getCertRecord(recordId: string): Promise<BlockchainBizRecord> {
  return http.get<BlockchainBizRecord>(`${BASE}/${recordId}`)
}

/** 提交上链（POST /blockchain/anchor） */
export function anchorRecord(payload: {
  bizType?: string
  bizNo?: string
  traceCode?: string
  bizSummary?: string
  payloadHash?: string
}): Promise<BlockchainBizRecord> {
  return http.post<BlockchainBizRecord>(`${BASE}/anchor`, payload)
}

/**
 * 存证验真（GET /blockchain/verify）。
 *
 * ⚠️ 后端签名为 `verify(@RequestParam String txHash)` —— **只支持交易哈希**，
 * `certNo` / `traceCode` 传过去会被忽略，且 `txHash` 必填、缺失即业务异常。
 * 因此调用方**只应按 txHash 走**；按存证编号 / 溯源码验真在后端不存在，
 * UI 层须明示禁用（见 Verify.tsx / BlockchainRecords.tsx），不要去调一个必然失败的接口。
 *
 * 返回体是布尔值：是否存在该 txHash 命中且 status=SUCCESS 的存证记录。
 */
export function verifyCertificate(params: {
  certNo?: string
  txHash?: string
  traceCode?: string
}): Promise<boolean> {
  return http.get<boolean>(`${BASE}/verify`, params)
}

/**
 * 查询存证总览（GET /blockchain/overview）。
 *
 * ⚠️ 后端只返回 `{total, success, failed}`（且是字符串），
 * **不**返回 monthRecords / pendingRecords / verifyPassRate / typeStats / health /
 * recentRecords / pendingQueue —— 这些字段历史上由前端示例数据填充，已移除。
 */
export function getChainOverview(): Promise<BlockchainOverviewStat> {
  return http.get<BlockchainOverviewStat>(`${BASE}/overview`)
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
