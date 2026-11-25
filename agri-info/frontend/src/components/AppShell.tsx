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
import { SidebarUserCard } from './SidebarUserCard'
import { RouteWorkspaceTabs, WorkspaceHeader } from '@agri/shared'

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


export function AppShell({ children }: { children: ReactNode }): JSX.Element {
  const { user } = useUnifiedUser()
  const { page, id, navigate, openSearch } = useApp()
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 1280)
  const [keyword, setKeyword] = useState('')
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    const syncLayout = (): void => {
      setCollapsed(window.innerWidth < 1280)
    }
    window.addEventListener('resize', syncLayout)
    return () => window.removeEventListener('resize', syncLayout)
  }, [])

  const displayName = user.nickname || user.username

  // 显示名称仅用于兼容展示，业务归属由后端验证令牌得到的账号 ID 决定。
  useEffect(() => {
    setCurrentUser(displayName)
  }, [displayName])

  useEffect(() => {
    infoApi.alertMessages()
      .then((data) => setUnread(data.unread))
      .catch(() => undefined)
  }, [page])


  const activeLabel = useMemo(() => TITLES[page], [page])

  return (
    <div className={`app-shell${collapsed ? ' sidebar-collapsed' : ''}`}>
      <aside className="app-sidebar">
        <button className="app-brand" type="button" onClick={() => navigate('home')}>
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
        <SidebarUserCard name={displayName} role="信息资讯用户" collapsed={collapsed}
          switchLabel="切换身份（资讯运营端）" switchUrl={`${window.location.protocol}//${window.location.hostname}:8113/info-ops/`}
          onLogout={() => void logoutUnified('info')} />
      </aside>


      <div className="app-main">
        <WorkspaceHeader
          className="app-header"
          leftClassName="header-left"
          rightClassName="header-right"
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((prev) => !prev)}
          breadcrumbs={['信息资讯', activeLabel]}
          center={
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
          }
          right={
            <>
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
            </>
          }
        />
        <RouteWorkspaceTabs
          activeKey={id === undefined ? page : `${page}/${id}`}
          activeLabel={id === undefined ? activeLabel : `${activeLabel} · ${id}`}
          activePath={window.location.hash.replace(/^#\/?/, '')}
          homeKey="home"
          homeLabel={TITLES.home}
          onNavigate={(path) => { window.location.hash = `/${path}` }}
          storageKey="agri-info:workspace-tabs"
        />

        <main className="app-content">{children}</main>
        <footer className="app-footer">© 2026 农业产业互联网平台 · 丰链云信息资讯</footer>
      </div>

    </div>
  )
}
