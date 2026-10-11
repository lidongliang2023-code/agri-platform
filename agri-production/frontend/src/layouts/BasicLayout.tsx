/**
 * 通用后台布局（用户端 / 运营端共用）
 *
 * 组成：可折叠侧边栏（按一级模块分组） + 顶栏（当前农场切换 / 消息 / 用户） + 面包屑 + 内容区。
 * 用户端与运营端通过 variant 区分**菜单数据源**；视觉风格保持一致
 * （同一主题 Token、同为浅色侧边栏、同一品牌主色），避免同一业务页在两端两套观感。
 */
import { Suspense, useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Avatar,
  Badge,
  Breadcrumb,
  Dropdown,
  Layout,
  Menu,
  Select,
  Space,
  Typography,
  Button,
} from 'antd'
import {
  BellOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import PageLoading from '@/components/PageLoading'
import { getUnreadCount } from '@/api/messages'
import { listAllFarms } from '@/api/farms'
import useAuthStore from '@/store/auth'
import useFarmStore from '@/store/farm'
import { ADMIN_MENU, USER_MENU, buildBreadcrumb, matchMenu } from '@/config/menu'
import { BRAND_COLOR, LAYOUT_SIZE } from '@agri/shared'

const { Header, Sider, Content } = Layout

/** 布局变体 */
export type LayoutVariant = 'user' | 'admin'

/** 通用布局入参 */
export interface BasicLayoutProps {
  /** 布局变体：user 用户端 / admin 运营端 */
  variant: LayoutVariant
  /** 顶栏展示的系统名称 */
  title: string
}

/**
 * 通用后台布局
 * @param props 见 BasicLayoutProps
 * @returns 布局结构（含 <Outlet /> 子路由出口）
 */
export default function BasicLayout({ variant, title }: BasicLayoutProps): JSX.Element {
  const [collapsed, setCollapsed] = useState<boolean>(false)
  const location = useLocation()
  const navigate = useNavigate()

  const userInfo = useAuthStore((state) => state.userInfo)
  const logout = useAuthStore((state) => state.logout)
  const currentFarm = useFarmStore((state) => state.currentFarm)
  const farmOptions = useFarmStore((state) => state.farmOptions)
  const setCurrentFarm = useFarmStore((state) => state.setCurrentFarm)
  const setFarmOptions = useFarmStore((state) => state.setFarmOptions)

  const isAdmin = variant === 'admin'
  const menuGroups = isAdmin ? ADMIN_MENU : USER_MENU

  /** 未读消息数量（用户端展示消息入口红点） */
  const { data: unreadCount } = useQuery<number>({
    queryKey: ['messages', 'unread-count'],
    queryFn: getUnreadCount,
    retry: false,
  })

  /** 当前农场下拉选项（仅用户端需要农场上下文） */
  const { data: farms } = useQuery({
    queryKey: ['farms', 'all'],
    queryFn: listAllFarms,
    retry: false,
    enabled: !isAdmin,
  })

  useEffect(() => {
    if (farms && farms.length > 0) {
      setFarmOptions(
        farms.map((farm) => ({
          farmId: farm.farmId,
          farmCode: farm.farmCode,
          farmName: farm.farmName,
        })),
      )
    }
  }, [farms, setFarmOptions])

  const matched = useMemo(() => matchMenu(location.pathname, menuGroups), [location.pathname, menuGroups])
  const breadcrumb = useMemo(
    () => buildBreadcrumb(location.pathname, menuGroups),
    [location.pathname, menuGroups],
  )

  const menuItems = useMemo(
    () =>
      menuGroups.map((group) => ({
        key: group.key,
        icon: group.icon,
        label: group.label,
        children: group.children.map((leaf) => ({ key: leaf.key, label: leaf.label })),
      })),
    [menuGroups],
  )

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: userInfo?.realName ?? '未登录用户',
      disabled: true,
    },
    { type: 'divider' as const },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '系统设置',
      onClick: () => navigate('/production/settings'),
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: () => logout(),
    },
  ]

  return (
    <Layout className="agri-layout">
      <Sider
        className="agri-sider"
        collapsible
        collapsed={collapsed}
        trigger={null}
        theme="light"
        width={LAYOUT_SIZE.siderWidth}
        collapsedWidth={LAYOUT_SIZE.siderCollapsedWidth}
      >
        <div
          style={{
            height: LAYOUT_SIZE.headerHeight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? 0 : '0 16px',
            color: BRAND_COLOR,
            fontWeight: 600,
            fontSize: 16,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          {collapsed ? '农' : title}
        </div>
        <Menu
          mode="inline"
          theme="light"
          items={menuItems}
          selectedKeys={matched ? [matched.leaf.key] : []}
          defaultOpenKeys={matched ? [matched.group.key] : []}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>

      <Layout style={{ marginLeft: collapsed ? LAYOUT_SIZE.siderCollapsedWidth : LAYOUT_SIZE.siderWidth }}>
        <Header className="agri-header">
          <div className="agri-header-left">
            <Button
              type="text"
              aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
            />
            <Typography.Text strong style={{ fontSize: 15 }}>
              {title}
            </Typography.Text>
          </div>

          <div className="agri-header-right">
            {!isAdmin && (
              <Select
                style={{ width: 180 }}
                value={currentFarm?.farmId}
                placeholder="请选择当前农场"
                allowClear={false}
                onChange={(farmId) => {
                  const next = farmOptions.find((item) => item.farmId === farmId)
                  if (next) setCurrentFarm(next)
                }}
                options={farmOptions.map((item) => ({
                  value: item.farmId,
                  label: item.farmName,
                }))}
              />
            )}

            <Badge count={isAdmin ? 0 : (unreadCount ?? 0)} size="small">
              <Button
                type="text"
                aria-label="消息中心"
                icon={<BellOutlined />}
                onClick={() =>
                  navigate(isAdmin ? '/admin/production/alerts' : '/production/messages')
                }
              />
            </Badge>

            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar
                  size="small"
                  style={{ backgroundColor: BRAND_COLOR }}
                  icon={<UserOutlined />}
                  src={userInfo?.avatar}
                />
                <Typography.Text>{userInfo?.realName ?? '未登录'}</Typography.Text>
              </Space>
            </Dropdown>
          </div>
        </Header>

        <Content className="agri-content">
          <Breadcrumb className="agri-breadcrumb" items={breadcrumb.map((text) => ({ title: text }))} />
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </Content>
      </Layout>
    </Layout>
  )
}
