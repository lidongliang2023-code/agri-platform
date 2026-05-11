import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('../views/Dashboard.vue')
  },
  {
    path: '/farms',
    name: 'Farms',
    component: () => import('../views/Farms.vue')
  },
  {
    path: '/plots',
    name: 'Plots',
    component: () => import('../views/Plots.vue')
  },
  {
    path: '/tasks',
    name: 'Tasks',
    component: () => import('../views/Tasks.vue')
  },
  {
    path: '/inputs',
    name: 'Inputs',
    component: () => import('../views/Inputs.vue')
  },
  {
    path: '/harvests',
    name: 'Harvests',
    component: () => import('../views/Harvests.vue')
  },
  {
    path: '/inventory',
    name: 'Inventory',
    component: () => import('../views/Inventory.vue')
  },
  {
    path: '/trace',
    name: 'Trace',
    component: () => import('../views/Trace.vue')
  },
  {
    path: '/chain',
    name: 'Chain',
    component: () => import('../views/Chain.vue')
  },
  {
    path: '/iot',
    name: 'IoT',
    component: () => import('../views/IoT.vue')
  },
  {
    path: '/alerts',
    name: 'Alerts',
    component: () => import('../views/Alerts.vue')
  },
  {
    path: '/ai',
    name: 'AI',
    component: () => import('../views/AI.vue')
  },
  {
    path: '/admin',
    name: 'Admin',
    component: () => import('../views/Admin.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
