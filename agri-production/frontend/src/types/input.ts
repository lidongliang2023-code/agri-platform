/**
 * 农资投入品（台账 / 出入库 / 使用记录）实体类型
 */
import type { EnableStatus } from './common'

/** 投入品分类：1 种子 2 肥料 3 农药 4 兽药 5 饲料 6 其他 */
export type InputCategory = 1 | 2 | 3 | 4 | 5 | 6

/** 出入库类型：1 入库 2 出库 */
export type StockType = 1 | 2

/** 投入品 */
export interface InputItem {
  /** 投入品 ID */
  inputId: string
  /** 投入品名称 */
  inputName: string
  /** 分类：1 种子 2 肥料 3 农药 4 兽药 5 饲料 6 其他 */
  category: InputCategory
  /** 登记证号 */
  regNo: string
  /** 生产厂家 */
  manufacturer: string
  /** 当前库存数量 */
  stockQty: number
  /** 计量单位 */
  unit: string
  /** 规格型号 */
  spec?: string
  /** 有效成分 */
  activeIngredient?: string
  /** 安全间隔期（天） */
  safetyInterval?: number
  /** 保质期（天） */
  shelfLife?: number
  /** 状态：1 正常 0 停用 */
  status: EnableStatus
  /** 创建时间 */
  createdAt: string
  /** 更新时间 */
  updatedAt: string
}

/** 出入库记录 */
export interface InputStockRecord {
  /** 记录 ID */
  recordId: string
  /** 投入品 ID */
  inputId: string
  /** 投入品名称（冗余） */
  inputName?: string
  /** 出入库类型：1 入库 2 出库 */
  stockType: StockType
  /** 数量 */
  quantity: number
  /** 计量单位 */
  unit: string
  /** 批次号 */
  batchNo?: string
  /** 供应商 */
  supplier?: string
  /** 单价（元） */
  price?: number
  /** 操作人 ID */
  operatorId?: string
  /** 操作人姓名 */
  operatorName?: string
  /** 出入库时间 */
  operateAt: string
  /** 备注 */
  remark?: string
}

/** 投入品使用记录 */
export interface InputUsage {
  /** 使用记录 ID */
  usageId: string
  /** 投入品 ID */
  inputId: string
  /** 投入品名称（冗余） */
  inputName?: string
  /** 关联任务 ID */
  taskId?: string
  /** 使用地块 ID */
  plotId?: string
  /** 使用地块名称（冗余） */
  plotName?: string
  /** 使用数量 */
  quantity: number
  /** 计量单位 */
  unit: string
  /** 稀释倍数 */
  dilutionRatio?: string
  /** 使用方式，如 喷施 / 沟施 */
  usageMethod?: string
  /** 使用人 ID */
  operatorId?: string
  /** 使用人姓名 */
  operatorName?: string
  /** 使用时间 */
  usedAt: string
  /** 是否已上链 */
  onChain: boolean
  /** 备注 */
  remark?: string
}

/**
 * 投入品使用记录（列表/统计口径，对齐后端 InputUsageEntity）
 *
 * 与 {@link InputUsage} 的区别：本接口是**接口返回值的宽松投影**——
 * 除 `usageId` 外所有字段均可选，字段命名直接对齐后端实体
 * （`dosage` / `method` / `safetyIntervalDays`），用于列表、图表、统计等只读场景。
 * `InputUsage` 是**表单提交口径**，必填项完整，用于新增/编辑投入品使用记录。
 *
 * 页面统一从 '@/types' 引入本类型，不要从 '@/api/inputs' 引入。
 */
export interface InputUsageRecord {
  /** 使用记录 ID */
  usageId: string
  /** 农事任务 ID */
  taskId?: string
  /** 地块 ID */
  plotId?: string
  /** 投入品 ID */
  inputId?: string
  /** 投入品名称 */
  inputName?: string
  /** 用量 */
  dosage?: number
  /** 单位 */
  unit?: string
  /** 施用方式 */
  method?: string
  /** 操作人 */
  operatorId?: string
  /** 使用时间 */
  usedAt?: string
  /** 安全间隔期（天） */
  safetyIntervalDays?: number
  /** 状态 1正常 0作废 */
  status?: number
  /** 创建时间 */
  createdAt?: string
}
