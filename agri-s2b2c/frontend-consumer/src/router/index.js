import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'Home', component: () => import('../views/Home.vue') },
  { path: '/category', name: 'Category', component: () => import('../views/Category.vue') },
  { path: '/cart', name: 'Cart', component: () => import('../views/Cart.vue') },
  { path: '/my', name: 'My', component: () => import('../views/My.vue') },
  { path: '/product/:id', name: 'ProductDetail', component: () => import('../views/ProductDetail.vue') },
  { path: '/search', name: 'Search', component: () => import('../views/Search.vue') },
  { path: '/orders', name: 'Orders', component: () => import('../views/Orders.vue') },
  { path: '/order-detail/:id', name: 'OrderDetail', component: () => import('../views/OrderDetail.vue') },
  { path: '/addresses', name: 'Addresses', component: () => import('../views/Addresses.vue') },
  { path: '/address-add', name: 'AddressAdd', component: () => import('../views/AddressAdd.vue') },
  { path: '/address-edit/:id', name: 'AddressEdit', component: () => import('../views/AddressEdit.vue') },
  { path: '/order-confirm', name: 'OrderConfirm', component: () => import('../views/OrderConfirm.vue') },
  { path: '/login', name: 'Login', component: () => import('../views/Login.vue') }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router