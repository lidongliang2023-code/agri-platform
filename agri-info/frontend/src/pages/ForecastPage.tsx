import { defineComponent, ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, type PropType, type VNodeChild } from 'vue';
import { useFormModel } from '../components/vue-form';
import { Button, message } from "../components/vue-ui";
import { infoApi } from '../api';
import { useApp } from '../app-context';
import type { Forecast, MarketDetail, Quote } from '../types';
import { AiCard, ErrorBlock, LoadingBlock, PageTitle, TrendChart } from '../components/ui';
interface ForecastData {
  quote: Quote;
  forecast: Forecast | null;
  series: MarketDetail['series'];
  drivers: Array<{
    name: string;
    detail: string;
    weight: string;
    state: string;
  }>;
  mape: string;
}
export const ForecastPage = defineComponent({
  name: "ForecastPage",
  props: {},
  setup(__props, {
    slots: __slots
  }) {
    const __useApp = useApp();
    const query = computed(() => __useApp.query);
    const navigate = computed(() => __useApp.navigate);
    const pool = ref<Quote[]>([]);
    const setPool = (next: Quote[] | ((previous: Quote[]) => Quote[])) => {
      pool.value = typeof next === 'function' ? (next as (previous: Quote[]) => Quote[])(pool.value) : next;
    };
    const quoteId = ref(Number(query.value.get('quoteId')) || 1);
    const setQuoteId = (next: typeof quoteId.value | ((previous: typeof quoteId.value) => typeof quoteId.value)) => {
      quoteId.value = typeof next === 'function' ? (next as (previous: typeof quoteId.value) => typeof quoteId.value)(quoteId.value) : next;
    };
    const horizon = ref('7d');
    const setHorizon = (next: typeof horizon.value | ((previous: typeof horizon.value) => typeof horizon.value)) => {
      horizon.value = typeof next === 'function' ? (next as (previous: typeof horizon.value) => typeof horizon.value)(horizon.value) : next;
    };
    const data = ref<ForecastData | null>(null);
    const setData = (next: ForecastData | null | ((previous: ForecastData | null) => ForecastData | null)) => {
      data.value = typeof next === 'function' ? (next as (previous: ForecastData | null) => ForecastData | null)(data.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    {
      let dispose: void | (() => void);
      onMounted(() => {
        dispose = (() => {
          infoApi.markets().then(result => setPool(result.quotes)).catch(() => undefined);
        })();
      });
      onBeforeUnmount(() => {
        if (typeof dispose === 'function') dispose();
      });
    }
    onMounted(() => {
      watch(() => [quoteId.value, horizon.value], (_next, _prev, cleanup) => {
        const dispose = (() => {
          setError('');
          infoApi.forecast(quoteId.value, horizon.value).then(setData).catch((reason: Error) => setError(reason.message));
        })();
        if (typeof dispose === 'function') cleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    return () => {
      const view_data = data.value;
      const view_error = error.value;
      const view_quoteId = quoteId.value;
      const view_pool = pool.value;
      const view_horizon = horizon.value;
      const view_navigate = navigate.value;
      if (!view_data && !view_error) return <LoadingBlock rows={4} />;
      if (view_error || !view_data) return <ErrorBlock message={view_error} />;
      const forecast = view_data.forecast;
      const risks = parseRisks(forecast?.riskJson ?? '[]');
      return <div class="page-stack">
      <PageTitle eyebrow="AI FORECAST" title="AI 行情预测与供需决策" description={`多源数据融合预测引擎 · 7 日 MAPE ${view_data.mape}% · 模型每日凌晨 02:00 更新 · 当前品种 ${view_data.quote.name}（${view_data.quote.origin}）`} actions={<>
            <select class="chip" value={view_quoteId} onInput={event => setQuoteId(Number((event.target as HTMLInputElement).value))}>
              {view_pool.map(quote => <option key={quote.id} value={quote.id}>{quote.icon} {quote.name}（{quote.origin}）</option>)}
            </select>
            <select class="chip" value={view_horizon} onInput={event => setHorizon((event.target as HTMLInputElement).value)}>
              <option value="7d">未来 7 天</option>
              <option value="30d">未来 30 天</option>
            </select>
            <Button onClick={() => view_navigate('market-detail', view_data.quote.id)}>查看品种行情</Button>
          </>} />

      {!forecast ? <section class="surface-card">
          <p class="muted">该品种暂无预测模型输出，建议先补充行情数据或选择已纳入预测的品种。</p>
        </section> : <>
          <div class="grid-main-aside">
            <section class="surface-card">
              <div class="row between" style={{
                marginBottom: "8px"
              }}>
                <b style={{
                  fontSize: "14px"
                }}>价格预测区间</b>
                <span class="soft-tag tone-purple">AI Forecast · {view_horizon === '7d' ? '未来 7 天' : '未来 30 天'}</span>
              </div>
              <TrendChart series={view_data.series} />
              <div class="row" style={{
                gap: "16px",
                marginTop: "8px"
              }}>
                <span class="small muted">预测中值 <b>{Number(forecast.midPrice).toFixed(2)}</b> {view_data.quote.priceUnit}</span>
                <span class="small muted">区间 {Number(forecast.lowPrice).toFixed(2)} – {Number(forecast.highPrice).toFixed(2)}</span>
                <span class="small muted">上涨 {forecast.upProbability}% / 震荡 {forecast.flatProbability}% / 下跌 {forecast.downProbability}%</span>
              </div>
            </section>

            <aside class="stack">
              <section class="surface-card">
                <b style={{
                  fontSize: "13.5px"
                }}>供需平衡研判</b>
                <div style={{
                  marginTop: "12px"
                }}>
                  <div class="row between small"><span>供给指数</span><b class="up">{forecast.supplyIndex < 50 ? '偏紧' : '偏松'} {forecast.supplyIndex}</b></div>
                  <div class="confidence-bar" style={{
                    marginTop: "5px",
                    background: '#f2f6f3'
                  }}><i style={{
                      width: `${forecast.supplyIndex}%`,
                      background: 'linear-gradient(90deg,#e8b339,#ae6b00)'
                    }} /></div>
                </div>
                <div style={{
                  marginTop: "14px"
                }}>
                  <div class="row between small"><span>需求指数</span><b class="up">旺盛 {forecast.demandIndex}</b></div>
                  <div class="confidence-bar" style={{
                    marginTop: "5px",
                    background: '#f2f6f3'
                  }}><i style={{
                      width: `${forecast.demandIndex}%`,
                      background: 'linear-gradient(90deg,#e57f7f,#c62828)'
                    }} /></div>
                </div>
                <div class="kv-list" style={{
                  marginTop: "14px"
                }}>
                  <div class="kv"><span>库存周转</span><b>{forecast.stockDays}</b></div>
                  <div class="kv"><span>模型置信度</span><b>{forecast.confidence}%</b></div>
                  <div class="kv"><span>更新时间</span><b>{forecast.updatedAt}</b></div>
                </div>
              </section>
            </aside>
          </div>

          <div class="grid-3">
            <AiCard title="销售决策建议" confidence={forecast.confidence} actions={<>
                <Button size="small" type="primary" ghost onClick={() => message.success('已采纳建议，将同步到我的农事待办')}>采纳建议</Button>
                <Button size="small" onClick={() => message.info('已忽略该建议，模型会记录你的偏好')}>忽略</Button>
              </>}>
              {forecast.salesAdvice}
            </AiCard>
            <AiCard title="种植决策参考" confidence={Math.max(forecast.confidence - 14, 55)}>
              {forecast.plantAdvice}
            </AiCard>
            <section class="surface-card">
              <b style={{
                fontSize: "13.5px"
              }}>⚠️ 风险三色预警</b>
              <div class="kv-list" style={{
                marginTop: "10px"
              }}>
                {risks.map(risk => <div class="kv" key={risk.name}>
                    <span>{risk.name}</span>
                    <b class={risk.probability >= 50 ? 'up' : risk.probability >= 30 ? '' : 'down'}>
                      {risk.level} {risk.probability}%
                    </b>
                  </div>)}
              </div>
              <p class="small muted" style={{
                marginTop: "10px",
                lineHeight: 1.7
              }}>
                主因提示：{view_data.drivers.slice(0, 3).map(driver => driver.state).join('；')}。
              </p>
            </section>
          </div>

          <section class="surface-card">
            <b style={{
              fontSize: "14px"
            }}>多源数据融合与驱动因子</b>
            <div class="grid-4" style={{
              marginTop: "12px"
            }}>
              {view_data.drivers.map(driver => <div key={driver.name} class="surface-card" style={{
                padding: "12px",
                background: '#fbfdfc'
              }}>
                  <b style={{
                  fontSize: "12.5px"
                }}>{driver.name}</b>
                  <p class="small muted" style={{
                  marginTop: "5px"
                }}>{driver.detail} · {driver.weight}</p>
                  <span class="soft-tag tone-green" style={{
                  marginTop: "8px"
                }}>{driver.state}</span>
                </div>)}
            </div>
          </section>
        </>}
    </div>;
    };
  }
});
function parseRisks(raw: string): Array<{
  name: string;
  level: string;
  probability: number;
}> {
  try {
    const parsed = JSON.parse(raw) as Array<{
      name: string;
      level: string;
      probability: number;
    }>;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
