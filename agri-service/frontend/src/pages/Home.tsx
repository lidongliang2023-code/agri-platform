import { useEffect, useState } from 'react'
import {
  ArrowRightOutlined,
  CalendarOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  FileTextOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { Button } from 'antd'
import { serviceApi } from '../api'
import { useApp } from '../app-context'
import type { Overview, PageKey } from '../types'
import { EmptyState, LoadingBlock, MiniProgress, Money, ProviderCard } from '../components/ui'

const CATEGORY_ROUTE: Record<string, PageKey> = {
  '农机作业': 'services',
  '植保防疫': 'services',
  '农技问诊': 'consult',
  '检测认证': 'services',
  '农险服务': 'insurance',
  '培训服务': 'training',
  '土地流转': 'resources',
  '劳务用工': 'resources',
  '法律咨询': 'resources',
  '粮食烘干': 'services',
}

/** 待办的落点由后端 link 决定（order:12 / policy / claim / complaint），不再按数组下标猜。 */
function openTodo(navigate: ReturnType<typeof useApp>['navigate'], link: string): void {
  if (link.startsWith('order:')) {
    navigate('order-detail', Number(link.slice(6)))
    return
  }
  if (link === 'policy') navigate('policies')
  else if (link === 'claim') navigate('insurance')
  else if (link === 'complaint') navigate('complaints')
  else navigate('orders')
}

export function HomePage(): JSX.Element {
  const { navigate, openServices } = useApp()
  const [overview, setOverview] = useState<Overview | null>(null)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [segment, setSegment] = useState('当前农事')

  useEffect(() => {
    serviceApi.overview()
      .then(setOverview)
      .catch((reason: Error) => setError(reason.message))
  }, [])

  if (!overview && !error) {
    return <LoadingBlock rows={4} />
  }

  if (error || !overview) {
    return (
      <EmptyState
        icon="🛠️"
        title="服务数据暂时未加载"
        description={error}
        action={<Button type="primary" onClick={() => window.location.reload()}>重新加载</Button>}
      />
    )
  }

  return (
    <div className="home-page page-stack">
      <section className="service-hero">
        <div className="hero-copy">
          <span className="hero-kicker"><i /> 农业生产全周期服务</span>
          <h1>把专业服务，送到田间地头</h1>
          <p>农机作业、农技问诊、农业保险、检测认证与产业资源一站对接。平台担保交易，服务过程可追踪。</p>
          <form
            className="hero-search"
            onSubmit={(event) => {
              event.preventDefault()
              openServices(keyword.trim())
            }}
          >
            <SearchOutlined />
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)}
              placeholder="如：水稻机收、植保飞防、土壤检测…" />
            <button type="submit">找服务</button>
          </form>
          <div className="hero-actions">
            <Button type="primary" icon={<RobotOutlined />} onClick={() => navigate('ai-diagnose')}>AI 快速问诊</Button>
            <Button icon={<FileTextOutlined />} onClick={() => navigate('demand')}>描述需求，智能找服务</Button>
          </div>
        </div>
        <div className="hero-panel">
          <div className="hero-panel-head">
            <span><CalendarOutlined /></span>
            <div><small>本主体服务概览</small><b>{overview.todos.length ? `${overview.todos.length} 件事务待跟进` : '暂无在途事务'}</b></div>
            <span className="live-dot">按主体</span>
          </div>
          <div className="weather-line">
            <strong>{overview.stats.myOrders}</strong>
            <span>累计服务订单<br />已完成 {overview.stats.completedOrders} 单</span>
          </div>
          <div className="hero-task">
            <CheckCircleFilled />
            <span>
              <b>未读消息 {overview.stats.unreadMessages} 条</b>
              <small>订单动态、审核结论与理赔进度都会写到这里</small>
            </span>
          </div>
          <button type="button" onClick={() => navigate('orders')}>查看我的订单 <ArrowRightOutlined /></button>
        </div>
      </section>

      <section className="overview-stats">
        <div className="overview-stat">
          <span className="stat-icon green"><SafetyCertificateOutlined /></span>
          <div><small>认证服务商</small><b>{overview.stats.serviceProviders}<em>家</em></b></div>
        </div>
        <div className="overview-stat">
          <span className="stat-icon blue"><ThunderboltOutlined /></span>
          <div><small>我已完成的服务</small><b>{overview.stats.completedOrders}<em>单</em></b></div>
        </div>
        <div className="overview-stat">
          <span className="stat-icon amber"><CheckCircleFilled /></span>
          <div><small>我的评价均分</small><b>{overview.stats.satisfaction}<em>分</em></b></div>
        </div>
        <div className="overview-stat">
          <span className="stat-icon tech"><ClockCircleOutlined /></span>
          <div><small>我的订单担保金额</small><b>{Math.round(overview.stats.protectedAmount / 1000)}<em>千元</em></b></div>
        </div>
      </section>

      <section className="surface-card category-section">
        <div className="section-heading">
          <div><span className="section-kicker">SERVICE CATALOG</span><h2>按生产需要找服务</h2></div>
          <button type="button" onClick={() => navigate('services')}>全部服务 <ArrowRightOutlined /></button>
        </div>
        <div className="category-grid">
          {overview.categories.map((category, index) => (
            <button
              type="button"
              key={category.name}
              className={`category-item tone-${index % 5}`}
              onClick={() => {
                const target = CATEGORY_ROUTE[category.name] ?? 'services'
                if (target === 'services') openServices(undefined, category.name)
                else navigate(target)
              }}
            >
              <span>{category.icon}</span>
              <b>{category.name}</b>
              <small>{category.count} 项服务</small>
            </button>
          ))}
        </div>
      </section>

      <div className="home-main-grid">
        <div className="home-left">
          <section className="surface-card">
            <div className="section-heading compact">
              <div><span className="section-kicker">SEASONAL SERVICES</span><h2>农事日历 · 当季推荐</h2></div>
              <div className="segment-control">
                {['当前农事', '未来 7 天'].map((item) => (
                  <button type="button" key={item} className={segment === item ? 'on' : ''} onClick={() => setSegment(item)}>
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <div className="season-grid">
              {overview.featuredProviders.slice(0, 3).map((provider) => <ProviderCard key={provider.id} provider={provider} />)}
            </div>
          </section>

          <section className="surface-card">
            <div className="section-heading compact">
              <div><span className="section-kicker">VERIFIED PROVIDERS</span><h2>附近优质服务商</h2></div>
              <button type="button" onClick={() => navigate('services')}>地图找服务 <ArrowRightOutlined /></button>
            </div>
            <div className="nearby-list">
              {overview.featuredProviders.map((provider, index) => (
                <button type="button" className="nearby-row" key={provider.id} onClick={() => navigate('provider', provider.id)}>
                  <span className={`nearby-avatar tone-${index}`}>{provider.categoryIcon}</span>
                  <span className="nearby-copy">
                    <b>{provider.name}<em>{provider.badge}</em></b>
                    <small>{provider.region} · {provider.rating} 分 · {provider.distanceKm}km</small>
                  </span>
                  <span className="nearby-price"><Money value={provider.price} /><small>{provider.unit}</small></span>
                  <span className="nearby-arrow"><ArrowRightOutlined /></span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <aside className="home-aside">
          <section className="surface-card todo-card">
            <div className="section-heading compact">
              <div><span className="section-kicker">TO-DO</span><h2>我的服务待办</h2></div>
              <button type="button" onClick={() => navigate('orders')}>全部</button>
            </div>
            {overview.todos.length === 0 ? (
              <p className="muted-copy">当前没有在途的订单、申报、理赔或投诉。</p>
            ) : overview.todos.map((todo, index) => (
              <button type="button" className="todo-item" key={`${todo.title}-${index}`} onClick={() => openTodo(navigate, todo.link)}>
                <span className={`todo-dot tone-${index}`} />
                <span><b>{todo.title}</b><small>{todo.content}</small><MiniProgress value={Number(todo.progress.replace('%', ''))} /></span>
                <em>{todo.progress}</em>
              </button>
            ))}
          </section>

          <section className="ai-helper-card">
            <span className="ai-orb"><RobotOutlined /></span>
            <span className="ai-helper-label">✦ 农事问题初判</span>
            <h3>说不清问题？<br />用文字描述就行。</h3>
            <p>按关键词比对平台内置的常见病虫害处置规则，给出风险等级与候选病因；本版未接入语音与拍照识别。</p>
            <button type="button" onClick={() => navigate('ai-diagnose')}>开始描述问题 <ArrowRightOutlined /></button>
          </section>

          <section className="surface-card policy-mini">
            <div className="section-heading compact">
              <div><span className="section-kicker">POLICY MATCH</span><h2>惠农政策速递</h2></div>
              <button type="button" onClick={() => navigate('policies')}>更多</button>
            </div>
            {overview.policies.map((policy) => (
              <button type="button" key={policy.id} onClick={() => navigate('policies')}>
                <span className="policy-level">{policy.level}</span>
                <b>{policy.title}</b>
                <small>{policy.amountText} · {policy.deadline} 截止</small>
              </button>
            ))}
          </section>
        </aside>
      </div>
    </div>
  )
}
