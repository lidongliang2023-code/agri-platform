import axios from 'axios'

export interface OrderQuery {
  pageNum: number
  pageSize: number
  orderNo?: string
  buyerId?: string
  sellerId?: string
  orderStatus?: string
  paymentStatus?: string
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
  const response = await axios.get('/api/trade/order/list', { params })
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

export async function updateOrder(id: number, data: any) {
  const response = await axios.put(`/api/trade/order/${id}`, data)
  return response.data
}

export async function deleteOrder(id: number) {
  const response = await axios.delete(`/api/trade/order/${id}`)
  return response.data
}