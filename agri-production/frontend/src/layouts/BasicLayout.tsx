/**
 * 通用后台布局（用户端 / 运营端共用）
 *
 * 组成：可折叠侧边栏（按一级模块分组） + 顶栏（当前农场切换 / 消息 / 用户） + 面包屑 + 内容区。
 * 用户端与运营端通过 variant 区分**菜单数据源**；视觉风格保持一致
 * （同一主题 Token、同为浅色侧边栏、同一品牌主色），避免同一业务页在两端两套观感。
 */
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
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
  Alert,
  Spin,
  message,
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
import axios from 'axios'
import ProductionWorkspaceTabs from '@/components/ProductionWorkspaceTabs'
import { BrandMark } from '@/components/BrandMark'
import { getUnreadCount } from '@/api/messages'
import { listAllFarms } from '@/api/farms'
import useAuthStore from '@/store/auth'
import useFarmStore from '@/store/farm'
import { ADMIN_MENU, USER_MENU, buildBreadcrumb, matchMenu } from '@/config/menu'

const { Header, Sider, Content, Footer: LayoutFooter } = Layout
const SIDER_WIDTH = 224
const SIDER_COLLAPSED_WIDTH = 72

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
  const token = useAuthStore((state) => state.token)
  const [switchingSubject, setSwitchingSubject] = useState(false)
  const currentFarm = useFarmStore((state) => state.currentFarm)
  const farmOptions = useFarmStore((state) => state.farmOptions)
  const setCurrentFarm = useFarmStore((state) => state.setCurrentFarm)
  const setFarmOptions = useFarmStore((state) => state.setFarmOptions)

  const isAdmin = variant === 'admin'
  const menuGroups = isAdmin ? ADMIN_MENU : USER_MENU

  const { data: subjectSummary, isPending: loadingSubjects, error: subjectError, refetch: reloadSubjects } = useQuery({
    queryKey: ['operating-subjects', userInfo?.userId],
    enabled: !!token,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const sessionToken = useAuthStore.getState().token
      const response = await axios.get('/api/v1/sso/account/summary', {
        timeout: 15000, withCredentials: true,
        headers: { Authorization: `Bearer ${sessionToken}` },
      })
      if (sessionToken !== useAuthStore.getState().token) throw new Error('登录会话已变化，请刷新页面')
      if (response.data?.code !== 0) throw new Error(response.data?.message || '经营主体加载失败')
      return response.data.data as {
        activeMerchantId?: string
        merchants: Array<{ merchantId: string; merchantName?: string; active?: boolean }>
      }
    },
  })
  const subjects = subjectSummary?.merchants ?? []
  const activeSubject = subjects.find(item => String(item.merchantId) === String(subjectSummary?.activeMerchantId))
  const subjectReady = !!activeSubject && String(userInfo?.tenantId) === String(activeSubject.merchantId)
  useEffect(() => {
    if (!subjectSummary) return
    const current = useAuthStore.getState().userInfo
    if (!current) return
    const id = activeSubject ? String(activeSubject.merchantId) : ''
    const name = activeSubject?.merchantName ?? ''
    if (current.tenantId !== id || current.tenantName !== name) {
      useFarmStore.getState().setCurrentFarm(null)
      useFarmStore.getState().setFarmOptions([])
      useAuthStore.getState().setUserInfo({ ...current, tenantId: id, tenantName: name })
    }
  }, [subjectSummary, activeSubject])

  const switchSubject = async (merchantId: string): Promise<void> => {
    if (switchingSubject || merchantId === String(activeSubject?.merchantId)) return
    const selected = subjects.find(item => String(item.merchantId) === merchantId)
    if (!selected) return
    setSwitchingSubject(true)
    try {
      const response = await axios.post(`/api/v1/sso/account/businesses/${encodeURIComponent(merchantId)}/activate`, {}, {
        timeout: 15000, withCredentials: true,
        headers: { Authorization: `Bearer ${useAuthStore.getState().token}` },
      })
      if (response.data?.code !== 0) throw new Error(response.data?.message || '经营主体切换失败')
      const activated = response.data.data as { activeMerchantId: string; merchantName?: string }
      const current = useAuthStore.getState().userInfo
      if (current) useAuthStore.getState().setUserInfo({ ...current, tenantId: String(activated.activeMerchantId), tenantName: activated.merchantName })
      useFarmStore.getState().setCurrentFarm(null)
      useFarmStore.getState().setFarmOptions([])
      // 整页重建，卸载旧主体页签与表单，丢弃原主体查询缓存和在途请求。
      window.location.replace(isAdmin ? '/admin/production/dashboard' : '/production/dashboard')
    } catch (error) {
      message.error(axios.isAxiosError(error) ? error.response?.data?.message || error.message : error instanceof Error ? error.message : '经营主体切换失败')
      setSwitchingSubject(false)
      void reloadSubjects()
    }
  }


  /** 未读消息数量（用户端展示消息入口红点） */
  const { data: unreadCount } = useQuery<number>({
    queryKey: ['messages', 'unread-count', userInfo?.tenantId],
    enabled: isAdmin || subjectReady,
    queryFn: getUnreadCount,
    retry: false,
  })

  /** 当前农场下拉选项（仅用户端需要农场上下文） */
  const { data: farms } = useQuery({
    queryKey: ['farms', 'all', userInfo?.tenantId],
    queryFn: listAllFarms,
    retry: false,
    enabled: !isAdmin && subjectReady && !switchingSubject,
  })

  useEffect(() => {
    if (farms) {
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
  const activeGroupKey = matched?.group.key
  const [openGroupKeys, setOpenGroupKeys] = useState<string[]>([])
  useEffect(() => {
    if (activeGroupKey && !collapsed) {
      setOpenGroupKeys((keys) => isAdmin
        ? Array.from(new Set([...keys, activeGroupKey]))
        : [activeGroupKey])
    }
  }, [activeGroupKey, collapsed, isAdmin])

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
        theme="dark"
        width={SIDER_WIDTH}
        collapsedWidth={SIDER_COLLAPSED_WIDTH}
      >
        <div className={`agri-brand${collapsed ? ' is-collapsed' : ''}`}>
          <span className="agri-brand-logo"><BrandMark size={34} /></span>
          {!collapsed && (
            <span className="agri-brand-text">
              <strong>丰链云</strong>
              <small>FENGCHAIN · AGRI</small>
            </span>
          )}
        </div>
        <div className="agri-sider-menu-scroll">
          <Menu
            mode="inline"
            theme="dark"
            items={menuItems}
            selectedKeys={matched ? [matched.leaf.key] : []}
            openKeys={collapsed ? undefined : openGroupKeys}
            onOpenChange={(keys) => {
              const newlyOpened = keys.find((key) => !openGroupKeys.includes(key))
              setOpenGroupKeys(isAdmin ? keys : newlyOpened ? [newlyOpened] : keys.slice(-1))
            }}
            onClick={({ key }) => navigate(key)}
          />
        </div>
      </Sider>

      <Layout className="agri-main" style={{ marginLeft: collapsed ? SIDER_COLLAPSED_WIDTH : SIDER_WIDTH }}>
        <Header className="agri-header">
          <div className="agri-header-left">
            <Button
              type="text"
              aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
            />
            <Breadcrumb items={breadcrumb.map((text) => ({ title: text }))} />
          </div>

          <div className="agri-header-right">
            <Space size={8}>
              <Typography.Text style={{ whiteSpace: 'nowrap' }}>经营主体</Typography.Text>
              <Select
                aria-label="当前经营主体"
                style={{ width: 240, maxWidth: '35vw' }}
                showSearch optionFilterProp="label"
                loading={loadingSubjects || switchingSubject}
                disabled={loadingSubjects || switchingSubject || !!subjectError}
                value={activeSubject ? String(activeSubject.merchantId) : undefined}
                placeholder={subjectError ? '主体加载失败' : subjects.length ? '请选择经营主体' : '暂无关联主体'}
                options={subjects.map(item => ({ value: String(item.merchantId), label: item.merchantName || `主体 ${item.merchantId}` }))}
                onChange={value => { void switchSubject(value) }}
                title="切换经营主体后将关闭已打开的页签，未提交内容不会保留"
              />
              {!!subjectError && <Button size="small" onClick={() => { void reloadSubjects() }}>重试</Button>}
            </Space>
            {!isAdmin && (
              <Select
                style={{ width: 180 }}
                disabled={!subjectReady || switchingSubject}
                value={subjectReady ? currentFarm?.farmId : undefined}
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
                  className="agri-avatar"
                  size="small"
                  icon={<UserOutlined />}
                  src={userInfo?.avatar}
                />
                <Typography.Text>{userInfo?.realName ?? '未登录'}</Typography.Text>
              </Space>
            </Dropdown>
          </div>
        </Header>

        <Content className="agri-content">
          {!isAdmin && (!subjectReady || switchingSubject) ? (
            loadingSubjects || switchingSubject ? <Spin tip="正在加载经营主体"><div style={{ minHeight: 200 }} /></Spin> :
            <Alert type={subjectError ? 'error' : 'info'} showIcon message={subjectError ? '经营主体加载失败，请重试' : subjects.length ? '请在顶部选择当前经营主体' : '当前账号暂无关联经营主体'} />
          ) : <ProductionWorkspaceTabs key={`${variant}:${userInfo?.userId}:${userInfo?.tenantId}:${currentFarm?.farmId ?? ""}`} admin={isAdmin} />}
        </Content>
        <LayoutFooter className="agri-footer">
          © 2026 农业产业互联网平台 · {title}
        </LayoutFooter>
      </Layout>
    </Layout>
  )
}
