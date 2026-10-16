/**
 * 用户端「首页看板 / 消息中心 / 团队管理 / 种养计划」取数层
 *
 * 之所以独立一层，而不是直接复用 `src/api/*` 中已有的类型化函数：
 * 1. core-platform 分页入参为 `page/size`，而既有 API 传的是 `pageNum/pageSize`，
 *    这里同时下发两套参数，保证真实分页生效；
 * 2. 后端实体字段命名与 `src/types` 契约不一致，需要经
 *    `src/utils/production-adapter` 归一化后再交给页面；
 * 3. 看板类接口允许「无数据回落」，需要 `silent` 静默请求，避免后端未启动时刷屏报错。
 *
 * 所有导出函数均返回 Promise，供 `@tanstack/react-query` 的 useQuery 使用。
 */
import dayjs from 'dayjs'
import { http, httpPlatform, httpStatusOf } from '@/utils/request'
import {
  asRecord,
  buildOverview,
  expandDateRange,
  normalizeAlert,
  normalizeMember,
  normalizeMessage,
  normalizePageResult,
  normalizePlan,
  normalizePlanStage,
  normalizePlot,
  normalizeTask,
  readNumber,
  readNumberOrNull,
  readString,
  readValue,
} from '@/utils/production-adapter'
import type { DashboardOverview } from '@/utils/production-adapter'
import { isTaskDone } from '@/types/task'
import type {
  Alert,
  Member,
  MessageItem,
  PageResult,
  Permission,
  Plan,
  Plot,
  Role,
  Task,
  TrendPoint,
} from '@/types'

/** 后端分页参数候选名（同时下发以兼容两种实现） */
interface BackendPageParams {
  /** 页码 */
  page: number
  /** 每页条数 */
  size: number
  /** 页码（契约名） */
  pageNum?: number
  /** 每页条数（契约名） */
  pageSize?: number
  /** 关键字 */
  keyword?: string
  /** 状态过滤 */
  status?: number | string
}

/**
 * 构造后端分页查询参数
 * @param pageNum 页码
 * @param pageSize 每页条数
 * @param extra 额外参数
 * @returns 合并后的查询参数
 */
function buildPageParams(
  pageNum: number,
  pageSize: number,
  extra: Record<string, unknown> = {},
): BackendPageParams {
  return {
    page: pageNum,
    size: pageSize,
    pageNum,
    pageSize,
    ...extra,
  }
}

/* ==================== 首页看板 ==================== */

/**
 * 查询生产总览指标。
 *
 * 纪律：**不做字段级回落**。后端 `GET /analytics/overview` 返回
 * `prod_analytics_snapshot` 的 `metricCode → metricValue` 映射，
 * 没有的指标一律为 null，页面渲染成「—」并给出可见提示，
 * 绝不用本地示例值 / 0 / 随机数顶替（否则同一张卡片上真数假数混排）。
 *
 * 请求失败时不抛错，而是返回 `available: false` 的全 null 视图，
 * 由页面顶部 Alert 显式告知「接口不可用」。
 *
 * @param farmId 当前农场 ID
 * @returns 看板总览视图模型（字段可能为 null）
 */
export async function fetchDashboardOverview(farmId?: string): Promise<DashboardOverview> {
  try {
    const raw = await http.get<unknown>('/analytics/overview', { farmId }, { silent: true })
    return buildOverview(raw, true)
  } catch {
    return buildOverview(null, false)
  }
}

/**
 * 查询指定指标的真实趋势序列（后端 GET /analytics/trend?metricCode=）
 *
 * 后端 `AnalyticsSnapshotEntity` 字段为 bizDate / metricValue，这里归一为前端 TrendPoint。
 * 接口不可用时返回空数组，由图表展示「暂无数据」，不生成任何本地序列。
 *
 * @param metricCode 指标编码，如 YIELD / PASS_RATE / COST
 * @returns 趋势点数组（按日期升序）
 */
export async function fetchMetricTrend(metricCode: string): Promise<TrendPoint[]> {
  try {
    const raw = await http.get<unknown[]>('/analytics/trend', { metricCode }, { silent: true })
    const list = Array.isArray(raw) ? raw : []
    const points: TrendPoint[] = []
    for (const item of list) {
      const record = asRecord(item)
      const date = readString(record, ['bizDate', 'biz_date', 'date']).slice(0, 10)
      const value = readNumberOrNull(record, ['metricValue', 'metric_value', 'value'])
      if (!date || value === null) continue
      points.push({ date, value })
    }
    return points.sort((a, b) => a.date.localeCompare(b.date))
  } catch {
    return []
  }
}

/**
 * 查询待办任务（pending / assigned / executing / doing）
 * @param farmId 当前农场 ID
 * @param limit 返回条数
 * @returns 任务列表
 */
export async function fetchTodoTasks(farmId: string | undefined, limit = 6): Promise<Task[]> {
  try {
    const raw = await http.get<unknown>(
      '/tasks',
      buildPageParams(1, Math.max(limit * 4, 40), { status: 'pending', farmId }),
      { silent: true },
    )
    const page = normalizePageResult<unknown>(raw, 1, Math.max(limit * 4, 40))
    const todos = page.list
      .map(normalizeTask)
      .filter((task) => ['pending', 'assigned', 'executing', 'doing'].includes(task.status))
    return todos.slice(0, limit)
  } catch {
    return []
  }
}

/**
 * 查询未处置告警
 * @param limit 返回条数
 * @returns 告警列表
 */
export async function fetchActiveAlerts(limit = 6): Promise<Alert[]> {
  try {
    const raw = await http.get<unknown>('/alerts/unhandled', undefined, { silent: true })
    const list = Array.isArray(raw) ? raw : normalizePageResult<unknown>(raw).list
    return list.map(normalizeAlert).slice(0, limit)
  } catch {
    return []
  }
}

/**
 * 查询地块状态统计（用于驾驶舱地块分布图）
 * @param farmId 当前农场 ID
 * @returns 状态 → 数量的键值对
 */
export async function fetchPlotStats(farmId?: string): Promise<Record<string, number>> {
  try {
    const raw = await http.get<unknown>('/plots/stats', { farmId }, { silent: true })
    const record = asRecord(raw)
    const result: Record<string, number> = {}
    for (const key of Object.keys(record)) {
      result[key] = readNumber({ value: record[key] }, ['value'], 0)
    }
    return result
  } catch {
    return {}
  }
}

/**
 * 分页查询地块列表
 * @param params 查询参数
 * @returns 分页地块列表
 */
export async function fetchPlots(params: {
  pageNum: number
  pageSize: number
  farmId?: string
  keyword?: string
  status?: number
}): Promise<PageResult<Plot>> {
  const raw = await http.get<unknown>(
    '/plots',
    buildPageParams(params.pageNum, params.pageSize, {
      keyword: params.keyword,
      status: params.status,
    }),
  )
  const page = normalizePageResult<unknown>(raw, params.pageNum, params.pageSize)
  return { ...page, list: page.list.map(normalizePlot) }
}

/**
 * 批量查询地块（驾驶舱统计用，最多 200 条）
 * @param farmId 当前农场 ID
 * @returns 地块列表
 */
export async function fetchAllPlots(farmId?: string): Promise<Plot[]> {
  const page = await fetchPlots({ pageNum: 1, pageSize: 200, farmId })
  return farmId ? page.list.filter((plot) => !plot.farmId || plot.farmId === farmId) : page.list
}

/**
 * 分页查询农场列表
 * @param params 查询参数
 * @returns 分页农场列表
 */
export async function fetchFarms(params: {
  pageNum: number
  pageSize: number
  keyword?: string
}): Promise<
  PageResult<{
    farmId: string
    farmCode: string
    farmName: string
    areaTotal: number
    managerName: string
    province: string
    city: string
    district: string
    status: number
  }>
> {
  const raw = await http.get<unknown>(
    '/farms',
    buildPageParams(params.pageNum, params.pageSize, { keyword: params.keyword }),
  )
  const page = normalizePageResult<unknown>(raw, params.pageNum, params.pageSize)
  return {
    ...page,
    list: page.list.map((item) => {
      const record = asRecord(item)
      return {
        farmId: readString(record, ['farmId', 'id'], ''),
        farmCode: readString(record, ['farmCode'], '-'),
        farmName: readString(record, ['farmName'], '未命名农场'),
        areaTotal: readNumber(record, ['areaTotal', 'area'], 0),
        managerName: readString(record, ['managerName'], '-'),
        province: readString(record, ['province'], ''),
        city: readString(record, ['city'], ''),
        district: readString(record, ['district'], ''),
        status: readNumber(record, ['status'], 1),
      }
    }),
  }
}

/* ==================== 消息中心 ==================== */

/**
 * 分页查询站内消息
 * @param params 查询参数
 * @returns 分页消息列表
 */
export async function fetchMessages(params: {
  pageNum: number
  pageSize: number
  keyword?: string
}): Promise<PageResult<MessageItem>> {
  const raw = await http.get<unknown>(
    '/messages',
    buildPageParams(params.pageNum, params.pageSize, { keyword: params.keyword }),
    { silent: true },
  )
  const page = normalizePageResult<unknown>(raw, params.pageNum, params.pageSize)
  return { ...page, list: page.list.map(normalizeMessage) }
}

/**
 * 标记单条消息已读
 *
 * 后端实际暴露的是 `POST /messages/{messageId}/read`，
 * 而 `@/api/messages` 中的 readMessage 使用 PATCH，这里按后端契约直接调用。
 *
 * @param messageId 消息 ID
 * @returns 是否成功
 */
export async function markMessageRead(messageId: string): Promise<boolean> {
  await http.post<unknown>(`/messages/${messageId}/read`)
  return true
}

/**
 * 一键标记全部消息已读
 *
 * 后端暂无 `/messages/read-all` 批量接口，这里退化为「逐条标记已读」。
 *
 * @param messageIds 消息 ID 列表
 * @returns 成功标记的数量
 */
export async function markAllMessagesRead(messageIds: string[]): Promise<number> {
  let success = 0
  for (const messageId of messageIds) {
    try {
      await markMessageRead(messageId)
      success += 1
    } catch {
      // 单条失败不影响其余消息的处理结果
    }
  }
  return success
}


/* ==================== 团队与人员 / 角色权限 ==================== */

/**
 * 分页查询团队成员
 * @param params 查询参数
 * @returns 分页成员列表
 */
export async function fetchMembers(params: {
  pageNum: number
  pageSize: number
  keyword?: string
  status?: number
  farmId?: string
}): Promise<PageResult<Member>> {
  const raw = await http.get<unknown>(
    '/members',
    buildPageParams(params.pageNum, params.pageSize, {
      keyword: params.keyword,
      status: params.status,
      farmId: params.farmId,
    }),
    { silent: true },
  )
  const page = normalizePageResult<unknown>(raw, params.pageNum, params.pageSize)
  return { ...page, list: page.list.map(normalizeMember) }
}

/**
 * 邀请 / 新增成员
 *
 * 后端实体字段为 memberName / memberType / postName / roleCode / joinDate，
 * 与前端 Member 契约字段名不同，这里按后端契约发送，避免 Jackson 反序列化失败。
 *
 * @param payload 成员入参
 * @returns 新建成员 ID
 */
export async function inviteMember(payload: {
  memberName: string
  phone: string
  memberType?: string
  postName?: string
  roleCode?: string
  farmId?: string
  userId?: string
  joinDate?: string
  status?: number
}): Promise<string> {
  const raw = await http.post<unknown>('/members', payload)
  if (typeof raw === 'string') return raw
  return readString(asRecord(raw), ['memberId', 'id'], '')
}

/**
 * 更新成员信息（岗位 / 角色 / 状态）
 * @param memberId 成员 ID
 * @param payload 更新内容（后端字段命名）
 * @returns void
 */
export async function updateMemberInfo(
  memberId: string,
  payload: Partial<{
    memberName: string
    phone: string
    memberType: string
    postName: string
    roleCode: string
    status: number
  }>,
): Promise<void> {
  await http.put<unknown>(`/members/${memberId}`, payload)
}

/**
 * 停用 / 启用成员
 * @param memberId 成员 ID
 * @param status 目标状态：1 在职 0 已停用
 * @returns void
 */
export async function updateMemberStatus(memberId: string, status: number): Promise<void> {
  await updateMemberInfo(memberId, { status })
}

/**
 * 移除成员
 * @param memberId 成员 ID
 * @returns void
 */
export async function removeMember(memberId: string): Promise<void> {
  await http.delete<unknown>(`/members/${memberId}`)
}

/**
 * 查询全部成员（执行人下拉等场景）
 * @param farmId 当前农场 ID
 * @returns 成员列表
 */
export async function fetchMembersByFarm(farmId: string): Promise<Member[]> {
  try {
    const raw = await http.get<unknown>('/members/by-farm', { farmId }, { silent: true })
    const list = Array.isArray(raw) ? raw : []
    return list.map(normalizeMember)
  } catch {
    return []
  }
}

/**
 * 查询角色在职人数（后端 `GET /members/roles` 按 role_code 聚合在职人数）
 *
 * 注意：这个端点**只提供人数**，不提供角色本身；角色的权威列表走
 * `fetchPlatformRoles()`（平台域 `GET /api/v1/admin/roles`）。
 *
 * @returns 角色 → 在职人数映射（key 为 role_code）
 */
export async function fetchRoles(): Promise<Role[]> {
  try {
    const raw = await http.get<unknown>('/members/roles', undefined, { silent: true })
    const list = Array.isArray(raw) ? raw : []
    return list.map((item) => {
      const record = asRecord(item)
      const roleCode = readString(record, ['roleCode', 'role_code'], '')
      return {
        roleId: roleCode,
        roleCode,
        // 后端该端点不返回角色名，名称一律由平台域角色列表提供；此处不编造
        roleName: readString(record, ['roleName'], '') || '',
        description: readString(record, ['description'], ''),
        isSystem: true,
        memberCount: readNumber(record, ['memberCount', 'count'], 0),
        status: 1,
        createdAt: readString(record, ['createdAt'], ''),
      }
    })
  } catch {
    return []
  }
}

/* ==================== 角色与权限 ==================== */

/** 平台域角色行（GET /api/v1/admin/roles 返回的 platform_role 记录） */
export interface PlatformRole {
  /** 主键 ID */
  id: number | null
  /** 角色编码 */
  code: string
  /** 角色名称 */
  name: string
  /** 权限码 JSON 数组（后端原始字符串，可能为空） */
  permissions: string[]
}

/**
 * 查询平台域真实角色列表（GET /api/v1/admin/roles）。
 *
 * 这是角色的**唯一权威数据源**（platform_role 全表）。
 * 生产域的 `/members/roles` 只提供按 role_code 聚合的在职人数，不提供角色本身。
 *
 * 接口不可用 / 返回空时返回空数组，页面显示空态——**不回落到任何本地角色目录**。
 *
 * @returns 平台角色列表
 */
export async function fetchPlatformRoles(): Promise<PlatformRole[]> {
  let list: unknown[]
  try {
    const raw = await httpPlatform.get<unknown>('/roles', undefined, { silent: true })
    list = Array.isArray(raw) ? raw : []
  } catch (error) {
    /*
     * 回退到生产域的「本农场角色目录」（GET /api/v1/production/members/roles/catalog）。
     *
     * 为什么需要这条回退（2026-10-16 产品口径）：平台域 `/api/v1/admin/roles` 是**平台角色全表**，
     * 只允许平台超级管理员调用 —— 农场主（FARMER）拿到 403，页面原先显示
     * 「角色接口不可用，请确认后端平台服务已启动」，把"无权限"说成"服务没起"，误导排查方向。
     * 产品口径是"农场主应能在用户端看到自己农场里的角色"，所以这里降级到按成员台账聚合的
     * 本农场角色目录：能给出角色编码与在职人数，**权限明细仍留空**（那是平台域数据，本账号无权读，
     * 不编造）。若回退也失败，才把原始错误抛给页面（页面据此显示"接口不可用"并给重试）。
     */
    try {
      const catalog = await http.get<unknown>('/members/roles/catalog', undefined, { silent: true })
      const rows = Array.isArray(catalog) ? catalog : []
      return rows.map((item, index) => {
        const record = asRecord(item)
        const code = readString(record, ['roleCode', 'code'], '')
        return {
          id: index,
          code,
          // 角色名称的权威数据在平台域，这里没有 —— 给编码，不编名字
          name: readString(record, ['roleName', 'name'], '') || code,
          permissions: [],
        }
      })
    } catch {
      throw error
    }
  }
  return list.map((item) => {
    const record = asRecord(item)
    const stored = readValue(record, ['permissions'])
    let permissions: string[] = []
    if (Array.isArray(stored)) {
      permissions = stored.map((code) => String(code))
    } else if (typeof stored === 'string' && stored.trim()) {
      try {
        const parsed = JSON.parse(stored) as unknown
        if (Array.isArray(parsed)) {
          permissions = parsed.map((code) => String(code))
        }
      } catch {
        // 存储格式非法时按「未配置」处理，绝不猜测
        permissions = []
      }
    }
    return {
      id: readNumberOrNull(record, ['id']),
      code: readString(record, ['code'], ''),
      name: readString(record, ['name'], ''),
      permissions,
    }
  })
}

/** 角色权限保存结果（显式成功 / 失败，不允许「吞掉异常后返回成功」） */
export interface RolePermissionSaveResult {
  /** 是否真的落库成功 */
  success: boolean
  /** 落库后的权限码（成功时非空） */
  permissions: string[]
  /** 失败原因（面向用户的中文说明） */
  message: string
}

/**
 * 保存角色权限：真实写入 `platform_role.permissions`。
 *
 * 端点：`PUT /api/v1/admin/roles/{code}/permissions`（core-platform mod-platform）。
 * 注意 `/api/v1/admin` 与业务域前缀 `/api/v1/production` 不同，
 * 必须走 `httpPlatform`，否则会被拼成 `/api/v1/production/api/v1/admin/...` 而 404。
 *
 * 纪律：**失败不返回成功**。后端明确拒绝（如角色不存在 → 404）或网络异常时，
 * 抛出可展示的中文错误交给页面 onError，绝不使用 localStorage 伪造「已保存」。
 *
 * @param roleCode 角色编码
 * @param permissionIds 权限编码列表
 * @returns 保存结果（success 恒为 true；失败直接抛错）
 */
export async function saveRolePermissions(
  roleCode: string,
  permissionIds: string[],
): Promise<RolePermissionSaveResult> {
  if (!roleCode) {
    throw new Error('保存失败：角色编码为空')
  }
  let updated: PlatformRole
  try {
    const raw = await httpPlatform.put<unknown>(
      `/roles/${encodeURIComponent(roleCode)}/permissions`,
      { permissions: permissionIds },
      { silent: true },
    )
    const record = asRecord(raw)
    const stored = readValue(record, ['permissions'])
    const saved = Array.isArray(stored) ? stored.map((code) => String(code)) : permissionIds
    updated = {
      id: readNumberOrNull(record, ['id']),
      code: readString(record, ['code'], roleCode),
      name: readString(record, ['name'], ''),
      permissions: saved,
    }
  } catch (error) {
    throw new Error(`保存失败：${describeRequestError(error)}`)
  }
  return {
    success: true,
    permissions: updated.permissions,
    message: `角色「${updated.name || updated.code}」权限已写入服务端（${updated.permissions.length} 个权限点）`,
  }
}

/**
 * 把请求异常翻译成面向用户的中文说明。
 *
 * axios 网络层错误的 message 是英文（如 Network Error），直接抛给用户既看不懂
 * 也掩盖了「后端根本没这个端点」这一事实，这里统一转换。
 *
 * @param error catch 到的未知错误
 * @returns 中文说明
 */
function describeRequestError(error: unknown): string {
  const status = httpStatusOf(error)
  const bizMessage = (error as { message?: unknown })?.message
  const text = typeof bizMessage === 'string' && bizMessage ? bizMessage : ''
  if (status === 404) {
    return '后端暂不支持权限写入（接口 404）' + (text ? `：${text}` : '')
  }
  if (status === 403) {
    return '当前账号无权限写入角色权限（403）'
  }
  if (status === 0) {
    return '后端服务不可达，未写入服务端'
  }
  return text || '后端暂不支持权限写入'
}

/**
 * 读取角色已配置权限（GET /api/v1/admin/roles/{code}/permissions）。
 *
 * 此前吃的是 `/members/roles/permissions` —— 那个端点后端是硬编码空壳，
 * 固定返回 produce:read / produce:write / produce:admin 三个与数据库无关的假权限码；
 * 现在改读平台域真实端点。
 *
 * 读取失败直接抛错（不静默返回空数组）：空数组表示「该角色确实没配权限」，
 * 与「读不到」是两回事，静默兜空会让用户以为权限被清空了。
 *
 * @param roleCode 角色编码
 * @returns 权限码列表
 */
export async function fetchRolePermissions(roleCode: string): Promise<string[]> {
  const raw = await httpPlatform.get<unknown>(
    `/roles/${encodeURIComponent(roleCode)}/permissions`,
    undefined,
    { silent: true },
  )
  const list = Array.isArray(raw) ? raw : []
  return list.map((item) => String(item))
}

/**
 * 查询权限树（按角色分组）
 *
 * 数据源为平台域真实角色权限 `GET /api/v1/admin/roles`。
 * 此前读的是 `/members/roles/permissions` —— 后端是硬编码空壳，固定返回
 * produce:read / produce:write / produce:admin 三个与数据库无关的假权限码，已弃用。
 *
 * 权限点的**权威目录**在前端 `PERMISSION_GROUPS`（RBAC 命名规范 `{域}.{资源}.{动作}`），
 * 本函数只负责回显服务端真实已配置的权限码；读不到时返回空数组，页面显示空态。
 *
 * @returns 权限树
 */
export async function fetchPermissions(): Promise<Permission[]> {
  let roles: PlatformRole[] = []
  try {
    roles = await fetchPlatformRoles()
  } catch {
    return []
  }
  return roles
    .filter((role) => role.code !== '' && role.permissions.length > 0)
    .map((role, index) => ({
      permissionId: `role-${role.id ?? index}`,
      permissionCode: role.code,
      permissionName: role.name || role.code,
      permissionType: 1 as 1 | 2 | 3,
      children: role.permissions.map((code, childIndex) => ({
        permissionId: `${role.code}-${childIndex}`,
        permissionCode: code,
        permissionName: code,
        permissionType: 2 as 1 | 2 | 3,
      })),
    }))
}

/* ==================== 种养计划 ==================== */

/**
 * 分页查询种养计划
 * @param params 查询参数
 * @returns 分页计划列表
 */
export async function fetchPlans(params: {
  pageNum: number
  pageSize: number
  keyword?: string
  crop?: string
  status?: number
  farmId?: string
}): Promise<PageResult<Plan>> {
  const raw = await http.get<unknown>(
    '/plans',
    buildPageParams(params.pageNum, params.pageSize, {
      keyword: params.keyword,
      crop: params.crop,
      status: params.status,
      farmId: params.farmId,
    }),
    { silent: true },
  )
  const page = normalizePageResult<unknown>(raw, params.pageNum, params.pageSize)
  return { ...page, list: page.list.map(normalizePlan) }
}

/**
 * 查询种养计划详情
 * @param planId 计划 ID
 * @returns 计划详情
 */
export async function fetchPlanDetail(planId: string): Promise<Plan> {
  const raw = await http.get<unknown>(`/plans/${planId}`)
  return normalizePlan(raw)
}

/**
 * 阶段视图类型：在 PlanStage 契约之上补充后端 `status`
 * （0取消 / 1未开始 / 2进行中 / 3已完成），用于 PLAN-05 完成判定与延误计算。
 */
export type PlanStageView = ReturnType<typeof normalizePlanStage>

/**
 * 查询计划阶段列表（生育期安排）
 * @param planId 计划 ID
 * @returns 阶段列表
 */
export async function fetchPlanStages(planId: string): Promise<PlanStageView[]> {
  try {
    const raw = await http.get<unknown>(`/plans/${planId}/stages/list`, undefined, {
      silent: true,
    })
    const list = Array.isArray(raw) ? raw : normalizePageResult<unknown>(raw).list
    return list.map(normalizePlanStage).sort((a, b) => a.stageNo - b.stageNo)
  } catch {
    return []
  }
}

/**
 * 查询计划关联农事任务
 * @param planId 计划 ID
 * @param limit 返回条数
 * @returns 任务列表
 */
export async function fetchPlanTasks(planId: string, limit = 50): Promise<Task[]> {
  try {
    const raw = await http.get<unknown>(
      '/tasks',
      buildPageParams(1, 100, { keyword: '' }),
      { silent: true },
    )
    const page = normalizePageResult<unknown>(raw, 1, 100)
    return page.list.map(normalizeTask).filter((task) => task.planId === planId).slice(0, limit)
  } catch {
    return []
  }
}

/* ==================== 计划写操作 ==================== */

/**
 * 将日期入参归一化为 `yyyy-MM-dd`。
 *
 * ProFormDatePicker 提交出来的是 dayjs 对象，直接入参会序列化成 ISO 日期时间串，
 * 后端 `LocalDate` 无法解析；这里统一收敛，调用方无需关心。
 *
 * @param value 任意日期入参（dayjs / Date / 'yyyy-MM-dd'）
 * @returns 归一化后的日期串，空值时返回 undefined
 */
function toDateString(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const parsed = dayjs(value as string | number | Date)
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : undefined
}

/**
 * 新增种养计划（按后端 PlanInfoEntity 字段命名）
 * @param payload 计划入参
 * @returns 新建计划 ID
 */
export async function createPlanInfo(payload: {
  planCode?: string
  planName: string
  farmId?: string
  plotId?: string
  cropId?: string
  cropVariety?: string
  planStartDate: string
  planEndDate: string
  expectedYield?: number
  planArea?: number
  ownerId?: string
  status?: number
}): Promise<string> {
  const raw = await http.post<unknown>('/plans', {
    ...payload,
    planStartDate: toDateString(payload.planStartDate),
    planEndDate: toDateString(payload.planEndDate),
  })
  if (typeof raw === 'string') return raw
  return readString(asRecord(raw), ['planId', 'id'], '')
}

/**
 * 更新种养计划
 * @param planId 计划 ID
 * @param payload 更新内容
 * @returns void
 */
export async function updatePlanInfo(
  planId: string,
  payload: Partial<{
    planCode: string
    planName: string
    farmId: string
    plotId: string
    cropId: string
    cropVariety: string
    planStartDate: string
    planEndDate: string
    expectedYield: number
    planArea: number
    ownerId: string
    status: number
  }>,
): Promise<void> {
  await http.put<unknown>(`/plans/${planId}`, {
    ...payload,
    ...(payload.planStartDate !== undefined
      ? { planStartDate: toDateString(payload.planStartDate) }
      : {}),
    ...(payload.planEndDate !== undefined
      ? { planEndDate: toDateString(payload.planEndDate) }
      : {}),
  })
}

/**
 * 删除种养计划
 * @param planId 计划 ID
 * @returns void
 */
export async function removePlan(planId: string): Promise<void> {
  await http.delete<unknown>(`/plans/${planId}`)
}

/** 生育期阶段写操作入参（按后端 PlanStageEntity 字段命名） */
export interface PlanStagePayload {
  /** 阶段名称 */
  stageName: string
  /** 阶段序号 */
  stageSeq: number
  /** 计划开始日期 */
  planStartDate: string
  /** 计划结束日期 */
  planEndDate: string
  /** 默认任务类型 */
  taskType?: string
  /** 阶段说明 */
  description?: string
  /** 状态：1未开始 2进行中 3已完成 0取消 */
  status?: number
}

/**
 * 新增生育期阶段（PLAN-02 生育期计划编排）
 * @param planId 计划 ID
 * @param payload 阶段入参
 * @returns 新建阶段 ID
 */
export async function createPlanStage(
  planId: string,
  payload: PlanStagePayload,
): Promise<string> {
  const raw = await http.post<unknown>(`/plans/${planId}/stages`, {
    ...payload,
    planStartDate: toDateString(payload.planStartDate),
    planEndDate: toDateString(payload.planEndDate),
  })
  if (typeof raw === 'string') return raw
  return readString(asRecord(raw), ['stageId', 'id'], '')
}

/**
 * 更新生育期阶段（PLAN-02 生育期计划编排）
 * @param planId 计划 ID
 * @param stageId 阶段 ID
 * @param payload 更新内容
 * @returns void
 */
export async function updatePlanStage(
  planId: string,
  stageId: string,
  payload: Partial<PlanStagePayload>,
): Promise<void> {
  const patch: Partial<PlanStagePayload> = { ...payload }
  if (payload.planStartDate !== undefined) {
    patch.planStartDate = toDateString(payload.planStartDate)
  }
  if (payload.planEndDate !== undefined) {
    patch.planEndDate = toDateString(payload.planEndDate)
  }
  await http.put<unknown>(`/plans/${planId}/stages/${stageId}`, patch)
}

/**
 * 删除生育期阶段（PLAN-02 生育期计划编排）
 * @param planId 计划 ID
 * @param stageId 阶段 ID
 * @returns void
 */
export async function removePlanStage(planId: string, stageId: string): Promise<void> {
  await http.delete<unknown>(`/plans/${planId}/stages/${stageId}`)
}

/**
 * 计划状态流转：启动（1 编制中 → 2 进行中）
 * @param planId 计划 ID
 * @returns void
 */
export async function startPlan(planId: string): Promise<void> {
  await http.post<unknown>(`/plans/${planId}/start`)
}

/**
 * 计划状态流转：终止（→ 4 已取消）
 * @param planId 计划 ID
 * @returns void
 */
export async function terminatePlan(planId: string): Promise<void> {
  await http.post<unknown>(`/plans/${planId}/terminate`)
}

/** 农事日历条目视图模型 */
export interface CalendarEntry {
  /** 条目 ID（多日条目已拼接日期，保证唯一） */
  entryId: string
  /** 展示标题 */
  title: string
  /** 来源：plan-stage 表示生育期阶段，task 表示农事任务 */
  source: 'plan-stage' | 'task'
  /** 日期（yyyy-MM-dd），多日条目会在区间内逐日展开 */
  date: string
  /** 所属区间结束日期（多日任务/阶段才有跨天意义） */
  endDate?: string
  /** 地块 ID */
  plotId: string
  /** 地块名称 */
  plotName: string
  /** 计划 ID（阶段来源时有值） */
  planId?: string
  /** 任务 ID（任务来源时有值，用于跳转任务详情；不可用 entryId 反解） */
  taskId?: string
  /** 阶段 ID（阶段来源时有值） */
  stageId?: string
  /** 任务类型 / 阶段名称 */
  category: string
  /** 状态说明 */
  statusLabel: string
  /** 是否已完成 */
  done: boolean
  /** 负责人 ID（任务来源时有值） */
  assigneeId?: string
  /** 负责人姓名（任务来源时有值，冲突提示需展示） */
  assigneeName?: string
}

/** 单日展开条目的上限，防止异常超长区间打爆页面 */
const MAX_CALENDAR_SPAN_DAYS = 366

/**
 * 判定业务区间 [start, end] 是否与查询窗口 [rangeStart, rangeEnd] 重叠。
 *
 * 与后端 R-PLAN-01 校验（PlanInfoService#assertNoGrowingConflict）保持同一口径：
 * `start <= rangeEnd && end >= rangeStart`。
 *
 * @param start 业务开始日期（yyyy-MM-dd）
 * @param end 业务结束日期（yyyy-MM-dd）
 * @param rangeStart 查询窗口开始
 * @param rangeEnd 查询窗口结束
 * @returns 是否重叠
 */
function overlapsRange(
  start: string,
  end: string,
  rangeStart: string,
  rangeEnd: string,
): boolean {
  if (!start || !end) return false
  return start <= rangeEnd && end >= rangeStart
}

/**
 * 取区间在查询窗口内的有效片段（用于逐日展开时裁剪）
 * @param start 业务开始日期
 * @param end 业务结束日期
 * @param rangeStart 查询窗口开始
 * @param rangeEnd 查询窗口结束
 * @returns 裁剪后的 [start, end]
 */
function clampRange(
  start: string,
  end: string,
  rangeStart: string,
  rangeEnd: string,
): { start: string; end: string } {
  return {
    start: start < rangeStart ? rangeStart : start,
    end: end > rangeEnd ? rangeEnd : end,
  }
}

/**
 * 农事日历查询结果（附带各来源的「接口不可用」原因）。
 *
 * 日历由「农事任务 + 计划阶段」两个来源合成，任一个拿不到都只会让日历**少一部分排期**，
 * 而页面上看不出来少了哪一块——这正是静默 catch 最危险的地方：用户会以为"这段时间没有安排"。
 * 因此这里把不可用原因一并返回，由页面醒目提示本次缺了哪个来源。
 */
export interface CalendarEntriesResult {
  /** 日历条目（来源不可用时该来源为空，绝不用示例数据顶上） */
  entries: CalendarEntry[]
  /** 各来源的不可用原因；为空表示两个来源都取到了真实数据 */
  unavailableReasons: string[]
}

/**
 * 描述某个日历数据来源的失败原因。
 *
 * @param source 来源名称
 * @param error catch 到的未知错误
 * @returns 中文说明
 */
function describeSourceFailure(source: string, error: unknown): string {
  const status = httpStatusOf(error)
  const detail = (error as Error)?.message?.trim()
  const kind = status > 0 ? `HTTP ${status}` : '后端不可达'
  return `${source}接口不可用（${kind}）${detail ? `：${detail}` : ''}`
}

/**
 * 查询农事日历（按月区间聚合「计划阶段 + 农事任务」）
 *
 * **跨月可见性**：阶段与任务均按其完整日期区间做「重叠判定」并**逐日展开**，
 * 而非只在开始日落一个点。这样 3/28 开始、顺延到 4/5 的任务，在 4 月视图里
 * 依然能看到 4/1~4/5 的排期，不会因只按 startDate 所属月过滤而丢失。
 *
 * @param params 查询参数（startDate / endDate 为查询窗口）
 * @returns 日历条目与不可用原因（多日条目按天展开）
 */
export async function fetchCalendarEntries(params: {
  startDate: string
  endDate: string
  farmId?: string
}): Promise<CalendarEntriesResult> {
  const entries: CalendarEntry[] = []
  const unavailableReasons: string[] = []
  const { startDate: rangeStart, endDate: rangeEnd } = params

  // 1) 农事任务：区间重叠 + 逐日展开
  try {
    const raw = await http.get<unknown>(
      '/tasks',
      buildPageParams(1, 200, { keyword: '' }),
      { silent: true },
    )
    const page = normalizePageResult<unknown>(raw, 1, 200)
    for (const item of page.list) {
      const task = normalizeTask(item)
      const taskStart = task.planStartDate ? task.planStartDate.slice(0, 10) : ''
      if (!taskStart) continue
      // 任务可能未回填结束时间，退化为「当日」
      const taskEnd = task.planEndDate ? task.planEndDate.slice(0, 10) : taskStart
      if (!overlapsRange(taskStart, taskEnd, rangeStart, rangeEnd)) continue
      const clamped = clampRange(taskStart, taskEnd, rangeStart, rangeEnd)
      const days = expandDateRange(clamped.start, clamped.end).slice(
        0,
        MAX_CALENDAR_SPAN_DAYS,
      )
      for (const day of days) {
        entries.push({
          entryId: `task-${task.taskId}-${day}`,
          title: task.taskName,
          source: 'task',
          date: day,
          endDate: taskEnd !== day ? taskEnd : undefined,
          plotId: task.plotId ?? '',
          plotName: task.plotName ?? '-',
          taskId: task.taskId,
          category: task.taskType,
          statusLabel: task.status,
          // 「已完成」同时认 PRD 标准值 completed 与迁移前旧值 done
          done: isTaskDone(task.status),
          assigneeId: task.assigneeId || undefined,
          assigneeName: task.assigneeName || undefined,
        })
      }
    }
  } catch (error) {
    // 不再静默：任务这一半缺失会让日历"看起来这段时间没有安排"，必须告诉用户缺了什么
    unavailableReasons.push(
      `${describeSourceFailure('农事任务', error)}——本次日历里不会有任务排期，这不是"这段时间没有任务"`,
    )
  }

  // 2) 计划生育期阶段：同为区间重叠 + 逐日展开
  try {
    const planRaw = await http.get<unknown>(
      '/plans',
      buildPageParams(1, 100, { keyword: '' }),
      { silent: true },
    )
    const planPage = normalizePageResult<unknown>(planRaw, 1, 100)
    for (const item of planPage.list) {
      const plan = normalizePlan(item)
      const stages = await fetchPlanStages(plan.planId)
      for (const stage of stages) {
        const stageStart = stage.planStartDate ? stage.planStartDate.slice(0, 10) : ''
        if (!stageStart) continue
        const stageEnd = (stage.planEndDate || stage.planStartDate).slice(0, 10)
        if (!overlapsRange(stageStart, stageEnd, rangeStart, rangeEnd)) continue
        const clamped = clampRange(stageStart, stageEnd, rangeStart, rangeEnd)
        const days = expandDateRange(clamped.start, clamped.end).slice(
          0,
          MAX_CALENDAR_SPAN_DAYS,
        )
        for (const day of days) {
          entries.push({
            entryId: `stage-${stage.stageId}-${day}`,
            title: `${plan.planName} · ${stage.stageName}`,
            source: 'plan-stage',
            date: day,
            endDate: stageEnd !== day ? stageEnd : undefined,
            plotId: plan.plotId ?? '',
            plotName: plan.plotName ?? '-',
            planId: plan.planId,
            stageId: stage.stageId,
            category: stage.stageName,
            statusLabel: 'plan-stage',
            done: false,
          })
        }
      }
    }
  } catch (error) {
    // 不再静默：计划阶段这一半缺失同样是"少了一块排期"而不是"没有排期"
    unavailableReasons.push(
      `${describeSourceFailure('种养计划阶段', error)}——本次日历里不会有生育期阶段排期，这不是"这段时间没有阶段"`,
    )
  }

  return { entries, unavailableReasons }
}

/**
 * 查询计划日历月度汇总（后端 `/plans/calendar` 按起始月份聚合）
 * @returns 月度汇总列表
 */
export async function fetchPlanCalendarSummary(): Promise<
  { month: string; planCount: number; area: number }[]
> {
  try {
    const raw = await http.get<unknown>('/plans/calendar', undefined, { silent: true })
    const list = Array.isArray(raw) ? raw : []
    return list.map((item) => {
      const record = asRecord(item)
      return {
        month: readString(record, ['month', 'bizMonth', 'planMonth'], '-'),
        planCount: readNumber(record, ['planCount', 'count', 'total'], 0),
        area: readNumber(record, ['area', 'totalArea', 'planArea'], 0),
      }
    })
  } catch {
    return []
  }
}
