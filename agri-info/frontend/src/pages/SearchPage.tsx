import { defineComponent, ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, type PropType, type VNodeChild } from 'vue';
import { useFormModel } from '../components/vue-form';
import { SearchOutlined } from "@ant-design/icons-vue";
import { Button, Input } from "../components/vue-ui";
import { infoApi } from '../api';
import { useApp } from '../app-context';
import type { SearchResult } from '../types';
import { ArticleCard, ChangePct, EmptyState, ErrorBlock, LoadingBlock, PageTitle } from '../components/ui';
export const SearchPage = defineComponent({
  name: "SearchPage",
  props: {},
  setup(__props, {
    slots: __slots
  }) {
    const __useApp = useApp();
    const query = computed(() => __useApp.query);
    const navigate = computed(() => __useApp.navigate);
    const keyword = ref(query.value.get('q') || '');
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    const data = ref<SearchResult | null>(null);
    const setData = (next: SearchResult | null | ((previous: SearchResult | null) => SearchResult | null)) => {
      data.value = typeof next === 'function' ? (next as (previous: SearchResult | null) => SearchResult | null)(data.value) : next;
    };
    const loading = ref(false);
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const run = (value: string): void => {
      if (!value.trim()) {
        setData(null);
        return;
      }
      setLoading(true);
      setError('');
      infoApi.search(value.trim()).then(setData).catch((reason: Error) => setError(reason.message)).finally(() => setLoading(false));
    };
    {
      let dispose: void | (() => void);
      onMounted(() => {
        dispose = (() => {
          run(keyword.value);
        })();
      });
      onBeforeUnmount(() => {
        if (typeof dispose === 'function') dispose();
      });
    }
    return () => {
      const view_keyword = keyword.value;
      const view_loading = loading.value;
      const view_error = error.value;
      const view_data = data.value;
      const view_navigate = navigate.value;
      return <div class="page-stack">
      <PageTitle eyebrow="SEARCH" title="搜索与发现" description="一次搜索覆盖行情品种、行业资讯、农技知识、供需信息与数据报告。支持按作物、产区、发布者检索。" />

      <section class="surface-card">
        <div class="row" style={{
            gap: "10px"
          }}>
          <Input size="large" allowClear prefix={<SearchOutlined />} placeholder="如：大蒜行情、番茄缺钾、金乡采购需求…" value={view_keyword} onChange={event => setKeyword((event.target as HTMLInputElement).value)} onPressEnter={() => run(view_keyword)} style={{
              flex: 1
            }} />
          <Button size="large" type="primary" onClick={() => run(view_keyword)}>搜索</Button>
        </div>
        <div class="chip-row" style={{
            marginTop: "12px"
          }}>
          {['大蒜', '番茄', '稻飞虱', '补贴', '金乡', '马铃薯'].map(item => <button type="button" key={item} class="chip" onClick={() => {
              setKeyword(item);
              run(item);
            }}>{item}</button>)}
        </div>
      </section>

      {view_loading && <LoadingBlock rows={3} />}
      {view_error && <ErrorBlock message={view_error} />}
      {!view_loading && !view_error && !view_data && <EmptyState icon="🔎" title="输入关键词开始搜索" description="行情、资讯、知识库、供需与报告会一起检索并按相关度排序。" />}

      {view_data && <>
          <div class="small muted">「{view_data.keyword}」共命中 {view_data.total} 条结果</div>

          {view_data.quotes.length > 0 && <section class="surface-card">
              <b style={{
              fontSize: "14px"
            }}>行情品种（{view_data.quotes.length}）</b>
              <table class="data-table clickable" style={{
              marginTop: "10px"
            }}>
                <thead><tr><th>品种</th><th>主产区</th><th class="num">最新价</th><th class="num">涨跌幅</th><th>操作</th></tr></thead>
                <tbody>
                  {view_data.quotes.map(quote => <tr key={quote.id} onClick={() => view_navigate('market-detail', quote.id)}>
                      <td><b>{quote.icon} {quote.name}</b></td>
                      <td>{quote.origin}</td>
                      <td class="num">{Number(quote.price).toFixed(2)} {quote.priceUnit}</td>
                      <td class="num"><ChangePct value={Number(quote.changePct)} /></td>
                      <td><button type="button" class="link-button" onClick={event => {
                      event.stopPropagation();
                      view_navigate('market-detail', quote.id);
                    }}>行情详情</button></td>
                    </tr>)}
                </tbody>
              </table>
            </section>}

          {view_data.articles.length > 0 && <section class="surface-card">
              <b style={{
              fontSize: "14px",
              display: 'block',
              marginBottom: "10px"
            }}>行业资讯（{view_data.articles.length}）</b>
              <div class="stack">
                {view_data.articles.map(article => <ArticleCard key={article.id} article={article} compact />)}
              </div>
            </section>}

          <div class="grid-2">
            {view_data.knowledge.length > 0 && <section class="surface-card">
                <b style={{
                fontSize: "14px"
              }}>农技知识（{view_data.knowledge.length}）</b>
                <div class="stack" style={{
                marginTop: "10px"
              }}>
                  {view_data.knowledge.map(item => <button type="button" key={item.id} class="todo-item" onClick={() => view_navigate('knowledge', undefined, {
                  q: item.title
                })}>
                      <span class="todo-dot" />
                      <span><b>{item.title}</b><small>{item.summary}</small></span>
                      <em>{item.crop}</em>
                    </button>)}
                </div>
              </section>}

            {view_data.supplyDemands.length > 0 && <section class="surface-card">
                <b style={{
                fontSize: "14px"
              }}>供需信息（{view_data.supplyDemands.length}）</b>
                <div class="stack" style={{
                marginTop: "10px"
              }}>
                  {view_data.supplyDemands.map(item => <button type="button" key={item.id} class="todo-item" onClick={() => view_navigate('sd-detail', item.id)}>
                      <span class="todo-dot" />
                      <span><b>{item.title}</b><small>{item.origin} · {item.quantity} · {Number(item.price).toFixed(2)} {item.priceUnit}</small></span>
                      <em>{item.sdType === 'supply' ? '供应' : '需求'}</em>
                    </button>)}
                </div>
              </section>}
          </div>

          {view_data.reports.length > 0 && <section class="surface-card">
              <b style={{
              fontSize: "14px"
            }}>数据报告（{view_data.reports.length}）</b>
              <div class="stack" style={{
              marginTop: "10px"
            }}>
                {view_data.reports.map(item => <button type="button" key={item.id} class="todo-item" onClick={() => view_navigate('reports')}>
                    <span class="todo-dot" />
                    <span><b>{item.title}</b><small>{item.category} · {item.period} · {item.pageCount} 页</small></span>
                    <em>{item.isFree ? '免费' : `¥${Number(item.price).toFixed(0)}`}</em>
                  </button>)}
              </div>
            </section>}

          {view_data.total === 0 && <EmptyState icon="🌾" title="没有找到相关内容" description="试试更短的关键词，或从行情中心、资讯频道直接浏览。" />}
        </>}
    </div>;
    };
  }
});
