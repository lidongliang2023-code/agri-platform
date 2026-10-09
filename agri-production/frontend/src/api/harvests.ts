/**
 * 采收与库存管理 API
 */
import { http } from '@/utils/request'
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

/** 库存出库 */
export function stockOut(
  batchId: string,
  payload: { quantity: number; orderNo?: string; remark?: string },
): Promise<boolean> {
  return http.post<boolean>(`${BASE}/inventory/${batchId}/out`, payload)
}

/** 冻结 / 解冻库存 */
export function freezeInventory(
  batchId: string,
  payload: { frozen: boolean; quantity?: number },
): Promise<boolean> {
  return http.patch<boolean>(`${BASE}/inventory/${batchId}/freeze`, payload)
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

/** 采收批次统计概览（原型 P13 概览卡） */
export interface HarvestOverview {
  /** 本季采收总量（kg） */
  seasonQuantity: number
  /** 本月采收次数 */
  monthCount: number
  /** A 级占比（%） */
  gradeARatio: number
  /** 待入库条数 */
  pendingInbound: number
}

/** 查询采收概览统计 */
export function fetchHarvestOverview(farmId?: string): Promise<HarvestOverview> {
  return http.get<HarvestOverview>(`${BASE}/overview`, { farmId })
}

/** 数据来源标记：true 表示结果来自内置演示数据（后端接口未就绪或异常） */
export interface DemoFlag {
  /** 是否为演示数据 */
  demo: boolean
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
 * 演示数据源（模块内可变副本）。
 * 写操作在后端不可用时同步更新该副本，保证页面交互连续。
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
 * 静默调用真实接口，失败时回退到演示数据。
 *
 * @param real 真实接口调用
 * @param fallback 演示数据兜底逻辑
 * @returns 接口结果或演示结果
 */
async function withDemoFallback<T>(real: () => Promise<T>, fallback: () => T): Promise<T> {
  try {
    return await real()
  } catch {
    return fallback()
  }
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

/** 出入库流水查询（真实接口优先，异常回退演示数据） */
export function queryInventoryFlows(
  batchId: BizId,
  params: PageQuery,
): Promise<DemoPageResult<InventoryFlow>> {
  return withDemoFallback(
    () =>
      http
        .get<PageResult<InventoryFlow>>(`${BASE}/inventory/${batchId}/flows`, params, {
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
 * 提交采收登记：新建批次后自动生成批次（HARV-02 + HARV-03）。
 *
 * @param payload 采收登记表单数据
 * @returns 生成的采收批次
 */
export async function submitHarvest(payload: Partial<HarvestBatch>): Promise<HarvestBatch> {
  try {
    // 后端 POST /harvests 只返回**新批次主键**（ApiResponse<String>），
    // 需要按需触发溯源码生成后再回查完整实体，不能直接把主键当实体用。
    const batchId = await createHarvest(payload)
    if (!batchId) throw new Error('采收批次创建未返回主键')
    await generateHarvestBatch(batchId, {
      traceCode: payload.traceCode,
      warehouseName: payload.warehouseName,
    }).catch(() => undefined)
    return await getHarvest(batchId)
  } catch {
    const now = new Date()
    const seq = String(demoStore.batches.length + 1).padStart(3, '0')
    const harvestDate = payload.harvestDate ?? now.toISOString().slice(0, 10)
    const created: HarvestBatch = {
      batchId: `HB${seq}`,
      batchNo: payload.batchNo ?? `H${harvestDate.replace(/-/g, '')}`,
      plotId: payload.plotId ?? '',
      plotName: payload.plotName,
      planId: payload.planId,
      cropId: payload.cropId ?? '',
      cropName: payload.cropName,
      cropVariety: payload.cropVariety,
      harvestDate,
      quantity: payload.quantity ?? 0,
      unit: payload.unit ?? 'kg',
      grade: payload.grade ?? '待检',
      status: 1,
      traceGenerated: false,
      createdAt: now.toISOString().slice(0, 19).replace('T', ' '),
      farmId: payload.farmId,
      farmName: payload.farmName,
      inboundStatus: 0,
      harvestArea: payload.harvestArea,
      appearance: payload.appearance,
      expectedQuantity: payload.expectedQuantity,
      perMuYield: payload.perMuYield,
      operatorId: payload.operatorId,
      operatorName: payload.operatorName,
      remark: payload.remark,
    }
    demoStore.batches = [created, ...demoStore.batches]
    return created
  }
}

/**
 * 批次入库：生成批次并写入库存流水（HARV-03 + HARV-05）。
 *
 * @param batchId 批次 ID
 * @param payload 入库信息
 * @returns 是否成功
 */
export async function inboundHarvest(
  batchId: BizId,
  payload: { warehouseName?: string; quantity?: number } = {},
): Promise<boolean> {
  try {
    await generateHarvestBatch(batchId, { warehouseName: payload.warehouseName })
    await stockInInventory({
      batchId,
      warehouseName: payload.warehouseName ?? '主仓库',
      quantity: payload.quantity ?? 0,
    })
    return true
  } catch {
    const target = demoStore.batches.find((item) => item.batchId === String(batchId))
    if (target) {
      target.inboundStatus = 1
      target.status = 1
      target.traceGenerated = true
      target.warehouseName = payload.warehouseName ?? '主仓库'
    }
    const exist = demoStore.inventory.find((item) => item.batchId === String(batchId))
    if (exist) {
      exist.currentQty += payload.quantity ?? 0
      exist.lastInAt = new Date().toISOString().slice(0, 19).replace('T', ' ')
    } else if (target) {
      const record: InventoryRecord = {
        inventoryId: `INV${String(demoStore.inventory.length + 1).padStart(3, '0')}`,
        batchId: String(batchId),
        batchNo: `BC${target.harvestDate.replace(/-/g, '')}`,
        warehouseName: payload.warehouseName ?? '主仓库',
        currentQty: payload.quantity ?? target.quantity,
        unit: target.unit,
        frozenQty: 0,
        productName: `${target.cropName ?? ''}(${target.grade ?? ''}级)`,
        category: target.cropName,
        grade: target.grade,
        safeQty: Math.round((payload.quantity ?? target.quantity) * 0.2),
        relatedBatchNo: target.batchNo,
        healthStatus: 'normal',
        frozen: false,
        lastInAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
        createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      }
      demoStore.inventory = [record, ...demoStore.inventory]
      demoStore.flows = [
        {
          flowId: `FL${String(demoStore.flows.length + 1).padStart(3, '0')}`,
          batchId: String(batchId),
          flowType: 1,
          quantity: record.currentQty,
          unit: record.unit,
          operatorName: target.operatorName,
          operatedAt: record.lastInAt ?? '',
          remark: '采收入库',
          warehouseName: record.warehouseName,
        },
        ...demoStore.flows,
      ]
      target.inventoryId = record.inventoryId
    }
    return true
  }
}

/**
 * 库存出库（HARV-06），后端不可用时同步演示库存。
 *
 * @param batchId 批次 ID
 * @param payload 出库信息
 * @returns 是否成功
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
  } catch {
    applyDemoInventoryChange(String(batchId), -Math.abs(payload.quantity), 2, payload)
    return true
  }
}

/**
 * 库存入库（补货 / 追加入库）。
 *
 * @param batchId 批次 ID
 * @param payload 入库信息
 * @returns 是否成功
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
  } catch {
    applyDemoInventoryChange(String(batchId), Math.abs(payload.quantity), 1, payload)
    return true
  }
}

/**
 * 在演示数据源上追加一条库存流水并更新库存数量。
 *
 * @param batchId 批次 ID
 * @param delta 变动数量（正数入库，负数出库）
 * @param flowType 流水类型：1 入库 2 出库 3 盘点 4 报损
 * @param payload 附加信息
 */
function applyDemoInventoryChange(
  batchId: string,
  delta: number,
  flowType: 1 | 2 | 3 | 4,
  payload: {
    quantity: number
    orderNo?: string
    remark?: string
    operatorName?: string
    warehouseName?: string
  },
): void {
  const record = demoStore.inventory.find((item) => item.batchId === batchId)
  if (record) {
    record.currentQty = Math.max(0, record.currentQty + delta)
    const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ')
    if (delta > 0) {
      record.lastInAt = stamp
    } else {
      record.lastOutAt = stamp
    }
    if (record.currentQty === 0) {
      record.healthStatus = 'shortage'
    } else if (record.safeQty && record.currentQty <= record.safeQty * 0.5) {
      record.healthStatus = 'shortage'
    } else if (record.safeQty && record.currentQty <= record.safeQty) {
      record.healthStatus = 'warning'
    } else if (record.healthStatus !== 'expiring') {
      record.healthStatus = 'normal'
    }
    if (flowType === 4) {
      record.lossQty = (record.lossQty ?? 0) + Math.abs(delta)
      record.lossReason = payload.remark
    }
  }
  demoStore.flows = [
    {
      flowId: `FL${String(demoStore.flows.length + 1).padStart(3, '0')}`,
      batchId,
      flowType,
      quantity: delta,
      unit: record?.unit ?? 'kg',
      operatorName: payload.operatorName,
      orderNo: payload.orderNo,
      operatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      remark: payload.remark,
      warehouseName: record?.warehouseName,
    },
    ...demoStore.flows,
  ]
}

/**
 * 损耗登记（HARV-09），后端不可用时同步演示库存。
 *
 * @param payload 损耗信息
 * @returns 是否成功
 */
export async function registerLoss(payload: LossPayload): Promise<boolean> {
  try {
    return await registerInventoryLoss(payload)
  } catch {
    applyDemoInventoryChange(String(payload.batchId), -Math.abs(payload.quantity), 4, {
      quantity: payload.quantity,
      remark: payload.reason,
      operatorName: payload.operatorName,
    })
    return true
  }
}

/**
 * 冻结 / 解冻库存，后端不可用时同步演示库存。
 *
 * @param batchId 批次 ID
 * @param frozen true 冻结 / false 解冻
 * @returns 是否成功
 */
export async function toggleInventoryFreeze(batchId: BizId, frozen: boolean): Promise<boolean> {
  try {
    return await freezeInventory(String(batchId), { frozen })
  } catch {
    demoStore.inventory.forEach((item) => {
      if (item.batchId === String(batchId)) {
        item.frozen = frozen
        item.frozenQty = frozen ? item.currentQty : 0
      }
    })
    demoStore.batches.forEach((item) => {
      if (item.batchId === String(batchId)) {
        item.status = frozen ? 4 : 1
      }
    })
    return true
  }
}

/**
 * 库存调拨，后端不可用时同步演示库存。
 *
 * @param payload 调拨信息
 * @returns 是否成功
 */
export async function transferInventoryRecord(payload: TransferPayload): Promise<boolean> {
  try {
    return await transferInventory(payload)
  } catch {
    const record = demoStore.inventory.find((item) => item.batchId === String(payload.batchId))
    if (record) {
      record.warehouseName = payload.targetWarehouse
      if (payload.locationCode) record.locationCode = payload.locationCode
    }
    demoStore.flows = [
      {
        flowId: `FL${String(demoStore.flows.length + 1).padStart(3, '0')}`,
        batchId: String(payload.batchId),
        flowType: 3,
        quantity: 0,
        unit: record?.unit ?? 'kg',
        operatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
        remark: `调拨至 ${payload.targetWarehouse}${payload.remark ? ` · ${payload.remark}` : ''}`,
        warehouseName: payload.targetWarehouse,
      },
      ...demoStore.flows,
    ]
    return true
  }
}

/**
 * 新增库存记录（原型 P17），后端不可用时写入演示数据源。
 *
 * @param payload 库存表单数据
 * @returns 新建的库存记录
 */
export async function submitInventory(payload: InventoryPayload): Promise<InventoryRecord> {
  try {
    return await createInventory(payload)
  } catch {
    const safeQty = payload.safeQty ?? 0
    const currentQty = payload.currentQty ?? 0
    const record: InventoryRecord = {
      inventoryId: `INV${String(demoStore.inventory.length + 1).padStart(3, '0')}`,
      batchId: payload.batchId ?? '',
      batchNo: payload.batchNo ?? `BC${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
      warehouseName: payload.warehouseName ?? '主仓库',
      currentQty,
      unit: payload.unit ?? 'kg',
      frozenQty: 0,
      locationCode: payload.locationCode,
      productName: payload.productName,
      category: payload.category,
      grade: payload.grade,
      safeQty,
      expireDate: payload.expireDate,
      relatedBatchNo: payload.relatedBatchNo,
      healthStatus:
        payload.healthStatus ??
        (safeQty > 0 && currentQty <= safeQty * 0.5
          ? 'shortage'
          : safeQty > 0 && currentQty <= safeQty
            ? 'warning'
            : 'normal'),
      frozen: false,
      remark: payload.remark,
      lastInAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
    }
    demoStore.inventory = [record, ...demoStore.inventory]
    demoStore.flows = [
      {
        flowId: `FL${String(demoStore.flows.length + 1).padStart(3, '0')}`,
        batchId: record.batchId,
        flowType: 1,
        quantity: record.currentQty,
        unit: record.unit,
        operatedAt: record.lastInAt ?? '',
        remark: payload.remark || '手工入库',
        warehouseName: record.warehouseName,
      },
      ...demoStore.flows,
    ]
    return record
  }
}

/**
 * 新增采收计划（PRD 6.1 #31），后端不可用时写入演示数据源。
 *
 * @param payload 计划表单数据
 * @returns 新建的采收计划
 */
export async function submitHarvestPlan(payload: Partial<HarvestPlan>): Promise<HarvestPlan> {
  try {
    return await createHarvestPlan(payload)
  } catch {
    const plan: HarvestPlan = {
      planId: `HP${String(demoStore.plans.length + 1).padStart(3, '0')}`,
      planNo: `HP${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
      plotId: payload.plotId ?? '',
      plotName: payload.plotName,
      cropId: payload.cropId ?? '',
      cropName: payload.cropName,
      cropVariety: payload.cropVariety,
      planHarvestDate: payload.planHarvestDate ?? new Date().toISOString().slice(0, 10),
      expectedQuantity: payload.expectedQuantity ?? 0,
      unit: payload.unit ?? 'kg',
      managerId: payload.managerId,
      managerName: payload.managerName,
      status: 1,
      createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      farmId: payload.farmId,
      farmName: payload.farmName,
      maturityScore: payload.maturityScore ?? 0,
      maturityLevel: payload.maturityLevel,
      laborCount: payload.laborCount ?? 0,
      laborIds: payload.laborIds ?? [],
      laborNames: payload.laborNames ?? '',
      toolPlan: payload.toolPlan,
      remark: payload.remark,
    }
    demoStore.plans = [plan, ...demoStore.plans]
    return plan
  }
}

/**
 * 提交成熟度评估，后端不可用时更新演示数据源。
 *
 * @param planId 计划 ID
 * @param payload 成熟度信息
 * @returns 是否成功
 */
export async function submitMaturity(planId: BizId, payload: MaturityPayload): Promise<boolean> {
  try {
    return await updatePlanMaturity(planId, payload)
  } catch {
    const plan = demoStore.plans.find((item) => item.planId === String(planId))
    if (plan) {
      plan.maturityScore = payload.maturityScore
      plan.maturityLevel = (payload.maturityLevel as HarvestPlan['maturityLevel']) ?? undefined
      plan.maturityOperator = payload.maturityOperator
      plan.maturityAt = new Date().toISOString().slice(0, 19).replace('T', ' ')
      if (payload.remark) plan.remark = payload.remark
    }
    return true
  }
}

/**
 * 提交人力安排，后端不可用时更新演示数据源。
 *
 * @param planId 计划 ID
 * @param payload 人力信息
 * @returns 是否成功
 */
export async function submitLabor(planId: BizId, payload: LaborPayload): Promise<boolean> {
  try {
    return await assignPlanLabor(planId, payload)
  } catch {
    const plan = demoStore.plans.find((item) => item.planId === String(planId))
    if (plan) {
      plan.laborIds = payload.laborIds
      plan.laborNames = payload.laborNames
      plan.laborCount = payload.laborCount ?? payload.laborIds.length
      plan.toolPlan = payload.toolPlan
      if (plan.status === 1 && payload.laborIds.length > 0) plan.status = 2
    }
    return true
  }
}
