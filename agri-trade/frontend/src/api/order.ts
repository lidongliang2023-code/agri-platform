import axios from 'axios'

export interface OrderQuery {
  pageNum: number
  pageSize: number
  orderNo?: string
  buyerId?: string
  sellerId?: string
  orderStatus?: string
  paymentStatus?: string
  /** 参与方范围：买家或卖家是此人（用户端必传，后端不再允许全量查询） */
  participantId?: number | string
}

export interface TradeOrderVO {
  id: number
  orderNo: string
  buyerId: number
  buyerName: string
  sellerId: number
  sellerName: string
  categoryId: number
  categoryName: string
  totalAmount: number
  orderStatus: string
  paymentStatus: string
  paymentMethod: string
  paymentTime: string
  createTime: string
  updateTime: string
}

export async function getOrderList(params: OrderQuery) {
  const response = await axios.get('/api/trade/order/page', { params })
  return response.data
}

export async function getOrderById(id: number) {
  const response = await axios.get(`/api/trade/order/${id}`)
  return response.data
}

export async function createOrder(data: any) {
  const response = await axios.post('/api/trade/order', data)
  return response.data
}

/**
 * 从货源直接下单（不经报价）。
 *
 * <p>只需传 productId / quantity / 收货信息；**价格与总额由服务端算**
 * （单价取货源上的价格，货款 = 单价 × 数量），不接受调用方传金额。</p>
 */
export async function createOrderFromProduct(data: Record<string, unknown>) {
  const response = await axios.post('/api/trade/order/from-product', data)
  return response.data
}

export async function updateOrder(id: number, data: any) {
  const response = await axios.put(`/api/trade/order/${id}`, data)
  return response.data
}

// 订单没有删除接口，也不该有：交易单据只能通过状态流转（取消/退款）终结，
// 直接删掉会让资金与物流的追溯断链。原先这里调 DELETE /order/{id}，后端从未注册过。

/** 订单明细 */
export async function getOrderItems(id: number | string) {
  const response = await axios.get(`/api/trade/order/${id}/items`)
  return response.data
}

/**
 * 订单状态流转。
 *
 * <p>后端认的状态：paid（支付）/ shipped（发货）/ received（收货）/ completed（完成），
 * 各自带副作用：置已付金额、置物流已揽收、置买家已确认、置已结算。</p>
 */
export async function updateOrderStatus(id: number | string, status: string) {
  const response = await axios.post(`/api/trade/order/${id}/status`, { status })
  return response.data
}

/** 支付 */
export async function payOrder(id: number | string, data: Record<string, unknown>) {
  const response = await axios.post(`/api/trade/order/${id}/pay`, data)
  return response.data
}

/** 申请退款 */
export async function applyOrderRefund(id: number | string, data: Record<string, unknown>) {
  const response = await axios.post(`/api/trade/order/${id}/refund`, data)
  return response.data
}
