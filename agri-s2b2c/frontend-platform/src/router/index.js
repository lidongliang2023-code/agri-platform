import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { 
    path: '/', 
    component: () => import('../views/Layout.vue'),
    children: [
      { path: 'supply', component: () => import('../views/SupplyWorkspace.vue'), children: [
          { path: '', redirect: '/supply/products' },
          { path: 'todo', component: () => import('../supply/views/Todo.vue') },
          { path: 'supply-pool', component: () => import('../supply/views/SupplyPool.vue') },
          { path: 'listing-config', component: () => import('../supply/views/ListingConfig.vue') },
          { path: 'distributors', component: () => import('../supply/views/Distributors.vue') },
          { path: 'distributor-detail/:id', component: () => import('../supply/views/DistributorDetail.vue') },
          { path: 'recruit', component: () => import('../supply/views/Recruit.vue') },
          { path: 'revenue', component: () => import('../supply/views/Revenue.vue') },
          { path: 'analytics', component: () => import('../supply/views/Analytics.vue') },
          { path: 'notice-settings', component: () => import('../supply/views/NoticeSettings.vue') },
          { path: 'products', component: () => import('../supply/views/Products.vue') },
          { path: 'product-add', component: () => import('../supply/views/ProductAdd.vue') },
          { path: 'product-edit/:id', component: () => import('../supply/views/ProductEdit.vue') },
          { path: 'orders', component: () => import('../supply/views/Orders.vue') },
          { path: 'order-detail/:id', component: () => import('../supply/views/OrderDetail.vue') }
      ] },
      { path: '', name: 'Dashboard', component: () => import('../views/Dashboard.vue') },
      { path: 'suppliers', name: 'Suppliers', component: () => import('../views/Suppliers.vue') },
      { path: 'supplier-detail/:id', name: 'SupplierDetail', component: () => import('../views/SupplierDetail.vue') },
      { path: 'channel-partners', name: 'ChannelPartners', component: () => import('../views/ChannelPartners.vue') },
      { path: 'channel-partner-detail/:id', name: 'ChannelPartnerDetail', component: () => import('../views/ChannelPartnerDetail.vue') },
      { path: 'products', name: 'Products', component: () => import('../views/Products.vue') },
      { path: 'product-pool', name: 'ProductPool', component: () => import('../views/ProductPool.vue') },
      { path: 'product-detail/:id', name: 'ProductDetail', component: () => import('../views/ProductDetail.vue') },
      { path: 'orders', name: 'Orders', component: () => import('../views/Orders.vue') },
      { path: 'order-detail/:id', name: 'OrderDetail', component: () => import('../views/OrderDetail.vue') },
      { path: 'channel-onboard', name: 'ChannelOnboard', component: () => import('../views/ChannelOnboard.vue') },
      { path: 'after-sales', name: 'AfterSales', component: () => import('../views/AfterSales.vue') },
      { path: 'reviews', name: 'Reviews', component: () => import('../views/Reviews.vue') },
      { path: 'fulfillment', name: 'Fulfillment', component: () => import('../views/Fulfillment.vue') },
      { path: 'activity-monitor', name: 'ActivityMonitor', component: () => import('../views/ActivityMonitor.vue') },
      { path: 'activity-create', name: 'ActivityCreate', component: () => import('../views/ActivityCreate.vue') },
      { path: 'activities', name: 'Activities', component: () => import('../views/Activities.vue') },
      { path: 'coupons', name: 'Coupons', component: () => import('../views/Coupons.vue') },
      { path: 'inventory', name: 'Inventory', component: () => import('../views/Inventory.vue') },
      { path: 'price-center', name: 'PriceCenter', component: () => import('../views/PriceCenter.vue') },
      { path: 'settlement', name: 'Settlement', component: () => import('../views/Settlement.vue') },
      { path: 'commission-report', name: 'CommissionReport', component: () => import('../views/CommissionReport.vue') },
      { path: 'supplier-statements', name: 'SupplierStatements', component: () => import('../views/SupplierStatements.vue') },
      { path: 'reports', name: 'Reports', component: () => import('../views/Reports.vue') },
      { path: 'group-purchases', name: 'GroupPurchases', component: () => import('../views/GroupPurchase.vue') },
      { path: 'risk-rules', name: 'RiskRules', component: () => import('../views/RiskRules.vue') },
      { path: 'risk-events', name: 'RiskEvents', component: () => import('../views/RiskEvents.vue') },
      { path: 'boundary', name: 'Boundary', component: () => import('../views/Boundary.vue') },
      { path: 'gap/:key', name: 'Gap', component: () => import('../views/Gap.vue') },
      { path: 'growth', name: 'Growth', component: () => import('../views/Growth.vue') },
      { path: 'commission-rules', name: 'CommissionRules', component: () => import('../views/CommissionRules.vue') },
      { path: 'withdrawals', name: 'Withdrawals', component: () => import('../views/Withdrawals.vue') },
      { path: 'categories', name: 'Categories', component: () => import('../views/Categories.vue') }
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
