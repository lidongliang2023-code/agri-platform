import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/login', name: 'Login', component: () => import('../views/Login.vue') },
  { 
    path: '/', 
    component: () => import('../views/Layout.vue'),
    children: [
      { path: '', name: 'Dashboard', component: () => import('../views/Dashboard.vue') },
      { path: 'suppliers', name: 'Suppliers', component: () => import('../views/Suppliers.vue') },
      { path: 'supplier-detail/:id', name: 'SupplierDetail', component: () => import('../views/SupplierDetail.vue') },
      { path: 'channel-partners', name: 'ChannelPartners', component: () => import('../views/ChannelPartners.vue') },
      { path: 'channel-partner-detail/:id', name: 'ChannelPartnerDetail', component: () => import('../views/ChannelPartnerDetail.vue') },
      { path: 'products', name: 'Products', component: () => import('../views/Products.vue') },
      { path: 'product-detail/:id', name: 'ProductDetail', component: () => import('../views/ProductDetail.vue') },
      { path: 'orders', name: 'Orders', component: () => import('../views/Orders.vue') },
      { path: 'categories', name: 'Categories', component: () => import('../views/Categories.vue') }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router