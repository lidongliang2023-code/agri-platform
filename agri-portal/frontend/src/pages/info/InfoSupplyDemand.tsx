import { useEffect, useState } from 'react'
import { infoPublicApi, money, type SupplyDemand } from './infoApi'
import { usePageMeta } from '../../utils'
import './info.css'

export function InfoSupplyDemand({ id, type }: { id?: number; type?: string }): JSX.Element {
  return id ? <SupplyDemandDetail id={id} type={type ?? 'supply'} /> : <SupplyDemandList />
}

function SupplyDemandList(): JSX.Element {

  const [items, setItems] = useState<SupplyDemand[]>([])
  const [stats, setStats] = useState({ supplyCount: 0, demandCount: 0, todayCount: 0, matchRate: 0, avgResponse: 0 })
  const [categories, setCategories] = useState<string[]>([])
  const [type, setType] = useState<'supply' | 'demand'>('supply')
  const [category, setCategory] = useState('')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  usePageMeta('供需大厅', '公开浏览供应与求购信息，联系方式与在线洽谈需登录后查看。')
  const size = 12

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    infoPublicApi.supplyDemands({
      type, category: category || undefined, keyword: keyword || undefined, page, size,
    })
      .then((data) => {
        if (cancelled) return
        setItems(data.items ?? [])
        setStats(data.stats)
        setCategories(data.categories ?? [])
      })
      .catch((reason: Error) => { if (!cancelled) setError(reason.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [type, category, keyword, page])

  const total = type === 'supply' ? stats.supplyCount : stats.demandCount
  const pages = Math.max(1, Math.ceil(total / size))

  return (
    <div className="info-page">
      <div className="info-section-head">
        <h2>供需大厅 <small>公开浏览 · 联系方式需登录后查看</small></h2>
        <a className="info-more" href="#/hall">去交易大厅下单 ›</a>
      </div>

      <div className="info-grid-4" style={{ marginBottom: 20 }}>
        <div className="info-card">
          <div className="small gray">供应信息</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{stats.supplyCount}</div>
        </div>
        <div className="info-card">
          <div className="small gray">求购信息</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{stats.demandCount}</div>
        </div>
        <div className="info-card">
          <div className="small gray">撮合活跃度</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{stats.matchRate}%</div>
        </div>
        <div className="info-card">
          <div className="small gray">平均响应</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{stats.avgResponse} 天</div>
        </div>
      </div>

      <div className="info-filter">
        <div className="info-chips">
          <button type="button" className={`info-chip${type === 'supply' ? ' on' : ''}`} onClick={() => { setType('supply'); setPage(1) }}>
            供应
          </button>
          <button type="button" className={`info-chip${type === 'demand' ? ' on' : ''}`} onClick={() => { setType('demand'); setPage(1) }}>
            求购
          </button>
        </div>
        <label style={{ marginLeft: 12 }}>品类</label>
        <div className="info-chips">
          <button type="button" className={`info-chip${category === '' ? ' on' : ''}`} onClick={() => { setCategory(''); setPage(1) }}>全部</button>
          {categories.slice(0, 8).map((item) => (
            <button
              type="button"
              key={item}
              className={`info-chip${category === item ? ' on' : ''}`}
              onClick={() => { setCategory(item); setPage(1) }}
            >
              {item}
            </button>
          ))}
        </div>
        <input
          value={keyword}
          placeholder="搜品种 / 产地"
          onChange={(event) => setKeyword(event.target.value)}
          style={{ marginLeft: 'auto', width: 180 }}
        />
      </div>

      {error && <div className="info-error">{error}</div>}
      {loading && <div className="info-loading">正在加载供需信息…</div>}
      {!loading && items.length === 0 && !error && <div className="info-empty">暂无{type === 'supply' ? '供应' : '求购'}信息</div>}

      <div className="info-grid-3">
        {items.map((item) => (
          <a className="info-tile" href={`#/info/supply-demand/${item.id}?type=${item.sdType}`} key={item.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className={`info-chip ${item.sdType === 'supply' ? '' : 'gray'}`}>
                {item.sdType === 'supply' ? '供应' : '求购'}
              </span>
              <span className="small gray">{item.origin}</span>
            </div>
            <h3>{item.title}</h3>
            <p>{item.spec || item.marketRef || item.variety}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 }}>
              <b style={{ fontSize: 17, color: 'var(--danger)' }}>{item.price > 0 ? <>{money(item.price)} <span className="small gray">{item.priceUnit}</span></> : '面议'}</b>
              <span className="small gray">{item.quantity}</span>
            </div>
            <div className="small gray" style={{ marginTop: 2 }}>{item.orgName}</div>
          </a>
        ))}
      </div>

      {pages > 1 && (
        <div className="info-chips" style={{ justifyContent: 'center', marginTop: 20 }}>
          <button type="button" className="info-chip" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button>
          <span className="small gray" style={{ alignSelf: 'center' }}>{page} / {pages}</span>
          <button type="button" className="info-chip" disabled={page >= pages} onClick={() => setPage(page + 1)}>下一页</button>
        </div>
      )}
    </div>
  )
}

function SupplyDemandDetail({ id, type }: { id: number; type: string }): JSX.Element {

  const [detail, setDetail] = useState<(SupplyDemand & { matches?: unknown[] }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  usePageMeta(detail?.title ?? '供需详情', detail ? [detail.category, detail.quantity, detail.origin].filter(Boolean).join(' · ') : undefined)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    infoPublicApi.supplyDemand(id, type)
      .then((data) => { if (!cancelled) setDetail(data) })
      .catch((reason: Error) => { if (!cancelled) setError(reason.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id, type])

  if (loading) return <div className="info-page"><div className="info-loading">正在加载…</div></div>
  if (error || !detail) {
    return (
      <div className="info-page">
        <a className="info-back" href="#/info/supply-demand">‹ 返回供需大厅</a>
        <div className="info-error">{error || '信息不存在或已下架'}</div>
      </div>
    )
  }

  return (
    <div className="info-page">
      <a className="info-back" href="#/info/supply-demand">‹ 返回供需大厅</a>

      <div className="info-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span className={`info-chip ${detail.sdType === 'supply' ? '' : 'gray'}`}>
            {detail.sdType === 'supply' ? '供应' : '求购'}
          </span>
          <span className="small gray">编号 {detail.sdNo}</span>
          {detail.verified && <span className="info-chip gray">已认证</span>}
        </div>

        <h2 style={{ margin: '0 0 14px', fontSize: 22, fontWeight: 700 }}>{detail.title}</h2>

        <table className="info-table" style={{ marginBottom: 18 }}>
          <tbody>
            <tr><td style={{ width: 110 }} className="gray">品类 / 品种</td><td>{[detail.category, detail.variety].filter(Boolean).join(' · ') || '—'}</td></tr>
            <tr><td className="gray">数量</td><td>{detail.quantity}</td></tr>
            <tr><td className="gray">价格</td><td style={{ color: 'var(--danger)', fontWeight: 600 }}>{detail.price > 0 ? `${money(detail.price)} ${detail.priceUnit}` : '面议'}</td></tr>
            <tr><td className="gray">产地 / 地区</td><td>{detail.origin || '—'}</td></tr>
            <tr><td className="gray">规格说明</td><td>{detail.spec || '—'}</td></tr>
            <tr><td className="gray">发布单位</td><td>{detail.orgName}</td></tr>
            <tr><td className="gray">行情参考</td><td>{detail.marketRef || '—'}</td></tr>
          </tbody>
        </table>

        <div className="info-card" style={{ background: 'var(--green-050)', borderColor: 'var(--green-100)' }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            联系方式：{detail.contactMasked ? '登录后可见' : (detail.contactName ?? '—')}
          </div>
          <div className="small gray" style={{ marginBottom: 14, lineHeight: 1.75 }}>
            {detail.contactMasked
              ? (detail.sdType === 'supply'
                ? '门户开放浏览，联系方式与在线洽谈需登录平台账号。登录后还能看到智能匹配结果，直接发起询价。'
                : '这是采购方发布的求购信息。登录后可联系采购方、提交报价，或查看与之匹配的货源。')
              : `联系电话：${detail.contactPhone ?? '—'}`}
          </div>
          <div className="info-chips">
            <a className="info-chip on" href="#/hall">
              {detail.sdType === 'supply' ? '登录后联系供应商' : '登录后联系采购方'}
            </a>
            <a className="info-chip" href="#/info/supply-demand">看更多同类信息</a>
          </div>
        </div>
      </div>

      <p className="portal-data-note" style={{ marginTop: 18 }}>
        该信息与交易撮合模块同源，卖家/买家中心可查看同一份数据；正式询价、洽谈与下单请在交易大厅完成。
      </p>
    </div>
  )
}
