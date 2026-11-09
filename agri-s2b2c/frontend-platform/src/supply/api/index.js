import axios from 'axios'
import { attachUnifiedAuth } from '../../../../frontend-shared/unified-auth'

const instance = axios.create({
  baseURL: '/api',
  timeout: 10000
})

attachUnifiedAuth(instance, 's2b2c-platform')

instance.interceptors.request.use(config => {
  const sourceId = sessionStorage.getItem('s2b2c-platform-supply-source')
  if (sourceId) config.headers['X-Supply-Source-Id'] = sourceId
  return config
})

instance.interceptors.response.use(
  res => res.data,
  err => {
    console.error('API Error:', err)
    return Promise.reject(err)
  }
)

export const supplierApi = {
  bindTraceUnits: (orderId, itemId, codes) => instance.post(`/platform/supply/order/${orderId}/item/${itemId}/trace-units`, { codes }),
  getItemTrace: (orderId, itemId) => instance.get(`/platform/supply/order/${orderId}/item/${itemId}/trace`),
  getCategories: () => instance.get('/platform/categories'),
  apply: (data) => instance.post('/platform/supply/apply', data),
  getProfile: () => instance.get('/platform/supply/profile'),
  getDetail: (id) => instance.get(`/platform/supply/detail/${id}`),
  getProducts: (params) => instance.get('/platform/supply/products', { params }),
  // 编辑表单的完整回读：/platform/supply/detail/{id} 是供应商档案，不是商品，按商品 id 调它会拿错对象
  getProduct: (id) => instance.get(`/platform/supply/product/${id}`),
  createProduct: (data) => instance.post('/platform/supply/product/create', data),
  updateProduct: (data) => instance.put('/platform/supply/product/update', data),
  // 可绑定的生产批次与链路预览（由服务端按调用令牌向生产域要，前端不传主体 id）
  getProductionBatches: (keyword) => instance.get('/platform/supply/production-batches', { params: { keyword } }),
  previewBatchTrace: (batchNo) => instance.get(`/platform/supply/production-batches/${encodeURIComponent(batchNo)}/trace`),
  resubmitProduct: (id) => instance.put(`/platform/supply/product/${id}/resubmit`),
  updateDistribution: (id, params) => instance.put(`/platform/supply/product/${id}/distribution`, null, { params }),
  getDistributionRule: (id) => instance.get(`/platform/supply/product/${id}/distribution-rule`),
  saveDistributionRule: (id, data) => instance.put(`/platform/supply/product/${id}/distribution-rule`, data),
  getAvailableChannels: () => instance.get('/platform/supply/available-channels'),
  scanPriceGuard: () => instance.post('/platform/supply/products/price-guard'),
  getInvites: () => instance.get('/platform/supply/invites'),
  createInvite: (data) => instance.post('/platform/supply/invites', data),
  updateInviteStatus: (id, status) => instance.put(`/platform/supply/invites/${id}/status`, null, { params: { status } }),
  getRecruits: () => instance.get('/platform/supply/recruits'),
  updateInfo: (data) => instance.put('/platform/supply/update', data),
  // 渠道授权：查看谁选了我的商品、撤销授权
  getChannelAuthorizations: (productId) => instance.get('/platform/supply/channel-authorizations', { params: { productId } }),
  getOverview: (days) => instance.get('/platform/supply/overview', { params: { days } }),
  getOrders: (params) => instance.get('/platform/supply/orders', { params }),
  getOrderDetail: (id) => instance.get(`/platform/supply/order/${id}`),
  shipOrder: (id, params) => instance.put(`/platform/supply/order/${id}/ship`, null, { params }),
  getShipment: (id) => instance.get(`/platform/supply/order/${id}/shipment`),
  confirmShipment: (id) => instance.put(`/platform/supply/order/${id}/shipment/confirm`),
  rejectShipment: (id, reason) => instance.put(`/platform/supply/order/${id}/shipment/reject`, null, { params: { reason } }),
  withdrawShipment: (id) => instance.put(`/platform/supply/order/${id}/shipment/withdraw`),
  getAfterSales: (params) => instance.get('/platform/supply/after-sales', { params }),
  getChannels: () => instance.get('/platform/supply/channels'),
  getChannelDetail: (id) => instance.get(`/platform/supply/channel/${id}`),
  getRevenue: (month) => instance.get('/platform/supply/revenue', { params: { month } }),
  getReviews: (params) => instance.get('/platform/supply/reviews', { params }),
  replyReview: (id, reply) => instance.put(`/platform/supply/review/${id}/reply`, null, { params: { reply } }),
  getStatements: () => instance.get('/platform/supply/statements'),
  getStatement: (id) => instance.get(`/platform/supply/statement/${id}`),
  confirmStatement: (id, remark) => instance.put(`/platform/supply/statement/${id}/confirm`, null, { params: { remark } }),
  disputeStatement: (id, remark) => instance.put(`/platform/supply/statement/${id}/dispute`, null, { params: { remark } }),
  getNotices: (params) => instance.get('/platform/supply/notices', { params }),
  getUnreadNoticeCount: () => instance.get('/platform/supply/notices/unread-count'),
  markNoticeRead: (id) => instance.put(`/platform/supply/notices/${id}/read`),
  markAllNoticesRead: () => instance.put('/platform/supply/notices/read-all'),
  getNoticePreferences: () => instance.get('/platform/supply/notice-preferences'),
  updateNoticePreference: (data) => instance.put('/platform/supply/notice-preferences', data),
  revokeChannelAuthorization: (id) => instance.put(`/platform/supply/channel-authorization/${id}/revoke`)
}

export const platformApi = {
  getDashboard: () => instance.get('/platform/dashboard'),
  getProducts: (params) => instance.get('/platform/products', { params }),
  getProductDetail: (id) => instance.get(`/platform/product/detail/${id}`),
  getOrders: (params) => instance.get('/platform/orders', { params }),
  getOrderDetail: (id) => instance.get(`/platform/order/detail/${id}`)
}

export default instance
