/**
 * 区块链上链 API
 */
import { http } from '@/utils/request'
import type { PageQuery, PageResult } from '@/types'
import type { BlockchainBizRecord, BlockchainRecord } from '@/types'

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

/**
 * 查询上链记录详情。
 *
 * <p>路径已对齐后端实际契约：后端 `BlockchainController` 的详情端点是扁平路径
 * `GET /api/v1/production/blockchain/{id}`（`/records` 只用于分页列表）。
 * 原实现调 `/blockchain/records/{id}`，该路径后端不存在，必然 404。</p>
 *
 * <p>本次只改路径：后端详情返回 `BlockchainRecordEntity`，与本函数返回类型一致，无需改调用方。</p>
 *
 * <p><b>同文件另两处不一致（未在本轮处理）</b>：
 * 同文件另两处不一致**已于 2026-10-15 收口**：`submitChain`（`POST /records`）与
 * `retryChain`（`PATCH /records/{id}/retry`）此前后端都没有端点，现已按前端契约补齐
 * （见后端 `BlockchainController` 的写路径）。</p>
 *
 * @param recordId 存证记录 ID
 * @returns 存证记录
 */
export function getChainRecord(recordId: string): Promise<BlockchainRecord> {
  return http.get<BlockchainRecord>(`${BASE}/${recordId}`)
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

/*
 * 这里原本还有一个 `getBlockchainOverview(): Promise<BlockchainOverview>`，**已删除**。
 * 原因：它的返回类型 `BlockchainOverview`（totalRecords / monthRecords / blockHeight /
 * nodeCount / successRate / trend）与后端实际返回的形状对不上，而且全仓没有任何调用方 ——
 * 一个"没人调、类型又错"的函数留着，下一个人照它的类型写代码就会直接踩空。
 * 概览页用的是下面的 `getChainOverview()`（返回 total / success / failed 三件套）。
 */
/* ============================================================================
 * 以下为「区块链存证（P27 ~ P30）」页面填充时追加的方法，纯新增。
 * ==========================================================================*/

/**
 * 存证记录查询参数。
 *
 * 后端支持三个筛选参数（2026-10-15 复核 agri-production）：
 *   · `status` —— PENDING / SUCCESS / FAILED；
 *   · `bizType` —— 存证表 `target_type`（HARVEST / QUALITY / TRACE；`INSPECTION` 服务端归一成 QUALITY）；
 *   · `keyword` —— 模糊匹配业务键 `target_code` 与存证记录号 `record_no`。
 *
 * ⚠️ 历史结论（core-platform 直连，2026-10-10）是"bizType 会被静默忽略、keyword 只认 biz_no"，
 * 那是**平台侧旧实现**的行为，切流后不再适用 —— 这份注释跟着实现一起更新，
 * 否则调用方会按过期结论做取舍。
 *
 * 按时间范围筛选后端仍不支持，故类型里没有 `startDate` / `endDate`（不加就是不让调用方以为能用）。
 */
export interface CertRecordListParams extends PageQuery {
  /** 存证状态：PENDING / SUCCESS / FAILED */
  status?: string
  /** 业务类型：存证表 target_type */
  bizType?: string
  /** 关键字：模糊匹配业务键（target_code）与存证记录号（record_no） */
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
 * 后端接受两个入参，**至少给一个**（都不给返回业务码 400）：
 *   · `txHash` —— 匹配存证记录的 `tx_hash`（交易哈希）；
 *   · `certNo` —— 匹配存证记录的 `target_code`，即**存证的业务键**。业务单号与溯源码
 *     都存在这一列，所以"按业务单号"和"按溯源码"在后端是同一个查询，不是两套判定逻辑。
 *     注意它**不是** `record_no`（人读存证编号），传 `CHAIN-20260601-0001` 查不到东西。
 *
 * 返回体是布尔值：是否存在该 txHash 命中且 status=SUCCESS 的存证记录。
 *
 * ⚠️ 本部署是**模拟链**（存证 `chainType=SIMULATED`、交易哈希带 `SIMU` 前缀）：
 * 这里的 true 只表示"本库有一条 SUCCESS 的同键记录"，**不是**链上完整性校验。
 * UI 必须把这一点说清楚（见 Verify.tsx 的「模拟链提示」），不能写成"链上验真通过"。
 */
export function verifyCertificate(params: {
  certNo?: string
  txHash?: string
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
   *
   * 服务端存的是**存证表的 target_type**：TRACE（溯源码）/ QUALITY（质检）/ HARVEST（采收批次）。
   * 这里给 `INSPECTION` 是**旧词表**（平台侧 core-platform 与历史页面的叫法），
   * 服务端已做归一：`INSPECTION` → `QUALITY`。两边叫法不一致时**不要**靠"反正查不到就算了"，
   * 归一集中放在后端一处（ChainRecordServiceImpl#normalizeBizType）。
   */
  bizType: 'TRACE' | 'INSPECTION' | 'HARVEST'
  /** 业务键：库里的 target_code（批次号 / 质检单号 / 溯源码），服务端同时接受 bizId 这个旧名字 */
  bizNo: string
}

/**
 * 按业务类型 + 业务单号查询存证记录（GET /blockchain/by-biz）。
 *
 * ⚠️ 这是**非分页**端点：返回后端裸数组（`ApiResponse<List<BlockchainRecordEntity>>`），
 * 无匹配记录时返回 `[]`。因此**不要**套 `toPageResult` —— 套上去会凭空引入
 * 「按 pageNum/pageSize 切片」的语义，让调用方误以为后端支持分页并丢数据。
 *
 * ⚠️ 关联键口径（2026-10-15 切流到 agri-production 后复核）：
 * 服务端按存证记录的 `target_code` 精确匹配（数字键则额外认 `target_id`）。
 * 传 batch_id（数字主键）与传 batch_no（单号）是两条不同的命中路径，报文里要传对字段名 ——
 * 参数名写错会直接 400，而**字段名对、值不对**只会静默返回 `[]`，后者更难查。
 *
 * @param params 业务类型 + 业务单号
 * @returns 存证记录数组；无记录时为空数组（不是 undefined / null）
 */
export function listBlockchainByBiz(
  params: BlockchainByBizParams,
): Promise<BlockchainBizRecord[]> {
  return http.get<BlockchainBizRecord[]>(`${BASE}/by-biz`, params)
}
