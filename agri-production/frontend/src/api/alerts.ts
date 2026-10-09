/**
 * 告警管理 API（告警中心 / 告警规则）
 */
import { http } from '@/utils/request'
import type { PageQuery, PageResult } from '@/types'
import type { Alert, AlertRule } from '@/types'

const BASE = '/alerts'

/** 告警列表查询参数 */
export interface AlertListParams extends PageQuery {
  farmId?: string
  alertLevel?: number
  alertSource?: number
  status?: number
  startDate?: string
  endDate?: string
}

/** 分页查询告警列表 */
export function listAlerts(params: AlertListParams): Promise<PageResult<Alert>> {
  return http.get<PageResult<Alert>>(BASE, params)
}

/** 查询告警详情 */
export function getAlert(alertId: string): Promise<Alert> {
  return http.get<Alert>(`${BASE}/${alertId}`)
}

/** 处理告警 */
export function handleAlert(
  alertId: string,
  payload: { status: number; handleRemark?: string },
): Promise<boolean> {
  return http.patch<boolean>(`${BASE}/${alertId}/handle`, payload)
}

/** 批量忽略告警 */
export function ignoreAlerts(alertIds: string[]): Promise<boolean> {
  return http.patch<boolean>(`${BASE}/ignore`, { alertIds })
}

/** 分页查询告警规则 */
export function listAlertRules(
  params: PageQuery & { scope?: string; status?: number },
): Promise<PageResult<AlertRule>> {
  return http.get<PageResult<AlertRule>>(`${BASE}/rules`, params)
}

/** 查询告警规则详情 */
export function getAlertRule(ruleId: string): Promise<AlertRule> {
  return http.get<AlertRule>(`${BASE}/rules/${ruleId}`)
}

/** 新增告警规则 */
export function createAlertRule(payload: Partial<AlertRule>): Promise<string> {
  return http.post<string>(`${BASE}/rules`, payload)
}

/** 更新告警规则 */
export function updateAlertRule(
  ruleId: string,
  payload: Partial<AlertRule>,
): Promise<AlertRule> {
  return http.put<AlertRule>(`${BASE}/rules/${ruleId}`, payload)
}

/** 删除告警规则 */
export function deleteAlertRule(ruleId: string): Promise<void> {
  return http.delete<void>(`${BASE}/rules/${ruleId}`)
}

/** 启停告警规则 */
export function updateAlertRuleStatus(ruleId: string, status: number): Promise<boolean> {
  return http.patch<boolean>(`${BASE}/rules/${ruleId}/status`, { status })
}

/** 告警级别分布 */
export interface AlertLevelCount {
  /** 告警级别：1 提示 2 一般 3 严重 4 紧急 */
  level: number
  /** 数量 */
  count: number
}

/** 告警统计（顶部指标卡） */
export interface AlertStats {
  /** 告警总数 */
  total: number
  /** 未处理数 */
  unhandled: number
  /** 处理中数 */
  handling: number
  /** 已处理数 */
  resolved: number
  /** 已忽略数 */
  ignored: number
  /** 各级别数量 */
  levelCounts: AlertLevelCount[]
}

/** 空统计（后端骨架未返回时的兜底） */
const EMPTY_ALERT_STATS: AlertStats = {
  total: 0,
  unhandled: 0,
  handling: 0,
  resolved: 0,
  ignored: 0,
  levelCounts: [],
}

/**
 * 查询告警统计
 *
 * 后端骨架阶段允许无数据，采用静默请求并回落到零值，避免刷屏报错。
 *
 * @param farmId 农场 ID
 * @returns 告警统计
 */
export async function getAlertStats(farmId?: string): Promise<AlertStats> {
  try {
    const raw = await http.get<Partial<AlertStats>>(
      `${BASE}/stats`,
      { farmId },
      { silent: true },
    )
    if (!raw || typeof raw !== 'object') return EMPTY_ALERT_STATS
    return {
      total: raw.total ?? 0,
      unhandled: raw.unhandled ?? 0,
      handling: raw.handling ?? 0,
      resolved: raw.resolved ?? 0,
      ignored: raw.ignored ?? 0,
      levelCounts: Array.isArray(raw.levelCounts) ? raw.levelCounts : [],
    }
  } catch {
    return EMPTY_ALERT_STATS
  }
}
