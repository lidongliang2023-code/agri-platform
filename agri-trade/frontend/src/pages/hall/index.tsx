import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  SearchOutlined,
  ShopOutlined,
  SwapOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { isLoggedIn } from '@/utils/session'
import { redirectToSso } from '@/utils/sso'
import { BrandMark } from '@/components/BrandMark'
import { PortalNav } from '@/components/PortalNav'
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
  sellerId: number | string
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
const EMBEDDED = new URLSearchParams(window.location.search).get('embed') === '1'
const PORTAL_HERO = EMBEDDED && new URLSearchParams(window.location.search).get('portalHero') === '1'

// 门户「交易大厅」把产业链筛选参数透传到 iframe（原「产业链」页已并入交易大厅），
// 这里只接受字典内合法的取值，避免旧链接或手工拼参数把页面筛成空列表。
const HALL_QUERY = new URLSearchParams(window.location.search)
const queryValue = (name: string): string => (HALL_QUERY.get(name) ?? '').trim()
const QUERY_L1 = queryValue('l1')
const INITIAL_L1 = Object.prototype.hasOwnProperty.call(HALL_TAXONOMY, QUERY_L1) ? QUERY_L1 : ''
const QUERY_L2 = queryValue('l2')
const INITIAL_L2 = INITIAL_L1 && Object.prototype.hasOwnProperty.call(HALL_TAXONOMY[INITIAL_L1] ?? {}, QUERY_L2)
  ? QUERY_L2 : ''
const QUERY_L3 = queryValue('l3')
const INITIAL_L3 = INITIAL_L2 && (HALL_TAXONOMY[INITIAL_L1]?.[INITIAL_L2] ?? []).includes(QUERY_L3)
  ? QUERY_L3 : ''
const QUERY_PROVINCE = queryValue('province') || queryValue('loc')
const INITIAL_PROVINCE = HALL_PROVINCES.some((item) => item.name === QUERY_PROVINCE) ? QUERY_PROVINCE : ''
const INITIAL_KEYWORD = queryValue('keyword') || queryValue('q')
const INITIAL_TAB: 'supply' | 'purchase' = queryValue('tab') === 'purchase' ? 'purchase' : 'supply'

/** 产地筛选默认只露常用户省份，其余收进「更多产地」浮层 —— 33 个省份平铺会把筛选区撑到 400px 以上。 */
const TOP_PROVINCES = ['山东', '河南', '河北', '江苏', '安徽', '湖北', '湖南', '四川', '云南', '广西', '广东', '陕西']

const money = (value: number | null | undefined): string =>
  value == null ? '询价' : `¥${Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`

const shortDate = (value: string): string => value?.slice(0, 10) ?? '—'

export default function TradeHall(): JSX.Element {
  const [tab, setTab] = useState<'supply' | 'purchase'>(INITIAL_TAB)
  const [products, setProducts] = useState<HallProduct[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState(INITIAL_KEYWORD)
  const [searchInput, setSearchInput] = useState(INITIAL_KEYWORD)
  const [l1, setL1] = useState(INITIAL_L1)
  const [l2, setL2] = useState(INITIAL_L2)
  const [l3, setL3] = useState(INITIAL_L3)
  const [province, setProvince] = useState(INITIAL_PROVINCE)
  const [sort, setSort] = useState('default')
  const [demands, setDemands] = useState<PublicDemand[]>([])
  const [recommendations, setRecommendations] = useState<HallProduct[]>([])
  const [demandLoading, setDemandLoading] = useState(false)
  const [provinceOpen, setProvinceOpen] = useState(false)
  const provinceRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!EMBEDDED) {
      window.location.replace(`${PORTAL}#/hall`)
    }
  }, [])

  useEffect(() => {
    if (!provinceOpen) return undefined
    const onPointerDown = (event: MouseEvent): void => {
      if (provinceRef.current && !provinceRef.current.contains(event.target as Node)) {
        setProvinceOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setProvinceOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [provinceOpen])

  useEffect(() => {
    if (!EMBEDDED) return undefined
    let base = document.querySelector('base')
    if (!base) {
      base = document.createElement('base')
      document.head.appendChild(base)
    }
    base.setAttribute('target', '_top')
    const reportHeight = (): void => {
      const main = document.querySelector('.hall-main') as HTMLElement | null
      const contentHeight = main
        ? main.offsetTop + main.offsetHeight + 24
        : document.documentElement.scrollHeight
      window.parent.postMessage(
        { type: 'agri-hall-height', height: Math.ceil(contentHeight) },
        '*',
      )
    }
    const onParentReady = (event: MessageEvent): void => {
      if (event.source !== window.parent || event.origin !== new URL(PORTAL).origin) return
      if (event.data?.type === 'agri-hall-ready') reportHeight()
    }
    window.addEventListener('message', onParentReady)
    reportHeight()
    const observer = new ResizeObserver(reportHeight)
    observer.observe(document.body)
    window.addEventListener('resize', reportHeight)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', reportHeight)
      window.removeEventListener('message', onParentReady)
    }
  }, [])

  useEffect(() => {
    if (!EMBEDDED) return undefined
    const timer = window.setTimeout(() => {
      const main = document.querySelector('.hall-main') as HTMLElement | null
      const contentHeight = main
        ? main.offsetTop + main.offsetHeight + 24
        : document.documentElement.scrollHeight
      window.parent.postMessage(
        { type: 'agri-hall-height', height: Math.ceil(contentHeight) },
        '*',
      )
    }, 80)
    return () => window.clearTimeout(timer)
  }, [tab, products.length, demands.length, loading, demandLoading])

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
    const map = new Map<string, { sellerId: string; name: string; count: number }>()
    recommendations.forEach((item) => {
      if (!item.sellerName || item.sellerId == null) return
      const sellerId = String(item.sellerId)
      const current = map.get(sellerId) ?? { sellerId, name: item.sellerName, count: 0 }
      current.count += 1
      map.set(sellerId, current)
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
    if (EMBEDDED) {
      window.top?.location.assign(target)
      return
    }
    if (isLoggedIn()) {
      window.location.href = target
    } else {
      void redirectToSso(target)
    }
    void demand
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hasFilter = Boolean(l1 || l2 || l3 || province || keyword)
  // 常用户省份优先；若当前选中的在外省列表里，也把它提到前面，避免"选中了却看不见"
  const topProvinceOptions = useMemo(() => {
    const names = TOP_PROVINCES.filter((name) => HALL_PROVINCES.some((item) => item.name === name))
    if (province && !names.includes(province)) names.unshift(province)
    return names
  }, [province])
  const activeFilters = useMemo(() => {
    const list: Array<{ key: string; label: string; clear: () => void }> = []
    if (l1) list.push({ key: 'l1', label: l1, clear: () => { setL1(''); setL2(''); setL3(''); setPage(1) } })
    if (l2) list.push({ key: 'l2', label: l2, clear: () => { setL2(''); setL3(''); setPage(1) } })
    if (l3) list.push({ key: 'l3', label: l3, clear: () => { setL3(''); setPage(1) } })
    if (province) list.push({ key: 'province', label: `产地 ${province}`, clear: () => { setProvince(''); setPage(1) } })
    if (keyword) list.push({ key: 'keyword', label: `“${keyword}”`, clear: () => { setKeyword(''); setSearchInput(''); setPage(1) } })
    return list
  }, [l1, l2, l3, province, keyword])

  return (
    <div className={EMBEDDED ? `hall-root hall-embed${PORTAL_HERO ? ' hall-portal-shell' : ''}` : 'hall-root'}>
      <div className="topbar" style={EMBEDDED ? { display: 'none' } : undefined}>
        <div className="hall-container">
          <span>您好，欢迎来到丰链云交易大厅！智能大宗交易 · 平台撮合 · 支持在线议价</span>
          <span className="topbar-actions">
            <a href="/member/buyer">我是买家</a><span className="sep">·</span>
            <a href="/member/seller">我是卖家</a><span className="sep">·</span>
            <a href="/member/buyer">会员中心</a><span className="sep">·</span>
            <a href="#platform-login" onClick={(event) => { event.preventDefault(); void redirectToSso(`${window.location.pathname}${window.location.search}`) }}><UserOutlined />登录</a><span className="sep">·</span>
            <a href={SSO_REGISTER}>免费注册</a>
          </span>
        </div>
      </div>

      <header className="site-header" style={EMBEDDED ? { display: 'none' } : undefined}>
        <div className="hall-container">
          <a className="hall-brand" href={PORTAL}>
            <span className="hall-logo"><BrandMark size={36} /></span>
            <span>丰链云<small>FENGCHAIN · AGRI</small></span>
          </a>
          <PortalNav />
          <form className="header-search" onSubmit={submitSearch}>
            <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)}
              placeholder="搜索商品 / 供应商 / 需求" />
            <button type="submit"><SearchOutlined />搜索</button>
          </form>
        </div>
      </header>

      <main className="hall-container hall-main">
        {/* 嵌入门户时页头已有导航与面包屑，这里不再重复一遍 */}
        {!EMBEDDED && <div className="hall-crumb"><a href={PORTAL}>首页</a><span>/</span><strong>交易大厅</strong></div>}
        {/* 页头与「价格指数」的 section-head 同一口径：17px 标题 + 小字说明 + 右侧计数 */}
        {EMBEDDED ? (
          <section className="hall-portal-hero">
            <h1>交易大厅</h1>
            <p>汇聚农业产业链优质货源与采购需求，支持在线议价与平台撮合，让产销对接更高效。</p>
            <div className="hall-portal-hero-meta"><span>{total} 个在售商品</span><span>产业链选品 · 产地直连 · 在线议价</span></div>
          </section>
        ) : (
          <div className="hall-title-row">
            <h2>交易大厅 <small>智能大宗交易 · 平台撮合 · 支持在线议价</small></h2>
            <span className="hall-title-count">{total} 个在售商品</span>
          </div>
        )}

        <div className="hall-tabs">
          <button type="button" className={tab === 'supply' ? 'on' : ''} onClick={() => setTab('supply')}>供应大厅</button>
          <button type="button" className={tab === 'purchase' ? 'on' : ''} onClick={() => setTab('purchase')}>采购需求</button>
        </div>

        {tab === 'supply' ? (
          <>
            <div className="hall-supply">
              <section className="hall-filter-card">
                <div className="hall-filter-head">
                  <span className="hall-filter-title"><ShopOutlined />筛选</span>
                  <div className="hall-filter-head-right">
                    <span className="hall-filter-count">匹配 <b>{total}</b> 个货源</span>
                    {hasFilter && (
                      <button type="button" className="hall-filter-clear" onClick={resetFilters}>清空</button>
                    )}
                  </div>
                </div>

                <div className="hall-filter-line">
                  <span className="hall-filter-label">产业链</span>
                  <div className="hall-chip-scroll">
                    <button type="button" className={l1 === '' ? 'on' : ''} onClick={() => { setL1(''); setL2(''); setL3(''); setPage(1) }}>全部</button>
                    {level1.map((item) => (
                      <button type="button" key={item} className={l1 === item ? 'on' : ''}
                        onClick={() => { setL1(item); setL2(''); setL3(''); setPage(1) }}>{item}</button>
                    ))}
                  </div>
                </div>

                {l1 && (
                  <div className="hall-filter-line">
                    <span className="hall-filter-label">品类</span>
                    <div className="hall-chip-scroll">
                      {level2.map((item) => (
                        <button type="button" key={item} className={l2 === item ? 'on' : ''}
                          onClick={() => { setL2(item); setL3(''); setPage(1) }}>{item}</button>
                      ))}
                    </div>
                  </div>
                )}

                {l2 && level3.length > 0 && (
                  <div className="hall-filter-line">
                    <span className="hall-filter-label">品种</span>
                    <div className="hall-chip-scroll">
                      {level3.map((item) => (
                        <button type="button" key={item} className={l3 === item ? 'on' : ''}
                          onClick={() => { setL3(item); setPage(1) }}>{item}</button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="hall-filter-line hall-filter-province" ref={provinceRef}>
                  <span className="hall-filter-label">产地</span>
                  <div className="hall-chip-scroll">
                    <button type="button" className={province === '' ? 'on' : ''}
                      onClick={() => { setProvince(''); setPage(1) }}>全部</button>
                    {topProvinceOptions.map((name) => (
                      <button type="button" key={name} className={province === name ? 'on' : ''}
                        onClick={() => { setProvince(name); setPage(1); setProvinceOpen(false) }}>{name}</button>
                    ))}
                  </div>
                  <button type="button" className={provinceOpen ? 'hall-more open' : 'hall-more'}
                    aria-expanded={provinceOpen} onClick={() => setProvinceOpen((open) => !open)}>
                    更多产地<span aria-hidden>{provinceOpen ? '▴' : '▾'}</span>
                  </button>
                  {provinceOpen && (
                    <div className="hall-province-pop" role="dialog" aria-label="更多产地">
                      {PROVINCE_GROUPS.map((group) => {
                        const items = HALL_PROVINCES.filter((item) => item.group === group)
                        if (!items.length) return null
                        return (
                          <div className="hall-province-pop-group" key={group}>
                            <span>{group}</span>
                            <div className="hall-province-pop-chips">
                              {items.map((item) => (
                                <button type="button" key={item.name} className={province === item.name ? 'on' : ''}
                                  onClick={() => { setProvince(item.name); setPage(1); setProvinceOpen(false) }}>{item.name}</button>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {hasFilter && (
                  <div className="hall-active-row">
                    <span className="hall-active-label">已选</span>
                    {activeFilters.map((filter) => (
                      <button type="button" key={filter.key} className="hall-active-chip" onClick={filter.clear}>
                        {filter.label}<i aria-hidden>×</i>
                      </button>
                    ))}
                    <button type="button" className="hall-active-reset" onClick={resetFilters}>清空全部</button>
                  </div>
                )}
              </section>

              <section className="hall-list">
                <div className="hall-toolbar">
                  <span>{pages > 1 ? <>第 <b>{page}</b> / {pages} 页</> : <>共 <b>{total}</b> 个在售商品</>}</span>
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
                  <a className="hall-supplier" key={item.sellerId} href={`/shop/${item.sellerId}`}>
                    <span className={`hall-supplier-icon tone-${index % 4}`}><SwapOutlined /></span>
                    <strong>{item.name}</strong>
                    <small>在售 {item.count} 个货源</small>
                    <em>进入主页 ›</em>
                  </a>
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

      <footer className="hall-footer" style={EMBEDDED ? { display: 'none' } : undefined}>
        <div className="hall-container">
          <span>© 2026 农业产业互联网平台 · 丰链云交易大厅</span>
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
