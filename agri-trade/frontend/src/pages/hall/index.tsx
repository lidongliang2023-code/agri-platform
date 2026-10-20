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
import './hall.css'

interface Category {
  id: number
  parentId: number | null
  categoryName: string
  level: number
}

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
const PRODUCTION = `${window.location.protocol}//${window.location.hostname}/production/dashboard`
const SSO_REGISTER = `${window.location.protocol}//${window.location.hostname}:8090/register`
const PAGE_SIZE = 9

const PROVINCES = ['黑龙江省', '山东省', '陕西省', '内蒙古自治区', '江苏省', '云南省', '湖北省', '江西省', '吉林省', '河南省', '广东省']
const PRICE_RANGES = [
  { key: 'all', label: '不限', min: undefined, max: undefined },
  { key: 'low', label: '≤ 100', min: undefined, max: 100 },
  { key: 'mid', label: '100 - 300', min: 100, max: 300 },
  { key: 'high', label: '300 - 1000', min: 300, max: 1000 },
  { key: 'vip', label: '≥ 1000', min: 1000, max: undefined },
]

const money = (value: number | null | undefined): string =>
  value == null ? '询价' : `¥${Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`

const shortDate = (value: string): string => value?.slice(0, 10) ?? '—'

export default function TradeHall(): JSX.Element {
  const [tab, setTab] = useState<'supply' | 'purchase'>('supply')
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<HallProduct[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [l1, setL1] = useState<number | null>(null)
  const [l2, setL2] = useState<number | null>(null)
  const [province, setProvince] = useState('')
  const [priceKey, setPriceKey] = useState('all')
  const [sort, setSort] = useState('latest')
  const [demands, setDemands] = useState<PublicDemand[]>([])
  const [recommendations, setRecommendations] = useState<HallProduct[]>([])
  const [demandLoading, setDemandLoading] = useState(false)

  useEffect(() => {
    fetch('/api/trade/public/categories')
      .then((response) => response.json())
      .then((body: { code?: number; data?: Category[] }) => {
        if (body.code === 200) setCategories(Array.isArray(body.data) ? body.data : [])
      })
      .catch(() => { /* 分类加载失败时仍可按关键词搜索 */ })
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

  const level1 = categories.filter((item) => item.level === 1)
  const level2 = l1 == null ? [] : categories.filter((item) => item.level === 2 && Number(item.parentId) === l1)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ pageNum: String(page), pageSize: String(PAGE_SIZE), sort })
    if (keyword.trim()) params.set('keyword', keyword.trim())
    if (l2 != null) {
      params.append('categoryIds', String(l2))
    } else if (l1 != null) {
      const childIds = categories.filter((item) => item.level === 2 && Number(item.parentId) === l1).map((item) => item.id)
      childIds.forEach((id) => params.append('categoryIds', String(id)))
      const current = categories.find((item) => item.id === l1)
      if (current) params.set('categoryName', current.categoryName)
    }
    if (province) params.set('province', province)
    const range = PRICE_RANGES.find((item) => item.key === priceKey)
    if (range?.min != null) params.set('minPrice', String(range.min))
    if (range?.max != null) params.set('maxPrice', String(range.max))
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
  }, [page, keyword, l1, l2, province, priceKey, sort, categories])

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
    setL1(null)
    setL2(null)
    setProvince('')
    setPriceKey('all')
    setSort('latest')
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
            <a href="/demand/create">发布需求</a>
            <a href="/member/buyer">会员中心</a>
            <a href={PRODUCTION}>生产监测</a>
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
            <div className="hall-layout">
              <aside className="hall-filter-card">
                <div className="hall-card-head"><h3><ShopOutlined />筛选条件</h3></div>
                <div className="hall-filter-body">
                  <label>一级产业</label>
                  <div className="hall-chips">
                    <button type="button" className={l1 == null ? 'on' : ''} onClick={() => { setL1(null); setL2(null); setPage(1) }}>全部</button>
                    {level1.map((item) => (
                      <button type="button" key={item.id} className={l1 === item.id ? 'on' : ''}
                        onClick={() => { setL1(item.id); setL2(null); setPage(1) }}>{item.categoryName}</button>
                    ))}
                  </div>
                  <label>二级品类</label>
                  <div className="hall-chips">
                    {!level2.length && <span className="hall-hint">请选择一级产业</span>}
                    {level2.map((item) => (
                      <button type="button" key={item.id} className={l2 === item.id ? 'on' : ''}
                        onClick={() => { setL2(item.id); setPage(1) }}>{item.categoryName}</button>
                    ))}
                  </div>
                  <label>产地</label>
                  <div className="hall-chips">
                    <button type="button" className={province === '' ? 'on' : ''} onClick={() => { setProvince(''); setPage(1) }}>全部</button>
                    {PROVINCES.map((item) => (
                      <button type="button" key={item} className={province === item ? 'on' : ''}
                        onClick={() => { setProvince(item); setPage(1) }}>{item.replace(/省|自治区/g, '')}</button>
                    ))}
                  </div>
                  <label>价格区间（元）</label>
                  <div className="hall-chips">
                    {PRICE_RANGES.map((item) => (
                      <button type="button" key={item.key} className={priceKey === item.key ? 'on' : ''}
                        onClick={() => { setPriceKey(item.key); setPage(1) }}>{item.label}</button>
                    ))}
                  </div>
                  <label>排序</label>
                  <select className="hall-select" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1) }}>
                    <option value="latest">最新发布</option>
                    <option value="priceAsc">价格从低到高</option>
                    <option value="priceDesc">价格从高到低</option>
                    <option value="sales">成交最多</option>
                  </select>
                  <button type="button" className="hall-reset" onClick={resetFilters}>清空筛选</button>
                </div>
              </aside>

              <section className="hall-list">
                <div className="hall-toolbar">
                  <span>共 <b>{total}</b> 个在售商品{total > 0 ? `（第 ${page} / ${pages} 页）` : ''}</span>
                  <div className="hall-chips">
                    {[{ key: 'latest', label: '最新发布' }, { key: 'priceAsc', label: '价格从低到高' }, { key: 'priceDesc', label: '价格从高到低' }, { key: 'sales', label: '成交最多' }].map((item) => (
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
