import { logoutBrowser } from '../../../../../../packages/agri-shared/src/auth/logout'
import { useContext, useEffect, useState, type ReactNode } from 'react'
import { Button, ConfigProvider, Drawer, Dropdown, Layout, Menu, Result, Spin } from 'antd'
import { UNSAFE_LocationContext, useLocation, useNavigate, useOutlet } from 'react-router-dom'
import { WorkspaceHeader, WorkspaceTabs, isFormWorkspaceTab, type WorkspaceTabItem } from '@agri/shared'
import { getMyPermissions, hasPermission, type MyPermission } from '@/api/permission'
import { clearSession, getAccessToken, getCurrentUser } from '@/utils/session'
import { ssoLogoutUrl } from '@/utils/sso'
import { BrandMark } from '@/components/BrandMark'
import {
  AppstoreOutlined, AuditOutlined, FileSearchOutlined, SwapOutlined, TeamOutlined, RollbackOutlined,
  SafetyCertificateOutlined, ApartmentOutlined, AccountBookOutlined, SafetyOutlined, AppstoreAddOutlined,
  SettingOutlined, AlertOutlined, BarChartOutlined, BankOutlined, FileTextOutlined,
  CarOutlined, LogoutOutlined, UserOutlined, UpOutlined
} from '@ant-design/icons'
import './admin-layout.css'

const PERSONAL_CENTER = `${window.location.protocol}//${window.location.hostname}:8098/portal/#/account/business`

const { Sider, Content } = Layout

const MENU_LABELS: Record<string, string> = {
  '/admin/trade/dashboard': '交易大盘',
  '/admin/trade/product': '货源审核',
  '/admin/trade/refund': '退款审核',
  '/admin/trade/invoice': '发票审核',
  '/admin/trade/order': '订单监管',
  '/admin/trade/settlement': '结算与分账',
  '/admin/trade/dispute': '纠纷仲裁',
  '/admin/trade/credit': '信用管理',
  '/admin/trade/compensation': '赔付执行',
  '/admin/trade/bindings': '用户-主体绑定',
  '/admin/trade/config': '系统配置',
  '/admin/trade/risk': '风控管理',
  '/admin/trade/report': '报表',
  '/admin/trade/guarantee': '保证金管理',
  '/admin/trade/contract-template': '合同模板',
  '/admin/trade/carrier': '承运商管理',
  '/admin/trade/p2t/orders': '撮合订单与回写',
  '/admin/trade/p2t/recon': '产销对账',
  '/admin/trade/p2t/rules': '对接规则配置',
  '/admin/trade/p2t/diffs': '差异与异常处置',
  '/admin/trade/p2t/trace': '全链路追踪',
  '/admin/trade/p2t/boundary': '边界与归位说明'
}

const adminTheme = {
  token: {
    colorPrimary: '#2d8f4e',
    colorLink: '#1b6332',
    colorSuccess: '#2d8f4e',
    colorBgLayout: '#f5f6fa',
    borderRadius: 8
  },
  components: {
    Menu: {
      darkItemBg: '#001529',
      darkSubMenuItemBg: '#000c17',
      darkItemSelectedBg: 'rgba(45,143,78,.18)',
      darkItemColor: '#a6a6a6',
      darkItemHoverBg: '#0d2137',
      darkItemHoverColor: '#fff',
      darkItemSelectedColor: '#fff',
      itemBorderRadius: 0,
      itemMarginInline: 0,
      itemMarginBlock: 0,
      itemHeight: 40,
      groupTitleColor: 'rgba(255,255,255,.45)',
      groupTitleFontSize: 12,
    },
    Card: {
      borderRadiusLG: 8
    },
    Table: {
      headerBg: '#fafafa',
      headerColor: '#595959',
      rowHoverBg: '#f0f9f1'
    }
  }
}

type LocationValue = React.ContextType<typeof UNSAFE_LocationContext>
interface AdminWorkspaceTab extends WorkspaceTabItem {
  content: ReactNode
  location: LocationValue
}

function AdminWorkspaceTabs(): JSX.Element {
  const location = useLocation()
  const locationContext = useContext(UNSAFE_LocationContext)
  const navigate = useNavigate()
  const outlet = useOutlet()
  const key = location.pathname + location.search
  const label = MENU_LABELS[location.pathname] ?? '运营中心'
  const current: AdminWorkspaceTab = {
    key,
    label,
    content: outlet,
    location: locationContext,
    form: isFormWorkspaceTab(location.pathname, label),
  }
  const [tabs, setTabs] = useState<AdminWorkspaceTab[]>([current])

  useEffect(() => {
    setTabs(previous => (previous.some(tab => tab.key === key) ? previous : [...previous, current]))
    // 仅在路由地址变化时追加页签快照，避免覆盖未激活页签的路由上下文。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const visibleTabs = tabs.some(tab => tab.key === key) ? tabs : [...tabs, current]

  return (
    <WorkspaceTabs<AdminWorkspaceTab>
      tabs={visibleTabs}
      activeKey={key}
      fallbackKey="/admin/trade/dashboard"
      onSelect={next => navigate(next)}
      onTabsChange={setTabs}
      className="trade-admin-workspace"
      tabBarClassName="trade-admin-workspace-tabbar"
      paneClassName="trade-admin-workspace-pane"
      renderMobile={() => outlet}
      renderPane={(tab, isActive) => (
        <UNSAFE_LocationContext.Provider value={isActive ? locationContext : tab.location}>
          {isActive ? outlet : tab.content}
        </UNSAFE_LocationContext.Provider>
      )}
    />
  )
}

/**
 * 运营端布局。
 *
 * <p>与用户端共用同一个应用、同一次 SSO 登录（平台是统一认证，运营端不必再登录一次），
 * 但**菜单与页面集合完全分开**：运营端管全平台数据，用户端只能看自己的。</p>
 */
export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()

  /**
   * 运营端入口守卫。
   *
   * <p>服务端已经按 RBAC 拦住 /api/trade/admin/** 与所有 @OperatorOnly 接口，
   * 这里只是不让人进来对着一屏 403 发懵 —— 没权限就直接说清楚。
   * 解析失败（认证中心不可达）时按"无权限"处理，与服务端 fail-closed 一致。</p>
   */
  const [perm, setPerm] = useState<MyPermission | null>(null)
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(() => window.matchMedia('(min-width: 1024px) and (max-width: 1279px)').matches)
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 1023px)').matches)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    const compactMedia = window.matchMedia('(min-width: 1024px) and (max-width: 1279px)')
    const mobileMedia = window.matchMedia('(max-width: 1023px)')
    const syncViewport = () => {
      setIsMobile(mobileMedia.matches)
      if (!mobileMedia.matches) {
        setDrawerOpen(false)
        setCollapsed(compactMedia.matches)
      }
    }
    syncViewport()
    compactMedia.addEventListener('change', syncViewport)
    mobileMedia.addEventListener('change', syncViewport)
    return () => {
      compactMedia.removeEventListener('change', syncViewport)
      mobileMedia.removeEventListener('change', syncViewport)
    }
  }, [])

  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  useEffect(() => {
    getMyPermissions()
      .then((res: { code: number; data?: MyPermission }) => setPerm(res?.code === 0 ? res.data ?? null : null))
      .catch(() => setPerm(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <ConfigProvider theme={adminTheme}>
        <div className="admin-loading"><Spin /></div>
      </ConfigProvider>
    )
  }

  if (!hasPermission(perm ?? undefined, 'trade:read')) {
    return (
      <ConfigProvider theme={adminTheme}>
        <div className="admin-shell">
          <Result
            status="403"
            title="无权访问运营端"
            subTitle="运营端需要平台运营权限（trade:read）。当前账号没有该权限，请用运营账号登录，或联系平台运营开通。"
            extra={
              <Button type="primary" onClick={() => navigate('/')}>
                返回用户端
              </Button>
            }
          />
        </div>
      </ConfigProvider>
    )
  }

  const flatMenuItems = [
    { key: '/admin/trade/dashboard', icon: <AppstoreOutlined />, label: '交易大盘' },
    {
      key: 'audit-center',
      icon: <AuditOutlined />,
      label: '审核中心',
      children: [
        { key: '/admin/trade/product', icon: <AuditOutlined />, label: '货源审核' },
        { key: '/admin/trade/refund', icon: <RollbackOutlined />, label: '退款审核' },
        { key: '/admin/trade/invoice', icon: <FileTextOutlined />, label: '发票审核' },
      ],
    },
    { key: '/admin/trade/order', icon: <FileSearchOutlined />, label: '订单监管' },
    {
      // 产销对接：平台只看回写、对账、差异与规则。
      // 「供给池审核」与「建品上架」已下线——那两步是对接双方的事，
      // 由供应商主体在卖家中心（/member/seller?tab=p2t）自己承接。
      key: 'p2t',
      icon: <SwapOutlined />,
      label: '产销对接',
      children: [
        { key: '/admin/trade/p2t/orders', icon: <FileTextOutlined />, label: '撮合订单与回写' },
        { key: '/admin/trade/p2t/recon', icon: <AccountBookOutlined />, label: '产销对账' },
        { key: '/admin/trade/p2t/rules', icon: <SettingOutlined />, label: '对接规则配置' },
        { key: '/admin/trade/p2t/diffs', icon: <AlertOutlined />, label: '差异与异常处置' },
        { key: '/admin/trade/p2t/trace', icon: <FileSearchOutlined />, label: '全链路追踪' },
        { key: '/admin/trade/p2t/boundary', icon: <SafetyOutlined />, label: '边界与归位说明' },
      ],
    },
    { key: '/admin/trade/settlement', icon: <AccountBookOutlined />, label: '结算与分账' },
    { key: '/admin/trade/guarantee', icon: <BankOutlined />, label: '保证金管理' },
    { key: '/admin/trade/contract-template', icon: <FileTextOutlined />, label: '合同模板' },
    { key: '/admin/trade/carrier', icon: <CarOutlined />, label: '承运商管理' },
    { key: 'external-catalog', icon: <AppstoreAddOutlined />, label: '商品与分类（主数据）' },
    { key: '/admin/trade/dispute', icon: <TeamOutlined />, label: '纠纷仲裁' },
    { key: '/admin/trade/credit', icon: <SafetyOutlined />, label: '信用管理' },
    { key: '/admin/trade/compensation', icon: <SafetyCertificateOutlined />, label: '赔付执行' },
    { key: '/admin/trade/risk', icon: <AlertOutlined />, label: '风控管理' },
    // 平台级功能：数据与接口都归 core-platform（不在交易库里），
    // 它决定"谁能看到哪些数据"，所以单独放在交易监管各项之后。
    { key: '/admin/trade/bindings', icon: <ApartmentOutlined />, label: '用户-主体绑定' },
    { key: '/admin/trade/config', icon: <SettingOutlined />, label: '系统配置' },
    { key: '/admin/trade/report', icon: <BarChartOutlined />, label: '报表' },
  ]


  const sessionUser = getCurrentUser()
  const displayName = sessionUser?.nickname || sessionUser?.username || '平台运营'
  const logout = () => {
    void logoutBrowser({ token: getAccessToken(), clientId: 'trade', ssoOrigin: new URL(ssoLogoutUrl()).origin, clear: clearSession })
  }
  const sideUserMenu = {
    items: [
      { key: 'personal', icon: <UserOutlined />, label: '个人中心', onClick: () => window.open(PERSONAL_CENTER, '_blank', 'noopener') },
      { key: 'switch', icon: <SwapOutlined />, label: '切换身份（用户端）', onClick: () => { setDrawerOpen(false); navigate('/member/buyer') } },
      { type: 'divider' as const },
      { key: 'logout', icon: <LogoutOutlined />, danger: true, label: '退出登录', onClick: logout },
    ],
  }

  const handleMenuClick = ({ key }: { key: string }) => {
    setDrawerOpen(false)
    if (key === 'external-catalog') {
      window.location.href = `${window.location.protocol}//${window.location.hostname}:8080/product/catalog`
      return
    }
    navigate(key)
  }

  const renderSidebarBody = (collapsedMode: boolean) => (
    <>
      <div className={`admin-brand${collapsedMode ? ' is-collapsed' : ''}`}>
        <span className="admin-brand-logo"><BrandMark size={34} /></span>
        {!collapsedMode && <span className="admin-brand-text">丰链云<small>FENGCHAIN · AGRI</small></span>}
      </div>
      <Menu
        theme="dark"
        mode="inline"
        inlineCollapsed={collapsedMode}
        selectedKeys={[location.pathname]}
        defaultOpenKeys={collapsedMode ? [] : ['audit-center']}
        className="admin-menu"
        onClick={handleMenuClick}
        items={flatMenuItems}
      />
      <div className="pc-side-user">
        <Dropdown menu={sideUserMenu} trigger={['click']} placement={collapsedMode ? 'topRight' : 'topLeft'}>
          <button
            type="button"
            className="pc-side-user-trigger"
            title={`${displayName} · 平台运营`}
            style={collapsedMode ? { justifyContent: 'center', padding: '6px 0', gap: 0 } : undefined}
          >
            <span className="pc-side-user-avatar">{displayName.slice(0, 1)}</span>
            {!collapsedMode && (
              <>
                <span className="pc-side-user-meta">
                  <strong>{displayName}</strong>
                  <small>平台运营</small>
                </span>
                <span className="pc-side-user-caret"><UpOutlined /></span>
              </>
            )}
          </button>
        </Dropdown>
      </div>
    </>
  )

  return (
    <ConfigProvider theme={adminTheme}>
    <Layout className="admin-shell">
      {!isMobile && (
        <Sider width={240} collapsedWidth={80} collapsed={collapsed} className="admin-side">
          {renderSidebarBody(collapsed)}
        </Sider>
      )}
      {isMobile && (
        <Drawer
          placement="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          width={240}
          closable={false}
          className="admin-nav-drawer"
          styles={{ body: { padding: 0, background: '#001529', display: 'flex', flexDirection: 'column', height: '100%' } }}
        >
          {renderSidebarBody(false)}
        </Drawer>
      )}
      <Layout className="admin-main">
        <WorkspaceHeader
          className="admin-header"
          leftClassName="admin-header-left"
          rightClassName="admin-header-right"
          collapsed={collapsed}
          mobile={isMobile}
          mobileOpen={drawerOpen}
          onToggleCollapse={() => (isMobile ? setDrawerOpen((prev) => !prev) : setCollapsed((prev) => !prev))}
          breadcrumbs={['平台运营中心', MENU_LABELS[location.pathname] ?? '运营中心']}
          right={
            <>
              <div className="admin-role-switch">
                <span className="on">运营中心</span>
                <a onClick={() => navigate('/')}><SwapOutlined /> 用户端</a>
              </div>
              <span className="admin-avatar">运</span>
              <span className="admin-user">平台运营</span>
            </>
          }
        />
        <Content className="admin-content">
          <AdminWorkspaceTabs />
        </Content>
      </Layout>
    </Layout>
    </ConfigProvider>
  )
}
