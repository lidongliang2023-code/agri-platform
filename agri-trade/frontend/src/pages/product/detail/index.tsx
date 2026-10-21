import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Empty, InputNumber, Spin, message } from 'antd'
import {
  AppstoreOutlined,
  CheckCircleOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  ThunderboltOutlined,
  TruckOutlined,
  UserOutlined,
} from '@ant-design/icons'
import {
  getPublicProductById,
  getPublicProductImages,
  type PublicProductDetail,
} from '@/api/product'
import { isLoggedIn } from '@/utils/session'
import '../../hall/hall.css'
import './product-detail.css'

interface DetailImage {
  id: number
  imageUrl: string
  imageType: string
  sortOrder: number
}

interface SimilarProduct {
  id: number
  productName: string
  sellerName?: string | null
  categoryName?: string | null
  variety?: string | null
  origin?: string
  specification?: string | null
  unit: string
  price?: number | null
  priceMin?: number | null
}

type DetailTab = 'intro' | 'spec' | 'supplier' | 'records'

const PORTAL = `${window.location.protocol}//${window.location.hostname}:8098/portal/`
const SSO_REGISTER = `${window.location.protocol}//${window.location.hostname}:8090/register`

const TABS: { key: DetailTab; label: string }[] = [
  { key: 'intro', label: '商品详情' },
  { key: 'spec', label: '规格参数' },
  { key: 'supplier', label: '供应商信息' },
  { key: 'records', label: '交易记录' },
]

const money = (value: number | null | undefined): string =>
  value == null ? '询价' : `¥${Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`

const valueOr = (value: string | number | null | undefined, fallback = '待补充'): string =>
  value == null || value === '' ? fallback : String(value)

const dateText = (value: string | null | undefined): string =>
  value ? String(value).slice(0, 10) : '—'

function parseCertifications(raw: string | null): string[] {
  if (!raw?.trim()) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => typeof item === 'string'
          ? item
          : item && typeof item === 'object'
            ? String((item as Record<string, unknown>).name ?? (item as Record<string, unknown>).type ?? '')
            : '')
        .filter(Boolean)
    }
    return parsed ? [String(parsed)] : []
  } catch {
    return raw.split(/[,，;；]/).map((item) => item.trim()).filter(Boolean)
  }
}

function ProductVisual({
  src,
  alt,
  compact = false,
}: {
  src?: string
  alt: string
  compact?: boolean
}): JSX.Element {
  const [failed, setFailed] = useState(false)

  useEffect(() => setFailed(false), [src])

  if (!src || failed) {
    return (
      <div className={`pd-placeholder${compact ? ' compact' : ''}`}>
        <span><ShopOutlined /></span>
        {!compact && <><strong>商品图片待上传</strong><small>页面已按真实商品资料展示</small></>}
      </div>
    )
  }
  return <img src={src} alt={alt} onError={() => setFailed(true)} />
}

function InfoLine({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="pd-info-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export default function ProductDetail(): JSX.Element {
  const { id } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState<PublicProductDetail | null>(null)
  const [images, setImages] = useState<DetailImage[]>([])
  const [similar, setSimilar] = useState<SimilarProduct[]>([])
  const [activeImage, setActiveImage] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [tab, setTab] = useState<DetailTab>('intro')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    Promise.all([getPublicProductById(id), getPublicProductImages(id)])
      .then(([productRes, imageRes]) => {
        if (cancelled) return
        if (productRes?.code !== 200 || !productRes.data) {
          message.error(productRes?.message ?? '商品不存在或已下架')
          return
        }
        const detail = productRes.data as PublicProductDetail
        setProduct(detail)
        setImages(imageRes?.code === 200 ? imageRes.data ?? [] : [])
        setQuantity(Number(detail.minOrderQuantity ?? 1))
      })
      .catch(() => message.error('加载商品详情失败，请确认交易服务已启动'))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  useEffect(() => {
    if (!product) return
    let cancelled = false
    const load = async (): Promise<void> => {
      try {
        const categoryId = product.categoryId
        let rows: SimilarProduct[] = []
        if (categoryId) {
          const response = await fetch(
            `/api/trade/public/hall/products?pageNum=1&pageSize=5&categoryIds=${categoryId}`,
          )
          const body = await response.json() as {
            code?: number
            data?: SimilarProduct[] | { records?: SimilarProduct[] }
          }
          if (body.code === 200) {
            rows = Array.isArray(body.data) ? body.data : body.data?.records ?? []
          }
        }
        let candidates = rows.filter((item) => item.id !== product.id)
        if (candidates.length === 0) {
          const response = await fetch('/api/trade/public/products?limit=8')
          const body = await response.json() as { code?: number; data?: SimilarProduct[] }
          if (body.code === 200 && Array.isArray(body.data)) {
            candidates = body.data.filter((item) => item.id !== product.id)
          }
        }
        if (!cancelled) setSimilar(candidates.slice(0, 4))
      } catch {
        if (!cancelled) setSimilar([])
      }
    }
    void load()
    return () => { cancelled = true }
  }, [product])

  const certifications = useMemo(
    () => parseCertifications(product?.certificationJson ?? null),
    [product?.certificationJson],
  )

  const origin = product
    ? [product.originProvince, product.originCity, product.originDistrict].filter(Boolean).join(' ')
    : ''
  const originFull = product
    ? [origin, product.originAddress].filter(Boolean).join(' ')
    : ''
  const minOrder = Number(product?.minOrderQuantity ?? 1)
  const stock = Number(product?.stockQuantity ?? 0)
  const price = product?.price ?? product?.priceMin ?? null
  const quantityValid = quantity >= minOrder && (stock <= 0 || quantity <= stock)
  const estimate = price == null ? null : price * quantity
  const currentImage = images[activeImage]?.imageUrl

  const submitSearch = (event: FormEvent): void => {
    event.preventDefault()
    const value = search.trim()
    window.location.href = `${PORTAL}#/chains${value ? `?q=${encodeURIComponent(value)}` : ''}`
  }

  const goProtected = (path: string): void => {
    if (!isLoggedIn()) {
      navigate(`/login?redirect=${encodeURIComponent(path)}`)
      return
    }
    navigate(path)
  }

  if (loading) {
    return (
      <div className="pd-loading">
        <Spin size="large" />
        <span>正在读取商品详情…</span>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="pd-error-page">
        <Empty description="商品不存在或已下架" />
        <a className="pd-primary" href="/hall">返回交易大厅</a>
      </div>
    )
  }

  return (
    <div className="hall-root">
      <div className="topbar">
        <div className="hall-container">
          <span>您好，欢迎来到农产云交易大厅！智能大宗交易 · 平台撮合 · 支持在线议价</span>
          <span className="topbar-actions">
            <a href="/member/buyer">我是买家</a><span className="sep">·</span>
            <a href="/member/seller">我是卖家</a><span className="sep">·</span>
            <a href="/member/buyer">会员中心</a><span className="sep">·</span>
            <a href="/login"><UserOutlined />登录</a><span className="sep">·</span>
            <a href={SSO_REGISTER}>免费注册</a>
          </span>
        </div>
      </div>

      <header className="site-header">
        <div className="hall-container">
          <a className="hall-brand" href={PORTAL}>
            <span className="hall-logo"><AppstoreOutlined /></span>
            <span>农产云<small>AGRI · CLOUD</small></span>
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

      <main className="hall-container pd-main">
        <nav className="pd-crumb" aria-label="面包屑">
          <a href={PORTAL}>首页</a><span>/</span>
          <a href="/hall">交易大厅</a><span>/</span>
          <strong>{product.productName}</strong>
        </nav>

        <section className="pd-hero">
          <div className="pd-gallery">
            <div className="pd-main-image">
              <ProductVisual src={currentImage} alt={product.productName} />
              <span className="pd-live-badge">平台在售</span>
            </div>
            {images.length > 0 && (
              <div className="pd-thumbs">
                {images.map((item, index) => (
                  <button type="button" key={item.id}
                    className={`pd-thumb${index === activeImage ? ' on' : ''}`}
                    onClick={() => setActiveImage(index)}
                    aria-label={`查看商品图片 ${index + 1}`}>
                    <ProductVisual src={item.imageUrl} alt={`${product.productName} ${index + 1}`} compact />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="pd-summary">
            <div className="pd-title-row">
              <div>
                <span className="pd-category">{product.categoryName || '农产品'}</span>
                <h1>{product.productName}</h1>
                <p>{[product.variety, product.specSize, origin].filter(Boolean).join(' · ') || '商品详情以供应商发布资料为准'}</p>
              </div>
              <span className="hall-tag tech">{product.publishStatus === 'published' ? '已发布' : product.publishStatus}</span>
            </div>

            <div className="pd-price-panel">
              <div className="pd-current-price">
                <span>当前报价</span>
                <strong>{money(price)}<small>{price == null ? '' : ` / ${product.unit}`}</small></strong>
                <em>起订 {minOrder} {product.unit}</em>
              </div>
              <div className="pd-reference-grid">
                <div><span>参考最低价</span><strong>{money(product.priceMin)}</strong></div>
                <div><span>当前报价</span><strong>{money(product.price)}</strong></div>
                <div><span>参考最高价</span><strong>{money(product.priceMax)}</strong></div>
              </div>
              <p>价格与库存来自交易域实时商品记录；成交价以询价、报价或订单确认结果为准。</p>
            </div>

            <div className="pd-info-grid">
              <InfoLine label="规格" value={valueOr(product.specSize || product.specLevel)} />
              <InfoLine label="产地" value={valueOr(origin)} />
              <InfoLine label="品种" value={valueOr(product.variety)} />
              <InfoLine label="质量等级" value={valueOr(product.qualityLevel || product.specLevel)} />
              <InfoLine label="库存" value={`${stock || '—'} ${product.unit}`} />
              <InfoLine label="采收批次" value={valueOr(product.harvestBatchNo)} />
            </div>

            <div className="pd-supplier-strip">
              <span className="pd-supplier-icon"><ShopOutlined /></span>
              <div>
                <strong>{product.sellerName || '平台供应商'}</strong>
                <span><EnvironmentOutlined /> {valueOr(originFull)}</span>
              </div>
              <div className="pd-supplier-tags">
                <span>{product.categoryName || '农产品'}</span>
                <span>{stock > 0 ? '现货供应' : '库存待确认'}</span>
              </div>
            </div>

            <div className="pd-buybox">
              <div className="pd-quantity">
                <span>采购数量</span>
                <InputNumber min={minOrder} max={stock > 0 ? stock : undefined} value={quantity}
                  onChange={(value) => setQuantity(Number(value ?? minOrder))} controls />
                <em>{product.unit}</em>
              </div>
              <div className="pd-estimate">
                <span>预计货款</span>
                <strong>{estimate == null ? '以询价为准' : money(estimate)}</strong>
              </div>
            </div>
            <p className={`pd-quantity-hint${quantityValid ? '' : ' error'}`}>
              {quantityValid
                ? `数量需满足起订量 ${minOrder} ${product.unit}${stock > 0 ? `，当前库存 ${stock} ${product.unit}` : ''}`
                : `采购数量应在 ${minOrder} 至 ${stock || '库存上限'} ${product.unit} 之间`}
            </p>

            <div className="pd-actions">
              <button type="button" className="pd-primary" disabled={!quantityValid}
                onClick={() => goProtected(`/order/create?productId=${product.id}&quantity=${quantity}`)}>
                <ThunderboltOutlined />立即下单
              </button>
              <button type="button" className="pd-outline" disabled={!quantityValid}
                onClick={() => goProtected(`/demand/create?productId=${product.id}&quantity=${quantity}`)}>
                <ShoppingCartOutlined />发布采购需求
              </button>
              <button type="button" className="pd-ghost"
                onClick={() => goProtected(`/shop/${product.sellerId}`)}>
                <ShopOutlined />进入店铺询价
              </button>
              <button type="button" className="pd-text-action"
                onClick={() => document.getElementById('negotiation')?.scrollIntoView({ behavior: 'smooth' })}>
                了解在线议价流程
              </button>
            </div>
            <div className="pd-trust-line">
              <span><SafetyCertificateOutlined /> 商品资料由供应商发布</span>
              <span><TruckOutlined /> 交付方式在订单确认时约定</span>
            </div>
          </div>
        </section>

        <section className="pd-card pd-negotiation" id="negotiation">
          <div className="pd-card-head">
            <div><ThunderboltOutlined /><strong>在线议价</strong><span>按真实采购需求与供应商报价推进</span></div>
            <span className="hall-tag">平台留痕</span>
          </div>
          <div className="pd-negotiation-body">
            {[
              ['01', '提交采购需求', '带入当前商品、品种、数量与期望价格。'],
              ['02', '供应商在线报价', '供应商在卖家中心处理询价并返回正式报价。'],
              ['03', '接受报价并下单', '买卖双方按报价与订单信息确认数量、价格和交付安排。'],
            ].map(([step, title, desc]) => (
              <div className="pd-step" key={step}>
                <span>{step}</span>
                <div><strong>{title}</strong><p>{desc}</p></div>
              </div>
            ))}
            <button type="button" className="pd-outline"
              onClick={() => goProtected(`/demand/create?productId=${product.id}&quantity=${quantity}`)}>
              发起真实议价
            </button>
          </div>
          <p className="pd-negotiation-note">页面不展示演示聊天或无来源报价；议价记录以询价单、供应商报价和订单为准。</p>
        </section>

        <section className="pd-card pd-detail-card">
          <div className="pd-tabs" role="tablist" aria-label="商品详情页签">
            {TABS.map((item) => (
              <button type="button" key={item.key} role="tab" aria-selected={tab === item.key}
                className={tab === item.key ? 'on' : ''} onClick={() => setTab(item.key)}>{item.label}</button>
            ))}
          </div>

          {tab === 'intro' && (
            <div className="pd-tab-panel">
              <div className="pd-description">
                <h2>商品说明</h2>
                <p>{product.description || '供应商暂未填写商品说明。'}</p>
              </div>
              <div className="pd-feature-grid">
                <div><EnvironmentOutlined /><strong>产地信息</strong><span>{originFull || '待供应商补充'}</span></div>
                <div><SafetyCertificateOutlined /><strong>质量资料</strong><span>{product.qualityLevel || (certifications.length ? certifications.join('、') : '以供应商上传资料为准')}</span></div>
                <div><TruckOutlined /><strong>供应能力</strong><span>{stock > 0 ? `当前库存 ${stock} ${product.unit}` : '库存待确认'}</span></div>
              </div>
              {(product.qualityReportUrl || certifications.length > 0) && (
                <div className="pd-proof-row">
                  {product.qualityReportUrl && (
                    <a href={product.qualityReportUrl} target="_blank" rel="noreferrer"><FileTextOutlined />查看质量报告</a>
                  )}
                  {certifications.map((item) => <span key={item}><CheckCircleOutlined />{item}</span>)}
                </div>
              )}
            </div>
          )}

          {tab === 'spec' && (
            <div className="pd-tab-panel">
              <table className="pd-spec-table">
                <tbody>
                  <tr><th>产品名称</th><td>{product.productName}</td><th>商品编码</th><td>{product.productCode}</td></tr>
                  <tr><th>品类</th><td>{valueOr(product.categoryName)}</td><th>品种</th><td>{valueOr(product.variety)}</td></tr>
                  <tr><th>规格</th><td>{valueOr(product.specSize)}</td><th>等级</th><td>{valueOr(product.specLevel || product.qualityLevel)}</td></tr>
                  <tr><th>产地</th><td>{valueOr(originFull)}</td><th>发货批次</th><td>{valueOr(product.harvestBatchNo)}</td></tr>
                  <tr><th>起订量</th><td>{minOrder} {product.unit}</td><th>库存</th><td>{stock || '—'} {product.unit}</td></tr>
                  <tr><th>报价类型</th><td>{product.priceType || '平台报价'}</td><th>发布时间</th><td>{dateText(product.createTime)}</td></tr>
                </tbody>
              </table>
            </div>
          )}

          {tab === 'supplier' && (
            <div className="pd-tab-panel">
              <div className="pd-supplier-profile">
                <span className="pd-supplier-avatar"><ShopOutlined /></span>
                <div>
                  <h3>{product.sellerName || '平台供应商'}</h3>
                  <p><EnvironmentOutlined /> {originFull || '所在地待补充'} · 当前商品共 {stock || '—'} {product.unit} 可供</p>
                </div>
                <button type="button" className="pd-outline" onClick={() => goProtected(`/shop/${product.sellerId}`)}>查看店铺</button>
              </div>
              <div className="pd-supplier-data">
                <InfoLine label="主营品类" value={valueOr(product.categoryName)} />
                <InfoLine label="当前商品浏览" value={`${product.viewCount ?? 0} 次`} />
                <InfoLine label="当前商品询价" value={`${product.inquiryCount ?? 0} 次`} />
                <InfoLine label="商品收藏" value={`${product.favoriteCount ?? 0} 次`} />
              </div>
            </div>
          )}

          {tab === 'records' && (
            <div className="pd-tab-panel">
              <Empty description="暂无公开的逐笔成交记录" />
              <p className="pd-records-note">为保护买卖双方商业信息，逐笔订单仅在登录且具备对应主体权限时查看。</p>
              <button type="button" className="pd-outline"
                onClick={() => goProtected('/member/buyer?tab=purchase')}>登录后查看我的交易</button>
            </div>
          )}
        </section>

        <section className="pd-similar">
          <div className="pd-section-head">
            <div><h2>相似商品推荐</h2><p>同品类已发布货源，可直接进入详情比较</p></div>
            <a href="/hall">返回交易大厅 →</a>
          </div>
          {similar.length > 0 ? (
            <div className="pd-similar-grid">
              {similar.map((item) => (
                <a className="pd-similar-card" href={`/product/detail/${item.id}`} key={item.id}>
                  <div className="pd-similar-visual"><ProductVisual compact alt={item.productName} /></div>
                  <strong>{item.productName}</strong>
                  <span>{[item.origin, item.specification || item.variety].filter(Boolean).join(' · ') || item.categoryName}</span>
                  <div><b>{money(item.price ?? item.priceMin)}<small>{item.price == null ? '' : `/${item.unit}`}</small></b><em>{item.sellerName || '供应商'}</em></div>
                </a>
              ))}
            </div>
          ) : (
            <div className="pd-empty-similar">暂无同品类推荐货源</div>
          )}
        </section>
      </main>

      <footer className="hall-footer">
        <div className="hall-container">
          <span>© 2026 农业产业互联网平台 · 农产云商品详情</span>
          <span>商品、库存与价格来自交易域实时记录；下单与议价需登录。</span>
        </div>
      </footer>
    </div>
  )
}
