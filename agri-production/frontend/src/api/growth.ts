/**
 * 生长监测 API（生长记录 / 环境数据）
 */
import { http } from '@/utils/request'
import type { IotReading } from '@/api/iot'
import type { PageQuery, PageResult } from '@/types'
import type { EnvironmentData, GrowthRecord } from '@/types'

const BASE = '/growth'

/** 生长记录列表查询参数 */
export interface GrowthListParams extends PageQuery {
  farmId?: string
  plotId?: string
  planId?: string
  growthStage?: string
  startDate?: string
  endDate?: string
}

/** 分页查询生长记录 */
export function listGrowthRecords(
  params: GrowthListParams,
): Promise<PageResult<GrowthRecord>> {
  return http.get<PageResult<GrowthRecord>>(`${BASE}/records`, params)
}

/** 查询生长记录详情 */
export function getGrowthRecord(recordId: string): Promise<GrowthRecord> {
  return http.get<GrowthRecord>(`${BASE}/records/${recordId}`)
}

/** 新增生长记录 */
export function createGrowthRecord(payload: Partial<GrowthRecord>): Promise<string> {
  return http.post<string>(`${BASE}/records`, payload)
}

/** 更新生长记录 */
export function updateGrowthRecord(
  recordId: string,
  payload: Partial<GrowthRecord>,
): Promise<GrowthRecord> {
  return http.put<GrowthRecord>(`${BASE}/records/${recordId}`, payload)
}

/** 删除生长记录 */
export function deleteGrowthRecord(recordId: string): Promise<boolean> {
  return http.delete<boolean>(`${BASE}/records/${recordId}`)
}

/** 分页查询环境数据 */
export function listEnvironmentData(
  params: PageQuery & { plotId?: string; deviceId?: string; startDate?: string; endDate?: string },
): Promise<PageResult<EnvironmentData>> {
  return http.get<PageResult<EnvironmentData>>(
    `${BASE}/environment`,
    params,
  )
}

/**
 * 环境趋势视图对象（对齐后端 `EnvTrendVO`）。
 *
 * 后端把窄表读数（一行一个 metric + metricValue）按「日期 × 指标」透视成该结构，
 * 缺失点位为 `null`，**不补 0**。
 */
export interface EnvTrendVO {
  /** 日期序列（yyyy-MM-dd，升序） */
  dates: string[]
  /** 指标码（snake_case，如 air_temperature）→ 与 dates 等长的数值序列 */
  series: Record<string, (number | null)[]>
  /** `series.air_temperature` 的别名，兼容既有单指标调用 */
  temperatures: (number | null)[]
}

/**
 * 查询地块环境趋势（多指标聚合）。
 *
 * 这是「按地块看环境曲线」的**推荐端点**：后端已把窄表透视成
 * `{ dates, series, temperatures }`，前端可直接喂给折线图。
 *
 * @param plotId 地块业务主键
 * @param options 可选过滤：逗号分隔指标名 / 起止日期（yyyy-MM-dd）
 * @returns 环境趋势视图对象
 */
export function getEnvironmentHistory(
  plotId: string,
  options: { metrics?: string; startDate?: string; endDate?: string } = {},
): Promise<EnvTrendVO> {
  return http.get<EnvTrendVO>(`${BASE}/environment/history`, {
    plotId,
    ...options,
  })
}

/**
 * 查询环境数据趋势（原始窄表行）。
 *
 * @deprecated 后端 `GET /growth/environment/trend` 返回的是
 * `IotReadingEntity[]`（窄表：`readTime` + `metricValue` + `metric`），
 * **不是** `{ date, value }[]`。需要画曲线的场景请改用
 * {@link getEnvironmentHistory}（返回已透视的 `EnvTrendVO`）。
 * 本函数在调用方完成迁移前保留，返回值按真实结构标注为 `IotReading[]`。
 *
 * @param params 过滤条件：地块 / 设备 / 指标 / 起止日期
 * @returns 原始读数列表（按采集时间升序）
 */
export function getEnvironmentTrend(params: {
  plotId?: string
  deviceId?: string
  metric?: string
  startDate?: string
  endDate?: string
}): Promise<IotReading[]> {
  return http.get<IotReading[]>(`${BASE}/environment/trend`, params)
}

/** 查询生长监测总览统计 */
export function getGrowthOverview(farmId?: string): Promise<Record<string, number>> {
  return http.get<Record<string, number>>(`${BASE}/overview`, { farmId })
}

/* ============================================================================
 * 以下为「生长监测页面填充」追加内容，纯新增，不改动既有定义。
 * ========================================================================== */

/** 按地块查询生长记录（GET /growth/by-plot，返回纯数组） */
export function listGrowthRecordsByPlot(plotId: string): Promise<GrowthRecord[]> {
  return http.get<GrowthRecord[]>(`${BASE}/by-plot`, { plotId })
}

/** 查询病虫害记录（GET /growth/pest，返回纯数组；level 越小病虫害越严重） */
export function listPestGrowthRecords(level = 1): Promise<GrowthRecord[]> {
  return http.get<GrowthRecord[]>(`${BASE}/pest`, { level })
}

/** 查询地块生长总览（GET /growth/overview?plotId=，返回 Map） */
export function getGrowthOverviewByPlot(
  plotId?: string,
): Promise<Record<string, unknown>> {
  return http.get<Record<string, unknown>>(`${BASE}/overview`, { plotId })
}

/**
 * 解析生长记录照片地址。
 *
 * 后端 `photos` 字段为字符串（JSON 数组或逗号分隔），前端实体类型为 `photoUrls: string[]`，
 * 此处统一归一为数组，兼容两种形态。
 *
 * @param record 生长记录
 * @returns 照片地址列表
 */
export function resolveGrowthPhotos(record: GrowthRecord): string[] {
  const raw = (record as unknown as { photos?: unknown }).photos
  const source = Array.isArray(record.photoUrls)
    ? record.photoUrls
    : typeof raw === 'string'
      ? raw
      : Array.isArray(raw)
        ? (raw as string[])
        : []
  if (Array.isArray(source)) {
    return source.filter((item): item is string => typeof item === 'string' && item.length > 0)
  }
  const text = source.trim()
  if (!text) return []
  try {
    const parsed: unknown = JSON.parse(text)
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0)
    }
  } catch {
    // 非 JSON，按逗号分隔解析
  }
  return text
    .split(/[,，\s]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}
