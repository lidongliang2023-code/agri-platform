import { logoutBrowser } from '../../../../../packages/agri-shared/src/auth/logout'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import { BellOutlined, LogoutOutlined, ShopOutlined, SwapOutlined, UpOutlined, UserOutlined } from '@ant-design/icons'
import { WorkspaceHeader, WorkspaceTabs, isFormWorkspaceTab, type WorkspaceTabItem } from '@agri/shared'
import { clearSession, getAccessToken, getCurrentUser } from '@/utils/session'
import { ssoLogoutUrl } from '@/utils/sso'
import { BrandMark } from '@/components/BrandMark'
import './member-center.css'

export interface MemberNavItem {
  key: string
  label: string
  icon: ReactNode
  group?: string
}

interface Props {
  role: 'buyer' | 'seller'
  active: string
  /** 当前实际打开的页签 key（例如 publish / supply）；未传时沿用 active。 */
  tabKey?: string
  /** 非左侧主菜单项的页签标题映射。 */
  extraTabLabels?: Record<string, string>
  /** 默认首页页签 key，全部关闭后回落至此页。 */
  homeTabKey?: string
  navItems: MemberNavItem[]
  merchantName: string
  onNavigate: (key: string) => void
  /** 顶部全局提示（如会员数据加载/错误），显示在激活页签面板顶部。 */
  notice?: ReactNode
  /** 按页签 key 渲染各自内容，用于多页签切换时保留未关闭页签状态。 */
  renderTab?: (key: string) => ReactNode
  children?: ReactNode
}

const ROLE_TEXT = { buyer: '买家中心', seller: '卖家中心' }
const PERSONAL_CENTER = `${window.location.protocol}//${window.location.hostname}:8098/portal/#/account/business`
const memberTheme = {
  token: {
    colorPrimary: '#2d8f4e',
    colorLink: '#1b6332',
    colorLinkHover: '#247a3f',
    colorSuccess: '#2d8f4e',
    colorInfo: '#2d8f4e',
    borderRadius: 6,
    controlOutline: 'rgba(45, 143, 78, 0.12)',
  },
}

export function MemberCenterShell({
  role,
  active,
  tabKey,
  extraTabLabels,
  homeTabKey = 'overview',
  navItems,
  merchantName,
  onNavigate,
  notice,
  renderTab,
  children,
}: Props): JSX.Element {
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(() => window.matchMedia('(min-width: 1024px) and (max-width: 1279px)').matches)
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 1023px)').matches)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const currentTabKey = tabKey || active || homeTabKey
  const resolveTabLabel = (key: string): string =>
    extraTabLabels?.[key] ?? navItems.find((item) => item.key === key)?.label ?? '首页概览'
  const activeLabel = resolveTabLabel(currentTabKey)
  const currentTab: WorkspaceTabItem = {
    key: currentTabKey,
    label: activeLabel,
    form: isFormWorkspaceTab(`/member/${role}?tab=${currentTabKey}`, activeLabel),
  }
  const [tabs, setTabs] = useState<WorkspaceTabItem[]>([currentTab])

  useEffect(() => {
    setTabs([currentTab])
    // 切换买家/卖家角色时重置打开的页签集合。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role])

  useEffect(() => {
    setTabs((previous) =>
      previous.some((tab) => tab.key === currentTabKey)
        ? previous.map((tab) => (tab.key === currentTabKey ? { ...tab, label: activeLabel, form: currentTab.form } : tab))
        : [...previous, currentTab],
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTabKey, activeLabel])

  const visibleTabs = tabs.some((tab) => tab.key === currentTabKey) ? tabs : [...tabs, currentTab]
  const sessionUser = getCurrentUser()
  const displayName = merchantName || sessionUser?.nickname || sessionUser?.username || (role === 'buyer' ? '买家会员' : '卖家会员')
  const avatar = displayName.slice(0, 1)

  const navGroups = navItems.reduce<Array<{ title: string; items: MemberNavItem[] }>>((acc, item) => {
    const title = item.group || ROLE_TEXT[role]
    const last = acc[acc.length - 1]
    if (last && last.title === title) {
      last.items.push(item)
    } else {
      acc.push({ title, items: [item] })
    }
    return acc
  }, [])

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
    compactMedia.addEventListener('change', syncViewport)
    mobileMedia.addEventListener('change', syncViewport)
    const closeOnDocClick = (event: MouseEvent) => {
      if (!(event.target instanceof HTMLElement) || !event.target.closest('.pc-side-user')) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('click', closeOnDocClick)
    return () => {
      compactMedia.removeEventListener('change', syncViewport)
      mobileMedia.removeEventListener('change', syncViewport)
      document.removeEventListener('click', closeOnDocClick)
    }
  }, [])

  const handleSelectNav = (key: string): void => {
    setDrawerOpen(false)
    onNavigate(key)
  }

  const logout = (): void => {
    void logoutBrowser({ token: getAccessToken(), clientId: 'trade', ssoOrigin: new URL(ssoLogoutUrl()).origin, clear: clearSession })
  }

  return (
    <ConfigProvider theme={memberTheme}>
    <div className={`mc-shell${!isMobile && collapsed ? ' is-collapsed' : ''}${drawerOpen ? ' is-drawer-open' : ''}`}>
      {drawerOpen && (
        <button
          type="button"
          className="mc-drawer-overlay"
          aria-label="关闭导航菜单"
          onClick={() => setDrawerOpen(false)}
        />
      )}
      <aside className={`mc-side${drawerOpen ? ' is-open' : ''}`}>
        <a className="mc-brand" href="/" title="丰链云">
          <span className="mc-brand-logo"><BrandMark size={34} /></span>
          <span className="mc-brand-copy">丰链云<small>FENGCHAIN · AGRI</small></span>
        </a>
        <div className="mc-side-scroll">
          {navGroups.map((group) => (
            <div key={group.title} className="mc-side-section">
              <nav className="mc-side-nav">
                {group.items.map((item) => (
                  <button
                    type="button"
                    key={item.key}
                    className={item.key === active ? 'on' : ''}
                    title={item.label}
                    aria-label={item.label}
                    onClick={() => handleSelectNav(item.key)}
                  >
                    <span className="mc-nav-icon">{item.icon}</span>
                    <span className="mc-nav-label">{item.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          ))}
          <div className="mc-side-section">
            <nav className="mc-side-nav">
              <a href="/hall" title="交易大厅" aria-label="交易大厅">
                <span className="mc-nav-icon"><ShopOutlined /></span>
                <span className="mc-nav-label">交易大厅</span>
              </a>
              <a href={PERSONAL_CENTER} target="_blank" rel="noreferrer" title="个人中心" aria-label="个人中心">
                <span className="mc-nav-icon"><SwapOutlined /></span>
                <span className="mc-nav-label">个人中心</span>
              </a>
            </nav>
          </div>
        </div>
        <div className="pc-side-user">
          <button
            type="button"
            className="pc-side-user-trigger"
            title={`${displayName} · ${ROLE_TEXT[role]}`}
            aria-expanded={userMenuOpen}
            aria-haspopup="menu"
            onClick={(event) => { event.stopPropagation(); setUserMenuOpen((prev) => !prev) }}
          >
            <span className="pc-side-user-avatar">{avatar}</span>
            <span className="pc-side-user-meta">
              <strong>{displayName}</strong>
              <small>{ROLE_TEXT[role]}</small>
            </span>
            <span className="pc-side-user-caret"><UpOutlined /></span>
          </button>
          {userMenuOpen && (
            <div className="pc-side-user-menu" role="menu">
              <a href={PERSONAL_CENTER} target="_blank" rel="noreferrer" role="menuitem" onClick={() => setUserMenuOpen(false)}>
                <UserOutlined /> 个人中心
              </a>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setUserMenuOpen(false)
                  setDrawerOpen(false)
                  navigate(role === 'buyer' ? '/member/seller' : '/member/buyer')
                }}
              >
                <SwapOutlined /> 切换至{role === 'buyer' ? '卖家中心' : '买家中心'}
              </button>
              <div className="pc-side-user-divider" />
              <button type="button" className="is-danger" role="menuitem" onClick={logout}>
                <LogoutOutlined /> 退出登录
              </button>
            </div>
          )}
        </div>
      </aside>

      <div className="mc-main">
        <WorkspaceHeader
          className="mc-top"
          leftClassName="mc-top-left"
          rightClassName="mc-top-right"
          collapsed={collapsed}
          mobile={isMobile}
          mobileOpen={drawerOpen}
          onToggleCollapse={() => (isMobile ? setDrawerOpen((prev) => !prev) : setCollapsed((prev) => !prev))}
          left={
            <div className="mc-crumb">
              <Link to={role === 'buyer' ? '/member/buyer' : '/member/seller'}>{ROLE_TEXT[role]}</Link>
              <span>/</span>
              <strong>{activeLabel}</strong>
            </div>
          }
          right={
            <>
              <div className="mc-role-switch">
                <Link className={role === 'buyer' ? 'on' : ''} to="/member/buyer">买家中心</Link>
                <Link className={role === 'seller' ? 'on' : ''} to="/member/seller">卖家中心</Link>
              </div>
              <span className="mc-avatar">{avatar}</span>
              <span className="mc-merchant-name">{merchantName || '尚未绑定经营主体'}</span>
              <button type="button" className="mc-icon-btn" title="消息通知（待接入）" onClick={() => navigate('/')}>
                <BellOutlined />
              </button>
            </>
          }
        />
        <WorkspaceTabs
          tabs={visibleTabs}
          activeKey={currentTabKey}
          fallbackKey={homeTabKey}
          onSelect={onNavigate}
          onTabsChange={setTabs}
          className="mc-workspace"
          tabBarClassName="mc-workspace-tabbar"
          paneClassName="mc-workspace-pane"
          renderMobile={() => (
            <div className="mc-body">
              {notice}
              {renderTab ? renderTab(currentTabKey) : children}
            </div>
          )}
          renderPane={(tab, isActive) => (
            <div className="mc-body">
              {isActive && notice}
              {renderTab ? renderTab(tab.key) : (isActive ? children : null)}
            </div>
          )}
          footer={<footer className="mc-foot">© 2026 农业产业互联网平台 · 交易撮合会员中心</footer>}
        />
      </div>
    </div>
    </ConfigProvider>
  )
}
