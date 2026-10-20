import { Layout as AntLayout, Menu } from 'antd'
import {
  HomeOutlined,
  FundOutlined,
  ShopOutlined,
  ShoppingOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'

const { Sider, Content, Header } = AntLayout

const menuItems = [
  { key: '', label: '首页', icon: <HomeOutlined /> },
  { key: 'member/buyer', label: '买家中心', icon: <ShoppingOutlined /> },
  { key: 'member/seller', label: '卖家中心', icon: <ShopOutlined /> },
  { key: 'board', label: '经营看板', icon: <FundOutlined /> },
]

function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const currentKey = location.pathname.replace(/^\//, '')

  // 买家/卖家中心有自己的一整套侧栏与顶部栏（按原型），不再套交易后台的深色导航。
  if (location.pathname.startsWith('/member')) {
    return <Outlet />
  }

  const handleMenuClick = (e: { key: string }) => {
    navigate(`/${e.key}`)
  }

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', color: '#fff', display: 'flex', alignItems: 'center', paddingLeft: 24 }}>
        <ThunderboltOutlined style={{ fontSize: 24, marginRight: 12 }} />
        <span style={{ fontSize: 18, fontWeight: 'bold' }}>交易撮合管理系统</span>
      </Header>
      <AntLayout>
        <Sider width={200} style={{ background: '#001529' }}>
          <Menu
            mode="inline"
            theme="dark"
            selectedKeys={[currentKey]}
            items={menuItems}
            onClick={handleMenuClick}
            style={{ height: '100%', borderRight: 0 }}
          />
        </Sider>
        <Content style={{ padding: 24, background: '#f0f2f5', minHeight: 'calc(100vh - 64px)' }}>
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  )
}

export default Layout
