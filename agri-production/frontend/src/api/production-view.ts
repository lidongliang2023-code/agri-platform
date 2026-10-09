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
import { http } from '@/utils/request'
import {
  asRecord,
  expandDateRange,
  mergeOverview,
  normalizeAlert,
  normalizeMember,
  normalizeMessage,
  normalizePageResult,
  normalizePlan,
  normalizePlanStage,
  normalizePlot,
  normalizeTask,
  readNumber,
  readString,
  readValue,
} from '@/utils/production-adapter'
import type { DashboardOverview } from '@/utils/production-adapter'
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
 * 查询生产总览指标（无数据 / 异常时回落到原型示例口径）
 * @param farmId 当前农场 ID
 * @returns 看板总览视图模型
 */
export async function fetchDashboardOverview(farmId?: string): Promise<DashboardOverview> {
  try {
    const raw = await http.get<unknown>('/analytics/overview', { farmId }, { silent: true })
    return mergeOverview(raw)
  } catch {
    return mergeOverview(undefined)
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

/**
 * 查询未读消息数量
 *
 * 后端 `/messages/unread-count` 强制要求 receiverId 入参，
 * 未登录 / 无用户信息时静默降级为 0。
 *
 * @param receiverId 接收人 ID
 * @returns 未读数量
 */
export async function fetchUnreadCount(receiverId?: string): Promise<number> {
  if (!receiverId) return 0
  try {
    const raw = await http.get<unknown>(
      '/messages/unread-count',
      { receiverId },
      { silent: true },
    )
    return readNumber({ value: raw }, ['value'], 0)
  } catch {
    return 0
  }
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
 * 查询角色列表（后端按 role_code 聚合在职人数）
 * @returns 角色列表
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

/** 角色权限本地持久化前缀（后端暂未提供写入接口时的降级方案） */
const ROLE_PERMISSION_STORAGE_PREFIX = 'agri_role_permissions_'

/**
 * 保存角色权限
 *
 * 后端暂未提供 `PUT /members/roles/{roleCode}/permissions` 写入接口，
 * 这里先尝试写入（后端补齐后自动生效），失败时降级为 localStorage 持久化，
 * 保证「勾选 → 保存 → 再次进入仍生效」的完整交互闭环。
 *
 * @param roleCode 角色编码
 * @param permissionIds 权限编码列表
 * @returns 是否保存成功
 */
export async function saveRolePermissions(
  roleCode: string,
  permissionIds: string[],
): Promise<boolean> {
  localStorage.setItem(
    `${ROLE_PERMISSION_STORAGE_PREFIX}${roleCode}`,
    JSON.stringify(permissionIds),
  )
  try {
    await http.put<unknown>(
      `/members/roles/${roleCode}/permissions`,
      { permissionIds },
      { silent: true },
    )
  } catch {
    // 后端未实现写入接口时静默降级，不阻塞前端交互
  }
  return true
}

/**
 * 读取角色已配置权限（本地持久化优先，其次后端接口，最后按角色模板兜底）
 * @param roleCode 角色编码
 * @returns 权限编码列表
 */
export async function fetchRolePermissions(roleCode: string): Promise<string[]> {
  const cached = localStorage.getItem(`${ROLE_PERMISSION_STORAGE_PREFIX}${roleCode}`)
  if (cached) {
    try {
      const parsed = JSON.parse(cached)
      if (Array.isArray(parsed)) return parsed.map((item) => String(item))
    } catch {
      // 缓存损坏时忽略，继续走后端读取
    }
  }
  try {
    const raw = await http.get<unknown>(
      '/members/roles/permissions',
      { roleCode },
      { silent: true },
    )
    const list = Array.isArray(raw) ? raw : []
    const codes: string[] = []
    for (const item of list) {
      const value = readValue(asRecord(item), ['permissions'])
      if (Array.isArray(value)) {
        codes.push(...value.map((code) => String(code)))
      }
    }
    return Array.from(new Set(codes))
  } catch {
    return []
  }
}

/**
 * 查询权限树
 *
 * 后端暂返回骨架数据（produce:read / produce:write / produce:admin），
 * 页面侧的权威目录见 `PERMISSION_GROUPS`。
 *
 * @returns 权限树
 */
export async function fetchPermissions(): Promise<Permission[]> {
  try {
    const raw = await http.get<unknown>('/members/roles/permissions', undefined, { silent: true })
    const list = Array.isArray(raw) ? raw : []
    return list.map((item, index) => {
      const record = asRecord(item)
      const payload = readValue(record, ['permissions'])
      const children = Array.isArray(payload)
        ? payload.map((code, childIndex) => ({
            permissionId: `${readString(record, ['roleCode'], 'ALL')}-${childIndex}`,
            permissionCode: String(code),
            permissionName: String(code),
            permissionType: 2 as 1 | 2 | 3,
          }))
        : []
      return {
        permissionId: `group-${index}`,
        permissionCode: readString(record, ['roleCode'], 'ALL'),
        permissionName: readString(record, ['roleCode'], '全部权限'),
        permissionType: 1 as 1 | 2 | 3,
        children,
      }
    })
  } catch {
    return []
  }
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
  status?: number
  farmId?: string
}): Promise<PageResult<Plan>> {
  const raw = await http.get<unknown>(
    '/plans',
    buildPageParams(params.pageNum, params.pageSize, {
      keyword: params.keyword,
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
 * 查询农事日历（按月区间聚合「计划阶段 + 农事任务」）
 *
 * **跨月可见性**：阶段与任务均按其完整日期区间做「重叠判定」并**逐日展开**，
 * 而非只在开始日落一个点。这样 3/28 开始、顺延到 4/5 的任务，在 4 月视图里
 * 依然能看到 4/1~4/5 的排期，不会因只按 startDate 所属月过滤而丢失。
 *
 * @param params 查询参数（startDate / endDate 为查询窗口）
 * @returns 日历条目列表（多日条目按天展开）
 */
export async function fetchCalendarEntries(params: {
  startDate: string
  endDate: string
  farmId?: string
}): Promise<CalendarEntry[]> {
  const entries: CalendarEntry[] = []
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
          done: ['accepted', 'done', 'completed'].includes(task.status),
          assigneeId: task.assigneeId || undefined,
          assigneeName: task.assigneeName || undefined,
        })
      }
    }
  } catch {
    // 静默：任务接口不可用时不影响阶段日历渲染
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
  } catch {
    // 静默：计划接口不可用时降级为空集合
  }

  return entries
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
