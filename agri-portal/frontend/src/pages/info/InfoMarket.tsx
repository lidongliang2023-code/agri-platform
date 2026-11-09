import { PortalPageHero } from '../../components/PortalPageHero'
import { useEffect, useMemo, useState } from 'react'
import { infoPublicApi, money, signed, trendClass, type PriceIndex, type Quote } from './infoApi'
import { usePageMeta } from '../../utils'
import './info.css'
import './market.css'

type MarketData = Awaited<ReturnType<typeof infoPublicApi.markets>>
type Detail = Awaited<ReturnType<typeof infoPublicApi.market>>
type Sort = 'updated' | 'up' | 'down' | 'week' | 'month'
const WATCH_KEY = 'portal-market-watch-v1'
const valid = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const pct = (n?: number) => valid(n) ? signed(n) : '—'
const amount = (n?: number) => valid(n) ? money(n) : '—'
function timestamp(value?: string): number {
  if (!value) return NaN
  const parsed = value.replace(' ', 'T')
  return Date.parse(/(?:Z|[+-]\d\d:\d\d)$/.test(parsed) ? parsed : `${parsed}+08:00`)
}
function freshness(value?: string): string {
  const time = timestamp(value)
  if (!Number.isFinite(time)) return '时间未提供'
  const age = Date.now() - time
  if (age < 0) return '时间待核验'
  return age > 72 * 3600000 ? '超过72小时' : age > 24 * 3600000 ? '超过24小时' : '24小时内'
}
const comparable = (a: Quote, b: Quote) => Boolean(a.name && a.spec && a.priceUnit) && a.name === b.name && a.category === b.category && a.spec === b.spec && a.priceUnit === b.priceUnit
const tradeLink = (name: string, purchase = false) => `#/hall?q=${encodeURIComponent(name)}${purchase ? '&tab=purchase' : ''}`
const unique = (items: Quote[], field: 'category' | 'market' | 'origin' | 'source') => [...new Set(items.map(q => q[field]).filter((v): v is string => Boolean(v)))].sort((a, b) => a.localeCompare(b, 'zh-CN'))
function readWatch(): number[] {
  try { const data: unknown = JSON.parse(localStorage.getItem(WATCH_KEY) || '[]'); return Array.isArray(data) ? data.filter(valid) : [] } catch { return [] }
}
function downloadQuotes(items: Quote[]) {
  const cell = (value: unknown) => {
    let text = String(value ?? '')
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`
    return `"${text.replace(/"/g, '""')}"`
  }
  const rows = [['品种', '品类', '规格', '产地', '市场', '报价', '单位', '涨跌幅(%)', '周涨跌(%)', '月涨跌(%)', '来源', '采集时间', '数据时效'], ...items.map(q => [q.name, q.category, q.spec, q.origin, q.market, q.price, q.priceUnit, q.changePct, q.weekPct, q.monthPct, q.source, q.updatedAt, freshness(q.updatedAt)])]
  const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a'); a.href = url; a.download = '价格行情_筛选结果.csv'; a.click(); URL.revokeObjectURL(url)
}
function Sparkline({ values, label }: { values: number[]; label: string }): JSX.Element {
  const points = values.filter(valid)
  if (points.length < 2) return <div className="market-chart-empty">暂无可展示的走势序列</div>
  const low = Math.min(...points), high = Math.max(...points), span = high - low || 1
  const path = points.map((v, i) => `${24 + i / (points.length - 1) * 552},${140 - (v - low) / span * 112}`).join(' ')
  return <svg className="market-chart" viewBox="0 0 600 165" role="img" aria-label={`${label}，${points.length}期，最低${amount(low)}，最高${amount(high)}`}>
    {[28, 84, 140].map(y => <line key={y} x1="24" y1={y} x2="576" y2={y} stroke="var(--line)" strokeDasharray="4 5" />)}
    <polyline points={path} fill="none" stroke="var(--green-600)" strokeWidth="3" strokeLinejoin="round" />
    {points.map((v, i) => <circle key={i} cx={24 + i / (points.length - 1) * 552} cy={140 - (v - low) / span * 112} r="3" fill="var(--green-600)"><title>第{i + 1}期：{amount(v)}</title></circle>)}
    <text x="24" y="161" fill="currentColor" fontSize="11">首期 {amount(points[0])}</text><text x="576" y="161" textAnchor="end" fill="currentColor" fontSize="11">末期 {amount(points[points.length - 1])}</text>
  </svg>
}

export function InfoMarket({ id }: { id?: number }): JSX.Element { return id ? <MarketDetail key={id} id={id} /> : <MarketList /> }

function MarketList(): JSX.Element {
  const [data, setData] = useState<MarketData>({})
  const [indices, setIndices] = useState<PriceIndex[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number>()
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [indexError, setIndexError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [category, setCategory] = useState(''), [keyword, setKeyword] = useState(''), [market, setMarket] = useState(''), [origin, setOrigin] = useState(''), [source, setSource] = useState('')
  const [direction, setDirection] = useState(''), [fresh, setFresh] = useState(false), [watchOnly, setWatchOnly] = useState(false)
  const [watch, setWatch] = useState<number[]>(readWatch), [selected, setSelected] = useState<number[]>([])
  const [sort, setSort] = useState<Sort>('updated'), [page, setPage] = useState(1), [notice, setNotice] = useState('')
  usePageMeta('价格指数 · 行业交易大数据', '农产品价格指数、现货行情、同口径比价与交易决策服务。')
  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(''); setIndexError('')
    Promise.allSettled([infoPublicApi.markets(), infoPublicApi.indices()]).then(([quotes, published]) => {
      if (cancelled) return
      if (quotes.status === 'fulfilled') setData(quotes.value)
      else { setData({}); setError(quotes.reason instanceof Error ? quotes.reason.message : '行情加载失败') }
      if (published.status === 'fulfilled') setIndices(published.value)
      else { setIndices([]); setIndexError('指数服务暂不可用，可刷新重试。') }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [refresh])
  const all = data.quotes ?? []
  const filtered = useMemo(() => {
    const word = keyword.trim().toLowerCase()
    return all.filter(q => (!category || q.category === category) && (!market || q.market === market) && (!origin || q.origin === origin) && (!source || q.source === source)
      && (!word || [q.name, q.code, q.origin, q.market, q.spec].some(v => v?.toLowerCase().includes(word)))
      && (!fresh || freshness(q.updatedAt) === '24小时内') && (!watchOnly || watch.includes(q.id))
      && (!direction || (direction === 'up' ? valid(q.changePct) && q.changePct > 0 : direction === 'down' ? valid(q.changePct) && q.changePct < 0 : direction === 'abnormal' ? q.monitorLevel === 'abnormal' : q.changePct === 0)))
      .sort((a, b) => {
        if (sort === 'updated') return (timestamp(b.updatedAt) || 0) - (timestamp(a.updatedAt) || 0) || a.id - b.id
        const field = sort === 'week' ? 'weekPct' : sort === 'month' ? 'monthPct' : 'changePct'
        const av = a[field], bv = b[field]
        if (!valid(av)) return valid(bv) ? 1 : a.id - b.id
        if (!valid(bv)) return -1
        return (sort === 'down' ? av - bv : bv - av) || a.id - b.id
      })
  }, [all, category, keyword, market, origin, source, fresh, watchOnly, watch, direction, sort])
  useEffect(() => setPage(1), [category, keyword, market, origin, source, fresh, watchOnly, direction, sort, refresh])
  const pageCount = Math.max(1, Math.ceil(filtered.length / 15)), current = Math.min(page, pageCount)
  const visible = filtered.slice((current - 1) * 15, current * 15)
  const compared = all.filter(q => selected.includes(q.id))
  const index = indices.find(i => i.id === selectedIndex) ?? indices[0]
  const latest = all.filter(q => Number.isFinite(timestamp(q.updatedAt))).sort((a, b) => timestamp(b.updatedAt) - timestamp(a.updatedAt))[0]?.updatedAt
  const counts = { up: filtered.filter(q => valid(q.changePct) && q.changePct > 0).length, down: filtered.filter(q => valid(q.changePct) && q.changePct < 0).length, abnormal: filtered.filter(q => q.monitorLevel === 'abnormal').length }
  function toggleWatch(id: number) {
    const next = watch.includes(id) ? watch.filter(v => v !== id) : [...watch, id]
    setWatch(next)
    try { localStorage.setItem(WATCH_KEY, JSON.stringify(next)); setNotice('关注清单已保存在当前浏览器，不会跨设备同步。') } catch { setNotice('浏览器存储不可用，本次关注仅在当前页面有效。') }
  }
  function toggleCompare(q: Quote) {
    if (selected.includes(q.id)) { setSelected(selected.filter(id => id !== q.id)); return }
    if (compared.length >= 4) { setNotice('最多同时对比4条报价。'); return }
    if (!q.spec || !q.priceUnit) { setNotice('该报价缺少规格或单位，暂不参与专业比价。'); return }
    if (compared.length && !comparable(compared[0], q)) { setNotice('请仅选择同品种、同品类、同规格、同单位的报价。清空后可重新选择。'); return }
    setSelected([...selected, q.id]); setNotice('')
  }
  function reset() { setCategory(''); setKeyword(''); setMarket(''); setOrigin(''); setSource(''); setDirection(''); setFresh(false); setWatchOnly(false); setSort('updated'); setPage(1) }
  return <div className="info-page info-market-page portal-channel-page market-workbench">
    <PortalPageHero badge="行业交易大数据 · 价格服务" title="价格指数" description="从行业指数到品种报价，按品类、产地与市场精准发现价格变化，让采购、销售与履约决策有据可依。">
      <div className="portal-page-hero-actions"><button type="button" className="btn portal-page-btn-light" onClick={() => document.getElementById('market-quotes')?.scrollIntoView({ behavior: 'smooth' })}>查询现货行情 ↓</button><a className="btn portal-page-btn-ghost" href="#/hall">进入交易大厅 →</a></div>
    </PortalPageHero>
    <div className="market-toolbar"><span>价格监测 / 指数分析 / 同口径比价</span><button type="button" className="info-chip" disabled={loading} onClick={() => setRefresh(v => v + 1)}>{loading ? '更新中…' : '刷新数据'}</button></div>
    <div className="market-summary" aria-label="当前筛选范围统计">
      <div><span>匹配报价</span><strong>{filtered.length}<small>条</small></strong></div><div><span>上涨 / 下跌</span><strong><b className="up">{counts.up}</b> / <b className="down">{counts.down}</b></strong></div><div><span>监测异常</span><strong>{counts.abnormal}<small>条</small></strong></div><div><span>最新采集时间（北京时间）</span><strong className="market-time">{latest ?? '尚无有效时间'}</strong></div>
    </div>
    <section className="info-section" aria-label="已发布价格指数">
      <div className="info-section-head"><h2>行业价格指数 <small>运营发布口径</small></h2><span className="small gray">指数点位与现货价格分别展示</span></div>
      {indexError && <div className="info-error">{indexError}</div>}
      {!loading && !indexError && !indices.length && <div className="info-empty">暂无已发布指数</div>}
      {!!indices.length && <><div className="market-index-grid">{indices.map(i => <button type="button" key={i.id} className={`market-index-select${index?.id === i.id ? ' active' : ''}`} onClick={() => setSelectedIndex(i.id)} aria-pressed={index?.id === i.id}><span>{i.name}</span><strong>{amount(i.value)}<small>点</small></strong><span className={trendClass(i.changePct)}>{pct(i.changePct)}</span><small>基期：{i.basePeriod || '未披露'}</small></button>)}</div>
      {index && <div className="info-card market-index-detail"><div><h3>{index.name} · 走势序列</h3><p className="small gray">发布于 {index.publishedAt || '未披露'} · {freshness(index.publishedAt)}</p><Sparkline values={index.trend ?? []} label={index.name} /><p className="small gray">按接口原始期序展示；未提供逐期日期，不标注为日线。</p></div><dl className="market-method"><dt>基期</dt><dd>{index.basePeriod || '未披露'}</dd><dt>样本量</dt><dd>{index.sampleCount ?? '未披露'}</dd><dt>编制方法</dt><dd>{index.method || '未披露'}</dd><dt>使用边界</dt><dd>展示已发布指数；当前接口未提供成分权重与逐期明细，暂不据此计算贡献度或成交额加权指数。</dd></dl></div>}</>}
    </section>
    <section className="info-section" id="market-quotes">
      <div className="info-section-head"><h2>现货行情 <small>精准筛选 · 快速比价</small></h2><button className="info-chip" disabled={!filtered.length || loading} onClick={() => downloadQuotes(filtered)}>导出筛选结果</button></div>
      <div className="market-filter-panel">
        <div className="info-chips"><span>品类</span><button className={`info-chip${!category ? ' on' : ''}`} onClick={() => setCategory('')}>全部</button>{unique(all, 'category').map(c => <button key={c} className={`info-chip${category === c ? ' on' : ''}`} onClick={() => setCategory(c)}>{c}</button>)}</div>
        <div className="market-filter-fields"><label>关键词<input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="品种 / 规格 / 产地 / 编码" /></label>
          {([{ title: '交易市场', field: 'market', value: market, change: setMarket }, { title: '产地', field: 'origin', value: origin, change: setOrigin }, { title: '数据来源', field: 'source', value: source, change: setSource }] as const).map(f => <label key={f.field}>{f.title}<select value={f.value} onChange={e => f.change(e.target.value)}><option value="">全部</option>{unique(all, f.field).map(v => <option key={v}>{v}</option>)}</select></label>)}
          <label>价格变化<select value={direction} onChange={e => setDirection(e.target.value)}><option value="">全部变化</option><option value="up">上涨</option><option value="down">下跌</option><option value="flat">持平</option><option value="abnormal">监测异常</option></select></label>
          <label>排序<select value={sort} onChange={e => setSort(e.target.value as Sort)}><option value="updated">最新采集</option><option value="up">涨幅优先</option><option value="down">跌幅优先</option><option value="week">周涨幅优先</option><option value="month">月涨幅优先</option></select></label>
        </div><div className="market-filter-bottom"><label><input type="checkbox" checked={fresh} onChange={e => setFresh(e.target.checked)} />仅24小时内报价</label><label><input type="checkbox" checked={watchOnly} onChange={e => setWatchOnly(e.target.checked)} />本机关注（{all.filter(q => watch.includes(q.id)).length}）</label><button className="info-chip" onClick={reset}>重置筛选</button><span className="small gray">统计、排序和导出均跟随当前筛选</span></div>
      </div>
      {notice && <div className="market-notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="关闭提示">×</button></div>}
      {error && <div className="info-error" role="alert">{error} <button className="info-chip" onClick={() => setRefresh(v => v + 1)}>重试</button></div>}
      {loading ? <div className="info-loading">正在加载报价与指数…</div> : !error && <><div className="market-table-scroll"><table className="info-table market-data-table"><caption className="market-sr-only">农产品现货报价，支持关注、比价及交易查询</caption><thead><tr><th>比价</th><th>品种 / 规格</th><th>产地 / 市场</th><th className="num">报价</th><th className="num">涨跌幅</th><th className="num">周 / 月涨跌</th><th>来源 / 采集时间</th><th>操作</th></tr></thead><tbody>{visible.map(q => <tr key={q.id}><td><input type="checkbox" checked={selected.includes(q.id)} onChange={() => toggleCompare(q)} aria-label={`对比${q.name} ${q.market ?? q.origin ?? ''}`} /></td><td><a href={`#/info/market/${q.id}`}><strong>{q.name}</strong></a><small>{q.category || '品类未披露'} · {q.spec || '规格未披露'}</small></td><td>{q.origin || '产地未披露'}<small>{q.market || '市场未披露'}</small></td><td className="num"><strong>{amount(q.price)}</strong><small>{q.priceUnit || '单位未披露'}</small></td><td className={`num ${trendClass(q.changePct)}`}>{pct(q.changePct)}{q.monitorLevel === 'abnormal' && <small className="market-warning">监测异常</small>}</td><td className="num"><span className={trendClass(q.weekPct)}>{pct(q.weekPct)}</span><small className={trendClass(q.monthPct)}>{pct(q.monthPct)}</small></td><td>{q.source || '来源未披露'}<small>{q.updatedAt || '时间未披露'} · {freshness(q.updatedAt)}</small></td><td><div className="market-row-actions"><button aria-pressed={watch.includes(q.id)} onClick={() => toggleWatch(q.id)}>{watch.includes(q.id) ? '已关注' : '关注'}</button><a href={tradeLink(q.name)}>找货源</a><a href={tradeLink(q.name, true)}>找采购</a></div></td></tr>)}</tbody></table>{!filtered.length && <div className="info-empty">没有匹配报价，请调整筛选或刷新数据。</div>}</div><div className="market-pagination"><span>共 {filtered.length} 条 · 第 {current} / {pageCount} 页</span><button className="info-chip" disabled={current <= 1} onClick={() => setPage(current - 1)}>上一页</button><button className="info-chip" disabled={current >= pageCount} onClick={() => setPage(current + 1)}>下一页</button></div></>}
    </section>
    <section className="info-section" aria-label="同口径报价对比"><div className="info-section-head"><h2>同口径比价 <small>已选 {compared.length} / 4 条</small></h2><button className="info-chip" disabled={!selected.length} onClick={() => setSelected([])}>清空对比</button></div><div className="info-card">
      {compared.length < 2 ? <p className="small gray">在行情列表中勾选至少两条同品种、同规格、同单位报价进行比较。缺少规格或单位的数据暂不参与。</p> : <><div className="market-compare-list">{compared.map(q => <div key={q.id}><a href={`#/info/market/${q.id}`}>{q.name} · {q.market || q.origin}</a><span>{q.spec}</span><strong>{amount(q.price)} {q.priceUnit}</strong><span>{q.updatedAt} · {freshness(q.updatedAt)}</span><button className="info-chip" onClick={() => toggleCompare(q)}>移除</button></div>)}</div><p className="market-notice">所选报价价差：{amount(Math.max(...compared.map(q => q.price)) - Math.min(...compared.map(q => q.price)))} {compared[0].priceUnit}。采集时点可能不同，价差不包含物流、税费或等级差异，不代表可成交套利收益。</p></>}
    </div></section>
    <section className="info-section market-service-links"><a href="#/hall"><strong>交易撮合 →</strong><span>按品种查找货源与采购需求</span></a><a href="#/logistics"><strong>物流服务 →</strong><span>查询运输服务，评估履约成本</span></a><a href="#/finance"><strong>供应链金融 →</strong><span>了解采购与经营融资服务</span></a><a href="#/quality-trace"><strong>质量溯源 →</strong><span>核验单品码与质量履历</span></a></section>
    <div className="market-disclosure"><strong>数据口径与服务边界</strong><p>现货报价来源于资讯域的在线监测记录，并非交易域的已成交价格。涨跌、周/月变化沿用上游字段；未提供比较基准的字段不另行推算。指数采用已发布值，不用异类报价平均替代。超过24/72小时的数据保留采集时间提示；关注保存在当前浏览器。数据用于行业研究与交易询价参考，实际价格以双方确认结果为准。</p></div>
  </div>
}

function MarketDetail({ id }: { id: number }): JSX.Element {
  const [quote, setQuote] = useState<Detail | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState('')
  const [period, setPeriod] = useState(30), [refresh, setRefresh] = useState(0)
  usePageMeta(quote ? `${quote.name}价格分析` : '品种价格分析', '品种报价、历史观测、区域比价与交易服务。')
  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(''); setQuote(null)
    infoPublicApi.market(id).then(v => { if (!cancelled) setQuote(v) }).catch((e: Error) => { if (!cancelled) setError(e.message) }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id, refresh])
  const history = useMemo(() => {
    const cutoff = new Date(); cutoff.setUTCDate(cutoff.getUTCDate() - period + 1)
    const first = cutoff.toISOString().slice(0, 10)
    const byDate = new Map<string, NonNullable<Detail['series']>[number]>()
    for (const point of quote?.series ?? []) if (!point.forecast && valid(point.price) && /^\d{4}-\d{2}-\d{2}$/.test(point.date) && point.date >= first && point.date <= new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' })) byDate.set(point.date, point)
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
  }, [quote, period])
  return <div className="info-page info-market-page portal-channel-page market-workbench"><PortalPageHero badge="价格指数 · 品种分析" title={quote ? `${quote.name}价格分析` : '品种价格分析'} description="查清价格来源与时间，在同品种、同规格和同单位下比较报价，联动采购与履约服务。"><div className="portal-page-hero-actions"><a className="btn portal-page-btn-ghost" href="#/info/market">← 返回价格指数</a>{quote && <a className="btn portal-page-btn-light" href={tradeLink(quote.name)}>查询同品种货源 →</a>}</div></PortalPageHero>
    {loading && <div className="info-loading">正在加载品种行情…</div>}{error && <div className="info-error" role="alert">{error} <button className="info-chip" onClick={() => setRefresh(v => v + 1)}>重试</button></div>}
    {quote && !loading && <><section className="info-card market-detail-overview"><div><h2>{quote.name} <small>{quote.spec || '规格未披露'}</small></h2><strong className="market-price-large">{amount(quote.price)} <small>{quote.priceUnit || '单位未披露'}</small></strong><span className={trendClass(quote.changePct)}>涨跌幅 {pct(quote.changePct)}</span></div><dl className="market-method"><dt>品类 / 产地</dt><dd>{quote.category || '—'} / {quote.origin || '—'}</dd><dt>市场 / 来源</dt><dd>{quote.market || '—'} / {quote.source || '未披露'}</dd><dt>采集时间</dt><dd>{quote.updatedAt || '未披露'} · {freshness(quote.updatedAt)}</dd><dt>周 / 月涨跌</dt><dd><span className={trendClass(quote.weekPct)}>{pct(quote.weekPct)}</span> / <span className={trendClass(quote.monthPct)}>{pct(quote.monthPct)}</span></dd></dl></section>
      <section className="info-section"><div className="info-section-head"><h2>历史观测 <small>不含预测</small></h2><div className="info-chips">{[7, 30, 90].map(days => <button key={days} aria-pressed={period === days} className={`info-chip${period === days ? ' on' : ''}`} onClick={() => setPeriod(days)}>近{days}天</button>)}</div></div><div className="info-card"><Sparkline values={history.map(p => p.price)} label={`${quote.name}历史价格`} /><p className="small gray">{history.length ? `${history[0].date} 至 ${history[history.length - 1].date}，共 ${history.length} 个观测日。按观测期序绘制，不填补缺失日期。` : '当前区间暂无已存储的历史观测，不按最新报价生成模拟曲线。'}</p>{history.length > 0 && <details className="market-history"><summary>查看历史明细与区间范围</summary><p>区间最低 {amount(Math.min(...history.map(p => p.price)))} / 最高 {amount(Math.max(...history.map(p => p.price)))} {quote.priceUnit}</p><div className="market-table-scroll"><table className="info-table"><thead><tr><th>观测日期</th><th className="num">价格（{quote.priceUnit || '单位未披露'}）</th></tr></thead><tbody>{history.map(p => <tr key={p.date}><td>{p.date}</td><td className="num">{amount(p.price)}</td></tr>)}</tbody></table></div></details>}</div></section>
      <section className="info-section"><div className="info-section-head"><h2>同口径区域报价</h2><span className="small gray">同品种 · 同规格 · 同单位</span></div><div className="info-card">{!quote.spec || !quote.priceUnit ? <p className="small gray">当前报价规格或单位缺失，暂不展示区域比价。</p> : (quote.regionPrices?.length ?? 0) < 2 ? <p className="small gray">同口径报价样本不足，暂不能进行区域比较。</p> : <div className="market-table-scroll"><table className="info-table"><thead><tr><th>区域 / 市场</th><th className="num">报价</th><th className="num">涨跌幅</th><th>采集时间</th></tr></thead><tbody>{quote.regionPrices?.map(q => <tr key={q.id}><td>{q.region || '—'} / {q.market || '—'}</td><td className="num">{amount(q.price)} {q.priceUnit}</td><td className={`num ${trendClass(q.changePct)}`}>{pct(q.changePct)}</td><td>{q.updatedAt || '未披露'} · {freshness(q.updatedAt)}</td></tr>)}</tbody></table><p className="small gray">各地报价采集时点可能不同，未包含运费与税费。</p></div>}</div></section>
      {!!quote.relatedArticles?.length && <section className="info-section"><div className="info-section-head"><h2>相关行业资讯</h2></div><div className="info-card">{quote.relatedArticles.map(a => <a className="info-news-row" href={`#/info/news/${a.id}`} key={a.id}><strong>{a.title}</strong><span className="small gray">{a.channel} · {a.publishedAt || '发布时间未披露'}</span></a>)}</div></section>}
      <div className="market-service-links"><a href={tradeLink(quote.name)}><strong>找同品种货源 →</strong><span>进入交易域查询供应</span></a><a href={tradeLink(quote.name, true)}><strong>找采购需求 →</strong><span>查看同品种需求</span></a><a href="#/logistics"><strong>评估物流成本 →</strong><span>了解运输与履约服务</span></a><a href="#/quality-trace"><strong>核验质量履历 →</strong><span>进入单品溯源查询</span></a></div></>}
  </div>
}
