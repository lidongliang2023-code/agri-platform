import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import Login from '@/pages/login';
import Layout from '@/pages/layout';
import Dashboard from '@/pages/dashboard';
import UserManagement from '@/pages/system/user';
import RoleManagement from '@/pages/system/role';
import MenuManagement from '@/pages/system/menu';
import OrganizationManagement from '@/pages/system/organization';
import ProductList from '@/pages/product/product-list';
import ProductCategory from '@/pages/product/category';
import CustomerList from '@/pages/customer/list';
import SupplierList from '@/pages/supplier/list';
import DictManagement from '@/pages/dictionary/list';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuthStore();
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

const Router: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route
          path="/*"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard/index" replace />} />
          <Route path="dashboard/index" element={<Dashboard />} />
          <Route path="system/user" element={<UserManagement />} />
          <Route path="system/role" element={<RoleManagement />} />
          <Route path="system/menu" element={<MenuManagement />} />
          <Route path="system/organization" element={<OrganizationManagement />} />
          <Route path="product/list" element={<ProductList />} />
          <Route path="product/category" element={<ProductCategory />} />
          <Route path="customer/list" element={<CustomerList />} />
          <Route path="supplier/list" element={<SupplierList />} />
          <Route path="dict/list" element={<DictManagement />} />
          <Route path="*" element={<Navigate to="/dashboard/index" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default Router;
