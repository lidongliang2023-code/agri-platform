import { PortalPageHero } from '../../components/PortalPageHero'
import { useEffect, useState } from 'react'
import {
  dayLabel,
  formatCount,
  infoPublicApi,
  money,
  signed,
  trendClass,
  type Article,
  type Course,
  type Expert,
  type Quote,
  type Report,
  type SupplyDemand,
} from './infoApi'
import { applyStructuredData, usePageMeta } from '../../utils'
import { NewsFeed } from './NewsFeed'
import './info.css'

/**
 * 信息资讯频道首页。
 *
 * 聚合四块内容：行情速览、头条资讯、供需快讯、学习与服务入口。
 * 全部走 `/api/v1/info/public/*`，匿名可看；供需的联系方式后端已脱敏。
 */
export function InfoHome(): JSX.Element {
  usePageMeta('产业资讯', '行情报价、行业资讯、供需信息、农技知识、培训课程与认证专家，开放浏览无需登录。')

  useEffect(() => {
    applyStructuredData('ld-site', {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: '丰链云 · 农业产业互联网平台',
      url: `${window.location.origin}/portal/`,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${window.location.origin}/portal/#/info/search?keyword={keyword}`,
        'query-input': 'required name=keyword',
      },
    })
  }, [])

  const [stats, setStats] = useState<Record<string, number>>({})
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  // 运营编排的首页头条；为空时回退到按时间排序的文章
  const [headline, setHeadline] = useState<{ curated: boolean; items: Article[] }>({ curated: false, items: [] })
  const [supplies, setSupplies] = useState<SupplyDemand[]>([])
  const [demands, setDemands] = useState<SupplyDemand[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [experts, setExperts] = useState<Expert[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    let cancelled = false
    const done = (): void => { if (!cancelled) setLoading(false) }

    void Promise.allSettled([
      infoPublicApi.overview(),
      infoPublicApi.markets(),
      infoPublicApi.articles({ size: 6 }),
      infoPublicApi.supplyDemands({ type: 'supply', size: 5 }),
      infoPublicApi.supplyDemands({ type: 'demand', size: 5 }),
      infoPublicApi.courses(),
      infoPublicApi.experts(),
      infoPublicApi.reports(),
      infoPublicApi.recommend(),
    ]).then((results) => {
      if (cancelled) return
      const [overview, market, news, supply, demand, course, expert, report, recommend] = results

      if (overview.status === 'fulfilled') {
        const data = overview.value as { stats?: Record<string, number> }
        setStats(data.stats ?? {})
      }
      if (market.status === 'fulfilled') setQuotes((market.value.quotes ?? []).slice(0, 8))
      if (news.status === 'fulfilled') setArticles(news.value.items ?? [])
      if (supply.status === 'fulfilled') setSupplies(supply.value.items ?? [])
      if (demand.status === 'fulfilled') setDemands(demand.value.items ?? [])
      if (course.status === 'fulfilled') setCourses((course.value.items ?? []).slice(0, 3))
      if (expert.status === 'fulfilled') setExperts((expert.value.items ?? []).slice(0, 3))
      if (report.status === 'fulfilled') setReports((report.value.items ?? []).slice(0, 3))
      if (recommend.status === 'fulfilled') {
        setHeadline({
          curated: Boolean(recommend.value.curated),
          items: recommend.value.items ?? [],
        })
      }
      done()
    })

    return () => { cancelled = true }
  }, [])

  // 运营编排优先；没编排就用按时间排的文章
  const feed = headline.items.length > 0 ? headline.items : articles
  const lead = feed[0]
  const rest = feed.slice(1, 5)

  const search = (): void => {
    const value = keyword.trim()
    window.location.hash = value ? `/info/search?keyword=${encodeURIComponent(value)}` : '/info/news'
  }

  return (
    <div className="info-page portal-channel-page">
      <PortalPageHero badge="产业资讯 · 行情与知识服务" title="读懂行情，种好每一亩" description="汇聚农产品产地与批发市场价格、行业资讯、供需信息、农技知识与认证专家，让产地与市场高效连接。">
        <div className="info-hero-metrics">
          <div className="info-hero-metric">
            <b>{stats.monitoredQuotes ?? '—'}</b>
            <span>监测品种</span>
          </div>
          <div className="info-hero-metric">
            <b>{formatCount(stats.todayArticles)}</b>
            <span>在库资讯</span>
          </div>
          <div className="info-hero-metric">
            <b>{formatCount(stats.onlineSupplyDemand)}</b>
            <span>在线供需</span>
          </div>
          <div className="info-hero-metric">
            <b>{formatCount(stats.aiCalls)}</b>
            <span>AI 问答</span>
          </div>
        </div>

        <div className="info-hero-search">
          <input
            value={keyword}
            placeholder="搜品种、资讯、农技知识、专家…"
            onChange={(event) => setKeyword(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') search() }}
          />
          <button type="button" onClick={search}>立即查询</button>
        </div>

        <div className="info-hot">
          <span>热搜：</span>
          {['金乡大蒜', '苹果行情', '秋粮收购', '价格指数', '稻瘟病', '水肥一体化'].map((word) => (
            <button
              key={word}
              type="button"
              onClick={() => { window.location.hash = `/info/search?keyword=${encodeURIComponent(word)}` }}
            >
              {word}
            </button>
          ))}
        </div>
      </PortalPageHero>

      {loading && <div className="info-loading">正在加载资讯…</div>}

      <div className="info-grid-2" style={{ marginTop: 26 }}>
        {/* 行情速览 */}
        <section className="info-card">
          <div className="info-section-head">
            <h2>今日行情速览</h2>
            <a className="info-more" href="#/info/market">全部行情 ›</a>
          </div>
          {quotes.length === 0 && <div className="info-empty">暂无行情数据</div>}
          {quotes.map((quote) => (
            <div className="info-quote-row" key={quote.id}>
              <div className="info-quote-name">
                <a href={`#/info/market/${quote.id}`}>{quote.name}</a>
                <span>{quote.market ?? quote.origin ?? '—'}</span>
              </div>
              <div className="info-quote-price">{money(quote.price)}</div>
              <div className={`info-quote-chg ${trendClass(quote.changePct)}`}>{signed(quote.changePct)}</div>
            </div>
          ))}
        </section>

        {/* 头条资讯 */}
        <section className="info-card">
          <div className="info-section-head">
            <h2>
              头条资讯 <small>政策 · 市场 · 技术</small>
              {headline.curated && <span className="info-chip" style={{ marginLeft: 8, fontSize: 12 }}>运营推荐</span>}
            </h2>
            <a className="info-more" href="#/info/news">更多资讯 ›</a>
          </div>
          {lead && (
            <a className="info-news-row" href={`#/info/news/${lead.id}`} style={{ display: 'flex' }}>
              <div className="info-news-ico">{lead.coverIcon ?? '📰'}</div>
              <div>
                <div className="info-news-title"><b>{lead.title}</b></div>
                <div className="info-news-sub">
                  {lead.channel} · {lead.author ?? '平台'} · {dayLabel(lead.publishedAt ?? lead.createdAt)}
                </div>
              </div>
            </a>
          )}
          {rest.map((item) => (
            <a className="info-news-row" href={`#/info/news/${item.id}`} key={item.id} style={{ display: 'flex' }}>
              <div className="info-news-ico">{item.coverIcon ?? '📄'}</div>
              <div>
                <div className="info-news-title">{item.title}</div>
                <div className="info-news-sub">
                  {item.channel} · {dayLabel(item.publishedAt ?? item.createdAt)} · 阅读 {formatCount(item.readCount)}
                </div>
              </div>
            </a>
          ))}
          {!lead && !loading && <div className="info-empty">暂无资讯</div>}
        </section>
      </div>

      {/* 产业资讯列表：原独立的 #/info/news 页面已合并到这里 */}
      <section className="info-section">
        <NewsFeed pageSize={8} />
      </section>

      {/* 供需快讯 */}
      <section className="info-section">
        <div className="info-section-head">
          <h2>供需快讯 <small>公开浏览 · 联系方式需登录</small></h2>
          <a className="info-more" href="#/info/supply-demand">进入供需大厅 ›</a>
        </div>
        <div className="info-grid-2">
          <div className="info-card">
            <div className="info-section-head" style={{ marginBottom: 6 }}>
              <h2 style={{ fontSize: 14 }}>最新供应</h2>
              <span className="small gray">{supplies.length} 条</span>
            </div>
            {supplies.length === 0 && <div className="info-empty">暂无供应信息</div>}
            {supplies.map((item) => (
              <a className="info-sd-row" href={`#/info/supply-demand/${item.id}?type=supply`} key={item.id} style={{ display: 'grid' }}>
                <div className="info-sd-title">
                  {item.title}
                  <span>{item.origin}</span>
                </div>
                <div className="info-sd-qty">{item.quantity}</div>
                <div className="info-sd-price">{money(item.price)} {item.priceUnit}</div>
              </a>
            ))}
          </div>

          <div className="info-card">
            <div className="info-section-head" style={{ marginBottom: 6 }}>
              <h2 style={{ fontSize: 14 }}>最新求购</h2>
              <span className="small gray">{demands.length} 条</span>
            </div>
            {demands.length === 0 && <div className="info-empty">暂无求购信息</div>}
            {demands.map((item) => (
              <a className="info-sd-row" href={`#/info/supply-demand/${item.id}?type=demand`} key={item.id} style={{ display: 'grid' }}>
                <div className="info-sd-title">
                  {item.title}
                  <span>{item.origin}</span>
                </div>
                <div className="info-sd-qty">{item.quantity}</div>
                <div className="info-sd-price">{money(item.price)} {item.priceUnit}</div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* 学习与服务 */}
      <section className="info-section">
        <div className="info-section-head">
          <h2>学习与服务</h2>
        </div>
        <div className="info-grid-3">
          <div className="info-card">
            <div className="info-section-head" style={{ marginBottom: 8 }}>
              <h2 style={{ fontSize: 14 }}>培训课堂</h2>
              <a className="info-more" href="#/info/training">全部 ›</a>
            </div>
            {courses.map((course) => (
              <div className="info-news-row" key={course.id}>
                <div className="info-news-ico">{course.coverIcon ?? '🎓'}</div>
                <div>
                  <div className="info-news-title">{course.title}</div>
                  <div className="info-news-sub">{course.teacher} · {course.duration}</div>
                </div>
              </div>
            ))}
            {courses.length === 0 && <div className="info-empty">暂无课程</div>}
          </div>

          <div className="info-card">
            <div className="info-section-head" style={{ marginBottom: 8 }}>
              <h2 style={{ fontSize: 14 }}>认证专家</h2>
              <a className="info-more" href="#/info/experts">全部 ›</a>
            </div>
            {experts.map((expert) => (
              <div className="info-news-row" key={expert.id}>
                <div className="info-news-ico">{expert.avatarText ?? '👨‍🌾'}</div>
                <div>
                  <div className="info-news-title">{expert.name}</div>
                  <div className="info-news-sub">{expert.title ?? expert.field} · {expert.orgName}</div>
                </div>
              </div>
            ))}
            {experts.length === 0 && <div className="info-empty">暂无专家</div>}
          </div>

          <div className="info-card">
            <div className="info-section-head" style={{ marginBottom: 8 }}>
              <h2 style={{ fontSize: 14 }}>数据报告</h2>
              <a className="info-more" href="#/info/reports">全部 ›</a>
            </div>
            {reports.map((report) => (
              <div className="info-news-row" key={report.id}>
                <div className="info-news-ico">{report.coverIcon ?? '📊'}</div>
                <div>
                  <div className="info-news-title">{report.title}</div>
                  <div className="info-news-sub">{report.category} · {report.publishDate}</div>
                </div>
              </div>
            ))}
            {reports.length === 0 && <div className="info-empty">暂无报告</div>}
          </div>
        </div>
      </section>

      <p className="portal-data-note" style={{ marginTop: 28, textAlign: 'center' }}>
        以上内容由信息资讯模块提供 · 供需信息与撮合数据与交易撮合模块同源 · 联系方式需登录后查看
      </p>
    </div>
  )
}
