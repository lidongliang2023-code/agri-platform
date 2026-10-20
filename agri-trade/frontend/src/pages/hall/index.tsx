import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  AppstoreOutlined,
  SearchOutlined,
  ShopOutlined,
  SwapOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { isLoggedIn } from '@/utils/session'
import {
  HALL_PROVINCES,
  HALL_TAXONOMY,
  L1_KEYWORDS,
  L2_KEYWORDS,
  PROVINCE_GROUPS,
} from './taxonomy'
import './hall.css'

interface HallProduct {
  id: number
  productName: string
  sellerName: string | null
  categoryName: string | null
  variety: string | null
  origin: string
  specification: string | null
  unit: string
  price: number
  priceMin: number | null
  priceMax: number | null
  minOrderQuantity: number | null
  stockQuantity: number | null
  salesVolume: number | null
  province: string | null
  categoryId: number | null
}

interface PublicPage {
  records: HallProduct[]
  total: number
  pageNum: number
  pageSize: number
}

interface PublicDemand {
  id: number
  demandNo: string
  demandName: string
  buyerName: string
  productName: string
  variety: string
  quantity: number
  unit: string
  priceMin: number | null
  priceMax: number | null
  deliveryProvince: string | null
  deliveryCity: string | null
  demandStatus: string
  responseCount: number
  createTime: string
}

const PORTAL = `${window.location.protocol}//${window.location.hostname}:8098/portal/`
const SSO_REGISTER = `${window.location.protocol}//${window.location.hostname}:8090/register`
const PAGE_SIZE = 9

const money = (value: number | null | undefined): string =>
  value == null ? '询价' : `¥${Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`

const shortDate = (value: string): string => value?.slice(0, 10) ?? '—'

export default function TradeHall(): JSX.Element {
  const [tab, setTab] = useState<'supply' | 'purchase'>('supply')
  const [products, setProducts] = useState<HallProduct[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [l1, setL1] = useState('')
  const [l2, setL2] = useState('')
  const [l3, setL3] = useState('')
  const [province, setProvince] = useState('')
  const [sort, setSort] = useState('default')
  const [demands, setDemands] = useState<PublicDemand[]>([])
  const [recommendations, setRecommendations] = useState<HallProduct[]>([])
  const [demandLoading, setDemandLoading] = useState(false)

  useEffect(() => {
    fetch('/api/trade/public/products?limit=24')
      .then((response) => response.json())
      .then((body: { code?: number; data?: HallProduct[] }) => {
        if (body.code === 200) setRecommendations(Array.isArray(body.data) ? body.data : [])
      })
      .catch(() => { /* 推荐区降级为空 */ })
    setDemandLoading(true)
    fetch('/api/trade/public/demands')
      .then((response) => response.json())
      .then((body: { code?: number; data?: PublicDemand[] }) => {
        if (body.code === 200) setDemands(Array.isArray(body.data) ? body.data : [])
      })
      .catch(() => { /* 页面显示暂无需求 */ })
      .finally(() => setDemandLoading(false))
  }, [])

  const level1 = Object.keys(HALL_TAXONOMY)
  const level2 = l1 ? Object.keys(HALL_TAXONOMY[l1] ?? {}) : []
  const level3 = l1 && l2 ? HALL_TAXONOMY[l1]?.[l2] ?? [] : []

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    const params = new URLSearchParams({
      pageNum: String(page),
      pageSize: String(PAGE_SIZE),
      sort: sort === 'default' ? 'latest' : sort,
    })
    if (keyword.trim()) params.set('keyword', keyword.trim())
    if (l3) {
      params.set('varietyKeyword', l3)
    } else if (l2) {
      for (const value of L2_KEYWORDS[l2] ?? []) params.append('categoryKeywords', value)
    } else if (l1) {
      for (const value of L1_KEYWORDS[l1] ?? []) params.append('categoryKeywords', value)
    }
    if (province) params.set('province', province)
    fetch(`/api/trade/public/hall/products?${params.toString()}`)
      .then((response) => response.json())
      .then((body: { code?: number; data?: PublicPage; message?: string }) => {
        if (cancelled) return
        if (body.code === 200 && body.data) {
          setProducts(body.data.records ?? [])
          setTotal(body.data.total ?? 0)
        } else {
          setProducts([])
          setTotal(0)
          setError(body.message ?? '交易大厅加载失败')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProducts([])
          setTotal(0)
          setError('无法连接交易服务')
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [page, keyword, l1, l2, l3, province, sort])

  const suppliers = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>()
    recommendations.forEach((item) => {
      if (!item.sellerName) return
      const current = map.get(item.sellerName) ?? { name: item.sellerName, count: 0 }
      current.count += 1
      map.set(item.sellerName, current)
    })
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 5)
  }, [recommendations])

  const submitSearch = (event: FormEvent): void => {
    event.preventDefault()
    setKeyword(searchInput)
    setPage(1)
  }

  const resetFilters = (): void => {
    setL1('')
    setL2('')
    setL3('')
    setProvince('')
    setSort('default')
    setKeyword('')
    setSearchInput('')
    setPage(1)
  }

  const quote = (demand: PublicDemand): void => {
    const target = `/member/seller?tab=trade`
    if (isLoggedIn()) {
      window.location.href = target
    } else {
      window.location.href = `/login?redirect=${encodeURIComponent(target)}`
    }
    void demand
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="hall-root">
      <div className="hall-topbar">
        <div className="hall-container">
          <span>您好，欢迎来到农产云交易大厅！智能大宗交易 · 平台撮合 · 支持在线议价</span>
          <span className="hall-top-links">
            <a href="/member/buyer">我是买家</a><i>·</i>
            <a href="/member/seller">我是卖家</a><i>·</i>
            <a href="/member/buyer">会员中心</a><i>·</i>
            <a href="/login"><UserOutlined />登录</a><i>·</i>
            <a href={SSO_REGISTER}>免费注册</a>
          </span>
        </div>
      </div>

      <header className="hall-header">
        <div className="hall-container">
          <a className="hall-brand" href={PORTAL}>
            <span className="hall-logo"><AppstoreOutlined /></span>
            <span>农产云<small>AGRI · CLOUD</small></span>
          </a>
          <nav className="hall-nav">
            <a href={PORTAL}>首页</a>
            <a href={`${PORTAL}#/chains`}>产业链</a>
            <a className="on" href="/hall">交易大厅</a>
            <a href={`${PORTAL}#/?scroll=price`}>价格指数</a>
            <a href={`${PORTAL}#/?scroll=news`}>产业资讯</a>
            <a href="/member/seller?tab=fund">供应链金融</a>
          </nav>
          <form className="hall-search" onSubmit={submitSearch}>
            <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)}
              placeholder="搜索商品 / 供应商 / 需求" />
            <button type="submit"><SearchOutlined />搜索</button>
          </form>
        </div>
      </header>

      <main className="hall-container hall-main">
        <div className="hall-crumb"><a href={PORTAL}>首页</a><span>/</span><strong>交易大厅</strong></div>
        <div className="hall-title-row">
          <div>
            <h1>交易大厅</h1>
            <p>智能大宗交易 · 平台撮合 · 支持在线议价</p>
          </div>
          <div className="hall-title-tags">
            <span className="hall-tag tech">平台质检</span>
            <span className="hall-tag">资金担保</span>
          </div>
        </div>

        <div className="hall-tabs">
          <button type="button" className={tab === 'supply' ? 'on' : ''} onClick={() => setTab('supply')}>供应大厅</button>
          <button type="button" className={tab === 'purchase' ? 'on' : ''} onClick={() => setTab('purchase')}>采购需求</button>
        </div>

        {tab === 'supply' ? (
          <>
            <div className="hall-supply">
              <aside className="hall-filter-card">
                <div className="hall-card-head">
                  <h3><ShopOutlined />筛选条件</h3>
                  <div className="hall-filter-actions">
                    <span className="hall-tag tech">支持三级分类</span>
                    <button type="button" className="hall-reset" onClick={resetFilters}>清空筛选</button>
                  </div>
                </div>
                <div className="hall-filter-body">
                  <div className="hall-trail">
                    <button type="button" onClick={resetFilters}>全部产业链</button>
                    {l1 && <><span>/</span><strong>{l1}</strong></>}
                    {l2 && <><span>/</span><strong>{l2}</strong></>}
                    {l3 && <><span>/</span><strong>{l3}</strong></>}
                    {province && <><span>·</span><strong>产地：{province}</strong></>}
                    <span>·</span><span>匹配 <b>{total}</b> 个货源</span>
                  </div>
                  <div className="hall-filter-row">
                    <span className="hall-filter-label">一级产业</span>
                    <div className="hall-chips">
                      <button type="button" className={l1 === '' ? 'on' : ''} onClick={() => { setL1(''); setL2(''); setL3(''); setPage(1) }}>全部产业</button>
                      {level1.map((item) => (
                        <button type="button" key={item} className={l1 === item ? 'on' : ''}
                          onClick={() => { setL1(item); setL2(''); setL3(''); setPage(1) }}>{item}</button>
                      ))}
                    </div>
                  </div>
                  <div className="hall-filter-row">
                    <span className="hall-filter-label">二级品类</span>
                    <div className="hall-chips">
                      {!level2.length && <span className="hall-hint">请选择一级产业</span>}
                      {level2.map((item) => (
                        <button type="button" key={item} className={l2 === item ? 'on' : ''}
                          onClick={() => { setL2(item); setL3(''); setPage(1) }}>{item}</button>
                      ))}
                    </div>
                  </div>
                  <div className="hall-filter-row">
                    <span className="hall-filter-label">三级品种</span>
                    <div className="hall-chips">
                      {!level3.length && <span className="hall-hint">请选择二级品类</span>}
                      {level3.map((item) => (
                        <button type="button" key={item} className={l3 === item ? 'on' : ''}
                          onClick={() => { setL3(item); setPage(1) }}>{item}</button>
                      ))}
                    </div>
                  </div>
                  <div className="hall-filter-row">
                    <span className="hall-filter-label">产地</span>
                    <div className="hall-province-groups">
                      <div className="hall-chips">
                        <button type="button" className={province === '' ? 'on' : ''} onClick={() => { setProvince(''); setPage(1) }}>全部省份</button>
                      </div>
                      {PROVINCE_GROUPS.map((group) => {
                        const items = HALL_PROVINCES.filter((item) => item.group === group)
                        if (!items.length) return null
                        return (
                          <div className="hall-province-group" key={group}>
                            <span>{group}</span>
                            <div className="hall-chips">
                              {items.map((item) => (
                                <button type="button" key={item.name} className={province === item.name ? 'on' : ''}
                                  onClick={() => { setProvince(item.name); setPage(1) }}>{item.name}</button>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </aside>

              <section className="hall-list">
                <div className="hall-toolbar">
                  <span>共 <b>{total}</b> 个在售商品{total > 0 ? `（第 ${page} / ${pages} 页）` : ''}</span>
                  <div className="hall-chips">
                    {[
                      { key: 'default', label: '综合' },
                      { key: 'latest', label: '最新发布' },
                      { key: 'priceAsc', label: '价格从低到高' },
                      { key: 'priceDesc', label: '价格从高到低' },
                    ].map((item) => (
                      <button type="button" key={item.key} className={sort === item.key ? 'on' : ''}
                        onClick={() => { setSort(item.key); setPage(1) }}>{item.label}</button>
                    ))}
                  </div>
                </div>
                {loading && <div className="hall-state">正在加载货源…</div>}
                {!loading && error && <div className="hall-state error">{error}</div>}
                {!loading && !error && products.length === 0 && (
                  <div className="hall-state">没有匹配的货源，试试更换筛选条件。</div>
                )}
                {!loading && !error && products.length > 0 && (
                  <div className="hall-grid">
                    {products.map((product, index) => (
                      <a className="hall-product" key={product.id} href={`/product/detail/${product.id}`}>
                        <div className={`hall-thumb theme-${index % 5}`}><ShopOutlined /></div>
                        <div className="hall-product-title">
                          <strong>{product.productName}</strong>
                          <span className="hall-tag">{product.categoryName || '农产品'}</span>
                        </div>
                        <div className="hall-product-meta">{product.origin || '产地待补充'} · {product.specification || product.variety || '规格待补充'}</div>
                        <div className="hall-price">{money(product.price)}<small> / {product.unit}</small></div>
                        <div className="hall-product-foot">
                          <span>起订 {product.minOrderQuantity ?? '—'} {product.unit}</span>
                          <span>{product.sellerName || '平台商家'}</span>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
                {pages > 1 && (
                  <div className="hall-pager">
                    <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button>
                    <span>{page} / {pages}</span>
                    <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>下一页</button>
                  </div>
                )}
              </section>
            </div>

            <section className="hall-suppliers">
              <div className="hall-card-head"><h3>优质供应商推荐</h3><span>按在售货源数</span></div>
              <div className="hall-supplier-grid">
                {suppliers.map((item, index) => (
                  <div className="hall-supplier" key={item.name}>
                    <span className={`hall-supplier-icon tone-${index % 4}`}><SwapOutlined /></span>
                    <strong>{item.name}</strong>
                    <small>在售 {item.count} 个货源</small>
                  </div>
                ))}
                {!suppliers.length && <div className="hall-state">暂无供应商数据</div>}
              </div>
            </section>
          </>
        ) : (
          <section className="hall-demand-card">
            <div className="hall-card-head">
              <h3>采购需求大厅</h3>
              <span>共 {demands.length} 条需求 · 登录后可报价与在线议价</span>
            </div>
            {demandLoading && <div className="hall-state">正在加载采购需求…</div>}
            {!demandLoading && demands.length === 0 && <div className="hall-state">暂无公开采购需求</div>}
            {!demandLoading && demands.length > 0 && (
              <div className="hall-table-wrap">
                <table className="hall-table">
                  <thead><tr><th>需求方</th><th>品类 / 品种</th><th>数量</th><th>期望价</th><th>交货地</th><th>发布时间</th><th>状态</th><th>操作</th></tr></thead>
                  <tbody>
                    {demands.map((item) => (
                      <tr key={item.id}>
                        <td><strong>{item.buyerName}</strong></td>
                        <td>{item.productName || item.demandName}<span className="hall-muted"> / {item.variety}</span></td>
                        <td>{item.quantity} {item.unit}</td>
                        <td>{money(item.priceMin)} ~ {money(item.priceMax)}</td>
                        <td>{[item.deliveryProvince, item.deliveryCity].filter(Boolean).join(' ')}</td>
                        <td>{shortDate(item.createTime)}</td>
                        <td><span className="hall-tag tech">{demandStatus(item.demandStatus)}</span></td>
                        <td><button type="button" className="hall-quote" onClick={() => quote(item)}>报价</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="hall-demand-features">
              <div><strong>精准匹配</strong><span>按品类、产地与采购量匹配货源</span></div>
              <div><strong>在线议价</strong><span>报价、受理与合同在线完成</span></div>
              <div><strong>资金担保</strong><span>平台托管，确认收货后结算</span></div>
            </div>
          </section>
        )}
      </main>

      <footer className="hall-footer">
        <div className="hall-container">
          <span>© 2026 农业产业互联网平台 · 农产云交易大厅</span>
          <span>商品详情与下单需登录；大厅商品来自交易域实时在售数据。</span>
        </div>
      </footer>
    </div>
  )
}

function demandStatus(status: string): string {
  const map: Record<string, string> = { pending: '待匹配', matching: '匹配中', quoted: '报价中', completed: '已成交', closed: '已关闭' }
  return map[status] ?? status
}
