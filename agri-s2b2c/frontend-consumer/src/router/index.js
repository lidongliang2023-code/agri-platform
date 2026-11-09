import { createRouter, createWebHistory } from 'vue-router'

/**
 * 消费者端路由表。name 与原型页面一一对应，meta 中的 group/title 直接用于面包屑。
 * 所有页面均为独立 SFC 懒加载，首屏只加载首页。
 */
const routes = [
  { path: '/', name: 'Home', component: () => import('../views/Home.vue'), meta: { group: '商城', title: '商城首页' } },
  { path: '/category', name: 'Category', component: () => import('../views/Category.vue'), meta: { group: '商城', title: '商品分类' } },
  { path: '/products', name: 'ProductList', component: () => import('../views/ProductList.vue'), meta: { group: '商城', title: '商品列表' } },
  { path: '/search', name: 'Search', component: () => import('../views/Search.vue'), meta: { group: '商城', title: '商品搜索' } },
  { path: '/product/:id', name: 'ProductDetail', component: () => import('../views/ProductDetail.vue'), meta: { group: '商城', title: '商品详情' } },
  { path: '/trace', name: 'Trace', component: () => import('../views/Trace.vue'), meta: { group: '商城', title: '溯源查询' } },
  { path: '/channel/:channelId', name: 'ChannelShop', component: () => import('../views/ChannelShop.vue'), meta: { group: '商城', title: '渠道专柜' } },

  { path: '/cart', name: 'Cart', component: () => import('../views/Cart.vue'), meta: { group: '交易', title: '我的购物车' } },
  { path: '/order/confirm', name: 'OrderConfirm', component: () => import('../views/OrderConfirm.vue'), meta: { group: '交易', title: '确认订单' } },
  { path: '/pay/:id', name: 'Pay', component: () => import('../views/Pay.vue'), meta: { group: '交易', title: '订单支付' } },
  { path: '/pay/result', name: 'PayResult', component: () => import('../views/PayResult.vue'), meta: { group: '交易', title: '支付结果' } },

  { path: '/orders', name: 'Orders', component: () => import('../views/Orders.vue'), meta: { group: '订单', title: '我的订单' } },
  { path: '/order/:id', name: 'OrderDetail', component: () => import('../views/OrderDetail.vue'), meta: { group: '订单', title: '订单详情' } },
  { path: '/logistics/:orderId', name: 'Logistics', component: () => import('../views/Logistics.vue'), meta: { group: '订单', title: '物流追踪' } },
  { path: '/aftersale/apply', name: 'AfterSaleApply', component: () => import('../views/AfterSaleApply.vue'), meta: { group: '订单', title: '申请售后' } },
  { path: '/aftersale/:id', name: 'AfterSaleDetail', component: () => import('../views/AfterSaleDetail.vue'), meta: { group: '订单', title: '售后详情' } },

  { path: '/reviews', name: 'ReviewCenter', component: () => import('../views/ReviewCenter.vue'), meta: { group: '互动', title: '评价中心' } },
  { path: '/review/write', name: 'ReviewWrite', component: () => import('../views/ReviewWrite.vue'), meta: { group: '互动', title: '发表评价' } },
  { path: '/review/:id', name: 'ReviewDetail', component: () => import('../views/ReviewDetail.vue'), meta: { group: '互动', title: '评价详情' } },

  { path: '/coupons', name: 'CouponCenter', component: () => import('../views/CouponCenter.vue'), meta: { group: '营销', title: '领券中心' } },
  { path: '/my-coupons', name: 'MyCoupon', component: () => import('../views/MyCoupon.vue'), meta: { group: '营销', title: '我的优惠券' } },
  { path: '/flash', name: 'FlashList', component: () => import('../views/FlashList.vue'), meta: { group: '营销', title: '限时秒杀' } },
  { path: '/groups', name: 'GroupList', component: () => import('../views/GroupList.vue'), meta: { group: '营销', title: '拼团专区' } },
  { path: '/group/:id', name: 'GroupDetail', component: () => import('../views/GroupDetail.vue'), meta: { group: '营销', title: '拼团详情' } },

  { path: '/mine', name: 'Mine', component: () => import('../views/Mine.vue'), meta: { group: '账户', title: '个人中心' } },
  { path: '/member', name: 'Member', component: () => import('../views/Member.vue'), meta: { group: '账户', title: '会员中心' } },
  { path: '/growth', name: 'Growth', component: () => import('../views/Growth.vue'), meta: { group: '账户', title: '成长值明细' } },
  { path: '/points', name: 'Points', component: () => import('../views/Points.vue'), meta: { group: '账户', title: '我的积分' } },
  { path: '/points-mall', name: 'PointsMall', component: () => import('../views/PointsMall.vue'), meta: { group: '账户', title: '积分商城' } },
  { path: '/signin', name: 'SignIn', component: () => import('../views/SignIn.vue'), meta: { group: '账户', title: '每日签到' } },
  { path: '/favorites', name: 'Favorites', component: () => import('../views/Favorites.vue'), meta: { group: '账户', title: '我的收藏' } },
  { path: '/footprints', name: 'Footprints', component: () => import('../views/Footprints.vue'), meta: { group: '账户', title: '我的足迹' } },
  { path: '/addresses', name: 'Addresses', component: () => import('../views/Addresses.vue'), meta: { group: '账户', title: '收货地址' } },
  { path: '/address/new', name: 'AddressAdd', component: () => import('../views/AddressEdit.vue'), meta: { group: '账户', title: '新增收货地址' } },
  { path: '/address/:id/edit', name: 'AddressEdit', component: () => import('../views/AddressEdit.vue'), meta: { group: '账户', title: '编辑收货地址' } },
  { path: '/security', name: 'Security', component: () => import('../views/Security.vue'), meta: { group: '账户', title: '账户安全' } },
  { path: '/messages', name: 'Messages', component: () => import('../views/Messages.vue'), meta: { group: '账户', title: '消息通知' } },

  { path: '/boundary', name: 'Boundary', component: () => import('../views/Boundary.vue'), meta: { group: '说明', title: '模块边界' } },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.afterEach((to) => {
  document.title = `${to.meta?.title || '商城'} · 丰链云`
})

export default router
