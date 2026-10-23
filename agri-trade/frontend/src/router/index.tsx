import { useEffect, useRef } from 'react'
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom'
import Login from '@/pages/login'
import OrderDetail from '@/pages/order/detail'
import OrderConfirm from '@/pages/order/confirm'
import OrderCreate from '@/pages/order/create'
import ProductDetail from '@/pages/product/detail'
import ShopDetail from '@/pages/shop/detail'
import DemandDetail from '@/pages/demand/detail'
import BuyerCenter from '@/pages/member-center/BuyerCenter'
import SellerCenter from '@/pages/member-center/SellerCenter'
import TradeHall from '@/pages/hall'
import MobileTrade from '@/pages/mobile-trade'
import SsoCallback from '@/pages/sso/callback'
import AdminLayout from '@/pages/admin/layout'
import AdminDashboard from '@/pages/admin/dashboard'
import AdminProductAudit from '@/pages/admin/product'
import AdminOrderOversight from '@/pages/admin/order'
import AdminDispute from '@/pages/admin/dispute'
import AdminRefund from '@/pages/admin/refund'
import AdminInvoice from '@/pages/admin/invoice'
import AdminCompensation from '@/pages/admin/compensation'
import AdminBindings from '@/pages/admin/bindings'
import AdminSettlement from '@/pages/admin/settlement'
import AdminCredit from '@/pages/admin/credit'
import AdminConfig from '@/pages/admin/config'
import AdminRisk from '@/pages/admin/risk'
import AdminReport from '@/pages/admin/report'
import AdminGuarantee from '@/pages/admin/guarantee'
import AdminContractTemplate from '@/pages/admin/contract-template'
import AdminCarrier from '@/pages/admin/carrier'
import ExternalRedirect from '@/pages/admin/external-redirect'
import { isLoggedIn } from '@/utils/session'
import { redirectToSso, SSO_CALLBACK_PATH } from '@/utils/sso'

function LoginRedirect({ returnTo }: { returnTo: string }): JSX.Element {
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    void redirectToSso(returnTo)
  }, [returnTo])
  return <div style={{ padding: 40, color: '#6b7c72' }}>正在前往平台认证中心登录…</div>
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  // 登录态从内存里的会话读，不再读 localStorage —— 令牌放 localStorage 会被任何一处 XSS 拿走
  const location = useLocation()
  // 带上原路径：从会员中心/订单页被弹去登录后，登录成功要回到原页面，而不是统一回首页。
  const returnTo = `${location.pathname}${location.search}`
  return isLoggedIn() ? <>{children}</> : <LoginRedirect returnTo={returnTo} />
}

/** 交易端主体资料与认证已迁移到门户个人中心。 */
function PortalAccountRedirect(): JSX.Element {
  useEffect(() => {
    window.location.replace(
      `${window.location.protocol}//${window.location.hostname}:8098/portal/#/account/business`,
    )
  }, [])
  return <div style={{ padding: 40, color: '#6b7c72' }}>正在前往丰链云个人中心…</div>
}

function DemandPublishRedirect(): JSX.Element {
  const location = useLocation()
  const query = new URLSearchParams(location.search)
  query.set('tab', 'publish')
  return <Navigate to={`/member/buyer?${query.toString()}`} replace />
}

function ProductPublishRedirect(): JSX.Element {
  const location = useLocation()
  const params = useParams()
  const query = new URLSearchParams(location.search)
  query.set('tab', 'publish')
  if (params.id) query.set('id', params.id)
  return <Navigate to={`/member/seller?${query.toString()}`} replace />
}

function RootEntry(): JSX.Element {
  const mobile = window.matchMedia('(max-width: 768px)').matches
  return <Navigate to={mobile ? '/mobile/trade' : '/member/buyer'} replace />
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
        <Route path="invoice" element={<AdminInvoice />} />
        <Route path="compensation" element={<AdminCompensation />} />
        <Route path="bindings" element={<AdminBindings />} />
        <Route path="settlement" element={<AdminSettlement />} />
        <Route path="credit" element={<AdminCredit />} />
        <Route path="catalog" element={<ExternalRedirect path="/product/catalog" />} />
        <Route path="certification" element={<ExternalRedirect path="/user/audit" />} />
        <Route path="certification-review" element={<ExternalRedirect path="/user/audit" />} />
        <Route path="config" element={<AdminConfig />} />
        <Route path="risk" element={<AdminRisk />} />
        <Route path="report" element={<AdminReport />} />
        <Route path="guarantee" element={<AdminGuarantee />} />
        <Route path="contract-template" element={<AdminContractTemplate />} />
        <Route path="carrier" element={<AdminCarrier />} />
        <Route path="identity" element={<ExternalRedirect path="/user/audit" />} />
      </Route>
      {/* 交易端只剩买家中心 / 卖家中心；没有全局后台菜单与首页 */}
      <Route path="/hall" element={<TradeHall />} />
      <Route path="/mobile/trade" element={<MobileTrade />} />
      <Route path="/mobile" element={<Navigate to="/mobile/trade" replace />} />
      <Route path="/m" element={<Navigate to="/mobile/trade" replace />} />
      <Route path="/member/buyer" element={<PrivateRoute><BuyerCenter /></PrivateRoute>} />
      <Route path="/member/seller" element={<PrivateRoute><SellerCenter /></PrivateRoute>} />

      {/* 深链详情/创建页保留，直接进入对应业务页 */}
      <Route path="/order/detail/:id" element={<PrivateRoute><OrderDetail /></PrivateRoute>} />
      <Route path="/order/confirm" element={<PrivateRoute><OrderConfirm /></PrivateRoute>} />
      <Route path="/order/create" element={<PrivateRoute><OrderCreate /></PrivateRoute>} />
      <Route path="/product/create" element={<PrivateRoute><ProductPublishRedirect /></PrivateRoute>} />
      <Route path="/product/edit/:id" element={<PrivateRoute><ProductPublishRedirect /></PrivateRoute>} />
      {/* 商品详情公开可浏览；下单、议价、店铺等操作在页面内触发登录。 */}
      <Route path="/product/detail/:id" element={<ProductDetail />} />
      <Route path="/shop/:sellerId" element={<ShopDetail />} />
      <Route path="/demand/create" element={<PrivateRoute><DemandPublishRedirect /></PrivateRoute>} />
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
      <Route path="/my-identity" element={<PortalAccountRedirect />} />
      <Route path="/mine" element={<Navigate to="/member/buyer" replace />} />

      <Route path="/" element={<RootEntry />} />
      <Route path="*" element={<Navigate to="/member/buyer" replace />} />
    </Routes>
  )
}

export default AppRouter
