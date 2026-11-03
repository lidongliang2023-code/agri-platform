import { useEffect, useState } from 'react'
import {
  dayLabel,
  formatCount,
  infoPublicApi,
  money,
  signed,
  trendClass,
  type SearchResult,
} from './infoApi'
import { usePageMeta } from '../../utils'
import './info.css'

/** 门户搜索：一次请求聚合资讯、行情、供需、知识、专家、报告。 */
export function InfoSearch({ keyword }: { keyword: string }): JSX.Element {
  usePageMeta(keyword ? `搜索：${keyword}` : '全站搜索', '一次搜索资讯、行情、供需、农技知识、专家与报告。')

  const [result, setResult] = useState<SearchResult | null>(null)
  const [value, setValue] = useState(keyword)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { setValue(keyword) }, [keyword])

  useEffect(() => {
    if (!keyword) { setLoading(false); setResult(null); return }
    let cancelled = false
    setLoading(true)
    setError('')
    infoPublicApi.search(keyword)
      .then((data) => { if (!cancelled) setResult(data) })
      .catch((reason: Error) => { if (!cancelled) setError(reason.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [keyword])

  const submit = (): void => {
    const trimmed = value.trim()
    window.location.hash = trimmed ? `/info/search?keyword=${encodeURIComponent(trimmed)}` : '/info/search'
  }

  const articles = result?.articles ?? []
  const quotes = result?.quotes ?? []
  const supplyDemands = result?.supplyDemands ?? []
  const knowledge = result?.knowledge ?? []
  const experts = result?.experts ?? []
  const reports = result?.reports ?? []
  const total = articles.length + quotes.length + supplyDemands.length + knowledge.length + experts.length + reports.length

  return (
    <div className="info-page">
      <div className="info-hero" style={{ padding: '26px 32px' }}>
        <h1 style={{ fontSize: 22 }}>全站搜索</h1>
        <p>资讯 · 行情 · 供需 · 农技知识 · 专家 · 报告，一次搜完。</p>
        <div className="info-hero-search" style={{ marginTop: 18 }}>
          <input
            value={value}
            placeholder="输入品种、病害、政策关键词…"
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') submit() }}
          />
          <button type="button" onClick={submit}>搜索</button>
        </div>
      </div>

      {error && <div className="info-error" style={{ marginTop: 18 }}>{error}</div>}
      {loading && <div className="info-loading">正在搜索…</div>}

      {!loading && keyword && total === 0 && !error && (
        <div className="info-empty">没有找到与「{keyword}」相关的内容</div>
      )}

      {!loading && total > 0 && (
        <>
          <div className="info-section-head" style={{ marginTop: 22 }}>
            <h2>搜索结果 <small>共 {total} 条</small></h2>
            <span className="small gray">关键词：{keyword}</span>
          </div>

          {articles.length > 0 && (
            <section className="info-section">
              <div className="info-section-head"><h2>资讯 <small>{articles.length}</small></h2></div>
              <div className="info-card">
                {articles.slice(0, 5).map((item) => (
                  <a className="info-news-row" href={`#/info/news/${item.id}`} key={item.id} style={{ display: 'flex' }}>
                    <div className="info-news-ico">{item.coverIcon ?? '📄'}</div>
                    <div>
                      <div className="info-news-title">{item.title}</div>
                      <div className="info-news-sub">{item.channel} · {dayLabel(item.publishedAt ?? item.createdAt)}</div>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          )}

          {quotes.length > 0 && (
            <section className="info-section">
              <div className="info-section-head"><h2>行情 <small>{quotes.length}</small></h2></div>
              <div className="info-card" style={{ padding: 0, overflowX: 'auto' }}>
                <table className="info-table">
                  <thead>
                    <tr><th>品种</th><th>市场</th><th className="num">价格</th><th className="num">涨跌</th></tr>
                  </thead>
                  <tbody>
                    {quotes.slice(0, 6).map((quote) => (
                      <tr key={quote.id}>
                        <td><a href={`#/info/market/${quote.id}`}>{quote.name}</a></td>
                        <td>{quote.market ?? quote.origin}</td>
                        <td className="num">{money(quote.price)} {quote.priceUnit}</td>
                        <td className={`num ${trendClass(quote.changePct)}`}>{signed(quote.changePct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {supplyDemands.length > 0 && (
            <section className="info-section">
              <div className="info-section-head"><h2>供需 <small>{supplyDemands.length}</small></h2></div>
              <div className="info-card">
                {supplyDemands.slice(0, 6).map((item) => (
                  <a
                    className="info-sd-row"
                    href={`#/info/supply-demand/${item.id}?type=${item.sdType}`}
                    key={item.id}
                    style={{ display: 'grid' }}
                  >
                    <div className="info-sd-title">{item.title}<span>{item.origin}</span></div>
                    <div className="info-sd-qty">{item.quantity}</div>
                    <div className="info-sd-price">{money(item.price)} {item.priceUnit}</div>
                  </a>
                ))}
              </div>
            </section>
          )}

          {knowledge.length > 0 && (
            <section className="info-section">
              <div className="info-section-head"><h2>农技知识 <small>{knowledge.length}</small></h2></div>
              <div className="info-card">
                {knowledge.slice(0, 5).map((item) => (
                  <div className="info-news-row" key={item.id}>
                    <div className="info-news-ico">🌱</div>
                    <div>
                      <div className="info-news-title">{item.title}</div>
                      <div className="info-news-sub">{item.category} · {item.crop} · 阅读 {formatCount(item.viewCount)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {(experts.length > 0 || reports.length > 0) && (
            <div className="info-grid-2" style={{ marginTop: 22 }}>
              {experts.length > 0 && (
                <div className="info-card">
                  <div className="info-section-head"><h2 style={{ fontSize: 14 }}>专家 <small>{experts.length}</small></h2></div>
                  {experts.slice(0, 4).map((expert) => (
                    <div className="info-news-row" key={expert.id}>
                      <div className="info-news-ico">{expert.avatarText ?? '👨‍🌾'}</div>
                      <div>
                        <div className="info-news-title">{expert.name}</div>
                        <div className="info-news-sub">{expert.title ?? expert.field} · {expert.orgName}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {reports.length > 0 && (
                <div className="info-card">
                  <div className="info-section-head"><h2 style={{ fontSize: 14 }}>报告 <small>{reports.length}</small></h2></div>
                  {reports.slice(0, 4).map((report) => (
                    <div className="info-news-row" key={report.id}>
                      <div className="info-news-ico">{report.coverIcon ?? '📊'}</div>
                      <div>
                        <div className="info-news-title">{report.title}</div>
                        <div className="info-news-sub">{report.category} · {report.publishDate}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
