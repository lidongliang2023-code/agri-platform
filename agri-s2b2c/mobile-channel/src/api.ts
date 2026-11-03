import { getUnifiedToken, handleUnauthorized } from '../../frontend-shared/mobile-unified-auth'

export interface PageResult<T> {
  records: T[]
  total: number
  current: number
  size: number
}

export interface ChannelPartner {
  id: number
  shopName: string
  shopDesc?: string
  registerType: string
  companyName: string
  creditCode?: string
  contactName: string
  contactPhone: string
  province?: string
  city?: string
  district?: string
  address?: string
  grade?: string
  auditStatus?: string
  auditOpinion?: string
}

export interface Product {
  id: number
  name: string
  sellingPoint: string
  categoryId: number
  categoryName?: string
  supplierName?: string
  origin?: string
  price: number
  stock: number
  sales?: number
  commissionRate?: number
  images: string[] | string
  status?: string
  createTime?: string
}

export interface Order {
  id: number
  orderNo: string
  consumerId: number
  payAmount: number
  totalAmount: number
  status: string
  createTime: string
}

export interface Commission {
  id: number
  orderNo?: string
  orderId?: number
  amount: number
  rate: number
  status: string
  settleTime?: string
  createTime: string
}

export interface MarketingData {
  coupons: Array<{ id: number; name: string; amount: number; minAmount: number; remainCount: number; validEnd: string }>
  flashSales: Array<{ id: number; productName: string; salePrice: number; originalPrice: number; remainStock: number; totalStock: number; unit: string }>
  groupBuys: Array<{ id: number; name: string; groupSize: number; groupPrice: number; singlePrice: number; validHours: number }>
}

export interface GrowthData {
  marketing: MarketingData
  commissions: Array<{ id: number; orderId: number; amount: number; rate: number; status: string; createTime: string }>
  afterSales: Array<{ id: number; orderId: number; type: string; reason: string; amount: number; status: string; createTime: string }>
}

export interface Dashboard {
  orderCount?: number
  productCount?: number
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

export const channelApi = {
  getChannel: (id = 1) => request<ChannelPartner>(`/channel/detail/${id}`),
  updateChannel: (data: ChannelPartner) => request<ActionResult>('/channel/update', 'PUT', data as unknown as Record<string, unknown>),
  getDashboard: () => request<Dashboard>('/platform/dashboard'),
  getProducts: (params: { channelId?: number; page?: number; size?: number }) =>
    request<PageResult<Product>>('/channel/products', 'GET', undefined, params),
  getProductPool: (params: { page?: number; size?: number; keyword?: string; categoryId?: number | null }) =>
    request<PageResult<Product>>('/channel/product-pool', 'GET', undefined, params),
  selectProduct: (channelId: number, productId: number) =>
    request<ActionResult>('/channel/select-product', 'POST', undefined, { channelId, productId }),
  getOrders: (params: { page?: number; size?: number; status?: string }) =>
    request<PageResult<Order>>('/platform/orders', 'GET', undefined, params),
  getCommissions: (params: { channelId?: number; page?: number; size?: number; status?: string }) =>
    request<PageResult<Commission>>('/channel/commissions', 'GET', undefined, params),
  getTotalCommission: (channelId = 1) =>
    request<{ total: number }>('/channel/total-commission', 'GET', undefined, { channelId }),
  getGrowth: (channelId = 1) => request<GrowthData>('/channel/growth', 'GET', undefined, { channelId }),
}
