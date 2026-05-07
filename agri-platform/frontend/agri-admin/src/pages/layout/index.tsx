import React, { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Button } from 'antd';
import { 
  SettingOutlined, 
  AppstoreOutlined, 
  TeamOutlined, 
  ShopOutlined, 
  BookOutlined, 
  HomeOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';

const { Header, Sider, Content } = Layout;

const iconMap: { [key: string]: React.ReactNode } = {
  SettingOutlined: <SettingOutlined />,
  AppstoreOutlined: <AppstoreOutlined />,
  TeamOutlined: <TeamOutlined />,
  ShopOutlined: <ShopOutlined />,
  BookOutlined: <BookOutlined />,
  HomeOutlined: <HomeOutlined />,
};

interface MenuItem {
  id: number;
  menuName: string;
  path: string;
  menuType: string;
  icon?: string;
  parentId?: number;
  children?: MenuItem[];
}

const LayoutComponent: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { userInfo, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const menuData: MenuItem[] = [
    {
      id: 6,
      menuName: '工作台',
      path: '/dashboard',
      menuType: 'M',
      icon: 'HomeOutlined',
      children: [
        {
          id: 601,
          menuName: '工作台首页',
          path: '/dashboard/index',
          menuType: 'C',
          parentId: 6,
        },
      ],
    },
    {
      id: 1,
      menuName: '系统管理',
      path: '/system',
      menuType: 'M',
      icon: 'SettingOutlined',
      children: [
        { id: 101, menuName: '用户管理', path: '/system/user', menuType: 'C', parentId: 1 },
        { id: 102, menuName: '角色管理', path: '/system/role', menuType: 'C', parentId: 1 },
        { id: 103, menuName: '菜单管理', path: '/system/menu', menuType: 'C', parentId: 1 },
        { id: 104, menuName: '组织管理', path: '/system/organization', menuType: 'C', parentId: 1 },
      ],
    },
    {
      id: 2,
      menuName: '商品管理',
      path: '/product',
      menuType: 'M',
      icon: 'AppstoreOutlined',
      children: [
        { id: 201, menuName: '商品列表', path: '/product/list', menuType: 'C', parentId: 2 },
        { id: 202, menuName: '商品分类', path: '/product/category', menuType: 'C', parentId: 2 },
      ],
    },
    {
      id: 3,
      menuName: '客户管理',
      path: '/customer',
      menuType: 'M',
      icon: 'TeamOutlined',
      children: [
        { id: 301, menuName: '客户列表', path: '/customer/list', menuType: 'C', parentId: 3 },
      ],
    },
    {
      id: 4,
      menuName: '供应商管理',
      path: '/supplier',
      menuType: 'M',
      icon: 'ShopOutlined',
      children: [
        { id: 401, menuName: '供应商列表', path: '/supplier/list', menuType: 'C', parentId: 4 },
      ],
    },
    {
      id: 5,
      menuName: '数据字典',
      path: '/dict',
      menuType: 'M',
      icon: 'BookOutlined',
      children: [
        { id: 501, menuName: '字典管理', path: '/dict/list', menuType: 'C', parentId: 5 },
      ],
    },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userMenu = (
    <Menu>
      <Menu.Item onClick={handleLogout} icon={<LogoutOutlined />}>
        退出登录
      </Menu.Item>
    </Menu>
  );

  const renderMenuItems = (menus: MenuItem[]): React.ReactNode => {
    return menus.map((menu) => {
      if (menu.children && menu.children.length > 0) {
        return (
          <Menu.SubMenu
            key={menu.id}
            title={
              <span>
                {iconMap[menu.icon || 'SettingOutlined']}
                <span>{menu.menuName}</span>
              </span>
            }
          >
            {renderMenuItems(menu.children)}
          </Menu.SubMenu>
        );
      }
      return (
        <Menu.Item
          key={menu.id}
          onClick={() => navigate(menu.path)}
          className={location.pathname === menu.path ? 'ant-menu-item-selected' : ''}
        >
          <span>{menu.menuName}</span>
        </Menu.Item>
      );
    });
  };

  return (
    <Layout style={{ height: '100%' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        style={{
          background: '#001529',
        }}
      >
        <div className="logo" style={{ padding: '16px', color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>
          {collapsed ? 'AG' : '农业平台'}
        </div>
        <Menu
          mode="inline"
          theme="dark"
        >
          {renderMenuItems(menuData)}
        </Menu>
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: '#fff', borderBottom: '1px solid #e8e8e8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{
              fontSize: '16px',
              width: 64,
              height: 64,
            }}
          />
          <Dropdown overlay={userMenu} placement="bottomRight">
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 24px', cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} />
              <span style={{ marginLeft: 8 }}>{userInfo?.realName || userInfo?.username || '管理员'}</span>
            </div>
          </Dropdown>
        </Header>
        <Content style={{ margin: 0, overflow: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default LayoutComponent;
