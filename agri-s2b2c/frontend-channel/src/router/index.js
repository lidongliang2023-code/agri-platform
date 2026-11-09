import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    component: () => import('../views/Layout.vue'),
    children: [
      { path: '', name: 'Dashboard', component: () => import('../views/Dashboard.vue') },
      { path: 'product-pool', name: 'ProductPool', component: () => import('../views/ProductPool.vue') },
      { path: 'products', name: 'Products', component: () => import('../views/Products.vue') },
      { path: 'listing', name: 'Listing', component: () => import('../views/Products.vue') },
      { path: 'orders', name: 'Orders', component: () => import('../views/Orders.vue') },
      { path: 'orders/:id', name: 'OrderDetail', component: () => import('../views/OrderDetail.vue') },
      { path: 'fulfillment', name: 'Fulfillment', component: () => import('../views/Fulfillment.vue') },
      { path: 'after-sales', name: 'AfterSales', component: () => import('../views/AfterSales.vue') },
      { path: 'reviews', name: 'Reviews', component: () => import('../views/Reviews.vue') },
      { path: 'customers', name: 'Customers', component: () => import('../views/Customers.vue') },
      { path: 'customers/:id', name: 'CustomerDetail', component: () => import('../views/CustomerDetail.vue') },
      { path: 'customer-ops', name: 'CustomerOps', component: () => import('../views/CustomerOps.vue') },
      { path: 'commissions', name: 'Commissions', component: () => import('../views/Commissions.vue') },
      { path: 'wallet', name: 'Wallet', component: () => import('../views/Wallet.vue') },
      { path: 'inventory', name: 'Inventory', component: () => import('../views/Inventory.vue') },
      { path: 'reconcile', name: 'Reconcile', component: () => import('../views/Reconcile.vue') },
      { path: 'analytics', name: 'Analytics', component: () => import('../views/Analytics.vue') },
      { path: 'purchase', name: 'Purchase', component: () => import('../views/Purchase.vue') },
      { path: 'marketing', name: 'Marketing', component: () => import('../views/Marketing.vue') },
      { path: 'marketing/coupons', name: 'MarketingCoupons', component: () => import('../views/Marketing.vue') },
      { path: 'marketing/flash', name: 'MarketingFlash', component: () => import('../views/Marketing.vue') },
      { path: 'marketing/groups', name: 'MarketingGroups', component: () => import('../views/Marketing.vue') },
      { path: 'marketing/share', name: 'MarketingShare', component: () => import('../views/Marketing.vue') },
      { path: 'growth', name: 'Growth', component: () => import('../views/Growth.vue') },
      { path: 'profile', name: 'Profile', component: () => import('../views/Profile.vue') },
      { path: 'settings', name: 'Settings', component: () => import('../views/Settings.vue') },
      { path: 'notice-settings', name: 'NoticeSettings', component: () => import('../views/NoticeSettings.vue') },
      { path: 'boundary', name: 'Boundary', component: () => import('../views/Boundary.vue') },
      { path: 'apply', name: 'Apply', component: () => import('../views/Apply.vue') },
      { path: 'gap/:key', name: 'Gap', component: () => import('../views/Gap.vue') },
    ]
  },
  // 未匹配路径（含已下线的 /login）统一回首页，避免白屏
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
