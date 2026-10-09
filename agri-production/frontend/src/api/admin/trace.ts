/**
 * 运营端 - 质量追溯 API（溯源 / 检测机构 / 不合格品）
 */
import { http } from '@/utils/request'
import type { PageQuery, PageResult } from '@/types'
import type { ProductRecall, TestingLab, TraceCode, TraceNode } from '@/types'
/* 页面补充类型（追加导入，不改动既有定义） */
import type { RawTraceCode } from '@/types'

const BASE = '/admin/trace'

/** 溯源总览统计 */
export interface TraceOverview {
  /** 累计溯源码数量 */
  totalCodeCount: number
  /** 已激活码数量 */
  activatedCodeCount: number
  /** 累计扫码次数 */
  totalScanCount: number
  /** 异常扫码次数 */
  abnormalScanCount: number
  /** 覆盖批次数量 */
  batchCount: number
}

/** 查询溯源管理总览 */
export function getTraceOverview(): Promise<TraceOverview> {
  return http.get<TraceOverview>(`${BASE}/overview`)
}

/** 分页查询溯源码 */
export function listAdminTraceCodes(
  params: PageQuery & { tenantId?: string; code?: string; status?: string },
): Promise<PageResult<TraceCode>> {
  return http.get<PageResult<TraceCode>>(`${BASE}/codes`, params)
}

/** 查询溯源码详情 */
export function getAdminTraceCode(code: string): Promise<TraceCode> {
  return http.get<TraceCode>(`${BASE}/codes/${code}`)
}

/** 冻结溯源码 */
export function freezeTraceCode(code: string, frozen: boolean): Promise<boolean> {
  return http.patch<boolean>(`${BASE}/codes/${code}/freeze`, { frozen })
}

/** 查询全链路溯源节点 */
export function listAdminTraceNodes(batchId: string): Promise<TraceNode[]> {
  return http.get<TraceNode[]>(`${BASE}/nodes/${batchId}`)
}

/** 分页查询检测机构 */
export function listLabs(
  params: PageQuery & { labName?: string; labLevel?: number; status?: number },
): Promise<PageResult<TestingLab>> {
  return http.get<PageResult<TestingLab>>(`${BASE}/labs`, params)
}

/** 查询检测机构详情 */
export function getLab(labId: string): Promise<TestingLab> {
  return http.get<TestingLab>(`${BASE}/labs/${labId}`)
}

/** 新增检测机构 */
export function createLab(payload: Partial<TestingLab>): Promise<TestingLab> {
  return http.post<TestingLab>(`${BASE}/labs`, payload)
}

/** 更新检测机构 */
export function updateLab(labId: string, payload: Partial<TestingLab>): Promise<TestingLab> {
  return http.put<TestingLab>(`${BASE}/labs/${labId}`, payload)
}

/** 删除检测机构 */
export function deleteLab(labId: string): Promise<boolean> {
  return http.delete<boolean>(`${BASE}/labs/${labId}`)
}

/** 分页查询不合格品处置记录 */
export function listRecalls(
  params: PageQuery & { tenantId?: string; batchNo?: string; status?: number },
): Promise<PageResult<ProductRecall>> {
  return http.get<PageResult<ProductRecall>>(`${BASE}/recalls`, params)
}

/** 查询不合格品处置详情 */
export function getRecall(recallId: string): Promise<ProductRecall> {
  return http.get<ProductRecall>(`${BASE}/recalls/${recallId}`)
}

/** 新增不合格品处置单 */
export function createRecall(payload: Partial<ProductRecall>): Promise<ProductRecall> {
  return http.post<ProductRecall>(`${BASE}/recalls`, payload)
}

/** 更新不合格品处置单 */
export function updateRecall(
  recallId: string,
  payload: Partial<ProductRecall>,
): Promise<ProductRecall> {
  return http.put<ProductRecall>(`${BASE}/recalls/${recallId}`, payload)
}

/** 关闭不合格品处置单 */
export function closeRecall(recallId: string): Promise<boolean> {
  return http.patch<boolean>(`${BASE}/recalls/${recallId}/close`)
}

/* -------------------------------------------------------------------------- *
 * 以下为「溯源总览 / 溯源码管理 / 溯源链路详情 / 检测报告 / 检测机构 / 不合格品处置」
 * 六个运营端页面追加的方法，路径与后端 AdminTraceController、AdminQualityController
 * 真实端点一一对齐：
 * - GET  /admin/trace/code-stats                     码段统计
 * - GET  /admin/trace/chain?code=                    全链条回溯
 * - POST /admin/trace/recall?batchId=                一键召回（作废码 + 冻结批次）
 * - GET  /admin/quality/labs?page&size&keyword       检测机构分页
 * - POST /admin/quality/labs/{labId}/accredit        机构准入认可
 * - GET  /admin/quality/inspections?page&size&result 检测台账分页
 * - GET  /admin/quality/inspections/failed           不合格检测清单
 * - GET  /admin/quality/overview                     质量总览
 * - POST /admin/quality/recalls?batchId=             不合格批次召回
 * 分页入参统一按后端签名传 page / size（pageNum / pageSize 为等价别名）。
 * -------------------------------------------------------------------------- */

/** 运营端质量监管接口基址 */
const QUALITY_BASE = '/admin/quality'

/** 检测机构写接口基址（新增 / 修改 / 删除在用户端 /quality 前缀下，真实落 prod_quality_lab） */
const LAB_BASE = '/quality'

/** 检测机构（后端 prod_quality_lab 形态 + 运营端增强字段） */
export interface QualityLab {
  /** 机构 ID */
  labId: string
  /** 机构编码 */
  labCode?: string
  /** 机构名称 */
  labName: string
  /** 机构类型：第三方 / 政府 / 自建 */
  labType?: string
  /** 联系人 */
  contactName?: string
  /** 联系电话 */
  contactPhone?: string
  /** 机构地址 */
  address?: string
  /** 资质证书编号 */
  qualificationNo?: string
  /** 认可检测范围 */
  accreditedScope?: string
  /** 合作状态：1 合作中 0 已终止 2 待准入（前端扩展） */
  status: number
  /** 准入驳回原因（后端 prod_quality_lab.reject_reason，驳回时落库） */
  rejectReason?: string
  /** 创建时间 */
  createdAt?: string
  /** 更新时间 */
  updatedAt?: string
  /** 资质等级：1 国家级 2 省级 3 市级（运营端扩展字段） */
  labLevel?: 1 | 2 | 3
  /** 服务评价分（0-100，运营端扩展字段） */
  serviceScore?: number
  /** 服务评价分项（运营端扩展字段） */
  serviceRating?: LabServiceRating
  /** LIMS 对接配置（运营端扩展字段，本地登记） */
  lims?: LabLimsConfig
  /** 准入审核意见（运营端扩展字段） */
  auditRemark?: string
}

/** 检测机构服务评价分项（PRD #18 服务评价） */
export interface LabServiceRating {
  /** 报告准时率（0-100） */
  onTimeRate: number
  /** 结果准确率（0-100） */
  accuracyRate: number
  /** 服务态度评分（0-5） */
  attitudeScore: number
  /** 累计服务单数 */
  orderCount: number
  /** 评价说明 */
  remark?: string
  /**
   * 本机登记时间。
   *
   * 该字段同时是「真伪标记」：历史版本把原型示例评价（`orderCount: 1286` 之类）写进过
   * localStorage，这些条目没有登记时间。加载时只保留带 updatedAt 的条目，
   * 避免把原型编造数字继续渲染给用户。
   */
  updatedAt?: string
}

/** LIMS 认证方式 */
export type LimsAuthType = 'NONE' | 'BASIC' | 'TOKEN' | 'OAUTH2'

/** LIMS 同步方式 */
export type LimsSyncMode = 'PUSH' | 'PULL'

/** LIMS 字段映射项 */
export interface LimsFieldMapping {
  /** LIMS 侧字段名 */
  source: string
  /** 平台侧字段名 */
  target: string
}

/** LIMS 对接配置（PRD #18 LIMS对接配置） */
export interface LabLimsConfig {
  /** 是否启用对接 */
  enabled: boolean
  /** 接口地址 */
  endpoint: string
  /** 认证方式 */
  authType: LimsAuthType
  /** 认证账号 / AppKey */
  appKey?: string
  /** 认证密钥 / AppSecret */
  appSecret?: string
  /** 同步方式：PUSH 机构推送 / PULL 平台拉取 */
  syncMode: LimsSyncMode
  /** 字段映射 */
  fieldMapping: LimsFieldMapping[]
  /** 最近配置时间 */
  updatedAt?: string
}

/** 运营端质量总览（/admin/quality/overview） */
export interface AdminQualityOverview {
  /** 合格检测单数 */
  passCount: number
  /** 不合格检测单数 */
  failCount: number
  /** 合格率（%） */
  passRate: number
  /** 合作中机构数 */
  labCount: number
  /** 已冻结批次数 */
  frozenBatch: number
}

/** 运营端检测台账行（后端 prod_inspection 形态 + 前端冗余字段） */
export interface AdminInspectionRow {
  /** 检测单 ID */
  inspectionId: string
  /** 检测单号（报告编号） */
  inspectionNo?: string
  /** 采收批次 ID（HarvestBatchId，string） */
  batchId?: string
  /** 批次号（冗余） */
  batchNo?: string
  /** 地块 ID */
  plotId?: string
  /** 作物 ID */
  cropId?: string
  /** 作物 / 产品名称（冗余） */
  cropName?: string
  /** 检测类型 SELF / SEND / SAMPLING */
  inspectionType?: string
  /** 检测人 ID */
  inspectorId?: string
  /** 检测人姓名 */
  inspectorName?: string
  /** 抽样数量 */
  sampleQty?: number | string
  /** 抽样时间 */
  sampleAt?: string
  /** 结论 PASS / FAIL */
  result?: string
  /** 检测报告地址 */
  reportUrl?: string
  /** 状态 PENDING / TESTING / DONE */
  status?: string
  /** 检测机构 ID（冗余） */
  labId?: string
  /** 检测机构名称（冗余） */
  labName?: string
  /** 创建时间 */
  createdAt?: string
}

/** 全链条回溯快照（/admin/trace/chain） */
export interface AdminTraceChain {
  /** 是否命中溯源码 */
  found: boolean
  /** 溯源码档案 */
  traceCode?: RawTraceCode
  /** 关联批次档案 */
  batch?: AdminTraceChainBatch
  /** 批次关联检测记录 */
  inspections?: AdminInspectionRow[]
}

/** 全链条回溯中的批次快照（后端 prod_harvest_batch 关键字段） */
export interface AdminTraceChainBatch {
  /** 采收批次 ID（string） */
  batchId?: string
  /** 批次号 */
  batchNo?: string
  /** 作物名称 */
  cropName?: string
  /** 地块 ID */
  plotId?: string
  /** 采收日期 */
  harvestDate?: string
  /** 采收数量 */
  quantity?: number | string
  /** 批次状态：4 已冻结 */
  status?: number
  /** 农场名称（冗余） */
  farmName?: string
}

/** 新增检测机构入参（后端 POST /api/v1/production/quality/labs，返回新机构 ID） */
export interface CreateQualityLabPayload {
  /** 机构编码 */
  labCode?: string
  /** 机构名称（必填） */
  labName: string
  /** 机构类型：第三方 / 政府 / 自建 */
  labType?: string
  /** 资质等级：1 国家级 2 省级 3 市级 */
  labLevel?: 1 | 2 | 3
  /** 联系人 */
  contactName?: string
  /** 联系电话 */
  contactPhone?: string
  /** 机构地址 */
  address?: string
  /** 资质证书编号 */
  qualificationNo?: string
  /** 认可检测范围 */
  accreditedScope?: string
  /** 合作状态：1 合作中 2 待准入 0 已终止 */
  status?: number
}

/**
 * 新增检测机构（POST /quality/labs）。
 *
 * 后端 QualityController.createQualityLab 真实落 prod_quality_lab 表，返回新生成的 labId。
 * 注意该端点在**非 admin** 的 /quality 前缀下（运营端 /admin/quality 只有列表、准入、驳回）。
 */
export function createQualityLab(payload: CreateQualityLabPayload): Promise<string> {
  return http.post<string>(`${LAB_BASE}/labs`, payload)
}

/** 检测机构准入驳回（POST /admin/quality/labs/{labId}/reject） */
export function rejectQualityLab(labId: string, rejectReason?: string): Promise<QualityLab> {
  return http.post<QualityLab>(`${QUALITY_BASE}/labs/${labId}/reject`, {
    rejectReason: rejectReason ?? '',
  })
}

/** 检测机构分页查询参数 */
export interface QualityLabPageParams {
  /** 机构名称关键字 */
  keyword?: string
  /** 页码，从 1 开始 */
  pageNum?: number
  /** 每页条数 */
  pageSize?: number
}

/** 分页查询检测机构（GET /admin/quality/labs） */
export function fetchQualityLabs(
  params: QualityLabPageParams = {},
): Promise<PageResult<QualityLab>> {
  return http.get<PageResult<QualityLab>>(`${QUALITY_BASE}/labs`, {
    page: params.pageNum ?? 1,
    size: params.pageSize ?? 10,
    keyword: params.keyword,
  })
}

/** 检测机构准入认可（POST /admin/quality/labs/{labId}/accredit） */
export function accreditQualityLab(labId: string): Promise<QualityLab> {
  return http.post<QualityLab>(`${QUALITY_BASE}/labs/${labId}/accredit`)
}

/** 检测台账分页查询参数 */
export interface QualityInspectionPageParams {
  /** 结论过滤 PASS / FAIL */
  result?: string
  /** 页码，从 1 开始 */
  pageNum?: number
  /** 每页条数 */
  pageSize?: number
}

/** 分页查询检测台账（GET /admin/quality/inspections） */
export function fetchQualityInspections(
  params: QualityInspectionPageParams = {},
): Promise<PageResult<AdminInspectionRow>> {
  return http.get<PageResult<AdminInspectionRow>>(`${QUALITY_BASE}/inspections`, {
    page: params.pageNum ?? 1,
    size: params.pageSize ?? 10,
    result: params.result,
  })
}

/** 查询不合格检测清单（GET /admin/quality/inspections/failed） */
export function fetchFailedInspections(): Promise<AdminInspectionRow[]> {
  return http.get<AdminInspectionRow[]>(`${QUALITY_BASE}/inspections/failed`)
}

/** 查询质量总览（GET /admin/quality/overview） */
export function fetchAdminQualityOverview(): Promise<AdminQualityOverview> {
  return http.get<AdminQualityOverview>(`${QUALITY_BASE}/overview`)
}

/** 不合格批次召回（POST /admin/quality/recalls?batchId=） */
export function recallQualityBatch(batchId: string): Promise<{ batchId?: string; status?: number }> {
  return http.post<{ batchId?: string; status?: number }>(
    `${QUALITY_BASE}/recalls`,
    undefined,
    { params: { batchId } },
  )
}

/** 溯源码码段统计（GET /admin/trace/code-stats） */
export function fetchAdminTraceCodeStats(): Promise<Record<string, number>> {
  return http.get<Record<string, number>>(`${BASE}/code-stats`)
}

/** 运营端溯源码分页查询参数 */
export interface AdminTraceCodePageParams {
  /** 状态过滤 generated / active / scanned / revoked */
  status?: string
  /** 页码，从 1 开始 */
  pageNum?: number
  /** 每页条数 */
  pageSize?: number
}

/** 运营端溯源码分页（GET /admin/trace/codes） */
export function fetchAdminTraceCodes(
  params: AdminTraceCodePageParams = {},
): Promise<PageResult<RawTraceCode>> {
  return http.get<PageResult<RawTraceCode>>(`${BASE}/codes`, {
    page: params.pageNum ?? 1,
    size: params.pageSize ?? 10,
    status: params.status,
  })
}

/** 全链条回溯（GET /admin/trace/chain?code=） */
export function fetchAdminTraceChain(code: string): Promise<AdminTraceChain> {
  return http.get<AdminTraceChain>(`${BASE}/chain`, { code })
}

/** 一键召回：作废码段并冻结批次（POST /admin/trace/recall?batchId=） */
export function recallAdminTraceBatch(batchId: string): Promise<number> {
  return http.post<number>(`${BASE}/recall`, undefined, { params: { batchId } })
}

/** 溯源链关联检测机构（GET /admin/trace/labs） */
export function fetchChainLabs(): Promise<
  Array<{ labId: string; labName: string; labType?: string; qualificationNo?: string }>
> {
  return http.get<
    Array<{ labId: string; labName: string; labType?: string; qualificationNo?: string }>
  >(`${BASE}/labs`)
}
