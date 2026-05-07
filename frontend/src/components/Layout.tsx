import { Layout, Menu, Button } from 'antd'
import {
  UserOutlined,
  HomeOutlined,
  SettingsOutlined,
  BarChartOutlined,
  ShoppingCartOutlined,
  TruckOutlined,
  FileTextOutlined,
  ShieldOutlined,
  InfoCircleOutlined,
  LogoutOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'

const { Header, Content, Sider } = Layout

const menuItems = [
  { key: '/', icon: <HomeOutlined />, label: '首页' },
  { key: '/users', icon: <UserOutlined />, label: '用户管理' },
  { key: '/iot', icon: <SettingsOutlined />, label: '物联网管理' },
  { key: '/production', icon: <BarChartOutlined />, label: '生产管理' },
  { key: '/trade', icon: <ShoppingCartOutlined />, label: '交易撮合' },
  { key: '/s2b2c', icon: <TruckOutlined />, label: 'S2B2C' },
  { key: '/finance', icon: <FileTextOutlined />, label: '供应链金融' },
  { key: '/info', icon: <InfoCircleOutlined />, label: '信息资讯' },
  { key: '/service', icon: <ShieldOutlined />, label: '综合服务' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#001529' }}>
        <div style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>农业产业互联网平台</div>
        <Button onClick={handleLogout} icon={<LogoutOutlined />} danger>
          退出登录
        </Button>
      </Header>
      
      <Layout>
        <Sider width={200} theme="dark">
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            style={{ height: '100%', borderRight: 0 }}
          />
        </Sider>
        
        <Layout style={{ padding: '24px' }}>
          <Content
            style={{
              background: '#fff',
              padding: 24,
              margin: 0,
              minHeight: 280,
              borderRadius: 8,
            }}
          >
            {children}
          </Content>
        </Layout>
      </Layout>
    </Layout>
  )
}