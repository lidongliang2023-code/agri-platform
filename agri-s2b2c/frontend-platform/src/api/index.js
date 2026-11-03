import axios from 'axios'
import { attachUnifiedAuth } from '../../../frontend-shared/unified-auth'

const instance = axios.create({
  baseURL: '/api',
  timeout: 10000
})

attachUnifiedAuth(instance, 's2b2c-platform')

instance.interceptors.response.use(
  res => res.data,
  err => {
    console.error('API Error:', err)
    return Promise.reject(err)
  }
)

export const platformApi = {
  getDashboard: () => instance.get('/platform/dashboard'),
  getOverview: (days) => instance.get('/platform/overview', { params: { days } }),
  getReports: (days) => instance.get('/platform/reports', { params: { days } }),
  getOrderStats: () => instance.get('/platform/order-stats'),
  getReviews: (params) => instance.get('/platform/reviews', { params }),
  hideReview: (id, hidden) => instance.put(`/platform/review/${id}/hide`, null, { params: { hidden } }),
  getAfterSales: (params) => instance.get('/platform/after-sales', { params }),
  getCommissions: (params) => instance.get('/platform/commissions', { params }),
  getPriceCenter: (keyword) => instance.get('/platform/price-center', { params: { keyword } }),
  scanPriceGuard: () => instance.post('/platform/price-guard/scan'),
  getPriceGuardRecords: (limit = 50) => instance.get('/platform/price-guard/records', { params: { limit } }),
  getInventory: (keyword) => instance.get('/platform/inventory', { params: { keyword } }),
  getGroupPurchases: (params) => instance.get('/platform/group-purchases', { params }),
  createGroupPurchase: (data) => instance.post('/platform/group-purchases', data),
  getGroupPurchaseDetail: (id) => instance.get(`/platform/group-purchases/${id}`),
  updateGroupPurchaseStatus: (id, status) => instance.put(`/platform/group-purchases/${id}/status`, null, { params: { status } }),
  getRiskRules: () => instance.get('/platform/risk-rules'),
  updateRiskRule: (code, data) => instance.put(`/platform/risk-rules/${code}`, data),
  getRiskEvents: (ruleCode) => instance.get('/platform/risk-events', { params: { ruleCode } }),
  handleRiskEvent: (data) => instance.post('/platform/risk-events/handle', data),
  getActivities: () => instance.get('/platform/activities'),
  syncMarketingStatus: () => instance.post('/platform/marketing/sync-status'),
  getActivityMonitor: (type, id) => instance.get(`/platform/activities/${type}/${id}/monitor`),
  createCoupon: (data) => instance.post('/platform/coupons', data),
  updateCouponStatus: (id, status) => instance.put(`/platform/coupons/${id}/status`, null, { params: { status } }),
  createFlashSale: (data) => instance.post('/platform/flash-sales', data),
  updateFlashStatus: (id, status) => instance.put(`/platform/flash-sales/${id}/status`, null, { params: { status } }),
  createGroupBuy: (data) => instance.post('/platform/group-buys', data),
  updateGroupStatus: (id, status) => instance.put(`/platform/group-buys/${id}/status`, null, { params: { status } }),
  getSuppliers: (params) => instance.get('/platform/suppliers', { params }),
  getSupplierDetail: (id) => instance.get(`/platform/supplier/detail/${id}`),
  auditSupplier: (params) => instance.put('/platform/supplier/audit', null, { params }),
  getChannelPartners: (params) => instance.get('/platform/channel-partners', { params }),
  getChannelPerformance: (params) => instance.get('/platform/channel-performance', { params }),
  getChannelPerformanceDetail: (id) => instance.get(`/platform/channel/${id}/performance`),
  getChannelPartnerDetail: (id) => instance.get(`/platform/channel-partner/detail/${id}`),
  auditChannelPartner: (params) => instance.put('/platform/channel-partner/audit', null, { params }),
  updateChannelGrade: (id, grade) => instance.put(`/platform/channel-partner/${id}/grade`, null, { params: { grade } }),
  getCommissionRules: () => instance.get('/platform/commission-rules'),
  getSettlements: () => instance.get('/platform/commission-settlements'),
  settleCommissions: (data) => instance.post('/platform/commission/settlement', data),
  getWithdrawals: (params) => instance.get('/platform/withdrawals', { params }),
  reviewWithdrawal: (id, status, remark, payoutNo) => instance.put(`/platform/withdrawal/${id}/review`, null, { params: { status, remark, payoutNo } }),
  saveCommissionRule: (data) => instance.put('/platform/commission-rule', data),
  getGradeRules: () => instance.get('/platform/grade-rules'),
  saveGradeRule: (data) => instance.put('/platform/grade-rule', data),
  evaluateChannelGrades: (days = 30) => instance.post('/platform/channel-grades/evaluate', null, { params: { days } }),
  getGradeChanges: (limit = 50) => instance.get('/platform/channel-grades/changes', { params: { limit } }),
  getProducts: (params) => instance.get('/platform/products', { params }),
  getProductDetail: (id) => instance.get(`/platform/product/detail/${id}`),
  auditProduct: (params) => instance.put('/platform/product/audit', null, { params }),
  batchAuditProducts: (data) => instance.post('/platform/products/batch-audit', data),
  getProductAuditLogs: (id) => instance.get(`/platform/product/${id}/audit-logs`),
  getOrders: (params) => instance.get('/platform/orders', { params }),
  expireUnpaidOrders: (minutes = 30) => instance.post('/platform/orders/expire-unpaid', null, { params: { minutes } }),
  autoCompleteOrders: (days = 7) => instance.post('/platform/orders/auto-complete', null, { params: { days } }),
  generateSupplierStatement: (data) => instance.post('/platform/supplier-statements/generate', data),
  getSupplierStatements: (params) => instance.get('/platform/supplier-statements', { params }),
  getSupplierStatement: (id) => instance.get(`/platform/supplier-statement/${id}`),
  getOrderDetail: (id) => instance.get(`/platform/order/detail/${id}`),
  getCategories: () => instance.get('/platform/categories'),
  addCategory: (data) => instance.post('/platform/category/add', data),
  updateCategory: (data) => instance.put('/platform/category/update', data),
  deleteCategory: (id) => instance.delete(`/platform/category/delete/${id}`),
  getGrowth: () => instance.get('/platform/growth'),
  reviewAfterSale: (id, status, opinion) => instance.put('/platform/after-sale/review', null, {
    params: { id, status, opinion }
  }),
  confirmAfterSaleReturn: (id, opinion) => instance.put(`/platform/after-sale/${id}/confirm-return`, null, {
    params: { opinion },
  }),
  shipOrder: (id, logisticsNo, company) => instance.put('/platform/order/ship', null, {
    params: { id, logisticsNo, company }
  })
}

export default instance
