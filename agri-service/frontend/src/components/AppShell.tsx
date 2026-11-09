import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  BellOutlined,
  BookOutlined,
  CalendarOutlined,
  CompassOutlined,
  CustomerServiceOutlined,
  FileProtectOutlined,
  FileTextOutlined,
  HomeOutlined,
  InsuranceOutlined,
  MessageOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ProfileOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  ShopOutlined,
  SolutionOutlined,
  TeamOutlined,
  ToolOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Avatar, Badge, Dropdown } from 'antd'
import { useApp } from '../app-context'
import type { PageKey } from '../types'
import { serviceApi } from '../api'
import { logoutUnified, useUnifiedUser } from '../sso'

type MenuItem = { key: PageKey; label: string; icon: ReactNode }
type MenuGroup = { title: string; items: MenuItem[] }

const MENU: MenuGroup[] = [
  {
    title: '服务概览',
    items: [{ key: 'home', label: '服务首页', icon: <HomeOutlined /> }],
  },
  {
    title: '服务交易',
    items: [
      { key: 'services', label: '服务超市', icon: <ShopOutlined /> },
      { key: 'orders', label: '我的订单', icon: <ProfileOutlined /> },
      { key: 'contracts', label: '服务合同', icon: <FileProtectOutlined /> },
      { key: 'complaints', label: '售后与投诉', icon: <CustomerServiceOutlined /> },
    ],
  },
  {
    title: '生产保障',
    items: [
      { key: 'insurance', label: '农险服务', icon: <InsuranceOutlined /> },
      { key: 'consult', label: '农技问诊', icon: <TeamOutlined /> },
      { key: 'ai-diagnose', label: '农事问题初判', icon: <RobotOutlined /> },
      { key: 'training', label: '培训课堂', icon: <BookOutlined /> },
    ],
  },
  {
    title: '产业资源',
    items: [
      { key: 'demand', label: '需求大厅', icon: <CalendarOutlined /> },
      { key: 'resources', label: '土地·用工·法律', icon: <CompassOutlined /> },
      { key: 'policies', label: '惠农政策', icon: <SafetyCertificateOutlined /> },
    ],
  },
  {
    title: '我的服务',
    items: [
      { key: 'messages', label: '消息中心', icon: <MessageOutlined /> },
      { key: 'join', label: '服务商入驻', icon: <SolutionOutlined /> },
    ],
  },
]

const TITLES: Record<PageKey, string> = {
  home: '服务首页',
  services: '服务超市',
  provider: '服务商详情',
  orders: '我的订单',
  'order-detail': '订单详情',
  demand: '需求大厅',
  insurance: '农险服务',
  policies: '惠农政策',
  training: '培训课堂',
  consult: '农技问诊',
  'ai-diagnose': '农事问题初判',
  resources: '产业资源',
  messages: '消息中心',
  join: '服务商入驻',
  contracts: '服务合同',
  complaints: '售后与投诉',
}

const PRIMARY_MOBILE: PageKey[] = ['home', 'services', 'orders', 'messages']

export function AppShell({ children }: { children: ReactNode }): JSX.Element {
  const { user } = useUnifiedUser()
  const { page, navigate, openServices } = useApp()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [unread, setUnread] = useState(0)
  const [subjectName, setSubjectName] = useState('')

  useEffect(() => {
    serviceApi.messages()
      .then((items) => setUnread(items.filter((item) => !item.read).length))
      .catch(() => undefined)
    serviceApi.identity()
      .then((identity) => setSubjectName(identity.merchantName))
      .catch(() => setSubjectName(''))
  }, [page])

  useEffect(() => {
    setMobileOpen(false)
  }, [page])

  const activeLabel = useMemo(() => TITLES[page], [page])
  const displayName = user.nickname || user.username

  const go = (key: PageKey): void => {
    navigate(key)
  }

  return (
    <div className={`app-shell${collapsed ? ' sidebar-collapsed' : ''}`}>
      <aside className={`app-sidebar${mobileOpen ? ' mobile-open' : ''}`}>
        <button className="app-brand" type="button" onClick={() => go('home')}>
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
                  onClick={() => go(item.key)}
                >
                  <span className="sidebar-icon">{item.icon}</span>
                  {!collapsed && <span>{item.label}</span>}
                  {!collapsed && item.key === 'messages' && unread > 0 && <i>{unread}</i>}
                </button>
              ))}
            </section>
          ))}
        </div>
        <div className="sidebar-bottom">
          {!collapsed && (
            <div className="sidebar-aid">
              <span><ToolOutlined /></span>
              <div><b>需要协助？</b><small>服务管家 7×12 小时在线</small></div>
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
              <span>综合服务</span><b>/</b><strong>{activeLabel}</strong>
            </div>
          </div>
          <form
            className="global-search"
            onSubmit={(event) => {
              event.preventDefault()
              openServices(keyword.trim())
            }}
          >
            <SearchOutlined />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索农机、农技、检测或服务商"
              aria-label="搜索服务"
            />
            <kbd>搜索</kbd>
          </form>
          <div className="header-right">
            <button type="button" className="header-link" onClick={() => go('join')}>我是服务商</button>
            <button type="button" className="header-icon" aria-label="消息中心" onClick={() => go('messages')}>
              <Badge count={unread} size="small"><BellOutlined /></Badge>
            </button>
            <Dropdown
              menu={{
                items: [
                  { key: 'orders', label: '我的服务订单', onClick: () => go('orders') },
                  { key: 'messages', label: '消息与通知', onClick: () => go('messages') },
                  { key: 'join', label: '服务商入驻', onClick: () => go('join') },
                  { key: 'logout', label: '退出统一登录', onClick: () => void logoutUnified('service') },
                ],
              }}
              placement="bottomRight"
            >
              <button type="button" className="user-chip">
                <Avatar size={32} icon={<UserOutlined />} className="user-avatar">{displayName.slice(0, 1)}</Avatar>
                <span><b>{displayName}</b><small>{subjectName ? `经营主体：${subjectName}` : '未解析到经营主体'}</small></span>
              </button>
            </Dropdown>
          </div>
        </header>

        <main className="app-content">{children}</main>
        <footer className="app-footer">© 2026 农业产业互联网平台 · 丰链云综合服务</footer>
      </div>

      <nav className="mobile-tabbar">
        {PRIMARY_MOBILE.map((key) => {
          const item = MENU.flatMap((group) => group.items).find((entry) => entry.key === key)
          if (!item) return null
          return (
            <button type="button" key={key} className={page === key ? 'on' : ''} onClick={() => go(key)}>
              {item.icon}
              <span>{item.label.replace('服务', key === 'home' ? '首页' : '')}</span>
              {key === 'messages' && unread > 0 && <i>{unread}</i>}
            </button>
          )
        })}
        <button type="button" onClick={() => setMobileOpen(true)}>
          <FileTextOutlined />
          <span>更多</span>
        </button>
      </nav>
    </div>
  )
}
