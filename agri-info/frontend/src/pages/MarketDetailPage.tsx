import { defineComponent, ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, type PropType, type VNodeChild } from 'vue';
import { useFormModel } from '../components/vue-form';
import { BellOutlined, StarOutlined, SwapOutlined } from "@ant-design/icons-vue";
import { Button, message } from "../components/vue-ui";
import { infoApi } from '../api';
import { useApp } from '../app-context';
import type { MarketDetail } from '../types';
import { AiCard, ArticleCard, ChangePct, ErrorBlock, LoadingBlock, PageTitle, Sparkline, TrendChart } from '../components/ui';
export const MarketDetailPage = defineComponent({
  name: "MarketDetailPage",
  props: {},
  setup(__props, {
    slots: __slots
  }) {
    const __useApp = useApp();
    const id = computed(() => __useApp.id);
    const navigate = computed(() => __useApp.navigate);
    const data = ref<MarketDetail | null>(null);
    const setData = (next: MarketDetail | null | ((previous: MarketDetail | null) => MarketDetail | null)) => {
      data.value = typeof next === 'function' ? (next as (previous: MarketDetail | null) => MarketDetail | null)(data.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    onMounted(() => {
      watch(() => [id.value], (_next, _prev, cleanup) => {
        const dispose = (() => {
          if (!id.value) return;
          setError('');
          infoApi.market(id.value).then(setData).catch((reason: Error) => setError(reason.message));
        })();
        if (typeof dispose === 'function') cleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    return () => {
      const view_id = id.value;
      const view_data = data.value;
      const view_error = error.value;
      const view_navigate = navigate.value;
      if (!view_id) return <ErrorBlock message="缺少品种编号，请从行情中心进入" />;
      if (!view_data && !view_error) return <LoadingBlock rows={4} />;
      if (view_error || !view_data) return <ErrorBlock message={view_error} />;
      const tone = Number(view_data.changePct) >= 0 ? 'up' : 'down';
      const forecast = view_data.forecast;
      return <div class="page-stack">
      <PageTitle eyebrow={`${view_data.code} · ${view_data.category}`} title={`${view_data.icon} ${view_data.name}`} description={`主产区 ${view_data.origin} · ${view_data.market} · 更新于 ${view_data.updatedAt}（T+0）· 数据来源：${view_data.source}`} actions={<>
            <Button icon={<StarOutlined />} onClick={() => message.success('已加入收藏')}>收藏品种</Button>
            <Button icon={<SwapOutlined />} onClick={() => view_navigate('compare')}>加入比价</Button>
            <Button type="primary" icon={<BellOutlined />} onClick={() => view_navigate('alerts')}>设置预警</Button>
          </>} />

      <section class="detail-hero">
        <div class="row between">
          <div class="price-block">
            <span class={`big ${tone}`}>{Number(view_data.price).toFixed(2)}</span>
            <span class="muted small">{view_data.priceUnit}</span>
            <ChangePct value={Number(view_data.changePct)} />
            <span class="muted small">
              涨跌额 {Number(view_data.changeAmount) > 0 ? '+' : ''}{Number(view_data.changeAmount).toFixed(2)} · 近 7 日 {Number(view_data.weekPct).toFixed(1)}% · 近 30 日 {Number(view_data.monthPct).toFixed(1)}%
            </span>
          </div>
          <Sparkline points={view_data.trend} width={140} height={40} tone={tone} />
        </div>
        <div class="detail-meta">
          <span>规格：{view_data.spec}</span>
          <span>监测状态：{view_data.monitorLevel === 'abnormal' ? '异常波动' : '正常'}</span>
          <span>品种编码：{view_data.code}</span>
        </div>
      </section>

      <div class="grid-main-aside">
        <div class="stack">
          <section class="surface-card">
            <div class="row between" style={{
                marginBottom: "6px"
              }}>
              <b style={{
                  fontSize: "14px"
                }}>30 日价格走势与 7 日 AI 预测区间</b>
              <span class="small muted">实线为实际价，虚线为 AI 预测中值，阴影为 80% 置信区间</span>
            </div>
            <TrendChart series={view_data.series} />
          </section>

          {forecast && <div class="grid-3">
              <AiCard title="销售决策建议" confidence={forecast.confidence}>{forecast.salesAdvice}</AiCard>
              <AiCard title="种植决策参考" confidence={Math.max(forecast.confidence - 14, 55)}>{forecast.plantAdvice}</AiCard>
              <section class="surface-card">
                <b style={{
                  fontSize: "13.5px"
                }}>⚠️ 30 日风险提示</b>
                <div class="kv-list" style={{
                  marginTop: "10px"
                }}>
                  {safeRisks(forecast.riskJson).map(risk => <div class="kv" key={risk.name}>
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
                  供需缺口：供给指数 {forecast.supplyIndex} / 需求指数 {forecast.demandIndex}；库存 {forecast.stockDays}
                </p>
              </section>
            </div>}

          <section class="surface-card">
            <b style={{
                fontSize: "14px",
                display: 'block',
                marginBottom: "10px"
              }}>相关资讯</b>
            <div class="stack">
              {view_data.relatedArticles.map(article => <ArticleCard key={article.id} article={article} compact />)}
              {view_data.relatedArticles.length === 0 && <p class="muted small">暂无相关资讯</p>}
            </div>
          </section>
        </div>

        <aside class="stack">
          <section class="surface-card">
            <b style={{
                fontSize: "13.5px"
              }}>产区价格对比</b>
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
          </section>

          <AiCard title="AI 行情解读" confidence={view_data.aiRead.confidence} actions={<Button size="small" type="primary" ghost onClick={() => view_navigate('forecast', undefined, {
              quoteId: String(view_data.id)
            })}>
              查看供需预测
            </Button>}>
            {view_data.aiRead.content}
          </AiCard>

          <section class="surface-card">
            <b style={{
                fontSize: "13.5px"
              }}>我的预警规则</b>
            <div class="kv-list" style={{
                marginTop: "10px"
              }}>
              {view_data.alertRules.slice(0, 4).map(rule => <div class="kv" key={rule.id}>
                  <span>{rule.ruleName}</span>
                  <b class={rule.enabled ? 'down' : ''}>{rule.enabled ? '生效中' : '已停用'}</b>
                </div>)}
              {view_data.alertRules.length === 0 && <p class="muted small">尚未设置预警规则</p>}
            </div>
            <Button size="small" style={{
                width: '100%',
                marginTop: "12px"
              }} onClick={() => view_navigate('alerts')}>管理预警</Button>
          </section>
        </aside>
      </div>
    </div>;
    };
  }
});
function safeRisks(raw: string): Array<{
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
