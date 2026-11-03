import { getUnifiedToken, handleUnauthorized } from '../../frontend-shared/mobile-unified-auth'

export interface PageResult<T> {
  records: T[]
  total: number
  current: number
  size: number
}

export interface Supplier {
  id: number
  shopName: string
  shopDesc?: string
  companyName: string
  creditCode: string
  industry?: string
  legalName?: string
  contactPhone: string
  province?: string
  city?: string
  district?: string
  address?: string
  bankName?: string
  bankAccount?: string
  bankBranch?: string
  auditStatus?: string
  auditOpinion?: string
  auditTime?: string
}

export interface Product {
  id: number
  name: string
  sellingPoint: string
  categoryId: number
  categoryName?: string
  origin: string
  grade: string
  spec: string
  unit?: string
  price: number | null
  originalPrice?: number | null
  costPrice?: number | null
  stock: number
  stockWarning?: number
  commissionRate?: number
  sales?: number
  images: string[] | string
  certifications?: string
  detail?: string
  status: string
  supplierId: number
  createTime?: string
}

export interface Order {
  id: number
  orderNo: string
  consumerId: number
  totalAmount: number
  payAmount: number
  status: string
  statusText?: string
  createTime: string
  payTime?: string
  logisticsNo?: string
  logisticsCompany?: string
  remark?: string
  items?: Array<{
    id: number
    name: string
    spec: string
    price: number
    quantity: number
    totalAmount: number
    image: string
  }>
}

export interface Dashboard {
  supplierCount?: number
  productCount?: number
  orderCount?: number
  consumerCount?: number
  totalAmount?: number
}

export interface ActionResult {
  success: boolean
  message?: string
}

const runtimePlatform = uni.getSystemInfoSync().uniPlatform
const configuredBase = uni.getStorageSync('s2b2c_api_base') || import.meta.env.VITE_S2B2C_API_BASE
export const API_BASE = String(
  configuredBase || (runtimePlatform === 'web' ? '/api' : 'http://127.0.0.1:8088/api'),
).replace(/\/$/, '')

function query(params?: Record<string, string | number | boolean | null | undefined>) {
  if (!params) return ''
  const pairs = Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '')
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(params[key]))}`)
  return pairs.length ? `?${pairs.join('&')}` : ''
}

function request<T>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  data?: Record<string, unknown>,
  params?: Record<string, string | number | boolean | null | undefined>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${API_BASE}${path}${query(params)}`,
      method,
      data,
      timeout: 15000,
      header: {
        'Content-Type': 'application/json',
        ...(getUnifiedToken() ? { Authorization: `Bearer ${getUnifiedToken()}` } : {}),
      },
      success(response: { statusCode: number; data: unknown }) {
        if (response.statusCode === 401) {
          handleUnauthorized()
          reject(new Error('登录已失效，请重新使用统一账号登录'))
          return
        }
        if (response.statusCode >= 400) {
          reject(new Error(String((response.data as any)?.message || `请求失败（HTTP ${response.statusCode}）`)))
          return
        }
        resolve(response.data as T)
      },
      fail(error: { errMsg?: string }) {
        reject(new Error(error?.errMsg || '网络异常，请检查接口地址'))
      },
    })
  })
}

export const supplierApi = {
  getSupplier: (id = 1) => request<Supplier>(`/supplier/detail/${id}`),
  updateSupplier: (data: Supplier) => request<ActionResult>('/supplier/update', 'PUT', data as unknown as Record<string, unknown>),
  getDashboard: () => request<Dashboard>('/platform/dashboard'),
  getProducts: (params: { supplierId?: number; page?: number; size?: number; status?: string }) =>
    request<PageResult<Product>>('/supplier/products', 'GET', undefined, params),
  getProductDetail: (id: number) => request<Product>(`/platform/product/detail/${id}`),
  createProduct: (data: Record<string, unknown>) => request<ActionResult>('/supplier/product/create', 'POST', data),
  updateProduct: (data: Record<string, unknown>) => request<ActionResult>('/supplier/product/update', 'PUT', data),
  getOrders: (params: { page?: number; size?: number; status?: string }) =>
    request<PageResult<Order>>('/platform/orders', 'GET', undefined, params),
  getOrderDetail: (id: number) => request<Order>(`/consumer/order/detail/${id}`),
  shipOrder: (id: number, logisticsNo: string, company: string) =>
    request<ActionResult>('/platform/order/ship', 'PUT', undefined, { id, logisticsNo, company }),
}
