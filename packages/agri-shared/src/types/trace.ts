/**
 * 溯源（溯源码 / 全链路节点）实体类型
 */

/** 溯源码状态 */
export type TraceCodeStatus = 'generated' | 'activated' | 'scanned' | 'expired'

/** 溯源码 */
export interface TraceCode {
  /** 溯源码（业务定位字段，端点 /trace/{code} 用它，不要用实体 id 做跳转） */
  code: string
  /** 存量表雪花主键（prod_trace_code.id），仅列表展示用，禁止用于路由/详情跳转 */
  id?: number
  /**
   * 关联批次 ID
   * 语义上属于存量批次体系（prod_batch），但后端 Controller 签名统一为 String，
   * 故前端接口调用与实体字段一律按 string 处理（数据库层为 bigint，不影响接口类型）。
   */
  batchId: string
  /** 批次号（冗余） */
  batchNo?: string
  /** 关联农场 ID */
  farmId?: string
  /** 状态：generated/activated/scanned/expired */
  status: TraceCodeStatus
  /** 激活时间 */
  activatedAt?: string
  /** 扫码次数 */
  scanCount: number
  /** 最近扫码时间 */
  lastScanAt?: string
  /** 失效日期 */
  expireDate?: string
  /** 码类型：1 批次码 2 单品码 */
  codeType: 1 | 2
  /** 创建时间 */
  createdAt: string
}

/** 溯源环节：seed/plant/grow/harvest/inspect/storage/logistics */
export type TraceStage =
  | 'seed'
  | 'plant'
  | 'grow'
  | 'harvest'
  | 'inspect'
  | 'storage'
  | 'logistics'

/** 全链路溯源节点 */
export interface TraceNode {
  /** 节点 ID */
  nodeId: string
  /** 关联批次 ID（/trace/full-chain/{batchId}/nodes，Controller 签名 String，前端按 string 处理） */
  batchId: string
  /** 溯源环节 */
  stage: TraceStage
  /** 环节名称 */
  stageName: string
  /** 环节发生时间 */
  occurredAt: string
  /** 操作人姓名 */
  operatorName?: string
  /** 环节描述 */
  description?: string
  /** 关联单据 ID */
  refId?: string
  /** 现场照片地址列表 */
  photoUrls?: string[]
  /** 上链交易哈希 */
  txHash?: string
  /** 是否已上链 */
  onChain: boolean
}

/** 扫码记录 */
export interface TraceScanRecord {
  /** 记录 ID */
  scanId: string
  /** 溯源码 */
  code: string
  /** 扫码地区 */
  region?: string
  /** 扫码渠道：1 微信 2 支付宝 3 浏览器 */
  channel: 1 | 2 | 3
  /** 扫码时间 */
  scannedAt: string
}

/* ========================================================================== *
 * 以下类型为「质量检测与溯源」页面补充（P23 溯源码管理 / P24 全链路溯源 / P26 溯源报告）
 * 说明：后端 prod_trace_code 为 V1 存量表，主键为雪花 Long，状态取值为
 * generated / active / scanned / revoked，与前端 TraceCodeStatus 存在口径差异，
 * 故新增 RawTraceCode 承接后端原始形态，页面层统一归一化后再消费。
 * ========================================================================== */

/** 后端溯源码状态原始取值（active / revoked 为后端实际写入值） */
export type TraceCodeServerStatus = TraceCodeStatus | 'active' | 'revoked'

/** 溯源码（后端原始形态，字段尽量可选以兼容存量表） */
export interface RawTraceCode extends Omit<Partial<TraceCode>, 'status' | 'id'> {
  /** 溯源码 */
  code: string
  /** 后端原始状态 */
  status: TraceCodeServerStatus
  /** 雪花主键（V1 存量表） */
  id?: number | string
  /** 激活操作人 */
  activatedBy?: string
  /** 更新时间 */
  updatedAt?: string
  /** 产品名称（冗余，后端后续补齐） */
  productName?: string
  /** 农场名称（冗余） */
  farmName?: string
  /** 地块名称（冗余） */
  plotName?: string
  /** 质量等级（冗余） */
  grade?: string
  /** 是否已上链 */
  onChain?: boolean
  /** 上链交易哈希 */
  txHash?: string
}

/** 全链路溯源节点（后端 /trace/full-chain/{batchId}/nodes 返回 Map 结构） */
export interface TraceFullChainNode {
  /** 节点类型：BATCH / TRACE_CODE，后续扩展 PLANT / INPUT / INSPECT 等 */
  nodeType: string
  /** 节点名称 */
  nodeName: string
  /** 关联单据 ID */
  refId?: string
  /** 关联单据编号（如溯源码、批次号） */
  refNo?: string
  /** 发生时间 */
  occurredAt?: string
  /** 溯源环节（前端增强字段，后端补齐后可直接消费） */
  stage?: TraceStage
  /** 操作人姓名（前端增强字段） */
  operatorName?: string
  /** 环节描述（前端增强字段） */
  description?: string
  /** 是否已上链（前端增强字段） */
  onChain?: boolean
  /** 上链交易哈希（前端增强字段） */
  txHash?: string
}

/** 溯源报告（原型 P26 四章结构，面向消费者 / 监管的正式报告） */
export interface TraceReport {
  /** 报告 ID */
  reportId: string
  /** 报告编号 */
  reportNo: string
  /** 溯源码 */
  code: string
  /** 批次 ID */
  batchId?: string
  /** 批次号 */
  batchNo?: string
  /** 产品名称 */
  productName?: string
  /** 品种 */
  variety?: string
  /** 质量等级 */
  grade?: string
  /** 农场名称 */
  farmName?: string
  /** 地块名称 */
  plotName?: string
  /** 产地 */
  region?: string
  /** 采收日期 */
  harvestDate?: string
  /** 种植日期 */
  plantDate?: string
  /** 灌溉方式 */
  irrigation?: string
  /** 土壤类型 */
  soilType?: string
  /** 施肥次数 */
  fertilizeCount: number
  /** 病虫害防治次数 */
  protectCount: number
  /** 投入品是否全部合规 */
  inputCompliant: boolean
  /** 检测编号 */
  inspectionNo?: string
  /** 检测机构 */
  labName?: string
  /** 检测结果描述 */
  inspectResult?: string
  /** 综合评级 */
  inspectGrade?: string
  /** 全链路存证记录数 */
  chainTotal: number
  /** 已上链记录数 */
  chainOnChain: number
  /** 链上验证是否通过 */
  verifyPassed: boolean
  /** 报告生成时间 */
  generatedAt: string
}
