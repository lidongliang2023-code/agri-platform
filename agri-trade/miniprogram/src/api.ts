import { API_ORIGIN, getTradeToken, handleTradeUnauthorized } from './auth'

export interface TradeProduct {
  id: number
  productName: string
  sellerName?: string | null
  categoryName?: string | null
  variety?: string | null
  specification?: string | null
  unit: string
  price?: number | null
  priceMin?: number | null
  priceMax?: number | null
  stockQuantity?: number | null
  originCity?: string | null
  description?: string | null
}

export interface TradeDemand {
  id: number
  demandNo: string
  demandName: string
  buyerName: string
  productName?: string | null
  categoryName?: string | null
  quantity: number
  unit?: string | null
  priceMin?: number | null
  priceMax?: number | null
  deliveryAddress?: string | null
  demandStatus: string
  responseCount?: number | null
  createTime: string
}

export interface TradeOrder {
  id: number
  orderNo: string
  productName?: string | null
  buyerName?: string | null
  sellerName?: string | null
  totalAmount: number
  orderStatus: string
  paymentStatus?: string | null
  createTime: string
}

interface Envelope<T> {
  code: number
  message?: string
  data: T
}

interface PageData<T> {
  records?: T[]
  list?: T[]
  total?: number
}

function query(params?: Record<string, unknown>) {
  const pairs = Object.entries(params || {}).filter(([, value]) => value !== '' && value != null)
  return pairs.length
    ? `?${pairs.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`).join('&')}`
    : ''
}

function request<T>(path: string, method: 'GET' | 'POST' = 'GET', data?: Record<string, unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${API_ORIGIN}/api/trade${path}`,
      method,
      data,
      timeout: 15000,
      header: {
        'Content-Type': 'application/json',
        ...(getTradeToken() ? { Authorization: `Bearer ${getTradeToken()}` } : {}),
      },
      success(response: any) {
        if (response.statusCode === 401) {
          handleTradeUnauthorized()
          reject(new Error('登录已失效，请重新使用统一账号登录'))
          return
        }
        if (response.statusCode >= 400 || response.data?.code !== 200) {
          reject(new Error(response.data?.message || '交易撮合请求失败'))
          return
        }
        resolve(response.data.data)
      },
      fail(error: { errMsg?: string }) {
        reject(new Error(error?.errMsg || '网络异常'))
      },
    })
  })
}

function records<T>(data: T[] | PageData<T> | null | undefined): T[] {
  if (Array.isArray(data)) return data
  return data?.records || data?.list || []
}

export const tradeApi = {
  products: async (params: { keyword?: string; pageNum?: number; pageSize?: number } = {}) => {
    const data = await request<TradeProduct[] | PageData<TradeProduct>>(
      `/public/hall/products${query({ sort: 'latest', pageNum: 1, pageSize: 30, ...params })}`,
    )
    return records(data)
  },
  product: (id: number) => request<TradeProduct>(`/public/products/${id}`),
  demands: () => request<TradeDemand[]>('/public/demands'),
  orders: async () => {
    const data = await request<TradeOrder[] | PageData<TradeOrder>>(
      `/order/page${query({ pageNum: 1, pageSize: 30 })}`,
    )
    return records(data)
  },
  createDemand: (body: Record<string, unknown>) => request<TradeDemand>('/demand', 'POST', body),
}

export function money(value: number | null | undefined) {
  return `¥${Number(value || 0).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export const ORDER_STATUS: Record<string, string> = {
  pending_payment: '待付款',
  pending_ship: '待发货',
  shipped: '已发货',
  completed: '已完成',
  cancelled: '已取消',
  closed: '已关闭',
}
