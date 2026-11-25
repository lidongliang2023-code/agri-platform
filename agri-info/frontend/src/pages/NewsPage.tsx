import { defineComponent, ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, type PropType, type VNodeChild } from 'vue';
import { useFormModel } from '../components/vue-form';
import { Button, Input, Pagination } from "../components/vue-ui";
import { SearchOutlined } from "@ant-design/icons-vue";
import { infoApi } from '../api';
import { useApp } from '../app-context';
import type { ArticleList } from '../types';
import { ArticleCard, ErrorBlock, LoadingBlock, PageTitle } from '../components/ui';
export const NewsPage = defineComponent({
  name: "NewsPage",
  props: {},
  setup(__props, {
    slots: __slots
  }) {
    const __useApp = useApp();
    const query = computed(() => __useApp.query);
    const navigate = computed(() => __useApp.navigate);
    const channel = ref(query.value.get('channel') || '推荐');
    const setChannel = (next: typeof channel.value | ((previous: typeof channel.value) => typeof channel.value)) => {
      channel.value = typeof next === 'function' ? (next as (previous: typeof channel.value) => typeof channel.value)(channel.value) : next;
    };
    const contentType = ref('全部');
    const setContentType = (next: typeof contentType.value | ((previous: typeof contentType.value) => typeof contentType.value)) => {
      contentType.value = typeof next === 'function' ? (next as (previous: typeof contentType.value) => typeof contentType.value)(contentType.value) : next;
    };
    const keyword = ref('');
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    const page = ref(1);
    const setPage = (next: typeof page.value | ((previous: typeof page.value) => typeof page.value)) => {
      page.value = typeof next === 'function' ? (next as (previous: typeof page.value) => typeof page.value)(page.value) : next;
    };
    const data = ref<ArticleList | null>(null);
    const setData = (next: ArticleList | null | ((previous: ArticleList | null) => ArticleList | null)) => {
      data.value = typeof next === 'function' ? (next as (previous: ArticleList | null) => ArticleList | null)(data.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const load = (nextPage = 1, nextChannel = channel.value, nextType = contentType.value, nextKeyword = keyword.value): void => {
      setError('');
      infoApi.articles({
        channel: nextChannel === '推荐' ? undefined : nextChannel,
        contentType: nextType === '全部' ? undefined : nextType,
        keyword: nextKeyword || undefined,
        page: nextPage,
        size: 8
      }).then(result => {
        setData(result);
        setPage(nextPage);
      }).catch((reason: Error) => setError(reason.message));
    };
    {
      let dispose: void | (() => void);
      onMounted(() => {
        dispose = (() => {
          load(1);
        })();
      });
      onBeforeUnmount(() => {
        if (typeof dispose === 'function') dispose();
      });
    }
    return () => {
      const view_data = data.value;
      const view_error = error.value;
      const view_keyword = keyword.value;
      const view_channel = channel.value;
      const view_contentType = contentType.value;
      const view_page = page.value;
      const view_navigate = navigate.value;
      if (!view_data && !view_error) return <LoadingBlock rows={4} />;
      if (view_error || !view_data) return <ErrorBlock message={view_error} />;
      return <div class="page-stack">
      <PageTitle eyebrow="INDUSTRY NEWS" title="行业资讯" description="原创 + 权威聚合 + AI 生成（均标注来源）· 内容经平台三级审核后发布 · 支持按栏目与内容形态筛选" actions={<Input allowClear prefix={<SearchOutlined />} placeholder="搜索资讯标题或关键词" style={{
          width: "260px"
        }} value={view_keyword} onChange={event => setKeyword((event.target as HTMLInputElement).value)} onPressEnter={() => load(1)} />} />

      <section class="surface-card">
        <div class="row between" style={{
            gap: "12px"
          }}>
          <div class="chip-row">
            {['推荐', ...view_data.channels.map(item => item.name)].map(item => <button type="button" key={item} class={`chip${view_channel === item ? ' on' : ''}`} onClick={() => {
                setChannel(item);
                load(1, item, view_contentType, view_keyword);
              }}>
                {item}
              </button>)}
          </div>
          <div class="chip-row">
            {['全部', '图文', '短视频', '直播', '行情简报'].map(item => <button type="button" key={item} class={`chip${view_contentType === item ? ' on' : ''}`} onClick={() => {
                setContentType(item);
                load(1, view_channel, item, view_keyword);
              }}>
                {item}
              </button>)}
          </div>
        </div>
      </section>

      <div class="grid-main-aside">
        <div class="stack">
          {view_data.items.map(article => <ArticleCard key={article.id} article={article} />)}
          {view_data.items.length === 0 && <p class="muted small" style={{
              padding: "30px",
              textAlign: 'center'
            }}>没有符合条件的资讯</p>}
          <div class="row between">
            <span class="small muted">共 {view_data.total} 条 · 第 {view_data.page} 页</span>
            <Pagination current={view_page} pageSize={view_data.size} total={view_data.total} showSizeChanger={false} onChange={nextPage => load(nextPage)} />
          </div>
        </div>

        <aside class="stack">
          <section class="surface-card">
            <b style={{
                fontSize: "13.5px"
              }}>🔥 热读榜</b>
            <div class="hot-rank" style={{
                marginTop: "8px"
              }}>
              {view_data.hot.map((item, index) => <button type="button" key={item.id} onClick={() => view_navigate('news-detail', item.id)}>
                  <span class="rank-no">{index + 1}</span>
                  <span class="rank-name">{item.coverIcon} {item.title}</span>
                  <span class="small muted">{item.readCount > 10000 ? `${(item.readCount / 10000).toFixed(1)}万` : item.readCount}</span>
                </button>)}
            </div>
          </section>

          <section class="surface-card">
            <b style={{
                fontSize: "13.5px"
              }}>栏目订阅</b>
            <p class="small muted" style={{
                margin: '8px 0 12px',
                lineHeight: 1.7
              }}>
              订阅后新内容会进入「预警与订阅」，也可以开启每日摘要推送。
            </p>
            <Button block onClick={() => view_navigate('alerts')}>管理订阅</Button>
          </section>
        </aside>
      </div>
    </div>;
    };
  }
});
