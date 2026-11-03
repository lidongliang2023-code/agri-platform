import { getUnifiedToken, handleUnauthorized } from '../../frontend-shared/mobile-unified-auth'

export type IdParam = string | number

export interface Product {
  id: number
  name: string
  sellingPoint: string
  origin: string
  grade: string
  spec: string
  unit: string
  price: number
  originalPrice?: number
  stock: number
  sales: number
  commissionRate: number
  images: string[]
  certifications: string
  status: string
  categoryName: string
  supplierName: string
  createTime: string
}

export interface CartItem {
  id: number
  productId: number
  name: string
  spec: string
  price: number
  quantity: number
  selected?: boolean
  image: string
  stock: number
  shopId: number
  shopName: string
}

export interface CouponItem {
  id: IdParam
  couponId: IdParam
  name: string
  type: string
  amount?: number | null
  discountRate?: number | null
  minAmount?: number | null
  validStart?: string
  validEnd?: string
  status: string
  receiveTime?: string
}

export interface Address {
  id: IdParam
  consumerId: IdParam
  name: string
  phone: string
  province: string
  city: string
  district: string
  address: string
  isDefault: boolean
  status: string
}

export interface Consumer {
  id: number
  nickname?: string
  phone: string
  avatar?: string
  memberLevel?: string
  points?: number
  totalConsume?: number
}

export interface OrderItem {
  id: number
  orderId: number
  productId: number
  name: string
  spec: string
  price: number
  quantity: number
  totalAmount: number
  image: string
}

export interface Order {
  id: number
  orderNo: string
  consumerId: number
  status: string
  statusText: string
  totalAmount: number
  discountAmount: number
  freightAmount: number
  payAmount: number
  payMethod?: string
  payTime?: string
  logisticsNo?: string
  logisticsCompany?: string
  remark?: string
  items: OrderItem[]
  address?: Address
  createTime: string
}

export interface PageResult<T> {
  records: T[]
  total: number
  size: number
  current: number
  pages: number
}

export interface ActionResult {
  success: boolean
  message?: string
}

export interface LoginResult extends ActionResult {
  data: Consumer
}

export interface Coupon {
  id: number
  name: string
  type: string
  amount: number
  minAmount: number
  validEnd: string
  remainCount: number
}

export interface FlashSale {
  id: number
  productName: string
  salePrice: number
  originalPrice: number
  remainStock: number
  totalStock: number
  unit: string
}

export interface GroupBuy {
  id: number
  name: string
  groupSize: number
  groupPrice: number
  singlePrice: number
  validHours: number
}

export interface MarketingData {
  coupons: Coupon[]
  flashSales: FlashSale[]
  groupBuys: GroupBuy[]
}

export interface ChannelShop {
  id: string | number
  shopName: string
  shopDesc?: string
  shopLogo?: string
  grade?: string
  productCount?: number
  minPrice?: number
  coverImage?: string
  featuredProduct?: string
}

export interface ChannelShopProduct {
  id: number
  name: string
  price: number
  stock: number
  unit: string
  image?: string
  commissionRate?: number
}

export interface ChannelShopDetail {
  channel: ChannelShop
  products: ChannelShopProduct[]
}

export interface TraceRecord {
  id: number
  batchCode: string
  origin: string
  plantingDate: string
  harvestDate: string
  processingInfo: string
  qualityReport: string
  storageInfo: string
}

export interface AfterSale {
  id: number
  orderId: number
  type: string
  amount: number
  reason: string
  status: string
  createTime: string
}

const runtimePlatform = uni.getSystemInfoSync().uniPlatform
const configuredBase = uni.getStorageSync('s2b2c_api_base') || import.meta.env.VITE_S2B2C_API_BASE

export const API_BASE = String(
  configuredBase || (runtimePlatform === 'web' ? '/api' : 'http://127.0.0.1:8088/api'),
).replace(/\/$/, '')

function query(params?: Record<string, string | number | boolean | null | undefined>): string {
  if (!params) return ''
  const pairs = Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '')
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(params[key]))}`)
  return pairs.length ? `?${pairs.join('&')}` : ''
}

export function request<T>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  data?: Record<string, unknown>,
  params?: Record<string, string | number | boolean | null | undefined>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
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
        const body = response.data as Record<string, unknown>
        if (response.statusCode === 401) {
          handleUnauthorized()
          reject(new Error('登录已失效，请重新使用统一账号登录'))
          return
        }
        if (response.statusCode >= 400) {
          reject(new Error(String(body?.message || `请求失败（HTTP ${response.statusCode}）`)))
          return
        }
        resolve(response.data as T)
      },
      fail(error: { errMsg?: string }) {
        reject(new Error(error?.errMsg || '网络异常，请检查接口地址和网络连接'))
      },
    })
  })
}

export const mallApi = {
  login: (phone: string) => request<LoginResult>('/consumer/login', 'GET', undefined, { phone }),
  getProducts: (params: { page?: number; size?: number; keyword?: string; categoryId?: number | null }) =>
    request<PageResult<Product>>('/consumer/products', 'GET', undefined, params),
  getProduct: (id: IdParam) => request<Product>(`/consumer/product/detail/${id}`),
  getChannelShop: (channelId: IdParam) =>
    request<ChannelShopDetail>(`/consumer/channel/${channelId}`),
  getChannels: (params?: { keyword?: string; limit?: number }) =>
    request<ChannelShop[]>(`/consumer/channels`, 'GET', undefined, params as Record<string, string | number | undefined>),
  getCart: (consumerId: IdParam) => request<CartItem[]>('/consumer/cart', 'GET', undefined, { consumerId }),
  addCart: (consumerId: IdParam, productId: IdParam, quantity: number, channelId?: IdParam) =>
    request<ActionResult>('/consumer/cart/add', 'POST', undefined, { consumerId, productId, quantity, channelId }),
  updateCart: (id: IdParam, quantity: number) =>
    request<ActionResult>('/consumer/cart/update', 'PUT', undefined, { id, quantity }),
  deleteCart: (id: IdParam) => request<ActionResult>(`/consumer/cart/delete/${id}`, 'DELETE'),
  createOrder: (data: Record<string, unknown>) => request<ActionResult>('/consumer/order/create', 'POST', data),
  getOrders: (params: { consumerId: IdParam; page?: number; size?: number; status?: string }) =>
    request<PageResult<Order>>('/consumer/orders', 'GET', undefined, params),
  getOrder: (id: IdParam) => request<Order>(`/consumer/order/detail/${id}`),
  payOrder: (id: IdParam) => request<ActionResult>(`/consumer/order/pay/${id}`, 'PUT'),
  receiveOrder: (id: IdParam) => request<ActionResult>(`/consumer/order/receive/${id}`, 'PUT'),
  getAddresses: (consumerId: IdParam) =>
    request<Address[]>('/consumer/addresses', 'GET', undefined, { consumerId }),
  addAddress: (data: Address) => request<ActionResult>('/consumer/address/add', 'POST', data as unknown as Record<string, unknown>),
  updateAddress: (data: Address) => request<ActionResult>('/consumer/address/update', 'PUT', data as unknown as Record<string, unknown>),
  deleteAddress: (id: IdParam) => request<ActionResult>(`/consumer/address/delete/${id}`, 'DELETE'),
  getMarketing: () => request<MarketingData>('/consumer/marketing'),
  getCoupons: (consumerId: IdParam) =>
    request<CouponItem[]>('/consumer/coupons', 'GET', undefined, { consumerId }),
  receiveCoupon: (consumerId: IdParam, couponId: number) =>
    request<ActionResult>('/consumer/coupon/receive', 'POST', undefined, { consumerId, couponId }),
  getTrace: (productId: IdParam) => request<TraceRecord[]>(`/consumer/trace/${productId}`),
  getAfterSales: (consumerId: IdParam) =>
    request<AfterSale[]>('/consumer/after-sales', 'GET', undefined, { consumerId }),
  createAfterSale: (data: Record<string, unknown>) =>
    request<ActionResult>('/consumer/after-sales', 'POST', data),
}
