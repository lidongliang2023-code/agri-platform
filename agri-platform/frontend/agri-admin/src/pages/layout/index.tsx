import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown, theme } from 'antd';
import {
  DashboardOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  ShoppingOutlined,
  ShopOutlined,
  FundOutlined,
  FileTextOutlined,
  CarOutlined,
  SafetyOutlined,
  SettingOutlined,
  LogoutOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/store/auth';
import './index.css';

const { Header, Sider, Content } = Layout;

const LayoutPage: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const { userInfo, logout } = useAuthStore();
  const { token } = theme.useToken();

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '工作台',
    },
    {
      key: 'system',
      icon: <SettingOutlined />,
      label: '系统管理',
      children: [
        {
          key: '/system/user',
          icon: <UserOutlined />,
          label: '用户管理',
        },
        {
          key: '/system/role',
          icon: <SafetyOutlined />,
          label: '角色管理',
        },
      ],
    },
    {
      key: 'masterdata',
      icon: <DatabaseOutlined />,
      label: '主数据',
      children: [
        {
          key: '/masterdata/product',
          icon: <ShoppingOutlined />,
          label: '商品管理',
        },
        {
          key: '/masterdata/customer',
          icon: <UserOutlined />,
          label: '客户管理',
        },
        {
          key: '/masterdata/supplier',
          icon: <ShopOutlined />,
          label: '供应商管理',
        },
      ],
    },
    {
      key: 'production',
      icon: <ExperimentOutlined />,
      label: '生产管理',
    },
    {
      key: 'trade',
      icon: <ShoppingOutlined />,
      label: '交易撮合',
    },
    {
      key: 's2b2c',
      icon: <ShopOutlined />,
      label: 'S2B2C',
    },
    {
      key: 'finance',
      icon: <FundOutlined />,
      label: '供应链金融',
    },
    {
      key: 'info',
      icon: <FileTextOutlined />,
      label: '信息资讯',
    },
    {
      key: 'service',
      icon: <CarOutlined />,
      label: '综合服务',
    },
    {
      key: 'supervision',
      icon: <SafetyOutlined />,
      label: '政府监管',
    },
  ];

  const handleMenuClick = (key: string) => {
    navigate(key);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人中心',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '系统设置',
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  return (
    <Layout className="app-layout">
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={220}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
        }}
      >
        <div className="logo" style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: collapsed ? 16 : 18, fontWeight: 'bold' }}>
          {collapsed ? '农业' : '农业产业互联网平台'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={['/dashboard']}
          items={menuItems}
          onClick={({ key }) => handleMenuClick(key)}
        />
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 220, transition: 'margin-left 0.2s' }}>
        <Header style={{ padding: '0 16px', background: token.colorBgContainer, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div onClick={() => setCollapsed(!collapsed)} style={{ fontSize: 18, cursor: 'pointer' }}>
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <Avatar style={{ backgroundColor: token.colorPrimary }}>
                  {userInfo?.nickname?.charAt(0) || 'U'}
                </Avatar>
                <span>{userInfo?.nickname || '用户'}</span>
              </div>
            </Dropdown>
          </div>
        </Header>

        <Content style={{ margin: '16px', minHeight: 'calc(100vh - 64px)' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default LayoutPage;
