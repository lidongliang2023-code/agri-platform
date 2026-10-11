/**
 * 数据分析与报表实体类型
 */

/** 指标趋势点 */
export interface TrendPoint {
  /** 统计日期 */
  date: string
  /** 指标值 */
  value: number
}

/** 生产总览指标 */
export interface ProductionOverview {
  /** 农场数量 */
  farmCount: number
  /** 地块数量 */
  plotCount: number
  /** 在种面积（亩） */
  plantingArea: number
  /** 进行中计划数 */
  runningPlanCount: number
  /** 待办任务数 */
  pendingTaskCount: number
  /** 本月采收量（kg） */
  monthHarvestQty: number
  /** 合格率（百分比） */
  passRate: number
  /** 活跃设备数 */
  activeDeviceCount: number
}

/** 数据分析总览 */
export interface AnalyticsOverview {
  /** 生产总览 */
  overview: ProductionOverview
  /** 产量趋势 */
  yieldTrend: TrendPoint[]
  /** 任务完成趋势 */
  taskTrend: TrendPoint[]
  /** 投入品消耗排行 */
  inputRanking: { name: string; value: number }[]
  /** 作物分布 */
  cropDistribution: { name: string; value: number }[]
}

/** 报表类型：1 日报 2 周报 3 月报 4 季报 5 年报 */
export type ReportType = 1 | 2 | 3 | 4 | 5

/** 生产报表 */
export interface ReportItem {
  /** 报表 ID */
  reportId: string
  /** 报表名称 */
  reportName: string
  /** 报表类型：1 日报 2 周报 3 月报 4 季报 5 年报 */
  reportType: ReportType
  /** 统计周期，如 2026-03 */
  period: string
  /** 生成时间 */
  generatedAt: string
  /** 生成人姓名 */
  generatorName?: string
  /** 文件地址 */
  fileUrl?: string
  /** 文件大小（字节） */
  fileSize?: number
  /** 状态：1 生成中 2 已完成 3 失败 */
  status: 1 | 2 | 3
}
