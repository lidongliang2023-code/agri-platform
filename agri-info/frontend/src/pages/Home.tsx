import { useEffect, useState } from 'react'
import { ArrowRightOutlined, FireOutlined, RobotOutlined, SearchOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { infoApi } from '../api'
import { useApp } from '../app-context'
import type { Overview } from '../types'
import { ArticleCard, ChangePct, ErrorBlock, LoadingBlock, Sparkline } from '../components/ui'

export function HomePage(): JSX.Element {
  const { navigate, openSearch } = useApp()
  const [overview, setOverview] = useState<Overview | null>(null)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [tab, setTab] = useState('为你推荐')

  useEffect(() => {
    infoApi.overview().then(setOverview).catch((reason: Error) => setError(reason.message))
  }, [])

  if (!overview && !error) return <LoadingBlock rows={4} />
  if (error || !overview) return <ErrorBlock message={error} />

  const tabs = ['为你推荐', '视频与直播', '政策法规', '市场动态']
  const feed = overview.feed.filter((item) => {
    if (tab === '视频与直播') return item.contentType === '短视频' || item.contentType === '直播'
    if (tab === '政策法规') return item.channel === '政策法规'
    if (tab === '市场动态') return item.channel === '市场动态'
    return true
  })

  return (
    <div className="page-stack">
      <section className="info-hero">
        <div>
          <span className="hero-kicker"><i /> 行情 · 资讯 · 供需 · 农技</span>
          <h1>您好，{overview.greeting.owner}，今天的信息都在这里</h1>
          <p>{overview.greeting.headline}</p>
          <form
            className="hero-search"
            onSubmit={(event) => {
              event.preventDefault()
              openSearch(keyword.trim())
            }}
          >
            <div style={{ position: 'relative', flex: 1 }}>
              <SearchOutlined style={{ position: 'absolute', left: 13, top: 12, color: '#93a198' }} />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索品种行情、资讯、农技知识或供需信息…"
                style={{ paddingLeft: 34, width: '100%' }}
              />
            </div>
            <button type="submit">搜索</button>
          </form>
          <div className="row" style={{ marginTop: 14 }}>
            <Button type="primary" icon={<RobotOutlined />} onClick={() => navigate('ai-qa')}>问 AI 农技助手</Button>
            <Button icon={<FireOutlined />} onClick={() => navigate('sd')}>进入供需大厅</Button>
          </div>
        </div>
        <div className="hero-stats">
          <div className="hero-stat"><b>{overview.stats.monitoredQuotes}</b><span>监测品种</span></div>
          <div className="hero-stat"><b>{overview.stats.unreadAlerts}</b><span>未读预警</span></div>
          <div className="hero-stat"><b>{overview.stats.todayArticles}</b><span>在库资讯</span></div>
          <div className="hero-stat"><b>{overview.stats.onlineSupplyDemand}</b><span>在线供需</span></div>
        </div>
      </section>

      <div className="ticker">
        <span className="ticker-label">今日快讯</span>
        <span className="ticker-body">
          {[...overview.ticker, ...overview.ticker].map((line, index) => (
            <span key={`${line}-${index}`}>{line}</span>
          ))}
        </span>
      </div>

      <div className="grid-main-aside">
        <div className="stack">
          <section className="surface-card">
            <div className="row between" style={{ marginBottom: 12 }}>
              <div className="chip-row">
                {tabs.map((item) => (
                  <button type="button" key={item} className={`chip${tab === item ? ' on' : ''}`} onClick={() => setTab(item)}>
                    {item}
                  </button>
                ))}
              </div>
              <button type="button" className="link-button" onClick={() => navigate('news')}>全部资讯 <ArrowRightOutlined /></button>
            </div>
            <div className="stack">
              {feed.map((article) => <ArticleCard key={article.id} article={article} />)}
              {feed.length === 0 && <p className="muted small">该分类暂无内容，试试其他标签。</p>}
            </div>
          </section>
        </div>

        <aside className="stack">
          <section className="surface-card">
            <div className="row between" style={{ marginBottom: 8 }}>
              <b style={{ fontSize: 13.5 }}>🔥 热门品种涨跌榜</b>
              <button type="button" className="link-button" onClick={() => navigate('market')}>全部行情</button>
            </div>
            <div className="hot-rank">
              {overview.hotRank.map((item, index) => (
                <button type="button" key={item.quoteId} onClick={() => navigate('market-detail', item.quoteId)}>
                  <span className="rank-no">{index + 1}</span>
                  <span className="rank-name">{item.icon} {item.name}（{item.origin}）</span>
                  <ChangePct value={Number(item.changePct)} digits={1} />
                </button>
              ))}
            </div>
          </section>

          <section className="ai-card">
            <div className="ai-card-head"><span>✦</span>{overview.aiBrief.title}</div>
            <div className="ai-card-body">
              {overview.aiBrief.lines.map((line) => <div key={line}>· {line}</div>)}
            </div>
            <div className="ai-confidence">
              <span>结论置信度</span>
              <span className="confidence-bar"><i style={{ width: `${overview.aiBrief.confidence}%` }} /></span>
              <b>{overview.aiBrief.confidence}%</b>
            </div>
            <div className="ai-card-actions">
              <Button size="small" type="primary" ghost onClick={() => navigate('forecast')}>查看完整预测</Button>
              <Button size="small" onClick={() => navigate('news-detail', overview.aiBrief.articleId)}>阅读简报全文</Button>
            </div>
          </section>

          {overview.live && (
            <section className="surface-card live-card">
              <div className="row between" style={{ marginBottom: 8 }}>
                <b style={{ fontSize: 13.5 }}>🔴 直播课堂</b>
                <span className="live-flag">● 直播中 · {overview.live.learners.toLocaleString('zh-CN')} 人在看</span>
              </div>
              <b style={{ fontSize: 13 }}>{overview.live.title}</b>
              <p className="small muted" style={{ marginTop: 6 }}>{overview.live.liveAt} · {overview.live.teacher}</p>
              <Button size="small" style={{ marginTop: 10 }} onClick={() => navigate('training')}>进入直播间</Button>
            </section>
          )}

          <section className="surface-card">
            <div className="row between" style={{ marginBottom: 4 }}>
              <b style={{ fontSize: 13.5 }}>我的待办</b>
            </div>
            {overview.todos.map((todo, index) => (
              <button type="button" className="todo-item" key={todo.title} onClick={() => navigate(todo.page)}>
                <span className={`todo-dot tone-${index}`} />
                <span><b>{todo.title}</b><small>{todo.content}</small></span>
                <em>{todo.tag}</em>
              </button>
            ))}
          </section>

          <section className="surface-card">
            <div className="row between" style={{ marginBottom: 8 }}>
              <b style={{ fontSize: 13.5 }}>资讯频道</b>
              <button type="button" className="link-button" onClick={() => navigate('news')}>更多</button>
            </div>
            <div className="tag-row">
              {overview.channels.map((channel) => (
                <button
                  type="button"
                  key={channel.id}
                  className="chip"
                  onClick={() => navigate('news', undefined, { channel: channel.name })}
                >
                  {channel.icon} {channel.name}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 10 }}>
              <Sparkline points={overview.hotRank.map((item) => Number(item.price))} width={260} height={36} />
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
