import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { PortalPageHero } from '../components/PortalPageHero';
import { usePageMeta } from '../utils';
import './info/info.css';
import './quality-trace.css';
type Node = {
  seq?: number;
  title?: string;
  stageName?: string;
  detail?: string;
  occurredAt?: string;
  onChain?: boolean;
  chainType?: string;
  chainStatus?: string;
};
type Trace = {
  matched?: boolean;
  reason?: string;
  productName?: string;
  batchNo?: string;
  farmName?: string;
  codeStatus?: string;
  verifiable?: boolean;
  conclusion?: string;
  nodes?: Node[];
  circulation?: {
    boundAt?: string;
    orderStatus?: string;
    logisticsCompany?: string;
  }[];
};
const STATUS: Record<string, string> = {
  generated: '未激活',
  active: '已激活',
  scanned: '已扫码',
  revoked: '已作废',
  expired: '已过期'
};
const ORDER_STATUS: Record<string, string> = {
  PENDING_PAY: '待付款',
  PENDING_SHIP: '待发货',
  SHIPPED: '已发货',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  REFUNDED: '已退款'
};
export const QualityTrace = defineComponent({
  name: "QualityTrace",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    watchEffect(() => usePageMeta('质量溯源', '一物一码，查询农产品从种植、采收到仓储及零售履约的真实记录。'));
    const code = ref((() => new URLSearchParams(window.location.hash.split('?')[1] || '').get('code') || '')());
    const setCode = (next: typeof code.value | ((previous: typeof code.value) => typeof code.value)) => {
      code.value = typeof next === 'function' ? (next as (previous: typeof code.value) => typeof code.value)(code.value) : next;
    };
    const loading = ref(false);
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const trace = ref<Trace | null>(null);
    const setTrace = (next: typeof trace.value | ((previous: typeof trace.value) => typeof trace.value)) => {
      trace.value = typeof next === 'function' ? (next as (previous: typeof trace.value) => typeof trace.value)(trace.value) : next;
    };
    const request = shallowRef(0);
    const search = async () => {
      const value = code.value.trim();
      if (!value || value.length > 100) {
        setError('请输入包装上的有效单品码，长度不超过100个字符');
        return;
      }
      const id = ++request.value;
      setLoading(true);
      setError('');
      setTrace(null);
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(`/api/public/trace/code/${encodeURIComponent(value)}`, {
          signal: controller.signal
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || (response.status === 404 ? '未查询到该单品码' : '核验服务暂不可用'));
        if (typeof result.matched !== 'boolean' || !Array.isArray(result.nodes)) throw new Error('核验结果格式异常，请稍后重试');
        if (id === request.value) setTrace(result);
      } catch (e) {
        if (id === request.value) setError(e instanceof Error && e.name !== 'AbortError' ? e.message : '核验请求超时，请重试');
      } finally {
        window.clearTimeout(timer);
        if (id === request.value) setLoading(false);
      }
    };
    return () => {
      const view_code = code.value;
      const view_loading = loading.value;
      const view_error = error.value;
      const view_trace = trace.value;
      return <div class="info-page quality-public-page portal-channel-page">
    <PortalPageHero badge="质量溯源 · 一物一码" title="质量溯源" description="一物一码，追查从种植到流通的真实记录。质量结论、单品状态和存证结果分别展示。">
      <div class="portal-page-hero-actions"><a class="btn portal-page-btn-light" href="#/hall">前往交易大厅 →</a><a class="btn portal-page-btn-ghost" href="#/info">浏览产业资讯 →</a></div>
    </PortalPageHero>
    <form class="info-filter quality-code-query" onSubmit={e => {
          e.preventDefault();
          void search();
        }}>
      <label for="unit-trace-code">单品码</label><input id="unit-trace-code" value={view_code} maxlength={100} onInput={e => setCode((e.target as HTMLInputElement).value)} placeholder="输入产品包装上的单品溯源码" />
      <button type="submit" class="info-chip on" disabled={view_loading}>{view_loading ? '正在核验…' : '查询溯源'}</button>
    </form>
    <p class="quality-scope-note">同批次共享生产记录，每件销售单位使用独立单品码。未记录、未核验和查询失败会分别说明；存证成功不等于质量合格，也不证明包装上的码没有被复制。</p>
    {view_error && <div class="quality-query-error" role="alert">{view_error}</div>}
    {!view_trace && !view_error && !view_loading && <div class="quality-query-empty">输入单品码，查看来源批次、生产事实和已登记的流转记录。</div>}
    {view_trace && <>
      <div class="info-section-head"><h2>单品核验 <small>{view_trace.verifiable ? '当前符合生产核验规则' : '当前不可核验'}</small></h2><span>{STATUS[view_trace.codeStatus || ''] || view_trace.codeStatus || '状态未记录'}</span></div>
      <dl class="quality-source-grid"><div><dt>产品</dt><dd>{view_trace.productName || '未记录'}</dd></div><div><dt>生产批次</dt><dd>{view_trace.batchNo || '未记录'}</dd></div><div><dt>生产基地</dt><dd>{view_trace.farmName || '未记录'}</dd></div></dl>
      {!view_trace.verifiable && <p class="quality-query-error">该码可能未激活、已失效或关联批次不满足质检要求，请联系经营方核对原始记录。</p>}
      <div class="info-section-head"><h2>生产事实 <small>种植 · 农事 · 采收 · 加工 · 质检 · 仓储</small></h2></div>
      <ol class="quality-event-list">{(view_trace.nodes || []).map((node, i) => <li key={i}><div><strong>{node.title || node.stageName || '业务记录'}</strong><span>{node.occurredAt?.replace('T', ' ') || '未记录时间'}</span></div><p>{node.detail || '未记录详情'}</p><small>{node.onChain ? node.chainType === 'SIMULATED' ? '模拟存证成功' : '存证成功' : node.chainStatus === 'FAILED' ? '存证失败' : node.chainStatus === 'PENDING' ? '存证处理中' : '无存证记录'}</small></li>)}</ol>
      {!view_trace.nodes?.length && <p class="quality-query-empty">暂无生产事实记录</p>}
      <div class="info-section-head"><h2>零售履约与流转 <small>仅展示实际绑定到该码的商城记录</small></h2></div>
      {view_trace.circulation?.length ? <ol class="quality-event-list">{view_trace.circulation.map((event, i) => <li key={i}><strong>{ORDER_STATUS[event.orderStatus || ''] || event.orderStatus || '状态未记录'}</strong><p>{event.logisticsCompany || '承运方未记录'} · 绑定时间 {event.boundAt || '未记录'}</p></li>)}</ol> : <p class="quality-query-empty">暂无该单品码的商城履约记录，不能据此认定已发货或已签收。</p>}
      <p class="quality-scope-note">大宗交易按供给与合同追踪；本查询不把批次的其他交易当作当前单品的物流，也不展示客户、收货地址、价格及订单号。</p>
    </>}
  </div>;
    };
  }
});
