import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  AlertOutlined,
  BarChartOutlined,
  BookOutlined,
  CameraOutlined,
  CompassOutlined,
  CrownOutlined,
  DashboardOutlined,
  FileTextOutlined,
  FireOutlined,
  FundOutlined,
  LineChartOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MessageOutlined,
  NotificationOutlined,
  RobotOutlined,
  SearchOutlined,
  StarOutlined,
  SwapOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Avatar, Badge, Dropdown } from 'antd'
import { useApp } from '../app-context'
import type { PageKey } from '../types'
import { infoApi, setCurrentUser } from '../api'
import { logoutUnified, useUnifiedUser } from '../sso'

type MenuItem = { key: PageKey; label: string; icon: ReactNode }
type MenuGroup = { title: string; items: MenuItem[] }

const MENU: MenuGroup[] = [
  { title: '工作台', items: [{ key: 'home', label: '资讯工作台', icon: <DashboardOutlined /> }] },
  {
    title: '行情服务',
    items: [
      { key: 'market', label: '行情中心', icon: <FundOutlined /> },
      { key: 'indices', label: '价格指数', icon: <LineChartOutlined /> },
      { key: 'forecast', label: 'AI 供需预测', icon: <ThunderboltOutlined /> },
      { key: 'compare', label: '多品种比价', icon: <SwapOutlined /> },
    ],
  },
  {
    title: '资讯内容',
    items: [
      { key: 'news', label: '资讯频道', icon: <FileTextOutlined /> },
      { key: 'search', label: '搜索与发现', icon: <SearchOutlined /> },
    ],
  },
  {
    title: '供需大厅',
    items: [
      { key: 'sd', label: '供需信息大厅', icon: <CompassOutlined /> },
      { key: 'sd-publish', label: '发布供需信息', icon: <NotificationOutlined /> },
      { key: 'sd-match', label: 'AI 智能匹配', icon: <FireOutlined /> },
    ],
  },
  {
    title: 'AI 农技',
    items: [
      { key: 'ai-qa', label: 'AI 问答助手', icon: <RobotOutlined /> },
      { key: 'pest', label: '拍照识病虫', icon: <CameraOutlined /> },
      { key: 'expert', label: '专家问答社区', icon: <TeamOutlined /> },
    ],
  },
  {
    title: '学习培训',
    items: [
      { key: 'training', label: '培训学院', icon: <BookOutlined /> },
      { key: 'knowledge', label: '农技知识库', icon: <TrophyOutlined /> },
    ],
  },
  {
    title: '数据服务',
    items: [
      { key: 'reports', label: '数据报告', icon: <BarChartOutlined /> },
      { key: 'attest', label: '内容存证', icon: <CrownOutlined /> },
      { key: 'favorites', label: '我的收藏', icon: <StarOutlined /> },
    ],
  },
  {
    title: '我的',
    items: [
      { key: 'alerts', label: '预警与订阅', icon: <AlertOutlined /> },
      { key: 'expert-cert', label: '专家认证', icon: <MessageOutlined /> },
    ],
  },
]

const TITLES: Record<PageKey, string> = {
  home: '资讯工作台',
  market: '行情中心',
  'market-detail': '品种行情详情',
  compare: '多品种比价',
  indices: '价格指数',
  forecast: 'AI 供需预测',
  news: '资讯频道',
  'news-detail': '资讯详情',
  search: '搜索与发现',
  sd: '供需信息大厅',
  'sd-detail': '供需信息详情',
  'sd-publish': '发布供需信息',
  'sd-match': 'AI 智能匹配',
  'ai-qa': 'AI 问答助手',
  pest: '拍照识病虫',
  expert: '专家问答社区',
  training: '培训学院',
  knowledge: '农技知识库',
  reports: '数据报告',
  attest: '内容存证',
  alerts: '预警与订阅',
  favorites: '我的收藏',
  'expert-cert': '专家认证',
}

const PRIMARY_MOBILE: PageKey[] = ['home', 'market', 'sd', 'alerts']

export function AppShell({ children }: { children: ReactNode }): JSX.Element {
  const { user } = useUnifiedUser()
  const { page, navigate, openSearch } = useApp()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [unread, setUnread] = useState(0)

  const displayName = user.nickname || user.username

  // 统一账号昵称是私域数据（我的发布 / 预警 / 收藏）的归属键，会话建立后立即注入请求头。
  useEffect(() => {
    setCurrentUser(displayName)
  }, [displayName])

  useEffect(() => {
    infoApi.alertMessages()
      .then((data) => setUnread(data.unread))
      .catch(() => undefined)
  }, [page])

  useEffect(() => {
    setMobileOpen(false)
  }, [page])

  const activeLabel = useMemo(() => TITLES[page], [page])

  return (
    <div className={`app-shell${collapsed ? ' sidebar-collapsed' : ''}`}>
      <aside className={`app-sidebar${mobileOpen ? ' mobile-open' : ''}`}>
        <button className="app-brand" type="button" onClick={() => navigate('home')}>
          <span className="app-brand-mark">讯</span>
          {!collapsed && (
            <span className="app-brand-copy">
              <b>丰链云</b>
              <small>信息资讯 · INFO</small>
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
                  {!collapsed && item.key === 'alerts' && unread > 0 && <i>{unread}</i>}
                </button>
              ))}
            </section>
          ))}
        </div>
        <div className="sidebar-bottom">
          {!collapsed && (
            <div className="sidebar-aid">
              <span><RobotOutlined /></span>
              <div><b>AI 资讯管家</b><small>行情 · 供需 · 农技 7×24 在线</small></div>
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
              <span>信息资讯</span><b>/</b><strong>{activeLabel}</strong>
            </div>
          </div>
          <form
            className="global-search"
            onSubmit={(event) => {
              event.preventDefault()
              openSearch(keyword.trim())
            }}
          >
            <SearchOutlined />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索品种行情、资讯、农技知识或供需信息"
              aria-label="搜索信息资讯"
            />
            <kbd>搜索</kbd>
          </form>
          <div className="header-right">
            <button type="button" className="header-link" onClick={() => navigate('ai-qa')}>✦ AI 问答</button>
            <button type="button" className="header-icon" aria-label="预警消息" onClick={() => navigate('alerts')}>
              <Badge count={unread} size="small"><AlertOutlined /></Badge>
            </button>
            <button type="button" className="header-icon" aria-label="我的收藏" onClick={() => navigate('favorites')}>
              <StarOutlined />
            </button>
            <Dropdown
              menu={{
                items: [
                  { key: 'favorites', label: '我的收藏', onClick: () => navigate('favorites') },
                  { key: 'alerts', label: '预警与订阅', onClick: () => navigate('alerts') },
                  { key: 'expert-cert', label: '专家认证', onClick: () => navigate('expert-cert') },
                  { key: 'logout', label: '退出统一登录', onClick: () => void logoutUnified('info') },
                ],
              }}
              placement="bottomRight"
            >
              <button type="button" className="user-chip">
                <Avatar size={32} icon={<UserOutlined />} className="user-avatar">{displayName.slice(0, 1)}</Avatar>
                <span><b>{displayName}</b><small>统一账号 · 信息资讯</small></span>
              </button>
            </Dropdown>
          </div>
        </header>

        <main className="app-content">{children}</main>
        <footer className="app-footer">© 2026 农业产业互联网平台 · 丰链云信息资讯</footer>
      </div>

      <nav className="mobile-tabbar">
        {PRIMARY_MOBILE.map((key) => {
          const item = MENU.flatMap((group) => group.items).find((entry) => entry.key === key)
          if (!item) return null
          return (
            <button type="button" key={key} className={page === key ? 'on' : ''} onClick={() => navigate(key)}>
              {item.icon}
              <span>{item.label.replace('资讯', '').replace('信息', '')}</span>
              {key === 'alerts' && unread > 0 && <i>{unread}</i>}
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
