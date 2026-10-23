import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/login', name: 'Login', component: () => import('../views/Login.vue') },
  { 
    path: '/', 
    component: () => import('../views/Layout.vue'),
    children: [
      { path: '', name: 'Dashboard', component: () => import('../views/Dashboard.vue') },
      { path: 'product-pool', name: 'ProductPool', component: () => import('../views/ProductPool.vue') },
      { path: 'products', name: 'Products', component: () => import('../views/Products.vue') },
      { path: 'orders', name: 'Orders', component: () => import('../views/Orders.vue') },
      { path: 'commissions', name: 'Commissions', component: () => import('../views/Commissions.vue') },
      { path: 'profile', name: 'Profile', component: () => import('../views/Profile.vue') },
      { path: 'apply', name: 'Apply', component: () => import('../views/Apply.vue') }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router