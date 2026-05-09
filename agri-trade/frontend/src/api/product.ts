import axios from 'axios'

export interface ProductQuery {
  pageNum: number
  pageSize: number
  productCode?: string
  productName?: string
  sellerId?: string
  categoryId?: string
  publishStatus?: string
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
  const response = await axios.get('/api/trade/product/list', { params })
  return response.data
}

export async function getProductById(id: number) {
  const response = await axios.get(`/api/trade/product/${id}`)
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