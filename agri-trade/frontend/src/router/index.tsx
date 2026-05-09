import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from '@/pages/layout'
import Login from '@/pages/login'
import Home from '@/pages/home'
import OrderList from '@/pages/order/list'
import ProductList from '@/pages/product/list'
import ProductCreate from '@/pages/product/create'
import DemandList from '@/pages/demand/list'
import DemandCreate from '@/pages/demand/create'
import ContractList from '@/pages/contract/list'
import LogisticsList from '@/pages/logistics/list'
import EvaluationList from '@/pages/evaluation/list'
import DisputeList from '@/pages/dispute/list'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token')
  return token ? <>{children}</> : <Navigate to="/login" />
}

function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={
        <PrivateRoute>
          <Layout />
        </PrivateRoute>
      }>
        <Route index element={<Home />} />
        <Route path="order" element={<OrderList />} />
        <Route path="product" element={<ProductList />} />
        <Route path="product/create" element={<ProductCreate />} />
        <Route path="demand" element={<DemandList />} />
        <Route path="demand/create" element={<DemandCreate />} />
        <Route path="contract" element={<ContractList />} />
        <Route path="logistics" element={<LogisticsList />} />
        <Route path="evaluation" element={<EvaluationList />} />
        <Route path="dispute" element={<DisputeList />} />
      </Route>
    </Routes>
  )
}

export default AppRouter