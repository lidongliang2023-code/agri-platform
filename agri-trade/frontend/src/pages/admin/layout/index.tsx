import { Layout, Menu, Typography } from 'antd'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  AppstoreOutlined, AuditOutlined, FileSearchOutlined, SwapOutlined, TeamOutlined, RollbackOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons'

const { Sider, Header, Content } = Layout

/**
 * 运营端布局。
 *
 * <p>与用户端共用同一个应用、同一次 SSO 登录（平台是统一认证，运营端不必再登录一次），
 * 但**菜单与页面集合完全分开**：运营端管全平台数据，用户端只能看自己的。</p>
 */
export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={200} style={{ background: '#0f2547' }}>
        <div style={{ padding: '20px 16px', color: '#fff' }}>
          <Typography.Text style={{ color: '#fff', fontWeight: 600 }}>交易监管后台</Typography.Text>
          <div style={{ color: '#7f9cc4', fontSize: 12, marginTop: 4 }}>农业产业互联网平台</div>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          style={{ background: '#0f2547' }}
          onClick={({ key }) => navigate(key)}
          items={[
            { key: '/admin/trade/dashboard', icon: <AppstoreOutlined />, label: '交易大盘' },
            { key: '/admin/trade/product', icon: <AuditOutlined />, label: '货源审核' },
            { key: '/admin/trade/order', icon: <FileSearchOutlined />, label: '订单监管' },
            { key: '/admin/trade/dispute', icon: <TeamOutlined />, label: '纠纷仲裁' },
            { key: '/admin/trade/refund', icon: <RollbackOutlined />, label: '退款审核' },
            { key: '/admin/trade/compensation', icon: <SafetyCertificateOutlined />, label: '赔付执行' }
          ]}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingInline: 24
          }}
        >
          <Typography.Text strong>交易撮合 · 运营端</Typography.Text>
          <a onClick={() => navigate('/')}>
            <SwapOutlined /> 切到用户端
          </a>
        </Header>
        <Content style={{ background: '#f5f7fa' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
