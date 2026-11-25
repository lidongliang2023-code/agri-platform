import { defineComponent, ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, type PropType, type VNodeChild } from 'vue';
import { useFormModel } from '../components/vue-form';
import { Button, message } from "../components/vue-ui";
import { infoApi } from '../api';
import { useApp } from '../app-context';
import type { MarketData, Quote } from '../types';
import { ChangePct, ErrorBlock, LoadingBlock, PageTitle, Sparkline } from '../components/ui';
const COLORS = ['#2d8f4e', '#17698f', '#ae6b00', '#6b4192', '#b43c3c'];
export const ComparePage = defineComponent({
  name: "ComparePage",
  props: {},
  setup(__props, {
    slots: __slots
  }) {
    const __useApp = useApp();
    const navigate = computed(() => __useApp.navigate);
    const pool = ref<Quote[]>([]);
    const setPool = (next: Quote[] | ((previous: Quote[]) => Quote[])) => {
      pool.value = typeof next === 'function' ? (next as (previous: Quote[]) => Quote[])(pool.value) : next;
    };
    const selected = ref<number[]>([]);
    const setSelected = (next: number[] | ((previous: number[]) => number[])) => {
      selected.value = typeof next === 'function' ? (next as (previous: number[]) => number[])(selected.value) : next;
    };
    const items = ref<Quote[]>([]);
    const setItems = (next: Quote[] | ((previous: Quote[]) => Quote[])) => {
      items.value = typeof next === 'function' ? (next as (previous: Quote[]) => Quote[])(items.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const loading = ref(true);
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    {
      let dispose: void | (() => void);
      onMounted(() => {
        dispose = (() => {
          infoApi.markets().then((data: MarketData) => {
            setPool(data.quotes);
            const initial = data.quotes.slice(0, 3).map(quote => quote.id);
            setSelected(initial);
            return infoApi.compare(initial);
          }).then(setItems).catch((reason: Error) => setError(reason.message)).finally(() => setLoading(false));
        })();
      });
      onBeforeUnmount(() => {
        if (typeof dispose === 'function') dispose();
      });
    }
    const toggle = (id: number): void => {
      const next = selected.value.includes(id) ? selected.value.filter(item => item !== id) : [...selected.value, id];
      if (next.length === 0) {
        message.warning('至少选择一个品种');
        return;
      }
      if (next.length > 5) {
        message.warning('最多同时比价 5 个品种');
        return;
      }
      setSelected(next);
      infoApi.compare(next).then(setItems).catch((reason: Error) => message.error(reason.message));
    };
    return () => {
      const view_loading = loading.value;
      const view_error = error.value;
      const view_items = items.value;
      const view_navigate = navigate.value;
      const view_selected = selected.value;
      const view_pool = pool.value;
      if (view_loading) return <LoadingBlock rows={3} />;
      if (view_error) return <ErrorBlock message={view_error} />;
      const maxLen = Math.max(...view_items.map(item => item.normalized?.length ?? 0), 1);
      return <div class="page-stack">
      <PageTitle eyebrow="COMPARE" title="多品种比价" description="把不同品种的价格折算为「基期 = 100」的相对走势，避免绝对值差异掩盖涨跌节奏。最多同时比价 5 个品种。" actions={<Button onClick={() => view_navigate('market')}>返回行情中心</Button>} />

      <section class="surface-card">
        <div class="small muted" style={{
            marginBottom: "10px"
          }}>选择品种（已选 {view_selected.length} / 5）</div>
        <div class="chip-row">
          {view_pool.map(quote => <button type="button" key={quote.id} class={`chip${view_selected.includes(quote.id) ? ' on' : ''}`} onClick={() => toggle(quote.id)}>
              {quote.icon} {quote.name}
            </button>)}
        </div>
      </section>

      <div class="grid-main-aside">
        <section class="surface-card">
          <b style={{
              fontSize: "14px"
            }}>相对走势（基期 = 100）</b>
          <svg viewBox="0 0 640 260" class="trend-chart" role="img" aria-label="多品种相对走势">
            {[0, 0.25, 0.5, 0.75, 1].map(ratio => <line key={ratio} x1="40" x2="624" y1={20 + ratio * 200} y2={20 + ratio * 200} class="chart-grid" />)}
            {view_items.map((quote, index) => {
                const points = quote.normalized ?? [];
                if (!points.length) return null;
                const min = Math.min(...view_items.flatMap(item => item.normalized ?? [100]));
                const max = Math.max(...view_items.flatMap(item => item.normalized ?? [100]));
                const span = max - min || 1;
                const step = 584 / Math.max(maxLen - 1, 1);
                const path = points.map((value, position) => `${position === 0 ? 'M' : 'L'}${40 + position * step},${220 - (value - min) / span * 200}`).join(' ');
                return <path key={quote.id} d={path} fill="none" stroke={COLORS[index % COLORS.length]} stroke-width="2.2" />;
              })}
            <text x="40" y="248" class="chart-axis">7 日前</text>
            <text x="600" y="248" class="chart-axis" text-anchor="end">今日</text>
          </svg>
          <div class="tag-row" style={{
              marginTop: "10px"
            }}>
            {view_items.map((quote, index) => <span key={quote.id} class="soft-tag">
                <i style={{
                  display: 'inline-block',
                  width: "8px",
                  height: "8px",
                  borderRadius: "4px",
                  background: COLORS[index % COLORS.length]
                }} />
                {quote.name}
              </span>)}
          </div>
        </section>

        <aside class="stack">
          <section class="surface-card">
            <b style={{
                fontSize: "13.5px"
              }}>比价要点</b>
            <div class="kv-list" style={{
                marginTop: "10px"
              }}>
              {view_items.map(quote => <div class="kv" key={quote.id}>
                  <span>{quote.icon} {quote.name}</span>
                  <b><ChangePct value={Number(quote.changePct)} digits={1} /></b>
                </div>)}
            </div>
            <p class="small muted" style={{
                marginTop: "12px",
                lineHeight: 1.7
              }}>
              相对走势消除了价格量纲差异：曲线越陡说明该品种近期涨跌节奏越快。若两条曲线出现明显分叉，通常意味着供需基本面出现分化。
            </p>
          </section>
        </aside>
      </div>

      <section class="surface-card">
        <b style={{
            fontSize: "14px"
          }}>明细对比</b>
        <div class="table-scroll" style={{
            marginTop: "10px"
          }}>
          <table class="data-table clickable">
            <thead>
              <tr>
                <th>品种</th><th>主产区</th><th class="num">最新价</th><th class="num">涨跌幅</th>
                <th class="num">近 7 日</th><th class="num">近 30 日</th><th>7 日走势</th><th>操作</th>
              </tr>
            </thead>
            <tbody>
              {view_items.map(quote => <tr key={quote.id} onClick={() => view_navigate('market-detail', quote.id)}>
                  <td><b>{quote.icon} {quote.name}</b></td>
                  <td>{quote.origin}</td>
                  <td class="num"><b>{Number(quote.price).toFixed(2)}</b></td>
                  <td class="num"><ChangePct value={Number(quote.changePct)} /></td>
                  <td class="num"><ChangePct value={Number(quote.weekPct)} digits={1} /></td>
                  <td class="num"><ChangePct value={Number(quote.monthPct)} digits={1} /></td>
                  <td><Sparkline points={quote.trend} /></td>
                  <td><button type="button" class="link-button" onClick={event => {
                      event.stopPropagation();
                      view_navigate('market-detail', quote.id);
                    }}>详情</button></td>
                </tr>)}
            </tbody>
          </table>
        </div>
      </section>
    </div>;
    };
  }
});
