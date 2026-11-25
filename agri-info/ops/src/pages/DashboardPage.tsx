import { defineComponent, ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, type PropType, type VNodeChild } from 'vue';
import { useFormModel } from '../components/vue-form';
import { Button, Tag, message } from "../components/vue-ui";
import { opsApi } from '../api';
import { useApp } from '../app-context';
import type { Dashboard } from '../types';
import { DistributionDonut, ErrorBlock, LoadingBlock, OpsTrendChart, PageTitle, SectionHeading, StatTile, StatusTag, formatCount, riskLabel } from '../components/ui';

/** 运营大盘：指标卡 + 产量/阅读趋势 + 渠道分布 + 待办（待审内容、预警）。 */
export const DashboardPage = defineComponent({
  name: "DashboardPage",
  props: {},
  setup(__props, {
    slots: __slots
  }) {
    const __useApp = useApp();
    const navigate = computed(() => __useApp.navigate);
    const data = ref<Dashboard | null>(null);
    const setData = (next: Dashboard | null | ((previous: Dashboard | null) => Dashboard | null)) => {
      data.value = typeof next === 'function' ? (next as (previous: Dashboard | null) => Dashboard | null)(data.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const load = (): void => {
      setError('');
      opsApi.dashboard().then(setData).catch((reason: Error) => setError(reason.message));
    };
    {
      let dispose: void | (() => void);
      onMounted(() => {
        dispose = load();
      });
      onBeforeUnmount(() => {
        if (typeof dispose === 'function') dispose();
      });
    }
    return () => {
      const view_data = data.value;
      const view_error = error.value;
      const view_navigate = navigate.value;
      if (!view_data && !view_error) return <LoadingBlock rows={4} />;
      if (view_error || !view_data) return <ErrorBlock message={view_error} onRetry={load} />;
      const accuracy = Array.isArray(view_data.quoteQuality.accuracy) ? 100 - view_data.quoteQuality.accuracy.reduce((sum, item) => sum + Number(item.mape || 0), 0) / Math.max(view_data.quoteQuality.accuracy.length, 1) : Number(view_data.quoteQuality.accuracy);
      return <div class="page-stack">
      <PageTitle eyebrow="OPERATIONS DASHBOARD" title="运营大盘" description="内容、行情、供需与 AI 服务运行态势 · 数据每 5 分钟刷新 · 所有指标支持下钻到明细" actions={<>
            <Button onClick={() => view_navigate('stats')}>统计报表</Button>
            <Button type="primary" onClick={() => view_navigate('contents')}>处理待审核（{view_data.pending.length}）</Button>
          </>} />

      <div class="grid-6">
        {view_data.cards.map(card => <StatTile key={card.label} label={card.label} value={card.value} unit={card.unit} note={card.note} tone={card.tone} />)}
      </div>

      <div class="grid-main-aside">
        <section class="surface-card">
          <SectionHeading kicker="TREND" title="内容产量与阅读量趋势" />
          <OpsTrendChart points={view_data.trend} />
          <div class="row" style={{
              gap: "18px",
              marginTop: "6px"
            }}>
            <span class="chart-legend"><i class="bar" /> 每日产出（条）</span>
            <span class="chart-legend"><i class="line" /> 阅读量 PV（次）</span>
          </div>
        </section>

        <section class="surface-card">
          <SectionHeading kicker="CHANNEL MIX" title="渠道内容分布" />
          <DistributionDonut items={view_data.distribution} />
        </section>
      </div>

      <div class="grid-4">
        <StatTile label="监测品种" value={view_data.quoteQuality.quoteCount} unit="个" note={`目标 ${view_data.quoteQuality.targetCount} 个`} />
        <StatTile label="数据源" value={view_data.quoteQuality.sourceCount} unit="个" note={`正常 ${view_data.quoteQuality.sourceNormal} 个`} tone="up" />
        <StatTile label="数据可用率" value={view_data.quoteQuality.availableRate} unit="%" note={`拦截 ${view_data.quoteQuality.blockedRows} 行`} tone="up" />
        <StatTile label="采集准确率" value={accuracy.toFixed(2)} unit="%" note={`累计 ${formatCount(view_data.quoteQuality.points)} 条报价`} />
      </div>

      <div class="grid-main-aside">
        <section class="surface-card">
          <SectionHeading kicker="待办审核" title="待审核内容" action="全部内容" onAction={() => view_navigate('contents')} />
          {view_data.pending.length === 0 && <p class="muted small">暂无待审核内容。</p>}
          <div class="stack" style={{
              gap: "10px"
            }}>
            {view_data.pending.map(item => {
                const risk = riskLabel(item.riskLevel);
                return <article class="audit-row" key={item.id}>
                  <span class="audit-icon">{item.coverIcon || '📄'}</span>
                  <div style={{
                    flex: 1,
                    minWidth: "0px"
                  }}>
                    <div class="row" style={{
                      gap: "8px",
                      flexWrap: 'wrap'
                    }}>
                      <b style={{
                        fontSize: "13px"
                      }}>{item.title}</b>
                      <Tag class={`soft-tag tone-${risk.tone}`}>{risk.label}</Tag>
                      <StatusTag status={item.status} />
                    </div>
                    <p class="small muted" style={{
                      margin: '6px 0'
                    }}>
                      {item.channel} · {item.contentType} · {item.author} · {item.publishedAt || '待发布'}
                    </p>
                    {item.riskNote && <p class="small" style={{
                      color: '#ae6b00'
                    }}>风险提示：{item.riskNote}</p>}
                  </div>
                  <div class="row" style={{
                    gap: "8px"
                  }}>
                    <Button size="small" onClick={() => view_navigate('contents')}>去审核</Button>
                  </div>
                </article>;
              })}
          </div>
        </section>

        <section class="surface-card">
          <SectionHeading kicker="ALERTS" title="最近价格预警" action="预警配置" onAction={() => view_navigate('quotes')} />
          {view_data.recentAlerts.length === 0 && <p class="muted small">暂无预警记录。</p>}
          <div class="stack" style={{
              gap: "10px"
            }}>
            {view_data.recentAlerts.map(alert => <div class="alert-row" key={alert.id}>
                <span class={`alert-level tone-${alert.level === 'high' ? 'up' : alert.level === 'medium' ? 'amber' : 'default'}`}>
                  {alert.level === 'high' ? '高' : alert.level === 'medium' ? '中' : '低'}
                </span>
                <div style={{
                  flex: 1
                }}>
                  <b style={{
                    fontSize: "12.5px"
                  }}>{alert.title}</b>
                  <p class="small muted" style={{
                    marginTop: "4px"
                  }}>{alert.quoteName} · 触发值 {alert.triggerValue} · {alert.createdAt}</p>
                </div>
              </div>)}
          </div>
          <Button block style={{
              marginTop: "12px"
            }} onClick={() => message.info('演示环境不发送真实推送，正式版对接站内信与短信通道')}>
            一键推送今日行情简报
          </Button>
        </section>
      </div>
    </div>;
    };
  }
});
