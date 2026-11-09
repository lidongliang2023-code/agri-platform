import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  AuditOutlined,
  BarChartOutlined,
  ClusterOutlined,
  DashboardOutlined,
  FileProtectOutlined,
  FileTextOutlined,
  FundOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
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
  const { page, navigate } = useApp()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [pending, setPending] = useState(0)

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
          {!collapsed && (
            <span className="app-brand-copy">
              <b>丰链云</b>
              <small>FENGCHAIN · AGRI</small>
            </span>
          )}
        </button>
        <div className="sidebar-groups">
          {MENU.map((group) => (
            <section className="sidebar-group" key={group.title}>
              {!collapsed && <h3>{group.title}</h3>}
              {group.items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={page === item.key ? 'on' : ''}
                  title={collapsed ? item.label : undefined}
                  onClick={() => navigate(item.key)}
                >
                  <span className="sidebar-icon">{item.icon}</span>
                  {!collapsed && <span>{item.label}</span>}
                  {!collapsed && item.key === 'contents' && pending > 0 && <i>{pending}</i>}
                </button>
              ))}
            </section>
          ))}
        </div>
        <div className="sidebar-bottom">
          {!collapsed && (
            <div className="sidebar-aid">
              <span><AuditOutlined /></span>
              <div><b>操作留痕</b><small>所有写操作均落审计日志</small></div>
            </div>
          )}
          <button type="button" className="sidebar-toggle" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <MenuUnfoldOutlined /> : <><MenuFoldOutlined /> 收起导航</>}
          </button>
        </div>
      </aside>

      {mobileOpen && <button type="button" className="mobile-overlay" aria-label="关闭菜单" onClick={() => setMobileOpen(false)} />}

      <div className="app-main">
        <header className="app-header">
          <div className="header-left">
            <button type="button" className="mobile-menu-button" onClick={() => setMobileOpen(true)}>
              <MenuUnfoldOutlined />
            </button>
            <div className="header-crumb">
              <span>信息资讯 · 运营端</span><b>/</b><strong>{activeLabel}</strong>
            </div>
          </div>
          <div className="header-right">
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
          </div>
        </header>

        <main className="app-content">{children}</main>
        <footer className="app-footer">© 2026 农业产业互联网平台 · 丰链云信息资讯运营端</footer>
      </div>
    </div>
  )
}
