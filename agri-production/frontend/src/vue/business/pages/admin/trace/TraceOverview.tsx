import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event & {
  target: T;
  currentTarget: T;
  nativeEvent: Event;
  key: string;
};
import { Alert, Button, Space, Statistic, Tabs } from '@/vue/ui';
import { useQuery } from '@/vue/query';
import { useNavigate, useSearchParams } from '@/vue/router';
import { fetchAdminQualityOverview, fetchAdminTraceCodeStats } from '@/api/admin/trace';
import { qualityRecords, type QualityRecord } from '@/api/admin/quality-workbench';
import ListRowActions from '@/vue/business/components/ListRowActions';
import { Card, Table, QualityPage, LoadError, InspectionDetail } from '../quality/QualityShared';
import SafetyOverview from '../foodSafety/Index';
const TraceOverview = defineComponent({
  name: "TraceOverview",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const [params, setParams] = useSearchParams();
    const tab = computed(() => params.value.get('tab') === 'safety' ? 'safety' : 'quality');
    const nav = useNavigate(),
      active = shallowRef<string>();
    const setActive = (next: typeof active.value | ((previous: typeof active.value) => typeof active.value)) => {
      active.value = typeof next === 'function' ? (next as (previous: typeof active.value) => typeof active.value)(active.value) : next;
    };
    const overview = useQuery(() => ({
        queryKey: ['quality-overview'],
        queryFn: fetchAdminQualityOverview,
        retry: false
      })),
      codes = useQuery(() => ({
        queryKey: ['quality-code-stats'],
        queryFn: fetchAdminTraceCodeStats,
        retry: false
      })),
      risks = useQuery(() => ({
        queryKey: ['quality-risk-preview'],
        queryFn: () => qualityRecords({
          result: 'FAIL',
          pageNum: 1,
          pageSize: 10
        }),
        retry: false
      }));
    const o = computed(() => overview.data),
      c = computed(() => codes.data);
    return () => {
      return <QualityPage title="质量安全总览" subTitle="检测、批次管控与溯源同源监管" extra={<Button onClick={() => {
        void overview.refetch();
        void codes.refetch();
        void risks.refetch();
      }}>刷新</Button>}><Tabs activeKey={tab.value} onChange={key => {
          const next = new URLSearchParams(params.value);
          if (key === 'quality') next.delete('tab');else next.set('tab', String(key));
          setParams(next, {
            replace: true
          });
        }} items={[{
          key: 'quality',
          label: '质量与溯源',
          children: <Space direction="vertical" size={12} style={{
            width: '100%'
          }}><LoadError error={overview.error || codes.error || risks.error} /><div class="quality-metrics">{[{
                title: '已出结论检测单',
                value: o.value ? Number(o.value.passCount) + Number(o.value.failCount) : '—'
              }, {
                title: '检测合格率',
                value: o.value && Number(o.value.passCount) + Number(o.value.failCount) > 0 ? `${o.value.passRate}%` : '—'
              }, {
                title: '不合格检测单',
                value: o.value?.failCount ?? '—'
              }, {
                title: '已冻结批次',
                value: o.value?.frozenBatch ?? '—'
              }, {
                title: '合作检测机构',
                value: o.value?.labCount ?? '—'
              }, {
                title: '单品码总量',
                value: c.value ? Object.values(c.value).reduce((a, b) => a + Number(b), 0) : '—'
              }].map(m => <Card key={m.title}><Statistic title={m.title} value={m.value} /></Card>)}</div><Alert showIcon type="info" message="合格率以已有 PASS / FAIL 结论的检测单为分母；存证、扫码状态不替代质量结论。" /><Card title="业务协同入口"><Space wrap>{[['检测报告管理', '/admin/production/quality/inspections'], ['不合格品处置', '/admin/production/quality/recalls'], ['溯源码监管', '/admin/production/trace/codes'], ['检测机构准入', '/admin/production/quality/labs'], ['流通异常台账', '/admin/production/food-safety/circulation']].map(([name, url]) => <Button key={url} onClick={() => nav(url)}>{name}</Button>)}</Space></Card><Card title="最近不合格检测" extra={<Button onClick={() => nav('/admin/production/quality/recalls')}>全部处置台账</Button>}><Table rowKey={r => r.inspection.inspectionId} memberListToolbar rowSelection={{}} cardProps={false} search={false} pagination={{
                defaultPageSize: 20,
                showSizeChanger: true
              }} options={{
                reload: () => void risks.refetch()
              }} dataSource={risks.data?.list ?? []} loading={risks.isFetching} columns={[{
                title: '检测单号',
                width: 210,
                render: (_, r) => <Button type="link" onClick={() => setActive(r.inspection.inspectionId)}>{r.inspection.inspectionNo}</Button>
              }, {
                title: '批次号',
                width: 180,
                render: (_, r) => r.inspection.batchNo || '未关联'
              }, {
                title: '产品',
                width: 150,
                render: (_, r) => r.inspection.cropName || '—'
              }, {
                title: '农场',
                dataIndex: 'farmName',
                width: 180
              }, {
                title: '管控状态',
                width: 110,
                render: (_, r) => r.batch ? Number(r.batch.status) === 4 ? '已冻结' : '待管控' : '无有效批次'
              }, {
                title: '操作',
                valueType: 'option',
                width: 120,
                render: (_, r) => <ListRowActions items={[<Button key="ctrl" type="link" size="small" onClick={() => nav(`/admin/production/quality/recalls?inspectionId=${r.inspection.inspectionId}`)}>查看处置</Button>]} />
              }]} /></Card></Space>
        }, {
          key: 'safety',
          label: '安全事件台账',
          children: <SafetyOverview embedded />
        }]} /><InspectionDetail id={active.value} onClose={() => setActive(undefined)} /></QualityPage>;
    };
  }
});
export default TraceOverview;
