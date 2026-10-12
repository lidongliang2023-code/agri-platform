import { Routes, Route } from 'react-router-dom'
import Login from './pages/login'
import AppLayout from './pages/layout'
import Dashboard from './pages/dashboard'
import TenantList from './pages/tenant/list'
import UserList from './pages/user/list'
import OrgList from './pages/org/list'
import RoleList from './pages/role/list'
import ProductList from './pages/product/list'
import CustomerList from './pages/customer/list'
import SupplierList from './pages/supplier/list'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<AppLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/tenants" element={<TenantList />} />
        <Route path="/users" element={<UserList />} />
        <Route path="/orgs" element={<OrgList />} />
        <Route path="/roles" element={<RoleList />} />
        <Route path="/products" element={<ProductList />} />
        <Route path="/customers" element={<CustomerList />} />
        <Route path="/suppliers" element={<SupplierList />} />
      </Route>
    </Routes>
  )
}

export default App