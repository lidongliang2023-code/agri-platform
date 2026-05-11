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
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('../views/dashboard/Dashboard.vue')
      },
      {
        path: 'device/list',
        name: 'DeviceList',
        component: () => import('../views/device/DeviceList.vue')
      },
      {
        path: 'device/detail/:id',
        name: 'DeviceDetail',
        component: () => import('../views/device/DeviceDetail.vue')
      },
      {
        path: 'device/type',
        name: 'DeviceTypeList',
        component: () => import('../views/device/DeviceTypeList.vue')
      },
      {
        path: 'group',
        name: 'GroupList',
        component: () => import('../views/group/GroupList.vue')
      },
      {
        path: 'alert/list',
        name: 'AlertList',
        component: () => import('../views/alert/AlertList.vue')
      },
      {
        path: 'alert/rule',
        name: 'AlertRule',
        component: () => import('../views/alert/AlertRule.vue')
      },
      {
        path: 'automation',
        name: 'RuleList',
        component: () => import('../views/automation/RuleList.vue')
      },
      {
        path: 'automation/config',
        name: 'RuleConfig',
        component: () => import('../views/automation/RuleConfig.vue')
      },
      {
        path: 'push/config',
        name: 'PushConfig',
        component: () => import('../views/push/PushConfig.vue')
      },
      {
        path: 'push/message',
        name: 'PushMessage',
        component: () => import('../views/push/PushMessage.vue')
      },
      {
        path: 'report/list',
        name: 'ReportList',
        component: () => import('../views/report/ReportList.vue')
      },
      {
        path: 'report/export',
        name: 'ReportExport',
        component: () => import('../views/report/ReportList.vue')
      },
      {
        path: 'plot',
        name: 'PlotList',
        component: () => import('../views/plot/PlotList.vue')
      },
      {
        path: 'scene',
        name: 'SceneList',
        component: () => import('../views/scene/SceneList.vue')
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  if (to.path !== '/login' && !token) {
    next('/login')
  } else {
    next()
  }
})

export default router