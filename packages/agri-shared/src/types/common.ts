/**
 * 通用基础类型定义
 */

/** 通用启停状态：1 正常 / 0 停用 */
export type EnableStatus = 0 | 1

/**
 * 业务主键类型
 *
 * 后端两套主键并存，前端统一用联合类型承接，避免路径拼接时类型不匹配：
 * - 新建表（V2 建表）：`varchar(32)` 业务主键，JSON 中为字符串，如 farmId / plotId / taskId
 * - 存量表（V1 ALTER 补字段，6 张）：雪花 `Long`，JSON 中为数字，如 prod_batch / prod_device /
 *   prod_plot / prod_trace_code / prod_quality_report / prod_iot_alert
 * 因此列表查询入参、路径参数均按 `BizId` 处理，实际取值由后端决定。
 */
export type BizId = string | number

/**
 * 存量表主键（V1 雪花 Long）
 *
 * 仅 5 张存量表有端点命中：`prod_batch`(/batches)、`prod_device`(/devices)、
 * `prod_trace_code`(/trace 的实体 id，但端点用 code 定位)、`prod_quality_report`(/quality/reports)、
 * `prod_iot_alert`(/iot/alerts)。`prod_plot` 是孤儿表，无端点，前端不涉及。
 */
export type LegacyId = number

/**
 * 存量生产批次体系标识（`/batches`、`/trace/**`、`/quality/reports`、`/admin/trace/recall` 等）
 *
 * ⚠️ 重要：这是「数据归属哪套批次体系」的**语义标记**，不是接口传参类型。
 * 后端 Controller 方法签名里所有 batchId 入参**一律声明为 String**
 * （如 `QualityController.inspectionsByBatch(@RequestParam String batchId)`、
 *   `AdminTraceController.recall(@RequestParam String batchId)`、
 *   `HarvestController.detail(@PathVariable String id)`），
 * 因此**接口调用位置一律用 `string`**，本别名只在文档/注释层面说明数据归属，禁止用于接口入参类型。
 * 数据库层面该体系主键为 bigint（V1 存量 `prod_batch.id` 雪花 Long），与 Controller 签名分叉，属正常。
 */
export type LegacyBatchId = string

/**
 * 新建表采收批次体系标识（`/harvests/**`、`/quality/inspections/by-batch` 等）
 *
 * 同 LegacyBatchId：仅作数据归属的语义标记，接口传参一律 `string`。
 * 数据库层面为 `prod_harvest_batch.batch_id` varchar(32)。
 */
export type HarvestBatchId = string

/** 溯源码业务值（`/trace/{code}`，定位用 code 而非实体 id） */
export type TraceCodeValue = string

/**
 * 分页查询参数（列表页统一入参）
 *
 * 与后端 shared-kernel PageParam 对齐使用 `page` / `size`。
 * 注意：`sortBy` / `sortOrder` 骨架阶段后端暂不生效（不会报错，仅不排序），排序能力下一轮补齐。
 * `tenantId` / `marketId` 由后端自动填充，前端禁止传入。
 */
export interface PageQuery {
  /**
   * 页码，从 1 开始。
   * 后端主参数名是 `page`，`pageNum` 由 PageParamAliasFilter 兼容，两者等价；
   * 当前页面填充阶段统一用 `pageNum`，待 75 个页面填充完成后再整体切到 `page`。
   */
  pageNum: number
  /** 每页条数。后端主参数名是 `size`，`pageSize` 为等价别名，同上。 */
  pageSize: number
  /** 页码标准名，与 pageNum 等价，二选一传入即可 */
  page?: number
  /** 每页条数标准名，与 pageSize 等价，二选一传入即可 */
  size?: number
  /** 关键字搜索 */
  keyword?: string
  /** 排序字段（骨架阶段后端暂忽略） */
  sortBy?: string
  /** 排序方向（骨架阶段后端暂忽略） */
  sortOrder?: 'ascend' | 'descend'
}

/**
 * 分页返回结果
 *
 * 后端 shared-kernel PageResult 原始结构为 `{ records, total, page, size }`，
 * 已在 axios 响应拦截器中归一化（normalizePageData）为本结构，页面直接消费 list。
 */
export interface PageResult<T> {
  /** 当前页码，从 1 开始 */
  pageNum: number
  /** 每页条数 */
  pageSize: number
  /** 总条数 */
  total: number
  /** 总页数（后端不返回，前端按 total / pageSize 计算） */
  pages: number
  /** 数据列表（后端字段 records） */
  list: T[]
}

/**
 * 审计与逻辑删除字段
 *
 * 注意与 PRD 文档的口径差异（以实际落库为准）：
 * - 逻辑删除字段实际名为 **`deleted`**（0 未删除 / 1 已删除），PRD 文档中的 `del_flag` 已过时
 * - 新建表时间字段为 `create_at` / `update_at`
 * - V1 存量表时间字段为 `created_at` / `updated_at`
 * 两套并存，前端统一按 camelCase 的 createdAt / updatedAt 消费。
 */
export interface AuditFields {
  /** 逻辑删除标记：0 未删除 / 1 已删除 */
  deleted?: 0 | 1
  /** 创建时间 */
  createdAt?: string
  /** 更新时间 */
  updatedAt?: string
}

/** 通用审核状态 */
export type AuditStatus = 'draft' | 'pending' | 'approved' | 'rejected'

/** 时间区间查询参数 */
export interface DateRangeQuery {
  /** 开始日期，格式 yyyy-MM-dd */
  startDate?: string
  /** 结束日期，格式 yyyy-MM-dd */
  endDate?: string
}

/** 通用下拉选项 */
export interface OptionItem<V = string> {
  /** 选项值 */
  value: V
  /** 选项展示文案 */
  label: string
}
