/**
 * 采收与库存管理 API
 */
import { asApiRequestError, http, httpStatusOf } from '@/utils/request'
import type { BizId, PageQuery, PageResult } from '@/types'
import type { HarvestBatch, HarvestPlan, InventoryFlow, InventoryRecord } from '@/types'

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

/** 分页查询采收计划 */
export function listHarvestPlans(
  params: PageQuery & {
    farmId?: string
    plotId?: string
    status?: number
    planHarvestDate?: string
  },
): Promise<PageResult<HarvestPlan>> {
  return http.get<PageResult<HarvestPlan>>(`${BASE}/plan`, params)
}

/** 查询采收计划详情 */
export function getHarvestPlan(planId: string): Promise<HarvestPlan> {
  return http.get<HarvestPlan>(`${BASE}/plan/${planId}`)
}

/** 新增采收计划 */
export function createHarvestPlan(payload: Partial<HarvestPlan>): Promise<HarvestPlan> {
  return http.post<HarvestPlan>(`${BASE}/plan`, payload)
}

/** 更新采收计划 */
export function updateHarvestPlan(
  planId: string,
  payload: Partial<HarvestPlan>,
): Promise<HarvestPlan> {
  return http.put<HarvestPlan>(`${BASE}/plan/${planId}`, payload)
}

/** 删除采收计划 */
export function deleteHarvestPlan(planId: string): Promise<boolean> {
  return http.delete<boolean>(`${BASE}/plan/${planId}`)
}

/** 分页查询库存记录 */
export function listInventory(
  params: PageQuery & { batchNo?: string; warehouseName?: string },
): Promise<PageResult<InventoryRecord>> {
  return http.get<PageResult<InventoryRecord>>(
    `${BASE}/inventory`,
    params,
  )
}

/** 查询库存流水 */
export function listInventoryFlows(
  batchId: string,
  params: PageQuery,
): Promise<PageResult<InventoryFlow>> {
  return http.get<PageResult<InventoryFlow>>(
    `${BASE}/inventory/${batchId}/flows`,
    params,
  )
}

/**
 * 库存出库。
 *
 * 后端契约为 `POST /harvests/inventory/{batchId}/out`，参数走 **query**
 * （qty / operatorId / relatedOrderNo），不是 JSON 体。
 * 备注（remark）后端无对应字段，不做本地编造，直接不传。
 *
 * @param batchId 批次 ID
 * @param payload 出库信息
 * @returns 服务端返回出库流水时视为成功
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
 * 后端契约为 `POST /harvests/inventory/{batchId}/freeze`（无请求体，返回冻结后的批次）。
 * 后端当前没有解冻端点，解冻不在此处实现。
 *
 * @param batchId 批次 ID
 * @returns 服务端返回批次实体时视为成功
 */
export function freezeInventory(batchId: string): Promise<boolean> {
  return http
    .post<HarvestBatch>(`${BASE}/inventory/${batchId}/freeze`)
    .then((batch) => Boolean(batch))
}

/* -------------------------------------------------------------------------- */
/* 以下为「采收与库存」页面专用扩展：业务动作接口 + 内置演示数据源兜底            */
/* -------------------------------------------------------------------------- */

/**
 * 生成采收批次（HARV-03）。
 *
 * 后端成功后发布领域事件 `prod.batch.harvested`
 * （载荷 batchNo / plotId / cropId / quantity / unit / harvestDate，见 PRD 11.3）。
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

/** 成熟度评估入参（PRD 6.1 #31） */
export interface MaturityPayload {
  /** 成熟度评分 0-100 */
  maturityScore: number
  /** 成熟度分级 */
  maturityLevel?: string
  /** 评估人 */
  maturityOperator?: string
  /** 评估说明 */
  remark?: string
}

/** 提交成熟度评估 */
export function updatePlanMaturity(planId: BizId, payload: MaturityPayload): Promise<boolean> {
  return http.patch<boolean>(`${BASE}/plan/${planId}/maturity`, payload)
}

/** 人力安排入参（PRD 6.1 #31） */
export interface LaborPayload {
  /** 人员 ID 列表 */
  laborIds: string[]
  /** 人员姓名，逗号分隔 */
  laborNames: string
  /** 计划人力 */
  laborCount?: number
  /** 机具安排 */
  toolPlan?: string
}

/** 提交人力安排 */
export function assignPlanLabor(planId: BizId, payload: LaborPayload): Promise<boolean> {
  return http.patch<boolean>(`${BASE}/plan/${planId}/labor`, payload)
}

/*
 * 「采收批次统计概览」`fetchHarvestOverview` / `HarvestOverview` 已删除（2026-10-10）。
 *
 * 判定依据（端点不存在 **且** 无调用方 → 删；端点不存在 **但** 有调用方 → 提后端单）：
 * - 端点实测 404：`GET /api/v1/production/harvests/overview?farmId=DEMO-FARM-001`
 *   → `{"code":404,"message":"资源不存在"}`，与 `/harvests/zzz-not-exist` 返回完全一致；
 *   `HarvestController` 里也没有任何 `/overview` 映射（后端 overview 都在 admin/analytics 下）。
 * - 调用方实测 0 处：全仓 grep `fetchHarvestOverview|HarvestOverview` 只命中这两个声明本身。
 *
 * 因此它是纯死代码。留着只会让人误以为「采收概览有接口，只是暂时没调」。
 */

/**
 * 数据来源标记：`demo` 为 true 表示结果来自内置演示数据（后端接口未就绪或异常）。
 *
 * `demoReason` 记的是**本次降级的实测原因**（HTTP 状态 / 连不上服务端），
 * 由 {@link withDemoFallback} 在回退那一刻写入，页面必须把它原样显示给用户。
 *
 * 为什么必须带原因：横幅只写「接口不可用」会被理解成「后端接口建设中」，
 * 而真实原因可能是前端路径写错、端点不存在、服务端 5xx 或根本连不上——
 * 一句笼统文案会把排障方向带偏，所以这里只陈述实测现象，不做推断。
 */
export interface DemoFlag {
  /** 是否为演示数据 */
  demo: boolean
  /** 本次降级的真实原因（实测）；页面应原样展示 */
  demoReason?: string
}

/** 带来源标记的分页结果 */
export interface DemoPageResult<T> extends PageResult<T>, DemoFlag {}

/** 带来源标记的单对象结果 */
export interface DemoResult<T> extends DemoFlag {
  /** 业务数据 */
  data: T
}

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

/** 演示数据：采收批次（取自原型 P13 表格） */
const DEMO_BATCHES: HarvestBatch[] = [
  {
    batchId: 'HB001',
    batchNo: 'H20260601',
    plotId: 'PLOT01',
    plotName: '1号田',
    planId: 'PLAN01',
    cropId: 'CROP01',
    cropName: '番茄',
    cropVariety: '中杂9号',
    harvestDate: '2026-06-01',
    quantity: 1250,
    unit: 'kg',
    grade: 'A',
    status: 1,
    traceGenerated: false,
    createdAt: '2026-06-01 15:00:00',
    farmId: 'FARM01',
    farmName: '阳光有机农场',
    inboundStatus: 0,
    harvestArea: 2,
    appearance: '优',
    expectedQuantity: 5000,
    perMuYield: 625,
    operatorId: 'M002',
    operatorName: '李四',
    relatedTaskId: 'TASK20260601',
    relatedTaskName: 'T20260601-番茄采收',
  },
  {
    batchId: 'HB002',
    batchNo: 'H20260528',
    plotId: 'PLOT02',
    plotName: '2号田',
    planId: 'PLAN02',
    cropId: 'CROP02',
    cropName: '黄瓜',
    cropVariety: '津春4号',
    harvestDate: '2026-05-28',
    quantity: 850,
    unit: 'kg',
    grade: 'B',
    status: 1,
    traceGenerated: true,
    createdAt: '2026-05-28 16:20:00',
    farmId: 'FARM01',
    farmName: '阳光有机农场',
    inboundStatus: 1,
    harvestArea: 1.5,
    appearance: '良',
    expectedQuantity: 1500,
    perMuYield: 567,
    operatorId: 'M001',
    operatorName: '张三',
    inventoryId: 'INV002',
    warehouseName: '冷藏库A',
    traceCode: 'AG010102202605280001',
  },
  {
    batchId: 'HB003',
    batchNo: 'H20260525',
    plotId: 'PLOT03',
    plotName: '3号田',
    planId: 'PLAN03',
    cropId: 'CROP03',
    cropName: '辣椒',
    cropVariety: '湘研15号',
    harvestDate: '2026-05-25',
    quantity: 620,
    unit: 'kg',
    grade: 'A',
    status: 1,
    traceGenerated: true,
    createdAt: '2026-05-25 11:05:00',
    farmId: 'FARM01',
    farmName: '阳光有机农场',
    inboundStatus: 1,
    harvestArea: 1,
    appearance: '优',
    expectedQuantity: 1200,
    perMuYield: 620,
    operatorId: 'M003',
    operatorName: '王五',
    inventoryId: 'INV003',
    warehouseName: '冷藏库B',
    traceCode: 'AG010103202605250001',
  },
  {
    batchId: 'HB004',
    batchNo: 'H20260522',
    plotId: 'PLOT05',
    plotName: '5号田',
    planId: 'PLAN05',
    cropId: 'CROP05',
    cropName: '白菜',
    cropVariety: '京秋3号',
    harvestDate: '2026-05-22',
    quantity: 2100,
    unit: 'kg',
    grade: 'B',
    status: 2,
    traceGenerated: true,
    createdAt: '2026-05-22 09:30:00',
    farmId: 'FARM01',
    farmName: '阳光有机农场',
    inboundStatus: 2,
    harvestArea: 3,
    appearance: '良',
    expectedQuantity: 2500,
    perMuYield: 700,
    operatorId: 'M001',
    operatorName: '张三',
    inventoryId: 'INV004',
    warehouseName: '冷藏库A',
    traceCode: 'AG010105202605220001',
  },
  {
    batchId: 'HB005',
    batchNo: 'H20260520',
    plotId: 'PLOT04',
    plotName: '4号田',
    planId: 'PLAN04',
    cropId: 'CROP04',
    cropName: '茄子',
    cropVariety: '紫长茄',
    harvestDate: '2026-05-20',
    quantity: 1800,
    unit: 'kg',
    grade: 'C',
    status: 2,
    traceGenerated: true,
    createdAt: '2026-05-20 10:15:00',
    farmId: 'FARM01',
    farmName: '阳光有机农场',
    inboundStatus: 2,
    harvestArea: 2.5,
    appearance: '中',
    expectedQuantity: 2000,
    perMuYield: 720,
    operatorId: 'M003',
    operatorName: '王五',
    inventoryId: 'INV005',
    warehouseName: '主仓库',
    traceCode: 'AG010104202605200001',
  },
  {
    batchId: 'HB006',
    batchNo: 'H20260518',
    plotId: 'PLOT01',
    plotName: '1号田',
    planId: 'PLAN01',
    cropId: 'CROP01',
    cropName: '番茄',
    cropVariety: '中杂9号',
    harvestDate: '2026-05-18',
    quantity: 920,
    unit: 'kg',
    grade: 'A',
    status: 1,
    traceGenerated: true,
    createdAt: '2026-05-18 17:40:00',
    farmId: 'FARM01',
    farmName: '阳光有机农场',
    inboundStatus: 1,
    harvestArea: 1.5,
    appearance: '优',
    expectedQuantity: 1500,
    perMuYield: 613,
    operatorId: 'M002',
    operatorName: '李四',
    inventoryId: 'INV001',
    warehouseName: '冷藏库A',
    traceCode: 'AG010101202605180001',
  },
  {
    batchId: 'HB007',
    batchNo: 'H20260515',
    plotId: 'PLOT01',
    plotName: '1号田',
    planId: 'PLAN01',
    cropId: 'CROP01',
    cropName: '番茄',
    cropVariety: '中杂9号',
    harvestDate: '2026-05-15',
    quantity: 760,
    unit: 'kg',
    grade: 'B',
    status: 4,
    traceGenerated: true,
    createdAt: '2026-05-15 14:00:00',
    farmId: 'FARM01',
    farmName: '阳光有机农场',
    inboundStatus: 1,
    harvestArea: 1.2,
    appearance: '良',
    expectedQuantity: 1200,
    perMuYield: 633,
    operatorId: 'M001',
    operatorName: '张三',
    warehouseName: '冷藏库B',
    traceCode: 'AG010101202605150001',
  },
  {
    batchId: 'HB008',
    batchNo: 'H20260510',
    plotId: 'PLOT02',
    plotName: '2号田',
    planId: 'PLAN02',
    cropId: 'CROP02',
    cropName: '黄瓜',
    cropVariety: '津春4号',
    harvestDate: '2026-05-10',
    quantity: 640,
    unit: 'kg',
    grade: 'reject',
    status: 5,
    traceGenerated: true,
    createdAt: '2026-05-10 08:50:00',
    farmId: 'FARM01',
    farmName: '阳光有机农场',
    inboundStatus: 2,
    harvestArea: 1,
    appearance: '差',
    expectedQuantity: 900,
    perMuYield: 640,
    operatorId: 'M003',
    operatorName: '王五',
    warehouseName: '主仓库',
    traceCode: 'AG010102202605100001',
  },
]

/** 演示数据：采收计划（PRD 6.1 #31） */
const DEMO_PLANS: HarvestPlan[] = [
  {
    planId: 'HP001',
    planNo: 'HP20260610',
    plotId: 'PLOT01',
    plotName: '1号田',
    cropId: 'CROP01',
    cropName: '番茄',
    cropVariety: '中杂9号',
    planHarvestDate: '2026-06-10',
    expectedQuantity: 3000,
    unit: 'kg',
    managerId: 'M002',
    managerName: '李四',
    status: 2,
    createdAt: '2026-05-20 09:00:00',
    farmId: 'FARM01',
    farmName: '阳光有机农场',
    maturityScore: 85,
    maturityLevel: '适采',
    maturityOperator: '李四',
    maturityAt: '2026-06-01 09:00:00',
    laborCount: 6,
    laborNames: '张三,李四,王五',
    laborIds: ['M001', 'M002', 'M003'],
    toolPlan: '采收筐 20 个、电动转运车 2 台',
  },
  {
    planId: 'HP002',
    planNo: 'HP20260605',
    plotId: 'PLOT02',
    plotName: '2号田',
    cropId: 'CROP02',
    cropName: '黄瓜',
    cropVariety: '津春4号',
    planHarvestDate: '2026-06-05',
    expectedQuantity: 1500,
    unit: 'kg',
    managerId: 'M001',
    managerName: '张三',
    status: 1,
    createdAt: '2026-05-22 10:00:00',
    farmId: 'FARM01',
    farmName: '阳光有机农场',
    maturityScore: 72,
    maturityLevel: '初熟',
    maturityOperator: '张三',
    maturityAt: '2026-05-30 09:00:00',
    laborCount: 4,
    laborNames: '王五',
    laborIds: ['M003'],
    toolPlan: '采收筐 10 个',
  },
  {
    planId: 'HP003',
    planNo: 'HP20260618',
    plotId: 'PLOT03',
    plotName: '3号田',
    cropId: 'CROP03',
    cropName: '辣椒',
    cropVariety: '湘研15号',
    planHarvestDate: '2026-06-18',
    expectedQuantity: 1200,
    unit: 'kg',
    managerId: 'M003',
    managerName: '王五',
    status: 1,
    createdAt: '2026-05-25 11:00:00',
    farmId: 'FARM01',
    farmName: '阳光有机农场',
    maturityScore: 90,
    maturityLevel: '适采',
    laborCount: 5,
    laborNames: '',
    laborIds: [],
  },
  {
    planId: 'HP004',
    planNo: 'HP20260530',
    plotId: 'PLOT05',
    plotName: '5号田',
    cropId: 'CROP05',
    cropName: '白菜',
    cropVariety: '京秋3号',
    planHarvestDate: '2026-05-30',
    expectedQuantity: 2500,
    unit: 'kg',
    managerId: 'M001',
    managerName: '张三',
    status: 3,
    createdAt: '2026-05-10 15:00:00',
    farmId: 'FARM01',
    farmName: '阳光有机农场',
    maturityScore: 95,
    maturityLevel: '过熟',
    laborCount: 8,
    laborNames: '张三,王五',
    laborIds: ['M001', 'M003'],
    actualQuantity: 2100,
    toolPlan: '白菜收割机 1 台',
  },
  {
    planId: 'HP005',
    planNo: 'HP20260625',
    plotId: 'PLOT04',
    plotName: '4号田',
    cropId: 'CROP04',
    cropName: '茄子',
    cropVariety: '紫长茄',
    planHarvestDate: '2026-06-25',
    expectedQuantity: 2000,
    unit: 'kg',
    managerId: 'M002',
    managerName: '李四',
    status: 1,
    createdAt: '2026-05-28 16:00:00',
    farmId: 'FARM01',
    farmName: '阳光有机农场',
    maturityScore: 55,
    maturityLevel: '未成熟',
    laborCount: 3,
    laborNames: '',
    laborIds: [],
  },
]

/** 演示数据：成品库存（取自原型 P16 表格） */
const DEMO_INVENTORY: InventoryRecord[] = [
  {
    inventoryId: 'INV001',
    batchId: 'HB006',
    batchNo: 'BC20260601',
    warehouseName: '冷藏库A',
    currentQty: 1250,
    unit: 'kg',
    frozenQty: 0,
    locationCode: 'A-01-02',
    lastInAt: '2026-06-01 15:00:00',
    productName: '番茄(A级)',
    category: '番茄',
    grade: 'A',
    safeQty: 200,
    expireDate: '2026-06-15',
    relatedBatchNo: 'H20260518',
    healthStatus: 'normal',
    frozen: false,
    createdAt: '2026-06-01 15:00:00',
  },
  {
    inventoryId: 'INV002',
    batchId: 'HB002',
    batchNo: 'BC20260528',
    warehouseName: '冷藏库A',
    currentQty: 850,
    unit: 'kg',
    frozenQty: 0,
    locationCode: 'A-02-01',
    lastInAt: '2026-05-28 16:20:00',
    productName: '黄瓜(B级)',
    category: '黄瓜',
    grade: 'B',
    safeQty: 150,
    expireDate: '2026-06-10',
    relatedBatchNo: 'H20260528',
    healthStatus: 'normal',
    frozen: false,
    createdAt: '2026-05-28 16:20:00',
  },
  {
    inventoryId: 'INV003',
    batchId: 'HB003',
    batchNo: 'BC20260525',
    warehouseName: '冷藏库B',
    currentQty: 620,
    unit: 'kg',
    frozenQty: 0,
    locationCode: 'B-01-03',
    lastInAt: '2026-05-25 11:05:00',
    lastOutAt: '2026-06-02 10:00:00',
    productName: '辣椒(A级)',
    category: '辣椒',
    grade: 'A',
    safeQty: 100,
    expireDate: '2026-06-08',
    relatedBatchNo: 'H20260525',
    healthStatus: 'warning',
    frozen: false,
    createdAt: '2026-05-25 11:05:00',
  },
  {
    inventoryId: 'INV004',
    batchId: 'HB004',
    batchNo: 'BC20260520',
    warehouseName: '冷藏库A',
    currentQty: 50,
    unit: 'kg',
    frozenQty: 0,
    locationCode: 'A-03-05',
    lastInAt: '2026-05-20 09:30:00',
    lastOutAt: '2026-06-01 09:00:00',
    productName: '白菜(A级)',
    category: '白菜',
    grade: 'A',
    safeQty: 100,
    expireDate: '2026-06-05',
    relatedBatchNo: 'H20260522',
    healthStatus: 'shortage',
    frozen: false,
    createdAt: '2026-05-20 09:30:00',
  },
  {
    inventoryId: 'INV005',
    batchId: 'HB005',
    batchNo: 'BC20260518',
    warehouseName: '主仓库',
    currentQty: 1800,
    unit: 'kg',
    frozenQty: 200,
    locationCode: 'M-02-01',
    lastInAt: '2026-05-18 10:15:00',
    productName: '茄子(C级)',
    category: '茄子',
    grade: 'C',
    safeQty: 300,
    expireDate: '2026-06-03',
    relatedBatchNo: 'H20260520',
    lossQty: 200,
    lossReason: '仓储霉变',
    healthStatus: 'expiring',
    frozen: false,
    createdAt: '2026-05-18 10:15:00',
  },
]

/** 演示数据：出入库流水（取自原型 P18） */
const DEMO_FLOWS: InventoryFlow[] = [
  {
    flowId: 'FL001',
    batchId: 'HB006',
    flowType: 1,
    quantity: 1250,
    unit: 'kg',
    operatorName: '李四',
    operatedAt: '2026-06-01 15:00:00',
    remark: '采收入库',
    warehouseName: '冷藏库A',
  },
  {
    flowId: 'FL002',
    batchId: 'HB002',
    flowType: 1,
    quantity: 850,
    unit: 'kg',
    operatorName: '张三',
    operatedAt: '2026-05-28 16:20:00',
    remark: '采收入库',
    warehouseName: '冷藏库A',
  },
  {
    flowId: 'FL003',
    batchId: 'HB003',
    flowType: 1,
    quantity: 800,
    unit: 'kg',
    operatorName: '王五',
    operatedAt: '2026-05-25 11:05:00',
    remark: '采收入库',
    warehouseName: '冷藏库B',
  },
  {
    flowId: 'FL004',
    batchId: 'HB003',
    flowType: 2,
    quantity: -180,
    unit: 'kg',
    operatorName: '王五',
    orderNo: 'SO20260602',
    operatedAt: '2026-06-02 10:00:00',
    remark: '销售出库',
    warehouseName: '冷藏库B',
  },
  {
    flowId: 'FL005',
    batchId: 'HB004',
    flowType: 1,
    quantity: 500,
    unit: 'kg',
    operatorName: '张三',
    operatedAt: '2026-05-20 09:30:00',
    remark: '采收入库',
    warehouseName: '冷藏库A',
  },
  {
    flowId: 'FL006',
    batchId: 'HB004',
    flowType: 2,
    quantity: -450,
    unit: 'kg',
    operatorName: '张三',
    orderNo: 'SO20260601',
    operatedAt: '2026-06-01 09:00:00',
    remark: '销售出库',
    warehouseName: '冷藏库A',
  },
  {
    flowId: 'FL007',
    batchId: 'HB005',
    flowType: 1,
    quantity: 2000,
    unit: 'kg',
    operatorName: '王五',
    operatedAt: '2026-05-18 10:15:00',
    remark: '采收入库',
    warehouseName: '主仓库',
  },
  {
    flowId: 'FL008',
    batchId: 'HB005',
    flowType: 4,
    quantity: -200,
    unit: 'kg',
    operatorName: '王五',
    operatedAt: '2026-05-25 14:00:00',
    remark: '仓储霉变报损',
    warehouseName: '主仓库',
  },
]

/**
 * 演示数据源（**只读**）。
 *
 * 仅用于「服务端不可用」时的读侧兜底，结果一律带 `demo: true` 标记，
 * 页面必须据此展示「本地示例数据 / 未连接服务端」横幅。
 *
 * ⚠️ 写操作（入库 / 出库 / 调拨 / 损耗 / 冻结 / 新建等）**不再回写这里**：
 * 曾经的「写本地副本 + return true」会让用户在后端失败时看到「操作成功」，
 * 属于业务动作丢失而不自知的严重问题。写操作失败必须抛错，由调用方如实提示。
 */
const demoStore: {
  /** 采收批次 */
  batches: HarvestBatch[]
  /** 采收计划 */
  plans: HarvestPlan[]
  /** 库存记录 */
  inventory: InventoryRecord[]
  /** 出入库流水 */
  flows: InventoryFlow[]
} = {
  batches: [...DEMO_BATCHES],
  plans: [...DEMO_PLANS],
  inventory: [...DEMO_INVENTORY],
  flows: [...DEMO_FLOWS],
}

/**
 * 判断一次失败是否属于「服务端不可用」。
 *
 * 只有网络不通 / 服务未启动（拿不到 HTTP 响应）、端点不存在（404、405）
 * 或服务端自身异常（5xx）才判定为不可用；
 * 服务端已响应并给出业务错误码（code !== 0）属于**明确拒绝**，不允许降级，
 * 否则会把「后端拒绝了这个请求」伪装成「查到了数据」。
 *
 * @param error catch 到的未知错误
 * @returns 是否可判定为服务端不可用
 */
function isBackendUnavailable(error: unknown): boolean {
  if (asApiRequestError(error)) {
    return false
  }
  const status = httpStatusOf(error)
  return status === 0 || status === 404 || status === 405 || status >= 500
}

/**
 * 把「服务端不可用」的原因写成人能读、且能据此排障的一句话。
 *
 * 只陈述**实测到的现象**（HTTP 状态 / 连不上），不推断「后端接口建设中」——
 * 那是猜测，而且经常是错的（例如前端路径写错也会表现为拿不到数据）。
 *
 * @param error catch 到的未知错误
 * @returns 原因描述
 */
function describeUnavailable(error: unknown): string {
  const apiError = asApiRequestError(error)
  if (apiError) {
    return `后端返回业务码 ${apiError.bizCode}（${apiError.message || '无提示'}），HTTP ${apiError.httpStatus ?? '未知'}`
  }
  const status = httpStatusOf(error)
  if (status === 0) {
    return `无法连接到服务端（${(error as Error)?.message ?? '网络异常'}）`
  }
  if (status === 404) {
    return '后端返回 HTTP 404：请求的地址不存在（端点不存在或路径写错）'
  }
  if (status === 405) {
    return '后端返回 HTTP 405：请求方法不被允许'
  }
  if (status >= 500) {
    return `后端返回 HTTP ${status}：服务端异常`
  }
  return `请求失败：HTTP ${status}（${(error as Error)?.message ?? '未知原因'}）`
}

/**
 * 静默调用真实接口，仅在「服务端确实不可用」时回退到演示数据。
 *
 * 回退结果一律带 `demo: true` 标记，并把本次降级的**真实原因**写进 `demoReason`，
 * 调用方必须据此展示显式的本地数据横幅，**且要把原因原样显示**——
 * 只写「接口建设中」会把排障方向带偏（见 {@link DemoFlag} 注释）。
 *
 * @param real 真实接口调用
 * @param fallback 演示数据兜底逻辑
 * @returns 接口结果或带 demo 标记的演示结果
 */
async function withDemoFallback<T>(real: () => Promise<T>, fallback: () => T): Promise<T> {
  try {
    return await real()
  } catch (error) {
    if (!isBackendUnavailable(error)) {
      throw error
    }
    const result = fallback()
    const flagged = result as T & DemoFlag
    if (flagged && typeof flagged === 'object' && flagged.demo === true) {
      flagged.demoReason = describeUnavailable(error)
    }
    return result
  }
}

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
 * 客户端分页切片。
 *
 * @param rows 全量数据
 * @param pageNum 页码（从 1 开始）
 * @param pageSize 每页条数
 * @returns 带演示标记的分页结果
 */
function paginate<T>(rows: T[], pageNum: number, pageSize: number): DemoPageResult<T> {
  const start = (pageNum - 1) * pageSize
  return {
    list: rows.slice(start, start + pageSize),
    total: rows.length,
    pageNum,
    pageSize,
    pages: Math.max(1, Math.ceil(rows.length / pageSize)),
    demo: true,
  }
}

/**
 * 标记真实分页结果为非演示数据。
 *
 * @param result 后端分页结果
 * @returns 带来源标记的分页结果
 */
function markReal<T>(result: PageResult<T>): DemoPageResult<T> {
  return { ...result, demo: false }
}

/** 采收批次查询（真实接口优先，异常回退演示数据） */
export function queryHarvests(params: HarvestQueryParams): Promise<DemoPageResult<HarvestBatch>> {
  return withDemoFallback(
    () => http.get<PageResult<HarvestBatch>>(BASE, params, { silent: true }).then(markReal),
    () => {
      const rows = demoStore.batches.filter((item) => {
        if (params.plotId && item.plotId !== params.plotId) return false
        if (params.cropId && item.cropId !== params.cropId) return false
        if (params.grade && item.grade !== params.grade) return false
        if (params.status && item.status !== params.status) return false
        if (params.inboundStatus !== undefined && item.inboundStatus !== params.inboundStatus) {
          return false
        }
        if (params.batchNo && !item.batchNo.includes(params.batchNo)) return false
        if (params.startDate && item.harvestDate < params.startDate) return false
        if (params.endDate && item.harvestDate > params.endDate) return false
        return true
      })
      return paginate(rows, params.pageNum ?? 1, params.pageSize ?? 10)
    },
  )
}

/** 采收批次详情查询（真实接口优先，异常回退演示数据） */
export function queryHarvest(batchId: BizId): Promise<DemoResult<HarvestBatch>> {
  return withDemoFallback(
    () =>
      http
        .get<HarvestBatch>(`${BASE}/${batchId}`, undefined, { silent: true })
        .then((data) => ({ data, demo: false })),
    () => {
      const found = demoStore.batches.find((item) => item.batchId === String(batchId))
      return { data: found ?? demoStore.batches[0], demo: true }
    },
  )
}

/** 采收计划列表查询（真实接口优先，异常回退演示数据） */
export function queryHarvestPlans(
  params: PageQuery & { farmId?: string; plotId?: string; status?: number },
): Promise<DemoPageResult<HarvestPlan>> {
  return withDemoFallback(
    () =>
      http
        .get<PageResult<HarvestPlan>>(`${BASE}/plan`, params, { silent: true })
        .then(markReal),
    () => {
      const rows = demoStore.plans.filter((item) => {
        if (params.plotId && item.plotId !== params.plotId) return false
        if (params.status && item.status !== params.status) return false
        return true
      })
      return paginate(rows, params.pageNum ?? 1, params.pageSize ?? 10)
    },
  )
}

/** 库存记录列表查询（真实接口优先，异常回退演示数据） */
export function queryInventory(
  params: InventoryQueryParams,
): Promise<DemoPageResult<InventoryRecord>> {
  return withDemoFallback(
    () =>
      http
        .get<PageResult<InventoryRecord>>(`${BASE}/inventory`, params, { silent: true })
        .then(markReal),
    () => {
      const rows = demoStore.inventory.filter((item) => {
        if (params.warehouseName && item.warehouseName !== params.warehouseName) return false
        if (params.category && item.category !== params.category) return false
        if (params.batchNo && !(item.batchNo ?? '').includes(params.batchNo)) return false
        if (params.healthStatus && (item.healthStatus ?? 'normal') !== params.healthStatus) {
          return false
        }
        if (params.keyword && !(item.productName ?? '').includes(params.keyword)) return false
        return true
      })
      return paginate(rows, params.pageNum ?? 1, params.pageSize ?? 10)
    },
  )
}

/** 库存记录详情查询（真实接口优先，异常回退演示数据） */
export function queryInventoryRecord(inventoryId: BizId): Promise<DemoResult<InventoryRecord>> {
  return withDemoFallback(
    () =>
      http
        .get<InventoryRecord>(`${BASE}/inventory/${inventoryId}`, undefined, { silent: true })
        .then((data) => ({ data, demo: false })),
    () => {
      const found = demoStore.inventory.find((item) => item.inventoryId === String(inventoryId))
      return { data: found ?? demoStore.inventory[0], demo: true }
    },
  )
}

/**
 * 出入库流水查询（真实接口优先，服务端不可用回退演示数据）。
 *
 * ⚠️ 路径曾写错：`/harvests/inventory/{batchId}/flows` 实测返回 **HTTP 200 + 业务码 500**，
 * 而真端点是 `HarvestController.java:98` 的 `/harvests/{batchId}/flows`（实测 code=0 有数据）。
 *
 * 更正一处早期误判：当时以为「演示兜底 100% 被触发」，实际不是。
 * 业务码 500 会被 `isBackendUnavailable` 判成「服务端明确拒绝」→ **不兜底、直接抛错**，
 * 于是库存详情页的「出入库记录」表现为**一张空表 + 没有任何提示**，
 * 看上去像"这段时间没有流水"，比兜底更难发现。改回正确路径后取的是真实流水；
 * 失败态的显式提示见 `InventoryDetail.tsx` 的 `flowQuery.isError` 分支。
 */
export function queryInventoryFlows(
  batchId: BizId,
  params: PageQuery,
): Promise<DemoPageResult<InventoryFlow>> {
  return withDemoFallback(
    () =>
      http
        .get<PageResult<InventoryFlow>>(`${BASE}/${batchId}/flows`, params, {
          silent: true,
        })
        .then(markReal),
    () => {
      const rows = demoStore.flows
        .filter((item) => item.batchId === String(batchId))
        .sort((a, b) => (a.operatedAt < b.operatedAt ? 1 : -1))
      return paginate(rows, params.pageNum ?? 1, params.pageSize ?? 50)
    },
  )
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
 * 全流程走真实接口：批次创建或详情回查失败直接抛错（不写本地数据、不返回假成功）；
 * 仅溯源码生成失败时作为**显式告警**返回，因为此时批次本身已经落库。
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
 * 全链路走真实接口；任一步失败即抛错，不写本地演示库存、不返回假成功。
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
 * 只走真实接口；失败即抛错，不写本地演示库存、不返回假成功。
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
 * 只走真实接口；失败即抛错，不写本地演示库存、不返回假成功。
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
 * 只走真实接口；失败即抛错，不写本地演示库存、不返回假成功。
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
 * 只走真实接口；失败即抛错，不写本地演示库存、不返回假成功。
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
 * 只走真实接口；失败即抛错，不写本地演示数据源、不返回假成功。
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

/**
 * 新增采收计划（PRD 6.1 #31）。
 *
 * 只走真实接口；失败即抛错，不写本地演示数据源、不返回假成功。
 *
 * @param payload 计划表单数据
 * @returns 服务端新建的采收计划
 */
export async function submitHarvestPlan(payload: Partial<HarvestPlan>): Promise<HarvestPlan> {
  try {
    return await createHarvestPlan(payload)
  } catch (error) {
    throwWriteFailure('新建采收计划', error)
  }
}

/**
 * 提交成熟度评估。
 *
 * 只走真实接口；失败即抛错，不写本地演示数据源、不返回假成功。
 *
 * @param planId 计划 ID
 * @param payload 成熟度信息
 * @returns 服务端确认提交成功时返回 true
 */
export async function submitMaturity(planId: BizId, payload: MaturityPayload): Promise<boolean> {
  try {
    return await updatePlanMaturity(planId, payload)
  } catch (error) {
    throwWriteFailure('成熟度评估', error)
  }
}

/**
 * 提交人力安排。
 *
 * 只走真实接口；失败即抛错，不写本地演示数据源、不返回假成功。
 *
 * @param planId 计划 ID
 * @param payload 人力信息
 * @returns 服务端确认保存成功时返回 true
 */
export async function submitLabor(planId: BizId, payload: LaborPayload): Promise<boolean> {
  try {
    return await assignPlanLabor(planId, payload)
  } catch (error) {
    throwWriteFailure('人力安排', error)
  }
}
