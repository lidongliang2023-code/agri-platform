import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from '@/pages/layout'
import Login from '@/pages/login'
import Home from '@/pages/home'
import OrderList from '@/pages/order/list'
import OrderDetail from '@/pages/order/detail'
import OrderConfirm from '@/pages/order/confirm'
import OrderCreate from '@/pages/order/create'
import ProductList from '@/pages/product/list'
import ProductCreate from '@/pages/product/create'
import ProductDetail from '@/pages/product/detail'
import ShopDetail from '@/pages/shop/detail'
import DemandList from '@/pages/demand/list'
import DemandCreate from '@/pages/demand/create'
import DemandDetail from '@/pages/demand/detail'
import ContractList from '@/pages/contract/list'
import LogisticsList from '@/pages/logistics/list'
import EvaluationList from '@/pages/evaluation/list'
import DisputeList from '@/pages/dispute/list'
import MineDashboardPage from '@/pages/mine'
import MyGuarantee from '@/pages/mine-guarantee'
import MatchList from '@/pages/match/list'
import PriceList from '@/pages/price/list'
import QuoteList from '@/pages/quote/list'
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
import { isLoggedIn } from '@/utils/session'
import { SSO_CALLBACK_PATH } from '@/utils/sso'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  // 登录态从内存里的会话读，不再读 localStorage —— 令牌放 localStorage 会被任何一处 XSS 拿走
  return isLoggedIn() ? <>{children}</> : <Navigate to="/login" replace />
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
      </Route>
      <Route path="/" element={
        <PrivateRoute>
          <Layout />
        </PrivateRoute>
      }>
        <Route index element={<Home />} />
        <Route path="mine" element={<MineDashboardPage />} />
        <Route path="my-guarantee" element={<MyGuarantee />} />
        <Route path="order" element={<OrderList />} />
        <Route path="order/detail/:id" element={<OrderDetail />} />
        <Route path="order/confirm" element={<OrderConfirm />} />
        <Route path="order/create" element={<OrderCreate />} />
        <Route path="product" element={<ProductList />} />
        <Route path="product/create" element={<ProductCreate />} />
        <Route path="product/detail/:id" element={<ProductDetail />} />
        <Route path="shop/:sellerId" element={<ShopDetail />} />
        <Route path="demand" element={<DemandList />} />
        <Route path="demand/create" element={<DemandCreate />} />
        <Route path="demand/detail/:id" element={<DemandDetail />} />
        <Route path="quote" element={<QuoteList />} />
        <Route path="match" element={<MatchList />} />
        <Route path="price" element={<PriceList />} />
        <Route path="contract" element={<ContractList />} />
        <Route path="logistics" element={<LogisticsList />} />
        <Route path="evaluation" element={<EvaluationList />} />
        <Route path="dispute" element={<DisputeList />} />
      </Route>
    </Routes>
  )
}

export default AppRouter
