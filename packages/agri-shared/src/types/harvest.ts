/**
 * 采收批次 / 库存 实体类型
 *
 * 说明：本文件中追加的字段与枚举元数据为「采收与库存」页面专用扩展，
 * 不修改他人已定义字段，仅做向后兼容的可选字段追加。
 */
import type { OptionItem } from '@agri/shared/types/common'

/** 质量等级：A / B / C / D / reject / 待检 */
export type HarvestGrade = 'A' | 'B' | 'C' | 'D' | 'reject' | '待检'

/** 批次库存状态：1 在库 2 部分出库 3 清空 4 冻结 5 归档 */
export type BatchStatus = 1 | 2 | 3 | 4 | 5

/**
 * 入库状态（原型 P13 状态 Tab）：0 待入库 1 已入库 2 已出库
 *
 * PRD 11.2.5 的 status 描述的是「批次库存」维度，未覆盖「尚未入库」这一业务态，
 * 原型 P13 的状态 Tab（待入库/已入库/已出库）需要独立的入库状态字段承接。
 */
export type InboundStatus = 0 | 1 | 2

/** 外观评价：优 / 良 / 中 / 差（原型 P14 质量信息） */
export type AppearanceGrade = '优' | '良' | '中' | '差'

/** 成熟度分级（PRD 6.1 #31 成熟度评估） */
export type MaturityLevel = '未成熟' | '初熟' | '适采' | '过熟'

/** 库存健康状态（原型 P16）：正常 / 预警 / 不足 / 临期 */
export type InventoryHealthStatus = 'normal' | 'warning' | 'shortage' | 'expiring'

/** 采收批次 */
export interface HarvestBatch {
  /** 批次 ID */
  batchId: string
  /** 批次号 */
  batchNo: string
  /** 地块 ID */
  plotId: string
  /** 地块名称（冗余） */
  plotName?: string
  /** 种养计划 ID */
  planId?: string
  /** 作物 ID */
  cropId: string
  /** 作物名称（冗余） */
  cropName?: string
  /** 作物品种 */
  cropVariety?: string
  /** 采收日期 */
  harvestDate: string
  /** 采收数量 */
  quantity: number
  /** 计量单位 */
  unit: string
  /** 质量等级：A / B / C / D / reject / 待检 */
  grade: HarvestGrade
  /** 关联检测单 ID */
  inspectionId?: string
  /** 采收人 ID */
  operatorId?: string
  /** 采收人姓名 */
  operatorName?: string
  /** 状态：1 在库 2 部分出库 3 清空 4 冻结 5 归档 */
  status: BatchStatus
  /** 是否已生成溯源码 */
  traceGenerated: boolean
  /** 创建时间 */
  createdAt: string
  /** 所属农场 ID（冗余，页面按农场取数） */
  farmId?: string
  /** 所属农场名称（冗余） */
  farmName?: string
  /** 入库状态：0 待入库 1 已入库 2 已出库 */
  inboundStatus?: InboundStatus
  /** 采收面积（亩，原型 P14） */
  harvestArea?: number
  /** 外观评价（原型 P14 质量信息） */
  appearance?: AppearanceGrade
  /** 预计产量（kg，用于产量对比） */
  expectedQuantity?: number
  /** 亩产量（kg/亩，原型 P15） */
  perMuYield?: number
  /** 关联溯源码 */
  traceCode?: string
  /** 关联农事任务 ID */
  relatedTaskId?: string
  /** 关联农事任务名称 */
  relatedTaskName?: string
  /** 关联检测单号 */
  inspectionNo?: string
  /** 存放仓库名称 */
  warehouseName?: string
  /** 库存记录 ID（已入库后回填） */
  inventoryId?: string
  /** 备注 */
  remark?: string
}

/** 采收计划 */
export interface HarvestPlan {
  /** 计划 ID */
  planId: string
  /** 计划编号 */
  planNo: string
  /** 地块 ID */
  plotId: string
  /** 地块名称（冗余） */
  plotName?: string
  /** 种养计划 ID */
  planIdRef?: string
  /** 作物 ID */
  cropId: string
  /** 作物名称（冗余） */
  cropName?: string
  /** 计划采收日期 */
  planHarvestDate: string
  /** 预计产量 */
  expectedQuantity: number
  /** 计量单位 */
  unit: string
  /** 负责人 ID */
  managerId?: string
  /** 负责人姓名 */
  managerName?: string
  /** 执行状态：1 待采收 2 采收中 3 已完成 */
  status: 1 | 2 | 3
  /** 创建时间 */
  createdAt: string
  /** 所属农场 ID（冗余） */
  farmId?: string
  /** 所属农场名称（冗余） */
  farmName?: string
  /** 作物品种 */
  cropVariety?: string
  /** 成熟度评分（0-100，PRD 6.1 #31 成熟度评估） */
  maturityScore?: number
  /** 成熟度分级 */
  maturityLevel?: MaturityLevel
  /** 成熟度评估人 */
  maturityOperator?: string
  /** 成熟度评估时间 */
  maturityAt?: string
  /** 计划投入人力（人） */
  laborCount?: number
  /** 已分配人员姓名，逗号分隔 */
  laborNames?: string
  /** 已分配人员 ID 列表 */
  laborIds?: string[]
  /** 机具安排说明 */
  toolPlan?: string
  /** 实际采收量（kg，与预计产量做偏差分析） */
  actualQuantity?: number
  /** 备注 */
  remark?: string
}

/** 库存流水类型：1 入库 2 出库 3 盘点 4 报损 */
export type InventoryFlowType = 1 | 2 | 3 | 4

/** 库存记录 */
export interface InventoryRecord {
  /** 库存 ID */
  inventoryId: string
  /** 批次 ID */
  batchId: string
  /** 批次号（冗余） */
  batchNo?: string
  /** 仓库名称 */
  warehouseName: string
  /** 当前库存数量 */
  currentQty: number
  /** 计量单位 */
  unit: string
  /** 冻结数量 */
  frozenQty: number
  /** 库位编号 */
  locationCode?: string
  /** 最近入库时间 */
  lastInAt?: string
  /** 最近出库时间 */
  lastOutAt?: string
  /** 品名（原型 P16 品名，如「番茄(A级)」） */
  productName?: string
  /** 品类（番茄/黄瓜/辣椒…，原型 P16 品类筛选） */
  category?: string
  /** 质量等级（冗余） */
  grade?: HarvestGrade
  /** 安全库存（原型 P16） */
  safeQty?: number
  /** 保质期至（原型 P16/P17） */
  expireDate?: string
  /** 关联采收批次号（原型 P17/P18 关联采收记录） */
  relatedBatchNo?: string
  /** 累计损耗数量 */
  lossQty?: number
  /** 最近损耗原因 */
  lossReason?: string
  /** 库存健康状态：正常 / 预警 / 不足 / 临期 */
  healthStatus?: InventoryHealthStatus
  /** 是否冻结 */
  frozen?: boolean
  /** 备注 */
  remark?: string
  /** 创建时间 */
  createdAt?: string
}

/** 库存流水 */
export interface InventoryFlow {
  /** 流水 ID */
  flowId: string
  /** 批次 ID */
  batchId: string
  /** 流水类型：1 入库 2 出库 3 盘点 4 报损 */
  flowType: InventoryFlowType
  /** 变动数量（正数入库，负数出库） */
  quantity: number
  /** 计量单位 */
  unit: string
  /** 操作人姓名 */
  operatorName?: string
  /** 关联单据号 */
  orderNo?: string
  /** 操作时间 */
  operatedAt: string
  /** 备注 */
  remark?: string
  /** 仓库名称（冗余，调拨/出库展示） */
  warehouseName?: string
}

/** 质量等级下拉选项 */
export const GRADE_OPTIONS: OptionItem<HarvestGrade>[] = [
  { value: 'A', label: 'A级(优质)' },
  { value: 'B', label: 'B级(良好)' },
  { value: 'C', label: 'C级(合格)' },
  { value: 'D', label: 'D级(较差)' },
  { value: 'reject', label: 'reject(不合格)' },
  { value: '待检', label: '待检' },
]

/** 质量等级 → 标签颜色：A 绿 / B 蓝 / C 橙 / D 黄 / reject 红 / 待检 灰 */
export const GRADE_COLOR_MAP: Record<string, string> = {
  A: 'green',
  B: 'blue',
  C: 'orange',
  D: 'gold',
  reject: 'red',
  待检: 'default',
}

/**
 * 质量等级 → 展示文案
 *
 * <p>索引类型放宽为 `string` 的原因同 {@link GRADE_COLOR_MAP}：
 * 后端 `grade` 是 `varchar`，可能返回 `HarvestGrade` 枚举外的取值；
 * 收窄索引类型会让 `GRADE_LABEL_MAP[record.grade]` 报 TS7053。
 * 未命中的取值由调用方 `?? record.grade` 兜底，显示原始值而非空白。
 */
export const GRADE_LABEL_MAP: Record<string, string> = {
  A: 'A级',
  B: 'B级',
  C: 'C级',
  D: 'D级',
  reject: '不合格',
  待检: '待检',
}

/** 批次库存状态下拉选项（PRD 11.2.5） */
export const BATCH_STATUS_OPTIONS: OptionItem<BatchStatus>[] = [
  { value: 1, label: '在库' },
  { value: 2, label: '部分出库' },
  { value: 3, label: '清空' },
  { value: 4, label: '冻结' },
  { value: 5, label: '归档' },
]

/** 批次库存状态 → 展示元数据 */
export const BATCH_STATUS_META: Record<BatchStatus, { label: string; color: string }> = {
  1: { label: '在库', color: 'green' },
  2: { label: '部分出库', color: 'blue' },
  3: { label: '清空', color: 'default' },
  4: { label: '冻结', color: 'volcano' },
  5: { label: '归档', color: 'default' },
}

/** 入库状态 → 展示元数据（原型 P13 状态标签，带 ● 色点） */
export const INBOUND_STATUS_META: Record<InboundStatus, { label: string; color: string }> = {
  0: { label: '待入库', color: '#faad14' },
  1: { label: '已入库', color: '#52c41a' },
  2: { label: '已出库', color: '#1677ff' },
}

/** 入库状态下拉选项 */
export const INBOUND_STATUS_OPTIONS: OptionItem<InboundStatus>[] = [
  { value: 0, label: '待入库' },
  { value: 1, label: '已入库' },
  { value: 2, label: '已出库' },
]

/** 采收计划执行状态 → 展示元数据 */
export const HARVEST_PLAN_STATUS_META: Record<1 | 2 | 3, { label: string; color: string }> = {
  1: { label: '待采收', color: 'default' },
  2: { label: '采收中', color: 'processing' },
  3: { label: '已完成', color: 'success' },
}

/** 采收计划执行状态下拉选项 */
export const HARVEST_PLAN_STATUS_OPTIONS: OptionItem<1 | 2 | 3>[] = [
  { value: 1, label: '待采收' },
  { value: 2, label: '采收中' },
  { value: 3, label: '已完成' },
]

/** 库存健康状态 → 展示元数据（原型 P16） */
export const INVENTORY_HEALTH_META: Record<
  InventoryHealthStatus,
  { label: string; color: string }
> = {
  normal: { label: '正常', color: 'green' },
  warning: { label: '预警', color: 'orange' },
  shortage: { label: '不足', color: 'red' },
  expiring: { label: '临期', color: 'gold' },
}

/** 库存健康状态下拉选项 */
export const INVENTORY_HEALTH_OPTIONS: OptionItem<InventoryHealthStatus>[] = [
  { value: 'normal', label: '正常' },
  { value: 'warning', label: '预警' },
  { value: 'shortage', label: '不足' },
  { value: 'expiring', label: '临期' },
]

/** 外观评价选项（原型 P14） */
export const APPEARANCE_OPTIONS: OptionItem<AppearanceGrade>[] = [
  { value: '优', label: '优' },
  { value: '良', label: '良' },
  { value: '中', label: '中' },
  { value: '差', label: '差' },
]

/** 计量单位选项 */
export const HARVEST_UNIT_OPTIONS: OptionItem[] = [
  { value: 'kg', label: 'kg' },
  { value: '箱', label: '箱' },
  { value: '件', label: '件' },
]

/** 仓库选项（原型 P16 仓库筛选 / P17 仓库下拉） */
export const WAREHOUSE_OPTIONS: OptionItem[] = [
  { value: '主仓库', label: '主仓库' },
  { value: '冷藏库A', label: '冷藏库A' },
  { value: '冷藏库B', label: '冷藏库B' },
]

/** 成熟度分级 → 展示元数据 */
export const MATURITY_LEVEL_META: Record<MaturityLevel, { label: string; color: string }> = {
  未成熟: { label: '未成熟', color: 'default' },
  初熟: { label: '初熟', color: 'blue' },
  适采: { label: '适采', color: 'green' },
  过熟: { label: '过熟', color: 'red' },
}

/** 损耗原因选项（PRD 8.6.2 HARV-09 损耗管理） */
export const LOSS_REASON_OPTIONS: OptionItem[] = [
  { value: '运输损耗', label: '运输损耗' },
  { value: '仓储霉变', label: '仓储霉变' },
  { value: '水分蒸发', label: '水分蒸发' },
  { value: '分拣剔除', label: '分拣剔除' },
  { value: '虫鼠害', label: '虫鼠害' },
  { value: '其他', label: '其他' },
]

/**
 * 依据成熟度评分推导成熟度分级。
 *
 * @param score 成熟度评分（0-100）
 * @returns 成熟度分级
 */
export function resolveMaturityLevel(score: number): MaturityLevel {
  if (score >= 95) return '过熟'
  if (score >= 80) return '适采'
  if (score >= 60) return '初熟'
  return '未成熟'
}

/**
 * 依据当前库存 / 安全库存 / 保质期推导库存健康状态（原型 P16）。
 *
 * 判定顺序：不足（≤安全库存 50%）> 临期（≤3 天到期）> 预警（≤安全库存）> 正常。
 *
 * @param currentQty 当前库存
 * @param safeQty 安全库存
 * @param expireDate 保质期截止日期（yyyy-MM-dd）
 * @returns 库存健康状态
 */
export function resolveInventoryHealth(
  currentQty: number,
  safeQty: number,
  expireDate?: string,
): InventoryHealthStatus {
  if (safeQty > 0 && currentQty <= safeQty * 0.5) return 'shortage'
  if (expireDate) {
    const days = Math.ceil(
      (new Date(expireDate).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000,
    )
    if (days <= 3) return 'expiring'
  }
  if (safeQty > 0 && currentQty <= safeQty) return 'warning'
  return 'normal'
}
