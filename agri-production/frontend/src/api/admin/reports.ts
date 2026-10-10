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

/**
 * 报表中心统计项。
 *
 * ⚠️ 实测（core-app :8097）：后端 `AdminReportController` **没有** `/stat` 端点，
 * 该路径会被 `@GetMapping("/{id}")` 吞掉 → `detail("stat")` 抛 NOT_FOUND。
 * 即本调用当前**必然失败**。因此这里不再静默回落示例数字，而是把不可用原因一并返回，
 * 由页面显示失败态（模板见 `src/api/settings.ts` 的 listOperationLogs）。
 */
export interface ReportCenterStat {
  /** 报表总数 */
  totalCount: number
  /** 本月生成数量 */
  monthCount: number
  /** 已下载次数 */
  downloadCount: number
  /** 生成失败数量 */
  failedCount: number
  /**
   * 接口不可用原因。
   *
   * 非空表示本次**没有拿到任何真实统计**，页面必须显式告知用户「未接入」并显示为「—」，
   * **不得**用示例数字顶上——那会让「接口挂了」看起来和「有 128 份本月报表」一模一样。
   */
  unavailableReason?: string
}

/** 报表中心统计接口返回的原始字段（不含不可用原因） */
type RawReportCenterStat = Omit<ReportCenterStat, 'unavailableReason'>

/** 查询报表中心统计（失败时返回不可用原因，不返回编造数字） */
export async function getReportCenterStat(): Promise<ReportCenterStat> {
  try {
    const res = await http.get<RawReportCenterStat>(`${BASE}/stat`, undefined, { silent: true })
    if (res && typeof res === 'object' && typeof res.totalCount === 'number') {
      return {
        totalCount: res.totalCount,
        monthCount: res.monthCount ?? 0,
        downloadCount: res.downloadCount ?? 0,
        failedCount: res.failedCount ?? 0,
      }
    }
    return {
      totalCount: 0,
      monthCount: 0,
      downloadCount: 0,
      failedCount: 0,
      unavailableReason: `后端 ${BASE}/stat 已请求成功，但未返回可识别的统计字段（缺少 totalCount）`,
    }
  } catch (error) {
    return {
      totalCount: 0,
      monthCount: 0,
      downloadCount: 0,
      failedCount: 0,
      unavailableReason: `报表中心统计接口不可用：${(error as Error)?.message ?? '请求失败'}`,
    }
  }
}

/** 报表中心列表分页结果（附带「接口不可用」原因，供页面显式降级提示） */
export interface AdminReportPage extends PageResult<ReportTask> {
  /** 非空表示本次没有拿到任何真实报表任务，页面必须显示失败态而非空列表冒充「没有报表」 */
  unavailableReason?: string
}

/**
 * 分页查询报表中心列表。
 *
 * 后端 `AdminReportController#page` 只接受 `page / size / keyword / status` 四个入参，
 * 因此这里不再声明后端不消费的 `reportType` / `period` / `tenantId`。
 */
export async function listAdminReports(
  params: PageQuery & { keyword?: string; status?: string },
): Promise<AdminReportPage> {
  const empty: AdminReportPage = {
    pageNum: params.pageNum ?? 1,
    pageSize: params.pageSize ?? 10,
    total: 0,
    pages: 0,
    list: [],
  }
  try {
    const res = await http.get<PageResult<ReportTask>>(BASE, params, { silent: true })
    if (res && Array.isArray(res.list)) {
      return { ...res }
    }
    return {
      ...empty,
      unavailableReason: `后端 ${BASE} 返回结构不是分页数据（缺少 list 数组）`,
    }
  } catch (error) {
    return {
      ...empty,
      unavailableReason: `报表任务列表接口不可用：${(error as Error)?.message ?? '请求失败'}`,
    }
  }
}

/**
 * 查询报表详情。
 *
 * ⚠️ 历史实现声明返回 `ReportItem`（报表中心那套：period / fileSize /
 * generatorName / status 为 1|2|3），但后端 `AdminReportController#detail`
 * 返回的是 `ReportTaskEntity`——两套字段**零交集**。照 `ReportItem` 取值只会
 * 拿到一对象 undefined，属于"端点在、但契约错"。
 *
 * 成对实测（core-app :8098，同一基址、只换 id，排除"路径不存在"这个干扰项）：
 *   `GET /admin/reports/DEMO-RPT-002` → code=0，data 为完整 ReportTaskEntity
 *     （reportType=GOV / bizDateFrom=2026-01-01 / generatorId=SUPER_ADMIN / status=PENDING）
 *   `GET /admin/reports/NOPE-NOPE`    → code=404 资源不存在
 * 说明端点真实存在、数据真实，因此**修契约为 `ReportTask`，不删函数**
 * （"零调用方"只在端点不存在时才构成删除理由；留着错误契约会被复制粘贴扩散）。
 *
 * @param reportId 报表编号
 * @returns 报表任务（后端实体形状）
 */
export function getAdminReport(reportId: string): Promise<ReportTask> {
  return http.get<ReportTask>(`${BASE}/${reportId}`)
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
