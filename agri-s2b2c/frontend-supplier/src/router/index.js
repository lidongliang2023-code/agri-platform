import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/login', name: 'Login', component: () => import('../views/Login.vue') },
  { 
    path: '/', 
    component: () => import('../views/Layout.vue'),
    children: [
      { path: '', name: 'Dashboard', component: () => import('../views/Dashboard.vue') },
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