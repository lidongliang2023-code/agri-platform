import { computed, defineComponent, h, onMounted, watchEffect } from 'vue'
import { createRouter, createWebHistory, useRoute, useRouter, type RouteRecordRaw } from 'vue-router'
import { Spin, message } from 'ant-design-vue'
import ProductionLayout, { type ProductionLayoutServices } from '../ProductionLayout.vue'
import useAuthStore, { isRedirectingToSsoLogout } from '../authStore'
import useFarmStore from '../farmStore'
import { ADMIN_HOME_PATH, USER_HOME_PATH, accountRequest, resolveHomePath } from '@/api/auth'
import { SSO_CLIENT_ID, redirectToSso } from '@/api/sso'
import { listAllFarms } from '@/api/farms'
import { getUnreadCount } from '@/api/messages'
import { mobileWorkspace, workspaceEndedPath } from '@/utils/mobile-workspace'
import NotFound from './pages/NotFound'
import MobileSession from './pages/mobile/MobileSession'
import SsoCallback from './pages/sso/SsoCallback'
import SsoHandoff from './pages/sso/SsoHandoff'
import { productionUserVueRoutes } from './userRoutes'
import { productionAdminVueRoutes } from './adminRoutes'
import '@/components/ProductionPageContainer.css'

function createLayoutHost(admin: boolean, title: string) {
  return defineComponent({
    name: admin ? 'ProductionAdminLayoutHost' : 'ProductionUserLayoutHost',
    setup() {
      const route = useRoute()
      const router = useRouter()
      const embedded = mobileWorkspace()
      const token = useAuthStore((s) => s.token)
      const authReady = useAuthStore((s) => s.authReady)
      const user = useAuthStore((s) => s.userInfo)
      const tokenExpireAt = useAuthStore((s) => s.tokenExpireAt)
      const marketId = useAuthStore((s) => s.marketId)
      const currentFarm = useFarmStore((s) => s.currentFarm)
      const farmOptions = useFarmStore((s) => s.farmOptions)

      const services: ProductionLayoutServices = {
        getSubjects: (signal) =>
          accountRequest<{
            activeMerchantId?: string
            merchants: Array<{ merchantId: string; merchantName?: string; active?: boolean }>
          }>({ url: '/summary', method: 'get', timeout: 15000, signal }),
        activateSubject: (merchantId) =>
          accountRequest<{ activeMerchantId: string; merchantName?: string }>({
            url: `/businesses/${encodeURIComponent(merchantId)}/activate`,
            method: 'post',
            data: {},
            timeout: 15000,
          }),
        getFarms: async () => {
          const rows = await listAllFarms()
          return rows.map((f) => ({ farmId: f.farmId, farmCode: f.farmCode, farmName: f.farmName }))
        },
        getUnreadCount,
        setUser: (next) => useAuthStore.getState().setUserInfo(next),
        setFarm: (farm) => useFarmStore.getState().setCurrentFarm(farm),
        setFarmOptions: (farms) => useFarmStore.getState().setFarmOptions(farms),
        reauthenticate: (returnTo) => {
          if (embedded) {
            void router.replace(workspaceEndedPath('expired'))
            return
          }
          void redirectToSso(SSO_CLIENT_ID, returnTo).catch((error: unknown) => {
            message.error(error instanceof Error ? error.message : '无法前往统一登录')
          })
        },
        logout: () => useAuthStore.getState().logout(),
      }

      return () => {
        if (!authReady.value) {
          return h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' } }, [h(Spin, { size: 'large' })])
        }
        if (!token.value) {
          if (isRedirectingToSsoLogout()) {
            return h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' } }, [h(Spin, { size: 'large' })])
          }
          if (embedded) {
            void router.replace(workspaceEndedPath('expired'))
            return null
          }
          return h(SsoHandoff, { clientId: SSO_CLIENT_ID, returnTo: route.fullPath })
        }
        return h(ProductionLayout, {
          admin,
          embedded,
          title,
          user: user.value,
          tokenReady: Boolean(token.value),
          tokenExpireAt: tokenExpireAt.value,
          marketId: marketId.value,
          currentFarm: currentFarm.value,
          farmOptions: farmOptions.value,
          services,
        })
      }
    },
  })
}

const RootEntry = defineComponent({
  name: 'ProductionRootEntry',
  setup() {
    const route = useRoute()
    const router = useRouter()
    const isLogout = computed(() => route.query.logout === '1')
    onMounted(() => {
      if (isLogout.value) {
        void redirectToSso(SSO_CLIENT_ID)
      } else {
        void router.replace('/production/dashboard')
      }
    })
    return () =>
      h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' } }, [
        h(Spin, { size: 'large' }),
      ])
  },
})

function createLegacyLoginRedirect(defaultEnd?: 'user' | 'admin') {
  return defineComponent({
    name: `ProductionLegacyLogin_${defaultEnd ?? 'auto'}`,
    setup() {
      const route = useRoute()
      const router = useRouter()
      const token = useAuthStore((s) => s.token)
      const roles = useAuthStore((s) => s.roles)
      const endParam = computed(() => String(route.query.end ?? ''))
      const targetHome = computed(() =>
        defaultEnd === 'admin' || endParam.value === 'admin'
          ? ADMIN_HOME_PATH
          : defaultEnd === 'user' || endParam.value === 'user'
            ? USER_HOME_PATH
            : resolveHomePath(roles.value),
      )
      const returnTo = computed(() =>
        defaultEnd === 'admin' || endParam.value === 'admin'
          ? ADMIN_HOME_PATH
          : defaultEnd === 'user' || endParam.value === 'user'
            ? USER_HOME_PATH
            : undefined,
      )
      watchEffect(() => {
        if (token.value) void router.replace(targetHome.value)
      })
      return () => (token.value ? null : h(SsoHandoff, { clientId: SSO_CLIENT_ID, returnTo: returnTo.value }))
    },
  })
}

const adminChildren: RouteRecordRaw[] = [
  { path: '', redirect: '/admin/production/dashboard' },
  ...productionAdminVueRoutes.map((r) => ({
    ...r,
    path: r.path.replace(/^\/admin\/production\/?/, ''),
  })),
]

export const productionVueRoutes: RouteRecordRaw[] = [
  { path: '/mobile/session', component: MobileSession },
  { path: '/', component: RootEntry },
  {
    path: '/production',
    component: createLayoutHost(false, '农业生产管理系统'),
    children: productionUserVueRoutes,
  },
  {
    path: '/admin/production',
    component: createLayoutHost(true, '农业生产运营管理平台'),
    children: adminChildren,
  },
  { path: '/login', component: createLegacyLoginRedirect() },
  { path: '/admin/login', component: createLegacyLoginRedirect('admin') },
  { path: '/production/login', component: createLegacyLoginRedirect('user') },
  { path: '/sso/callback', component: defineComponent({ setup: () => () => h(SsoCallback, { clientId: 'prod' }) }) },
  { path: '/:pathMatch(.*)*', component: NotFound },
]

export function createProductionRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: productionVueRoutes,
  })
}
