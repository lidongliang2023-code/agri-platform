import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/login', redirect: '/' },
  { 
    path: '/', 
    component: () => import('../views/Layout.vue'),
    children: [
      { path: '', name: 'Dashboard', component: () => import('../views/Dashboard.vue') },
      { path: 'todo', name: 'Todo', component: () => import('../views/Todo.vue') },
      { path: 'supply-pool', name: 'SupplyPool', component: () => import('../views/SupplyPool.vue') },
      { path: 'listing-config', name: 'ListingConfig', component: () => import('../views/ListingConfig.vue') },
      { path: 'distributors', name: 'Distributors', component: () => import('../views/Distributors.vue') },
      { path: 'distributor-detail/:id', name: 'DistributorDetail', component: () => import('../views/DistributorDetail.vue') },
      { path: 'recruit', name: 'Recruit', component: () => import('../views/Recruit.vue') },
      { path: 'after-sales', name: 'AfterSales', component: () => import('../views/AfterSales.vue') },
      { path: 'reviews', name: 'Reviews', component: () => import('../views/Reviews.vue') },
      { path: 'revenue', name: 'Revenue', component: () => import('../views/Revenue.vue') },
      { path: 'analytics', name: 'Analytics', component: () => import('../views/Analytics.vue') },
      { path: 'notice-settings', name: 'NoticeSettings', component: () => import('../views/NoticeSettings.vue') },
      { path: 'boundary', name: 'Boundary', component: () => import('../views/Boundary.vue') },
      { path: 'gap/:key', name: 'Gap', component: () => import('../views/Gap.vue') },
      { path: 'products', name: 'Products', component: () => import('../views/Products.vue') },
      { path: 'product-add', name: 'ProductAdd', component: () => import('../views/ProductAdd.vue') },
      { path: 'product-edit/:id', name: 'ProductEdit', component: () => import('../views/ProductEdit.vue') },
      { path: 'orders', name: 'Orders', component: () => import('../views/Orders.vue') },
      { path: 'order-detail/:id', name: 'OrderDetail', component: () => import('../views/OrderDetail.vue') },
      { path: 'profile', name: 'Profile', component: () => import('../views/Profile.vue') },
      { path: 'apply', name: 'Apply', component: () => import('../views/Apply.vue') },
      { path: 'audit-progress', name: 'AuditProgress', component: () => import('../views/AuditProgress.vue') }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
