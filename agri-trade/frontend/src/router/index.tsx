import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Login from '@/pages/login'
import OrderDetail from '@/pages/order/detail'
import OrderConfirm from '@/pages/order/confirm'
import OrderCreate from '@/pages/order/create'
import ProductCreate from '@/pages/product/create'
import ProductDetail from '@/pages/product/detail'
import ShopDetail from '@/pages/shop/detail'
import DemandCreate from '@/pages/demand/create'
import DemandDetail from '@/pages/demand/detail'
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
      {/* 交易端只剩买家中心 / 卖家中心；没有全局后台菜单与首页 */}
      <Route path="/member/buyer" element={<PrivateRoute><BuyerCenter /></PrivateRoute>} />
      <Route path="/member/seller" element={<PrivateRoute><SellerCenter /></PrivateRoute>} />

      {/* 深链详情/创建页保留，直接进入对应业务页 */}
      <Route path="/order/detail/:id" element={<PrivateRoute><OrderDetail /></PrivateRoute>} />
      <Route path="/order/confirm" element={<PrivateRoute><OrderConfirm /></PrivateRoute>} />
      <Route path="/order/create" element={<PrivateRoute><OrderCreate /></PrivateRoute>} />
      <Route path="/product/create" element={<PrivateRoute><ProductCreate /></PrivateRoute>} />
      <Route path="/product/detail/:id" element={<PrivateRoute><ProductDetail /></PrivateRoute>} />
      <Route path="/shop/:sellerId" element={<PrivateRoute><ShopDetail /></PrivateRoute>} />
      <Route path="/demand/create" element={<PrivateRoute><DemandCreate /></PrivateRoute>} />
      <Route path="/demand/detail/:id" element={<PrivateRoute><DemandDetail /></PrivateRoute>} />

      {/* 旧入口只保留重定向，不再渲染旧菜单页 */}
      <Route path="/order" element={<Navigate to="/member/buyer?tab=purchase" replace />} />
      <Route path="/product" element={<Navigate to="/member/seller?tab=goods" replace />} />
      <Route path="/demand" element={<Navigate to="/member/buyer?tab=inquiry" replace />} />
      <Route path="/quote" element={<Navigate to="/member/seller?tab=trade" replace />} />
      <Route path="/match" element={<Navigate to="/member/seller?tab=trade" replace />} />
      <Route path="/price" element={<Navigate to="/member/seller?tab=trade" replace />} />
      <Route path="/contract" element={<Navigate to="/member/buyer?tab=contract" replace />} />
      <Route path="/logistics" element={<Navigate to="/member/seller?tab=ship" replace />} />
      <Route path="/evaluation" element={<Navigate to="/member/buyer?tab=rate" replace />} />
      <Route path="/dispute" element={<Navigate to="/member/buyer?tab=after" replace />} />
      <Route path="/my-guarantee" element={<Navigate to="/member/buyer?tab=fund" replace />} />
      <Route path="/my-compensation" element={<Navigate to="/member/buyer?tab=fund" replace />} />
      <Route path="/my-identity" element={<Navigate to="/member/buyer?tab=profile" replace />} />
      <Route path="/mine" element={<Navigate to="/member/buyer" replace />} />

      <Route path="/" element={<Navigate to="/member/buyer" replace />} />
      <Route path="*" element={<Navigate to="/member/buyer" replace />} />
    </Routes>
  )
}

export default AppRouter
