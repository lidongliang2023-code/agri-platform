import axios from 'axios'

export interface ProductQuery {
  pageNum: number
  pageSize: number
  productCode?: string
  productName?: string
  sellerId?: number | string
  categoryId?: number | string
  publishStatus?: string
  /** 排序字段：price / priceMin / createTime（后端按白名单处理，其他值回落默认排序） */
  sortField?: string
  sortOrder?: 'asc' | 'desc'
}

/** 商品图片（agri_trade_product_image） */
export interface ProductImage {
  id: number
  productId: number
  imageUrl: string
  imageType: string
  sortOrder: number
}

export interface TradeProductVO {
  id: number
  productCode: string
  productName: string
  sellerId: number
  sellerName: string
  categoryId: number
  categoryName: string
  variety: string
  specification: string
  unit: string
  price: number
  stockQuantity: number
  publishStatus: string
  createTime: string
  updateTime: string
}

export async function getProductList(params: ProductQuery) {
  // 后端注册的是 /page（MyBatis-Plus 分页），没有 /list —— 原先调 /list 必然 404。
  const response = await axios.get('/api/trade/product/page', { params })
  return response.data
}

export async function getProductById(id: number) {
  const response = await axios.get(`/api/trade/product/${id}`)
  return response.data
}

export async function getProductImages(id: number | string) {
  const response = await axios.get(`/api/trade/product/${id}/images`)
  return response.data
}

/** 商品分类（用于列表页的品类筛选） */
export async function getCategoryList() {
  const response = await axios.get('/api/trade/product/category/list')
  return response.data
}

export async function createProduct(data: any) {
  const response = await axios.post('/api/trade/product', data)
  return response.data
}

export async function updateProduct(id: number, data: any) {
  const response = await axios.put(`/api/trade/product/${id}`, data)
  return response.data
}

export async function deleteProduct(id: number) {
  const response = await axios.delete(`/api/trade/product/${id}`)
  return response.data
}
