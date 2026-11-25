import { defineComponent, ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, type PropType, type VNodeChild } from 'vue';
import { useFormModel } from '../components/vue-form';
import { DownloadOutlined, ThunderboltOutlined } from "@ant-design/icons-vue";
import { Button, message } from "../components/vue-ui";
import { infoApi } from '../api';
import { useApp } from '../app-context';
import type { MarketData } from '../types';
import { AiCard, ChangePct, ErrorBlock, LoadingBlock, PageTitle, QuoteRow, StatTile } from '../components/ui';
export const MarketPage = defineComponent({
  name: "MarketPage",
  props: {},
  setup(__props, {
    slots: __slots
  }) {
    const __useApp = useApp();
    const navigate = computed(() => __useApp.navigate);
    const openMarket = computed(() => __useApp.openMarket);
    const data = ref<MarketData | null>(null);
    const setData = (next: MarketData | null | ((previous: MarketData | null) => MarketData | null)) => {
      data.value = typeof next === 'function' ? (next as (previous: MarketData | null) => MarketData | null)(data.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const category = ref('全部');
    const setCategory = (next: typeof category.value | ((previous: typeof category.value) => typeof category.value)) => {
      category.value = typeof next === 'function' ? (next as (previous: typeof category.value) => typeof category.value)(category.value) : next;
    };
    const market = ref('全国综合');
    const setMarket = (next: typeof market.value | ((previous: typeof market.value) => typeof market.value)) => {
      market.value = typeof next === 'function' ? (next as (previous: typeof market.value) => typeof market.value)(market.value) : next;
    };
    const keyword = ref('');
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    const load = (nextCategory = category.value, nextMarket = market.value, nextKeyword = keyword.value): void => {
      setError('');
      infoApi.markets({
        category: nextCategory === '全部' ? undefined : nextCategory,
        market: nextMarket === '全国综合' ? undefined : nextMarket,
        keyword: nextKeyword || undefined
      }).then(setData).catch((reason: Error) => setError(reason.message));
    };
    {
      let dispose: void | (() => void);
      onMounted(() => {
        dispose = (() => {
          load();
        })();
      });
      onBeforeUnmount(() => {
        if (typeof dispose === 'function') dispose();
      });
    }
    return () => {
      const view_data = data.value;
      const view_error = error.value;
      const view_navigate = navigate.value;
      const view_category = category.value;
      const view_market = market.value;
      const view_keyword = keyword.value;
      const view_openMarket = openMarket.value;
      if (!view_data && !view_error) return <LoadingBlock rows={4} />;
      if (view_error || !view_data) return <ErrorBlock message={view_error} />;
      return <div class="page-stack">
      <PageTitle eyebrow="MARKET QUOTES" title="行情中心" description="覆盖 200+ 核心农产品 · 批发市场数据 T+0 实时更新 · 产地价格 T+1（每日 18:00）更新" actions={<>
            <Button icon={<DownloadOutlined />} onClick={() => message.success('已生成行情导出任务，完成后在消息中心下载')}>导出行情</Button>
            <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => view_navigate('alerts')}>设置价格预警</Button>
          </>} />

      <div class="grid-4">
        <StatTile label="监测品种" value={view_data.stats.total} unit="个" note="覆盖蔬菜 / 水果 / 粮油 / 畜禽 / 水产" />
        <StatTile label="今日上涨品种" value={view_data.stats.up} unit="个" note="葱姜蒜类领涨" tone="up" />
        <StatTile label="今日下跌品种" value={view_data.stats.down} unit="个" note="叶菜类多数回落" tone="down" />
        <StatTile label="异常波动预警" value={view_data.stats.abnormal} unit="条" note="超过历史均值 2 倍标准差" tone="warn" />
      </div>

      <section class="surface-card">
        <div class="row" style={{
            gap: "14px"
          }}>
          <span class="small muted">品类</span>
          <div class="chip-row">
            {['全部', ...view_data.categories].map(item => <button type="button" key={item} class={`chip${view_category === item ? ' on' : ''}`} onClick={() => {
                setCategory(item);
                load(item, view_market, view_keyword);
              }}>
                {item}
              </button>)}
          </div>
          <div style={{
              flex: 1
            }} />
          <div class="row" style={{
              gap: "8px"
            }}>
            <select class="chip" value={view_market} onInput={event => {
                setMarket((event.target as HTMLInputElement).value);
                load(view_category, (event.target as HTMLInputElement).value, view_keyword);
              }}>
              {['全国综合', ...view_data.markets].map(item => <option key={item} value={item}>{item}</option>)}
            </select>
            <input class="chip" style={{
                width: "180px"
              }} placeholder="搜索品种 / 产地" value={view_keyword} onInput={event => setKeyword((event.target as HTMLInputElement).value)} onKeydown={event => {
                if (event.key === 'Enter') load();
              }} />
            <Button size="small" onClick={() => load()}>筛选</Button>
          </div>
        </div>
      </section>

      <div class="grid-main-aside">
        <section class="surface-card">
          <div class="row between" style={{
              marginBottom: "10px"
            }}>
            <b style={{
                fontSize: "14px"
              }}>热门品种实时行情 <span class="soft-tag">单位：元/公斤</span></b>
            <button type="button" class="link-button" onClick={() => view_navigate('compare')}>多品种比价 →</button>
          </div>
          <div class="table-scroll">
            <table class="data-table clickable">
              <thead>
                <tr>
                  <th>品种</th><th>主产区 / 市场</th><th class="num">最新价</th><th class="num">涨跌额</th>
                  <th class="num">涨跌幅</th><th>近 7 日走势</th><th>操作</th>
                </tr>
              </thead>
              <tbody>
                {view_data.quotes.map(quote => <QuoteRow key={quote.id} quote={quote} onOpen={() => view_openMarket(quote.id)} />)}
              </tbody>
            </table>
          </div>
          {view_data.quotes.length === 0 && <p class="muted small" style={{
              padding: "20px",
              textAlign: 'center'
            }}>没有符合条件的品种</p>}
        </section>

        <aside class="stack">
          <section class="surface-card">
            <b style={{
                fontSize: "13.5px"
              }}>🗺️ 产区价格对比</b>
            <table class="data-table" style={{
                marginTop: "8px"
              }}>
              <thead><tr><th>产区</th><th class="num">价格</th><th class="num">较昨日</th></tr></thead>
              <tbody>
                {view_data.regionPrices.map(row => <tr key={row.region}>
                    <td>{row.region}</td>
                    <td class="num"><b>{Number(row.price).toFixed(2)}</b></td>
                    <td class="num"><ChangePct value={Number(row.changePct)} digits={1} /></td>
                  </tr>)}
              </tbody>
            </table>
            <Button size="small" style={{
                width: '100%',
                marginTop: "12px"
              }} onClick={() => view_navigate('compare')}>进入多品种比价</Button>
          </section>

          <AiCard title="AI 行情解读" confidence={view_data.aiRead.confidence} actions={<Button size="small" type="primary" ghost onClick={() => view_navigate('forecast')}>查看预测</Button>}>
            {view_data.aiRead.content}
          </AiCard>

          <section class="surface-card">
            <b style={{
                fontSize: "13.5px"
              }}>价格指数速览</b>
            <div class="row" style={{
                marginTop: "10px",
                gap: "8px"
              }}>
              <Button size="small" onClick={() => view_navigate('indices')}>查看 5 条指数</Button>
              <Button size="small" onClick={() => view_navigate('news', undefined, {
                  channel: '市场动态'
                })}>行情解读资讯</Button>
            </div>
          </section>
        </aside>
      </div>
    </div>;
    };
  }
});
