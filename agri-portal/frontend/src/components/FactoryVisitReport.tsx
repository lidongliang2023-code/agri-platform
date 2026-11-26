import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
type Item = {
  name: string;
  result: string;
  finding: string;
  evidence: string;
  action: string;
  dueDate: string;
};
type Report = {
  status: string;
  reportNo: string;
  revision: number;
  title: string;
  factoryName: string;
  enterprise: string;
  region: string;
  inspector: string;
  inspectedAt: string;
  method: string;
  scope: string;
  summary: string;
  limitations: string;
  followUp: string;
  conclusion: string;
  published_at: string;
  reviewer: string;
  items: Item[];
};
const labels: Record<string, string> = {
  consistent: '核验范围内一致',
  rectification: '需整改 / 复核',
  insufficient: '证据不足，暂不能判断',
  issue: '发现问题',
  unverified: '未能核验',
  na: '不适用',
  video: '远程视频核验',
  materials: '材料核验',
  combined: '视频与材料综合核验'
};
export const FactoryVisitReport = defineComponent({
  name: "FactoryVisitReport",
  props: {
    visitId: null as unknown as PropType<{
      visitId: number;
      load: () => Promise<unknown>;
      onClose: () => void;
    }["visitId"]>,
    load: null as unknown as PropType<{
      visitId: number;
      load: () => Promise<unknown>;
      onClose: () => void;
    }["load"]>,
    onClose: null as unknown as PropType<{
      visitId: number;
      load: () => Promise<unknown>;
      onClose: () => void;
    }["onClose"]>
  },
  setup(__props: {
    visitId: number;
    load: () => Promise<unknown>;
    onClose: () => void;
  }, {
    slots: __slots
  }) {
    const report = ref<Report | null>(null),
      error = ref(''),
      busy = ref(true);
    const setBusy = (next: typeof busy.value | ((previous: typeof busy.value) => typeof busy.value)) => {
      busy.value = typeof next === 'function' ? (next as (previous: typeof busy.value) => typeof busy.value)(busy.value) : next;
    };
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const setReport = (next: typeof report.value | ((previous: typeof report.value) => typeof report.value)) => {
      report.value = typeof next === 'function' ? (next as (previous: typeof report.value) => typeof report.value)(report.value) : next;
    };
    onMounted(() => {
      watch(() => [__props.visitId], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          let active = true;
          setBusy(true);
          setReport(null);
          setError('');
          __props.load().then(r => {
            if (active) setReport(r as Report);
          }).catch(e => {
            if (active) setError((e as Error).message);
          }).finally(() => {
            if (active) setBusy(false);
          });
          return () => {
            active = false;
          };
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    return () => {
      const view_prop_onClose = __props.onClose;
      const view_busy = busy.value;
      const view_error = error.value;
      const view_report = report.value;
      return <section class="factory-panel"><div class="factory-heading"><h2>远程验厂报告</h2><button class="btn btn-outline" onClick={view_prop_onClose}>关闭报告</button></div>{view_busy ? <p>正在读取报告…</p> : view_error ? <p role="alert">{view_error}</p> : !view_report || view_report.status !== 'published' ? <p>该预约暂无已发布报告，报告审核发布后可在此查看。</p> : <><span class="factory-tag">{view_report.reportNo} · 版本 {view_report.revision}</span><h3>{view_report.title}</h3><p>{view_report.factoryName} · {view_report.enterprise} · {view_report.region}</p><p>核验人员：{view_report.inspector} · 核验时间：{view_report.inspectedAt.replace('T', ' ')}（北京时间）</p><p>方式：{labels[view_report.method]} · 发布时间：{view_report.published_at?.replace('T', ' ')}（北京时间）</p><h3>核验范围</h3><p style={{
            whiteSpace: 'pre-wrap'
          }}>{view_report.scope}</p><h3>逐项核验记录</h3>{view_report.items.map((item, index) => <article class="factory-line" key={index}><div><strong>{index + 1}. {item.name}</strong><span class="factory-tag">{labels[item.result]}</span><p style={{
                whiteSpace: 'pre-wrap'
              }}>{item.finding}</p>{item.evidence && <a href={item.evidence} target="_blank" rel="noopener noreferrer">查看核验证据</a>}{item.action && <p>整改要求：{item.action} · 期限：{item.dueDate || '未指定'}</p>}</div></article>)}<h3>总体结果：{labels[view_report.conclusion]}</h3><p style={{
            whiteSpace: 'pre-wrap'
          }}>{view_report.summary}</p><h3>核验局限与未覆盖事项</h3><p style={{
            whiteSpace: 'pre-wrap'
          }}>{view_report.limitations}</p>{view_report.followUp && <><h3>后续跟进安排</h3><p style={{
              whiteSpace: 'pre-wrap'
            }}>{view_report.followUp}</p></>}<p class="muted">本报告仅记录上述时间及范围内的远程核验事实，不替代现场检验、法定检测或认证结论。生产、交易及单品溯源事实请通过对应业务记录核验。</p></>}</section>;
    };
  }
});
