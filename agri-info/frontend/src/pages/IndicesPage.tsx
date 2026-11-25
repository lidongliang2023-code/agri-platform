import { defineComponent, ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, type PropType, type VNodeChild } from 'vue';
import { useFormModel } from '../components/vue-form';
import { Drawer, Button } from "../components/vue-ui";
import { infoApi } from '../api';
import { useApp } from '../app-context';
import type { IndexDetail, PriceIndex } from '../types';
import { ChangePct, ErrorBlock, LoadingBlock, PageTitle, Sparkline, TrendChart } from '../components/ui';
export const IndicesPage = defineComponent({
  name: "IndicesPage",
  props: {},
  setup(__props, {
    slots: __slots
  }) {
    const __useApp = useApp();
    const navigate = computed(() => __useApp.navigate);
    const items = ref<PriceIndex[] | null>(null);
    const setItems = (next: PriceIndex[] | null | ((previous: PriceIndex[] | null) => PriceIndex[] | null)) => {
      items.value = typeof next === 'function' ? (next as (previous: PriceIndex[] | null) => PriceIndex[] | null)(items.value) : next;
    };
    const detail = ref<IndexDetail | null>(null);
    const setDetail = (next: IndexDetail | null | ((previous: IndexDetail | null) => IndexDetail | null)) => {
      detail.value = typeof next === 'function' ? (next as (previous: IndexDetail | null) => IndexDetail | null)(detail.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    {
      let dispose: void | (() => void);
      onMounted(() => {
        dispose = (() => {
          infoApi.indices().then(setItems).catch((reason: Error) => setError(reason.message));
        })();
      });
      onBeforeUnmount(() => {
        if (typeof dispose === 'function') dispose();
      });
    }
    const open = (id: number): void => {
      infoApi.indexDetail(id).then(setDetail).catch((reason: Error) => setError(reason.message));
    };
    return () => {
      const view_items = items.value;
      const view_error = error.value;
      const view_navigate = navigate.value;
      const view_detail = detail.value;
      if (!view_items && !view_error) return <LoadingBlock rows={4} />;
      if (view_error || !view_items) return <ErrorBlock message={view_error} />;
      return <div class="page-stack">
      <PageTitle eyebrow="PRICE INDEX" title="价格指数" description="平台按品类编制加权价格指数，基期 2020 年 = 100。指数日频计算，异常值自动剔除，用于观察板块性涨跌而非单一品种波动。" actions={<Button onClick={() => view_navigate('market')}>返回行情中心</Button>} />

      <div class="grid-3">
        {view_items.map(index => <button type="button" key={index.id} class="surface-card" style={{
            textAlign: 'left',
            cursor: 'pointer'
          }} onClick={() => open(index.id)}>
            <div class="row between">
              <span class="soft-tag tone-blue">{index.category}</span>
              <ChangePct value={Number(index.changePct)} />
            </div>
            <b style={{
              display: 'block',
              marginTop: "10px",
              fontSize: "14px"
            }}>{index.name}</b>
            <div class="row between" style={{
              marginTop: "8px"
            }}>
              <span style={{
                fontSize: "24px",
                fontWeight: 760,
                fontVariantNumeric: 'tabular-nums'
              }}>{Number(index.value).toFixed(2)}</span>
              <Sparkline points={index.trend} width={110} height={34} />
            </div>
            <p class="small muted" style={{
              marginTop: "8px"
            }}>
              基期 {index.basePeriod} · 样本 {index.sampleCount} 个 · {index.publishedAt}
            </p>
          </button>)}
      </div>

      <Drawer open={Boolean(view_detail)} onClose={() => setDetail(null)} width={720} title={view_detail ? `${view_detail.name}（${view_detail.code}）` : '指数详情'}>
        {view_detail && <div class="stack">
            <div class="row between">
              <div>
                <span class="small muted">最新指数</span>
                <div style={{
                  fontSize: "30px",
                  fontWeight: 780
                }}>{Number(view_detail).toFixed(2)}</div>
              </div>
              <ChangePct value={Number(view_detail.changePct)} />
            </div>
            <TrendChart series={view_detail.series} height={220} />
            <div class="kv-list">
              <div class="kv"><span>编制方法</span><b>{view_detail.method}</b></div>
              <div class="kv"><span>基期</span><b>{view_detail.basePeriod}</b></div>
              <div class="kv"><span>样本品种</span><b>{view_detail.sampleCount} 个</b></div>
              <div class="kv"><span>发布日期</span><b>{view_detail.publishedAt}</b></div>
            </div>
            <div>
              <b style={{
                fontSize: "13.5px"
              }}>权重品种（按波动排序）</b>
              <table class="data-table" style={{
                marginTop: "8px"
              }}>
                <thead><tr><th>品种</th><th>主产区</th><th class="num">价格</th><th class="num">涨跌幅</th></tr></thead>
                <tbody>
                  {view_detail.components.map(row => <tr key={row.id} onClick={() => view_navigate('market-detail', row.id)} style={{
                    cursor: 'pointer'
                  }}>
                      <td>{row.icon} {row.name}</td>
                      <td>{row.origin}</td>
                      <td class="num">{Number(row.price).toFixed(2)} {row.priceUnit}</td>
                      <td class="num"><ChangePct value={Number(row.changePct)} digits={1} /></td>
                    </tr>)}
                </tbody>
              </table>
            </div>
          </div>}
      </Drawer>
    </div>;
    };
  }
});
