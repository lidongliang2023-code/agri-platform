import request from '@/utils/api'

/** 交易域商品品类与违规处置（运营端接口，需要平台运营权限）。 */
export interface TradeCategory {
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

export interface TradeViolation {
  id: number
  violationNo: string
  productId: number
  productName: string
  sellerName: string
  violationType: string
  reason: string
  violationStatus: string
  operator: string
  createTime: string
}

export interface TradeProductOption {
  id: number
  productName: string
  sellerName: string
  publishStatus: string
}

export const getTradeCategories = (params: Record<string, unknown>) =>
  request.get('/api/trade/admin/category/page', { params })

export const createTradeCategory = (data: Partial<TradeCategory>) =>
  request.post('/api/trade/admin/category', data)

export const updateTradeCategory = (id: number, data: Partial<TradeCategory>) =>
  request.put(`/api/trade/admin/category/${id}`, data)

export const deleteTradeCategory = (id: number) =>
  request.delete(`/api/trade/admin/category/${id}`)

export const getTradeViolations = (params: Record<string, unknown>) =>
  request.get('/api/trade/admin/violation/page', { params })

export const takeDownTradeProduct = (productId: number, violationType: string, reason: string) =>
  request.post('/api/trade/admin/violation', { productId, violationType, reason })

export const revokeTradeViolation = (id: number, revokeReason?: string) =>
  request.post(`/api/trade/admin/violation/${id}/revoke`, { revokeReason })

export const getTradeProductOptions = (params: Record<string, unknown>) =>
  request.get('/api/trade/admin/product/page', { params })
