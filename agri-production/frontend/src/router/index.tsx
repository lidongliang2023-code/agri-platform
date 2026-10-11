/**
 * 路由总入口
 *
 * 用户端挂载在 /production（UserLayout），运营端挂载在 /admin/production（AdminLayout）。
 */
import { createBrowserRouter, Navigate, useSearchParams } from 'react-router-dom'
import UserLayout from '@/layouts/UserLayout'
import AdminLayout from '@/layouts/AdminLayout'
import NotFound from '@/pages/NotFound'
import AdminLogin from '@/pages/admin/AdminLogin'
import UserLogin from '@/pages/user/UserLogin'
import SsoCallback from '@/pages/sso/SsoCallback'
import SsoHandoff from '@/pages/sso/SsoHandoff'
import { ADMIN_ROUTES, USER_ROUTES } from './routes'
import useAuthStore from '@/store/auth'
import { ADMIN_LOGIN_PATH, USER_LOGIN_PATH, resolveHomePath } from '@/api/auth'

/**
 * 登录入口按端分流（`/login` 的落地组件）。
 *
 * 保留 `/login` 是为了兼容旧链接与 `@/utils/request` 的 401 跳转：把分流收在这一处，
 * 401 那条链路就自动落回"对应端的登录页"，无需改动请求层（避免 auth → request 循环依赖）。
 *
 * 判据（按 team-lead 裁决「按端重定向」）：
 *   1) 已登录 → 按角色回对应首页；
 *   2) 未登录且带 `?end=user` → 用户端登录页；
 *   3) 其余（含 `?end=admin` 与无参数）→ 运营端登录页。
 *
 * @returns 重定向节点
 */
function LoginEntry(): JSX.Element {
  const token = useAuthStore((state) => state.token)
  const roles = useAuthStore((state) => state.roles)
  const [searchParams] = useSearchParams()

  if (token) {
    return <Navigate to={resolveHomePath(roles)} replace />
  }
  return <Navigate to={searchParams.get('end') === 'user' ? USER_LOGIN_PATH : ADMIN_LOGIN_PATH} replace />
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/production/dashboard" replace />,
  },
  {
    path: '/production',
    element: <UserLayout />,
    children: USER_ROUTES,
  },
  {
    path: '/admin/production',
    element: <AdminLayout />,
    children: ADMIN_ROUTES,
  },
  {
    // 登录入口：按端分流（见 LoginEntry 注释）
    path: '/login',
    element: <LoginEntry />,
  },
  {
    // 运营端独立登录页（路线 2「独立登录页」拆分）：独立全屏页，不挂任何 Layout，
    // 也不进业务分组与页面条数统计（条数由 routes.tsx 的 TOTAL_PAGE_COUNT 派生）
    //
    // 外面再包一层 SsoHandoff：未登录用户送统一认证中心（V2.0 5.2），
    // 已登录或带 ?local=1 时照旧渲染本地登录页（过渡期回退路径）。
    path: '/admin/login',
    element: <SsoHandoff clientId="prod" fallback={<AdminLogin />} />,
  },
  {
    // 用户端独立登录页（同上）
    path: '/production/login',
    element: <SsoHandoff clientId="prod" fallback={<UserLogin />} />,
  },
  {
    // SSO 回跳：授权码换令牌的落点（V2.0 5.2 第 ⑥⑦ 步）
    path: '/sso/callback',
    element: <SsoCallback clientId="prod" />,
  },
  {
    path: '*',
    element: <NotFound />,
  },
])

export default router
