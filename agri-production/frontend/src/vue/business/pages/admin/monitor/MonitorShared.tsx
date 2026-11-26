import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event & {
  target: T;
  currentTarget: T;
  nativeEvent: Event;
  key: string;
};
import { useQuery } from '@/vue/query';
import { Alert, Select, Space, Statistic } from '@/vue/ui';
import { supervisionFarms } from '@/api/admin/farm-supervision';
import { PageContainer } from '@/vue/pro';
import Card from '@/vue/business/components/SectionCard';
import '@/pages/admin/monitor/MonitorCompact.css';
import '@/components/ProductionListDense.css';
export { Card };
export const MonitorPage = defineComponent({
  name: "MonitorPage",
  props: {
    title: null as unknown as PropType<{
      title: string;
      subTitle: string;
      extra?: VNodeChild;
      className?: string;
      children: VNodeChild;
    }["title"]>,
    subTitle: null as unknown as PropType<{
      title: string;
      subTitle: string;
      extra?: VNodeChild;
      className?: string;
      children: VNodeChild;
    }["subTitle"]>,
    extra: null as unknown as PropType<{
      title: string;
      subTitle: string;
      extra?: VNodeChild;
      className?: string;
      children: VNodeChild;
    }["extra"]>,
    className: null as unknown as PropType<{
      title: string;
      subTitle: string;
      extra?: VNodeChild;
      className?: string;
      children: VNodeChild;
    }["className"]>
  },
  setup(__props: {
    title: string;
    subTitle: string;
    extra?: VNodeChild;
    className?: string;
    children?: VNodeChild;
  }, {
    slots: __slots
  }) {
    return () => {
      return <PageContainer class={`production-monitor-compact farm-supervision-compact production-list-dense production-member-list ${__props.className ?? ''}`.trim()} title={__props.title} subTitle={__props.subTitle} extra={__props.extra}><Space direction="vertical" size={10} style={{
          width: '100%'
        }}>{__slots.default?.()}</Space></PageContainer>;
    };
  }
});
export const QueryError = defineComponent({
  name: "QueryError",
  props: {
    error: null as unknown as PropType<{
      error: unknown;
    }["error"]>
  },
  setup(__props: {
    error: unknown;
  }, {
    slots: __slots
  }) {
    return () => {
      return __props.error ? <Alert type="error" showIcon message="数据加载失败" description={__props.error instanceof Error ? __props.error.message : '请稍后重试'} /> : null;
    };
  }
});
export const FarmFilter = defineComponent({
  name: "FarmFilter",
  props: {
    value: null as unknown as PropType<{
      value?: string;
      onChange: (v: string | undefined) => void;
    }["value"]>,
    onChange: null as unknown as PropType<{
      value?: string;
      onChange: (v: string | undefined) => void;
    }["onChange"]>
  },
  setup(__props: {
    value?: string;
    onChange: (v: string | undefined) => void;
  }, {
    slots: __slots
  }) {
    const q = useQuery(() => ({
      queryKey: ['monitor-farm-options'],
      queryFn: async () => {
        let page = 1,
          total = 0;
        const rows: import('@/types').Farm[] = [];
        do {
          const r = await supervisionFarms({
            pageNum: page++,
            pageSize: 100
          });
          rows.push(...r.list);
          total = r.total;
          if (!r.list.length) break;
        } while (rows.length < total);
        return rows;
      },
      retry: false
    }));
    return () => {
      return <Space direction="vertical" size={2} style={{
        width: '100%'
      }}><Select showSearch allowClear optionFilterProp="label" placeholder="全部农场" aria-label="监控农场" style={{
          width: '100%',
          minWidth: 140
        }} value={__props.value} loading={q.isFetching} onChange={__props.onChange} options={(q.data ?? []).map(f => ({
          value: String(f.farmId),
          label: f.farmName
        }))} />{q.isError && <span style={{
          color: '#cf1322',
          fontSize: 12
        }}>农场选项加载失败</span>}</Space>;
    };
  }
});
export const Metrics = defineComponent({
  name: "Metrics",
  props: {
    items: null as unknown as PropType<{
      items: {
        title: string;
        value: string | number;
      }[];
    }["items"]>
  },
  setup(__props: {
    items: {
      title: string;
      value: string | number;
    }[];
  }, {
    slots: __slots
  }) {
    return () => {
      return <div class="monitor-metrics">{__props.items.map(i => <Card key={i.title}><Statistic title={i.title} value={i.value} /></Card>)}</div>;
    };
  }
});
export const statusNames: Record<string, string> = {
  pending: '待派发',
  assigned: '已派发',
  doing: '执行中',
  executing: '执行中',
  done: '已完成',
  completed: '已完成',
  suspended: '已暂停',
  cancelled: '已取消',
  expired: '已过期',
  rejected: '已驳回',
  overdue: '已逾期'
};
export const isFinal = (s: string) => ['done', 'completed', 'cancelled', 'expired', 'rejected'].includes(s);
export const iotOpsUrl = (page: string) => {
  const u = new URL(window.location.href);
  u.port = "8102";
  u.pathname = `/${page}`;
  u.search = "";
  u.hash = "";
  return u.toString();
};
export const displayTime = (value?: string) => value ? value.replace("T", " ").slice(0, 19) : "—";
export const alertLevels: Record<string, string> = {
  error: "紧急",
  CRITICAL: "紧急",
  critical: "紧急",
  urgent: "紧急",
  URGENT: "紧急",
  warn: "重要",
  WARN: "重要",
  warning: "重要",
  important: "重要",
  info: "一般",
  INFO: "一般",
  normal: "一般"
};
