/**
 * 采收与库存管理 API
 *
 * <p><b>本文件曾带一层"服务端不可用时回退本地演示数据"的兜底</b>（DEMO_BATCHES /
 * DEMO_INVENTORY / DEMO_FLOWS / DEMO_PLANS 共约 600 行 + withDemoFallback）。
 * 后端已把 /harvests、/harvests/{id}、/harvests/plan、/harvests/{id}/flows、
 * /harvests/inventory 全部实现并切流，兜底就成了"接口坏了反而看不出坏"的遮挡物 ——
 * 于 2026-10-15 整体删除。现在**接口失败就是失败**：查询函数返回真实结果或抛错，
 * 页面按 isError 如实提示，不再有"本地示例数据"横幅。</p>
 */
import { asApiRequestError, http, httpStatusOf } from '@/utils/request'
import type { BizId, PageQuery, PageResult } from '@/types'
import type { HarvestBatch, InventoryFlow, InventoryRecord } from '@/types'

const BASE = '/harvests'

/** 采收批次列表查询参数 */
export interface HarvestListParams extends PageQuery {
  farmId?: string
  plotId?: string
  batchNo?: string
  grade?: string
  status?: number
  startDate?: string
  endDate?: string
}

/** 分页查询采收批次 */
export function listHarvests(params: HarvestListParams): Promise<PageResult<HarvestBatch>> {
  return http.get<PageResult<HarvestBatch>>(BASE, params)
}

/** 查询采收批次详情 */
export function getHarvest(batchId: string): Promise<HarvestBatch> {
  return http.get<HarvestBatch>(`${BASE}/${batchId}`)
}

/** 新增采收批次 */
export function createHarvest(payload: Partial<HarvestBatch>): Promise<string> {
  return http.post<string>(BASE, payload)
}

/** 更新采收批次 */
export function updateHarvest(
  batchId: string,
  payload: Partial<HarvestBatch>,
): Promise<HarvestBatch> {
  return http.put<HarvestBatch>(`${BASE}/${batchId}`, payload)
}

/** 删除采收批次 */
export function deleteHarvest(batchId: string): Promise<void> {
  return http.delete<void>(`${BASE}/${batchId}`)
}

/**
 * 地块采收记录（后端 `GET /harvests/plan` 的真实返回结构）。
 *
 * ⚠️ 端点名带 plan，但语义是「**按地块聚合已发生的采收记录**」，不是「待执行的采收计划」；
 * 库里也没有 prod_harvest_plan 表。字段严格对齐后端返回，缺的字段前端显示「—」，不编造。
 */
export interface PlotHarvestRecord {
  /** 记录 ID */
  recordId?: string
  /** 地块 ID */
  plotId?: string
  /** 关联计划 ID */
  planId?: string
  /** 作物 ID */
  cropId?: string
  /** 作物名称 */
  cropName?: string
  /** 作物品种 */
  cropVariety?: string
  /** 采收日期 */
  harvestDate?: string
  /** 采收数量 */
  quantity?: number
  /** 计量单位 */
  unit?: string
  /** 质量等级 */
  grade?: string
  /** 采收人 ID */
  operatorId?: string
  /** 天气 */
  weather?: string
  /** 备注 */
  remark?: string
  /** 状态：1 有效 0 作废 */
  status?: number
  /** 登记时间 */
  createdAt?: string
}

/** 地块采收记录查询参数（端点只认 plotId，不接受 farmId） */
export interface PlotHarvestQueryParams extends PageQuery {
  /** 地块 ID；不传表示查全部 */
  plotId?: string
}

/**
 * 查询地块采收记录。
 *
 * 端点只接受 plotId 一个业务参数，传 farmId 会被 Spring 静默忽略
 * （历史 bug：plotId 恒空 → 后端拼 WHERE plot_id='' → 恒 0 条）。
 * 这里不做任何本地兜底：没有数据就是没有数据。
 */
export async function queryHarvestPlans(
  params: PlotHarvestQueryParams,
): Promise<PageResult<PlotHarvestRecord>> {
  const result = await http.get<PageResult<PlotHarvestRecord> | PlotHarvestRecord[]>(
    `${BASE}/plan`,
    params,
    { silent: true },
  )
  // 后端当前返回分页结构；早先返回裸数组，这里对两种形状都归一化，
  // 免得形状一变页面就静默空白
  if (Array.isArray(result)) {
    const pageSize = params.pageSize ?? result.length ?? 10
    return {
      list: result,
      total: result.length,
      pageNum: params.pageNum ?? 1,
      pageSize: pageSize || 10,
      pages: 1,
    }
  }
  return result
}

/** 分页查询库存记录 */
export function listInventory(
  params: PageQuery & { batchNo?: string; warehouseName?: string },
): Promise<PageResult<InventoryRecord>> {
  return http.get<PageResult<InventoryRecord>>(`${BASE}/inventory`, params)
}

/** 查询某批次的库存流水（真端点是 /harvests/{batchId}/flows） */
export function listInventoryFlows(
  batchId: string,
  params: PageQuery,
): Promise<PageResult<InventoryFlow>> {
  return http.get<PageResult<InventoryFlow>>(`${BASE}/${batchId}/flows`, params)
}

/**
 * 库存出库。
 *
 * 后端契约为 `POST /harvests/inventory/{batchId}/out`，参数走 **query**
 * （qty / operatorId / relatedOrderNo），不是 JSON 体。
 */
export function stockOut(
  batchId: string,
  payload: { quantity: number; orderNo?: string; remark?: string },
): Promise<boolean> {
  return http
    .post<InventoryFlow>(`${BASE}/inventory/${batchId}/out`, undefined, {
      params: {
        qty: payload.quantity,
        relatedOrderNo: payload.orderNo,
      },
    })
    .then((flow) => Boolean(flow))
}

/**
 * 冻结库存。
 *
 * 后端契约 `POST /harvests/inventory/{batchId}/freeze`（无请求体，返回冻结后的批次）。
 * 后端当前没有解冻端点，解冻不在此处实现。
 */
export function freezeInventory(batchId: string): Promise<boolean> {
  return http
    .post<HarvestBatch>(`${BASE}/inventory/${batchId}/freeze`)
    .then((batch) => Boolean(batch))
}

/**
 * 生成采收批次（HARV-03）。
 *
 * 后端成功后应发布领域事件 `prod.batch.harvested`（载荷 batchNo / plotId / cropId /
 * quantity / unit / harvestDate，见 PRD 11.3）。当前后端**没有事件总线**，该联动作缺未做。
 */
export function generateHarvestBatch(
  batchId: BizId,
  payload: { traceCode?: string; warehouseName?: string } = {},
): Promise<HarvestBatch> {
  return http.post<HarvestBatch>(`${BASE}/${batchId}/generate`, payload)
}

/** 库存入库入参 */
export interface StockInPayload {
  /** 关联批次 ID */
  batchId: BizId
  /** 仓库名称 */
  warehouseName: string
  /** 入库数量 */
  quantity: number
  /** 计量单位 */
  unit?: string
  /** 库位编号 */
  locationCode?: string
  /** 保质期至 */
  expireDate?: string
  /** 操作人 */
  operatorName?: string
  /** 备注 */
  remark?: string
}

/** 成品入库（HARV-05） */
export function stockInInventory(payload: StockInPayload): Promise<boolean> {
  return http.post<boolean>(`${BASE}/inventory/in`, payload)
}

/** 新增 / 编辑库存记录入参 */
export type InventoryPayload = Partial<InventoryRecord>

/** 新增库存记录 */
export function createInventory(payload: InventoryPayload): Promise<InventoryRecord> {
  return http.post<InventoryRecord>(`${BASE}/inventory`, payload)
}

/** 查询库存记录详情 */
export function getInventory(inventoryId: BizId): Promise<InventoryRecord> {
  return http.get<InventoryRecord>(`${BASE}/inventory/${inventoryId}`)
}

/** 更新库存记录 */
export function updateInventory(
  inventoryId: BizId,
  payload: InventoryPayload,
): Promise<InventoryRecord> {
  return http.put<InventoryRecord>(`${BASE}/inventory/${inventoryId}`, payload)
}

/** 删除库存记录 */
export function deleteInventory(inventoryId: BizId): Promise<boolean> {
  return http.delete<boolean>(`${BASE}/inventory/${inventoryId}`)
}

/** 损耗登记入参（HARV-09） */
export interface LossPayload {
  /** 批次 ID */
  batchId: BizId
  /** 损耗数量 */
  quantity: number
  /** 损耗原因 */
  reason: string
  /** 操作人 */
  operatorName?: string
  /** 备注 */
  remark?: string
}

/** 损耗登记（出库型流水 flowType=4） */
export function registerInventoryLoss(payload: LossPayload): Promise<boolean> {
  return http.post<boolean>(`${BASE}/inventory/${payload.batchId}/loss`, payload)
}

/** 库存调拨入参 */
export interface TransferPayload {
  /** 批次 ID */
  batchId: BizId
  /** 目标仓库 */
  targetWarehouse: string
  /** 调拨数量 */
  quantity: number
  /** 目标库位 */
  locationCode?: string
  /** 备注 */
  remark?: string
}

/** 库存调拨（原型 P18 调拨按钮） */
export function transferInventory(payload: TransferPayload): Promise<boolean> {
  return http.post<boolean>(`${BASE}/inventory/${payload.batchId}/transfer`, payload)
}

/*
 * 「采收计划」的创建 / 成熟度评估 / 人力安排三个写操作已整体移除（2026-10-09）。
 * 原因：后端 /plan 只有查询映射，也没有 /plan/{id}/maturity、/plan/{id}/labor，
 * 库里也不存在 prod_harvest_plan 表 —— 留着按钮就是"点了必报错"的假功能。
 */

/** 采收批次列表扩展查询参数 */
export interface HarvestQueryParams extends HarvestListParams {
  /** 作物 ID */
  cropId?: string
  /** 入库状态：0 待入库 1 已入库 2 已出库 */
  inboundStatus?: number
}

/** 库存列表扩展查询参数 */
export interface InventoryQueryParams extends PageQuery {
  /** 仓库名称 */
  warehouseName?: string
  /** 品类 */
  category?: string
  /** 库存健康状态 */
  healthStatus?: string
  /** 批次号 */
  batchNo?: string
  /** 品名关键字 */
  keyword?: string
}

/* ============================================================
 * 查询（真实接口；失败由页面渲染错误态，不再回退本地演示数据）
 * ========================================================== */

/** 采收批次查询 */
export function queryHarvests(params: HarvestQueryParams): Promise<PageResult<HarvestBatch>> {
  return http.get<PageResult<HarvestBatch>>(BASE, params, { silent: true })
}

/** 采收批次详情查询 */
export function queryHarvest(batchId: BizId): Promise<HarvestBatch> {
  return http.get<HarvestBatch>(`${BASE}/${batchId}`, undefined, { silent: true })
}

/** 库存记录列表查询 */
export function queryInventory(params: InventoryQueryParams): Promise<PageResult<InventoryRecord>> {
  return http.get<PageResult<InventoryRecord>>(`${BASE}/inventory`, params, { silent: true })
}

/** 库存记录详情查询 */
export function queryInventoryRecord(inventoryId: BizId): Promise<InventoryRecord> {
  return http.get<InventoryRecord>(`${BASE}/inventory/${inventoryId}`, undefined, { silent: true })
}

/**
 * 出入库流水查询。
 *
 * ⚠️ 真端点是 `/harvests/{batchId}/flows`，**不是** `/harvests/inventory/{batchId}/flows`。
 * 写错的那个路径实测返回 HTTP 200 + 业务码 500 —— 而"服务端明确拒绝"不会静默降级，
 * 于是库存详情页的出入库记录表现为一张空表且没有任何提示（比兜底更难发现）。
 */
export function queryInventoryFlows(
  batchId: BizId,
  params: PageQuery,
): Promise<PageResult<InventoryFlow>> {
  return http.get<PageResult<InventoryFlow>>(`${BASE}/${batchId}/flows`, params, { silent: true })
}

/* ============================================================
 * 写操作：失败一律抛错，绝不返回"假成功"
 * ========================================================== */

/** 写操作失败原因分类 */
export type WriteFailureKind =
  /** 服务端不可达（网络异常 / 服务未启动） */
  | 'unreachable'
  /** 服务端没有提供该操作端点 */
  | 'unsupported'
  /** 服务端异常（5xx） */
  | 'server-error'
  /** 服务端收到请求但明确拒绝（业务码非 0） */
  | 'rejected'
  /** 其他未知原因 */
  | 'unknown'

/**
 * 对写操作失败原因分类，供上层决定提示文案。
 *
 * @param error catch 到的未知错误
 * @returns 失败分类
 */
export function classifyWriteFailure(error: unknown): WriteFailureKind {
  const apiError = asApiRequestError(error)
  if (apiError) {
    return apiError.bizCode === 404 || apiError.bizCode === 405 ? 'unsupported' : 'rejected'
  }
  const status = httpStatusOf(error)
  if (status === 0) return 'unreachable'
  if (status === 404 || status === 405) return 'unsupported'
  if (status >= 500) return 'server-error'
  return status === 0 ? 'unreachable' : 'unknown'
}

/**
 * 把写操作失败原因转成可直接展示给用户的中文文案。
 *
 * 所有文案都以「未写入服务端」收尾，避免出现「失败却看起来成功」的歧义。
 *
 * @param action 动作名称，如「入库」「损耗登记」
 * @param error catch 到的未知错误
 * @returns 失败提示文案
 */
export function describeWriteFailure(action: string, error: unknown): string {
  const reason = error instanceof Error && error.message ? error.message : ''
  switch (classifyWriteFailure(error)) {
    case 'unreachable':
      return `${action}失败：无法连接服务端（网络异常或服务未启动），本次操作未写入服务端`
    case 'unsupported':
      return `${action}失败：服务端暂无该操作接口，本次操作未写入服务端`
    case 'server-error':
      return `${action}失败：服务端处理异常${reason ? `（${reason}）` : ''}，本次操作未写入服务端`
    case 'rejected':
      return `${action}失败：${reason || '服务端拒绝了该请求'}，本次操作未写入服务端`
    default:
      return `${action}失败：${reason || '未知原因'}，本次操作未写入服务端`
  }
}

/**
 * 写操作统一失败出口：抛出带可读原因的 Error，绝不返回「假成功」。
 *
 * @param action 动作名称
 * @param error 原始错误
 * @returns 永不返回
 */
function throwWriteFailure(action: string, error: unknown): never {
  throw new Error(describeWriteFailure(action, error))
}

/**
 * 采收登记结果。
 *
 * 批次创建是主流程，溯源码生成是紧随其后的附加步骤；
 * 两者结果必须分开表达，避免「批次已落库却提示失败」或「溯源码没生成却提示成功」。
 */
export interface SubmitHarvestResult {
  /** 已在服务端创建的采收批次 */
  batch: HarvestBatch
  /** 非空表示批次已写入服务端，但后续步骤（溯源码生成）未完成，需要显式提示 */
  warning?: string
}

/**
 * 提交采收登记：新建批次后自动生成批次（HARV-02 + HARV-03）。
 *
 * @param payload 采收登记表单数据
 * @returns 服务端创建的采收批次，以及可能的附加告警
 */
export async function submitHarvest(
  payload: Partial<HarvestBatch>,
): Promise<SubmitHarvestResult> {
  let batchId = ''
  try {
    // 后端 POST /harvests 只返回**新批次主键**（ApiResponse<String>），
    // 需要按需触发溯源码生成后再回查完整实体，不能直接把主键当实体用。
    batchId = await createHarvest(payload)
  } catch (error) {
    throwWriteFailure('采收登记', error)
  }
  if (!batchId) {
    throw new Error('采收登记失败：服务端未返回新批次主键，本次操作未写入服务端')
  }

  let batch: HarvestBatch
  try {
    batch = await getHarvest(batchId)
  } catch (error) {
    throw new Error(
      `采收批次 ${batchId} 已写入服务端，但详情回查失败：${describeWriteFailure('采收登记', error)}`,
    )
  }

  let warning: string | undefined
  try {
    await generateHarvestBatch(batchId, {
      traceCode: payload.traceCode,
      warehouseName: payload.warehouseName,
    })
  } catch (error) {
    warning = `批次 ${batch.batchNo} 已写入服务端，但溯源码生成未完成：${describeWriteFailure('溯源码生成', error)}`
  }
  return { batch, warning }
}

/**
 * 批次入库：生成批次并写入库存流水（HARV-03 + HARV-05）。
 *
 * @param batchId 批次 ID
 * @param payload 入库信息
 * @returns 服务端确认入库成功时返回 true
 */
export async function inboundHarvest(
  batchId: BizId,
  payload: { warehouseName?: string; quantity?: number } = {},
): Promise<boolean> {
  try {
    await generateHarvestBatch(batchId, { warehouseName: payload.warehouseName })
  } catch (error) {
    throwWriteFailure('批次入库（生成批次）', error)
  }
  try {
    return await stockInInventory({
      batchId,
      warehouseName: payload.warehouseName ?? '主仓库',
      quantity: payload.quantity ?? 0,
    })
  } catch (error) {
    throwWriteFailure('批次入库', error)
  }
}

/**
 * 库存出库（HARV-06）。
 *
 * @param batchId 批次 ID
 * @param payload 出库信息
 * @returns 服务端确认出库成功时返回 true
 */
export async function outboundInventory(
  batchId: BizId,
  payload: {
    quantity: number
    orderNo?: string
    remark?: string
    operatorName?: string
  },
): Promise<boolean> {
  try {
    return await stockOut(String(batchId), payload)
  } catch (error) {
    throwWriteFailure('出库', error)
  }
}

/**
 * 库存入库（补货 / 追加入库）。
 *
 * @param batchId 批次 ID
 * @param payload 入库信息
 * @returns 服务端确认入库成功时返回 true
 */
export async function inboundInventory(
  batchId: BizId,
  payload: {
    quantity: number
    warehouseName?: string
    remark?: string
    operatorName?: string
  },
): Promise<boolean> {
  try {
    return await stockInInventory({
      batchId,
      warehouseName: payload.warehouseName ?? '主仓库',
      quantity: payload.quantity,
      remark: payload.remark,
      operatorName: payload.operatorName,
    })
  } catch (error) {
    throwWriteFailure('入库', error)
  }
}

/**
 * 损耗登记（HARV-09）。
 *
 * @param payload 损耗信息
 * @returns 服务端确认登记成功时返回 true
 */
export async function registerLoss(payload: LossPayload): Promise<boolean> {
  try {
    return await registerInventoryLoss(payload)
  } catch (error) {
    throwWriteFailure('损耗登记', error)
  }
}

/**
 * 冻结 / 解冻库存。
 *
 * 冻结走真实接口 POST /harvests/inventory/{batchId}/freeze。
 * 后端当前**没有解冻端点**，因此解冻不做本地假动作，直接明确失败，
 * 避免页面显示「已解冻」而服务端库存仍处冻结状态。
 *
 * @param batchId 批次 ID
 * @param frozen true 冻结 / false 解冻
 * @returns 服务端确认操作成功时返回 true
 */
export async function toggleInventoryFreeze(batchId: BizId, frozen: boolean): Promise<boolean> {
  if (!frozen) {
    throw new Error(
      '解冻失败：服务端暂未提供解冻接口，本次操作未写入服务端（请联系管理员开通该能力）',
    )
  }
  try {
    return await freezeInventory(String(batchId))
  } catch (error) {
    throwWriteFailure('冻结', error)
  }
}

/**
 * 库存调拨。
 *
 * @param payload 调拨信息
 * @returns 服务端确认调拨成功时返回 true
 */
export async function transferInventoryRecord(payload: TransferPayload): Promise<boolean> {
  try {
    return await transferInventory(payload)
  } catch (error) {
    throwWriteFailure('调拨', error)
  }
}

/**
 * 新增库存记录（原型 P17）。
 *
 * @param payload 库存表单数据
 * @returns 服务端新建的库存记录
 */
export async function submitInventory(payload: InventoryPayload): Promise<InventoryRecord> {
  try {
    return await createInventory(payload)
  } catch (error) {
    throwWriteFailure('新增库存', error)
  }
}
