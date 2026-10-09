/**
 * 运营端 - 生产监控 API（任务 / IoT / 投入品）
 */
import { http } from '@/utils/request'
import type { PageQuery, PageResult } from '@/types'
import type { Alert, InputUsage, IotDevice, Task } from '@/types'

const BASE = '/admin/monitor'

/** 生产监控中心实时指标 */
export interface MonitorMetrics {
  /** 今日派发任务数 */
  todayTaskCount: number
  /** 执行中任务数 */
  executingTaskCount: number
  /** 超时未完成任务数 */
  overdueTaskCount: number
  /** 在线设备数 */
  onlineDeviceCount: number
  /** 离线设备数 */
  offlineDeviceCount: number
  /** 今日投入品使用次数 */
  todayInputUsageCount: number
}

/** 查询生产监控中心指标 */
export function getMonitorMetrics(): Promise<MonitorMetrics> {
  return http.get<MonitorMetrics>(`${BASE}/metrics`)
}

/** 分页查询任务执行监控列表 */
export function listMonitorTasks(
  params: PageQuery & { tenantId?: string; status?: string; overdue?: boolean },
): Promise<PageResult<Task>> {
  return http.get<PageResult<Task>>(`${BASE}/tasks`, params)
}

/** 查询任务执行详情 */
export function getMonitorTask(taskId: string): Promise<Task> {
  return http.get<Task>(`${BASE}/tasks/${taskId}`)
}

/** 催办任务 */
export function urgeTask(taskId: string): Promise<boolean> {
  return http.patch<boolean>(`${BASE}/tasks/${taskId}/urge`)
}

/** 分页查询 IoT 设备监控列表 */
export function listMonitorDevices(
  params: PageQuery & { tenantId?: string; onlineStatus?: number },
): Promise<PageResult<IotDevice>> {
  return http.get<PageResult<IotDevice>>(`${BASE}/iot`, params)
}

/** 远程重启设备 */
export function rebootDevice(deviceId: string): Promise<boolean> {
  return http.patch<boolean>(`${BASE}/iot/${deviceId}/reboot`)
}

/** 分页查询投入品使用监管列表 */
export function listMonitorInputUsages(
  params: PageQuery & { tenantId?: string; inputId?: string; overLimit?: boolean },
): Promise<PageResult<InputUsage>> {
  return http.get<PageResult<InputUsage>>(`${BASE}/inputs`, params)
}

/* ==================== 生产监控页面扩展查询（追加） ====================
 * 说明：以下接口统一携带 silent 选项——后端聚合接口暂未返回数据时不弹全局错误，
 * 由页面降级到原型示例口径展示，保证生产监控五个页面始终可用、可交互。
 */

/** 监测总览指标（GET /admin/monitor/overview） */
export interface MonitorOverview {
  /** 设备总数 */
  deviceTotal: number
  /** 在线设备数 */
  deviceOnline: number
  /** 设备在线率（%） */
  onlineRate: number
  /** 待处理告警数 */
  alertPending: number
  /** 启用中的告警规则数 */
  ruleEnabled: number
}

/** 查询监测总览指标 */
export function getMonitorOverview(): Promise<MonitorOverview> {
  return http.get<MonitorOverview>(`${BASE}/overview`, undefined, { silent: true })
}

/** 查询实时告警流（近 minutes 分钟） */
export function listMonitorRealtimeAlerts(minutes = 60): Promise<Alert[]> {
  return http.get<Alert[]>(`${BASE}/alerts`, { minutes }, { silent: true })
}

/** 查询设备运行状态清单 */
export function listMonitorDeviceStates(onlineOnly = false): Promise<IotDevice[]> {
  return http.get<IotDevice[]>(`${BASE}/devices`, { onlineOnly }, { silent: true })
}

/** 任务状态聚合项（GET /admin/monitor/tasks） */
export interface MonitorTaskStatusStat {
  /** 任务状态编码 */
  status: string
  /** 任务数量 */
  count: number
}

/** 查询任务状态聚合 */
export function listMonitorTaskStatusStats(): Promise<MonitorTaskStatusStat[]> {
  return http.get<MonitorTaskStatusStat[]>(`${BASE}/tasks`, undefined, { silent: true })
}

/** 投入品库存预警项（GET /admin/monitor/inputs） */
export interface MonitorInputWarning {
  /** 投入品 ID */
  inputId: string
  /** 投入品名称 */
  inputName: string
  /** 当前库存 */
  stockQty: number
  /** 预警阈值 */
  warnQty: number
  /** 是否触发预警 */
  warning: boolean
}

/** 查询投入品库存预警清单 */
export function listMonitorInputWarnings(): Promise<MonitorInputWarning[]> {
  return http.get<MonitorInputWarning[]>(`${BASE}/inputs`, undefined, { silent: true })
}

/* 说明：IoT 读数相关查询（IotReading / listReadingSeries / getLatestReading）
 * 已在 '@/api/iot' 中定义，此处不再重复导出，避免 '@/api' 桶文件重名冲突。 */
