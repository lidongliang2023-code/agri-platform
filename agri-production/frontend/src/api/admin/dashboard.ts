/**
 * 运营端 - 运营管理大盘 API
 */
import { http } from '@/utils/request'
import type { BizId, PageQuery, PageResult } from '@/types'

const BASE = '/admin/dashboard'

/** 运营大盘核心指标 */
export interface OpsDashboardMetrics {
  /** 租户总数 */
  tenantCount: number
  /** 农场总数 */
  farmCount: number
  /** 地块总数 */
  plotCount: number
  /** 在线设备数 */
  onlineDeviceCount: number
  /** 本月任务完成数 */
  monthTaskCount: number
  /** 本月采收总量（kg） */
  monthHarvestQty: number
  /** 待审批数量 */
  pendingApprovalCount: number
  /** 未处理告警数 */
  unhandledAlertCount: number
}

/** 查询运营管理大盘指标 */
export function getOpsDashboard(): Promise<OpsDashboardMetrics> {
  return http.get<OpsDashboardMetrics>(BASE)
}

/** 查询生产总览（多租户聚合） */
export function getOpsProductionOverview(params?: {
  startDate?: string
  endDate?: string
}): Promise<Record<string, number>> {
  return http.get<Record<string, number>>(`${BASE}/overview`, params)
}

/** 查询大屏驾驶舱数据 */
export function getScreenData(): Promise<Record<string, unknown>> {
  return http.get<Record<string, unknown>>(`${BASE}/screen`)
}

/** 分页查询平台增长趋势 */
export function listGrowthTrend(params: PageQuery): Promise<PageResult<Record<string, unknown>>> {
  return http.get<PageResult<Record<string, unknown>>>(
    `${BASE}/growth-trend`,
    params,
  )
}

/* ==================== 运营端页面扩展查询（追加） ==================== */
/* 说明：以下查询统一使用 silent 选项，接口未就绪时不弹全局错误，
 * 由页面自行降级到原型示例数据，保证页面始终可用。 */

/** 区域分布统计条目 */
export interface OpsRegionStat {
  /** 区域名称 */
  region: string
  /** 农场数量 */
  farmCount: number
  /** 在田面积（亩） */
  fieldArea: number
  /** 活跃租户数 */
  tenantCount: number
  /** 活跃度分层：high 高活跃 / middle 中活跃 / low 低活跃 */
  activityLevel: 'high' | 'middle' | 'low'
}

/** 种植面积排行条目（对应 /admin/dashboard/rank） */
export interface OpsRankItem {
  /** 农场 ID */
  farmId: BizId
  /** 农场名称 */
  farmName: string
  /** 总面积（亩） */
  areaTotal: number
  /** 地块数量 */
  plotCount: number
}

/** 告警级别分布（对应 /admin/dashboard/alert-trend） */
export type OpsAlertLevelMap = Record<string, number>

/** 近 7 天趋势点 */
export interface OpsTrendPoint {
  /** X 轴标签（周一～周日） */
  label: string
  /** 任务完成率（%） */
  taskRate: number
  /** 活跃用户数 */
  activeUsers: number
  /** 告警数 */
  alertCount: number
}

/** 生产总览维度统计行（PRD 6.2 #2） */
export interface OpsOverviewRow {
  /** 维度名称（区域 / 作物 / 租户） */
  name: string
  /** 农场数量 */
  farmCount: number
  /** 在田面积（亩） */
  fieldArea: number
  /** 本期产量（吨） */
  outputTon: number
  /** 任务完成率（%） */
  taskRate: number
  /** 告警数量 */
  alertCount: number
}

/** 大屏实时滚动指标（PRD 6.2 #3） */
export interface OpsRealtimeMetric {
  /** 指标 ID */
  metricId: string
  /** 时间（HH:mm:ss） */
  time: string
  /** 租户 / 农场名称 */
  targetName: string
  /** 内容描述 */
  content: string
  /** 是否为告警类 */
  isAlert: boolean
}

/** 后端分页原始结构（兼容 records/page/size 与 list/pageNum/pageSize 两种约定） */
interface RawPageResult<T> {
  list?: T[]
  records?: T[]
  total?: number
  pageNum?: number
  page?: number
  pageSize?: number
  size?: number
  pages?: number
}

/**
 * 将后端分页结果归一化为前端 PageResult 结构。
 *
 * 后端 MyBatis-Plus 分页返回 records/total/page/size，
 * 前端约定为 list/total/pageNum/pageSize/pages，此处做兼容处理。
 *
 * @param raw 后端返回体
 * @param pageNum 当前页码（后端缺失时使用）
 * @param pageSize 每页条数（后端缺失时使用）
 * @returns 归一化后的分页结果
 */
function normalizePage<T>(
  raw: RawPageResult<T> | T[] | null | undefined,
  pageNum: number,
  pageSize: number,
): PageResult<T> {
  const list = Array.isArray(raw) ? raw : (raw?.records ?? raw?.list ?? [])
  const total = Array.isArray(raw) ? list.length : Number(raw?.total ?? list.length) || 0
  const size = Array.isArray(raw)
    ? pageSize
    : Number(raw?.size ?? raw?.pageSize ?? pageSize) || pageSize
  const current = Array.isArray(raw) ? pageNum : Number(raw?.pageNum ?? raw?.page ?? pageNum) || pageNum
  return {
    pageNum: current,
    pageSize: size,
    total,
    pages: Math.max(1, Math.ceil(total / (size || 1))),
    list,
  }
}

/** 查询种植面积排行（TOP N 农场） */
export function fetchRankItems(limit = 10): Promise<OpsRankItem[]> {
  return http.get<OpsRankItem[]>(`${BASE}/rank`, { limit }, { silent: true })
}

/** 查询告警级别分布 */
export function fetchAlertLevelMap(): Promise<OpsAlertLevelMap> {
  return http.get<OpsAlertLevelMap>(`${BASE}/alert-trend`, undefined, { silent: true })
}

/** 查询区域生产分布 */
export function fetchRegionStats(params?: { startDate?: string; endDate?: string }): Promise<
  OpsRegionStat[]
> {
  return http.get<OpsRegionStat[]>(`${BASE}/region-distribution`, params, { silent: true })
}

/** 查询近 7 天趋势 */
export function fetchTrendPoints(params?: { startDate?: string; endDate?: string }): Promise<
  OpsTrendPoint[]
> {
  return http.get<OpsTrendPoint[]>(`${BASE}/trend`, params, { silent: true })
}

/** 查询生产总览多维度统计（PRD 6.2 #2） */
export function fetchOverviewRows(params: {
  dimension: 'region' | 'crop' | 'tenant'
  startDate?: string
  endDate?: string
  region?: string
}): Promise<OpsOverviewRow[]> {
  return http.get<OpsOverviewRow[]>(`${BASE}/overview-rows`, params, { silent: true })
}

/** 查询大屏驾驶舱数据（PRD 6.2 #3） */
export function fetchScreenData(): Promise<Record<string, unknown>> {
  return http.get<Record<string, unknown>>(`${BASE}/screen`, undefined, { silent: true })
}

/** 查询大屏实时滚动指标 */
export function fetchRealtimeMetrics(limit = 20): Promise<OpsRealtimeMetric[]> {
  return http.get<OpsRealtimeMetric[]>(`${BASE}/realtime`, { limit }, { silent: true })
}

/** 分页查询平台增长趋势（兼容后端 records 结构） */
export function fetchGrowthTrendPage(params: PageQuery): Promise<PageResult<Record<string, unknown>>> {
  return http
    .get<RawPageResult<Record<string, unknown>>>(`${BASE}/growth-trend`, params, { silent: true })
    .then((raw) => normalizePage<Record<string, unknown>>(raw, params.pageNum, params.pageSize))
}
