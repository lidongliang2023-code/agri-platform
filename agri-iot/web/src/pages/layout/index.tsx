import { useState } from 'react'
import { Layout, Menu, Avatar, Dropdown, Input } from 'antd'
import {
  DashboardOutlined,
  CloudOutlined,
  BellOutlined,
  BarChartOutlined,
  TeamOutlined,
  FileTextOutlined,
  RocketOutlined,
  MessageOutlined,
  CarOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import useAuthStore from '@/store/auth'

const { Header, Sider, Content } = Layout

const menuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: '/devices', icon: <CloudOutlined />, label: '设备管理' },
  { key: '/plots', icon: <BarChartOutlined />, label: '地块管理' },
  { key: '/alerts', icon: <BellOutlined />, label: '告警管理' },
  { key: '/alert-rules', icon: <RocketOutlined />, label: '告警规则' },
  { key: '/groups', icon: <TeamOutlined />, label: '设备分组' },
  { key: '/reports', icon: <FileTextOutlined />, label: '报表管理' },
  { key: '/rules', icon: <SettingOutlined />, label: '自动化规则' },
  { key: '/push/config', icon: <MessageOutlined />, label: '推送配置' },
  { key: '/push/messages', icon: <MessageOutlined />, label: '推送消息' },
  { key: '/scenes', icon: <CarOutlined />, label: '场景管理' },
]

function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key)
  }

  const userMenu = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人信息',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: logout,
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        theme="dark"
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        style={{
          background: 'linear-gradient(180deg, #0d2818 0%, #04471c 100%)',
        }}
      >
        <div style={styles.logo}>
          {!collapsed && <span>🌐 物联网</span>}
          {collapsed && <span>🌐</span>}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ background: 'transparent' }}
        />
      </Sider>
      <Layout>
        <Header style={styles.header}>
          <Input
            style={styles.searchInput}
            placeholder="搜索..."
            prefix={<SearchOutlined />}
            bordered={false}
          />
          <div style={{ flex: 1 }} />
          <Dropdown menu={{ items: userMenu }}>
            <div style={styles.user}>
              <Avatar icon={<UserOutlined />} style={styles.avatar} />
              <span>{user?.username || '管理员'}</span>
            </div>
          </Dropdown>
        </Header>
        <Content style={styles.content}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

const styles: Record<string, React.CSSProperties> = {
  logo: {
    height: 64,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: 18,
    fontWeight: 600,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    padding: '0 24px',
    background: '#fff',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    gap: 16,
  },
  searchInput: {
    width: 240,
    background: '#f9fafb',
    borderRadius: 8,
  },
  user: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
    padding: '6px 12px',
    borderRadius: 8,
    border: '1px solid #10b981',
    background: 'rgba(16, 185, 129, 0.05)',
  },
  avatar: {
    backgroundColor: '#10b981',
  },
  content: {
    padding: 24,
    background: '#f3f4f6',
    minHeight: 'calc(100vh - 64px)',
  },
}

export default AppLayout
