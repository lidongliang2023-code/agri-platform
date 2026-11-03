import { useEffect, useState } from 'react'
import {
  infoPublicApi,
  money,
  signed,
  trendClass,
  type Article,
  type PriceIndex,
  type Quote,
} from './infoApi'
import { usePageMeta } from '../../utils'
import './info.css'

export function InfoMarket({ id }: { id?: number }): JSX.Element {
  return id ? <MarketDetail id={id} /> : <MarketList />
}

function MarketList(): JSX.Element {

  const [items, setItems] = useState<Quote[]>([])
  const [indices, setIndices] = useState<PriceIndex[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [category, setCategory] = useState('')
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  usePageMeta('农产品行情', '产地价、批发价与价格指数，覆盖核心农产品品种。')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    infoPublicApi.markets({ category: category || undefined, keyword: keyword || undefined })
      .then((data) => {
        if (cancelled) return
        setItems(data.quotes ?? [])
        setCategories(data.categories ?? [])
      })
      .catch((reason: Error) => { if (!cancelled) setError(reason.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [category, keyword])

  useEffect(() => {
    infoPublicApi.indices().then(setIndices).catch(() => setIndices([]))
  }, [])

  return (
    <div className="info-page">
      <div className="info-section-head">
        <h2>农产品行情 <small>产地价 · 批发价 · 价格指数</small></h2>
        <span className="small gray">{items.length} 个品种</span>
      </div>

      {indices.length > 0 && (
        <div className="info-grid-4" style={{ marginBottom: 20 }}>
          {indices.slice(0, 4).map((index) => (
            <div className="info-card" key={index.id}>
              <div className="small gray">{index.name}</div>
              <div style={{ marginTop: 6, fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {money(index.value)}
              </div>
              <div className={trendClass(index.changePct)} style={{ fontSize: 12.5 }}>{signed(index.changePct)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="info-filter">
        <label>品类</label>
        <div className="info-chips">
          <button type="button" className={`info-chip${category === '' ? ' on' : ''}`} onClick={() => setCategory('')}>全部</button>
          {categories.map((item) => (
            <button
              type="button"
              key={item}
              className={`info-chip${category === item ? ' on' : ''}`}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <input
          value={keyword}
          placeholder="搜品种"
          onChange={(event) => setKeyword(event.target.value)}
          style={{ marginLeft: 'auto', width: 180 }}
        />
      </div>

      {error && <div className="info-error">{error}</div>}
      {loading && <div className="info-loading">正在加载行情…</div>}
      {!loading && items.length === 0 && !error && <div className="info-empty">暂无行情数据</div>}

      {items.length > 0 && (
        <div className="info-card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="info-table">
            <thead>
              <tr>
                <th>品种</th>
                <th>品类</th>
                <th>市场 / 产地</th>
                <th className="num">价格</th>
                <th className="num">涨跌</th>
                <th>更新时间</th>
              </tr>
            </thead>
            <tbody>
              {items.map((quote) => (
                <tr key={quote.id}>
                  <td>
                    <a href={`#/info/market/${quote.id}`} style={{ fontWeight: 500 }}>{quote.name}</a>
                    {quote.spec && <div className="small gray">{quote.spec}</div>}
                  </td>
                  <td>{quote.category ?? '—'}</td>
                  <td>{quote.market ?? quote.origin ?? '—'}</td>
                  <td className="num" style={{ fontWeight: 600, color: 'var(--text)' }}>
                    {money(quote.price)} <span className="small gray">{quote.priceUnit}</span>
                  </td>
                  <td className={`num ${trendClass(quote.changePct)}`}>{signed(quote.changePct)}</td>
                  <td className="small gray">{quote.updatedAt ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function MarketDetail({ id }: { id: number }): JSX.Element {

  const [quote, setQuote] = useState<(Quote & { relatedArticles?: Article[] }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  usePageMeta(quote ? `${quote.name}行情` : '行情详情', quote ? `${quote.market ?? quote.origin ?? ''}最新报价与走势` : undefined)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    infoPublicApi.market(id)
      .then((data) => { if (!cancelled) setQuote(data) })
      .catch((reason: Error) => { if (!cancelled) setError(reason.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  if (loading) return <div className="info-page"><div className="info-loading">正在加载…</div></div>
  if (error || !quote) {
    return (
      <div className="info-page">
        <a className="info-back" href="#/info/market">‹ 返回行情</a>
        <div className="info-error">{error || '行情不存在'}</div>
      </div>
    )
  }

  const series = quote.trend ?? []
  const max = Math.max(...series, 1)
  const min = Math.min(...series, 0)

  return (
    <div className="info-page">
      <a className="info-back" href="#/info/market">‹ 返回行情</a>

      <div className="info-card">
        <div className="info-section-head">
          <h2>{quote.name} <small>{quote.market ?? quote.origin}</small></h2>
          <span className="small gray">{quote.updatedAt}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <span style={{ fontSize: 34, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{money(quote.price)}</span>
          <span className="small gray">{quote.priceUnit}</span>
          <span className={trendClass(quote.changePct)} style={{ fontSize: 15, fontWeight: 600 }}>
            {signed(quote.changePct)}
          </span>
        </div>

        {series.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120, marginTop: 22 }}>
            {series.map((value, index) => {
              const height = max === min ? 50 : Math.round(((value - min) / (max - min)) * 90) + 10
              return (
                <div
                  key={index}
                  title={money(value)}
                  style={{
                    flex: 1,
                    height: `${height}%`,
                    borderRadius: '4px 4px 0 0',
                    background: index === series.length - 1 ? 'var(--green-600)' : 'var(--green-300)',
                  }}
                />
              )
            })}
          </div>
        )}
        {series.length > 1 && <div className="small gray" style={{ marginTop: 8 }}>近 {series.length} 期走势</div>}
      </div>

      {quote.relatedArticles && quote.relatedArticles.length > 0 && (
        <section className="info-section">
          <div className="info-section-head"><h2>相关资讯</h2></div>
          <div className="info-card">
            {quote.relatedArticles.slice(0, 6).map((item) => (
              <a className="info-news-row" href={`#/info/news/${item.id}`} key={item.id} style={{ display: 'flex' }}>
                <div className="info-news-ico">{item.coverIcon ?? '📄'}</div>
                <div>
                  <div className="info-news-title">{item.title}</div>
                  <div className="info-news-sub">{item.channel} · {item.author ?? '平台'}</div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
