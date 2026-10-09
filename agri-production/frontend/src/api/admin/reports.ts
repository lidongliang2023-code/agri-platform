/**
 * 运营端 - 统计报表 API
 */
import { http } from '@/utils/request'
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

/** 分页查询质量报表 */
export function listQualityReports(
  params: PageQuery & { period?: string; tenantId?: string },
): Promise<PageResult<ReportItem>> {
  return http.get<PageResult<ReportItem>>(`${BASE}/quality`, params)
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
