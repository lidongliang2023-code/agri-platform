import axios from 'axios'
import { attachUnifiedAuth } from '../../../frontend-shared/unified-auth'

const instance = axios.create({
  baseURL: '/api',
  timeout: 10000
})

attachUnifiedAuth(instance, 'mall-channel')

instance.interceptors.response.use(
  res => res.data,
  err => {
    console.error('API Error:', err)
    return Promise.reject(err)
  }
)

export const channelApi = {
  apply: (data) => instance.post('/channel/apply', data),
  getProfile: () => instance.get('/channel/profile'),
  getDetail: (id) => instance.get(`/channel/detail/${id}`),
  getProducts: (params) => instance.get('/channel/products', { params }),
  getInventory: () => instance.get('/channel/inventory'),
  getMarketing: () => instance.get('/channel/marketing'),
  getGroupPurchases: () => instance.get('/channel/group-purchases'),
  getNotices: (params) => instance.get('/channel/notices', { params }),
  getUnreadNoticeCount: () => instance.get('/channel/notices/unread-count'),
  markNoticeRead: (id) => instance.put(`/channel/notices/${id}/read`),
  markAllNoticesRead: () => instance.put('/channel/notices/read-all'),
  getNoticePreferences: () => instance.get('/channel/notice-preferences'),
  updateNoticePreference: (data) => instance.put('/channel/notice-preferences', data),
  joinGroupPurchase: (id, data) => instance.post(`/channel/group-purchases/${id}/join`, data),
  cancelGroupPurchase: (id) => instance.put(`/channel/group-purchases/${id}/cancel`),
  updateListing: (productId, params) => instance.put(`/channel/product/${productId}/listing`, null, { params }),
  getProductPool: (params) => instance.get('/channel/product-pool', { params }),
  selectProduct: (params) => instance.post('/channel/select-product', null, { params }),
  getCommissions: (params) => instance.get('/channel/commissions', { params }),
  getTotalCommission: (channelId) => instance.get('/channel/total-commission', { params: { channelId } }),
  getCommissionSummary: () => instance.get('/channel/commission-summary'),
  applyWithdrawal: (data) => instance.post('/channel/withdrawal', data),
  getWithdrawals: () => instance.get('/channel/withdrawals'),
  getSettlements: () => instance.get('/channel/settlements'),
  getOrders: (params) => instance.get('/channel/orders', { params }),
  getOrderStats: () => instance.get('/channel/order-stats'),
  getOrderDetail: (id) => instance.get(`/channel/order/${id}`),
  shipOrder: (id, params) => instance.put(`/channel/order/${id}/ship`, null, { params }),
  getShipment: (id) => instance.get(`/channel/order/${id}/shipment`),
  confirmShipment: (id) => instance.put(`/channel/order/${id}/shipment/confirm`),
  rejectShipment: (id, reason) => instance.put(`/channel/order/${id}/shipment/reject`, null, { params: { reason } }),
  withdrawShipment: (id) => instance.put(`/channel/order/${id}/shipment/withdraw`),
  getReviews: (params) => instance.get('/channel/reviews', { params }),
  replyReview: (id, reply) => instance.put(`/channel/review/${id}/reply`, null, { params: { reply } }),
  getAfterSales: (params) => instance.get('/channel/after-sales', { params }),
  reviewAfterSale: (id, status, opinion) => instance.put(`/channel/after-sale/${id}/review`, null, { params: { status, opinion } }),
  confirmAfterSaleReturn: (id, opinion) => instance.put(`/channel/after-sale/${id}/confirm-return`, null, { params: { opinion } }),
  getCustomers: (params) => instance.get('/channel/customers', { params }),
  getCustomerDetail: (consumerId) => instance.get(`/channel/customer/${consumerId}`),
  getAnalytics: (days) => instance.get('/channel/analytics', { params: { days } }),
  getReconcile: (month) => instance.get('/channel/reconcile', { params: { month } }),
  updateInfo: (data) => instance.put('/channel/update', data),
  getGradeHistory: (days = 30) => instance.get('/channel/grade-history', { params: { days } }),
  getGrowth: (channelId) => instance.get('/channel/growth', { params: { channelId } })
}

export default instance
