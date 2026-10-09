/**
 * 质量管理 API（检测 / 分级）
 */
import { http } from '@/utils/request'
import type { PageQuery, PageResult } from '@/types'
import type { InspectionItem, QualityGradeRule, QualityInspection } from '@/types'
/* 页面补充类型（追加导入，不改动既有定义） */
import type {
  InspectionItemDetail,
  RawInspection,
  TestingLab,
} from '@/types'

const BASE = '/quality'

/** 检测单列表查询参数 */
export interface InspectionListParams extends PageQuery {
  farmId?: string
  batchId?: string
  inspectType?: number
  inspectResult?: number
  startDate?: string
  endDate?: string
}

/** 分页查询质量检测单 */
export function listInspections(
  params: InspectionListParams,
): Promise<PageResult<QualityInspection>> {
  return http.get<PageResult<QualityInspection>>(
    `${BASE}/inspections`,
    params,
  )
}

/** 查询质量检测单详情 */
export function getInspection(inspectionId: string): Promise<QualityInspection> {
  return http.get<QualityInspection>(`${BASE}/inspections/${inspectionId}`)
}

/** 新增质量检测单 */
export function createInspection(
  payload: Partial<QualityInspection>,
): Promise<string> {
  return http.post<string>(`${BASE}/inspections`, payload)
}

/** 更新质量检测单 */
export function updateInspection(
  inspectionId: string,
  payload: Partial<QualityInspection>,
): Promise<QualityInspection> {
  return http.put<QualityInspection>(`${BASE}/inspections/${inspectionId}`, payload)
}

/** 删除质量检测单 */
export function deleteInspection(inspectionId: string): Promise<void> {
  return http.delete<void>(`${BASE}/inspections/${inspectionId}`)
}

/** 查询检测项明细 */
export function listInspectionItems(inspectionId: string): Promise<InspectionItem[]> {
  return http.get<InspectionItem[]>(`${BASE}/inspections/${inspectionId}/items`)
}

/** 分页查询质量分级规则 */
export function listGradeRules(
  params: PageQuery & { cropId?: string; status?: number },
): Promise<PageResult<QualityGradeRule>> {
  return http.get<PageResult<QualityGradeRule>>(
    `${BASE}/grading`,
    params,
  )
}

/** 新增质量分级规则 */
export function createGradeRule(payload: Partial<QualityGradeRule>): Promise<QualityGradeRule> {
  return http.post<QualityGradeRule>(`${BASE}/grading`, payload)
}

/** 更新质量分级规则 */
export function updateGradeRule(
  ruleId: string,
  payload: Partial<QualityGradeRule>,
): Promise<QualityGradeRule> {
  return http.put<QualityGradeRule>(`${BASE}/grading/${ruleId}`, payload)
}

/** 删除质量分级规则 */
export function deleteGradeRule(ruleId: string): Promise<boolean> {
  return http.delete<boolean>(`${BASE}/grading/${ruleId}`)
}

/* -------------------------------------------------------------------------- *
 * 以下方法为「质量检测记录 / 质量分级管理」页面补充，
 * 路径与后端 QualityController（/api/v1/production/quality）真实接口一一对齐：
 * - 分页入参统一转换为后端要求的 page / size；
 * - 检测单状态为 PENDING / TESTING / DONE，结论为 PASS / FAIL。
 * -------------------------------------------------------------------------- */

/** 检测单分页查询参数（对齐后端 page / size / keyword / status） */
export interface InspectionPageParams {
  /** 检测单号关键字 */
  keyword?: string
  /** 状态过滤：PENDING / TESTING / DONE */
  status?: string
  /** 页码，从 1 开始 */
  pageNum?: number
  /** 每页条数 */
  pageSize?: number
}

/** 分页查询检测单（后端 GET /quality/inspections?page&size&keyword&status） */
export function fetchInspectionPage(
  params: InspectionPageParams = {},
): Promise<PageResult<RawInspection>> {
  return http.get<PageResult<RawInspection>>(`${BASE}/inspections`, {
    page: params.pageNum ?? 1,
    size: params.pageSize ?? 10,
    keyword: params.keyword,
    status: params.status,
  })
}

/** 送检登记：新增检测单（后端 POST /quality/inspections，返回检测单 ID） */
export function registerInspection(payload: Partial<RawInspection>): Promise<string> {
  return http.post<string>(`${BASE}/inspections`, payload)
}

/** 更新检测单（后端 PUT /quality/inspections/{id}） */
export function saveInspection(
  inspectionId: string,
  payload: Partial<RawInspection>,
): Promise<RawInspection> {
  return http.put<RawInspection>(`${BASE}/inspections/${inspectionId}`, payload)
}

/**
 * 提交检测结论（后端 POST /quality/inspections/{id}/result）
 *
 * 结论为 PASS 时联动 prod.quality.test.passed，FAIL 时联动 prod.quality.test.failed。
 */
export function submitInspectionResult(
  inspectionId: string,
  result: string,
  reportUrl?: string,
): Promise<RawInspection> {
  return http.post<RawInspection>(`${BASE}/inspections/${inspectionId}/result`, undefined, {
    params: { result, reportUrl },
  })
}

/** 查询批次下的检测记录（后端 GET /quality/inspections/by-batch?batchId=） */
export function listInspectionsByBatch(batchId: string): Promise<RawInspection[]> {
  return http.get<RawInspection[]>(`${BASE}/inspections/by-batch`, { batchId })
}

/** 查询检测项明细（后端 GET /quality/inspections/{id}/items） */
export function fetchInspectionItems(inspectionId: string): Promise<InspectionItemDetail> {
  return http.get<InspectionItemDetail>(`${BASE}/inspections/${inspectionId}/items`)
}

/** 检测机构分页查询参数 */
export interface LabPageParams {
  /** 机构名称关键字 */
  keyword?: string
  /** 合作状态：1 合作中 0 已终止 */
  status?: number
  /** 页码，从 1 开始 */
  pageNum?: number
  /** 每页条数 */
  pageSize?: number
}

/** 分页查询检测机构（后端 GET /quality/labs?page&size&keyword&status） */
export function fetchLabPage(params: LabPageParams = {}): Promise<PageResult<TestingLab>> {
  return http.get<PageResult<TestingLab>>(`${BASE}/labs`, {
    page: params.pageNum ?? 1,
    size: params.pageSize ?? 100,
    keyword: params.keyword,
    status: params.status,
  })
}

/** 查询合作中的检测机构（后端 GET /quality/labs/active） */
export function fetchActiveLabs(): Promise<TestingLab[]> {
  return http.get<TestingLab[]>(`${BASE}/labs/active`)
}

/** 查询分级统计（后端 GET /quality/grading，返回 { PASS: n, FAIL: n }） */
export function fetchGradingStats(): Promise<Record<string, number>> {
  return http.get<Record<string, number>>(`${BASE}/grading`)
}
