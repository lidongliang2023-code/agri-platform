import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  AuditOutlined,
  BarChartOutlined,
  ClusterOutlined,
  DashboardOutlined,
  FileProtectOutlined,
  FileTextOutlined,
  FundOutlined,
  NotificationOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SolutionOutlined,
  TeamOutlined,
  UserOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons'
import { Avatar, Dropdown } from 'antd'
import { useApp } from '../app-context'
import type { OpsPageKey } from '../types'
import { opsApi, setOperator } from '../api'
import { logoutUnified, useUnifiedUser } from '../sso'
import { SidebarUserCard } from './SidebarUserCard'
import { RouteWorkspaceTabs, WorkspaceHeader } from '@agri/shared'

type MenuItem = { key: OpsPageKey; label: string; icon: ReactNode }
type MenuGroup = { title: string; items: MenuItem[] }

const MENU: MenuGroup[] = [
  { title: '总览', items: [{ key: 'dashboard', label: '运营大盘', icon: <DashboardOutlined /> }] },
  {
    title: '内容运营',
    items: [
      { key: 'green-supply', label: '绿色供应链', icon: <ClusterOutlined /> },
      { key: 'cloud-factories', label: 'VR 云工厂', icon: <VideoCameraOutlined /> },
      { key: 'contents', label: '内容审核', icon: <FileTextOutlined /> },
      { key: 'courses', label: '培训课程', icon: <VideoCameraOutlined /> },
      { key: 'channels', label: '栏目与作者', icon: <ClusterOutlined /> },
      { key: 'recommend', label: '推荐与推送', icon: <NotificationOutlined /> },
    ],
  },
  {
    title: '行情运营',
    items: [{ key: 'quotes', label: '行情与采集', icon: <FundOutlined /> }],
  },
  {
    title: '交易信息',
    items: [{ key: 'supply-demands', label: '供需审核', icon: <SolutionOutlined /> }],
  },
  {
    title: 'AI 与知识',
    items: [{ key: 'ai', label: 'AI 知识库', icon: <RobotOutlined /> }],
  },
  {
    title: '服务与合规',
    items: [
      { key: 'reports', label: '报告审核', icon: <BarChartOutlined /> },
      { key: 'experts', label: '专家审核', icon: <TeamOutlined /> },
      { key: 'attestations', label: '存证管理', icon: <SafetyCertificateOutlined /> },
    ],
  },
  {
    title: '数据与审计',
    items: [
      { key: 'stats', label: '统计报表', icon: <FileProtectOutlined /> },
      { key: 'audit-logs', label: '操作审计', icon: <AuditOutlined /> },
    ],
  },
]

const TITLES: Record<OpsPageKey, string> = {
  'green-supply': '绿色供应链',
  'cloud-factories': 'VR 云工厂',
  dashboard: '运营大盘',
  contents: '内容审核',
  courses: '培训课程',
  channels: '栏目与作者',
  quotes: '行情与采集',
  'supply-demands': '供需审核',
  recommend: '推荐与推送',
  ai: 'AI 知识库',
  reports: '报告审核',
  experts: '专家审核',
  attestations: '存证管理',
  stats: '统计报表',
  'audit-logs': '操作审计',
}

export function AppShell({ children }: { children: ReactNode }): JSX.Element {
  const { user } = useUnifiedUser()
  const { page, id, navigate } = useApp()
  const [collapsed, setCollapsed] = useState(() => window.innerWidth >= 1024 && window.innerWidth < 1280)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1024)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [pending, setPending] = useState(0)
  const showSidebarCopy = !collapsed || mobileOpen

  useEffect(() => {
    const syncLayout = (): void => {
      const w = window.innerWidth
      setIsMobile(w < 1024)
      if (w >= 1024 && w < 1280) setCollapsed(true)
      else if (w >= 1280) setCollapsed(false)
      if (w >= 1024) setMobileOpen(false)
    }
    window.addEventListener('resize', syncLayout)
    return () => window.removeEventListener('resize', syncLayout)
  }, [])

  const displayName = user.nickname || user.username

  // 写操作审计日志的操作人取自统一账号昵称，会话建立后立即注入请求头。
  useEffect(() => {
    setOperator(displayName)
  }, [displayName])

  useEffect(() => {
    opsApi.dashboard()
      .then((data) => {
        const pendingCard = data.cards.find((card) => card.label.includes('待审核'))
        setPending(Number(pendingCard?.value ?? 0))
      })
      .catch(() => undefined)
  }, [page])

  useEffect(() => {
    setMobileOpen(false)
  }, [page])

  const activeLabel = useMemo(() => TITLES[page], [page])

  return (
    <div className={`app-shell${collapsed ? ' sidebar-collapsed' : ''}`}>
      <aside className={`app-sidebar${mobileOpen ? ' mobile-open' : ''}`}>
        <button className="app-brand" type="button" onClick={() => navigate('dashboard')}>
          <img className="app-brand-mark" src={`${import.meta.env.BASE_URL}fengchain.svg`} alt="丰链云" />
          {showSidebarCopy && (
            <span className="app-brand-copy">
              <b>丰链云</b>
              <small>FENGCHAIN · AGRI</small>
            </span>
          )}
        </button>
        <div className="sidebar-groups">
          {MENU.map((group) => (
            <section className="sidebar-group" key={group.title}>
              {group.items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={page === item.key ? 'on' : ''}
                  title={collapsed ? item.label : undefined}
                  onClick={() => navigate(item.key)}
                >
                  <span className="sidebar-icon">{item.icon}</span>
                  {showSidebarCopy && <span>{item.label}</span>}
                  {showSidebarCopy && item.key === 'contents' && pending > 0 && <i>{pending}</i>}
                </button>
              ))}
            </section>
          ))}
        </div>
        <SidebarUserCard name={displayName} role="资讯运营" collapsed={!showSidebarCopy}
          switchLabel="切换身份（资讯用户端）" switchUrl={`${window.location.protocol}//${window.location.hostname}:8104/info/`}
          onLogout={() => void logoutUnified('info-ops')} />
      </aside>

      {mobileOpen && <button type="button" className="mobile-overlay" aria-label="关闭菜单" onClick={() => setMobileOpen(false)} />}

      <div className="app-main">
        <WorkspaceHeader
          className="app-header"
          leftClassName="header-left"
          rightClassName="header-right"
          collapsed={collapsed}
          mobile={isMobile}
          mobileOpen={mobileOpen}
          onToggleCollapse={() => (isMobile ? setMobileOpen((prev) => !prev) : setCollapsed((prev) => !prev))}
          breadcrumbs={['信息资讯 · 运营端', activeLabel]}
          right={
            <>
              <button type="button" className="header-link" onClick={() => navigate('contents')}>
                待审核 {pending}
              </button>
              <button type="button" className="header-link" onClick={() => navigate('audit-logs')}>审计日志</button>
              <Dropdown
                menu={{
                  items: [
                    { key: 'stats', label: '统计报表', onClick: () => navigate('stats') },
                    { key: 'audit-logs', label: '操作审计', onClick: () => navigate('audit-logs') },
                    { key: 'logout', label: '退出统一登录', onClick: () => void logoutUnified('info-ops') },
                  ],
                }}
                placement="bottomRight"
              >
                <button type="button" className="user-chip">
                  <Avatar size={32} icon={<UserOutlined />} className="user-avatar">{displayName.slice(0, 1)}</Avatar>
                  <span><b>{displayName}</b><small>统一账号 · 运营权限</small></span>
                </button>
              </Dropdown>
            </>
          }
        />
        <RouteWorkspaceTabs
          activeKey={id === undefined ? page : `${page}/${id}`}
          activeLabel={id === undefined ? activeLabel : `${activeLabel} · ${id}`}
          activePath={window.location.hash.replace(/^#\/?/, '')}
          homeKey="dashboard"
          homeLabel={TITLES.dashboard}
          onNavigate={(path) => { window.location.hash = `/${path}` }}
          storageKey="agri-info-ops:workspace-tabs"
        />

        <main className="app-content">{children}</main>
        <footer className="app-footer">© 2026 农业产业互联网平台 · 丰链云信息资讯运营端</footer>
      </div>
    </div>
  )
}
