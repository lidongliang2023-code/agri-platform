import { useEffect, useState } from 'react'
import {
  dayLabel,
  formatCount,
  infoPublicApi,
  type Article,
  type Channel,
} from './infoApi'
import './info.css'

/**
 * 产业资讯列表：频道筛选 + 关键词搜索 + 分页。
 *
 * <p>原本是独立的 `#/info/news` 页面，和资讯首页各自维护一套文章列表 ——
 * 两页都在展示文章，用户还得多点一次才能看到筛选和分页。合并后它作为首页的一个区块存在。</p>
 */
export function NewsFeed({ pageSize = 8 }: { pageSize?: number }): JSX.Element {
  const [channels, setChannels] = useState<Channel[]>([])
  const [items, setItems] = useState<Article[]>([])
  const [channel, setChannel] = useState('')
  const [keyword, setKeyword] = useState('')
  const [draft, setDraft] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    infoPublicApi.channels().then(setChannels).catch(() => setChannels([]))
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    infoPublicApi.articles({
      channel: channel || undefined,
      keyword: keyword || undefined,
      page,
      size: pageSize,
    })
      .then((data) => {
        if (cancelled) return
        setItems(data.items ?? [])
        setTotal(data.total ?? 0)
      })
      .catch((reason: Error) => { if (!cancelled) setError(reason.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [channel, keyword, page, pageSize])

  const pages = Math.max(1, Math.ceil(total / pageSize))
  const search = (): void => { setKeyword(draft.trim()); setPage(1) }

  return (
    <>
      <div className="info-section-head">
        <h2>
          产业资讯 <small>政策 · 市场 · 技术 · 国际</small>
        </h2>
        <span className="small gray">共 {total} 条</span>
      </div>

      <div className="info-filter" style={{ marginBottom: 14 }}>
        <input
          value={draft}
          placeholder="搜标题、摘要"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') search() }}
          style={{ flex: 1, minWidth: 180 }}
        />
        <button type="button" className="info-chip on" onClick={search}>搜索</button>
        {keyword && (
          <button
            type="button"
            className="info-chip"
            onClick={() => { setDraft(''); setKeyword(''); setPage(1) }}
          >
            清除「{keyword}」
          </button>
        )}
      </div>

      <div className="info-chips" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={`info-chip${channel === '' ? ' on' : ''}`}
          onClick={() => { setChannel(''); setPage(1) }}
        >
          全部
        </button>
        {channels.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`info-chip${channel === item.name ? ' on' : ''}`}
            onClick={() => { setChannel(item.name); setPage(1) }}
          >
            {item.icon} {item.name}
          </button>
        ))}
      </div>

      {error && <div className="info-error">{error}</div>}
      {loading && <div className="info-loading">正在加载资讯…</div>}
      {!loading && items.length === 0 && !error && <div className="info-empty">该条件下暂无资讯</div>}

      <div className="info-card">
        {items.map((item) => (
          <a className="info-news-row" href={`#/info/news/${item.id}`} key={item.id} style={{ display: 'flex' }}>
            <div className="info-news-ico">{item.coverIcon ?? '📄'}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="info-news-title">{item.title}</div>
              {item.summary && <div className="info-news-sub" style={{ marginTop: 4 }}>{item.summary}</div>}
              <div className="info-news-sub">
                {item.channel}
                {item.author ? ` · ${item.author}` : ''}
                {' · '}
                {dayLabel(item.publishedAt ?? item.createdAt)}
                {' · 阅读 '}
                {formatCount(item.readCount)}
              </div>
            </div>
          </a>
        ))}
      </div>

      {pages > 1 && (
        <div className="info-chips" style={{ justifyContent: 'center', marginTop: 20 }}>
          <button type="button" className="info-chip" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            上一页
          </button>
          <span className="small gray" style={{ alignSelf: 'center' }}>{page} / {pages}</span>
          <button type="button" className="info-chip" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            下一页
          </button>
        </div>
      )}
    </>
  )
}
