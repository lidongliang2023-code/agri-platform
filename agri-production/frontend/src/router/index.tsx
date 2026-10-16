/**
 * 路由总入口
 *
 * 用户端挂载在 /production（UserLayout），运营端挂载在 /admin/production（AdminLayout）。
 */
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { createBrowserRouter, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { Spin } from 'antd'
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

/** 上次使用的端（用户端 / 运营端）。SSO 登出写死回跳 `/?logout=1`、不带端信息，只能记在本地。 */
const END_KEY = 'agri_end'

/** 按端取登录页 */
function loginPathForEnd(end: string | null): string {
  return end === 'admin' ? ADMIN_LOGIN_PATH : USER_LOGIN_PATH
}

/**
 * 受保护路由守卫（2026-10-16 加）。

 *
 * <p><b>没有它的时候</b>：无会话直接打开 `/production/farms`，页面会先**渲染出来**，
 * 然后一串接口 401、请求层再把浏览器弹去 `/login` —— 用户看到的是"闪一下空页面"，
 * 而且 `/login` 在没有 `?end=user` 时分流到**运营端**登录页（用户端页面也落到运营端）。</p>

 *
 * <p>现在：进入受保护路由前先看令牌，没有就**直接**跳本端登录页，业务请求一个都不发。
 * `authReady` 由 `App.tsx` 统一等待（换令牌期间渲染 Spin），这里只兜底。</p>
 *
 * @param end 当前端：user 用户端 / admin 运营端
 * @param children 受保护内容
 */
function RequireAuth({ end, children }: { end: 'user' | 'admin'; children: ReactNode }): JSX.Element {
  const token = useAuthStore((state) => state.token)
  const authReady = useAuthStore((state) => state.authReady)
  const location = useLocation()

  // 记住"这台浏览器上次在用哪个端"，供退出登录（SSO 回跳 /?logout=1）落回同一端的登录页
  useEffect(() => {
    try {
      localStorage.setItem(END_KEY, end)
    } catch { /* 隐私模式下 localStorage 不可用，忽略 */ }
  }, [end])

  if (!authReady) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <Spin size="large" />
      </div>
    )
  }
  if (!token) {
    return (
      <Navigate
        to={end === 'admin' ? ADMIN_LOGIN_PATH : USER_LOGIN_PATH}
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    )
  }
  return <>{children}</>
}

/**
 * 站点根（`/`）的落地。

 *
 * <p>`?logout=1` 是**统一认证中心登出后的固定回跳**（它忽略 `redirect_uri`，写死 `${origin}/?logout=1`）。
 * 改前这里一律送去 `/production/dashboard` —— 那是业务页，刚登出的人会被守卫/401 再弹一次，
 * 实测最终停在**运营端**登录页（用户端也这样）。现在识别这个信号，直接落回**本端**登录页。</p>
 */
function RootEntry(): JSX.Element {
  const [searchParams] = useSearchParams()
  if (searchParams.get('logout') === '1') {
    let end: string | null = null
    try {
      end = localStorage.getItem(END_KEY)
    } catch { /* 隐私模式忽略 */ }
    return <Navigate to={loginPathForEnd(end)} replace />
  }
  return <Navigate to="/production/dashboard" replace />
}

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
    element: <RootEntry />,
  },
  {
    path: '/production',
    element: (
      <RequireAuth end="user">
        <UserLayout />
      </RequireAuth>
    ),
    children: USER_ROUTES,
  },
  {
    path: '/admin/production',
    element: (
      <RequireAuth end="admin">
        <AdminLayout />
      </RequireAuth>
    ),
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
