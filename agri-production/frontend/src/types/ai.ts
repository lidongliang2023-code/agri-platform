/**
 * AI 助手（病虫害识别 / 问答 / 产量预测）实体类型
 */

/** 识别状态：1 识别中 2 成功 3 失败 */
export type DetectStatus = 1 | 2 | 3

/** 后端诊断状态（prod_ai_diagnosis.status） */
export type DiagnosisStatus = 'PENDING' | 'SUCCESS' | 'FAILED'

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

/** AI 问答会话 */
export interface ChatSession {
  /** 会话 ID */
  sessionId: string
  /** 会话标题 */
  title: string
  /** 最后一条消息摘要 */
  lastMessage?: string
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
