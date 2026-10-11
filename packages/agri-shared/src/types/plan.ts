/**
 * 种养计划实体类型
 */

/** 种养计划状态：1 草稿 2 待审批 3 进行中 4 已完成 5 已终止 */
export type PlanStatus = 1 | 2 | 3 | 4 | 5

/** 种养计划 */
export interface Plan {
  /** 计划 ID */
  planId: string
  /** 计划编码 */
  planNo: string
  /** 计划名称 */
  planName: string
  /** 所属农场 ID */
  farmId: string
  /** 所属农场名称（冗余） */
  farmName?: string
  /** 地块 ID */
  plotId?: string
  /** 地块名称（冗余） */
  plotName?: string
  /** 作物 ID */
  cropId: string
  /** 作物名称 */
  cropName: string
  /** 作物品种 */
  cropVariety?: string
  /** 计划开始日期 */
  startDate: string
  /** 计划结束日期 */
  endDate: string
  /** 计划产量（kg） */
  expectedYield: number
  /** 计划面积（亩） */
  planArea: number
  /** 负责人 ID */
  managerId?: string
  /** 负责人姓名 */
  managerName?: string
  /** 状态：1 草稿 2 待审批 3 进行中 4 已完成 5 已终止 */
  status: PlanStatus
  /** 关联 SOP 模板 ID */
  sopTemplateId?: string
  /** 备注 */
  remark?: string
  /** 创建时间 */
  createdAt: string
  /** 更新时间 */
  updatedAt: string
}

/** 种养计划阶段（农事日历节点） */
export interface PlanStage {
  /** 阶段 ID */
  stageId: string
  /** 所属计划 ID */
  planId: string
  /** 阶段序号 */
  stageNo: number
  /** 阶段名称，如 播种期 / 施肥期 */
  stageName: string
  /** 计划开始日期 */
  planStartDate: string
  /** 计划结束日期 */
  planEndDate: string
  /** 实际开始日期 */
  actualStartDate?: string
  /** 实际结束日期 */
  actualEndDate?: string
  /** 阶段说明 */
  description?: string
  /** 关联任务数量 */
  taskCount?: number
  /**
   * 阶段状态：1 未开始 / 2 进行中 / 3 已完成 / 0 已取消
   *
   * 与后端 PlanStageEntity.status 及 api 层 PlanStagePayload.status 口径一致；
   * 可选是因为部分聚合视图（如日历条目）不返回状态。
   */
  status?: number
  /**
   * 阶段序号（后端实体字段名为 stageSeq，与视图模型 stageNo 同义）
   * 可选：仅后端直连场景返回，聚合视图用 stageNo。
   */
  stageSeq?: number
}
