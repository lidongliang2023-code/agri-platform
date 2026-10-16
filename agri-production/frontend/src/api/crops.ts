/**
 * 作物主数据 API（页面「作物管理」+ 种养计划 / 地块的作物下拉）
 *
 * <p>作物是**租户级主数据**（同一租户共用一套），落库在后端 {@code agri_prod_crop_info}。
 * 此前作物是自由文本，计划的 {@code crop_id} 恒空 —— 这个接口层就是为了把作物接成可选的主数据。</p>
 */
import { http } from '@/utils/request'
import type { PageQuery, PageResult } from '@/types'

const BASE = '/crops'

/** 作物主数据 */
export interface Crop {
  /** 作物主键（页面 cropId，字符串） */
  cropId: string
  /** 作物编码（同租户内唯一，如 CROP-0001） */
  cropCode: string
  /** 作物名称（计划 / 地块的作物列显示的就是它） */
  cropName: string
  /** 作物类别（可空） */
  cropCategory?: string
  /** 生长周期（天，可空） */
  growthCycleDays?: number
  /** 计量单位（可空） */
  measurementUnit?: string
  /** 1 启用 / 0 停用（停用后不在下拉里出现） */
  status: number
  /** 排序号 */
  sortNo?: number
  /** 备注 */
  remark?: string
  /** 创建时间 */
  createTime?: string
  /** 更新时间 */
  updateTime?: string
}

/** 作物下拉选项（{@code GET /crops/options}，裸数组） */
export interface CropOption {
  cropId: string
  cropCode: string
  cropName: string
  cropCategory?: string
}

/** 作物列表查询参数 */
export interface CropListParams extends PageQuery {
  keyword?: string
  status?: number
}

/** 作物新增 / 编辑入参 */
export type CropPayload = Partial<Crop>

/** 分页查询作物 */
export function listCrops(params: CropListParams): Promise<PageResult<Crop>> {
  return http.get<PageResult<Crop>>(BASE, params)
}

/**
 * 作物下拉选项（只给启用中的）。

 *
 * <p>出参是**裸数组**，不是分页结构 —— 拿不到时返回空数组，由页面提示"没有可选作物"，
 * 不塞假选项（与地块 / 负责人下拉同口径）。</p>
 */
export async function listCropOptions(): Promise<CropOption[]> {
  try {
    const raw = await http.get<unknown>(`${BASE}/options`, undefined, { silent: true })
    return Array.isArray(raw) ? (raw as CropOption[]) : []
  } catch {
    return []
  }
}

/** 新增作物（返回新作物主键字符串） */
export function createCrop(payload: CropPayload): Promise<string> {
  return http.post<string>(BASE, payload)
}

/** 修改作物 */
export function updateCrop(cropId: string, payload: CropPayload): Promise<Crop> {
  return http.put<Crop>(`${BASE}/${cropId}`, payload)
}

/** 启用 / 停用作物 */
export function updateCropStatus(cropId: string, status: number): Promise<Crop> {
  return http.patch<Crop>(`${BASE}/${cropId}/status?status=${status}`)
}

/** 删除作物（逻辑删除；已被种养计划引用时后端会拒绝，提示改用停用） */
export function deleteCrop(cropId: string): Promise<void> {
  return http.delete<void>(`${BASE}/${cropId}`)
}
