import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { dayLabel, formatCount, infoPublicApi, type Article, type Channel } from './infoApi';
import './info.css';

/**
 * 产业资讯列表：频道筛选 + 关键词搜索 + 分页。
 *
 * <p>原本是独立的 `#/info/news` 页面，和资讯首页各自维护一套文章列表 ——
 * 两页都在展示文章，用户还得多点一次才能看到筛选和分页。合并后它作为首页的一个区块存在。</p>
 */
export const NewsFeed = defineComponent({
  name: "NewsFeed",
  props: {
    pageSize: null as unknown as PropType<{
      pageSize?: number;
    }["pageSize"]>
  },
  setup(__props: {
    pageSize?: number;
  }, {
    slots: __slots
  }) {
    const channels = ref<Channel[]>([]);
    const setChannels = (next: typeof channels.value | ((previous: typeof channels.value) => typeof channels.value)) => {
      channels.value = typeof next === 'function' ? (next as (previous: typeof channels.value) => typeof channels.value)(channels.value) : next;
    };
    const items = ref<Article[]>([]);
    const setItems = (next: typeof items.value | ((previous: typeof items.value) => typeof items.value)) => {
      items.value = typeof next === 'function' ? (next as (previous: typeof items.value) => typeof items.value)(items.value) : next;
    };
    const channel = ref('');
    const setChannel = (next: typeof channel.value | ((previous: typeof channel.value) => typeof channel.value)) => {
      channel.value = typeof next === 'function' ? (next as (previous: typeof channel.value) => typeof channel.value)(channel.value) : next;
    };
    const keyword = ref('');
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    const draft = ref('');
    const setDraft = (next: typeof draft.value | ((previous: typeof draft.value) => typeof draft.value)) => {
      draft.value = typeof next === 'function' ? (next as (previous: typeof draft.value) => typeof draft.value)(draft.value) : next;
    };
    const page = ref(1);
    const setPage = (next: typeof page.value | ((previous: typeof page.value) => typeof page.value)) => {
      page.value = typeof next === 'function' ? (next as (previous: typeof page.value) => typeof page.value)(page.value) : next;
    };
    const total = ref(0);
    const setTotal = (next: typeof total.value | ((previous: typeof total.value) => typeof total.value)) => {
      total.value = typeof next === 'function' ? (next as (previous: typeof total.value) => typeof total.value)(total.value) : next;
    };
    const loading = ref(true);
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    (() => {
      let dispose: void | (() => void);
      onMounted(() => {
        dispose = (() => {
          infoPublicApi.channels().then(setChannels).catch(() => setChannels([]));
        })();
      });
      onBeforeUnmount(() => {
        if (typeof dispose === 'function') dispose();
      });
    })();
    onMounted(() => {
      watch(() => [channel.value, keyword.value, page.value, __props.pageSize ?? 8], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          let cancelled = false;
          setLoading(true);
          setError('');
          infoPublicApi.articles({
            channel: channel.value || undefined,
            keyword: keyword.value || undefined,
            page: page.value,
            size: __props.pageSize ?? 8
          }).then(data => {
            if (cancelled) return;
            setItems(data.items ?? []);
            setTotal(data.total ?? 0);
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
    const pages = computed(() => Math.max(1, Math.ceil(total.value / (__props.pageSize ?? 8))));
    const search = (): void => {
      setKeyword(draft.value.trim());
      setPage(1);
    };
    return () => {
      const view_total = total.value;
      const view_draft = draft.value;
      const view_keyword = keyword.value;
      const view_channel = channel.value;
      const view_channels = channels.value;
      const view_error = error.value;
      const view_loading = loading.value;
      const view_items = items.value;
      const view_pages = pages.value;
      const view_page = page.value;
      return <>
      <div class="info-section-head">
        <h2>
          产业资讯 <small>政策 · 市场 · 技术 · 国际</small>
        </h2>
        <span class="small gray">共 {view_total} 条</span>
      </div>

      <div class="info-filter" style={{
          marginBottom: "14px"
        }}>
        <input value={view_draft} placeholder="搜标题、摘要" onInput={event => setDraft((event.target as HTMLInputElement).value)} onKeydown={event => {
            if (event.key === 'Enter') search();
          }} style={{
            flex: 1,
            minWidth: "180px"
          }} />
        <button type="button" class="info-chip on" onClick={search}>搜索</button>
        {view_keyword && <button type="button" class="info-chip" onClick={() => {
            setDraft('');
            setKeyword('');
            setPage(1);
          }}>
            清除「{view_keyword}」
          </button>}
      </div>

      <div class="info-chips" style={{
          marginBottom: "16px"
        }}>
        <button type="button" class={`info-chip${view_channel === '' ? ' on' : ''}`} onClick={() => {
            setChannel('');
            setPage(1);
          }}>
          全部
        </button>
        {view_channels.map(item => <button type="button" key={item.id} class={`info-chip${view_channel === item.name ? ' on' : ''}`} onClick={() => {
            setChannel(item.name);
            setPage(1);
          }}>
            {item.icon} {item.name}
          </button>)}
      </div>

      {view_error && <div class="info-error">{view_error}</div>}
      {view_loading && <div class="info-loading">正在加载资讯…</div>}
      {!view_loading && view_items.length === 0 && !view_error && <div class="info-empty">该条件下暂无资讯</div>}

      <div class="info-card">
        {view_items.map(item => <a class="info-news-row" href={`#/info/news/${item.id}`} key={item.id} style={{
            display: 'flex'
          }}>
            <div class="info-news-ico">{item.coverIcon ?? '📄'}</div>
            <div style={{
              flex: 1,
              minWidth: "0px"
            }}>
              <div class="info-news-title">{item.title}</div>
              {item.summary && <div class="info-news-sub" style={{
                marginTop: "4px"
              }}>{item.summary}</div>}
              <div class="info-news-sub">
                {item.channel}
                {item.author ? ` · ${item.author}` : ''}
                {' · '}
                {dayLabel(item.publishedAt ?? item.createdAt)}
                {' · 阅读 '}
                {formatCount(item.readCount)}
              </div>
            </div>
          </a>)}
      </div>

      {view_pages > 1 && <div class="info-chips" style={{
          justifyContent: 'center',
          marginTop: "20px"
        }}>
          <button type="button" class="info-chip" disabled={view_page <= 1} onClick={() => setPage(view_page - 1)}>
            上一页
          </button>
          <span class="small gray" style={{
            alignSelf: 'center'
          }}>{view_page} / {view_pages}</span>
          <button type="button" class="info-chip" disabled={view_page >= view_pages} onClick={() => setPage(view_page + 1)}>
            下一页
          </button>
        </div>}
    </>;
    };
  }
});
