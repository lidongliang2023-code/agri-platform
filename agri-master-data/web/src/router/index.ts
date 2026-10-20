/**
 * 路由（Vue Router 4）。
 *
 * <p><b>为什么是"显式表 + 自动兜底"而不是纯自动派生：</b>
 * 之前的路由完全由文件名派生（`views/tenant/TenantList.vue` → `/tenant/tenant-list`），
 * 结果是**侧边栏里每一个链接都点不到页面**——菜单写的是 `/tenant/list`，
 * 路由器只认 `/tenant/tenant-list`。文件名与菜单名不可能靠规则对齐，
 * 所以这里把"菜单/详情页要用的路径"显式写成一张表，剩下没被表覆盖的视图再自动登记，
 * 保证没有任何页面是够不着的。</p>
 *
 * <p>表里每一条都会在解析时检查视图文件是否存在：缺文件不会被静默忽略，
 * 而是渲染成一个明确报出文件名的占位页（见 {@link resolve}）。</p>
 */
import { h } from 'vue'
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import AdminLayout from '@/components/Layout.vue'
import UserLayout from '@/components/UserLayout.vue'
import { useSessionStore } from '@/stores/session'
import { LOGIN_PATH } from '@/utils/sso'

const modules = import.meta.glob('../views/**/*.vue') as Record<string, () => Promise<unknown>>

/**
 * 按视图键取组件加载器。
 *
 * <p>找不到时返回一个**把缺失文件名写在自己脸上**的占位组件，而不是空组件：
 * 空组件会渲染成白屏，看的人只会以为"页面坏了"；写清文件名就能直接定位。</p>
 */
function resolve(viewKey: string): () => Promise<unknown> {
  const loader = modules[`../views/${viewKey}.vue`]
  if (loader) {
    return loader
  }
  return async () => ({
    render: () =>
      h(
        'div',
        { style: 'padding:24px;color:#da3633;font-family:system-ui' },
        `页面缺失：views/${viewKey}.vue 不存在（路由已登记但文件没找到）`,
      ),
  })
}

interface RouteSpec {
  path: string
  view: string
}

/**
 * 运营端路由表。**路径与 `components/Layout.vue` 的菜单一一对应**，
 * 改动菜单时必须同步改这里，否则又会出现"菜单点不到页面"。
 */
const ADMIN_ROUTES: RouteSpec[] = [
  { path: '/dashboard', view: 'Dashboard' },
  { path: '/masterdata/center', view: 'masterdata/MasterDataCenter' },

  { path: '/tenant/list', view: 'tenant/TenantList' },
  { path: '/tenant/quota', view: 'tenant/TenantQuota' },
  { path: '/tenant/package', view: 'tenant/TenantPackage' },
  { path: '/tenant/statistics', view: 'tenant/TenantStatistics' },
  { path: '/tenant/detail/:id', view: 'tenant/TenantDetail' },

  { path: '/user/list', view: 'user/UserList' },
  { path: '/user/audit', view: 'user/UserAudit' },
  { path: '/user/detail/:id', view: 'user/UserDetail' },

  { path: '/org/list', view: 'org/OrgList' },
  { path: '/org/detail/:id', view: 'org/OrgDetail' },

  { path: '/permission/role', view: 'permission/RoleList' },
  { path: '/permission/log', view: 'permission/PermissionLog' },

  { path: '/datastandard/dict', view: 'datastandard/DictList' },
  { path: '/datastandard/code-rule', view: 'datastandard/CodeRuleList' },

  { path: '/quality/dashboard', view: 'quality/QualityDashboard' },
  { path: '/quality/list', view: 'quality/QualityList' },
  { path: '/quality/rule', view: 'quality/QualityRule' },
  { path: '/quality/task', view: 'quality/QualityTask' },
  { path: '/quality/issue', view: 'quality/QualityIssue' },

  { path: '/distribution/list', view: 'distribution/DistributionList' },
  { path: '/product/list', view: 'product/ProductList' },
  { path: '/product/catalog', view: 'product/CatalogList' },
  { path: '/customer/list', view: 'customer/CustomerList' },
  { path: '/supplier/list', view: 'customer/SupplierList' },

  { path: '/system/params', view: 'system/SystemParams' },
  { path: '/system/template', view: 'system/NotificationTemplate' },
  { path: '/system/announcement', view: 'system/Announcement' },
  { path: '/system/region', view: 'system/RegionList' },
]

/**
 * 用户端路由表。
 *
 * <p>路径口径与 `components/UserLayout.vue` 的菜单一致。
 * 注意运营端也有 `/user/*`（用户管理），与用户端的 `/user/home` 等**不冲突但容易混淆**——
 * 两套菜单分属不同布局、不同登录入口，路由层面按完整路径区分。</p>
 */
const USER_ROUTES: RouteSpec[] = [
  { path: '/user/home', view: 'userportal/UserHome' },
  { path: '/user/data', view: 'userportal/UserDataQuery' },
  { path: '/user/report', view: 'userportal/UserReport' },
  { path: '/user/help', view: 'userportal/UserHelp' },
  { path: '/user/profile', view: 'userportal/UserProfile' },
  { path: '/user/settings', view: 'userportal/UserSettings' },
]

const consumed = new Set<string>([
  ...ADMIN_ROUTES.map((route) => route.view),
  ...USER_ROUTES.map((route) => route.view),
  'Login',
  'SsoCallback',
  'userportal/UserLogin',
])
const takenPaths = new Set<string>([
  ...ADMIN_ROUTES.map((route) => route.path),
  ...USER_ROUTES.map((route) => route.path),
  LOGIN_PATH,
  '/sso/callback',
  '/user/login',
])

/** 文件名 → 路径：`tenant/TenantList` → `/tenant/list`（目录名后的重复前缀去掉） */
function derivePath(viewKey: string): string {
  const segments = viewKey.split('/')
  const fileName = segments.pop() ?? ''
  const kebab = fileName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
  const dir = segments.join('/')
  if (!dir) {
    return `/${kebab}`
  }
  const dirTail = dir.split('/').pop() ?? ''
  const shortKebab = kebab.startsWith(`${dirTail}-`) ? kebab.slice(dirTail.length + 1) : kebab
  return `/${dir}/${shortKebab}`
}

/** 自动兜底：未被显式表覆盖的视图，按文件名登记，保证"每个文件都点得到" */
const AUTO_ROUTES: RouteSpec[] = Object.keys(modules)
  .map((key) => key.replace('../views/', '').replace(/\.vue$/, ''))
  .filter((viewKey) => !consumed.has(viewKey))
  .map((viewKey) => ({ path: derivePath(viewKey), view: viewKey }))
  .filter((route) => !takenPaths.has(route.path))

const adminChildren: RouteRecordRaw[] = [
  { path: '', redirect: '/dashboard' },
  ...[...ADMIN_ROUTES, ...AUTO_ROUTES].map(
    (route) =>
      ({
        path: route.path,
        name: route.path,
        component: resolve(route.view),
      }) as RouteRecordRaw,
  ),
]

const routes: RouteRecordRaw[] = [
  // 公开页：登录页与 SSO 回跳页必须在守卫之外，否则"要去登录"本身会被判定为未登录
  { path: LOGIN_PATH, name: 'login', component: resolve('Login'), meta: { public: true } },
  { path: '/sso/callback', name: 'sso-callback', component: resolve('SsoCallback'), meta: { public: true } },
  { path: '/user/login', name: 'user-login', component: resolve('userportal/UserLogin'), meta: { public: true } },
  {
    path: '/',
    component: AdminLayout,
    children: adminChildren,
  },
  {
    path: '/user',
    component: UserLayout,
    children: USER_ROUTES.map(
      (route) =>
        ({
          path: route.path,
          name: route.path,
          component: resolve(route.view),
        }) as RouteRecordRaw,
    ),
  },
  {
    // 兜底：不静默重定向到首页（那样打错地址看起来像"进了首页，没问题"），
    // 直接把未知路径显示出来。
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: {
      render: () => h('div', { style: 'padding:24px;font-family:system-ui' }, '页面不存在'),
    },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

/**
 * 登录守卫。
 *
 * <p>访问令牌只存内存，所以刷新页面后 `isLoggedIn` 必然是 false —— 若此时就判定未登录，
 * 已登录用户会被弹回登录页（表现为"一刷新就掉登录"）。因此先等启动续签出结果
 * （`session.ready`，由 `main.ts` 在挂载前 await），`ready` 之前一律放行。</p>
 */
router.beforeEach((to) => {
  if (to.meta.public) {
    return true
  }
  const session = useSessionStore()
  if (!session.ready) {
    return true
  }
  if (!session.isLoggedIn) {
    return { path: LOGIN_PATH, query: { redirect: to.fullPath } }
  }
  return true
})

export default router
