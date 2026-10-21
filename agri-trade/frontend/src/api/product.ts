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
  priceMin?: number
  priceMax?: number
  stockQuantity: number
  specLevel?: string
  specSize?: string
  viewCount?: number
  inquiryCount?: number
  publishStatus: string
  createTime: string
  updateTime: string
}

/** 门户公开商品详情（后端 PortalPublicController 的字段白名单）。 */
export interface PublicProductDetail {
  id: number
  productCode: string
  barcode: string | null
  productName: string
  categoryId: number | null
  categoryName: string | null
  sellerId: number
  sellerName: string | null
  variety: string | null
  originProvince: string | null
  originCity: string | null
  originDistrict: string | null
  originAddress: string | null
  specLevel: string | null
  qualityLevel: string | null
  specSize: string | null
  unit: string
  stockQuantity: number | null
  price: number | null
  priceMin: number | null
  priceMax: number | null
  priceType: string | null
  minOrderQuantity: number | null
  harvestBatchNo: string | null
  certificationJson: string | null
  qualityReportUrl: string | null
  description: string | null
  videoUrl: string | null
  viewCount: number | null
  favoriteCount: number | null
  inquiryCount: number | null
  salesVolume: number | null
  publishStatus: string
  createTime: string
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

/** 匿名可读的已发布商品详情与图库。 */
export async function getPublicProductById(id: number | string) {
  const response = await axios.get(`/api/trade/public/products/${id}`)
  return response.data
}

export async function getPublicProductImages(id: number | string) {
  const response = await axios.get(`/api/trade/public/products/${id}/images`)
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
