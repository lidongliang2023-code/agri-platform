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
  Drawer,
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
  SettingOutlined,
  SwapOutlined,
  UpOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { WorkspaceHeader } from '@agri/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import ProductionWorkspaceTabs from '@/components/ProductionWorkspaceTabs'
import { BrandMark } from '@/components/BrandMark'
import { getUnreadCount } from '@/api/messages'
import { listAllFarms } from '@/api/farms'
import useAuthStore from '@/store/auth'
import { accountRequest } from '@/api/auth'
import { redirectToSso, SSO_CLIENT_ID } from '@/api/sso'
import useFarmStore from '@/store/farm'
import { ADMIN_MENU, USER_MENU, buildBreadcrumb, matchMenu } from '@/config/menu'
import './BasicLayout.css'
import './EmbeddedWorkspace.css'
import { mobileWorkspace, workspaceEndedPath } from '@/utils/mobile-workspace'

const { Header, Sider, Content, Footer: LayoutFooter } = Layout
const SIDER_WIDTH = 240
const SIDER_COLLAPSED_WIDTH = 80

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
  const queryClient = useQueryClient()
  const [collapsed, setCollapsed] = useState<boolean>(() => window.innerWidth >= 1024 && window.innerWidth < 1280)
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 1023px)').matches)
  const [navigationOpen, setNavigationOpen] = useState(false)
  /** uni-app 客户端 web-view 内嵌：导航、账号、消息由客户端负责，这里只渲染业务内容。 */
  const [embedded] = useState(() => mobileWorkspace())
  useEffect(() => {
    const mobileMedia = window.matchMedia('(max-width: 1023px)')
    const compactMedia = window.matchMedia('(min-width: 1024px) and (max-width: 1279px)')
    const syncViewport = () => {
      setMobile(mobileMedia.matches)
      setNavigationOpen(false)
      if (!mobileMedia.matches) {
        setCollapsed(compactMedia.matches)
      }
    }
    mobileMedia.addEventListener('change', syncViewport)
    compactMedia.addEventListener('change', syncViewport)
    return () => {
      mobileMedia.removeEventListener('change', syncViewport)
      compactMedia.removeEventListener('change', syncViewport)
    }
  }, [])
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => { setNavigationOpen(false) }, [location.pathname, location.search])

  const userInfo = useAuthStore((state) => state.userInfo)
  const logout = useAuthStore((state) => state.logout)
  const token = useAuthStore((state) => state.token)
  const tokenExpireAt = useAuthStore((state) => state.tokenExpireAt)
  const marketId = useAuthStore((state) => state.marketId)
  const [switchingSubject, setSwitchingSubject] = useState(false)
  const currentFarm = useFarmStore((state) => state.currentFarm)
  const farmOptions = useFarmStore((state) => state.farmOptions)
  const setCurrentFarm = useFarmStore((state) => state.setCurrentFarm)
  const setFarmOptions = useFarmStore((state) => state.setFarmOptions)

  const isAdmin = variant === 'admin'
  const menuGroups = isAdmin ? ADMIN_MENU : USER_MENU

  const { data: subjectSummary, isPending: loadingSubjects, error: subjectError, refetch: reloadSubjects } = useQuery({
    queryKey: ['operating-subjects', userInfo?.userId, marketId, tokenExpireAt],
    enabled: !isAdmin && !!token && !!userInfo?.userId,
    retry: (count, error) => count < 1 && axios.isAxiosError(error) && !axios.isCancel(error)
      && (!error.response || error.response.status >= 500),
    refetchOnWindowFocus: true,
    queryFn: ({ signal }) => accountRequest<{
      activeMerchantId?: string
      merchants: Array<{ merchantId: string; merchantName?: string; active?: boolean }>
    }>({ url: '/summary', method: 'get', timeout: 15000, signal }),
  })
  const subjects = subjectSummary?.merchants ?? []
  const activeSubject = subjects.find(item => String(item.merchantId) === String(subjectSummary?.activeMerchantId))
  const subjectErrorMessage = subjectError ? (
    axios.isAxiosError(subjectError)
      ? subjectError.response?.data?.message || (subjectError.response?.status === 401
        ? '登录已过期，请重新前往统一登录'
        : subjectError.response?.status === 403 ? '当前账号无权读取经营主体'
        : subjectError.response ? `经营主体服务异常（${subjectError.response.status}），请稍后重试` : '经营主体服务暂时无法连接，请稍后重试')
      : subjectError instanceof Error ? subjectError.message : '经营主体加载失败，请重试'
  ) : ''
  const subjectReady = !subjectError && !!activeSubject && String(userInfo?.tenantId) === String(activeSubject.merchantId)
  const reauthenticate = (): void => {
    if (embedded) { navigate(workspaceEndedPath('expired'), { replace: true }); return }
    void redirectToSso(SSO_CLIENT_ID, location.pathname + location.search).catch((error: unknown) => {
      message.error(error instanceof Error ? error.message : '无法前往统一登录')
    })
  }
  useEffect(() => {
    if (isAdmin || !subjectSummary || subjectError) return
    const current = useAuthStore.getState().userInfo
    if (!current) return
    const id = activeSubject ? String(activeSubject.merchantId) : ''
    const name = activeSubject?.merchantName ?? ''
    if (current.tenantId !== id || current.tenantName !== name) {
      useFarmStore.getState().setCurrentFarm(null)
      useFarmStore.getState().setFarmOptions([])
      useAuthStore.getState().setUserInfo({ ...current, tenantId: id, tenantName: name })
    }
  }, [isAdmin, subjectSummary, activeSubject, subjectError])

  const switchSubject = async (merchantId: string): Promise<void> => {
    if (switchingSubject || merchantId === String(activeSubject?.merchantId)) return
    const selected = subjects.find(item => String(item.merchantId) === merchantId)
    if (!selected) return
    setSwitchingSubject(true)
    try {
      const activated = await accountRequest<{ activeMerchantId: string; merchantName?: string }>({
        url: `/businesses/${encodeURIComponent(merchantId)}/activate`, method: 'post', data: {}, timeout: 15000,
      })
      await queryClient.cancelQueries()
      queryClient.removeQueries({ predicate: query => query.queryKey[0] !== 'operating-subjects' })
      const current = useAuthStore.getState().userInfo
      if (current) useAuthStore.getState().setUserInfo({ ...current, tenantId: String(activated.activeMerchantId), tenantName: activated.merchantName })
      useFarmStore.getState().setCurrentFarm(null)
      useFarmStore.getState().setFarmOptions([])
      // 整页重建，卸载旧主体页签与表单，丢弃原主体查询缓存和在途请求。
      if (sessionStorage.getItem('agri_native_workspace') === '1') {
        await reloadSubjects()
        navigate(isAdmin ? '/admin/production/dashboard' : '/production/dashboard', { replace: true })
        setSwitchingSubject(false)
      } else window.location.replace(isAdmin ? '/admin/production/dashboard' : '/production/dashboard')
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
    if (activeGroupKey && (mobile || !collapsed)) {
      setOpenGroupKeys((keys) => isAdmin
        ? Array.from(new Set([...keys, activeGroupKey]))
        : [activeGroupKey])
    }
  }, [activeGroupKey, collapsed, isAdmin, mobile])

  const breadcrumb = useMemo(
    () => buildBreadcrumb(location.pathname, menuGroups),
    [location.pathname, menuGroups],
  )

  const menuItems = useMemo(
    () => {
      const subMenus = menuGroups.map((group) => ({
        key: group.key,
        icon: group.icon,
        label: group.label,
        children: group.children.map((leaf) => ({ key: leaf.key, label: leaf.label })),
      }))
      // 侧栏不再插入分组标题：一级模块直接平铺，展开/收起共用同一份菜单。
      return subMenus
    },
    [menuGroups],
  )

  const personalCenterUrl = `${window.location.protocol}//${window.location.hostname}:8098/portal/#/account/business`
  const displayName = userInfo?.realName || userInfo?.username || (isAdmin ? '平台运营' : '农场用户')
  const displayRole = isAdmin ? '生产运营管理' : (activeSubject?.merchantName || '经营主体用户')

  const userMenuItems = [
    {
      key: 'personal',
      icon: <UserOutlined />,
      label: '个人中心',
      onClick: () => window.open(personalCenterUrl, '_blank', 'noopener'),
    },
    ...(!isAdmin ? [{
      key: 'settings',
      icon: <SettingOutlined />,
      label: '系统设置',
      onClick: () => { setNavigationOpen(false); navigate('/production/settings') },
    }] : []),
    {
      key: 'switch-role',
      icon: <SwapOutlined />,
      label: isAdmin ? '切换身份（用户端）' : '切换身份（运营端）',
      onClick: () => { setNavigationOpen(false); navigate(isAdmin ? '/production/dashboard' : '/admin/production/dashboard') },
    },
    { type: 'divider' as const },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      danger: true,
      label: '退出登录',
      onClick: () => logout(),
    },
  ]

  const isSidebarCollapsed = !mobile && collapsed
  const navigation = <>
        <div className={`agri-brand${isSidebarCollapsed ? ' is-collapsed' : ''}`}>
          <span className="agri-brand-logo"><BrandMark size={34} /></span>
          {(mobile || !collapsed) && (
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
            inlineIndent={isAdmin ? undefined : 20}
            inlineCollapsed={isSidebarCollapsed}
            openKeys={isSidebarCollapsed ? undefined : openGroupKeys}
            onOpenChange={(keys) => {
              const newlyOpened = keys.find((key) => !openGroupKeys.includes(key))
              setOpenGroupKeys(isAdmin ? keys : newlyOpened ? [newlyOpened] : keys.slice(-1))
            }}
            onClick={({ key }) => { navigate(key); setNavigationOpen(false) }}
          />
        </div>
        <div className="pc-side-user">
          <Dropdown menu={{ items: userMenuItems }} trigger={['click']} placement={isSidebarCollapsed ? 'topRight' : 'topLeft'}>
            <button
              type="button"
              className="pc-side-user-trigger"
              title={`${displayName} · ${displayRole}`}
              style={isSidebarCollapsed ? { justifyContent: 'center', padding: '6px 0', gap: 0 } : undefined}
            >
              <span className="pc-side-user-avatar">{displayName.slice(0, 1)}</span>
              {!isSidebarCollapsed && (
                <>
                  <span className="pc-side-user-meta">
                    <strong>{displayName}</strong>
                    <small>{displayRole}</small>
                  </span>
                  <span className="pc-side-user-caret"><UpOutlined /></span>
                </>
              )}
            </button>
          </Dropdown>
        </div>
  </>
  const subjectSelect = (
    <Select
      aria-label="当前经营主体"
      className="agri-subject-select"
      style={embedded ? undefined : { width: 240, maxWidth: '35vw' }}
      showSearch optionFilterProp="label"
      loading={loadingSubjects || switchingSubject}
      disabled={loadingSubjects || switchingSubject || !!subjectError}
      value={activeSubject ? String(activeSubject.merchantId) : undefined}
      placeholder={subjectError ? '主体加载失败' : subjects.length ? '请选择经营主体' : '暂无关联主体'}
      options={subjects.map(item => ({ value: String(item.merchantId), label: item.merchantName || `主体 ${item.merchantId}` }))}
      onChange={value => { void switchSubject(value) }}
      title="切换经营主体后将关闭已打开的页签，未提交内容不会保留"
    />
  )
  const farmSelect = (
    <Select
      aria-label="当前农场"
      className="agri-farm-select"
      style={embedded ? undefined : { width: 180 }}
      disabled={!subjectReady || switchingSubject}
      value={subjectReady ? currentFarm?.farmId : undefined}
      placeholder="请选择当前农场"
      allowClear={false}
      onChange={(farmId) => {
        const next = farmOptions.find((item) => item.farmId === farmId)
        if (next) setCurrentFarm(next)
      }}
      options={farmOptions.map((item) => ({ value: item.farmId, label: item.farmName }))}
    />
  )
  const subjectErrorActions = !!subjectError && <>
    <Button size="small" onClick={() => { void reloadSubjects() }}>重试</Button>
    <Button size="small" onClick={reauthenticate}>{embedded ? '返回客户端' : '统一登录'}</Button>
  </>

  return (
    <Layout className={`agri-layout${isAdmin ? '' : ' production-member-shell'}${embedded ? ' is-embedded' : ''}`}>
      {!mobile && !embedded && <Sider
        className="agri-sider"
        collapsible collapsed={collapsed} trigger={null} theme="dark"
        width={SIDER_WIDTH} collapsedWidth={SIDER_COLLAPSED_WIDTH}
      >{navigation}</Sider>}
      {!embedded && <Drawer title="生产管理导航" placement="left" width={240}
        rootClassName="production-mobile-nav" open={mobile && navigationOpen}
        onClose={() => setNavigationOpen(false)}>
        {navigation}
      </Drawer>}

      <Layout className="agri-main" style={{ marginLeft: mobile || embedded ? 0 : collapsed ? SIDER_COLLAPSED_WIDTH : SIDER_WIDTH }}>
        {embedded ? (!isAdmin && <Header className="agri-embedded-header">
          <div className="agri-embedded-context">
            {subjectSelect}
            {farmSelect}
            {!!subjectError && <div className="agri-embedded-context-actions">{subjectErrorActions}</div>}
          </div>
        </Header>) : <WorkspaceHeader
          className="agri-header"
          leftClassName="agri-header-left"
          rightClassName="agri-header-right"
          collapsed={collapsed}
          mobile={mobile}
          mobileOpen={navigationOpen}
          onToggleCollapse={() => mobile ? setNavigationOpen(true) : setCollapsed(!collapsed)}
          left={mobile
            ? <Typography.Text className="agri-mobile-page-title" ellipsis>{breadcrumb[breadcrumb.length - 1] || title}</Typography.Text>
            : <Breadcrumb items={breadcrumb.map((text) => ({ title: text }))} />}
          right={<>
            {!isAdmin && <div className="agri-header-context">
              <Space size={8} className="agri-subject-control">
                <Typography.Text style={{ whiteSpace: 'nowrap' }}>经营主体</Typography.Text>
                {subjectSelect}
                {subjectErrorActions}
              </Space>
              {farmSelect}
            </div>}
            <Badge className="agri-header-notifications" count={isAdmin ? 0 : (unreadCount ?? 0)} size="small">
              <Button
                type="text"
                aria-label={isAdmin ? '告警中心' : '消息中心'}
                icon={<BellOutlined />}
                onClick={() => navigate(isAdmin ? '/admin/production/alerts' : '/production/messages')}
              />
            </Badge>

            <Dropdown menu={{ items: userMenuItems }} trigger={['click']} placement="bottomRight">
              <Space className="agri-user-trigger" tabIndex={0} role="button" aria-label="账号菜单" style={{ cursor: 'pointer' }}>
                <Avatar className="agri-avatar" size="small" icon={<UserOutlined />} src={userInfo?.avatar} />
                <Typography.Text>{userInfo?.realName ?? '未登录'}</Typography.Text>
              </Space>
            </Dropdown>
          </>}
        />}

        <Content className="agri-content">
          {!isAdmin && (!subjectReady || switchingSubject) ? (
            loadingSubjects || switchingSubject ? <Spin tip="正在加载经营主体"><div style={{ minHeight: 200 }} /></Spin> :
            <Alert type={subjectError ? 'error' : 'info'} showIcon message={subjectError ? '经营主体加载失败' : subjects.length ? (embedded ? '请在上方选择当前经营主体' : '请在顶部选择当前经营主体') : '当前账号暂无关联经营主体'} description={subjectErrorMessage || undefined} action={subjectError ? <Space><Button onClick={() => { void reloadSubjects() }}>重新加载</Button><Button onClick={reauthenticate}>{embedded ? '返回客户端' : '前往统一登录'}</Button></Space> : undefined} />
          ) : <ProductionWorkspaceTabs key={`${variant}:${userInfo?.userId}:${userInfo?.tenantId}:${currentFarm?.farmId ?? ""}`} admin={isAdmin} />}
        </Content>
        {!embedded && <LayoutFooter className="agri-footer">
          © 2026 农业产业互联网平台 · {title}
        </LayoutFooter>}
      </Layout>
    </Layout>
  )
}
