/**
 * AI 助手（病虫害识别 / 问答 / 产量预测）实体类型
 */

/** 识别状态：1 识别中 2 成功 3 失败 */
export type DetectStatus = 1 | 2 | 3

/** 后端诊断状态（prod_ai_diagnosis.status） */
export type DiagnosisStatus = 'PENDING' | 'SUCCESS' | 'FAILED'

/**
 * 服务端产量预测（骨架）返回体：`GET /api/v1/production/ai/yield-forecast`
 *
 * ⚠️ 后端 `AiController#yieldForecast` 的签名是 `ApiResponse<Map<String, Object>>`，
 * 实际返回的是**单点结果** `{plotId, sampleCount, forecastYield, unit}`，
 * **不是** `{records, total, page, size}` 分页结构。
 * 前端若按分页列表去读 `list` 会恒为 undefined——这是键名/形状不匹配，
 * 不等于「服务端无数据」，页面禁止以后者口径提示用户。
 */
export interface YieldForecastSummary {
  /** 地块 ID（未传 plotId 时为 null） */
  plotId?: string | null
  /** 参与测算的样本量 */
  sampleCount?: number
  /** 预测产量（骨架口径：样本量 × 100，非真实模型输出） */
  forecastYield?: number
  /** 单位，如 kg */
  unit?: string
}

/**
 * AI 诊断记录（`GET /api/v1/production/ai`，对应后端 AiDiagnosisEntity / prod_ai_diagnosis）
 *
 * ⚠️ 该实体**没有**危害描述（damage）与推荐用药（drugs）字段，
 * 页面禁止用任何本地数据填充这两个字段，缺失时必须显示「服务端未提供」。
 */
export interface AiDiagnosisRecord {
  /** 诊断记录 ID（业务主键） */
  diagnosisId: string
  /** 地块 ID */
  plotId?: string
  /** 作物 ID */
  cropId?: string
  /** 作物名称 */
  cropName?: string
  /** 识别图片 */
  imageUrl?: string
  /** 诊断类型 PEST / GROWTH / MATURITY */
  diagnosisType?: string
  /** 识别结果（病虫害名称） */
  resultLabel?: string
  /**
   * 置信度，**单位为百分比**
   *
   * 后端列定义为 `confidence DECIMAL(5,2) COMMENT '置信度(%)'`，
   * 例如 92.50 表示 92.5%。页面按 0~1 比率展示时需做单位换算，不得直接当作比率。
   */
  confidence?: number
  /** 处置建议 */
  suggestion?: string
  /** 模型名称 */
  modelName?: string
  /** 诊断时间 */
  diagnosedAt?: string
  /** 状态 PENDING / SUCCESS / FAILED */
  status?: DiagnosisStatus | string
}

/** 病虫害识别结果 */
export interface PestDetection {
  /** 识别记录 ID */
  detectId: string
  /** 图片地址 */
  imageUrl: string
  /** 关联地块 ID */
  plotId?: string
  /** 关联地块名称（冗余） */
  plotName?: string
  /** 作物 ID */
  cropId?: string
  /** 识别状态：1 识别中 2 成功 3 失败 */
  status: DetectStatus
  /** 病虫害名称 */
  pestName?: string
  /** 病虫害类型：1 病害 2 虫害 3 草害 */
  pestType?: 1 | 2 | 3
  /** 置信度（0~1） */
  confidence?: number
  /** 危害程度：1 轻 2 中 3 重 */
  severity?: 1 | 2 | 3
  /** 防治建议 */
  suggestion?: string
  /** 推荐用药 */
  recommendDrugs?: string[]
  /** 识别时间 */
  detectedAt: string
}

/** 消息角色 */
export type ChatRole = 'user' | 'assistant'

/** AI 问答消息 */
export interface ChatMessage {
  /** 消息 ID */
  messageId: string
  /** 会话 ID */
  sessionId: string
  /** 消息角色 */
  role: ChatRole
  /** 消息内容 */
  content: string
  /** 引用知识条目 ID 列表 */
  refDocIds?: string[]
  /** 消息时间 */
  createdAt: string
}

/**
 * AI 问答会话
 *
 * ⚠️ 键名现实：后端 `GET /ai/assistant/sessions`（AiDiagnosisService#sessions）
 * 返回的是**诊断记录摘要**，只有 `sessionId / plotId / diagnosisType / resultLabel /
 * confidence / diagnosedAt`，**没有** `title / lastMessage / createdAt / updatedAt`。
 * 因此下面四个字段在实际响应中均为 undefined，页面必须显式显示占位，
 * 不能让列表渲染出「标题空、时间空、摘要空」的空壳行。
 */
export interface ChatSession {
  /** 会话 ID */
  sessionId: string
  /** 会话标题（当前后端不返回） */
  title: string
  /** 最后一条消息摘要（当前后端不返回） */
  lastMessage?: string
  /** 诊断结果标签（后端会话摘要实际返回的字段，可作标题兜底） */
  resultLabel?: string
  /** 诊断时间（后端会话摘要实际返回的字段，可作时间兜底） */
  diagnosedAt?: string
  /** 创建时间 */
  createdAt: string
  /** 更新时间 */
  updatedAt: string
}

/** 产量预测 */
export interface YieldForecast {
  /** 预测 ID */
  forecastId: string
  /** 种养计划 ID */
  planId?: string
  /** 地块 ID */
  plotId?: string
  /** 地块名称（冗余） */
  plotName?: string
  /** 作物 ID */
  cropId: string
  /** 作物名称（冗余） */
  cropName?: string
  /** 预测产量（kg） */
  forecastYield: number
  /** 预测单产（kg/亩） */
  forecastPerMu: number
  /** 预测区间下限 */
  lowerBound: number
  /** 预测区间上限 */
  upperBound: number
  /** 模型版本 */
  modelVersion?: string
  /** 准确率（百分比） */
  accuracy?: number
  /** 关键影响因素 */
  factors?: string[]
  /** 预计采收日期 */
  forecastHarvestDate?: string
  /** 预测时间 */
  forecastAt: string
}
