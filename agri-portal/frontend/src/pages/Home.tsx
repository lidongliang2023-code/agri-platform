import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { ANNOUNCEMENTS, NEWS, PRICE_COMMODITIES, PRODUCTS } from '../data/portal'
import type { NewsItem, PortalProduct } from '../data/portal'
import { hallUrl, useHashRoute, ssoRegister, tradeUrl } from '../utils'

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

const SERVICES = [
  { icon: 'cart', title: '我要买', tag: '买家', desc: '发布询价 · 点选商品 · 淘供应商 · 共享库存', href: tradeUrl('/demand/create') },
  { icon: 'box', title: '我要卖', tag: '卖家', desc: '询单订阅 · 业绩认证 · 我要报名 · 开店推广', href: tradeUrl('/product/create'), tech: true },
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

function sampleCard(product: PortalProduct): ProductCard {
  return {
    name: product.name,
    meta: `${product.loc} · ${product.spec}`,
    price: product.priceNum,
    unit: product.priceVal == null ? '' : product.unit,
    tag: product.tag,
    tagCls: product.tagCls,
    icon: product.icon,
    theme: product.theme,
    href: hallUrl(),
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
  const [priceName, setPriceName] = useState(PRICE_COMMODITIES[0].name)
  const [live, setLive] = useState<LiveProduct[] | null>(null)

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
        }
      })
      .catch(() => { /* 交易服务未启动：回退示例数据并标注 */ })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const target = route.query.get('scroll')
    if (target) {
      window.setTimeout(() => document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
    }
  }, [route])

  const cards = useMemo<ProductCard[]>(() => {
    if (live && live.length > 0) return live.map(liveCard)
    return PRODUCTS.slice(0, 8).map(sampleCard)
  }, [live])

  const price = PRICE_COMMODITIES.find((item) => item.name === priceName) ?? PRICE_COMMODITIES[0]

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
              <a className="btn btn-lg portal-btn-light" href={hallUrl()} target="_blank" rel="noreferrer">我要采购</a>
              <a className="btn btn-lg btn-outline portal-btn-ghost" href={tradeUrl('/product/create')} target="_blank" rel="noreferrer">我要供货</a>
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
                  <a className="btn btn-sm btn-outline mt-16" href={item.href} target="_blank" rel="noreferrer">立即进入</a>
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
              <span className={`tag ${live ? '' : 'tag-amber'}`}>{live ? '实时在售' : '示例数据'}</span>
              <a className="t-sm muted portal-more-link" href={hallUrl()} target="_blank" rel="noreferrer">查看更多商品 →</a>
            </div>
          </div>
          {!live && (
            <div className="portal-data-note">
              交易服务当前未返回实时商品，以下为原型示例货源，仅用于展示门户布局；真实在售商品请进入交易大厅。
            </div>
          )}
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
        </div>
      </section>

      <section className="section">
        <div className="container portal-two-col">
          <div className="card" id="price">
            <div className="card-h">
              <h3><Icon name="chart" size={18} />价格指数</h3>
              <span className="tag tag-amber">演示行情</span>
            </div>
            <div className="card-b">
              <p className="muted t-sm mb-16">为您提供精准、高效、专业的农业产业交易大数据服务（接入行情源后自动切换真实数据）。</p>
              <div className="chips mb-16">
                {PRICE_COMMODITIES.map((item) => (
                  <button type="button" className={`chip${item.name === priceName ? ' on' : ''}`} key={item.name}
                    onClick={() => setPriceName(item.name)}>{item.name}</button>
                ))}
              </div>
              <div className="portal-price-chart" aria-label={`${price.name}价格走势图`}>
                {price.series.map((height, index) => (
                  <i key={index} style={{ height: `${height}%` }} className={index === price.series.length - 1 ? 'last' : ''} />
                ))}
              </div>
              <table className="data-table mt-16">
                <thead><tr><th>日期</th><th>指数（{price.unit}）</th><th className="tr">涨跌</th></tr></thead>
                <tbody>
                  {price.rows.map((row) => (
                    <tr key={row.date}>
                      <td>{row.date}</td>
                      <td className="mono">{row.value}</td>
                      <td className={`tr mono${row.down ? ' c-red' : row.up ? ' c-green' : ''}`}>{row.change}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
              <NewsList items={NEWS[newsTab]} />
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
            <div className="card-h"><h3><Icon name="bell" size={18} />平台公告</h3><span className="tag tag-ghost">示例内容</span></div>
            <div className="card-b">
              {ANNOUNCEMENTS.map((item) => (
                <div className="portal-announce-row" key={item.title}>
                  <span className={`tag ${item.tagCls}`}>{item.tag}</span>
                  <span className="ellipsis">{item.title}</span>
                  <span className="mono t-xs muted">{item.date}</span>
                </div>
              ))}
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

