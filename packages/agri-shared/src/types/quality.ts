/**
 * 质量检测 / 分级 / 检测机构 / 不合格品处置 实体类型
 */

/** 检测结果：1 合格 2 不合格 3 待检 */
export type InspectResult = 1 | 2 | 3

/** 检测类型：1 农残 2 重金属 3 微生物 4 理化 5 感官 */
export type InspectType = 1 | 2 | 3 | 4 | 5

/** 质量检测单 */
export interface QualityInspection {
  /** 检测单 ID */
  inspectionId: string
  /** 检测单号 */
  inspectionNo: string
  /** 关联批次 ID */
  batchId?: string
  /** 批次号（冗余） */
  batchNo?: string
  /** 关联地块 ID */
  plotId?: string
  /** 作物 ID */
  cropId?: string
  /** 作物名称（冗余） */
  cropName?: string
  /** 检测类型：1 农残 2 重金属 3 微生物 4 理化 5 感官 */
  inspectType: InspectType
  /** 检测结果：1 合格 2 不合格 3 待检 */
  inspectResult: InspectResult
  /** 检测机构 ID */
  labId?: string
  /** 检测机构名称（冗余） */
  labName?: string
  /** 检测人姓名 */
  inspectorName?: string
  /** 送检日期 */
  submitDate: string
  /** 出具报告日期 */
  reportDate?: string
  /** 报告附件地址 */
  reportUrl?: string
  /** 检测结论 */
  conclusion?: string
  /** 是否已上链 */
  onChain: boolean
  /** 创建时间 */
  createdAt: string
}

/** 检测项明细 */
export interface InspectionItem {
  /** 明细 ID */
  itemId: string
  /** 检测单 ID */
  inspectionId: string
  /** 检测项名称 */
  itemName: string
  /** 标准限值 */
  standardLimit: string
  /** 实测值 */
  measuredValue: string
  /** 单位 */
  unit?: string
  /** 是否达标 */
  qualified: boolean
}

/** 质量分级规则 */
export interface QualityGradeRule {
  /** 规则 ID */
  ruleId: string
  /** 分级编码：A / B / C / D */
  gradeCode: 'A' | 'B' | 'C' | 'D'
  /** 分级名称 */
  gradeName: string
  /** 适用作物 ID */
  cropId?: string
  /** 适用作物名称（冗余） */
  cropName?: string
  /** 分级指标，如 单果重 / 糖度 / 外观 */
  metrics: string
  /** 判定标准描述 */
  criteria: string
  /** 价格系数 */
  priceFactor: number
  /** 启用状态：1 启用 0 停用 */
  status: 0 | 1
  /** 更新时间 */
  updatedAt: string
}

/** 检测机构 */
export interface TestingLab {
  /** 机构 ID */
  labId: string
  /** 机构名称 */
  labName: string
  /** 机构编码 */
  labCode: string
  /** 资质等级：1 国家级 2 省级 3 市级 */
  labLevel: 1 | 2 | 3
  /** 联系人 */
  contactName?: string
  /** 联系电话 */
  contactPhone?: string
  /** 所在地区 */
  region?: string
  /** 资质证书编号 */
  certNo?: string
  /** 合作状态：1 合作中 0 已终止 */
  status: 0 | 1
  /** 创建时间 */
  createdAt: string
}

/* ========================================================================== *
 * 以下类型为「质量检测与溯源」页面补充（P25 质量检测记录 / PRD #35 质量分级管理）
 * 说明：后端 prod_inspection 状态取值为 PENDING / TESTING / DONE，结论为 PASS / FAIL，
 * 检测类型为 SELF / SEND / SAMPLING，与既有 QualityInspection（1/2/3 数字枚举）
 * 口径不同，故新增 RawInspection 承接后端原始形态。
 * ========================================================================== */

/** 后端检测单状态 */
export type InspectionServerStatus = 'PENDING' | 'TESTING' | 'DONE'

/** 后端检测结论 */
export type InspectionServerResult = 'PASS' | 'FAIL'

/** 后端检测类型：SELF 自检 / SEND 送检 / SAMPLING 抽检 */
export type InspectionServerType = 'SELF' | 'SEND' | 'SAMPLING'

/** 质量检测单（后端 prod_inspection 原始形态） */
export interface RawInspection {
  /** 检测单 ID */
  inspectionId: string
  /** 检测单号 */
  inspectionNo?: string
  /** 关联批次 ID */
  batchId?: string
  /** 批次号（冗余） */
  batchNo?: string
  /** 地块 ID */
  plotId?: string
  /** 作物 ID */
  cropId?: string
  /** 作物名称（冗余） */
  cropName?: string
  /** 检测类型 */
  inspectionType?: InspectionServerType | string
  /** 检测人 ID */
  inspectorId?: string
  /** 检测人姓名 */
  inspectorName?: string
  /** 抽样数量 */
  sampleQty?: number | string
  /** 抽样时间 */
  sampleAt?: string
  /** 检测结论 PASS / FAIL */
  result?: InspectionServerResult | string
  /** 报告附件地址 */
  reportUrl?: string
  /** 检测单状态 */
  status?: InspectionServerStatus | string
  /** 检测机构 ID（PRD 事件载荷字段，后端表结构补齐后回显） */
  labId?: string
  /** 检测机构名称（冗余） */
  labName?: string
  /** 是否已上链 */
  onChain?: boolean
  /** 创建时间 */
  createdAt?: string
  /** 更新时间 */
  updatedAt?: string
}

/** 检测项明细（后端 /quality/inspections/{id}/items 返回 Map 结构） */
export interface InspectionItemDetail {
  /** 检测单 ID */
  inspectionId?: string
  /** 检测单号 */
  inspectionNo?: string
  /** 检测类型 */
  inspectionType?: string
  /** 检测项名称 */
  item?: string
  /** 检测结论 */
  result?: string
  /** 检测单状态 */
  status?: string
  /** 检测项明细列表（后端补齐后消费） */
  items?: InspectionItem[]
}

/** 等级评定状态：pending 待复核 / confirmed 已确认 */
export type GradeReviewStatus = 'pending' | 'confirmed'

/** 等级评定（PRD 6.1 #35 质量分级管理） */
export interface GradeAssessment {
  /** 批次 ID */
  batchId: string
  /** 批次号 */
  batchNo?: string
  /** 作物名称 */
  cropName?: string
  /** 地块名称 */
  plotName?: string
  /** 采收日期 */
  harvestDate?: string
  /** 初评等级（采收登记时系统给出） */
  initialGrade?: string
  /** 复核等级（人工复核后确认） */
  reviewGrade?: string
  /** 评定人姓名 */
  assessorName?: string
  /** 评定时间 */
  assessedAt?: string
  /** 复核状态 */
  reviewStatus?: GradeReviewStatus
  /** 复核意见 */
  remark?: string
}

/** 等级变更记录（PRD 6.1 #35：谁在何时从什么等级改为什么等级、原因） */
export interface GradeChangeRecord {
  /** 变更记录 ID */
  changeId: string
  /** 批次 ID */
  batchId: string
  /** 批次号（冗余） */
  batchNo?: string
  /** 原等级 */
  fromGrade?: string
  /** 变更后等级 */
  toGrade: string
  /** 操作人姓名 */
  operatorName: string
  /** 变更时间 */
  changedAt: string
  /** 变更原因 */
  reason?: string
}

/** 不合格品处置方式：1 召回 2 销毁 3 降级 4 返工 */
export type RecallHandleType = 1 | 2 | 3 | 4

/** 不合格品处置记录 */
export interface ProductRecall {
  /** 处置单 ID */
  recallId: string
  /** 处置单号 */
  recallNo: string
  /**
   * 关联批次 ID
   * 后端 `AdminTraceController.recall(@RequestParam String batchId)`、
   * `AdminQualityController.recall(@RequestParam String batchId)` 签名均为 String，
   * 故前端按 string 处理（DB 层指向存量 prod_batch.id bigint，不影响接口类型）。
   */
  batchId: string
  /** 批次号（冗余） */
  batchNo?: string
  /** 关联检测单 ID */
  inspectionId?: string
  /** 不合格原因 */
  reason: string
  /** 涉及数量 */
  quantity: number
  /** 计量单位 */
  unit: string
  /** 处置方式：1 召回 2 销毁 3 降级 4 返工 */
  handleType: RecallHandleType
  /** 处置进度：1 待处置 2 处置中 3 已完成 */
  status: 1 | 2 | 3
  /** 责任人姓名 */
  ownerName?: string
  /** 处置完成时间 */
  finishedAt?: string
  /** 创建时间 */
  createdAt: string
}
