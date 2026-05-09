import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/login/Login.vue')
  },
  {
    path: '/',
    name: 'Layout',
    component: () => import('../views/layout/Layout.vue'),
    children: [
      { path: '', name: 'Dashboard', component: () => import('../views/dashboard/Dashboard.vue') },
      { path: 'tenant', name: 'TenantList', component: () => import('../views/tenant/TenantList.vue') },
      { path: 'user', name: 'UserList', component: () => import('../views/user/UserList.vue') },
      { path: 'device', name: 'DeviceList', component: () => import('../views/device/DeviceList.vue') },
      { path: 'alert', name: 'AlertList', component: () => import('../views/alert/AlertList.vue') },
      { path: 'gateway', name: 'GatewayList', component: () => import('../views/gateway/GatewayList.vue') },
      { path: 'firmware', name: 'FirmwareList', component: () => import('../views/firmware/FirmwareList.vue') },
      { path: 'ota', name: 'OtaTask', component: () => import('../views/ota/OtaTask.vue') },
      { path: 'system', name: 'SystemConfig', component: () => import('../views/system/SystemConfig.vue') }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('admin_token')
  if (to.path !== '/login' && !token) {
    next('/login')
  } else {
    next()
  }
})

export default router