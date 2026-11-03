import axios from 'axios'
import { attachUnifiedAuth } from '../../../frontend-shared/unified-auth'

const instance = axios.create({
  baseURL: '/api',
  timeout: 12000,
})

attachUnifiedAuth(instance, 'mall-consumer')

instance.interceptors.response.use(
  (res) => res.data,
  (err) => {
    err.friendlyMessage = err.response?.data?.message || err.message || '网络异常'
    return Promise.reject(err)
  },
)

/**
 * 消费者端接口契约（S2B2C 消费者域，与供应商/渠道商/运营端接口物理隔离在 /api/consumer 下）。
 *
 * 约定：
 * 1) 读接口直接返回数据体；写接口统一返回 { success, message }，调用方必须回读复核；
 * 2) 所有 consumerId 归属由后端按登录账号校验（requireSelf），前端传参仅用于路由；
 * 3) 分页接口返回 MyBatis-Plus 的 IPage 结构：{ records, total, current, size }。
 */
export const consumerApi = {
  // ── 账号 ────────────────────────────────────────────────
  login: (phone) => instance.get('/consumer/login', { params: { phone } }),
  register: (data) => instance.post('/consumer/register', data),
  getProfile: () => instance.get('/consumer/profile'),
  getDetail: (id) => instance.get(`/consumer/detail/${id}`),
  updateInfo: (data) => instance.put('/consumer/update', data),

  // ── 商品与分类 ──────────────────────────────────────────
  getCategories: () => instance.get('/consumer/categories'),
  getProducts: (params) => instance.get('/consumer/products', { params }),
  getProductDetail: (id) => instance.get(`/consumer/product/detail/${id}`),
  getChannelShop: (channelId) => instance.get(`/consumer/channel/${channelId}`),
  getChannels: (params) => instance.get('/consumer/channels', { params }),

  // ── 购物车与订单 ────────────────────────────────────────
  getCart: (consumerId) => instance.get('/consumer/cart', { params: { consumerId } }),
  addCart: (params) => instance.post('/consumer/cart/add', null, { params }),
  updateCart: (params) => instance.put('/consumer/cart/update', null, { params }),
  selectAllCart: (consumerId, selected) =>
    instance.put('/consumer/cart/select-all', null, { params: { consumerId, selected } }),
  deleteCart: (id) => instance.delete(`/consumer/cart/delete/${id}`),
  createOrder: (data) => instance.post('/consumer/order/create', data),
  getOrders: (params) => instance.get('/consumer/orders', { params }),
  getOrderDetail: (id) => instance.get(`/consumer/order/detail/${id}`),
  payOrder: (id) => instance.put(`/consumer/order/pay/${id}`),
  receiveOrder: (id) => instance.put(`/consumer/order/receive/${id}`),
  cancelOrder: (id) => instance.put(`/consumer/order/cancel/${id}`),
  getLogistics: (orderId) => instance.get(`/consumer/logistics/${orderId}`),

  // ── 地址 ────────────────────────────────────────────────
  getAddresses: (consumerId) => instance.get('/consumer/addresses', { params: { consumerId } }),
  addAddress: (data) => instance.post('/consumer/address/add', data),
  updateAddress: (data) => instance.put('/consumer/address/update', data),
  deleteAddress: (id) => instance.delete(`/consumer/address/delete/${id}`),

  // ── 营销：优惠券 / 秒杀 / 拼团 ──────────────────────────
  getMarketing: () => instance.get('/consumer/marketing'),
  receiveCoupon: (consumerId, couponId) =>
    instance.post('/consumer/coupon/receive', null, { params: { consumerId, couponId } }),
  getCoupons: (consumerId) => instance.get('/consumer/coupons', { params: { consumerId } }),

  // ── 拼团 ────────────────────────────────────────────────
  getOpenGroupBuys: () => instance.get('/consumer/group-buy/open'),
  getGroupBuyDetail: (id) => instance.get(`/consumer/group-buy/${id}`),
  getMyGroups: (consumerId) => instance.get('/consumer/group-buy/mine', { params: { consumerId } }),

  // ── 溯源 ────────────────────────────────────────────────
  getTrace: (productId) => instance.get(`/consumer/trace/${productId}`),
  getTraceByCode: (code) => instance.get(`/consumer/trace/code/${encodeURIComponent(code)}`),

  // ── 售后 ────────────────────────────────────────────────
  getAfterSales: (consumerId) => instance.get('/consumer/after-sales', { params: { consumerId } }),
  createAfterSale: (data) => instance.post('/consumer/after-sales', data),
  submitAfterSaleReturn: (id, company, logisticsNo) =>
    instance.put(`/consumer/after-sales/${id}/return`, null, { params: { company, logisticsNo } }),

  // ── 消息中心 ────────────────────────────────────────────
  getMessages: (params) => instance.get('/consumer/messages', { params }),
  readMessage: (id) => instance.put(`/consumer/messages/${id}/read`),
  readAllMessages: (consumerId) => instance.put('/consumer/messages/read-all', null, { params: { consumerId } }),

  // ── 收藏 / 足迹 ─────────────────────────────────────────
  getFavorites: (consumerId) => instance.get('/consumer/favorites', { params: { consumerId } }),
  addFavorite: (consumerId, productId) =>
    instance.post('/consumer/favorites', null, { params: { consumerId, productId } }),
  removeFavorite: (consumerId, productId) =>
    instance.delete('/consumer/favorites', { params: { consumerId, productId } }),
  getFootprints: (consumerId) => instance.get('/consumer/footprints', { params: { consumerId } }),
  addFootprint: (consumerId, productId) =>
    instance.post('/consumer/footprints', null, { params: { consumerId, productId } }),
  clearFootprints: (consumerId) => instance.delete('/consumer/footprints', { params: { consumerId } }),

  // ── 评价 ────────────────────────────────────────────────
  getProductReviews: (params) => instance.get('/consumer/reviews', { params }),
  getReviewSummary: (productId) => instance.get(`/consumer/reviews/summary/${productId}`),
  getMyReviews: (consumerId) => instance.get('/consumer/reviews/mine', { params: { consumerId } }),
  createReview: (data) => instance.post('/consumer/reviews', data),

  // ── 会员 / 积分 / 签到 ──────────────────────────────────
  getSignIn: (consumerId) => instance.get('/consumer/signin', { params: { consumerId } }),
  signIn: (consumerId) => instance.post('/consumer/signin', null, { params: { consumerId } }),
  getPointsLogs: (params) => instance.get('/consumer/points/logs', { params }),
  getPointsGoods: () => instance.get('/consumer/points/goods'),
  exchangePoints: (consumerId, couponId) =>
    instance.post('/consumer/points/exchange', null, { params: { consumerId, couponId } }),
  getGrowth: (consumerId) => instance.get('/consumer/growth', { params: { consumerId } }),
}

export default instance
