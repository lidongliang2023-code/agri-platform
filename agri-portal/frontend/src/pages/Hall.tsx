import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { PortalPageHero } from '../components/PortalPageHero';
import { tradeUrl, useHashRoute, usePageMeta } from '../utils';
import './hall-embed.css';

/** 门户筛选参数 → 交易大厅参数；产业链频道并入后，旧的 l1/l2/l3/loc/q 深链继续可用。 */
const FILTER_PARAMS: Array<[string, string]> = [['l1', 'l1'], ['l2', 'l2'], ['l3', 'l3'], ['loc', 'province'], ['q', 'keyword'], ['tab', 'tab']];
export const Hall = defineComponent({
  name: "Hall",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const route = useHashRoute();
    const frameRef = shallowRef<HTMLIFrameElement | null>(null);
    const height = ref(1600);
    const setHeight = (next: typeof height.value | ((previous: typeof height.value) => typeof height.value)) => {
      height.value = typeof next === 'function' ? (next as (previous: typeof height.value) => typeof height.value)(height.value) : next;
    };
    const loading = ref(true);
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const loadError = ref(false);
    const setLoadError = (next: typeof loadError.value | ((previous: typeof loadError.value) => typeof loadError.value)) => {
      loadError.value = typeof next === 'function' ? (next as (previous: typeof loadError.value) => typeof loadError.value)(loadError.value) : next;
    };
    const refreshKey = ref(0);

    // 显式维护门户页面标题，解决从价格指数/资讯等页面切换后标题未更新的问题
    const setRefreshKey = (next: typeof refreshKey.value | ((previous: typeof refreshKey.value) => typeof refreshKey.value)) => {
      refreshKey.value = typeof next === 'function' ? (next as (previous: typeof refreshKey.value) => typeof refreshKey.value)(refreshKey.value) : next;
    };
    watchEffect(() => usePageMeta('交易大厅', '汇聚农业产业链优质货源与采购需求，支持在线议价与撮合交易'));
    const src = computed(() => {
      const params = new URLSearchParams({
        embed: '1',
        portalHero: '1'
      });
      FILTER_PARAMS.forEach(([from, to]) => {
        const value = route.value.query.get(from);
        if (value) params.set(to, value);
      });
      return `${tradeUrl('/hall')}?${params.toString()}`;
    });
    onMounted(() => {
      watch(() => [src.value, refreshKey.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          setLoading(true);
          setLoadError(false);
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    onMounted(() => {
      watch(() => [loading.value, src.value, refreshKey.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          if (!loading.value) return;
          const timer = window.setTimeout(() => {
            setLoading(false);
            setLoadError(true);
          }, 15000);
          return () => window.clearTimeout(timer);
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    (() => {
      let dispose: void | (() => void);
      onMounted(() => {
        dispose = (() => {
          const hallOrigin = new URL(tradeUrl('/')).origin;
          const onMessage = (event: MessageEvent): void => {
            if (event.origin !== hallOrigin || event.source !== frameRef.value?.contentWindow) return;
            const data = event.data as {
              type?: string;
              height?: number;
            } | null;
            if (!data || typeof data !== 'object') return;
            if (data.type === 'agri-hall-height' && typeof data.height === 'number' && Number.isFinite(data.height)) {
              setHeight(Math.max(900, Math.ceil(data.height)));
              setLoading(false);
              setLoadError(false);
            } else if (data.type === 'agri-hall-ready') {
              setLoading(false);
            }
          };
          window.addEventListener('message', onMessage);
          return () => window.removeEventListener('message', onMessage);
        })();
      });
      onBeforeUnmount(() => {
        if (typeof dispose === 'function') dispose();
      });
    })();
    return () => {
      const view_loading = loading.value;
      const view_loadError = loadError.value;
      const view_src = src.value;
      const view_refreshKey = refreshKey.value;
      const view_height = height.value;
      return <div class="portal-hall-page">
      <PortalPageHero badge="交易大厅 · 产销对接" title="交易大厅" description="汇聚农业产业链优质货源与采购需求，支持在线议价与平台撮合，让产销对接更高效。">
        <div class="portal-page-hero-actions"><a class="btn portal-page-btn-light" href="#/info/market">查看价格指数 →</a><a class="btn portal-page-btn-ghost" href="#/quality-trace">查询质量溯源 →</a></div>
      </PortalPageHero>
    <section class="portal-hall-embed" aria-label="交易大厅内容区域">
      {view_loading && !view_loadError && <div class="portal-hall-skeleton" role="status" aria-live="polite">
          <div class="skeleton-bar title-bar" />
          <div class="skeleton-grid">
            <div class="skeleton-card" />
            <div class="skeleton-card" />
            <div class="skeleton-card" />
            <div class="skeleton-card" />
          </div>
          <div class="skeleton-hint">正在加载交易大厅现货与需求数据…</div>
        </div>}

      {view_loadError && <div class="portal-hall-fallback">
          <div class="fallback-title">交易大厅嵌入加载遇到异常</div>
          <div class="fallback-desc">
            若长时间未展示，可直接前往独立交易大厅浏览，或点击重试。
          </div>
          <div class="fallback-actions">
            <button type="button" class="fallback-btn fallback-btn-primary" onClick={() => {
                setRefreshKey(v => v + 1);
              }}>
              重新加载
            </button>
            <a class="fallback-btn fallback-btn-subtle" href={view_src} target="_blank" rel="noreferrer">
              在新标签页打开交易大厅
            </a>
          </div>
        </div>}

      <iframe ref={frameRef} key={`${view_src}-${view_refreshKey}`} src={view_src} title="丰链云交易大厅" class={view_loading ? 'is-loading' : 'is-ready'} style={{
            height: `${view_height}px`
          }} scrolling="no" onLoad={event => {
            setLoading(false);
            setLoadError(false);
            try {
              (event.currentTarget as HTMLIFrameElement).contentWindow?.postMessage({
                type: 'agri-hall-ready'
              }, new URL(view_src).origin);
            } catch {
              // 忽略跨域常规派发提示
            }
          }} onError={() => {
            setLoading(false);
            setLoadError(true);
          }} />
    </section>
    </div>;
    };
  }
});
