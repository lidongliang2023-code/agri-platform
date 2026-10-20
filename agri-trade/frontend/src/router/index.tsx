import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Layout from '@/pages/layout'
import Login from '@/pages/login'
import Home from '@/pages/home'
import OrderDetail from '@/pages/order/detail'
import OrderConfirm from '@/pages/order/confirm'
import OrderCreate from '@/pages/order/create'
import ProductCreate from '@/pages/product/create'
import ProductDetail from '@/pages/product/detail'
import ShopDetail from '@/pages/shop/detail'
import DemandCreate from '@/pages/demand/create'
import DemandDetail from '@/pages/demand/detail'
import MineDashboardPage from '@/pages/mine'
import BuyerCenter from '@/pages/member-center/BuyerCenter'
import SellerCenter from '@/pages/member-center/SellerCenter'
import SsoCallback from '@/pages/sso/callback'
import AdminLayout from '@/pages/admin/layout'
import AdminDashboard from '@/pages/admin/dashboard'
import AdminProductAudit from '@/pages/admin/product'
import AdminOrderOversight from '@/pages/admin/order'
import AdminDispute from '@/pages/admin/dispute'
import AdminRefund from '@/pages/admin/refund'
import AdminCompensation from '@/pages/admin/compensation'
import AdminBindings from '@/pages/admin/bindings'
import AdminSettlement from '@/pages/admin/settlement'
import AdminCredit from '@/pages/admin/credit'
import AdminCatalog from '@/pages/admin/catalog'
import AdminCertification from '@/pages/admin/certification'
import AdminConfig from '@/pages/admin/config'
import AdminRisk from '@/pages/admin/risk'
import AdminReport from '@/pages/admin/report'
import AdminGuarantee from '@/pages/admin/guarantee'
import AdminContractTemplate from '@/pages/admin/contract-template'
import AdminCarrier from '@/pages/admin/carrier'
import AdminIdentity from '@/pages/admin/identity'
import { isLoggedIn } from '@/utils/session'
import { SSO_CALLBACK_PATH } from '@/utils/sso'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  // 登录态从内存里的会话读，不再读 localStorage —— 令牌放 localStorage 会被任何一处 XSS 拿走
  const location = useLocation()
  // 带上原路径：从会员中心/订单页被弹去登录后，登录成功要回到原页面，而不是统一回首页。
  const redirect = encodeURIComponent(`${location.pathname}${location.search}`)
  return isLoggedIn() ? <>{children}</> : <Navigate to={`/login?redirect=${redirect}`} replace />
}

function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {/* SSO 回跳页必须在守卫之外：它就是"正在登录"的那一步 */}
      <Route path={SSO_CALLBACK_PATH} element={<SsoCallback />} />
      {/* 运营端：同一套 SSO 登录，但布局与页面集合与用户端完全分开 */}
      <Route
        path="/admin/trade"
        element={
          <PrivateRoute>
            <AdminLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/admin/trade/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="product" element={<AdminProductAudit />} />
        <Route path="order" element={<AdminOrderOversight />} />
        <Route path="dispute" element={<AdminDispute />} />
        <Route path="refund" element={<AdminRefund />} />
        <Route path="compensation" element={<AdminCompensation />} />
        <Route path="bindings" element={<AdminBindings />} />
        <Route path="settlement" element={<AdminSettlement />} />
        <Route path="credit" element={<AdminCredit />} />
        <Route path="catalog" element={<AdminCatalog />} />
        <Route path="certification" element={<AdminCertification />} />
        <Route path="config" element={<AdminConfig />} />
        <Route path="risk" element={<AdminRisk />} />
        <Route path="report" element={<AdminReport />} />
        <Route path="guarantee" element={<AdminGuarantee />} />
        <Route path="contract-template" element={<AdminContractTemplate />} />
        <Route path="carrier" element={<AdminCarrier />} />
        <Route path="identity" element={<AdminIdentity />} />
      </Route>
      <Route path="/" element={
        <PrivateRoute>
          <Layout />
        </PrivateRoute>
      }>
        <Route index element={<Home />} />
        {/* 原型「买家会员中心 / 卖家会员中心」两套独立布局 */}
        <Route path="member/buyer" element={<BuyerCenter />} />
        <Route path="member/seller" element={<SellerCenter />} />
        {/* 旧的「我的看板」保留为经营看板；会员中心入口指向买家中心 */}
        <Route path="mine" element={<Navigate to="/member/buyer" replace />} />
        <Route path="board" element={<MineDashboardPage />} />
        <Route path="my-guarantee" element={<Navigate to="/member/buyer?tab=fund" replace />} />
        <Route path="my-compensation" element={<Navigate to="/member/buyer?tab=fund" replace />} />
        <Route path="my-identity" element={<Navigate to="/member/buyer?tab=profile" replace />} />
      {/*
        兜底：没有匹配到的路径回首页。
        原先没有任何兜底路由，点了一个过期/写错的链接（例如 /order/7601，
        真实路径是 /order/detail/7601）会渲染成一张白屏，看不出是网址错了。
      */}
      <Route path="*" element={<Navigate to="/" replace />} />
        {/* 交易功能已并入会员中心：旧入口保留为重定向，深链详情仍直达 */}
        <Route path="order" element={<Navigate to="/member/buyer?tab=purchase" replace />} />
        <Route path="order/detail/:id" element={<OrderDetail />} />
        <Route path="order/confirm" element={<OrderConfirm />} />
        <Route path="order/create" element={<OrderCreate />} />
        <Route path="product" element={<Navigate to="/member/seller?tab=goods" replace />} />
        <Route path="product/create" element={<ProductCreate />} />
        <Route path="product/detail/:id" element={<ProductDetail />} />
        <Route path="shop/:sellerId" element={<ShopDetail />} />
        <Route path="demand" element={<Navigate to="/member/buyer?tab=inquiry" replace />} />
        <Route path="demand/create" element={<DemandCreate />} />
        <Route path="demand/detail/:id" element={<DemandDetail />} />
        <Route path="quote" element={<Navigate to="/member/seller?tab=trade" replace />} />
        <Route path="match" element={<Navigate to="/member/seller?tab=trade" replace />} />
        <Route path="price" element={<Navigate to="/member/seller?tab=trade" replace />} />
        <Route path="contract" element={<Navigate to="/member/buyer?tab=contract" replace />} />
        <Route path="logistics" element={<Navigate to="/member/seller?tab=ship" replace />} />
        <Route path="evaluation" element={<Navigate to="/member/buyer?tab=rate" replace />} />
        <Route path="dispute" element={<Navigate to="/member/buyer?tab=after" replace />} />
      </Route>
    </Routes>
  )
}

export default AppRouter
