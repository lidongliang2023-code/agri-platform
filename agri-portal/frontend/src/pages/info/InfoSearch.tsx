import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { dayLabel, formatCount, infoPublicApi, money, signed, trendClass, type SearchResult } from './infoApi';
import { usePageMeta } from '../../utils';
import './info.css';

/** 门户搜索：一次请求聚合资讯、行情、供需、知识、专家、报告。 */
export const InfoSearch = defineComponent({
  name: "InfoSearch",
  props: {
    keyword: null as unknown as PropType<{
      keyword: string;
    }["keyword"]>
  },
  setup(__props: {
    keyword: string;
  }, {
    slots: __slots
  }) {
    watchEffect(() => usePageMeta(__props.keyword ? `搜索：${__props.keyword}` : '全站搜索', '一次搜索资讯、行情、供需、农技知识、专家与报告。'));
    const result = ref<SearchResult | null>(null);
    const setResult = (next: typeof result.value | ((previous: typeof result.value) => typeof result.value)) => {
      result.value = typeof next === 'function' ? (next as (previous: typeof result.value) => typeof result.value)(result.value) : next;
    };
    const value = ref(__props.keyword);
    const setValue = (next: typeof value.value | ((previous: typeof value.value) => typeof value.value)) => {
      value.value = typeof next === 'function' ? (next as (previous: typeof value.value) => typeof value.value)(value.value) : next;
    };
    const loading = ref(true);
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    onMounted(() => {
      watch(() => [__props.keyword], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          setValue(__props.keyword);
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    onMounted(() => {
      watch(() => [__props.keyword], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          if (!__props.keyword) {
            setLoading(false);
            setResult(null);
            return;
          }
          let cancelled = false;
          setLoading(true);
          setError('');
          infoPublicApi.search(__props.keyword).then(data => {
            if (!cancelled) setResult(data);
          }).catch((reason: Error) => {
            if (!cancelled) setError(reason.message);
          }).finally(() => {
            if (!cancelled) setLoading(false);
          });
          return () => {
            cancelled = true;
          };
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const submit = (): void => {
      const trimmed = value.value.trim();
      window.location.hash = trimmed ? `/info/search?keyword=${encodeURIComponent(trimmed)}` : '/info/search';
    };
    const articles = computed(() => result.value?.articles ?? []);
    const quotes = computed(() => result.value?.quotes ?? []);
    const supplyDemands = computed(() => result.value?.supplyDemands ?? []);
    const knowledge = computed(() => result.value?.knowledge ?? []);
    const experts = computed(() => result.value?.experts ?? []);
    const reports = computed(() => result.value?.reports ?? []);
    const total = computed(() => articles.value.length + quotes.value.length + supplyDemands.value.length + knowledge.value.length + experts.value.length + reports.value.length);
    return () => {
      const view_value = value.value;
      const view_error = error.value;
      const view_loading = loading.value;
      const view_prop_keyword = __props.keyword;
      const view_total = total.value;
      const view_articles = articles.value;
      const view_quotes = quotes.value;
      const view_supplyDemands = supplyDemands.value;
      const view_knowledge = knowledge.value;
      const view_experts = experts.value;
      const view_reports = reports.value;
      return <div class="info-page">
      <div class="info-hero" style={{
          padding: '26px 32px'
        }}>
        <h1 style={{
            fontSize: "22px"
          }}>全站搜索</h1>
        <p>资讯 · 行情 · 供需 · 农技知识 · 专家 · 报告，一次搜完。</p>
        <div class="info-hero-search" style={{
            marginTop: "18px"
          }}>
          <input value={view_value} placeholder="输入品种、病害、政策关键词…" onInput={event => setValue((event.target as HTMLInputElement).value)} onKeydown={event => {
              if (event.key === 'Enter') submit();
            }} />
          <button type="button" onClick={submit}>搜索</button>
        </div>
      </div>

      {view_error && <div class="info-error" style={{
          marginTop: "18px"
        }}>{view_error}</div>}
      {view_loading && <div class="info-loading">正在搜索…</div>}

      {!view_loading && view_prop_keyword && view_total === 0 && !view_error && <div class="info-empty">没有找到与「{view_prop_keyword}」相关的内容</div>}

      {!view_loading && view_total > 0 && <>
          <div class="info-section-head" style={{
            marginTop: "22px"
          }}>
            <h2>搜索结果 <small>共 {view_total} 条</small></h2>
            <span class="small gray">关键词：{view_prop_keyword}</span>
          </div>

          {view_articles.length > 0 && <section class="info-section">
              <div class="info-section-head"><h2>资讯 <small>{view_articles.length}</small></h2></div>
              <div class="info-card">
                {view_articles.slice(0, 5).map(item => <a class="info-news-row" href={`#/info/news/${item.id}`} key={item.id} style={{
                display: 'flex'
              }}>
                    <div class="info-news-ico">{item.coverIcon ?? '📄'}</div>
                    <div>
                      <div class="info-news-title">{item.title}</div>
                      <div class="info-news-sub">{item.channel} · {dayLabel(item.publishedAt ?? item.createdAt)}</div>
                    </div>
                  </a>)}
              </div>
            </section>}

          {view_quotes.length > 0 && <section class="info-section">
              <div class="info-section-head"><h2>行情 <small>{view_quotes.length}</small></h2></div>
              <div class="info-card" style={{
              padding: "0px",
              overflowX: 'auto'
            }}>
                <table class="info-table">
                  <thead>
                    <tr><th>品种</th><th>市场</th><th class="num">价格</th><th class="num">涨跌</th></tr>
                  </thead>
                  <tbody>
                    {view_quotes.slice(0, 6).map(quote => <tr key={quote.id}>
                        <td><a href={`#/info/market/${quote.id}`}>{quote.name}</a></td>
                        <td>{quote.market ?? quote.origin}</td>
                        <td class="num">{money(quote.price)} {quote.priceUnit}</td>
                        <td class={`num ${trendClass(quote.changePct)}`}>{signed(quote.changePct)}</td>
                      </tr>)}
                  </tbody>
                </table>
              </div>
            </section>}

          {view_supplyDemands.length > 0 && <section class="info-section">
              <div class="info-section-head"><h2>供需 <small>{view_supplyDemands.length}</small></h2></div>
              <div class="info-card">
                {view_supplyDemands.slice(0, 6).map(item => <a class="info-sd-row" href={`#/info/supply-demand/${item.id}?type=${item.sdType}`} key={item.id} style={{
                display: 'grid'
              }}>
                    <div class="info-sd-title">{item.title}<span>{item.origin}</span></div>
                    <div class="info-sd-qty">{item.quantity}</div>
                    <div class="info-sd-price">{money(item.price)} {item.priceUnit}</div>
                  </a>)}
              </div>
            </section>}

          {view_knowledge.length > 0 && <section class="info-section">
              <div class="info-section-head"><h2>农技知识 <small>{view_knowledge.length}</small></h2></div>
              <div class="info-card">
                {view_knowledge.slice(0, 5).map(item => <div class="info-news-row" key={item.id}>
                    <div class="info-news-ico">🌱</div>
                    <div>
                      <div class="info-news-title">{item.title}</div>
                      <div class="info-news-sub">{item.category} · {item.crop} · 阅读 {formatCount(item.viewCount)}</div>
                    </div>
                  </div>)}
              </div>
            </section>}

          {(view_experts.length > 0 || view_reports.length > 0) && <div class="info-grid-2" style={{
            marginTop: "22px"
          }}>
              {view_experts.length > 0 && <div class="info-card">
                  <div class="info-section-head"><h2 style={{
                  fontSize: "14px"
                }}>专家 <small>{view_experts.length}</small></h2></div>
                  {view_experts.slice(0, 4).map(expert => <div class="info-news-row" key={expert.id}>
                      <div class="info-news-ico">{expert.avatarText ?? '👨‍🌾'}</div>
                      <div>
                        <div class="info-news-title">{expert.name}</div>
                        <div class="info-news-sub">{expert.title ?? expert.field} · {expert.orgName}</div>
                      </div>
                    </div>)}
                </div>}
              {view_reports.length > 0 && <div class="info-card">
                  <div class="info-section-head"><h2 style={{
                  fontSize: "14px"
                }}>报告 <small>{view_reports.length}</small></h2></div>
                  {view_reports.slice(0, 4).map(report => <div class="info-news-row" key={report.id}>
                      <div class="info-news-ico">{report.coverIcon ?? '📊'}</div>
                      <div>
                        <div class="info-news-title">{report.title}</div>
                        <div class="info-news-sub">{report.category} · {report.publishDate}</div>
                      </div>
                    </div>)}
                </div>}
            </div>}
        </>}
    </div>;
    };
  }
});
