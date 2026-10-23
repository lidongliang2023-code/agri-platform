import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { Empty, Input, Select, Spin } from 'antd'
import {
  ArrowRightOutlined,
  CheckCircleOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  TruckOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { BrandMark } from '@/components/BrandMark'
import { redirectToSso } from '@/utils/sso'
import '../../hall/hall.css'
import '../../product/detail/product-detail.css'
import './shop-detail.css'

interface ProductRow {
  id: number
  productName: string
  categoryName: string
  variety: string
  origin: string
  specification: string
  unit: string
  price: number
  priceMin?: number
  minOrderQuantity?: number
  stockQuantity: number
  salesVolume?: number
  sellerId: number | string
  sellerName: string
}

interface SellerHome {
  sellerId: string
  sellerName: string
  province: string | null
  city: string | null
  productCount: number
  products: ProductRow[]
}

const PORTAL = `${window.location.protocol}//${window.location.hostname}:8098/portal/`
const SSO_REGISTER = `${window.location.protocol}//${window.location.hostname}:8090/register`

const money = (value: number | null | undefined): string =>
  value == null ? '询价' : `¥${Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`

const compactNumber = (value: number): string =>
  Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 })

/**
 * 公开供应商店铺主页。
 *
 * 店铺资料仍然来自该供应商已发布货源，不虚构评分、认证或成交量。
 * 页面视觉与商品详情统一使用交易大厅导航、绿色体系、面包屑和圆角卡片。
 */
export default function ShopDetail(): JSX.Element {
  const { sellerId = '' } = useParams()
  const [rows, setRows] = useState<ProductRow[]>([])
  const [seller, setSeller] = useState<SellerHome | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState('newest')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!sellerId) return
    let cancelled = false
    setLoading(true)
    setError('')
    fetch(`/api/trade/public/sellers/${encodeURIComponent(sellerId)}`)
      .then((response) => response.json())
      .then((body: { code: number; data?: SellerHome; message?: string }) => {
        if (cancelled) return
        if (body.code === 200 && body.data) {
          setSeller(body.data)
          setRows(body.data.products ?? [])
        } else {
          setSeller(null)
          setRows([])
          setError(body.message || '供应商不存在或暂无在售货源')
        }
      })
      .catch(() => { if (!cancelled) setError('加载供应商主页失败，请稍后重试') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [sellerId])

  const sellerName = seller?.sellerName ?? rows[0]?.sellerName ?? '供应商主页'
  const location = seller ? [seller.province, seller.city].filter(Boolean).join(' ') : ''
  const categories = useMemo(() => [...new Set(rows.map((item) => item.categoryName).filter(Boolean))], [rows])
  const totalStock = useMemo(() => rows.reduce((sum, item) => sum + Number(item.stockQuantity ?? 0), 0), [rows])
  const minPrice = useMemo(() => {
    const prices = rows.map((item) => Number(item.price ?? item.priceMin)).filter((value) => Number.isFinite(value))
    return prices.length ? Math.min(...prices) : null
  }, [rows])
  const visibleProducts = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()
    const filtered = rows.filter((item) =>
      (!category || item.categoryName === category)
      && (!normalized || [item.productName, item.variety, item.origin, item.categoryName]
        .some((value) => String(value ?? '').toLowerCase().includes(normalized))))
    return [...filtered].sort((left, right) => {
      if (sort === 'priceAsc') return Number(left.price ?? left.priceMin ?? 0) - Number(right.price ?? right.priceMin ?? 0)
      if (sort === 'priceDesc') return Number(right.price ?? right.priceMin ?? 0) - Number(left.price ?? left.priceMin ?? 0)
      if (sort === 'stock') return Number(right.stockQuantity ?? 0) - Number(left.stockQuantity ?? 0)
      return right.id - left.id
    })
  }, [category, keyword, rows, sort])

  const submitSearch = (event: FormEvent): void => {
    event.preventDefault()
    const value = search.trim()
    window.location.href = `${PORTAL}#/chains${value ? `?q=${encodeURIComponent(value)}` : ''}`
  }

  return (
    <div className="hall-root shop-page">
      <div className="topbar">
        <div className="hall-container">
          <span>您好，欢迎来到丰链云交易大厅！智能大宗交易 · 平台撮合 · 支持在线议价</span>
          <span className="topbar-actions">
            <a href="/member/buyer">我是买家</a><span className="sep">·</span>
            <a href="/member/seller">我是卖家</a><span className="sep">·</span>
            <a href="/member/buyer">会员中心</a><span className="sep">·</span>
            <a href="#login" onClick={(event) => {
              event.preventDefault()
              void redirectToSso(`${window.location.pathname}${window.location.search}`)
            }}><UserOutlined />登录</a><span className="sep">·</span>
            <a href={SSO_REGISTER}>免费注册</a>
          </span>
        </div>
      </div>

      <header className="site-header">
        <div className="hall-container">
          <a className="hall-brand" href={PORTAL}>
            <span className="hall-logo"><BrandMark size={36} /></span>
            <span>丰链云<small>FENGCHAIN · AGRI</small></span>
          </a>
          <nav className="main-nav">
            <a href={PORTAL}>首页</a>
            <a href={`${PORTAL}#/chains`}>产业链</a>
            <a className="active" href="/hall">交易大厅</a>
            <a href={`${PORTAL}#/?scroll=price`}>价格指数</a>
            <a href={`${PORTAL}#/?scroll=news`}>产业资讯</a>
            <a href="/member/seller?tab=fund">供应链金融</a>
            <a href={`${PORTAL}#/logistics`}>物流服务</a>
          </nav>
          <form className="header-search" onSubmit={submitSearch}>
            <input value={search} onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索商品 / 供应商 / 需求" />
            <button type="submit"><SearchOutlined />搜索</button>
          </form>
        </div>
      </header>

      <main className="hall-container shop-main">
        <nav className="pd-crumb" aria-label="面包屑">
          <a href={PORTAL}>首页</a><span>/</span>
          <a href="/hall">交易大厅</a><span>/</span>
          <strong>{sellerName}</strong>
        </nav>

        <section className="shop-hero">
          <div className="shop-hero-main">
            <div className="shop-avatar"><ShopOutlined /></div>
            <div className="shop-intro">
              <div className="shop-kicker"><SafetyCertificateOutlined /> 平台在营供应商</div>
              <h1>{sellerName}</h1>
              <p>
                <EnvironmentOutlined /> {location || '所在地待补充'}
                <span>·</span>
                已上架 {seller?.productCount ?? rows.length} 款源头货源
              </p>
              <div className="shop-tags">
                {categories.slice(0, 5).map((item) => <span key={item}>{item}</span>)}
                <span>交易留痕</span>
                <span>平台撮合</span>
              </div>
            </div>
            <a className="shop-hero-action" href="#products">
              浏览全部货源 <ArrowRightOutlined />
            </a>
          </div>

          <div className="shop-metrics">
            <div><span>在售货源</span><strong>{seller?.productCount ?? rows.length}<small>款</small></strong></div>
            <div><span>覆盖品类</span><strong>{categories.length}<small>类</small></strong></div>
            <div><span>可供库存</span><strong>{compactNumber(totalStock)}<small>单位</small></strong></div>
            <div><span>起批价格</span><strong>{minPrice == null ? '询价' : money(minPrice)}</strong></div>
          </div>
        </section>

        {error && (
          <div className="shop-alert">
            <SafetyCertificateOutlined />
            <div><strong>店铺货源暂不可用</strong><span>{error}</span></div>
            <a href="/hall">返回交易大厅</a>
          </div>
        )}

        <div className="shop-layout">
          <section className="shop-products" id="products">
            <div className="shop-section-head">
              <div>
                <span>SUPPLIER PRODUCTS</span>
                <h2>在售货源</h2>
                <p>价格与库存来自交易域实时记录，点击商品查看完整规格与议价入口</p>
              </div>
              <em>{visibleProducts.length} / {rows.length} 款</em>
            </div>

            <div className="shop-toolbar">
              <Input
                allowClear
                prefix={<SearchOutlined />}
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索本店商品、品种或产地"
              />
              <Select
                value={sort}
                onChange={setSort}
                options={[
                  { value: 'newest', label: '最新上架' },
                  { value: 'priceAsc', label: '价格从低到高' },
                  { value: 'priceDesc', label: '价格从高到低' },
                  { value: 'stock', label: '库存优先' },
                ]}
              />
            </div>
            <div className="shop-category-row">
              <button type="button" className={!category ? 'on' : ''} onClick={() => setCategory('')}>全部品类</button>
              {categories.map((item) => (
                <button type="button" key={item} className={category === item ? 'on' : ''}
                  onClick={() => setCategory(item)}>{item}</button>
              ))}
            </div>

            {loading ? (
              <div className="shop-loading"><Spin /><span>正在读取供应商货源…</span></div>
            ) : visibleProducts.length === 0 ? (
              <div className="shop-empty">
                <Empty description={rows.length ? '没有符合筛选条件的货源' : '该店铺暂无在架货源'} />
                {rows.length > 0 && <button type="button" onClick={() => { setKeyword(''); setCategory('') }}>清除筛选</button>}
              </div>
            ) : (
              <div className="shop-product-grid">
                {visibleProducts.map((item) => (
                  <a className="shop-product-card" key={item.id} href={`/product/detail/${item.id}`}>
                    <div className="shop-product-visual">
                      <span><ShopOutlined /></span>
                      <em>在售</em>
                      <small>{item.categoryName || '农产品'}</small>
                    </div>
                    <div className="shop-product-body">
                      <span className="shop-product-cat">{item.categoryName || '平台货源'}</span>
                      <strong>{item.productName}</strong>
                      <p>{[item.variety, item.specification, item.origin].filter(Boolean).join(' · ') || '商品规格以详情页为准'}</p>
                      <div className="shop-product-data">
                        <span>起订 {compactNumber(Number(item.minOrderQuantity ?? 1))} {item.unit}</span>
                        <span>库存 {compactNumber(Number(item.stockQuantity ?? 0))} {item.unit}</span>
                        {(item.salesVolume ?? 0) > 0 && <span>成交 {item.salesVolume}</span>}
                      </div>
                      <div className="shop-product-foot">
                        <div><b>{money(item.price ?? item.priceMin)}</b><small>/{item.unit}</small></div>
                        <span>查看详情 <ArrowRightOutlined /></span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </section>

          <aside className="shop-aside">
            <div className="shop-aside-card">
              <div className="shop-aside-title"><ShopOutlined /><strong>供应商资料</strong></div>
              <dl>
                <div><dt>供应商名称</dt><dd>{sellerName}</dd></div>
                <div><dt>所在地</dt><dd>{location || '待补充'}</dd></div>
                <div><dt>主营品类</dt><dd>{categories.slice(0, 3).join('、') || '待补充'}</dd></div>
                <div><dt>货源数量</dt><dd>{seller?.productCount ?? rows.length} 款</dd></div>
              </dl>
              <a href="#products">查看该供应商全部商品 <ArrowRightOutlined /></a>
            </div>

            <div className="shop-aside-card shop-trust">
              <div className="shop-aside-title"><SafetyCertificateOutlined /><strong>交易保障</strong></div>
              <ul>
                <li><CheckCircleOutlined /><span><strong>货源信息真实</strong><small>商品资料与价格来自供应商发布记录</small></span></li>
                <li><TruckOutlined /><span><strong>履约全程留痕</strong><small>订单、物流、签收和售后均可追溯</small></span></li>
                <li><FileTextOutlined /><span><strong>合同与凭证留存</strong><small>支持在线签章、线下签署与平台存证</small></span></li>
              </ul>
            </div>

            <div className="shop-aside-card shop-guide">
              <div className="shop-aside-title"><ShoppingCartOutlined /><strong>采购流程</strong></div>
              <ol>
                <li><span>01</span>选择商品并查看规格</li>
                <li><span>02</span>立即下单或在线询价</li>
                <li><span>03</span>确认合同、支付与收货</li>
              </ol>
              <a href="/hall">继续浏览其他供应商</a>
            </div>
          </aside>
        </div>
      </main>

      <footer className="hall-footer">
        <div className="hall-container">
          <span>© 2026 农业产业互联网平台 · 丰链云供应商店铺</span>
          <span>店铺信息与货源均来自交易域公开数据。</span>
        </div>
      </footer>
    </div>
  )
}
