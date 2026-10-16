/**
 * 生产管理域接口封装（移动端）。
 *
 * <p>PRD 6.1 的口径是「复用 PC 端用户端 API，路径保持一致」，所以这里**不新造端点**，
 * 只把 PC 端已在用、且经联调验证过的路径按移动端的取数需求封一遍。
 * 分页入参注意两套口径：任务列表后端用 {@code page/size}，其它列表用 {@code pageNum/pageSize}
 * （与 PC 端一致，别按直觉统一）。</p>
 */
import { normalizePage, request } from '@/utils/request'
import type { PageResult } from '@/utils/request'
import type { FarmBrief } from '@/utils/auth'

/* ==================== 农场 / 地块 ==================== */

/** 农场下拉列表（登录账号可见的全部农场） */
export function listFarms(): Promise<FarmBrief[]> {
  return request<FarmBrief[]>({ url: '/api/v1/production/farms/all' })
}

/**
 * 团队成员列表（用于「执行人 / 采收人」下拉）。
 *
 * <p>取值必须用**数字主键 `id`**：后端人员外键是 BIGINT 列，业务标识 `memberId`
 * （`DEMO-MEM-001`）传过去会被静默丢掉（PC 端采收登记踩过这个坑）。</p>
 */
export async function listMembers(params: {
  farmId?: string
  pageSize?: number
}): Promise<any[]> {
  const pageSize = params.pageSize ?? 100
  const raw = await request<any>({
    url: '/api/v1/production/members',
    params: { farmId: params.farmId, pageNum: 1, pageSize },
  })
  return normalizePage<any>(raw, 1, pageSize).list
}

/** 分页查询地块 */
export async function listPlots(params: {
  farmId?: string
  plotName?: string
  pageNum?: number
  pageSize?: number
}): Promise<PageResult<any>> {
  const pageNum = params.pageNum ?? 1
  const pageSize = params.pageSize ?? 20
  const raw = await request<any>({
    url: '/api/v1/production/plots',
    params: { farmId: params.farmId, plotName: params.plotName, pageNum, pageSize },
  })
  return normalizePage<any>(raw, pageNum, pageSize)
}

/** 地块详情 */
export function getPlot(plotId: string): Promise<any> {
  return request<any>({ url: `/api/v1/production/plots/${plotId}` })
}

/**
 * 新增地块，返回新地块主键（后端 `POST /plots` 返回 `ApiResponse<String>`）。
 *
 * <p>可写字段以后端 {@code PlotSaveDTO} 为准：地块名称与 farmId 必填；
 * 面积 / 土壤类型 / 灌溉方式 / 作物品种 / 经纬度 / 种植与预计采收日期 / 备注选填。</p>
 */
export function createPlot(payload: Record<string, any>): Promise<string> {
  return request<string>({ url: '/api/v1/production/plots', method: 'POST', data: payload })
}

/**
 * 地块最新土壤记录。
 *
 * <p>没有记录时后端返回 404，这里**吞掉成 null**：页面对"没测过土壤"显示「—」，
 * 而不是把整页打成错误态。</p>
 */
export async function latestSoil(plotId: string): Promise<any | null> {
  try {
    return await request<any>({ url: `/api/v1/production/plots/${plotId}/soil/latest` })
  } catch {
    return null
  }
}

/* ==================== 农事任务 ==================== */

/** 分页查询任务（后端入参是 page/size） */
export async function listTasks(params: {
  farmId?: string
  plotId?: string
  status?: string
  taskName?: string
  pageNum?: number
  pageSize?: number
}): Promise<PageResult<any>> {
  const pageNum = params.pageNum ?? 1
  const pageSize = params.pageSize ?? 20
  const raw = await request<any>({
    url: '/api/v1/production/tasks',
    params: {
      farmId: params.farmId,
      plotId: params.plotId,
      status: params.status,
      taskName: params.taskName,
      page: pageNum,
      size: pageSize,
    },
  })
  return normalizePage<any>(raw, pageNum, pageSize)
}

/** 任务详情 */
export function getTask(taskId: string): Promise<any> {
  return request<any>({ url: `/api/v1/production/tasks/${taskId}` })
}

/** 任务执行记录（时间轴） */
export async function listTaskRecords(taskId: string): Promise<any[]> {
  const raw = await request<any>({
    url: `/api/v1/production/tasks/${taskId}/records`,
    params: { page: 1, size: 50 },
  })
  return normalizePage<any>(raw, 1, 50).list
}

/** 新建任务，返回新任务主键 */
export function createTask(payload: Record<string, any>): Promise<string> {
  return request<string>({ url: '/api/v1/production/tasks', method: 'POST', data: payload })
}

/** 开始执行任务 */
export function startTask(taskId: string): Promise<boolean> {
  return request<boolean>({ url: `/api/v1/production/tasks/${taskId}/start`, method: 'POST' })
}

/** 提交完成任务 */
export function submitTask(taskId: string, payload?: Record<string, any>): Promise<any> {
  return request<any>({
    url: `/api/v1/production/tasks/${taskId}/submit`,
    method: 'POST',
    data: payload ?? {},
  })
}

/** 追加一条执行记录（过程打卡） */
export function addTaskRecord(taskId: string, payload: Record<string, any>): Promise<string> {
  return request<string>({
    url: `/api/v1/production/tasks/${taskId}/records`,
    method: 'POST',
    data: payload,
  })
}

/* ==================== 投入品 ==================== */

/** 分页查询投入品档案 */
export async function listInputs(params: {
  farmId?: string
  keyword?: string
  pageNum?: number
  pageSize?: number
}): Promise<PageResult<any>> {
  const pageNum = params.pageNum ?? 1
  const pageSize = params.pageSize ?? 20
  const raw = await request<any>({
    url: '/api/v1/production/inputs',
    params: { farmId: params.farmId, keyword: params.keyword, pageNum, pageSize },
  })
  return normalizePage<any>(raw, pageNum, pageSize)
}

/** 投入品详情 */
export function getInput(inputId: string): Promise<any> {
  return request<any>({ url: `/api/v1/production/inputs/${inputId}` })
}

/** 投入品库存流水 */
export async function listInputStockFlows(
  inputId: string,
  pageSize = 20,
): Promise<PageResult<any>> {
  const raw = await request<any>({
    url: `/api/v1/production/inputs/${inputId}/stock-flows`,
    params: { pageNum: 1, pageSize },
  })
  return normalizePage<any>(raw, 1, pageSize)
}

/** 分页查询投入品使用记录（按地块 / 任务过滤） */
export async function listInputUsages(params: {
  plotId?: string
  taskId?: string
  pageNum?: number
  pageSize?: number
}): Promise<PageResult<any>> {
  const pageNum = params.pageNum ?? 1
  const pageSize = params.pageSize ?? 50
  const raw = await request<any>({
    url: '/api/v1/production/inputs/usages',
    params: { plotId: params.plotId, taskId: params.taskId, pageNum, pageSize },
  })
  return normalizePage<any>(raw, pageNum, pageSize)
}

/** 登记一条投入品使用记录，返回使用记录主键 */
export function createInputUsage(payload: Record<string, any>): Promise<string> {
  return request<string>({ url: '/api/v1/production/inputs/usages', method: 'POST', data: payload })
}

/* ==================== 采收 / 库存 ==================== */

/** 分页查询采收批次 */
export async function listHarvests(params: {
  farmId?: string
  plotId?: string
  inboundStatus?: number
  pageNum?: number
  pageSize?: number
}): Promise<PageResult<any>> {
  const pageNum = params.pageNum ?? 1
  const pageSize = params.pageSize ?? 20
  const raw = await request<any>({
    url: '/api/v1/production/harvests',
    params: {
      farmId: params.farmId,
      plotId: params.plotId,
      inboundStatus: params.inboundStatus,
      pageNum,
      pageSize,
    },
  })
  return normalizePage<any>(raw, pageNum, pageSize)
}

/** 采收批次详情 */
export function getHarvest(batchId: string): Promise<any> {
  return request<any>({ url: `/api/v1/production/harvests/${batchId}` })
}

/** 新建采收，返回新批次主键 */
export function createHarvest(payload: Record<string, any>): Promise<string> {
  return request<string>({ url: '/api/v1/production/harvests', method: 'POST', data: payload })
}

/** 生成 / 更新批次溯源码 */
export function generateHarvestBatch(
  batchId: string,
  payload?: Record<string, any>,
): Promise<any> {
  return request<any>({
    url: `/api/v1/production/harvests/${batchId}/generate`,
    method: 'POST',
    data: payload ?? {},
  })
}

/**
 * 批次入库（写库存流水）。
 *
 * <p>后端契约：{@code batchId} + {@code quantity}（**不是 qty**）必填且大于 0；
 * {@code warehouseName} 省略时落「主仓库」，{@code unit} 省略时沿用批次单位。</p>
 */
export function inboundHarvest(batchId: string, payload: Record<string, any>): Promise<boolean> {
  return request<boolean>({
    url: '/api/v1/production/harvests/inventory/in',
    method: 'POST',
    data: { batchId, ...payload },
  })
}

/** 分页查询成品库存 */
export async function listInventory(params: {
  keyword?: string
  pageNum?: number
  pageSize?: number
}): Promise<PageResult<any>> {
  const pageNum = params.pageNum ?? 1
  const pageSize = params.pageSize ?? 20
  const raw = await request<any>({
    url: '/api/v1/production/harvests/inventory',
    params: { keyword: params.keyword, pageNum, pageSize },
  })
  return normalizePage<any>(raw, pageNum, pageSize)
}

/* ==================== 溯源 ==================== */

/** 按溯源码扫一次（写入扫码记录并返回码信息） */
export function scanTraceCode(code: string): Promise<any> {
  return request<any>({
    url: '/api/v1/production/trace/scan',
    method: 'POST',
    params: { code },
  })
}

/** 按溯源码查全链路节点 */
export function traceFullChain(code: string): Promise<any[]> {
  return request<any[]>({ url: `/api/v1/production/trace/full-chain/trace/${code}` })
}

/* ==================== 告警 / 消息 ==================== */

/** 分页查询告警 */
export async function listAlerts(params: {
  farmId?: string
  pageNum?: number
  pageSize?: number
}): Promise<PageResult<any>> {
  const pageNum = params.pageNum ?? 1
  const pageSize = params.pageSize ?? 20
  const raw = await request<any>({
    url: '/api/v1/production/alerts',
    params: { farmId: params.farmId, pageNum, pageSize },
  })
  return normalizePage<any>(raw, pageNum, pageSize)
}

/** 告警详情 */
export function getAlert(alertId: string): Promise<any> {
  return request<any>({ url: `/api/v1/production/alerts/${alertId}` })
}

/** 分页查询消息 */
export async function listMessages(params: {
  pageNum?: number
  pageSize?: number
  readFlag?: number
}): Promise<PageResult<any>> {
  const pageNum = params.pageNum ?? 1
  const pageSize = params.pageSize ?? 20
  const raw = await request<any>({
    url: '/api/v1/production/messages',
    params: { pageNum, pageSize, readFlag: params.readFlag },
  })
  return normalizePage<any>(raw, pageNum, pageSize)
}

/** 未读消息数 */
export function unreadMessageCount(): Promise<number> {
  return request<number>({ url: '/api/v1/production/messages/unread-count' })
}

/** 全部消息标为已读（后端 PATCH /messages/read-all，与 PC 端同一方法） */
export function markAllMessagesRead(): Promise<boolean> {
  return request<boolean>({ url: '/api/v1/production/messages/read-all', method: 'PATCH' })
}

/* ==================== AI（后端未接入，如实透出 501） ==================== */

/**
 * AI 病虫害识别。
 *
 * <p>⚠️ 后端当前是 {@code AiNotAvailableController} 的**占位实现**，直接抛 501「未接入」。
 * 这里不做任何本地假数据兜底 —— 页面据错误文案如实展示，避免"看着能用、其实没识别"。</p>
 *
 * @param payload 图片与地块
 * @returns 识别结果（后端接入后才有）
 */
export function pestDetection(payload: Record<string, any>): Promise<any> {
  return request<any>({
    url: '/api/v1/production/ai/pest-detection',
    method: 'POST',
    data: payload,
  })
}
