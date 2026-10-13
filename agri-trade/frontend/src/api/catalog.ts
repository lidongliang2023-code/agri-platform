import axios from 'axios'

/**
 * 商品违规与品类管理（运营端）。
 *
 * 品类读接口用户侧也有（发布货源时取品类用），写接口只在这里 ——
 * 原先写接口挂在用户侧路径且没有角色校验，任何登录用户都能改全平台的分类体系。
 */
export interface CategoryRow {
  id: number
  parentId: number | null
  categoryName: string
  categoryCode: string
  level: number
  sortOrder: number
  status: number
  remark: string
  createTime: string
}

export interface ViolationRow {
  id: number
  violationNo: string
  productId: number
  productName: string
  sellerId: number
  sellerName: string
  violationType: string
  reason: string
  action: string
  violationStatus: string
  previousPublishStatus: string
  operator: string
  revokeTime: string
  revokeReason: string
  createTime: string
}

export interface ProductOption {
  id: number
  productName: string
  sellerName: string
  publishStatus: string
}

export async function getCategories(params: { pageNum: number; pageSize: number; status?: number }) {
  const response = await axios.get('/api/trade/admin/category/page', { params })
  return response.data
}

export async function createCategory(data: Partial<CategoryRow>) {
  const response = await axios.post('/api/trade/admin/category', data)
  return response.data
}

export async function updateCategory(id: number, data: Partial<CategoryRow>) {
  const response = await axios.put(`/api/trade/admin/category/${id}`, data)
  return response.data
}

export async function deleteCategory(id: number) {
  const response = await axios.delete(`/api/trade/admin/category/${id}`)
  return response.data
}

export async function getViolations(params: { pageNum: number; pageSize: number; violationStatus?: string; productName?: string }) {
  const response = await axios.get('/api/trade/admin/violation/page', { params })
  return response.data
}

export async function takeDownProduct(productId: number, violationType: string, reason: string) {
  const response = await axios.post('/api/trade/admin/violation', { productId, violationType, reason })
  return response.data
}

export async function revokeViolation(id: number, revokeReason?: string) {
  const response = await axios.post(`/api/trade/admin/violation/${id}/revoke`, { revokeReason })
  return response.data
}

/** 可处置的货源（运营端货源列表，用于选择要下架的货源） */
export async function getProductOptions(params: { pageNum: number; pageSize: number; keyword?: string }) {
  const response = await axios.get('/api/trade/admin/product/page', { params })
  return response.data
}
