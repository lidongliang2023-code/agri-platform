/**
 * 运营端 - 统计报表 API
 */
import { http, toPageResult } from '@/utils/request'
import type { PageQuery, PageResult } from '@/types'
import type { ReportItem } from '@/types'

const BASE = '/admin/reports'

/** 报表中心统计项 */
export interface ReportCenterStat {
  /** 报表总数 */
  totalCount: number
  /** 本月生成数量 */
  monthCount: number
  /** 已下载次数 */
  downloadCount: number
  /** 生成失败数量 */
  failedCount: number
}

/** 查询报表中心统计 */
export function getReportCenterStat(): Promise<ReportCenterStat> {
  return http.get<ReportCenterStat>(`${BASE}/stat`)
}

/** 分页查询报表中心列表 */
export function listAdminReports(
  params: PageQuery & { reportType?: number; period?: string; tenantId?: string },
): Promise<PageResult<ReportItem>> {
  return http.get<PageResult<ReportItem>>(BASE, params)
}

/** 查询报表详情 */
export function getAdminReport(reportId: string): Promise<ReportItem> {
  return http.get<ReportItem>(`${BASE}/${reportId}`)
}

/** 分页查询生产报表 */
export function listProductionReports(
  params: PageQuery & { period?: string; tenantId?: string },
): Promise<PageResult<ReportItem>> {
  return http.get<PageResult<ReportItem>>(
    `${BASE}/production`,
    params,
  )
}

/** 生成生产报表 */
export function generateProductionReport(payload: {
  period: string
  tenantId?: string
}): Promise<ReportItem> {
  return http.post<ReportItem>(`${BASE}/production`, payload)
}

/**
 * 分页查询质量报表
 *
 * ⚠️ 实测（core-app 直连）：`GET /api/v1/production/admin/reports/quality`
 * 返回 `{ code: 0, data: [...] }`——`data` 是**裸数组**而非 PageResult
 * （后端 AdminReportController#quality 直接返回 List，且不接受 page/size）。
 * 裸数组不会被响应拦截器归一化，调用方拿不到 `list`。用 `toPageResult` 补成
 * 分页结构，函数签名保持不变，页面（AdminQualityReport.tsx）无需改动。
 */
export async function listQualityReports(
  params: PageQuery & { period?: string; tenantId?: string },
): Promise<PageResult<ReportItem>> {
  const raw = await http.get<unknown>(`${BASE}/quality`, params)
  return toPageResult<ReportItem>(raw, params)
}

/** 生成质量报表 */
export function generateQualityReport(payload: {
  period: string
  tenantId?: string
}): Promise<ReportItem> {
  return http.post<ReportItem>(`${BASE}/quality`, payload)
}

/** 删除报表 */
export function deleteAdminReport(reportId: string): Promise<void> {
  return http.delete<void>(`${BASE}/${reportId}`)
}
