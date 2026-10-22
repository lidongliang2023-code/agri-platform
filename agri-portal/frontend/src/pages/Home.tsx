import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { useHashRoute, ssoRegister, tradeUrl } from '../utils'

interface LiveProduct {
  id: number
  productName: string
  sellerName?: string
  origin?: string
  specification?: string
  unit?: string
  price?: number
  categoryName?: string
}

interface ProductCard {
  name: string
  meta: string
  price: string
  unit: string
  tag: string
  tagCls: string
  icon: string
  theme: string
  href: string
}

interface LiveQuote {
  id: string | number
  productName: string
  category?: string
  price: number
  changePct?: number
  source?: string
  quotedAt?: string
}

interface LiveNews {
  id: string | number
  title: string
  summary?: string
  publishedAt?: string
}

interface NewsItem {
  tag: string
  tagCls: string
  title: string
  date: string
}

const SERVICES = [
  { icon: 'cart', title: '我要买', tag: '买家', desc: '发布采购需求 · 点选商品 · 淘供应商 · 共享库存', href: tradeUrl('/member/buyer?tab=publish') },
  { icon: 'box', title: '我要卖', tag: '卖家', desc: '发布商品 · 询单订阅 · 业绩认证 · 开店推广', href: tradeUrl('/member/seller?tab=publish'), tech: true },
  { icon: 'truck', title: '我要物流', tag: '物流', desc: '物流服务 · 仓储服务 · 冷链配送 · 物流商加盟', href: '#/logistics', amber: true },
  { icon: 'money', title: '我要资金', tag: '金融', desc: '订单融 · 收货融 · 折扣付 · 信用付', href: '#/finance' },
]

const CHAIN_CARDS = [
  { name: '粮油产业', icon: 'seed', desc: '稻谷 · 小麦 · 玉米 · 大豆 · 油脂', chips: ['一级菜籽油', '粳稻谷', '优质蛋白玉米', '富硒大米'] },
  { name: '果蔬产业', icon: 'sun', desc: '柑橘 · 苹果 · 设施蔬菜 · 食用菌', chips: ['赣南脐橙', '洛川苹果', '寿光蔬菜', '香菇'], amber: true },
  { name: '畜禽产业', icon: 'activity', desc: '生猪 · 肉牛 · 家禽 · 蛋奶', chips: ['冷鲜猪肉', '白羽肉鸡', '鲜鸡蛋', '生鲜乳'], tech: true },
  { name: '茶药产业', icon: 'leaf', desc: '茶叶 · 中药材 · 道地药材', chips: ['有机红茶', '西湖龙井', '三七', '枸杞'] },
  { name: '饲料农资', icon: 'box', desc: '饲料 · 化肥 · 农药 · 种子', chips: ['豆粕43%', '复合微生物肥', '尿素', '杂交玉米种'], amber: true },
  { name: '水产产业', icon: 'drop', desc: '淡水鱼 · 海水养殖 · 虾蟹', chips: ['加州鲈鱼', '南美白对虾', '大闸蟹', '海参'], tech: true },
]

const EMPOWERMENT = [
  { icon: 'chart', title: '价格指数', desc: '精准高效的专业行业交易大数据服务', tech: true },
  { icon: 'cpu', title: 'VR 云工厂', desc: '基地实景在线看货，远程验厂溯源' },
  { icon: 'leaf', title: '绿色供应链', desc: '碳核算 · 碳报告 · 绿色认证 · 碳咨询', amber: true },
  { icon: 'shield', title: '质量溯源', desc: '一物一码，从种植到流通全链路溯源', tech: true },
]

const THEMES = ['g', 'a', 't', 'o', 'v', 'g', 'a', 't']
const ICONS = ['seed', 'drop', 'box', 'sun', 'leaf', 'activity', 'factory', 'truck']

function liveCard(product: LiveProduct, index: number): ProductCard {
  return {
    name: product.productName,
    meta: [product.sellerName, product.origin, product.specification].filter(Boolean).join(' · ')
      || product.categoryName || '平台在售',
    price: product.price != null ? String(product.price) : '询价',
    unit: product.price != null ? `/ ${product.unit || '件'}` : '',
    tag: '平台在售',
    tagCls: '',
    icon: ICONS[index % ICONS.length],
    theme: THEMES[index % THEMES.length],
    href: tradeUrl(`/product/detail/${product.id}`),
  }
}

function NewsList({ items }: { items: NewsItem[] }): JSX.Element {
  return (
    <ul className="portal-news-list">
      {items.map((item) => (
        <li key={item.title}>
          <a href="#/certify">
            <span className={`tag ${item.tagCls}`}>{item.tag}</span>
            <span className="ellipsis portal-news-title">{item.title}</span>
            <span className="mono t-xs muted portal-news-date">{item.date}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}

export function Home(): JSX.Element {
  const route = useHashRoute()
  const [newsTab, setNewsTab] = useState<'policy' | 'market' | 'agri'>('policy')
  const [priceId, setPriceId] = useState<string | number>('')
  const [live, setLive] = useState<LiveProduct[] | null>(null)
  const [quotes, setQuotes] = useState<LiveQuote[]>([])
  const [news, setNews] = useState<LiveNews[]>([])
  const [announcements, setAnnouncements] = useState<LiveNews[]>([])
  const [newsLoading, setNewsLoading] = useState(true)
  const [quoteLoading, setQuoteLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/trade/public/products?limit=8')
      .then((response) => response.json())
      .then((body: { code?: number; data?: LiveProduct[] | { records?: LiveProduct[] } }) => {
        if (cancelled) return
        // 交易域 ApiResponse 的 code 是 200（认证域是 0），两种都接受
        const records = Array.isArray(body.data) ? body.data : body.data?.records
        if ((body.code === 0 || body.code === 200) && records && records.length > 0) {
          setLive(records)
        } else {
          setLive([])
        }
      })
      .catch(() => { if (!cancelled) setLive([]) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    setQuoteLoading(true)
    fetch('/api/v1/quotes?size=20')
      .then((response) => response.json())
      .then((body: { code?: number; data?: { records?: LiveQuote[] } }) => {
        if (cancelled || body.code !== 0) return
        const records = body.data?.records ?? []
        setQuotes(records)
        if (records.length > 0) setPriceId(records[0].id)
      })
      .catch(() => { if (!cancelled) setQuotes([]) })
      .finally(() => { if (!cancelled) setQuoteLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    const keyword = newsTab === 'policy' ? '政策' : newsTab === 'market' ? '行情' : '农技'
    setNewsLoading(true)
    fetch(`/api/v1/public/news?size=6&keyword=${encodeURIComponent(keyword)}`)
      .then((response) => response.json())
      .then((body: { code?: number; data?: { records?: LiveNews[] } }) => {
        if (!cancelled && body.code === 0) setNews(body.data?.records ?? [])
      })
      .catch(() => { if (!cancelled) setNews([]) })
      .finally(() => { if (!cancelled) setNewsLoading(false) })
    return () => { cancelled = true }
  }, [newsTab])

  useEffect(() => {
    let cancelled = false
    fetch('/api/v1/public/news?size=5&keyword=%E5%85%AC%E5%91%8A')
      .then((response) => response.json())
      .then((body: { code?: number; data?: { records?: LiveNews[] } }) => {
        if (!cancelled && body.code === 0) setAnnouncements(body.data?.records ?? [])
      })
      .catch(() => { if (!cancelled) setAnnouncements([]) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const target = route.query.get('scroll')
    if (target) {
      window.setTimeout(() => document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
    }
  }, [route])

  const cards = useMemo<ProductCard[]>(() => {
    return live?.slice(0, 8).map(liveCard) ?? []
  }, [live])

  const newsItems: NewsItem[] = news.map((item) => ({
    tag: newsTab === 'policy' ? '政策' : newsTab === 'market' ? '行情' : '农技',
    tagCls: newsTab === 'market' ? 'tag-tech' : newsTab === 'policy' ? 'tag-red' : '',
    title: item.title,
    date: item.publishedAt ? item.publishedAt.slice(5, 10).replace('-', '/') : '',
  }))
  const announcementItems: NewsItem[] = announcements.map((item) => ({
    tag: '公告',
    tagCls: 'tag-tech',
    title: item.title,
    date: item.publishedAt ? item.publishedAt.slice(5, 10).replace('-', '/') : '',
  }))

  return (
    <>
      <section className="portal-hero">
        <div className="container portal-hero-inner">
          <div>
            <div className="portal-hero-badge"><Icon name="spark" size={14} />农业产业互联网平台</div>
            <h1>从田间到餐桌<br />一站式农业产业互联网平台</h1>
            <p>
              聚合全国农产品供需，提供交易撮合、智能寻源、物联网监测、供应链金融与产业数据服务，
              让产销对接更高效、更透明。
            </p>
            <div className="portal-hero-actions">
              <a className="btn btn-lg portal-btn-light" href="#/hall">我要采购</a>
              <a className="btn btn-lg btn-outline portal-btn-ghost" href={tradeUrl('/member/seller?tab=publish')} target="_blank" rel="noreferrer">我要供货</a>
            </div>
            <div className="portal-hot-search">
              热搜：
              <a href="#/chains?q=富硒大米">富硒大米</a> ·
              <a href="#/chains?q=菜籽油">一级菜籽油</a> ·
              <a href="#/chains?q=玉米">优质蛋白玉米</a> ·
              <a href="#/chains?q=脐橙">赣南脐橙</a>
            </div>
          </div>
          <div className="portal-hero-metrics">
            <div className="portal-hero-metric">
              <span><Icon name="cart" size={14} /> 智能大宗交易</span>
              <strong>¥ 1268<small>亿</small></strong>
              <em>近一年成交金额（平台口径）</em>
            </div>
            <div className="portal-hero-metric">
              <span><Icon name="cpu" size={14} /> 物联网接入设备</span>
              <strong>12.6<small>万台</small></strong>
              <em>覆盖 3860 个基地</em>
            </div>
          </div>
        </div>
      </section>

      <section className="portal-statbar">
        <div className="container portal-stat-grid">
          <div><strong>1268<small>亿</small></strong><span>近一年成交金额</span></div>
          <div><strong>42<small>万笔</small></strong><span>近一年成交笔数</span></div>
          <div><strong>186<small>万个</small></strong><span>上架商品数</span></div>
          <div><strong>38<small>万家</small></strong><span>累计注册用户</span></div>
        </div>
      </section>

      <section className="section portal-section-tight">
        <div className="container">
          <div className="grid grid-4">
            {SERVICES.map((item) => (
              <div className="card card-hover" key={item.title}>
                <div className="card-b">
                  <div className="row between center mb-12">
                    <div className={`stat-icon${item.tech ? ' tech' : item.amber ? ' amber' : ''}`}><Icon name={item.icon} size={20} /></div>
                    <span className="tag tag-ghost">{item.tag}</span>
                  </div>
                  <div className="strong t-lg">{item.title}</div>
                  <div className="muted t-sm mt-8 portal-two-line">{item.desc}</div>
                  <a className="btn btn-sm btn-outline mt-16" href={item.href}
                    target={item.href.startsWith('#') ? undefined : '_blank'}
                    rel={item.href.startsWith('#') ? undefined : 'noreferrer'}>立即进入</a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="chains">
        <div className="container">
          <div className="section-head">
            <div>
              <div className="bar-title">产业链频道</div>
              <div className="sub">按产业链聚合供需，快速定位品类与货源</div>
            </div>
            <a className="t-sm muted portal-more-link" href="#/chains">查看全部产业链 →</a>
          </div>
          <div className="grid grid-3">
            {CHAIN_CARDS.map((chain) => (
              <a className="card card-hover" key={chain.name} href={`#/chains?l1=${encodeURIComponent(chain.name)}`}>
                <div className="card-b">
                  <div className="row center gap-12 mb-12">
                    <div className={`stat-icon${chain.tech ? ' tech' : chain.amber ? ' amber' : ''}`}><Icon name={chain.icon} size={20} /></div>
                    <div>
                      <div className="strong">{chain.name}</div>
                      <div className="muted t-xs">{chain.desc}</div>
                    </div>
                  </div>
                  <div className="chips">
                    {chain.chips.map((chip, index) => <span className={`chip${index === 0 ? ' on' : ''}`} key={chip}>{chip}</span>)}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="section portal-section-alt">
        <div className="container">
          <div className="section-head">
            <div>
              <div className="bar-title">热销商品优选</div>
              <div className="sub">基地直供 · 平台质检 · 支持大宗议价</div>
            </div>
            <div className="row center gap-8">
              <span className={`tag ${live && live.length > 0 ? '' : 'tag-amber'}`}>
                {live && live.length > 0 ? '实时在售' : '暂无在售'}
              </span>
              <a className="t-sm muted portal-more-link" href="#/hall">查看更多商品 →</a>
            </div>
          </div>
          {live && live.length === 0 && (
            <div className="portal-data-note">
              交易服务当前没有已发布商品。供应商发布并审核上架后，商品会自动展示在此处。
            </div>
          )}
          {cards.length > 0 ? (
            <div className="grid grid-4">
              {cards.map((card) => (
                <a className="card card-hover" key={`${card.name}-${card.href}`} href={card.href} target="_blank" rel="noreferrer">
                  <div className="card-b">
                    <div className={`portal-thumb theme-${card.theme}`}><Icon name={card.icon} size={46} /></div>
                    <div className="row between center mt-12 gap-8">
                      <span className="strong ellipsis">{card.name}</span>
                      <span className={`tag ${card.tagCls}`}>{card.tag}</span>
                    </div>
                    <div className="muted t-xs mt-8 ellipsis">{card.meta}</div>
                    <div className="row between center mt-12">
                      <span className="price"><span className="cur">¥</span>{card.price}<span className="unit">{card.unit}</span></span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          ) : live && (
            <div className="card empty">
              <Icon name="box" size={34} />
              <div className="strong mt-12">暂无在售商品</div>
              <div className="muted t-sm mt-8">可先到交易大厅浏览采购需求，或发布供应商品。</div>
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="container portal-two-col">
          <div className="card" id="price">
            <div className="card-h">
              <h3><Icon name="chart" size={18} />价格指数</h3>
              <span className={`tag ${quotes.length > 0 ? '' : 'tag-amber'}`}>{quotes.length > 0 ? '平台行情' : '暂无行情'}</span>
            </div>
            <div className="card-b">
              <p className="muted t-sm mb-16">展示平台已发布的行情报价；没有运营发布记录时保持空态，不使用模拟价格。</p>
              {quotes.length > 0 && (
                <div className="chips mb-16">
                  {quotes.map((item) => (
                    <button type="button" className={`chip${item.id === priceId ? ' on' : ''}`} key={item.id}
                      onClick={() => setPriceId(item.id)}>{item.productName}</button>
                  ))}
                </div>
              )}
              {quoteLoading ? (
                <div className="empty"><div className="muted t-sm">正在读取行情…</div></div>
              ) : quotes.length > 0 ? (
                <table className="data-table">
                  <thead><tr><th>商品</th><th>最新价</th><th className="tr">涨跌</th><th>来源 / 日期</th></tr></thead>
                  <tbody>
                    {quotes.filter((item) => item.id === priceId).map((item) => (
                      <tr key={item.id}>
                        <td>{item.productName}<div className="muted t-xs">{item.category || '平台行情'}</div></td>
                        <td className="mono">¥{Number(item.price).toFixed(2)}</td>
                        <td className={`tr mono${(item.changePct ?? 0) < 0 ? ' c-red' : (item.changePct ?? 0) > 0 ? ' c-green' : ''}`}>
                          {item.changePct == null ? '—' : `${item.changePct > 0 ? '+' : ''}${item.changePct}%`}
                        </td>
                        <td>{item.source || '平台发布'}<div className="muted t-xs">{item.quotedAt?.slice(0, 10) || '—'}</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty">
                  <Icon name="chart" size={30} />
                  <div className="strong mt-12">暂无已发布行情</div>
                  <div className="muted t-sm mt-8">运营端发布报价后自动展示。</div>
                </div>
              )}
            </div>
          </div>

          <div className="card" id="news">
            <div className="card-h">
              <h3><Icon name="file" size={18} />产业资讯</h3>
              <span className="more">决策智能中枢</span>
            </div>
            <div className="card-b">
              <div className="tabs mb-16">
                <button type="button" className={newsTab === 'policy' ? 'on' : ''} onClick={() => setNewsTab('policy')}>政策法规</button>
                <button type="button" className={newsTab === 'market' ? 'on' : ''} onClick={() => setNewsTab('market')}>市场行情</button>
                <button type="button" className={newsTab === 'agri' ? 'on' : ''} onClick={() => setNewsTab('agri')}>农技服务</button>
              </div>
              {newsLoading
                ? <div className="empty"><div className="muted t-sm">正在读取资讯…</div></div>
                : newsItems.length > 0
                  ? <NewsList items={newsItems} />
                  : <div className="empty"><div className="strong">暂无相关资讯</div><div className="muted t-sm mt-8">运营端发布后自动同步到门户。</div></div>}
            </div>
          </div>
        </div>
      </section>

      <section className="section portal-section-alt">
        <div className="container">
          <div className="section-head">
            <div>
              <div className="bar-title">产业赋能服务</div>
              <div className="sub">综合服务引擎 · 助力产业链上下游降本增效</div>
            </div>
          </div>
          <div className="grid grid-4">
            {EMPOWERMENT.map((item) => (
              <div className="card card-hover" key={item.title}>
                <div className="card-b">
                  <div className={`stat-icon mb-12${item.tech ? ' tech' : item.amber ? ' amber' : ''}`}><Icon name={item.icon} size={20} /></div>
                  <div className="strong">{item.title}</div>
                  <div className="muted t-sm mt-8 portal-two-line">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section portal-last-section">
        <div className="container portal-announce-grid">
          <div className="card">
            <div className="card-h"><h3><Icon name="bell" size={18} />平台公告</h3><span className="tag tag-ghost">平台发布</span></div>
            <div className="card-b">
              {announcementItems.length > 0 ? announcementItems.map((item) => (
                <div className="portal-announce-row" key={item.title}>
                  <span className={`tag ${item.tagCls}`}>{item.tag}</span>
                  <span className="ellipsis">{item.title}</span>
                  <span className="mono t-xs muted">{item.date}</span>
                </div>
              )) : <div className="empty"><div className="muted t-sm">暂无平台公告</div></div>}
            </div>
          </div>
          <div className="card portal-join-card">
            <div className="card-b">
              <div className="t-2xl strong">供应商入驻</div>
              <p>免费开店 · 精准询单 · 平台流量扶持 · 供应链金融支持，助您生意做大做强。</p>
              <div className="row gap-8 mt-20 portal-wrap">
                <a className="btn portal-btn-light" href={ssoRegister()}>立即入驻</a>
                <a className="btn btn-outline portal-btn-ghost" href="#/certify">认证说明</a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

