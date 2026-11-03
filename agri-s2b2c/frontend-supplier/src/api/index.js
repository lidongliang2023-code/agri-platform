import axios from 'axios'
import { attachUnifiedAuth } from '../../../frontend-shared/unified-auth'

const instance = axios.create({
  baseURL: '/api',
  timeout: 10000
})

attachUnifiedAuth(instance, 'mall-supplier')

instance.interceptors.response.use(
  res => res.data,
  err => {
    console.error('API Error:', err)
    return Promise.reject(err)
  }
)

export const supplierApi = {
  apply: (data) => instance.post('/supplier/apply', data),
  getProfile: () => instance.get('/supplier/profile'),
  getDetail: (id) => instance.get(`/supplier/detail/${id}`),
  getProducts: (params) => instance.get('/supplier/products', { params }),
  createProduct: (data) => instance.post('/supplier/product/create', data),
  updateProduct: (data) => instance.put('/supplier/product/update', data),
  resubmitProduct: (id) => instance.put(`/supplier/product/${id}/resubmit`),
  updateDistribution: (id, params) => instance.put(`/supplier/product/${id}/distribution`, null, { params }),
  getDistributionRule: (id) => instance.get(`/supplier/product/${id}/distribution-rule`),
  saveDistributionRule: (id, data) => instance.put(`/supplier/product/${id}/distribution-rule`, data),
  getAvailableChannels: () => instance.get('/supplier/available-channels'),
  scanPriceGuard: () => instance.post('/supplier/products/price-guard'),
  getInvites: () => instance.get('/supplier/invites'),
  createInvite: (data) => instance.post('/supplier/invites', data),
  updateInviteStatus: (id, status) => instance.put(`/supplier/invites/${id}/status`, null, { params: { status } }),
  getRecruits: () => instance.get('/supplier/recruits'),
  updateInfo: (data) => instance.put('/supplier/update', data),
  // 渠道授权：查看谁选了我的商品、撤销授权
  getChannelAuthorizations: (productId) => instance.get('/supplier/channel-authorizations', { params: { productId } }),
  getOverview: (days) => instance.get('/supplier/overview', { params: { days } }),
  getOrders: (params) => instance.get('/supplier/orders', { params }),
  getOrderDetail: (id) => instance.get(`/supplier/order/${id}`),
  shipOrder: (id, params) => instance.put(`/supplier/order/${id}/ship`, null, { params }),
  getShipment: (id) => instance.get(`/supplier/order/${id}/shipment`),
  confirmShipment: (id) => instance.put(`/supplier/order/${id}/shipment/confirm`),
  rejectShipment: (id, reason) => instance.put(`/supplier/order/${id}/shipment/reject`, null, { params: { reason } }),
  withdrawShipment: (id) => instance.put(`/supplier/order/${id}/shipment/withdraw`),
  getAfterSales: (params) => instance.get('/supplier/after-sales', { params }),
  getChannels: () => instance.get('/supplier/channels'),
  getChannelDetail: (id) => instance.get(`/supplier/channel/${id}`),
  getRevenue: (month) => instance.get('/supplier/revenue', { params: { month } }),
  getReviews: (params) => instance.get('/supplier/reviews', { params }),
  replyReview: (id, reply) => instance.put(`/supplier/review/${id}/reply`, null, { params: { reply } }),
  getStatements: () => instance.get('/supplier/statements'),
  getStatement: (id) => instance.get(`/supplier/statement/${id}`),
  confirmStatement: (id, remark) => instance.put(`/supplier/statement/${id}/confirm`, null, { params: { remark } }),
  disputeStatement: (id, remark) => instance.put(`/supplier/statement/${id}/dispute`, null, { params: { remark } }),
  getNotices: (params) => instance.get('/supplier/notices', { params }),
  getUnreadNoticeCount: () => instance.get('/supplier/notices/unread-count'),
  markNoticeRead: (id) => instance.put(`/supplier/notices/${id}/read`),
  markAllNoticesRead: () => instance.put('/supplier/notices/read-all'),
  getNoticePreferences: () => instance.get('/supplier/notice-preferences'),
  updateNoticePreference: (data) => instance.put('/supplier/notice-preferences', data),
  revokeChannelAuthorization: (id) => instance.put(`/supplier/channel-authorization/${id}/revoke`)
}

export const platformApi = {
  getDashboard: () => instance.get('/platform/dashboard'),
  getProducts: (params) => instance.get('/platform/products', { params }),
  getProductDetail: (id) => instance.get(`/platform/product/detail/${id}`),
  getOrders: (params) => instance.get('/platform/orders', { params }),
  getOrderDetail: (id) => instance.get(`/platform/order/detail/${id}`)
}

export default instance
