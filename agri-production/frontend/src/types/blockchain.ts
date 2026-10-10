/**
 * 区块链上链记录实体类型
 */

/** 上链业务类型：1 种植记录 2 投入品使用 3 农事任务 4 采收 5 检测报告 */
export type ChainBizType = 1 | 2 | 3 | 4 | 5

/** 上链状态：1 待上链 2 上链中 3 已上链 4 上链失败 */
export type ChainStatus = 1 | 2 | 3 | 4

/** 区块链上链记录 */
export interface BlockchainRecord {
  /** 记录 ID */
  recordId: string
  /** 业务 ID */
  bizId: string
  /** 业务类型：1 种植记录 2 投入品使用 3 农事任务 4 采收 5 检测报告 */
  bizType: ChainBizType
  /** 业务摘要 */
  bizSummary?: string
  /** 数据指纹（哈希） */
  dataHash: string
  /** 交易哈希 */
  txHash?: string
  /** 区块高度 */
  blockHeight?: number
  /** 链上时间戳 */
  chainTimestamp?: string
  /** 上链状态：1 待上链 2 上链中 3 已上链 4 上链失败 */
  status: ChainStatus
  /** 失败原因 */
  failReason?: string
  /** 提交时间 */
  submittedAt: string
  /** 上链完成时间 */
  chainedAt?: string
}

/* ============================================================================
 * 以下为「区块链存证（P27 ~ P30）」页面填充时追加的类型，纯新增，不改动既有定义。
 * ==========================================================================*/

/** 存证业务类型编码：后端 bizType 可能是字符串枚举（TRACE/INSPECTION/HARVEST）也可能是数字，前端统一按字符串消费 */
export type CertBizTypeCode = 'FARMING' | 'INPUT' | 'TASK' | 'HARVEST' | 'INSPECTION' | 'CIRCULATION' | 'IOT'

/** 存证状态编码：PENDING 上链中 / SUCCESS 已确认 / FAILED 上链失败 */
export type CertStatusCode = 'PENDING' | 'SUCCESS' | 'FAILED'

/** 上链方式 */
export type AnchorMethod = '实时上链' | '定时批量' | '手动上链'

/** 链上存证记录（对齐原型 P28 列表 / P29 详情字段） */
export interface BlockchainCertRecord {
  /** 记录 ID（同存证编号，用于路由参数） */
  recordId: string
  /** 存证编号，如 CERT-20260602183045 */
  certNo: string
  /** 业务类型编码 */
  bizType: CertBizTypeCode | string
  /** 业务类型名称，如 检测报告 */
  bizTypeName?: string
  /** 关联业务单号 */
  bizNo?: string
  /** 关联溯源码 */
  traceCode?: string
  /** 数据摘要 */
  bizSummary?: string
  /** 交易哈希 */
  txHash?: string
  /** 区块高度 */
  blockHeight?: number
  /** 出块时间 */
  blockTime?: string
  /** 链 ID，如 agri-chain-001 */
  chainId?: string
  /** 确认数（区块确认） */
  confirmations?: number
  /** 安全阈值（默认 6） */
  confirmThreshold?: number
  /** 数据指纹 SHA-256 */
  dataHash: string
  /** 数字签名 ECDSA */
  signature?: string
  /** 上链方式 */
  anchorMethod?: AnchorMethod | string
  /** 存证状态 */
  status: CertStatusCode | string
  /** 失败原因 */
  failReason?: string
  /** 提交时间 */
  submittedAt?: string
  /** 上链时间 */
  anchorAt?: string
  /** 存证原始数据（JSON 展示） */
  payload?: Record<string, unknown>
}

/**
 * 存证域 `GET /blockchain/by-biz` 返回的存证记录（对齐后端 BlockchainRecordEntity 真实字段）。
 *
 * ⚠️ 字段名与运行时形状均以连服实测为准（2026-10-10，core-app :8140）：
 * `{"recordId":"DEMO-CHAIN-001","bizType":"TRACE","bizNo":"DEMO-TC-0001","batchId":"DEMO-BATCH-001",
 *   "traceCode":"DEMO-TC-0001","chainType":"TrustChain","chainNetwork":"agri-mainnet",
 *   "txHash":"DEMO-TX-0x1a2b3c4d5e6f0001","blockHeight":"12884201","status":"SUCCESS","anchorAt":"..."}`
 *
 * 两个必须知道的坑：
 * - `blockHeight` 运行时是**字符串**（"12884201"），不是 number；展示前统一 String() 处理，
 *   否则会踩本项目已发生过的 Long→String 静默错判。
 * - `txHash` / `blockHeight` / `status` 在 PENDING 记录上恒为 null（未出块、未回填哈希）。
 */
export interface BlockchainBizRecord {
  /** 存证记录 ID */
  recordId: string
  /** 业务类型：TRACE / INSPECTION / HARVEST */
  bizType?: string
  /** 关联业务单号（TRACE=溯源码、INSPECTION=质检单号、HARVEST=批次号 batch_no） */
  bizNo?: string
  /** 关联批次 ID */
  batchId?: string
  /** 关联溯源码 */
  traceCode?: string
  /** 链类型 */
  chainType?: string
  /** 链网络标识 */
  chainNetwork?: string
  /** 交易哈希；PENDING 记录为 null */
  txHash?: string | null
  /** 区块高度（运行时为字符串）；PENDING 记录为 null */
  blockHeight?: string | number | null
  /** 存证内容哈希 */
  payloadHash?: string | null
  /** 上链时间；PENDING 记录为 null */
  anchorAt?: string | null
  /** 存证状态：PENDING / SUCCESS / FAILED */
  status?: string | null
  /** 记录创建时间（ProduceBaseEntity 审计字段，后端真实返回；未上链时用它兜底排序） */
  createdAt?: string | null
  /** 记录更新时间（ProduceBaseEntity 审计字段，后端真实返回） */
  updatedAt?: string | null
}

/** 存证类型分布项 */
export interface ChainTypeStat {
  /** 类型名称 */
  name: string
  /** 条数 */
  value: number
}

/** 链上健康度 */
export interface ChainHealth {
  /** 联盟链运行状态 */
  status: string
  /** 当前区块高度 */
  blockHeight: number
  /** 最近出块时间 */
  latestBlockTime: string
  /** 共识节点在线情况，如 5/5 */
  onlineNodes: string
  /** 数据完整性校验结论 */
  integrityCheck: string
  /** 完整性校验是否通过 */
  integrityPassed: boolean
  /** 链上确认率（百分比） */
  confirmRate: number
}

/** 最近存证记录项 */
export interface ChainRecentRecord {
  /** 存证时间 */
  time: string
  /** 存证类型 */
  type: string
  /** 摘要 */
  summary: string
  /** 状态 */
  status: CertStatusCode | string
}

/** 待上链队列项 */
export interface ChainPendingItem {
  /** 队列标题 */
  title: string
  /** 条数 */
  count: number
  /** 预计上链时间 */
  expectTime?: string
}

/** 区块链存证总览（原型 P27） */
export interface BlockchainChainOverview {
  /** 存证总数 */
  totalRecords: number
  /** 本月上链条数 */
  monthRecords: number
  /** 本月环比增幅（百分比） */
  monthGrowth: number
  /** 待上链条数 */
  pendingRecords: number
  /** 链上验证通过率（百分比） */
  verifyPassRate: number
  /** 通过率环比增幅（百分比） */
  verifyPassGrowth: number
  /** 存证类型分布 */
  typeStats: ChainTypeStat[]
  /** 链上健康度 */
  health: ChainHealth
  /** 最近存证记录 */
  recentRecords: ChainRecentRecord[]
  /** 待上链队列 */
  pendingQueue: ChainPendingItem[]
}

/** 验真进度步骤（原型 P30 六步） */
export interface VerifyStep {
  /** 步骤标题 */
  title: string
  /** 耗时文案，如 0.3s */
  duration: string
  /** 是否通过 */
  passed: boolean
}

/** 验真结论项（原型 P29 / P30 五项） */
export interface VerifyCheckItem {
  /** 结论编码 */
  key: string
  /** 结论名称 */
  label: string
  /** 是否通过 */
  passed: boolean
  /** 结论说明 */
  detail: string
}

/** 存证验真结果 */
export interface CertificateVerifyResult {
  /** 存证编号 */
  certNo: string
  /** 存证类型名称 */
  bizTypeName?: string
  /** 交易哈希 */
  txHash?: string
  /** 区块高度 */
  blockHeight?: number
  /** 确认数 */
  confirmations?: number
  /** 是否整体通过 */
  passed: boolean
  /** 结论摘要 */
  summary: string
  /** 总耗时（秒） */
  costSeconds: number
  /** 验证进度步骤 */
  steps: VerifyStep[]
  /** 五项验真结论 */
  checks: VerifyCheckItem[]
}

/** 区块链概览统计 */
export interface BlockchainOverview {
  /** 累计上链条数 */
  totalRecords: number
  /** 本月上链条数 */
  monthRecords: number
  /** 当前区块高度 */
  blockHeight: number
  /** 节点数量 */
  nodeCount: number
  /** 上链成功率（百分比） */
  successRate: number
  /** 近 7 日上链趋势 */
  trend: { date: string; count: number }[]
}
