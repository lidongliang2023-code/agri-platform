import { Routes, Route, Navigate } from 'react-router-dom'
import Login from '@/components/Login'
import Layout from '@/components/Layout'
import Dashboard from '@/components/Dashboard'
import UserList from '@/components/UserList'

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('token')
  if (!token) {
    return <Navigate to="/login" />
  }
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute>
            <Layout>
              <UserList />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/iot"
        element={
          <ProtectedRoute>
            <Layout>
              <h2>物联网管理</h2>
              <p>物联网管理模块开发中...</p>
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/production"
        element={
          <ProtectedRoute>
            <Layout>
              <h2>生产管理</h2>
              <p>生产管理模块开发中...</p>
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/trade"
        element={
          <ProtectedRoute>
            <Layout>
              <h2>交易撮合</h2>
              <p>交易撮合模块开发中...</p>
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/s2b2c"
        element={
          <ProtectedRoute>
            <Layout>
              <h2>S2B2C</h2>
              <p>S2B2C模块开发中...</p>
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/finance"
        element={
          <ProtectedRoute>
            <Layout>
              <h2>供应链金融</h2>
              <p>供应链金融模块开发中...</p>
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/info"
        element={
          <ProtectedRoute>
            <Layout>
              <h2>信息资讯</h2>
              <p>信息资讯模块开发中...</p>
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/service"
        element={
          <ProtectedRoute>
            <Layout>
              <h2>综合服务</h2>
              <p>综合服务模块开发中...</p>
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}