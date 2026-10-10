/**
 * 系统设置 API
 */

import { http } from '@/utils/request'
import type { PageQuery, PageResult } from '@/types'

const BASE = '/settings'

/** 系统配置项（前端用词） */
export interface SettingItem {
  /** 配置键 */
  configKey: string
  /** 配置值 */
  configValue: string
  /** 配置说明 */
  description?: string
}

/**
 * 后端 `SysSettingEntity` 的配置项字段口径。
 *
 * ⚠️ 前后端字段名不同名：后端是 `settingKey / settingValue / remark`，
 * 前端是 `configKey / configValue / description`。**不映射就写不进去**——
 * 实测按前端形状 `POST /settings` 会返回 200 + 新 settingId，落库的却是一行
 * `setting_key=null / setting_value=null` 的空配置（写成功但内容全丢）。
 */
interface SysSettingPayload {
  /** 配置键（对应前端 configKey） */
  settingKey: string
  /** 配置值（对应前端 configValue） */
  settingValue: string
  /** 备注（对应前端 description） */
  remark?: string
}

/** 后端返回的配置项（只取本文件用得到的字段） */
interface SysSettingSaved {
  /** 业务主键 */
  settingId: string
  /** 配置键 */
  settingKey: string
  /** 配置值 */
  settingValue: string
  /** 备注（对应前端 description） */
  remark?: string
}

/**
 * 前端配置项 → 后端入参的字段映射。
 *
 * @param item 前端配置项
 * @returns 后端入参
 */
function toSysSettingPayload(item: SettingItem): SysSettingPayload {
  return {
    settingKey: item.configKey,
    settingValue: item.configValue,
    remark: item.description,
  }
}

/** 查询系统配置列表 */
export function listSettings(): Promise<SettingItem[]> {
  return http.get<SettingItem[]>(BASE)
}

/**
 * 按配置键查询单个配置项。
 *
 * ⚠️ 历史实现打的是 `GET /settings/{id}`，而 `{id}` 要的是**业务主键 settingId**
 * （如 `DEMO-SET-001`），不是配置键——属于"端点在、但契约错"。
 * 成对实测（core-app :8098，**同一个 key** 对照，排除"key 本身无效"这个干扰项）：
 *   `GET /settings/DEMO.alert.notifyChannels`              → code=404 资源不存在
 *   `GET /settings/by-key?settingKey=DEMO.alert.notifyChannels`
 *                                          → code=0，返回 settingValue=["INBOX","SMS","WECHAT"]
 * 裁决：**改走 `by-key`，不删函数**。端点存在且有真数据就修契约；
 * 只有"端点不存在 + 零调用方"才删。留着错误写法会被下一个复制粘贴走。
 * 字段名也一并按后端口径映射回来（与 `deleteSetting` 同一套做法）。
 *
 * @param configKey 配置键
 * @returns 配置项；该键不存在时返回 null（后端此时返回 `data: null`，不是报错）
 */
export async function getSetting(configKey: string): Promise<SettingItem | null> {
  const saved = await http.get<SysSettingSaved | null>(
    `${BASE}/by-key`,
    { settingKey: configKey },
    { silent: true },
  )
  if (!saved?.settingKey) {
    return null
  }
  return {
    configKey: saved.settingKey,
    configValue: saved.settingValue,
    description: saved.remark,
  }
}

/**
 * 新增配置项。
 *
 * 走后端真实存在的 `POST /settings/save`（`SysSettingService#saveSetting`，
 * 按 `settingKey` 判重：有则更新 value/name，无则新增），并用后端真字段名入参。
 * 实测（core-app :8098）：写入后 `GET /settings` 回读 `settingValue` 非空，
 * 同 key 再写一次是更新而非新增（条数仍为 1）。
 *
 * 失败提示交由调用方统一处理（`silent`），避免拦截器与页面重复弹提示。
 *
 * @param payload 配置项
 * @returns 新配置项的 settingId
 */
export async function createSetting(payload: SettingItem): Promise<string> {
  const saved = await http.post<SysSettingSaved>(
    `${BASE}/save`,
    toSysSettingPayload(payload),
    { silent: true },
  )
  return saved?.settingId ?? ''
}

/**
 * 更新配置项。
 *
 * ⚠️ 后端**没有**"按配置键更新"的端点：`@PutMapping("/{id}")` 的 `{id}` 是业务主键
 * settingId，而且 `SysSettingService#update` 会先 `setSettingId(id)` 再 `updateById`，
 * 传 configKey 进去等于往一个叫这个名字的主键上写，脏数据。
 * 因此这里同样走 `POST /settings/save`——注意它是 **upsert**：key 不存在时会**新建**
 * 而不是报错。当前无调用方。
 *
 * @param configKey 配置键
 * @param payload 配置项
 * @returns 保存后的配置项（后端实体字段口径）
 */
export function updateSetting(configKey: string, payload: SettingItem): Promise<SysSettingSaved> {
  return http.post<SysSettingSaved>(
    `${BASE}/save`,
    toSysSettingPayload({ ...payload, configKey }),
    { silent: true },
  )
}

/**
 * 删除配置项。
 *
 * ⚠️ 后端 `@DeleteMapping("/{id}")` 的 `{id}` 同样是业务主键 settingId，不是配置键。
 * 更阴的是：`SysSettingService#delete` 直接 `deleteById`，**删不到任何行也不报错**——
 * 实测 `DELETE /settings/{任意不存在的 id}` 返回 `code=0 success`，但记录原封不动。
 * 所以这里先按 key 查出 settingId 再删，并且**删完回读复核**，删不掉就抛错，
 * 绝不让"返回成功但没删"这种事静默过去。当前无调用方。
 *
 * @param configKey 配置键
 * @returns Promise
 */
export async function deleteSetting(configKey: string): Promise<void> {
  const byKey = { settingKey: configKey }
  const existing = await http.get<SysSettingSaved | null>(`${BASE}/by-key`, byKey, {
    silent: true,
  })
  if (!existing?.settingId) {
    throw new Error(`配置项 ${configKey} 不存在，未执行删除`)
  }
  await http.delete<void>(`${BASE}/${existing.settingId}`, undefined, { silent: true })
  const after = await http.get<SysSettingSaved | null>(`${BASE}/by-key`, byKey, { silent: true })
  if (after?.settingId) {
    throw new Error(`配置项 ${configKey} 删除未生效：后端返回成功但记录仍在`)
  }
}

/**
 * 批量保存系统配置。
 *
 * 后端**没有** `PUT /settings/batch` 这个端点（实测 `code=400 请求体格式错误`，
 * 请求被 `@PutMapping("/{id}")` 兜住），也没有任何批量写入端点，
 * 因此这里逐条调用真实存在的 `POST /settings/save`（按 key 的 upsert）实现批量语义。
 *
 * 串行执行且**任何一条失败就整批失败并抛出**，由调用方如实报错——
 * 不允许"写了一半还提示已保存"。
 *
 * @param payload 配置项数组
 * @returns 全部写入成功时返回 true
 */
export async function saveSettings(payload: SettingItem[]): Promise<boolean> {
  for (const item of payload) {
    await http.post<SysSettingSaved>(`${BASE}/save`, toSysSettingPayload(item), { silent: true })
  }
  return true
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
