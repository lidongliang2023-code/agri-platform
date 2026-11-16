import { Component, Suspense, lazy, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom'
const Login = lazy(() => import('@/pages/login'))
const OrderDetail = lazy(() => import('@/pages/order/detail'))
const OrderConfirm = lazy(() => import('@/pages/order/confirm'))
const OrderCreate = lazy(() => import('@/pages/order/create'))
const ProductDetail = lazy(() => import('@/pages/product/detail'))
const ShopDetail = lazy(() => import('@/pages/shop/detail'))
const DemandDetail = lazy(() => import('@/pages/demand/detail'))
const BuyerCenter = lazy(() => import('@/pages/member-center/BuyerCenter'))
const SellerCenter = lazy(() => import('@/pages/member-center/SellerCenter'))
const TradeHall = lazy(() => import('@/pages/hall'))
const SsoCallback = lazy(() => import('@/pages/sso/callback'))
const AdminLayout = lazy(() => import('@/pages/admin/layout'))
const AdminDashboard = lazy(() => import('@/pages/admin/dashboard'))
const AdminProductAudit = lazy(() => import('@/pages/admin/product'))
const AdminOrderOversight = lazy(() => import('@/pages/admin/order'))
const AdminDispute = lazy(() => import('@/pages/admin/dispute'))
const AdminRefund = lazy(() => import('@/pages/admin/refund'))
const AdminInvoice = lazy(() => import('@/pages/admin/invoice'))
const AdminCompensation = lazy(() => import('@/pages/admin/compensation'))
const AdminBindings = lazy(() => import('@/pages/admin/bindings'))
const AdminSettlement = lazy(() => import('@/pages/admin/settlement'))
const AdminCredit = lazy(() => import('@/pages/admin/credit'))
const AdminConfig = lazy(() => import('@/pages/admin/config'))
const AdminRisk = lazy(() => import('@/pages/admin/risk'))
const AdminReport = lazy(() => import('@/pages/admin/report'))
const AdminGuarantee = lazy(() => import('@/pages/admin/guarantee'))
const AdminContractTemplate = lazy(() => import('@/pages/admin/contract-template'))
const AdminCarrier = lazy(() => import('@/pages/admin/carrier'))
const ExternalRedirect = lazy(() => import('@/pages/admin/external-redirect'))
const P2tOrders = lazy(() => import('@/pages/admin/p2t/Orders'))
const P2tRecon = lazy(() => import('@/pages/admin/p2t/Recon'))
const P2tRules = lazy(() => import('@/pages/admin/p2t/Rules'))
const P2tDiffs = lazy(() => import('@/pages/admin/p2t/Diffs'))
const P2tTrace = lazy(() => import('@/pages/admin/p2t/Trace'))
const P2tBoundary = lazy(() => import('@/pages/admin/p2t/Boundary'))
import { isLoggedIn } from '@/utils/session'
import { redirectToSso, SSO_CALLBACK_PATH } from '@/utils/sso'

const TRADE_MOBILE_ORIGIN = (import.meta.env.VITE_TRADE_MOBILE_ORIGIN as string | undefined)
  || (['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? `${window.location.protocol}//${window.location.hostname}:8181/`
    : 'https://trade-mobile.agri-platform.com/')

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

/** 旧交易端移动路由统一转到独立部署的交易移动端。 */
function MobileTradeRedirect(): JSX.Element {
  useEffect(() => {
    window.location.replace(TRADE_MOBILE_ORIGIN)
  }, [])
  return <div style={{ padding: 40, color: '#6b7c72' }}>正在打开交易移动端…</div>
}

function RootEntry(): JSX.Element {
  const mobile = window.matchMedia('(max-width: 768px)').matches
  return mobile ? <MobileTradeRedirect /> : <Navigate to="/member/buyer" replace />
}

class PageLoadBoundary extends Component<{ children: ReactNode; resetKey: string }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  // 某个页面加载失败后，返回或切到别的页面要能正常显示，不能一直停在失败提示。
  componentDidUpdate(previous: { resetKey: string }): void {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) this.setState({ failed: false })
  }

  render(): ReactNode {
    if (this.state.failed) {
      return <div role="alert" style={{ padding: 32, color: '#53665a' }}>
        <p>页面加载失败，请检查网络后重试。</p>
        <button type="button" onClick={() => window.location.reload()} style={{ minHeight: 44, padding: '0 20px' }}>重新加载</button>
      </div>
    }
    return this.props.children
  }
}

function AppRouter({ mobileEntry, callbackElement }: { mobileEntry?: React.ReactNode; callbackElement?: React.ReactNode } = {}) {
  const location = useLocation()
  return (
    <PageLoadBoundary resetKey={location.pathname}>
    <Suspense fallback={<div role="status" style={{ padding: 32, color: '#53665a' }}>正在加载页面…</div>}>
    <Routes>
      <Route path="/login" element={<Login />} />
      {/* SSO 回跳页必须在守卫之外：它就是"正在登录"的那一步 */}
      <Route path={SSO_CALLBACK_PATH} element={callbackElement ?? <SsoCallback />} />
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
        {/* 产销对接（交易侧）只留平台治理：回写重试 / 对账 / 规则 / 差异 / 追踪。
            审核与建品已迁到卖家中心（/member/seller?tab=p2t），由供应商主体自己承接。 */}
        <Route path="p2t/orders" element={<P2tOrders />} />
        <Route path="p2t/recon" element={<P2tRecon />} />
        <Route path="p2t/rules" element={<P2tRules />} />
        <Route path="p2t/diffs" element={<P2tDiffs />} />
        <Route path="p2t/trace" element={<P2tTrace />} />
        <Route path="p2t/boundary" element={<P2tBoundary />} />
      </Route>
      {/* 交易端只剩买家中心 / 卖家中心；没有全局后台菜单与首页 */}
      <Route path="/hall" element={<TradeHall />} />
      <Route path="/mobile/trade" element={mobileEntry ?? <MobileTradeRedirect />} />
      <Route path="/mobile" element={mobileEntry ?? <MobileTradeRedirect />} />
      <Route path="/m" element={mobileEntry ?? <MobileTradeRedirect />} />
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
      <Route path="/demand" element={<Navigate to="/member/buyer?tab=demand-list" replace />} />
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

      <Route path="/" element={mobileEntry ?? <RootEntry />} />
      <Route path="*" element={<Navigate to="/member/buyer" replace />} />
    </Routes>
    </Suspense>
    </PageLoadBoundary>
  )
}

export default AppRouter
