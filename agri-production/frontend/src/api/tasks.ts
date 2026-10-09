/**
 * 农事任务 API（含模板库与验收）
 */
import { http } from '@/utils/request'
import type { PageQuery, PageResult } from '@/types'
import type { Task, TaskAcceptance, TaskRecord, TaskTemplate } from '@/types'

const BASE = '/tasks'

/** 任务列表查询参数 */
export interface TaskListParams extends PageQuery {
  farmId?: string
  planId?: string
  plotId?: string
  taskType?: string
  status?: string
  priority?: number
  assigneeId?: string
  startDate?: string
  endDate?: string
}

/** 任务新增 / 编辑入参 */
export type TaskPayload = Partial<Task>

/** 分页查询任务列表 */
export function listTasks(params: TaskListParams): Promise<PageResult<Task>> {
  return http.get<PageResult<Task>>(BASE, params)
}

/** 查询任务详情 */
export function getTask(taskId: string): Promise<Task> {
  return http.get<Task>(`${BASE}/${taskId}`)
}

/** 新增任务 */
export function createTask(payload: TaskPayload): Promise<string> {
  return http.post<string>(BASE, payload)
}

/** 更新任务 */
export function updateTask(taskId: string, payload: TaskPayload): Promise<Task> {
  return http.put<Task>(`${BASE}/${taskId}`, payload)
}

/** 删除任务 */
export function deleteTask(taskId: string): Promise<void> {
  return http.delete<void>(`${BASE}/${taskId}`)
}

/** 派发任务 */
export function assignTask(taskId: string, assigneeId: string): Promise<boolean> {
  return http.patch<boolean>(`${BASE}/${taskId}/assign`, { assigneeId })
}

/** 开始执行任务 */
export function startTask(taskId: string): Promise<boolean> {
  return http.patch<boolean>(`${BASE}/${taskId}/start`)
}

/** 提交任务成果 */
export function submitTask(taskId: string, payload: Record<string, unknown>): Promise<boolean> {
  return http.patch<boolean>(`${BASE}/${taskId}/submit`, payload)
}

/** 查询任务验收记录 */
export function getTaskAcceptance(taskId: string): Promise<TaskAcceptance> {
  return http.get<TaskAcceptance>(`${BASE}/${taskId}/acceptance`)
}

/** 提交任务验收结果 */
export function acceptTask(
  taskId: string,
  payload: { acceptStatus: number; remark?: string; attachmentUrls?: string[] },
): Promise<TaskAcceptance> {
  return http.post<TaskAcceptance>(`${BASE}/${taskId}/acceptance`, payload)
}

/** 分页查询任务模板库 */
export function listTaskTemplates(params: PageQuery & {
  taskType?: string
  cropId?: string
}): Promise<PageResult<TaskTemplate>> {
  return http.get<PageResult<TaskTemplate>>(`${BASE}/templates`, params)
}

/** 查询任务模板详情 */
export function getTaskTemplate(templateId: string): Promise<TaskTemplate> {
  return http.get<TaskTemplate>(`${BASE}/templates/${templateId}`)
}

/** 新增任务模板 */
export function createTaskTemplate(payload: Partial<TaskTemplate>): Promise<string> {
  return http.post<string>(`${BASE}/templates`, payload)
}

/** 更新任务模板 */
export function updateTaskTemplate(
  templateId: string,
  payload: Partial<TaskTemplate>,
): Promise<TaskTemplate> {
  return http.put<TaskTemplate>(`${BASE}/templates/${templateId}`, payload)
}

/** 删除任务模板 */
export function deleteTaskTemplate(templateId: string): Promise<void> {
  return http.delete<void>(`${BASE}/templates/${templateId}`)
}

/* ------------------------------------------------------------------------- *
 * 以下方法为「农事任务组页面」补充：
 * - 后端分页入参为 page / size，返回体为 { records, total, page, size }；
 *   此处统一转换为前端 PageResult（{ list, total, pageNum, pageSize, pages }）。
 * - 状态流转接口后端均为 POST + RequestParam，与上面 PATCH 版本互不冲突。
 * ------------------------------------------------------------------------- */

/** 后端原始分页结构（兼容 { records } 与 { list } 两种形态） */
export interface RawPageResult<T> {
  /** MyBatis-Plus 风格数据列表 */
  records?: T[]
  /** 前端风格数据列表 */
  list?: T[]
  /** 总条数 */
  total?: number
  /** 当前页码 */
  page?: number
  /** 每页条数 */
  size?: number
  /** 前端风格页码 */
  pageNum?: number
  /** 前端风格每页条数 */
  pageSize?: number
}

/** 前端分页入参（列表 / 看板通用） */
export interface TaskPageParams {
  /** 农场 ID */
  farmId?: string
  /** 关键字（任务名称模糊匹配） */
  keyword?: string
  /** 状态过滤 */
  status?: string
  /** 任务类型 */
  taskType?: string
  /** 优先级 */
  priority?: number
  /** 执行人 */
  assigneeId?: string
  /** 地块 */
  plotId?: string
  /** 页码 */
  pageNum?: number
  /** 每页条数 */
  pageSize?: number
}

/**
 * 归一化后端分页响应为前端 PageResult
 * @param raw 后端原始分页数据
 * @param pageNum 兜底页码
 * @param pageSize 兜底每页条数
 * @returns 前端统一分页结构
 */
export function normalizePageResult<T>(
  raw: RawPageResult<T> | null | undefined,
  pageNum: number,
  pageSize: number,
): PageResult<T> {
  const list = raw?.records ?? raw?.list ?? []
  const total = Number(raw?.total ?? list.length)
  const currentPage = Number(raw?.pageNum ?? raw?.page ?? pageNum)
  const currentSize = Number(raw?.pageSize ?? raw?.size ?? pageSize)
  return {
    pageNum: currentPage,
    pageSize: currentSize,
    total,
    pages: Math.max(1, Math.ceil(total / (currentSize || 1))),
    list,
  }
}

/** 分页查询任务列表（适配后端 page/size 入参） */
export async function fetchTaskPage(params: TaskPageParams): Promise<PageResult<Task>> {
  const { pageNum = 1, pageSize = 20 } = params
  const raw = await http.get<RawPageResult<Task>>(BASE, {
    ...params,
    page: pageNum,
    size: pageSize,
  })
  return normalizePageResult<Task>(raw, pageNum, pageSize)
}

/** 分页查询任务执行记录 */
export async function fetchTaskRecords(
  taskId: string,
  pageNum = 1,
  pageSize = 50,
): Promise<PageResult<TaskRecord>> {
  const raw = await http.get<RawPageResult<TaskRecord>>(`${BASE}/${taskId}/records`, {
    page: pageNum,
    size: pageSize,
  })
  return normalizePageResult<TaskRecord>(raw, pageNum, pageSize)
}

/** 新增任务执行记录（打卡） */
export function createTaskRecord(
  taskId: string,
  payload: Partial<TaskRecord>,
): Promise<string> {
  return http.post<string>(`${BASE}/${taskId}/records`, payload)
}

/** 分页查询任务模板库（适配后端 page/size 入参） */
export async function fetchTaskTemplatesPage(params: {
  keyword?: string
  status?: number
  pageNum?: number
  pageSize?: number
}): Promise<PageResult<TaskTemplate>> {
  const { pageNum = 1, pageSize = 10 } = params
  const raw = await http.get<RawPageResult<TaskTemplate>>(`${BASE}/templates`, {
    keyword: params.keyword,
    status: params.status,
    page: pageNum,
    size: pageSize,
  })
  return normalizePageResult<TaskTemplate>(raw, pageNum, pageSize)
}

/** 派发 / 转派任务（后端 POST + RequestParam assigneeId） */
export function dispatchTask(taskId: string, assigneeId: string): Promise<Task> {
  return http.post<Task>(`${BASE}/${taskId}/assign`, undefined, { params: { assigneeId } })
}

/** 开始执行任务（后端 POST） */
export function executeTask(taskId: string): Promise<Task> {
  return http.post<Task>(`${BASE}/${taskId}/start`)
}

/** 提交任务成果（执行中 → 待验收） */
export function submitTaskResult(taskId: string): Promise<Task> {
  return http.post<Task>(`${BASE}/${taskId}/submit`)
}

/**
 * 任务验收（通过 / 驳回）
 * @param taskId 任务 ID
 * @param pass true 通过，false 驳回（驳回后 rejectCount 由后端累加）
 * @param opinion 验收意见 / 驳回原因
 */
export function reviewTask(taskId: string, pass: boolean, opinion?: string): Promise<Task> {
  return http.post<Task>(`${BASE}/${taskId}/acceptance`, undefined, {
    params: { pass, opinion },
  })
}

/** 按作物查询可用任务模板 */
export function listTemplatesByCrop(cropId: string): Promise<TaskTemplate[]> {
  return http.get<TaskTemplate[]>(`${BASE}/templates/by-crop`, { cropId })
}
