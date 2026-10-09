/**
 * 系统设置 API
 */

import { http } from '@/utils/request'
import type { PageQuery, PageResult } from '@/types'

const BASE = '/settings'

/** 系统配置项 */
export interface SettingItem {
  /** 配置键 */
  configKey: string
  /** 配置值 */
  configValue: string
  /** 配置说明 */
  description?: string
}

/** 查询系统配置列表 */
export function listSettings(): Promise<SettingItem[]> {
  return http.get<SettingItem[]>(BASE)
}

/** 查询单个配置项 */
export function getSetting(configKey: string): Promise<SettingItem> {
  return http.get<SettingItem>(`${BASE}/${configKey}`)
}

/** 新增配置项 */
export function createSetting(payload: SettingItem): Promise<string> {
  return http.post<string>(BASE, payload)
}

/** 更新配置项 */
export function updateSetting(configKey: string, payload: SettingItem): Promise<SettingItem> {
  return http.put<SettingItem>(`${BASE}/${configKey}`, payload)
}

/** 删除配置项 */
export function deleteSetting(configKey: string): Promise<void> {
  return http.delete<void>(`${BASE}/${configKey}`)
}

/** 批量保存系统配置 */
export function saveSettings(payload: SettingItem[]): Promise<boolean> {
  return http.put<boolean>(`${BASE}/batch`, payload)
}

/** 租户信息（系统设置 · 租户信息 Tab） */
export interface TenantProfile {
  /** 租户名称 */
  tenantName: string
  /** 租户编码 */
  tenantCode: string
  /** 统一社会信用代码 */
  creditCode?: string
  /** 法定代表人 */
  legalPerson?: string
  /** 联系人 */
  contactName?: string
  /** 联系电话 */
  contactPhone?: string
  /** 所在地区 */
  region?: string
  /** 详细地址 */
  address?: string
  /** 经营范围 */
  businessScope?: string
  /** 租户等级：1 免费版 2 基础版 3 专业版 4 旗舰版 */
  tenantLevel?: number
  /** 到期时间 */
  expireAt?: string
}

/**
 * 查询租户信息
 *
 * 后端骨架暂未提供 `/settings/tenant`，静默回落到 null，由页面使用当前农场上下文兜底。
 *
 * @returns 租户信息，不存在时为 null
 */
export async function getTenantProfile(): Promise<TenantProfile | null> {
  try {
    const res = await http.get<TenantProfile>(`${BASE}/tenant`, undefined, { silent: true })
    if (res && typeof res === 'object' && res.tenantName) return res
    return null
  } catch {
    return null
  }
}

/** 保存租户信息 */
export function saveTenantProfile(payload: TenantProfile): Promise<boolean> {
  return http.put<boolean>(`${BASE}/tenant`, payload)
}

/** 操作日志（系统设置 · 操作日志 Tab） */
export interface OperationLogItem {
  /** 日志 ID */
  logId: string
  /** 操作时间 */
  operateTime: string
  /** 操作人 */
  operator: string
  /** 操作类型 */
  operateType: string
  /** 操作对象 */
  target: string
  /** 操作结果：1 成功 0 失败 */
  result: 0 | 1
  /** IP 地址 */
  ipAddress: string
}

/** 操作日志查询参数 */
export interface OperationLogParams extends PageQuery {
  /** 操作类型 */
  operateType?: string
  /** 操作人 */
  operator?: string
}

/**
 * 分页查询操作日志
 *
 * 后端骨架暂未提供 `/settings/logs`，静默回落到空分页，由页面使用示例数据。
 *
 * @param params 查询参数
 * @returns 分页结果
 */
export async function listOperationLogs(
  params: OperationLogParams,
): Promise<PageResult<OperationLogItem>> {
  try {
    const res = await http.get<PageResult<OperationLogItem>>(`${BASE}/logs`, params, {
      silent: true,
    })
    if (res && Array.isArray(res.list)) return res
    return { pageNum: params.pageNum, pageSize: params.pageSize, total: 0, pages: 0, list: [] }
  } catch {
    return { pageNum: params.pageNum, pageSize: params.pageSize, total: 0, pages: 0, list: [] }
  }
}
