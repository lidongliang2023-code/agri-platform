/**
 * 数据分析与报表 API
 */
import { http, toPageResult } from '@/utils/request'
import type { PageQuery, PageResult } from '@/types'
import type { AnalyticsOverview, ProductionOverview, ReportItem, TrendPoint } from '@/types'

const BASE = '/analytics'

/** 查询生产总览指标 */
export function getProductionOverview(farmId?: string): Promise<ProductionOverview> {
  return http.get<ProductionOverview>(`${BASE}/overview`, { farmId })
}

/** 查询数据分析总览 */
export function getAnalyticsOverview(params?: {
  farmId?: string
  startDate?: string
  endDate?: string
}): Promise<AnalyticsOverview> {
  return http.get<AnalyticsOverview>(`${BASE}/dashboard`, params)
}

/** 查询产量趋势 */
export function getYieldTrend(params: {
  farmId?: string
  startDate: string
  endDate: string
}): Promise<TrendPoint[]> {
  return http.get<TrendPoint[]>(`${BASE}/yield-trend`, params)
}

/** 查询任务完成趋势 */
export function getTaskTrend(params: {
  farmId?: string
  startDate: string
  endDate: string
}): Promise<TrendPoint[]> {
  return http.get<TrendPoint[]>(`${BASE}/task-trend`, params)
}

/**
 * 分页查询生产报表
 *
 * ⚠️ 实测（core-app 直连）：`GET /api/v1/production/analytics/reports`
 * 返回 `{ code: 0, data: [...] }`——`data` 是**裸数组**而非 PageResult
 * （后端 AnalyticsController#reports 直接返回 List<Map>，且不接受 page/size）。
 * 裸数组不会被响应拦截器归一化，页面（ProductionReports.tsx）拿到的
 * `list` 恒为 undefined 而误判成「接口失败」并回落示例数据。
 * 用 `toPageResult` 补成分页结构，函数签名保持不变，页面无需改动。
 */
export async function listReports(
  params: PageQuery & { reportType?: number; period?: string },
): Promise<PageResult<ReportItem>> {
  const raw = await http.get<unknown>(`${BASE}/reports`, params)
  return toPageResult<ReportItem>(raw, params)
}

/** 生成生产报表 */
export function generateReport(payload: {
  reportType: number
  period: string
  farmId?: string
}): Promise<ReportItem> {
  return http.post<ReportItem>(`${BASE}/reports`, payload)
}

/** 删除生产报表 */
export function deleteReport(reportId: string): Promise<boolean> {
  return http.delete<boolean>(`${BASE}/reports/${reportId}`)
}

/** 导出报表文件 */
export function exportReport(reportId: string): Promise<{ fileUrl: string }> {
  return http.get<{ fileUrl: string }>(`${BASE}/reports/${reportId}/export`)
}

/** 多维度分析维度取值 */
export type AnalyticsDimension = 'crop' | 'plot' | 'month'

/** 多维度分析数据点 */
export interface DimensionPoint {
  /** 维度名称（作物名 / 地块名 / 月份） */
  name: string
  /** 产量（kg） */
  yieldQty: number
  /** 面积（亩） */
  areaMu: number
  /** 投入成本（元） */
  inputCost: number
  /** 产值（元） */
  outputValue: number
  /** 任务总数 */
  taskCount: number
  /** 已完成任务数 */
  doneCount: number
}

/**
 * 查询多维度分析数据
 *
 * 后端骨架暂未实现 `/analytics/dimension`，静默回落到空数组，由页面按示例口径本地推导。
 *
 * @param params 查询参数
 * @returns 维度数据点列表
 */
export async function getAnalyticsDimension(params: {
  dimension: AnalyticsDimension
  farmId?: string
  startDate?: string
  endDate?: string
}): Promise<DimensionPoint[]> {
  try {
    const res = await http.get<DimensionPoint[]>(`${BASE}/dimension`, params, { silent: true })
    return Array.isArray(res) ? res : []
  } catch {
    return []
  }
}

/** 报表订阅周期：daily 每日 / weekly 每周 / monthly 每月 / quarterly 每季 */
export type SubscribePeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly'

/** 报表订阅项 */
export interface ReportSubscription {
  /** 订阅 ID */
  subscribeId: string
  /** 报表模板：1 日报 2 周报 3 月报 4 季报 5 年报 */
  reportType: number
  /** 订阅周期 */
  period: SubscribePeriod
  /** 接收渠道：1 站内 2 邮件 3 微信 */
  channels: number[]
  /** 接收人 */
  receivers: string[]
  /** 启用状态：1 启用 0 停用 */
  status: 0 | 1
  /** 最近推送时间 */
  lastPushedAt?: string
  /** 更新时间 */
  updatedAt: string
}

/** 报表订阅入参 */
export type ReportSubscriptionPayload = Omit<
  ReportSubscription,
  'subscribeId' | 'lastPushedAt' | 'updatedAt'
>

/**
 * 查询报表订阅列表
 * @returns 订阅列表
 */
export async function listReportSubscriptions(): Promise<ReportSubscription[]> {
  try {
    const res = await http.get<ReportSubscription[]>(`${BASE}/reports/subscriptions`, undefined, {
      silent: true,
    })
    return Array.isArray(res) ? res : []
  } catch {
    return []
  }
}

/** 新增 / 更新报表订阅 */
export function subscribeReport(payload: ReportSubscriptionPayload): Promise<boolean> {
  return http.post<boolean>(`${BASE}/reports/subscribe`, payload)
}

/** 取消报表订阅 */
export function unsubscribeReport(subscribeId: string): Promise<boolean> {
  return http.delete<boolean>(`${BASE}/reports/subscriptions/${subscribeId}`)
}
