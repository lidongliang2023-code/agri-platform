import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  AuditOutlined,
  BarChartOutlined,
  BellOutlined,
  ClusterOutlined,
  DashboardOutlined,
  FileProtectOutlined,
  IdcardOutlined,
  KeyOutlined,
  LockOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MessageOutlined,
  SafetyCertificateOutlined,
  SafetyOutlined,
  SettingOutlined,
  SolutionOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Avatar, Dropdown } from 'antd'
import { useApp } from '../app-context'
import type { OpsPageKey } from '../types'
import { ucApi } from '../api'
import { logoutUnified, useUnifiedUser } from '../sso'

type MenuItem = { key: OpsPageKey; label: string; icon: ReactNode }
type MenuGroup = { title: string; items: MenuItem[] }

/** 导航结构与原型「用户中心运营端」一一对应，顺序也保持一致。 */
const MENU: MenuGroup[] = [
  { title: '运营总览', items: [{ key: 'dashboard', label: '用户中心总览', icon: <DashboardOutlined /> }] },
  {
    title: '用户与身份',
    items: [
      { key: 'user-list', label: '用户列表', icon: <UserOutlined /> },
      { key: 'user-identity', label: '身份管理', icon: <IdcardOutlined /> },
    ],
  },
  {
    title: '认证审核',
    items: [
      { key: 'identity-audit', label: '身份申请审核', icon: <SolutionOutlined /> },
      { key: 'realname-audit', label: '实名认证审核', icon: <SafetyCertificateOutlined /> },
      { key: 'qualification-audit', label: '资质审核', icon: <FileProtectOutlined /> },
    ],
  },
  {
    title: '组织管理',
    items: [
      { key: 'org-list', label: '组织列表', icon: <ClusterOutlined /> },
      { key: 'org-audit', label: '组织认证审核', icon: <SafetyOutlined /> },
    ],
  },
  {
    title: '角色权限',
    items: [
      { key: 'role-list', label: '角色管理', icon: <TeamOutlined /> },
      { key: 'perm-matrix', label: '权限矩阵', icon: <KeyOutlined /> },
    ],
  },
  {
    title: '第三方授权',
    items: [
      { key: 'auth-app', label: '第三方应用', icon: <LockOutlined /> },
      { key: 'auth-record', label: '授权记录', icon: <AuditOutlined /> },
    ],
  },
  {
    title: '消息中心',
    items: [
      { key: 'message-push', label: '消息推送', icon: <BellOutlined /> },
      { key: 'message-template', label: '消息模板', icon: <MessageOutlined /> },
    ],
  },
  {
    title: '安全风控',
    items: [
      { key: 'security-risk', label: '安全风险监控', icon: <SafetyOutlined /> },
      { key: 'device-log', label: '设备与登录日志', icon: <AuditOutlined /> },
      { key: 'account-freeze', label: '账号冻结与解封', icon: <LockOutlined /> },
    ],
  },
  {
    title: '合规服务',
    items: [
      { key: 'privacy-request', label: '隐私请求处理', icon: <FileProtectOutlined /> },
      { key: 'feedback-manage', label: '反馈处理', icon: <MessageOutlined /> },
    ],
  },
  { title: '数据分析', items: [{ key: 'stats', label: '用户统计分析', icon: <BarChartOutlined /> }] },
  {
    title: '系统设置',
    items: [
      { key: 'health-monitor', label: '统一健康监控', icon: <DashboardOutlined /> },
      { key: 'config', label: '参数配置', icon: <SettingOutlined /> },
      { key: 'audit-log', label: '操作审计', icon: <AuditOutlined /> },
    ],
  },
]

const TITLES: Record<OpsPageKey, string> = {
  dashboard: '用户中心总览',
  'health-monitor': '统一健康监控',
  'user-list': '用户列表',
  'user-detail': '用户详情',
  'user-identity': '身份管理',
  'identity-audit': '身份申请审核',
  'realname-audit': '实名认证审核',
  'qualification-audit': '资质审核',
  'org-list': '组织列表',
  'org-detail': '组织详情',
  'org-audit': '组织认证审核',
  'role-list': '角色管理',
  'perm-matrix': '权限矩阵',
  'auth-app': '第三方应用',
  'auth-record': '授权记录',
  'message-push': '消息推送',
  'message-template': '消息模板',
  'security-risk': '安全风险监控',
  'device-log': '设备与登录日志',
  'account-freeze': '账号冻结与解封',
  'privacy-request': '隐私请求处理',
  'feedback-manage': '反馈处理',
  stats: '用户统计分析',
  config: '参数配置',
  'audit-log': '操作审计',
}

/** 详情页在导航里归属哪个菜单项（用于侧栏高亮）。 */
const PARENT_OF: Partial<Record<OpsPageKey, OpsPageKey>> = {
  'user-detail': 'user-list',
  'org-detail': 'org-list',
}

export function AppShell({ children }: { children: ReactNode }): JSX.Element {
  const { user } = useUnifiedUser()
  const { page, navigate } = useApp()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [pending, setPending] = useState(0)

  const displayName = user.nickname || user.username
  const highlight = PARENT_OF[page] ?? page

  // 待办总数放在侧栏徽标上：运营每天第一件事就是看积压，不该只在总览页可见。
  useEffect(() => {
    ucApi.dashboard(7)
      .then((data) => {
        setPending(data.todos.reduce((sum, todo) => sum + todo.count, 0))
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
                  className={highlight === item.key ? 'on' : ''}
                  title={collapsed ? item.label : undefined}
                  onClick={() => navigate(item.key)}
                >
                  <span className="sidebar-icon">{item.icon}</span>
                  {!collapsed && <span>{item.label}</span>}
                  {!collapsed && item.key === 'dashboard' && pending > 0 && <i>{pending}</i>}
                </button>
              ))}
            </section>
          ))}
        </div>
        <div className="sidebar-bottom">
          {!collapsed && (
            <div className="sidebar-aid">
              <span><AuditOutlined /></span>
              <div><b>操作留痕</b><small>审核/冻结/改配置均落审计</small></div>
            </div>
          )}
          <button type="button" className="sidebar-toggle" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <MenuUnfoldOutlined /> : <><MenuFoldOutlined /> 收起导航</>}
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <button
          type="button"
          className="mobile-overlay"
          aria-label="关闭菜单"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="app-main">
        <header className="app-header">
          <div className="header-left">
            <button type="button" className="mobile-menu-button" onClick={() => setMobileOpen(true)}>
              <MenuUnfoldOutlined />
            </button>
            <div className="header-crumb">
              <span>用户中心 · 运营端</span><b>/</b><strong>{activeLabel}</strong>
            </div>
          </div>
          <div className="header-right">
            <button type="button" className="header-link" onClick={() => navigate('dashboard')}>
              待办 {pending}
            </button>
            <button type="button" className="header-link" onClick={() => navigate('audit-log')}>
              审计日志
            </button>
            <Dropdown
              menu={{
                items: [
                  { key: 'config', label: '参数配置', onClick: () => navigate('config') },
                  { key: 'stats', label: '用户统计', onClick: () => navigate('stats') },
                  { key: 'logout', label: '退出统一登录', onClick: () => void logoutUnified('user-center-ops') },
                ],
              }}
              placement="bottomRight"
            >
              <button type="button" className="user-chip">
                <Avatar size={32} icon={<UserOutlined />} className="user-avatar">
                  {displayName.slice(0, 1)}
                </Avatar>
                <span><b>{displayName}</b><small>统一账号 · 运营权限</small></span>
              </button>
            </Dropdown>
          </div>
        </header>

        <main className="app-content">{children}</main>
        <footer className="app-footer">© 2026 农业产业互联网平台 · 丰链云用户中心运营端</footer>
      </div>
    </div>
  )
}
