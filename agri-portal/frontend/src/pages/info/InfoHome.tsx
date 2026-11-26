import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { PortalPageHero } from '../../components/PortalPageHero';
import { dayLabel, formatCount, infoPublicApi, money, signed, trendClass, type Article, type Course, type Expert, type Quote, type Report, type SupplyDemand } from './infoApi';
import { applyStructuredData, usePageMeta } from '../../utils';
import { NewsFeed } from './NewsFeed';
import './info.css';

/**
 * 信息资讯频道首页。
 *
 * 聚合四块内容：行情速览、头条资讯、供需快讯、学习与服务入口。
 * 全部走 `/api/v1/info/public/*`，匿名可看；供需的联系方式后端已脱敏。
 */
export const InfoHome = defineComponent({
  name: "InfoHome",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    watchEffect(() => usePageMeta('产业资讯', '行情报价、行业资讯、供需信息、农技知识、培训课程与认证专家，开放浏览无需登录。'));
    (() => {
      let dispose: void | (() => void);
      onMounted(() => {
        dispose = (() => {
          applyStructuredData('ld-site', {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: '丰链云 · 农业产业互联网平台',
            url: `${window.location.origin}/portal/`,
            potentialAction: {
              '@type': 'SearchAction',
              target: `${window.location.origin}/portal/#/info/search?keyword={keyword}`,
              'query-input': 'required name=keyword'
            }
          });
        })();
      });
      onBeforeUnmount(() => {
        if (typeof dispose === 'function') dispose();
      });
    })();
    const stats = ref<Record<string, number>>({});
    const setStats = (next: typeof stats.value | ((previous: typeof stats.value) => typeof stats.value)) => {
      stats.value = typeof next === 'function' ? (next as (previous: typeof stats.value) => typeof stats.value)(stats.value) : next;
    };
    const quotes = ref<Quote[]>([]);
    const setQuotes = (next: typeof quotes.value | ((previous: typeof quotes.value) => typeof quotes.value)) => {
      quotes.value = typeof next === 'function' ? (next as (previous: typeof quotes.value) => typeof quotes.value)(quotes.value) : next;
    };
    const articles = ref<Article[]>([]);
    // 运营编排的首页头条；为空时回退到按时间排序的文章
    const setArticles = (next: typeof articles.value | ((previous: typeof articles.value) => typeof articles.value)) => {
      articles.value = typeof next === 'function' ? (next as (previous: typeof articles.value) => typeof articles.value)(articles.value) : next;
    };
    const headline = ref<{
      curated: boolean;
      items: Article[];
    }>({
      curated: false,
      items: []
    });
    const setHeadline = (next: typeof headline.value | ((previous: typeof headline.value) => typeof headline.value)) => {
      headline.value = typeof next === 'function' ? (next as (previous: typeof headline.value) => typeof headline.value)(headline.value) : next;
    };
    const supplies = ref<SupplyDemand[]>([]);
    const setSupplies = (next: typeof supplies.value | ((previous: typeof supplies.value) => typeof supplies.value)) => {
      supplies.value = typeof next === 'function' ? (next as (previous: typeof supplies.value) => typeof supplies.value)(supplies.value) : next;
    };
    const demands = ref<SupplyDemand[]>([]);
    const setDemands = (next: typeof demands.value | ((previous: typeof demands.value) => typeof demands.value)) => {
      demands.value = typeof next === 'function' ? (next as (previous: typeof demands.value) => typeof demands.value)(demands.value) : next;
    };
    const courses = ref<Course[]>([]);
    const setCourses = (next: typeof courses.value | ((previous: typeof courses.value) => typeof courses.value)) => {
      courses.value = typeof next === 'function' ? (next as (previous: typeof courses.value) => typeof courses.value)(courses.value) : next;
    };
    const experts = ref<Expert[]>([]);
    const setExperts = (next: typeof experts.value | ((previous: typeof experts.value) => typeof experts.value)) => {
      experts.value = typeof next === 'function' ? (next as (previous: typeof experts.value) => typeof experts.value)(experts.value) : next;
    };
    const reports = ref<Report[]>([]);
    const setReports = (next: typeof reports.value | ((previous: typeof reports.value) => typeof reports.value)) => {
      reports.value = typeof next === 'function' ? (next as (previous: typeof reports.value) => typeof reports.value)(reports.value) : next;
    };
    const loading = ref(true);
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const keyword = ref('');
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    (() => {
      let dispose: void | (() => void);
      onMounted(() => {
        dispose = (() => {
          let cancelled = false;
          const done = (): void => {
            if (!cancelled) setLoading(false);
          };
          void Promise.allSettled([infoPublicApi.overview(), infoPublicApi.markets(), infoPublicApi.articles({
            size: 6
          }), infoPublicApi.supplyDemands({
            type: 'supply',
            size: 5
          }), infoPublicApi.supplyDemands({
            type: 'demand',
            size: 5
          }), infoPublicApi.courses(), infoPublicApi.experts(), infoPublicApi.reports(), infoPublicApi.recommend()]).then(results => {
            if (cancelled) return;
            const [overview, market, news, supply, demand, course, expert, report, recommend] = results;
            if (overview.status === 'fulfilled') {
              const data = overview.value as {
                stats?: Record<string, number>;
              };
              setStats(data.stats ?? {});
            }
            if (market.status === 'fulfilled') setQuotes((market.value.quotes ?? []).slice(0, 8));
            if (news.status === 'fulfilled') setArticles(news.value.items ?? []);
            if (supply.status === 'fulfilled') setSupplies(supply.value.items ?? []);
            if (demand.status === 'fulfilled') setDemands(demand.value.items ?? []);
            if (course.status === 'fulfilled') setCourses((course.value.items ?? []).slice(0, 3));
            if (expert.status === 'fulfilled') setExperts((expert.value.items ?? []).slice(0, 3));
            if (report.status === 'fulfilled') setReports((report.value.items ?? []).slice(0, 3));
            if (recommend.status === 'fulfilled') {
              setHeadline({
                curated: Boolean(recommend.value.curated),
                items: recommend.value.items ?? []
              });
            }
            done();
          });
          return () => {
            cancelled = true;
          };
        })();
      });
      onBeforeUnmount(() => {
        if (typeof dispose === 'function') dispose();
      });
    })();

    // 运营编排优先；没编排就用按时间排的文章
    const feed = computed(() => headline.value.items.length > 0 ? headline.value.items : articles.value);
    const lead = computed(() => feed.value[0]);
    const rest = computed(() => feed.value.slice(1, 5));
    const search = (): void => {
      const value = keyword.value.trim();
      window.location.hash = value ? `/info/search?keyword=${encodeURIComponent(value)}` : '/info/news';
    };
    return () => {
      const view_stats = stats.value;
      const view_keyword = keyword.value;
      const view_loading = loading.value;
      const view_quotes = quotes.value;
      const view_headline = headline.value;
      const view_lead = lead.value;
      const view_rest = rest.value;
      const view_supplies = supplies.value;
      const view_demands = demands.value;
      const view_courses = courses.value;
      const view_experts = experts.value;
      const view_reports = reports.value;
      return <div class="info-page portal-channel-page">
      <PortalPageHero badge="产业资讯 · 行情与知识服务" title="读懂行情，种好每一亩" description="汇聚农产品产地与批发市场价格、行业资讯、供需信息、农技知识与认证专家，让产地与市场高效连接。">
        <div class="info-hero-metrics">
          <div class="info-hero-metric">
            <b>{view_stats.monitoredQuotes ?? '—'}</b>
            <span>监测品种</span>
          </div>
          <div class="info-hero-metric">
            <b>{formatCount(view_stats.todayArticles)}</b>
            <span>在库资讯</span>
          </div>
          <div class="info-hero-metric">
            <b>{formatCount(view_stats.onlineSupplyDemand)}</b>
            <span>在线供需</span>
          </div>
          <div class="info-hero-metric">
            <b>{formatCount(view_stats.aiCalls)}</b>
            <span>AI 问答</span>
          </div>
        </div>

        <div class="info-hero-search">
          <input value={view_keyword} placeholder="搜品种、资讯、农技知识、专家…" onInput={event => setKeyword((event.target as HTMLInputElement).value)} onKeydown={event => {
              if (event.key === 'Enter') search();
            }} />
          <button type="button" onClick={search}>立即查询</button>
        </div>

        <div class="info-hot">
          <span>热搜：</span>
          {['金乡大蒜', '苹果行情', '秋粮收购', '价格指数', '稻瘟病', '水肥一体化'].map(word => <button key={word} type="button" onClick={() => {
              window.location.hash = `/info/search?keyword=${encodeURIComponent(word)}`;
            }}>
              {word}
            </button>)}
        </div>
      </PortalPageHero>

      {view_loading && <div class="info-loading">正在加载资讯…</div>}

      <div class="info-grid-2" style={{
          marginTop: "26px"
        }}>
        {/* 行情速览 */}
        <section class="info-card">
          <div class="info-section-head">
            <h2>今日行情速览</h2>
            <a class="info-more" href="#/info/market">全部行情 ›</a>
          </div>
          {view_quotes.length === 0 && <div class="info-empty">暂无行情数据</div>}
          {view_quotes.map(quote => <div class="info-quote-row" key={quote.id}>
              <div class="info-quote-name">
                <a href={`#/info/market/${quote.id}`}>{quote.name}</a>
                <span>{quote.market ?? quote.origin ?? '—'}</span>
              </div>
              <div class="info-quote-price">{money(quote.price)}</div>
              <div class={`info-quote-chg ${trendClass(quote.changePct)}`}>{signed(quote.changePct)}</div>
            </div>)}
        </section>

        {/* 头条资讯 */}
        <section class="info-card">
          <div class="info-section-head">
            <h2>
              头条资讯 <small>政策 · 市场 · 技术</small>
              {view_headline.curated && <span class="info-chip" style={{
                  marginLeft: "8px",
                  fontSize: "12px"
                }}>运营推荐</span>}
            </h2>
            <a class="info-more" href="#/info/news">更多资讯 ›</a>
          </div>
          {view_lead && <a class="info-news-row" href={`#/info/news/${view_lead.id}`} style={{
              display: 'flex'
            }}>
              <div class="info-news-ico">{view_lead.coverIcon ?? '📰'}</div>
              <div>
                <div class="info-news-title"><b>{view_lead.title}</b></div>
                <div class="info-news-sub">
                  {view_lead.channel} · {view_lead.author ?? '平台'} · {dayLabel(view_lead.publishedAt ?? view_lead.createdAt)}
                </div>
              </div>
            </a>}
          {view_rest.map(item => <a class="info-news-row" href={`#/info/news/${item.id}`} key={item.id} style={{
              display: 'flex'
            }}>
              <div class="info-news-ico">{item.coverIcon ?? '📄'}</div>
              <div>
                <div class="info-news-title">{item.title}</div>
                <div class="info-news-sub">
                  {item.channel} · {dayLabel(item.publishedAt ?? item.createdAt)} · 阅读 {formatCount(item.readCount)}
                </div>
              </div>
            </a>)}
          {!view_lead && !view_loading && <div class="info-empty">暂无资讯</div>}
        </section>
      </div>

      {/* 产业资讯列表：原独立的 #/info/news 页面已合并到这里 */}
      <section class="info-section">
        <NewsFeed pageSize={8} />
      </section>

      {/* 供需快讯 */}
      <section class="info-section">
        <div class="info-section-head">
          <h2>供需快讯 <small>公开浏览 · 联系方式需登录</small></h2>
          <a class="info-more" href="#/info/supply-demand">进入供需大厅 ›</a>
        </div>
        <div class="info-grid-2">
          <div class="info-card">
            <div class="info-section-head" style={{
                marginBottom: "6px"
              }}>
              <h2 style={{
                  fontSize: "14px"
                }}>最新供应</h2>
              <span class="small gray">{view_supplies.length} 条</span>
            </div>
            {view_supplies.length === 0 && <div class="info-empty">暂无供应信息</div>}
            {view_supplies.map(item => <a class="info-sd-row" href={`#/info/supply-demand/${item.id}?type=supply`} key={item.id} style={{
                display: 'grid'
              }}>
                <div class="info-sd-title">
                  {item.title}
                  <span>{item.origin}</span>
                </div>
                <div class="info-sd-qty">{item.quantity}</div>
                <div class="info-sd-price">{money(item.price)} {item.priceUnit}</div>
              </a>)}
          </div>

          <div class="info-card">
            <div class="info-section-head" style={{
                marginBottom: "6px"
              }}>
              <h2 style={{
                  fontSize: "14px"
                }}>最新求购</h2>
              <span class="small gray">{view_demands.length} 条</span>
            </div>
            {view_demands.length === 0 && <div class="info-empty">暂无求购信息</div>}
            {view_demands.map(item => <a class="info-sd-row" href={`#/info/supply-demand/${item.id}?type=demand`} key={item.id} style={{
                display: 'grid'
              }}>
                <div class="info-sd-title">
                  {item.title}
                  <span>{item.origin}</span>
                </div>
                <div class="info-sd-qty">{item.quantity}</div>
                <div class="info-sd-price">{money(item.price)} {item.priceUnit}</div>
              </a>)}
          </div>
        </div>
      </section>

      {/* 学习与服务 */}
      <section class="info-section">
        <div class="info-section-head">
          <h2>学习与服务</h2>
        </div>
        <div class="info-grid-3">
          <div class="info-card">
            <div class="info-section-head" style={{
                marginBottom: "8px"
              }}>
              <h2 style={{
                  fontSize: "14px"
                }}>培训课堂</h2>
              <a class="info-more" href="#/info/training">全部 ›</a>
            </div>
            {view_courses.map(course => <div class="info-news-row" key={course.id}>
                <div class="info-news-ico">{course.coverIcon ?? '🎓'}</div>
                <div>
                  <div class="info-news-title">{course.title}</div>
                  <div class="info-news-sub">{course.teacher} · {course.duration}</div>
                </div>
              </div>)}
            {view_courses.length === 0 && <div class="info-empty">暂无课程</div>}
          </div>

          <div class="info-card">
            <div class="info-section-head" style={{
                marginBottom: "8px"
              }}>
              <h2 style={{
                  fontSize: "14px"
                }}>认证专家</h2>
              <a class="info-more" href="#/info/experts">全部 ›</a>
            </div>
            {view_experts.map(expert => <div class="info-news-row" key={expert.id}>
                <div class="info-news-ico">{expert.avatarText ?? '👨‍🌾'}</div>
                <div>
                  <div class="info-news-title">{expert.name}</div>
                  <div class="info-news-sub">{expert.title ?? expert.field} · {expert.orgName}</div>
                </div>
              </div>)}
            {view_experts.length === 0 && <div class="info-empty">暂无专家</div>}
          </div>

          <div class="info-card">
            <div class="info-section-head" style={{
                marginBottom: "8px"
              }}>
              <h2 style={{
                  fontSize: "14px"
                }}>数据报告</h2>
              <a class="info-more" href="#/info/reports">全部 ›</a>
            </div>
            {view_reports.map(report => <div class="info-news-row" key={report.id}>
                <div class="info-news-ico">{report.coverIcon ?? '📊'}</div>
                <div>
                  <div class="info-news-title">{report.title}</div>
                  <div class="info-news-sub">{report.category} · {report.publishDate}</div>
                </div>
              </div>)}
            {view_reports.length === 0 && <div class="info-empty">暂无报告</div>}
          </div>
        </div>
      </section>

      <p class="portal-data-note" style={{
          marginTop: "28px",
          textAlign: 'center'
        }}>
        以上内容由信息资讯模块提供 · 供需信息与撮合数据与交易撮合模块同源 · 联系方式需登录后查看
      </p>
    </div>;
    };
  }
});
