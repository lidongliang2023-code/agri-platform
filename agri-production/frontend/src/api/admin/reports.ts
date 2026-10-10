/**
 * 运营端 - 统计报表 API
 *
 * ⚠️ 契约诚实口径（对照后端源码核验，2026-10）：
 * 后端唯一的报表控制器是
 * `core-platform/mod-produce/.../internal/admin/AdminReportController.java`，
 * 基址 `/api/v1/production/admin/reports`，返回实体只有
 * `ReportTaskEntity`（同目录 ReportTaskEntity.java），字段为：
 *   reportId / reportType / reportName / farmId / bizDateFrom / bizDateTo /
 *   generatorId / fileUrl / generatedAt / status
 * **没有任何「报表内容统计」端点**：产量、面积、完成率、合格率、在线率等
 * 均不在后端数据契约内。本文件因此不再声明 `period` / `tenantId` / `fileSize`
 * 等后端不消费、不返回的字段。
 */
import { http, toPageResult } from '@/utils/request'
import type { PageQuery, PageResult } from '@/types'
import type { ReportItem } from '@/types'

const BASE = '/admin/reports'

/**
 * 服务端报表任务（`ReportTaskEntity`）的真实形状。
 *
 * 字段集合与后端实体一一对应；一律声明为可选，因为除 reportId 外后端均未做
 * 非空约束（见 V2__produce_domain.sql 中 prod_report_task 的建表语句）。
 */
export interface ReportTask {
  /** 报表编号（业务主键） */
  reportId: string
  /** 报表类型，后端取值为 GOV / BIZ / QUALITY */
  reportType?: string
  /** 报表名称 */
  reportName?: string
  /** 农场编号，空表示全量 */
  farmId?: string
  /** 统计起始日 yyyy-MM-dd */
  bizDateFrom?: string
  /** 统计截止日 yyyy-MM-dd */
  bizDateTo?: string
  /** 生成人 */
  generatorId?: string
  /** 服务端回填的文件地址字符串（可能为不可解析路径） */
  fileUrl?: string
  /** 生成时间 */
  generatedAt?: string
  /** 状态 PENDING / RUNNING / DONE / FAILED */
  status?: string
}

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

/**
 * 分页查询生产（监管）报表任务。
 *
 * 后端 `GET /admin/reports/production` = `listByType("GOV")`，签名是
 * `production()` —— **不接受任何入参**，直接返回 `List<ReportTaskEntity>` 裸数组。
 * 因此：
 * - 分页入参不会下发到服务端，这里用 `toPageResult` 做**前端切片分页**；
 * - `total` 是服务端真实全量行数，`list` 只是当前页切片（详见 utils/request.ts）。
 */
export async function listProductionReports(params: PageQuery): Promise<PageResult<ReportTask>> {
  const raw = await http.get<unknown>(`${BASE}/production`)
  return toPageResult<ReportTask>(raw, params)
}

/**
 * 分页查询质量报表任务。
 *
 * ⚠️ 实测（core-app 直连）：`GET /api/v1/production/admin/reports/quality`
 * 返回 `{ code: 0, data: [...] }`——`data` 是**裸数组**而非 PageResult
 * （后端 AdminReportController#quality 直接返回 List，且不接受 page/size）。
 * 裸数组不会被响应拦截器归一化，调用方拿不到 `list`。用 `toPageResult` 补成
 * 分页结构，函数签名保持不变，页面（AdminQualityReport.tsx）无需改动。
 */
export async function listQualityReports(params: PageQuery): Promise<PageResult<ReportTask>> {
  const raw = await http.get<unknown>(`${BASE}/quality`)
  return toPageResult<ReportTask>(raw, params)
}

/**
 * 新建报表任务（真实写端点 `POST /admin/reports`）。
 *
 * 后端 `AdminReportController#create` 接收 `ReportTaskEntity` 并返回报表编号字符串；
 * `ReportTaskService#create` 在未传 reportId 时自动生成 `RPT` 前缀主键，
 * marketId / tenantId 由 MyMetaObjectHandler 自动填充。
 *
 * ⚠️ 这里**不**顺势调用 `POST /{reportId}/generate`：该端点的服务端实现
 * （ReportTaskService#generate）只是把状态改成 DONE、回填一个 `/report/{id}.xlsx`
 * 字符串，**并不产出任何真实报表文件**，调用它等于向用户谎称「已生成」。
 *
 * @param payload 任务字段（reportId 留空时由服务端生成）
 * @returns 服务端返回的报表编号
 */
export function createReportTask(payload: Partial<ReportTask>): Promise<string> {
  return http.post<string>(BASE, payload)
}

/** 删除报表 */
export function deleteAdminReport(reportId: string): Promise<void> {
  return http.delete<void>(`${BASE}/${reportId}`)
}
