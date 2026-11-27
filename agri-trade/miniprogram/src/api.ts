import { API_ORIGIN, getTradeRole, isTradeServiceConfigured, getTradeToken, handleTradeUnauthorized } from './auth'

export interface TradeProduct {
  id: number
  productName: string
  sellerId?: number | string | null
  sellerName?: string | null
  categoryId?: number | null
  categoryName?: string | null
  variety?: string | null
  specification?: string | null
  unit: string
  price?: number | null
  priceMin?: number | null
  priceMax?: number | null
  stockQuantity?: number | null
  minOrderQuantity?: number | null
  originProvince?: string | null
  originCity?: string | null
  description?: string | null
  skus?: { id: number; skuName: string; unit: string; price: number; stockQuantity: number; minOrderQuantity: number; status: number }[]
  publishStatus?: string | null
}

export interface TradeDemand {
  id: number
  demandNo: string
  demandName: string
  buyerId?: number | string | null
  buyerName: string
  productName?: string | null
  categoryId?: number | null
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
  buyerId?: number | string | null
  buyerName?: string | null
  sellerId?: number | string | null
  sellerName?: string | null
  categoryName?: string | null
  totalQuantity?: number | null
  totalAmount: number
  paidAmount?: number | null
  orderStatus: string
  paymentStatus?: string | null
  paymentMethod?: string | null
  deliveryProvince?: string | null
  deliveryCity?: string | null
  deliveryAddress?: string | null
  deliveryContact?: string | null
  deliveryPhone?: string | null
  logisticsNo?: string | null
  createTime: string
}

export interface TradeOrderItem {
  id: number
  productId: number
  productName: string
  specLevel?: string | null
  unit: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

export interface MatchResult {
  matchId: number
  demandId: number
  productId: number
  productName: string
  sellerId: number
  sellerName: string
  matchScore: number
  matchReason: string
  matchLevel?: string
  inquiryStatus?: string
  orderStatus?: string
}

export interface TradeContract {
  id: number
  contractNo: string
  buyerId?: number | string | null
  sellerId?: number | string | null
  orderId: number
  orderNo?: string | null
  contractName: string
  contractType?: string | null
  buyerName: string
  sellerName: string
  quantity?: number | null
  unit?: string | null
  unitPrice?: number | null
  contractAmount?: number | null
  buyerSignStatus: string
  sellerSignStatus: string
  contractStatus: string
  deliveryAddress?: string | null
  contractContent?: string | null
  contractFileUrl?: string | null
  createTime: string
}

export interface TradeLogistics {
  id: number
  logisticsNo: string
  orderId: number
  orderNo?: string | null
  carrierName?: string | null
  logisticsType?: string | null
  freightAmount?: number | null
  senderAddress?: string | null
  receiverAddress?: string | null
  receiverContact?: string | null
  receiverPhone?: string | null
  logisticsStatus: string
  currentLocation?: string | null
  pickupTime?: string | null
  deliveryTime?: string | null
  signTime?: string | null
  signReceiver?: string | null
  createTime: string
}

export interface TradeTrace {
  id: number
  logisticsId: number
  traceTime: string
  traceStatus: string
  traceLocation?: string | null
  traceDescription?: string | null
}

export interface TradeGuarantee {
  id: number
  merchantId: number
  merchantName: string
  guaranteeNo: string
  totalAmount: number
  availableAmount: number
  frozenAmount: number
  usedAmount: number
  guaranteeStatus: string
  expireTime?: string | null
}

interface PageData<T> { records?: T[]; list?: T[]; total?: number }

export function query(params?: Record<string, unknown>) {
  const pairs = Object.entries(params || {}).filter(([, value]) => value !== '' && value != null)
  return pairs.length
    ? `?${pairs.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`).join('&')}`
    : ''
}

/** uni.request 的 errMsg 是英文（request:fail timeout 等），统一换成用户看得懂的话。 */
export function networkErrorText(errMsg?: string, fallback = '网络连接失败，请检查网络后重试') {
  const text = String(errMsg || '')
  if (/timeout|超时/i.test(text)) return '请求超时，请稍后重试'
  if (/abort/i.test(text)) return '请求已取消，请重试'
  return fallback
}

function rawRequest<T>(path: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', data?: Record<string, unknown>): Promise<T> {
  if (!isTradeServiceConfigured()) return Promise.reject(new Error('交易服务尚未配置，暂时无法加载业务数据'))
  return new Promise((resolve, reject) => {
    const token = getTradeToken()
    uni.request({
      url: `${API_ORIGIN}/api/trade${path}`,
      method,
      data: method === 'GET' ? undefined : data,
      timeout: 15000,
      header: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      success(response: any) {
        if (getTradeToken() !== token) { reject(new Error('登录会话已变化，请重新加载')); return }
        if (response.statusCode === 401 || response.data?.code === 401) {
          handleTradeUnauthorized()
          reject(new Error('登录已失效，请重新使用统一账号登录'))
          return
        }
        if (response.statusCode >= 400 || response.data?.code !== 200) {
          reject(new Error(response.data?.message || '交易撮合请求失败'))
          return
        }
        resolve(response.data.data as T)
      },
      fail(error: { errMsg?: string }) { reject(new Error(networkErrorText(error?.errMsg))) },
    })
  })
}

/** 这些共享接口尚不支持 side 参数：取完整可访问集合，按当前中心过滤后再分页。 */
const directionalPages = new Set(['/contract/page', '/logistics/page', '/negotiation/quote/page', '/dispute/page', '/match/list'])
const directionalLists = new Set(['/compensation/mine'])
const serverDirectionalLists = new Set(['/order/refund/mine', '/invoice/mine'])
export async function request<T>(path: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', data?: Record<string, unknown>): Promise<T> {
  const [endpoint, search = ''] = path.split('?')
  if (method === 'GET' && serverDirectionalLists.has(endpoint)) {
    const params: Record<string, string> = {}
    search.split('&').filter(Boolean).forEach(pair => { const [key, ...value] = pair.split('='); params[decodeURIComponent(key)] = decodeURIComponent(value.join('=')) })
    return rawRequest<T>(endpoint + query({ ...params, side: getTradeRole() }))
  }
  if(method !== 'GET' || (!directionalPages.has(endpoint) && !directionalLists.has(endpoint))) return rawRequest<T>(path, method, data)
  const role = getTradeRole()
  const params: Record<string, string> = {}
  search.split('&').filter(Boolean).forEach(pair => { const [key, ...value] = pair.split('='); params[decodeURIComponent(key)] = decodeURIComponent(value.join('=')) })
  const page = Math.max(1, Number(params.pageNum) || 1), size = Math.max(1, Number(params.pageSize) || 30)
  const merchants = await rawRequest<{merchantId: number | string}[]>('/identity/my-merchants')
  const ids = new Set((merchants || []).map(item => String(item.merchantId)))
  const all: Record<string, any>[] = []
  if(directionalPages.has(endpoint)) {
    for(let pageNum = 1; ; pageNum++) {
      const payload = await rawRequest<PageData<Record<string, any>>>(endpoint + query({...params, pageNum, pageSize:100}))
      const batch = records(payload); all.push(...batch)
      if(!batch.length || all.length >= Number(payload?.total ?? all.length)) break
    }
  } else all.push(...records(await rawRequest<Record<string, any>[]>(path)))
  let relatedOrders: Set<string> | undefined
  const visible: Record<string, any>[] = []
  for(const row of all) {
    const party = row[role + 'Id']
    if(party != null) { if(ids.has(String(party))) visible.push(row); continue }
    if(row.orderId != null) {
      if(!relatedOrders) {
        relatedOrders = new Set<string>()
        for(let pageNum = 1; ; pageNum++) {
          const payload = await rawRequest<PageData<TradeOrder>>('/order/page' + query({side:role,pageNum,pageSize:100}))
          const batch = records(payload); batch.forEach(order=>relatedOrders!.add(String(order.id)))
          if(!batch.length || relatedOrders.size >= Number(payload?.total ?? relatedOrders.size)) break
        }
      }
      if(relatedOrders.has(String(row.orderId))) visible.push(row)
    } else if(row.complainantType === role && ids.has(String(row.complainantId)) || row.respondentType === role && ids.has(String(row.respondentId))) visible.push(row)
  }
  return (directionalPages.has(endpoint) ? {records:visible.slice((page-1)*size,page*size), total:visible.length} : visible) as T
}

function records<T>(data: T[] | PageData<T> | null | undefined): T[] {
  if (Array.isArray(data)) return data
  return data?.records || data?.list || []
}

export const tradeApi = {
  products: async (params: { keyword?: string; pageNum?: number; pageSize?: number; categoryId?: number | string } = {}) => {
    const data = await request<TradeProduct[] | PageData<TradeProduct>>(
      `/public/hall/products${query({ sort: 'latest', pageNum: 1, pageSize: 30, ...params })}`,
    )
    return records(data)
  },
  product: (id: number) => request<TradeProduct>(`/public/products/${id}`),
  demands: () => request<TradeDemand[]>('/public/demands'),
  merchants: () => request<{ merchantId: string | number; merchantName: string }[]>('/identity/my-merchants'),
  myDemands: async () => {
    const merchants = await request<{merchantId: string | number}[]>('/identity/my-merchants')
    const pages = await Promise.all(merchants.map(m => request<PageData<TradeDemand>>(`/demand/page${query({buyerId:m.merchantId,pageNum:1,pageSize:100})}`)))
    return pages.flatMap(p => p.records || [])
  },
  orders: async (params: { side?: 'buyer' | 'seller'; orderStatus?: string } = {}) => {
    const data = await request<TradeOrder[] | PageData<TradeOrder>>(`/order/page${query({ pageNum: 1, pageSize: 30, ...params })}`)
    return records(data)
  },
  order: (id: number) => request<TradeOrder>(`/order/${id}`),
  orderItems: (id: number) => request<TradeOrderItem[]>(`/order/${id}/items`),
  createDemand: (body: Record<string, unknown>) => request<TradeDemand>('/demand', 'POST', body),
  createOrderFromProduct: (body: Record<string, unknown>) => request<TradeOrder>('/order/from-product', 'POST', body),
  payOrder: (id: number) => request<boolean>(`/order/${id}/pay`, 'POST', { paymentMethod: 'transfer' }),
  shipOrder: (id: number) => request<boolean>(`/order/${id}/ship`, 'POST', { carrierName: '平台物流', logisticsType: 'road' }),
  receiveOrder: (id: number, signReceiver: string) => request<boolean>(`/order/${id}/confirm-receipt`, 'POST', { signReceiver }),
  cancelOrder: (id: number) => request<boolean>(`/order/${id}/status`, 'POST', { status: 'cancelled' }),
  matchDemand: (id: number, limit = 10) => request<MatchResult[]>(`/demand/${id}/match${query({ limit })}`, 'POST'),
  matchProduct: (id: number, limit = 10) => request<MatchResult[]>(`/match/product/${id}${query({ limit })}`, 'POST'),
  contracts: async () => {
    const data = await request<TradeContract[] | PageData<TradeContract>>('/contract/page?pageNum=1&pageSize=30')
    return records(data)
  },
  contract: (id: number) => request<TradeContract>(`/contract/${id}`),
  signContract: (id: number, signerName: string, evidenceUrl: string) => request<boolean>(`/contract/${id}/sign`, 'POST', {
    signMode: 'online', signerName, evidenceUrl, confirmed: 'true',
  }),
  logistics: async (params: { logisticsStatus?: string } = {}) => {
    const data = await request<TradeLogistics[] | PageData<TradeLogistics>>(`/logistics/page${query({ pageNum: 1, pageSize: 30, ...params })}`)
    return records(data)
  },
  logisticsDetail: (id: number) => request<TradeLogistics>(`/logistics/${id}`),
  traces: (id: number) => request<TradeTrace[]>(`/logistics/${id}/traces`),
  updateLogisticsStatus: (id: number, status: string, location?: string, signReceiver?: string) => request<boolean>(`/logistics/${id}/status`, 'POST', { status, location, signReceiver }),
  guarantees: () => request<TradeGuarantee[]>('/guarantee/mine'),
  guaranteeLogs: (id: number) => request<any[]>(`/guarantee/mine/${id}/logs`),
  replenishGuarantee: (id: number, amount: number) => request<boolean>(`/guarantee/${id}/replenish`, 'POST', { amount: String(amount), reason: '移动端自主补缴' }),
}

export async function uploadContractEvidence(contractId: number, filePath: string): Promise<string> {
  if (!isTradeServiceConfigured()) throw new Error('交易服务尚未配置，暂时无法上传凭证')
  return new Promise((resolve, reject) => {
    const token = getTradeToken()
    if (!token) { handleTradeUnauthorized(); reject(new Error('请先登录')); return }
    uni.uploadFile({
      timeout: 20000,
      url: `${API_ORIGIN}/api/trade/contract/${contractId}/evidence?signMode=online`,
      filePath,
      name: 'file',
      header: { Authorization: `Bearer ${token}` },
      success(response: any) {
        try {
          if (getTradeToken() !== token) throw new Error('登录会话已变化，请重新上传')
          const body = JSON.parse(response.data)
          if (response.statusCode === 401 || body.code === 401) handleTradeUnauthorized()
          if (response.statusCode >= 400 || body.code !== 200 || !body.data?.url) throw new Error(body.message || '签署凭证上传失败')
          resolve(body.data.url)
        } catch (error) { reject(error instanceof Error ? error : new Error('签署凭证上传失败')) }
      },
      fail(error: { errMsg?: string }) { reject(new Error(networkErrorText(error?.errMsg, '签署凭证上传失败，请检查网络后重试'))) },
    })
  })
}

export function money(value: number | null | undefined) {
  if (value == null) return '面议'
  return `¥${Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export const ORDER_STATUS: Record<string, string> = {
  refunding: '退款中', refunded: '已退款', pending_confirm: '待确认', pending: '待付款', paid: '待发货', shipped: '运输中', received: '待完成', completed: '已完成', cancelled: '已取消', closed: '已关闭',
}

export const LOGISTICS_STATUS: Record<string, string> = {
  pending: '待揽收', picked: '已揽收', in_transit: '运输中', delivering: '派送中', delivered: '已签收',
}
