/**
 * 地块管理 API（含土壤检测档案）
 */
import { http } from '@/utils/request'
import type { PageQuery, PageResult } from '@/types'
import type { Plot, SoilTestRecord } from '@/types'

const BASE = '/plots'

/** 地块列表查询参数 */
export interface PlotListParams extends PageQuery {
  farmId?: string
  plotName?: string
  plantingType?: number
  /** 地块中心经度（后端 center_longitude 列；此前前端一直没映射，位置信息因此丢失） */
  centerLongitude?: number
  /** 地块中心纬度（后端 center_latitude 列） */
  centerLatitude?: number
  /** 边界 GeoJSON 字符串（后端 boundary 列） */
  boundary?: string
  status?: number
}

/** 地块新增 / 编辑入参 */
export type PlotPayload = Partial<Plot>

/** 分页查询地块列表 */
export function listPlots(params: PlotListParams): Promise<PageResult<Plot>> {
  return http.get<PageResult<Plot>>(BASE, params)
}

/** 查询地块详情 */
export function getPlot(plotId: string): Promise<Plot> {
  return http.get<Plot>(`${BASE}/${plotId}`)
}

/**
 * 新增地块（POST /plots）。
 *
 * 后端 `PlotController.create` 返回 `ApiResponse<String>`，即**新地块的 plotId**，不是实体。
 *
 * @param payload 地块入参
 * @returns 新地块 ID
 */
export function createPlot(payload: PlotPayload): Promise<string> {
  return http.post<string>(BASE, payload)
}

/** 更新地块 */
export function updatePlot(plotId: string, payload: PlotPayload): Promise<Plot> {
  return http.put<Plot>(`${BASE}/${plotId}`, payload)
}

/**
 * 启用 / 停用地块。

 *
 * <p>状态口径与页面一致：{@code 1 启用 / 0 停用}（库内落 {@code active / inactive}）。
 * **地块上有在种计划时停用会被后端拒**（400，消息里带计划名与 ID），
 * 调用方要把这条消息原样透给用户 —— 别吞掉，否则用户只知道"没成功"。</p>
 *
 * @param plotId 地块 ID
 * @param status 1 启用 / 0 停用
 * @returns 更新后的地块
 */
export function updatePlotStatus(plotId: string, status: number): Promise<Plot> {
  return http.patch<Plot>(`${BASE}/${plotId}/status?status=${status}`)
}

/**
 * 删除地块（DELETE /plots/{plotId}）。
 *
 * 后端返回 `ApiResponse<Void>`（data 为 null），成功与否由拦截器 reject 表达。
 */
export function deletePlot(plotId: string): Promise<void> {
  return http.delete<void>(`${BASE}/${plotId}`)
}

/* ============================================================================
 * 土壤检测档案
 *
 * 后端 `PlotController` 的真实契约（以 Controller 源码为准，不要凭前端习惯猜）：
 *   GET    /{plotId}/soil          → ApiResponse<PageResult<PlotSoilEntity>>  真分页，按 createdAt desc
 *   POST   /{plotId}/soil          → ApiResponse<String>                      返回新记录主键 soilId
 *   GET    /{plotId}/soil/{id}     → ApiResponse<PlotSoilEntity>              单条详情
 *   PUT    /{plotId}/soil/{id}     → ApiResponse<PlotSoilEntity>              更新后重查的完整实体
 *   DELETE /{plotId}/soil/{id}     → ApiResponse<Void>                        data 为 null
 *   GET    /{plotId}/soil/latest   → ApiResponse<PlotSoilEntity>              最近一次，**无记录时为 null**
 *   GET    /{plotId}/soil-tests    → ApiResponse<List<PlotSoilEntity>>        裸数组，不吃 page/size
 *
 * ⚠️ 两个曾经踩过的坑，改这段代码前务必先看：
 * 1. 写操作曾被打到 `/soil-tests` 上，后端**没有**这两个端点 → 404。写操作一律走 `/soil`。
 * 2. `/soil-tests` 返回**裸数组**，`request.ts` 的 `normalizePageData` 只在 `data.records`
 *    是数组时才归一化，裸数组会原样透传。因此 `listSoilTests` 的返回类型必须是数组，
 *    不能声明成 `PageResult`，否则调用方拿到的 `.list` / `.total` 全是 undefined。
 *    需要分页请用 `listSoilRecords`（打 `/soil`）。
 * ========================================================================== */

/**
 * 土壤检测新增 / 编辑请求体。
 *
 * ⚠️ 字段命名**对齐后端 `PlotSoilEntity`**（sampleDate / nitrogen / phosphorus /
 * potassium / tester / salinity …），**不是** `SoilTestRecord` 的命名
 * （testDate / totalNitrogen / availablePhosphorus / availablePotassium / testOrg）。
 * 后端 `@RequestBody` 只认这一套命名，用错会静默丢字段。
 */
export interface SoilCreatePayload {
  /** 土壤记录 ID（更新时可传，新增由服务端生成） */
  soilId?: string
  /** 地块 ID */
  plotId?: string
  /** 采样日期 */
  sampleDate?: string
  /** pH 值 */
  ph?: number
  /** 有机质 g/kg */
  organicMatter?: number
  /** 碱解氮 mg/kg */
  nitrogen?: number
  /** 有效磷 mg/kg */
  phosphorus?: number
  /** 速效钾 mg/kg */
  potassium?: number
  /** 含水率 % */
  moisture?: number
  /** 含盐量 g/kg */
  salinity?: number
  /** 检测人 */
  tester?: string
  /** 备注 */
  remark?: string
}

/** 查询土壤检测档案（裸数组，不分页；GET /{plotId}/soil-tests） */
export function listSoilTests(plotId: string): Promise<SoilTestRecord[]> {
  return http.get<SoilTestRecord[]>(`${BASE}/${plotId}/soil-tests`)
}

/** 分页查询土壤检测档案（GET /{plotId}/soil，真分页端点） */
export function listSoilRecords(
  plotId: string,
  params: PageQuery,
): Promise<PageResult<SoilTestRecord>> {
  return http.get<PageResult<SoilTestRecord>>(`${BASE}/${plotId}/soil`, params)
}

/** 查询单条土壤检测档案（GET /{plotId}/soil/{recordId}） */
export function getSoilTest(plotId: string, recordId: string): Promise<SoilTestRecord> {
  return http.get<SoilTestRecord>(`${BASE}/${plotId}/soil/${recordId}`)
}

/**
 * 查询该地块最近一次土壤检测档案（GET /{plotId}/soil/latest）。
 *
 * ⚠️ 后端 `PlotSoilService.latest()` 在无记录时**返回 null，不抛异常**
 * （`list.isEmpty() ? null : list.get(0)`），所以返回类型必须是可空的。
 * 声明成非空会让调用方的判空失效、页面直接拿 knockout。
 *
 * @param plotId 地块 ID
 * @returns 最近一次检测记录，无记录时为 null
 */
export function getLatestSoil(plotId: string): Promise<SoilTestRecord | null> {
  return http.get<SoilTestRecord | null>(`${BASE}/${plotId}/soil/latest`)
}

/**
 * 新增土壤检测档案（POST /{plotId}/soil）。
 *
 * 后端返回 `ApiResponse<String>`，即**新记录主键 soilId**，不是实体对象。
 *
 * @param plotId 地块 ID
 * @param payload 请求体，字段命名见 {@link SoilCreatePayload}
 * @returns 新记录主键
 */
export function createSoilTest(
  plotId: string,
  payload: SoilCreatePayload,
): Promise<string> {
  return http.post<string>(`${BASE}/${plotId}/soil`, payload)
}

/**
 * 更新土壤检测档案（PUT /{plotId}/soil/{recordId}）。
 *
 * 后端 `PlotController.updatePlotSoil` 返回 `ApiResponse<PlotSoilEntity>`；
 * `PlotSoilService.update` 内部 `updateById` 后**重新查询**并返回完整实体
 * （查不到会抛 NOT_FOUND），因此这里就是实体，不是主键。
 *
 * @param plotId 地块 ID
 * @param recordId 土壤记录 ID
 * @param payload 请求体，字段命名见 {@link SoilCreatePayload}
 * @returns 更新后的完整记录
 */
export function updateSoilTest(
  plotId: string,
  recordId: string,
  payload: SoilCreatePayload,
): Promise<SoilTestRecord> {
  return http.put<SoilTestRecord>(`${BASE}/${plotId}/soil/${recordId}`, payload)
}

/**
 * 删除土壤检测档案（DELETE /{plotId}/soil/{recordId}）。
 *
 * 后端返回 `ApiResponse<Void>`（data 为 null），成功与否由拦截器 reject 表达，
 * 因此这里用 `Promise<void>` 而不是 `Promise<boolean>`——声明成 boolean 会拿到 null。
 */
export function deleteSoilTest(plotId: string, recordId: string): Promise<void> {
  return http.delete<void>(`${BASE}/${plotId}/soil/${recordId}`)
}
