/**
 * 农资投入品 API（台账 / 出入库 / 使用记录）
 */
import { http } from '@/utils/request'
import type { PageQuery, PageResult } from '@/types'
import type { InputItem, InputStockRecord, InputUsage, InputUsageRecord } from '@/types'

const BASE = '/inputs'

/** 投入品列表查询参数 */
export interface InputListParams extends PageQuery {
  inputName?: string
  category?: number
  status?: number
}

/** 投入品新增 / 编辑入参 */
export type InputPayload = Partial<InputItem>

/** 分页查询投入品台账 */
export function listInputs(params: InputListParams): Promise<PageResult<InputItem>> {
  return http.get<PageResult<InputItem>>(BASE, params)
}

/** 查询投入品详情 */
export function getInput(inputId: string): Promise<InputItem> {
  return http.get<InputItem>(`${BASE}/${inputId}`)
}

/** 新增投入品 */
export function createInput(payload: InputPayload): Promise<string> {
  return http.post<string>(BASE, payload)
}

/** 更新投入品 */
export function updateInput(inputId: string, payload: InputPayload): Promise<InputItem> {
  return http.put<InputItem>(`${BASE}/${inputId}`, payload)
}

/** 删除投入品 */
export function deleteInput(inputId: string): Promise<void> {
  return http.delete<void>(`${BASE}/${inputId}`)
}

/** 分页查询出入库记录 */
export function listInputStock(
  params: PageQuery & { inputId?: string; stockType?: number },
): Promise<PageResult<InputStockRecord>> {
  return http.get<PageResult<InputStockRecord>>(`${BASE}/stock`, params)
}

/** 新增出入库记录 */
export function createInputStock(payload: Partial<InputStockRecord>): Promise<InputStockRecord> {
  return http.post<InputStockRecord>(`${BASE}/stock`, payload)
}

/** 删除出入库记录 */
export function deleteInputStock(recordId: string): Promise<boolean> {
  return http.delete<boolean>(`${BASE}/stock/${recordId}`)
}

/**
 * 分页查询投入品使用记录。
 *
 * `farmId` 为后端 `GET /api/v1/production/inputs/usages` 明确声明的过滤参数
 * （`InputController#pageInputUsage` `@RequestParam(required = false) String farmId`，
 * 且 `InputUsageService#page` 会按 `prod_input_usage.farm_id` 真实加过滤条件），
 * 传了不会被静默丢弃。
 */
export function listInputUsages(
  params: PageQuery & { inputId?: string; plotId?: string; taskId?: string; farmId?: string },
): Promise<PageResult<InputUsage>> {
  return http.get<PageResult<InputUsage>>(`${BASE}/usages`, params)
}

/** 新增投入品使用记录 */
export function createInputUsage(payload: Partial<InputUsage>): Promise<string> {
  return http.post<string>(`${BASE}/usages`, payload)
}

/** 删除投入品使用记录 */
export function deleteInputUsage(usageId: string): Promise<void> {
  return http.delete<void>(`${BASE}/usages/${usageId}`)
}

/* ============================================================================
 * 以下为「农资投入品页面填充」追加内容，纯新增，不改动既有定义。
 * 字段口径对齐后端 InputController / prod_input_* 实体：
 * - 投入品档案 prod_input_info：inputType 为字符串枚举，登记证号字段为 registrationNo
 * - 库存流水 prod_input_stock_flow：flowType 1入库 2领用 3退回 4盘盈 5盘亏 6报损
 * - 使用记录 prod_input_usage：用量字段为 dosage
 * ==========================================================================*/

/** 投入品分类编码（后端 inputType 枚举） */
export type InputTypeCode = 'SEED' | 'FERTILIZER' | 'PESTICIDE' | 'FEED' | 'VET' | 'OTHER'

/** 投入品档案（对齐后端 InputInfoEntity） */
export interface InputInfo {
  /** 投入品 ID */
  inputId: string
  /** 投入品编码（主体内唯一） */
  inputCode?: string
  /** 投入品名称 */
  inputName?: string
  /** 类型 SEED/FERTILIZER/PESTICIDE/FEED/VET/OTHER */
  inputType?: InputTypeCode | string
  /** 规格 */
  spec?: string
  /** 计量单位 */
  unit?: string
  /** 生产厂家 */
  manufacturer?: string
  /** 登记证号 */
  registrationNo?: string
  /** 安全间隔期（天） */
  safetyInterval?: number
  /** 当前库存 */
  stockQty?: number
  /** 库存预警阈值 */
  warnQty?: number
  /**
   * 最近批次效期（yyyy-MM-dd），后端冗余字段
   *
   * 效期本身是批次维度字段（挂在 `prod_input_stock_flow.expire_date`），
   * 投入品实体上没有，故由后端按以下规则冗余计算后随列表返回，
   * 前端据此判定「临期」，无需再逐项拉取流水（避免 N+1 请求）：
   * 1. 优先取该投入品最早的未过期效期
   * 2. 若全部批次均已过期，取最接近今天的那个过期日
   * 3. 无任何流水记录时为 null
   */
  nearestExpireDate?: string | null
  /** 默认供应商 ID */
  supplierId?: string
  /** 状态 1启用 0停用 */
  status?: number
  /** 创建时间 */
  createdAt?: string
  /** 更新时间 */
  updatedAt?: string
}

/** 投入品库存流水（对齐后端 InputStockFlowEntity） */
export interface InputStockFlow {
  /** 流水 ID */
  flowId: string
  /** 投入品 ID */
  inputId?: string
  /** 仓库 ID */
  warehouseId?: string
  /** 流水类型：1入库 2领用 3退回 4盘盈 5盘亏 6报损 */
  flowType?: number
  /** 数量（入库为正、领用为负） */
  qty?: number
  /** 批次号 */
  batchNo?: string
  /** 有效期至 yyyy-MM-dd */
  expireDate?: string
  /** 操作人 */
  operatorId?: string
  /** 关联农事任务 ID */
  relatedTaskId?: string
  /** 备注 */
  remark?: string
  /** 创建时间 */
  createdAt?: string
  /** 更新时间 */
  updatedAt?: string
}

/* 说明：`InputUsageRecord` 已在 '@/types/input' 统一定义并从 '@/types' 导出，
 * 此处不再重复声明，改由上方 type import 引入，避免两份定义静默漂移。 */

/** 投入品列表查询参数（对齐后端 page 接口） */
export interface InputPageParams extends PageQuery {
  /** 名称模糊关键字 */
  keyword?: string
  /** 状态 1启用 0停用 */
  status?: number
}

/** 分页查询投入品档案 */
export function pageInputs(params: InputPageParams): Promise<PageResult<InputInfo>> {
  return http.get<PageResult<InputInfo>>(BASE, params)
}

/** 查询投入品档案详情 */
export function getInputInfo(inputId: string): Promise<InputInfo> {
  return http.get<InputInfo>(`${BASE}/${inputId}`)
}

/** 新增投入品档案，返回新记录主键 */
export function createInputInfo(payload: Partial<InputInfo>): Promise<string> {
  return http.post<string>(BASE, payload)
}

/** 更新投入品档案 */
export function updateInputInfo(
  inputId: string,
  payload: Partial<InputInfo>,
): Promise<InputInfo> {
  return http.put<InputInfo>(`${BASE}/${inputId}`, payload)
}

/** 删除投入品档案 */
export function removeInput(inputId: string): Promise<void> {
  return http.delete<void>(`${BASE}/${inputId}`)
}

/** 分页查询某投入品的库存流水 */
export function pageStockFlows(
  inputId: string,
  params: PageQuery,
): Promise<PageResult<InputStockFlow>> {
  return http.get<PageResult<InputStockFlow>>(`${BASE}/${inputId}/stock-flows`, params)
}

/** 新增库存流水（退回 / 盘盈 / 盘亏 / 报损等非标准作业） */
export function createStockFlow(
  inputId: string,
  payload: Partial<InputStockFlow>,
): Promise<string> {
  return http.post<string>(`${BASE}/${inputId}/stock-flows`, payload)
}

/** 删除库存流水 */
export function removeStockFlow(inputId: string, flowId: string): Promise<void> {
  return http.delete<void>(`${BASE}/${inputId}/stock-flows/${flowId}`)
}

/** 分页查询投入品使用记录 */
export function pageUsages(
  params: PageQuery & { status?: number },
): Promise<PageResult<InputUsageRecord>> {
  return http.get<PageResult<InputUsageRecord>>(`${BASE}/usages`, params)
}

/** 新增投入品使用记录，返回新记录主键 */
export function createUsage(payload: Partial<InputUsageRecord>): Promise<string> {
  return http.post<string>(`${BASE}/usages`, payload)
}

/** 更新投入品使用记录 */
export function updateUsage(
  usageId: string,
  payload: Partial<InputUsageRecord>,
): Promise<InputUsageRecord> {
  return http.put<InputUsageRecord>(`${BASE}/usages/${usageId}`, payload)
}

/** 删除投入品使用记录 */
export function removeUsage(usageId: string): Promise<void> {
  return http.delete<void>(`${BASE}/usages/${usageId}`)
}

/** 入库作业入参（POST /inputs/{inputId}/stock-in） */
export interface StockInParams {
  /** 入库数量，正数 */
  qty: number
  /** 批次号 */
  batchNo?: string
  /** 有效期至 yyyy-MM-dd */
  expireDate?: string
  /** 操作人 */
  operatorId?: string
}

/** 入库：写流水 + 增加库存 */
export function stockIn(inputId: string, params: StockInParams): Promise<InputInfo> {
  return http.post<InputInfo>(`${BASE}/${inputId}/stock-in`, undefined, { params })
}

/** 领用作业入参（POST /inputs/{inputId}/consume） */
export interface ConsumeParams {
  /** 领用数量，正数 */
  qty: number
  /** 关联农事任务 ID */
  relatedTaskId?: string
  /** 操作人 */
  operatorId?: string
}

/** 领用：写流水 + 扣减库存 */
export function consume(inputId: string, params: ConsumeParams): Promise<InputInfo> {
  return http.post<InputInfo>(`${BASE}/${inputId}/consume`, undefined, { params })
}

/** 低库存预警清单 */
export function fetchInputWarning(): Promise<InputInfo[]> {
  return http.get<InputInfo[]>(`${BASE}/warning`)
}

/** 库存总览（低库存优先） */
export function fetchInputStockOverview(): Promise<InputInfo[]> {
  return http.get<InputInfo[]>(`${BASE}/stock`)
}

/** 任务关联的投入品使用明细 */
export function fetchUsagesByTask(taskId: string): Promise<InputUsageRecord[]> {
  return http.get<InputUsageRecord[]>(`${BASE}/usages/by-task`, { taskId })
}
