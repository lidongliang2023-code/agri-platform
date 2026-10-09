/**
 * 路由总入口
 *
 * 用户端挂载在 /production（UserLayout），运营端挂载在 /admin/production（AdminLayout）。
 */
import { createBrowserRouter, Navigate } from 'react-router-dom'
import UserLayout from '@/layouts/UserLayout'
import AdminLayout from '@/layouts/AdminLayout'
import NotFound from '@/pages/NotFound'
import Login from '@/pages/Login'
import { ADMIN_ROUTES, USER_ROUTES } from './routes'

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
    // 登录页：独立全屏页面，不挂任何 Layout，也不进业务分组与页面条数统计
    //（页面条数由 routes.tsx 的 TOTAL_PAGE_COUNT 从路由表派生，此处不再写死数字）
    path: '/login',
    element: <Login />,
  },
  {
    path: '*',
    element: <NotFound />,
  },
])

export default router
