import { getUnifiedToken, handleUnauthorized } from '../../frontend-shared/mobile-unified-auth'

export type IdParam = string | number

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
  shopLogo?: string
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

export type ChannelUpdate = Pick<ChannelPartner,
  'id' | 'shopName' | 'shopDesc' | 'registerType' | 'companyName' |
  'contactName' | 'contactPhone' | 'province' | 'city' | 'district' | 'address'>

export interface Product {
  id: number
  name: string
  sellingPoint: string
  categoryId: number
  categoryName?: string
  supplierName?: string
  origin?: string
  spec?: string
  unit?: string
  price: number
  stock: number
  sales?: number
  commissionRate?: number
  images: string[] | string
  status?: string
  createTime?: string
  /** 货架层（channel_product）字段：只在「我的货架」里有值 */
  retailPrice?: number | null
  effectivePrice?: number
  shelfStatus?: 'ON' | 'OFF' | string
  minRetailPrice?: number | null
  maxRetailPrice?: number | null
  regionNames?: string[]
}

export interface Order {
  id: number
  orderNo: string
  consumerId: number
  payAmount: number
  totalAmount: number
  freightAmount?: number
  discountAmount?: number
  status: string
  logisticsNo?: string
  logisticsCompany?: string
  shipConfirmStatus?: string
  shipProposedBy?: string
  remark?: string
  createTime: string
  payTime?: string
}

export interface OrderItem {
  id: number
  productId: number
  name: string
  spec?: string
  image?: string
  price: number
  quantity: number
  totalAmount?: number
}

export interface OrderDetail {
  order: Order
  items: OrderItem[]
  commissions: Array<{ id: number; amount: number; rate: number; status: string }>
  afterSales: AfterSale[]
  address?: { name: string; phone: string; region: string; detail: string }
  buyer?: { id: number; nickname?: string; phone?: string; memberLevel?: string; orderCount?: number; totalAmount?: number }
}

export interface Shipment {
  id?: string | number
  status?: string
  proposerType?: string
  logisticsNo?: string
  logisticsCompany?: string
  /** 驳回原因 */
  reason?: string
  createTime?: string
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

export interface CommissionSummary {
  settledTotal: number
  pendingTotal: number
  withdrawnTotal: number
  frozenTotal: number
  available: number
}

export interface Withdrawal {
  id: number
  amount: number
  status: string
  applyTime: string
  reviewTime?: string
  remark?: string
  payoutTime?: string
}

export interface AfterSale {
  id: number
  orderId: number
  orderNo?: string
  type: string
  reason: string
  amount: number
  status: string
  items?: string
  buyerName?: string
  buyerPhone?: string
  handleOpinion?: string
  returnCompany?: string
  returnLogisticsNo?: string
  returnShippedAt?: string
  returnReceivedAt?: string
  createTime: string
}

export interface ChannelMarketing {
  channelId: string
  shopName: string
  summary: { coupons: number; flashes: number; groups: number; shelfProducts: number }
  coupons: Array<{ id: number; name: string; type?: string; amount?: number; discountRate?: number; minAmount?: number; remainCount?: number; validEnd?: string }>
  flashes: Array<{ id: number; productName: string; salePrice: number; originalPrice: number; remainStock: number; totalStock: number; startTime?: string; endTime?: string; status: string }>
  groups: Array<{ id: number; name: string; productName: string; groupSize: number; groupPrice: number; singlePrice: number; validHours: number; status: string }>
  storeSharePath: string
}

export interface Dashboard {
  todayOrders?: number
  todayAmount?: number
  pendingShip?: number
  pendingAfterSale?: number
  byStatus?: Record<string, number>
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

type Params = Record<string, string | number | boolean | null | undefined>

function query(params?: Params) {
  if (!params) return ''
  const pairs = Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null)
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(params[key]))}`)
  return pairs.length ? `?${pairs.join('&')}` : ''
}

export function request<T>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  data?: Record<string, unknown>,
  params?: Params,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const token = getUnifiedToken()
    uni.request({
      url: `${API_BASE}${path}${query(params)}`,
      method,
      data,
      timeout: 15000,
      header: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      success(response: { statusCode: number; data: unknown }) {
        if (getUnifiedToken() !== token) { reject(new Error('登录会话已变化，请重新加载')); return }
        if (response.statusCode === 401 || (response.data as { code?: number })?.code === 401) {
          handleUnauthorized()
          reject(new Error('登录已失效，请重新使用统一账号登录'))
          return
        }
        if (response.statusCode >= 400) {
          const body = response.data as Record<string, unknown> | undefined
          reject(new Error(String(body?.message || `请求失败（HTTP ${response.statusCode}）`)))
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

/**
 * 商家（渠道）移动工作台接口。
 *
 * 归属一律由后端按令牌解析（ChannelIdentityService）：大多数接口不带渠道参数；
 * 仍要求 channelId 的老接口（货架、选品、佣金）由调用方传当前会话里的渠道 id，
 * 后端会再校验它属于当前账号 —— 前端不再有任何「默认渠道 1」的兜底。
 */
export const channelApi = {
  getProfile: () => request<Partial<ChannelPartner> & { applied: boolean }>('/channel/profile'),
  getChannel: (id: IdParam) => request<ChannelPartner>(`/channel/detail/${id}`),
  updateChannel: (data: ChannelUpdate) => {
    const { id, shopName, shopDesc, registerType, companyName, contactName, contactPhone, province, city, district, address } = data
    return request<ActionResult>('/channel/update', 'PUT', {
      id, shopName, shopDesc, registerType, companyName, contactName, contactPhone, province, city, district, address,
    })
  },
  getDashboard: () => request<Dashboard>('/channel/order-stats'),

  // 货架与选品
  getProducts: (channelId: IdParam, params: { page?: number; size?: number } = {}) =>
    request<PageResult<Product>>('/channel/products', 'GET', undefined, { channelId, ...params }),
  getProductPool: (params: { page?: number; size?: number; keyword?: string; categoryId?: number | null }) =>
    request<PageResult<Product>>('/channel/product-pool', 'GET', undefined, params),
  selectProduct: (channelId: IdParam, productId: IdParam) =>
    request<ActionResult>('/channel/select-product', 'POST', undefined, { channelId, productId }),
  /** 只改分销层：零售价（空串=恢复按供货价）与上下架；商品标题、图片归交易撮合，不在商家端修改 */
  updateListing: (productId: IdParam, params: { retailPrice?: string; shelfStatus?: 'ON' | 'OFF' }) =>
    request<ActionResult & { effectivePrice?: number; shelfStatus?: string }>(`/channel/product/${productId}/listing`, 'PUT', undefined, params),

  // 订单与履约
  getOrders: (params: { page?: number; size?: number; status?: string; keyword?: string }) =>
    request<PageResult<Order>>('/channel/orders', 'GET', undefined, params),
  getOrder: (id: IdParam) => request<OrderDetail>(`/channel/order/${id}`),
  getShipment: (id: IdParam) => request<Shipment | null>(`/channel/order/${id}/shipment`),
  proposeShipment: (id: IdParam, logisticsNo: string, company?: string) =>
    request<ActionResult>(`/channel/order/${id}/shipment/propose`, 'PUT', undefined, { logisticsNo, company }),
  confirmShipment: (id: IdParam) => request<ActionResult>(`/channel/order/${id}/shipment/confirm`, 'PUT'),
  rejectShipment: (id: IdParam, reason: string) =>
    request<ActionResult>(`/channel/order/${id}/shipment/reject`, 'PUT', undefined, { reason }),
  withdrawShipment: (id: IdParam) => request<ActionResult>(`/channel/order/${id}/shipment/withdraw`, 'PUT'),

  // 售后
  getAfterSales: (status?: string) => request<AfterSale[]>('/channel/after-sales', 'GET', undefined, { status }),
  reviewAfterSale: (id: IdParam, status: 'APPROVED' | 'REJECTED', opinion?: string) =>
    request<ActionResult>(`/channel/after-sale/${id}/review`, 'PUT', undefined, { status, opinion }),
  confirmReturn: (id: IdParam, opinion?: string) =>
    request<ActionResult>(`/channel/after-sale/${id}/confirm-return`, 'PUT', undefined, { opinion }),

  // 佣金与提现
  getCommissions: (channelId: IdParam, params: { page?: number; size?: number; status?: string } = {}) =>
    request<PageResult<Commission>>('/channel/commissions', 'GET', undefined, { channelId, ...params }),
  getCommissionSummary: () => request<CommissionSummary>('/channel/commission-summary'),
  getWithdrawals: () => request<Withdrawal[]>('/channel/withdrawals'),
  applyWithdrawal: (amount: number) => request<ActionResult>('/channel/withdrawal', 'POST', { amount }),

  // 营销（只读，活动由平台运营创建）
  getMarketing: () => request<ChannelMarketing>('/channel/marketing'),
}
