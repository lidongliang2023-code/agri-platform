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

/**
 * 新增配置项。
 *
 * ⚠️ 实测（core-app :8098）：后端 `SettingController#create` 用 `SysSettingEntity` 接收入参，
 * 字段是 `settingKey / settingValue / settingName`，**不是**前端这里的 `configKey /
 * configValue / description`。因此按当前形状调用虽然会返回 200 + 新 settingId，
 * 落库的却是一行 `setting_key=null / setting_value=null` 的空配置——**写成功但没写入内容**。
 * 该字段口径不一致已列入后端补齐清单，此处保留现状但必须有提示，避免被当成"新增成功"。
 *
 * 失败提示交由调用方统一处理（`silent`），避免拦截器与页面重复弹提示。
 *
 * @param payload 配置项
 * @returns 新配置项的 settingId
 */
export function createSetting(payload: SettingItem): Promise<string> {
  return http.post<string>(BASE, payload, { silent: true })
}

/** 更新配置项 */
export function updateSetting(configKey: string, payload: SettingItem): Promise<SettingItem> {
  return http.put<SettingItem>(`${BASE}/${configKey}`, payload)
}

/** 删除配置项 */
export function deleteSetting(configKey: string): Promise<void> {
  return http.delete<void>(`${BASE}/${configKey}`)
}

/**
 * 批量保存系统配置。
 *
 * ⚠️ 实测（core-app :8098）：后端**没有** `PUT /settings/batch` 这个端点，该请求会被
 * `@PutMapping("/{id}")` 兜住并反序列化成单个 `SysSettingEntity`，返回
 * `code=400 请求体格式错误`。也就是说本调用当前**必然失败**——调用方必须如实报错，
 * 不能吞掉异常后提示"已保存"。
 *
 * 失败提示交由调用方统一处理（`silent`），避免拦截器与页面重复弹提示。
 *
 * @param payload 配置项数组
 * @returns 保存是否成功
 */
export function saveSettings(payload: SettingItem[]): Promise<boolean> {
  return http.put<boolean>(`${BASE}/batch`, payload, { silent: true })
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

/** 租户信息查询结果（附带「接口不可用」原因，供页面显式降级提示） */
export interface TenantProfileResult {
  /** 租户档案，后端没有时为 null */
  profile: TenantProfile | null
  /**
   * 接口不可用原因。
   *
   * 非空表示本次没有拿到任何真实租户档案，页面必须显式告知用户「未接入」，
   * **不得**用农场名、农场编码或硬编码档案冒充——那会让用户以为平台里已经存在
   * 一套真实的租户资料，进而拿它去做合同 / 发票 / 资质审核。
   */
  unavailableReason?: string
}

/**
 * 查询租户信息。
 *
 * ⚠️ 实测（core-app :8098）：后端**没有** `GET /settings/tenant` 这个端点，该路径会被
 * `SettingController#detail` 的 `@GetMapping("/{id}")` 吞掉，返回
 * `code=404 资源不存在`（与请求 `/settings/zzz-not-exist` 完全一致，可据此判定是
 * 端点缺失而非"该租户没档案"）。因此本函数**不再静默回落到 null**，而是把不可用原因
 * 一并返回，交由页面做醒目降级提示。
 *
 * @returns 查询结果，含可能的不可用原因
 */
export async function getTenantProfile(): Promise<TenantProfileResult> {
  try {
    const res = await http.get<TenantProfile>(`${BASE}/tenant`, undefined, { silent: true })
    if (res && typeof res === 'object' && res.tenantName) {
      return { profile: res }
    }
    return {
      profile: null,
      unavailableReason: '后端 /settings/tenant 已请求成功，但未返回任何租户档案',
    }
  } catch (error) {
    return {
      profile: null,
      unavailableReason: `租户档案接口不可用：${(error as Error)?.message ?? '请求失败'}`,
    }
  }
}

/**
 * 保存租户信息。
 *
 * ⚠️ 实测（core-app :8098）：后端**没有** `PUT /settings/tenant` 这个端点，该路径同样被
 * `@PutMapping("/{id}")` 吞掉，返回 `code=404 资源不存在`。也就是说本调用当前**必然失败**——
 * 调用方必须如实报错，不能吞掉异常后提示"已保存"。
 *
 * 失败提示交由调用方统一处理（`silent`），避免拦截器与页面重复弹提示。
 *
 * @param payload 租户信息
 * @returns 保存是否成功
 */
export function saveTenantProfile(payload: TenantProfile): Promise<boolean> {
  return http.put<boolean>(`${BASE}/tenant`, payload, { silent: true })
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

/** 操作日志分页结果（附带「接口未接入」原因，供页面显式降级提示） */
export interface OperationLogPage extends PageResult<OperationLogItem> {
  /**
   * 接口不可用原因。
   *
   * 非空表示本次没有拿到任何真实日志，页面必须显式告知用户「未接入」，
   * **不得**用示例 / 编造日志顶上——那会让审计页面看起来有数据而实际没有。
   */
  unavailableReason?: string
}

/**
 * 分页查询操作日志。
 *
 * 后端当前未提供 `/settings/logs`（实为 404），这里**不再静默回落示例数据**，
 * 而是把不可用原因一并返回，交由页面做醒目降级提示。
 *
 * @param params 查询参数
 * @returns 分页结果，含可能的不可用原因
 */
export async function listOperationLogs(
  params: OperationLogParams,
): Promise<OperationLogPage> {
  const empty: OperationLogPage = {
    pageNum: params.pageNum,
    pageSize: params.pageSize,
    total: 0,
    pages: 0,
    list: [],
  }
  try {
    const res = await http.get<PageResult<OperationLogItem>>(`${BASE}/logs`, params, {
      silent: true,
    })
    if (res && Array.isArray(res.list)) {
      return res.list.length > 0
        ? { ...res }
        : { ...res, unavailableReason: '后端 /settings/logs 已请求成功，但未返回任何日志记录' }
    }
    return {
      ...empty,
      unavailableReason: '后端 /settings/logs 返回结构不是分页数据（缺少 list 数组）',
    }
  } catch (error) {
    return {
      ...empty,
      unavailableReason: `操作日志接口不可用：${(error as Error)?.message ?? '请求失败'}`,
    }
  }
}
