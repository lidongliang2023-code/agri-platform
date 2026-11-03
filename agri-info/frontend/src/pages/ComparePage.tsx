import { useEffect, useState } from 'react'
import { Button, message } from 'antd'
import { infoApi } from '../api'
import { useApp } from '../app-context'
import type { MarketData, Quote } from '../types'
import { ChangePct, ErrorBlock, LoadingBlock, PageTitle, Sparkline } from '../components/ui'

const COLORS = ['#12764a', '#17698f', '#ae6b00', '#6b4192', '#b43c3c']

export function ComparePage(): JSX.Element {
  const { navigate } = useApp()
  const [pool, setPool] = useState<Quote[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [items, setItems] = useState<Quote[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    infoApi.markets()
      .then((data: MarketData) => {
        setPool(data.quotes)
        const initial = data.quotes.slice(0, 3).map((quote) => quote.id)
        setSelected(initial)
        return infoApi.compare(initial)
      })
      .then(setItems)
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false))
  }, [])

  const toggle = (id: number): void => {
    const next = selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]
    if (next.length === 0) {
      message.warning('至少选择一个品种')
      return
    }
    if (next.length > 5) {
      message.warning('最多同时比价 5 个品种')
      return
    }
    setSelected(next)
    infoApi.compare(next).then(setItems).catch((reason: Error) => message.error(reason.message))
  }

  if (loading) return <LoadingBlock rows={3} />
  if (error) return <ErrorBlock message={error} />

  const maxLen = Math.max(...items.map((item) => item.normalized?.length ?? 0), 1)

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="COMPARE"
        title="多品种比价"
        description="把不同品种的价格折算为「基期 = 100」的相对走势，避免绝对值差异掩盖涨跌节奏。最多同时比价 5 个品种。"
        actions={<Button onClick={() => navigate('market')}>返回行情中心</Button>}
      />

      <section className="surface-card">
        <div className="small muted" style={{ marginBottom: 10 }}>选择品种（已选 {selected.length} / 5）</div>
        <div className="chip-row">
          {pool.map((quote) => (
            <button
              type="button"
              key={quote.id}
              className={`chip${selected.includes(quote.id) ? ' on' : ''}`}
              onClick={() => toggle(quote.id)}
            >
              {quote.icon} {quote.name}
            </button>
          ))}
        </div>
      </section>

      <div className="grid-main-aside">
        <section className="surface-card">
          <b style={{ fontSize: 14 }}>相对走势（基期 = 100）</b>
          <svg viewBox="0 0 640 260" className="trend-chart" role="img" aria-label="多品种相对走势">
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
              <line key={ratio} x1="40" x2="624" y1={20 + ratio * 200} y2={20 + ratio * 200} className="chart-grid" />
            ))}
            {items.map((quote, index) => {
              const points = quote.normalized ?? []
              if (!points.length) return null
              const min = Math.min(...items.flatMap((item) => item.normalized ?? [100]))
              const max = Math.max(...items.flatMap((item) => item.normalized ?? [100]))
              const span = max - min || 1
              const step = 584 / Math.max(maxLen - 1, 1)
              const path = points
                .map((value, position) => `${position === 0 ? 'M' : 'L'}${40 + position * step},${220 - ((value - min) / span) * 200}`)
                .join(' ')
              return <path key={quote.id} d={path} fill="none" stroke={COLORS[index % COLORS.length]} strokeWidth="2.2" />
            })}
            <text x="40" y="248" className="chart-axis">7 日前</text>
            <text x="600" y="248" className="chart-axis" textAnchor="end">今日</text>
          </svg>
          <div className="tag-row" style={{ marginTop: 10 }}>
            {items.map((quote, index) => (
              <span key={quote.id} className="soft-tag">
                <i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: COLORS[index % COLORS.length] }} />
                {quote.name}
              </span>
            ))}
          </div>
        </section>

        <aside className="stack">
          <section className="surface-card">
            <b style={{ fontSize: 13.5 }}>比价要点</b>
            <div className="kv-list" style={{ marginTop: 10 }}>
              {items.map((quote) => (
                <div className="kv" key={quote.id}>
                  <span>{quote.icon} {quote.name}</span>
                  <b><ChangePct value={Number(quote.changePct)} digits={1} /></b>
                </div>
              ))}
            </div>
            <p className="small muted" style={{ marginTop: 12, lineHeight: 1.7 }}>
              相对走势消除了价格量纲差异：曲线越陡说明该品种近期涨跌节奏越快。若两条曲线出现明显分叉，通常意味着供需基本面出现分化。
            </p>
          </section>
        </aside>
      </div>

      <section className="surface-card">
        <b style={{ fontSize: 14 }}>明细对比</b>
        <div className="table-scroll" style={{ marginTop: 10 }}>
          <table className="data-table clickable">
            <thead>
              <tr>
                <th>品种</th><th>主产区</th><th className="num">最新价</th><th className="num">涨跌幅</th>
                <th className="num">近 7 日</th><th className="num">近 30 日</th><th>7 日走势</th><th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((quote) => (
                <tr key={quote.id} onClick={() => navigate('market-detail', quote.id)}>
                  <td><b>{quote.icon} {quote.name}</b></td>
                  <td>{quote.origin}</td>
                  <td className="num"><b>{Number(quote.price).toFixed(2)}</b></td>
                  <td className="num"><ChangePct value={Number(quote.changePct)} /></td>
                  <td className="num"><ChangePct value={Number(quote.weekPct)} digits={1} /></td>
                  <td className="num"><ChangePct value={Number(quote.monthPct)} digits={1} /></td>
                  <td><Sparkline points={quote.trend} /></td>
                  <td><button type="button" className="link-button" onClick={(event) => { event.stopPropagation(); navigate('market-detail', quote.id) }}>详情</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
