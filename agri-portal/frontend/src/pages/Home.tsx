import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Icon } from '../components/Icon'
import { useHashRoute, ssoRegister, tradeUrl } from '../utils'
import { infoPublicApi, dayLabel, type Article, type Channel, type Quote } from './info/infoApi'

/**
 * 官网门户首页。
 *
 * <p>四块业务数据全部来自后端的公开只读通道，本页不再有写死的业务数字：</p>
 * <ul>
 *   <li>在售货源与大盘指标 → 交易域 {@code /api/trade/public/*}</li>
 *   <li>行情与资讯 → 资讯域 {@code /api/v1/info/public/*}（栏目由运营在资讯运营端维护）</li>
 *   <li>平台公告 → 主数据域 {@code /api/master-data/public/announcements}</li>
 * </ul>
 *
 * <p>改前的样子：大盘是「1268 亿 / 42 万笔 / 186 万件 / 38 万人」四个前端常量；资讯和公告读的是
 * core-platform 的遗留表 {@code svc_news}（0 行），所以无论运营发多少内容，首页永远显示"暂无"；
 * 行情读 {@code svc_quote}（只剩一条建库种子）。每条资讯的链接还统一指向认证说明页。
 * 这些都属于"接口能通、数据是真的、页面却在说另一件事"，比直接报错更难发现。</p>
 *
 * <p>取不到数时明确写"暂时读不到 + 原因"，不退化成空态，也不回落到旧常量。</p>
 */

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

interface PlatformStat {
  tradeAmount?: number
  dealCount?: number
  participantCount?: number
  publishedProductCount?: number
}

interface PortalAnnouncement {
  id: string
  title: string
  type?: string
  content?: string
  publishTime?: string
}

interface Envelope<T> {
  code?: number
  message?: string
  data?: T
}

/** 门户是匿名访问，公开接口出错时必须能让用户看出是"服务没响应"而不是"平台没内容"。 */
async function readPublicJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`服务响应 HTTP ${response.status}`)
  const body = (await response.json()) as Envelope<T>
  // 认证域成功码是 0，交易/主数据/资讯域是 200
  if (body.code !== 0 && body.code !== 200) throw new Error(body.message || '服务返回异常')
  if (body.data === undefined || body.data === null) throw new Error('服务没有返回数据')
  return body.data
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

/** 金额按真实量级换单位，不再把"元"当"亿"显示。 */
function formatAmount(value?: number): { text: string; unit: string } {
  if (value === undefined || value === null) return { text: '—', unit: '' }
  if (value >= 1e8) return { text: (value / 1e8).toFixed(2), unit: '亿元' }
  if (value >= 1e4) return { text: (value / 1e4).toFixed(2), unit: '万元' }
  return { text: value.toFixed(2), unit: '元' }
}

function formatCount(value?: number, unit = ''): { text: string; unit: string } {
  if (value === undefined || value === null) return { text: '—', unit: '' }
  if (value >= 1e4) return { text: (value / 1e4).toFixed(1), unit: `万${unit}` }
  return { text: String(value), unit }
}

const ANNOUNCEMENT_LABELS: Record<string, { label: string; tagCls: string }> = {
  info: { label: '公告', tagCls: 'tag-tech' },
  warning: { label: '提醒', tagCls: 'tag-amber' },
  maintenance: { label: '维护', tagCls: '' },
  emergency: { label: '紧急', tagCls: 'tag-red' },
}

function DataNote({ children }: { children: ReactNode }): JSX.Element {
  return <div className="portal-data-note">{children}</div>
}

export function Home(): JSX.Element {
  const route = useHashRoute()
  const [live, setLive] = useState<LiveProduct[] | null>(null)
  const [liveError, setLiveError] = useState('')
  const [stat, setStat] = useState<PlatformStat | null>(null)
  const [statError, setStatError] = useState('')
  const [quotes, setQuotes] = useState<Quote[] | null>(null)
  const [marketStats, setMarketStats] = useState<Record<string, number>>({})
  const [marketError, setMarketError] = useState('')
  const [channels, setChannels] = useState<Channel[]>([])
  const [channelError, setChannelError] = useState('')
  const [channelName, setChannelName] = useState('')
  const [articles, setArticles] = useState<Article[] | null>(null)
  const [articlesTotal, setArticlesTotal] = useState(0)
  const [articlesLoading, setArticlesLoading] = useState(true)
  const [articlesError, setArticlesError] = useState('')
  const [announcements, setAnnouncements] = useState<PortalAnnouncement[] | null>(null)
  const [announcementError, setAnnouncementError] = useState('')
  const [openAnnouncement, setOpenAnnouncement] = useState('')

  useEffect(() => {
    let cancelled = false
    readPublicJson<LiveProduct[]>('/api/trade/public/products?limit=8')
      .then((records) => { if (!cancelled) { setLive(records); setLiveError('') } })
      .catch((reason: Error) => { if (!cancelled) { setLive([]); setLiveError(reason.message) } })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    readPublicJson<PlatformStat>('/api/trade/public/summary')
      .then((data) => { if (!cancelled) { setStat(data); setStatError('') } })
      .catch((reason: Error) => { if (!cancelled) { setStat(null); setStatError(reason.message) } })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    infoPublicApi.markets()
      .then((result) => {
        if (cancelled) return
        setQuotes(result.quotes ?? [])
        setMarketStats(result.stats ?? {})
        setMarketError('')
      })
      .catch((reason: Error) => { if (!cancelled) { setQuotes([]); setMarketError(reason.message) } })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    infoPublicApi.channels()
      .then((list) => {
        if (cancelled) return
        setChannels(list)
        setChannelError('')
        if (list.length > 0) setChannelName((current) => current || list[0].name)
      })
      .catch((reason: Error) => { if (!cancelled) { setChannels([]); setChannelError(reason.message) } })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!channelName) return undefined
    let cancelled = false
    setArticlesLoading(true)
    infoPublicApi.articles({ channel: channelName, size: 6 })
      .then((result) => {
        if (cancelled) return
        setArticles(result.items ?? [])
        setArticlesTotal(result.total ?? 0)
        setArticlesError('')
      })
      .catch((reason: Error) => { if (!cancelled) { setArticles([]); setArticlesTotal(0); setArticlesError(reason.message) } })
      .finally(() => { if (!cancelled) setArticlesLoading(false) })
    return () => { cancelled = true }
  }, [channelName])

  useEffect(() => {
    let cancelled = false
    readPublicJson<PortalAnnouncement[]>('/api/master-data/public/announcements?limit=5')
      .then((list) => { if (!cancelled) { setAnnouncements(list); setAnnouncementError('') } })
      .catch((reason: Error) => { if (!cancelled) { setAnnouncements([]); setAnnouncementError(reason.message) } })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const target = route.query.get('scroll')
    if (target) {
      window.setTimeout(() => document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
    }
  }, [route])

  const cards = useMemo<ProductCard[]>(() => (live ?? []).slice(0, 8).map(liveCard), [live])

  const amount = formatAmount(stat?.tradeAmount)
  const deals = formatCount(stat?.dealCount, '笔')
  const products = formatCount(stat?.publishedProductCount, '个')
  const participants = formatCount(stat?.participantCount, '家')
  const monitored = formatCount(marketStats.total, '个')

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
              <span><Icon name="cart" size={14} /> 累计成交金额</span>
              <strong>{statError ? '—' : `¥ ${amount.text}`}<small>{statError ? '' : amount.unit}</small></strong>
              <em>{statError ? `交易服务暂时读不到：${statError}` : '交易域实查，已取消订单不计入'}</em>
            </div>
            <div className="portal-hero-metric">
              <span><Icon name="chart" size={14} /> 行情监测品种</span>
              <strong>{marketError ? '—' : monitored.text}<small>{marketError ? '' : monitored.unit}</small></strong>
              <em>{marketError ? `资讯服务暂时读不到：${marketError}` : '资讯域已上架行情品种（含涨跌与产地）'}</em>
            </div>
          </div>
        </div>
      </section>

      <section className="portal-statbar">
        <div className="container portal-stat-grid">
          <div><strong>{statError ? '—' : <>{amount.text}<small>{amount.unit}</small></>}</strong><span>累计成交金额</span></div>
          <div><strong>{statError ? '—' : <>{deals.text}<small>{deals.unit}</small></>}</strong><span>累计成交笔数</span></div>
          <div><strong>{statError ? '—' : <>{products.text}<small>{products.unit}</small></>}</strong><span>在架货源数</span></div>
          <div><strong>{statError ? '—' : <>{participants.text}<small>{participants.unit}</small></>}</strong><span>参与交易主体</span></div>
        </div>
        {statError && <div className="container"><DataNote>大盘指标暂时读不到（{statError}）。此处显示「—」而不是历史数字，避免把故障说成平台规模。</DataNote></div>}
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
                {liveError ? '读取失败' : live && live.length > 0 ? '实时在售' : '暂无在售'}
              </span>
              <a className="t-sm muted portal-more-link" href="#/hall">查看更多商品 →</a>
            </div>
          </div>
          {liveError && <DataNote>交易服务暂时读不到（{liveError}），因此不展示商品，也不会用旧的演示列表兜底。</DataNote>}
          {!liveError && live && live.length === 0 && (
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
          ) : !liveError && (
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
              <span className={`tag ${marketError ? 'tag-red' : quotes && quotes.length > 0 ? '' : 'tag-amber'}`}>
                {marketError ? '读取失败' : quotes && quotes.length > 0 ? '平台行情' : '暂无行情'}
              </span>
            </div>
            <div className="card-b">
              {marketError && <DataNote>资讯服务暂时读不到（{marketError}）。</DataNote>}
              {!marketError && quotes && quotes.length > 0 && (
                <div className="row center gap-12 mb-16 portal-wrap">
                  <span className="t-sm muted">监测 {marketStats.total ?? 0} 个品种</span>
                  <span className="tag tag-red">上涨 {marketStats.up ?? 0}</span>
                  <span className="tag tag-tech">下跌 {marketStats.down ?? 0}</span>
                  <span className="tag tag-ghost">持平 {marketStats.flat ?? 0}</span>
                  {Number(marketStats.abnormal ?? 0) > 0 && <span className="tag tag-amber">异动 {marketStats.abnormal}</span>}
                </div>
              )}
              {quotes && quotes.length > 0 ? (
                <table className="data-table">
                  <thead><tr><th>品种</th><th>最新价</th><th className="tr">涨跌</th><th>产地 / 来源</th></tr></thead>
                  <tbody>
                    {quotes.slice(0, 6).map((item) => (
                      <tr key={item.id}>
                        <td>
                          <a href={`#/info/market/${item.id}`}>{item.name}</a>
                          <div className="muted t-xs">{item.category || '平台行情'}</div>
                        </td>
                        <td className="mono">¥{Number(item.price).toFixed(2)}<span className="muted t-xs"> {item.priceUnit || ''}</span></td>
                        <td className={`tr mono${(item.changePct ?? 0) < 0 ? ' c-red' : (item.changePct ?? 0) > 0 ? ' c-green' : ''}`}>
                          {item.changePct === undefined || item.changePct === null
                            ? '—'
                            : `${item.changePct > 0 ? '+' : ''}${item.changePct.toFixed(2)}%`}
                        </td>
                        <td>{item.origin || item.market || '全国'}<div className="muted t-xs">{item.source || '平台发布'} · {dayLabel(item.updatedAt)}</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : !marketError && (
                <div className="empty">
                  <Icon name="chart" size={30} />
                  <div className="strong mt-12">暂无已发布行情</div>
                  <div className="muted t-sm mt-8">运营端在资讯运营后台上架行情品种后自动展示。</div>
                </div>
              )}
            </div>
          </div>

          <div className="card" id="news">
            <div className="card-h">
              <h3><Icon name="file" size={18} />产业资讯</h3>
              <a className="more" href="#/info">资讯首页 →</a>
            </div>
            <div className="card-b">
              {channelError && <DataNote>栏目清单暂时读不到（{channelError}）。</DataNote>}
              {!channelError && channels.length === 0 && <DataNote>运营端还没有启用中的资讯栏目，发布内容后此处自动出现分类。</DataNote>}
              {channels.length > 0 && (
                <div className="tabs mb-16">
                  {channels.map((item) => (
                    <button type="button" key={item.id} className={channelName === item.name ? 'on' : ''}
                      onClick={() => setChannelName(item.name)}>
                      {item.name}
                    </button>
                  ))}
                </div>
              )}
              {articlesLoading ? (
                <div className="empty"><div className="muted t-sm">正在读取资讯…</div></div>
              ) : articlesError ? (
                <DataNote>该栏目内容暂时读不到（{articlesError}）。</DataNote>
              ) : articles && articles.length > 0 ? (
                <>
                  <ul className="portal-news-list">
                    {articles.map((item) => (
                      <li key={item.id}>
                        <a href={`#/info/news/${item.id}`}>
                          <span className="tag">{channelName}</span>
                          <span className="ellipsis portal-news-title">{item.title}</span>
                          <span className="mono t-xs muted portal-news-date">{dayLabel(item.publishedAt)}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                  <div className="muted t-xs mt-12">共 {articlesTotal} 篇已发布内容，按发布时间排序。</div>
                </>
              ) : (
                <div className="empty">
                  <div className="strong">该栏目暂无已发布内容</div>
                  <div className="muted t-sm mt-8">运营端审核通过并发布后自动同步到门户。</div>
                </div>
              )}
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
            <div className="card-h">
              <h3><Icon name="bell" size={18} />平台公告</h3>
              <span className="tag tag-ghost">运营发布</span>
            </div>
            <div className="card-b">
              {announcementError && <DataNote>公告服务暂时读不到（{announcementError}）。</DataNote>}
              {!announcementError && announcements && announcements.length === 0 && (
                <div className="empty"><div className="muted t-sm">运营端暂无已发布的平台公告</div></div>
              )}
              {(announcements ?? []).map((item) => {
                const meta = ANNOUNCEMENT_LABELS[item.type ?? ''] ?? { label: '公告', tagCls: '' }
                const open = openAnnouncement === item.id
                return (
                  <div key={item.id}>
                    <div className="portal-announce-row">
                      <span className={`tag ${meta.tagCls}`}>{meta.label}</span>
                      <button type="button" className="portal-announce-title ellipsis"
                        onClick={() => setOpenAnnouncement(open ? '' : item.id)}>{item.title}</button>
                      <span className="mono t-xs muted">{dayLabel(item.publishTime)}</span>
                    </div>
                    {open && <div className="portal-announce-body">{item.content || '（本公告没有正文）'}</div>}
                  </div>
                )
              })}
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
