import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event & {
  target: T;
  currentTarget: T;
  nativeEvent: Event;
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
};
import '@/pages/user/quality/quality-trace.css';
import { useQuery } from '@/vue/query';
import { useNavigate, useSearchParams } from '@/vue/router';
import { Alert, Button, Empty, Input, Space, Steps, Tag, Timeline, Typography } from '@/vue/ui';
import { PageContainer } from '@/vue/pro';
import SectionCard from '@/vue/business/components/SectionCard';
import DetailInfoGrid from '@/vue/business/components/DetailInfoGrid';
import { fetchFullChainNodes, fetchTraceCodeDetail } from '@/api/trace';
import { getHarvest } from '@/api/harvests';
import useAuthStore from '@/vue/authStore';
const STAGES = [{
  key: 'planting',
  title: '种植与农事'
}, {
  key: 'input',
  title: '投入品'
}, {
  key: 'harvest',
  title: '采收'
}, {
  key: 'process',
  title: '加工包装'
}, {
  key: 'inspect',
  title: '质量检测'
}, {
  key: 'storage',
  title: '仓储出入库'
}, {
  key: 'trace',
  title: '单品赋码'
}];
function stageOf(node: any): string {
  const value = node.stage || node.nodeType;
  return value === 'plant' || value === 'growth' ? 'planting' : value === 'inspection' ? 'inspect' : value;
}
function evidence(node: any): string {
  if (node.chainType === 'SIMULATED' && node.onChain) return '模拟存证成功';
  if (node.onChain) return '存证成功';
  if (node.chainStatus === 'FAILED') return '存证失败';
  if (node.chainStatus === 'PENDING') return '存证处理中';
  return '无存证记录';
}
const FullChainTrace = defineComponent({
  name: "FullChainTrace",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const subject = computed(() => String(useAuthStore(s => s.userInfo?.tenantId) || ''));
    const code = shallowRef(params.value.get('code') || '');
    const setCode = (next: typeof code.value | ((previous: typeof code.value) => typeof code.value)) => {
      code.value = typeof next === 'function' ? (next as (previous: typeof code.value) => typeof code.value)(code.value) : next;
    };
    const batch = shallowRef(params.value.get('batchId') || '');
    const setBatch = (next: typeof batch.value | ((previous: typeof batch.value) => typeof batch.value)) => {
      batch.value = typeof next === 'function' ? (next as (previous: typeof batch.value) => typeof batch.value)(batch.value) : next;
    };
    const activeCode = computed(() => params.value.get('code') || '');
    const requestedBatch = computed(() => params.value.get('batchId') || '');
    const codeQuery = useQuery(() => ({
      queryKey: ['quality-trace-code', subject.value, activeCode.value],
      enabled: !!subject.value && !!activeCode.value,
      retry: false,
      queryFn: () => fetchTraceCodeDetail(activeCode.value)
    }));
    const batchId = computed(() => activeCode.value ? String(codeQuery.data?.batchId || '') : requestedBatch.value);
    const batchQuery = useQuery(() => ({
      queryKey: ['quality-trace-batch', subject.value, batchId.value],
      enabled: !!subject.value && !!batchId.value,
      retry: false,
      queryFn: () => getHarvest(batchId.value)
    }));
    const chainQuery = useQuery(() => ({
      queryKey: ['quality-trace-nodes', subject.value, batchId.value],
      enabled: !!subject.value && !!batchId.value,
      retry: false,
      queryFn: () => fetchFullChainNodes(batchId.value)
    }));
    const nodes = computed(() => chainQuery.data || []);
    const failure = computed(() => codeQuery.error || batchQuery.error || chainQuery.error);
    const loading = computed(() => codeQuery.isFetching || batchQuery.isFetching || chainQuery.isFetching);
    const search = () => {
      const next = new URLSearchParams();
      if (code.value.trim()) next.set('code', code.value.trim());else if (batch.value.trim()) next.set('batchId', batch.value.trim());
      setParams(next);
    };
    const exportNodes = () => {
      const csv = [['环节', '业务编号', '发生时间', '记录', '存证状态'], ...nodes.value.map((n: any) => [n.nodeName, n.refNo, n.occurredAt, n.description, evidence(n)])].map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
      const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], {
        type: 'text/csv;charset=utf-8'
      }));
      const link = document.createElement('a');
      link.href = url;
      link.download = '质量溯源记录.csv';
      link.click();
      URL.revokeObjectURL(url);
    };
    return () => {
      const _batchSnapshot = batch.value;
      return <PageContainer class="quality-trace-page" header={{
        title: '质量溯源 · 全链路',
        subTitle: '按批次追查生产事实，按单品码核验身份与状态',
        extra: [<Button key="codes" onClick={() => navigate('/production/trace')}>单品码管理</Button>, <Button key="export" disabled={!nodes.value.length || !!failure.value} onClick={exportNodes}>导出链路记录</Button>]
      }}>
    <SectionCard title="溯源查询">
      <Space wrap class="trace-query-row">
        <Input aria-label="单品溯源码" placeholder="输入单品溯源码（优先查询）" value={code.value} onChange={e => setCode(e.target.value)} onPressEnter={search} />
        <Input aria-label="采收批次ID" placeholder="或输入采收批次 ID" value={_batchSnapshot} onChange={e => setBatch(e.target.value)} onPressEnter={search} />
        <Button type="primary" loading={loading.value} onClick={search}>查询链路</Button>
      </Space>
    </SectionCard>
    <Alert class="trace-domain-note" type="info" showIcon message="一物一码，批次共享生产事实，单品独立核验" description="生产管理维护种植、农事、采收、加工、质检与赋码；交易撮合维护供给、合同与大宗物流；商城维护零售订单和履约。缺失记录不视为已完成，出库记录不代表物流已签收，存证成功不替代质量合格判定。" />
    {failure.value && <Alert type="error" showIcon message="溯源数据加载失败" description={failure.value instanceof Error ? failure.value.message : '请重试，不能将接口失败视为无记录'} action={<Button onClick={() => {
          void codeQuery.refetch();
          if (batchId.value) {
            void batchQuery.refetch();
            void chainQuery.refetch();
          }
        }}>重新加载</Button>} />}
    {!activeCode.value && !requestedBatch.value && <Empty description="输入单品码或采收批次 ID，查看真实链路记录" />}
    {!failure.value && batchQuery.data && <>
      <SectionCard title="批次来源" extra={<Button onClick={() => navigate(`/production/harvests/${batchId.value}`)}>采收详情</Button>}>
        <DetailInfoGrid items={[{
              label: '批次号',
              value: batchQuery.data.batchNo
            }, {
              label: '作物',
              value: batchQuery.data.cropName
            }, {
              label: '农场',
              value: batchQuery.data.farmName
            }, {
              label: '地块',
              value: batchQuery.data.plotName
            }, {
              label: '采收日期',
              value: batchQuery.data.harvestDate || '未记录'
            }, {
              label: '本次单品码',
              value: activeCode.value || '按批次查看，未指定单品'
            }]} />
        <Space wrap style={{
              marginTop: 16
            }}>
          <Button onClick={() => navigate(`/production/p2t/trace?batchNo=${encodeURIComponent(batchQuery.data?.batchNo || '')}`)}>查看供给与交易追踪</Button>
          <Typography.Text type="secondary">交易与零售履约仅以各自业务系统的真实单据为准</Typography.Text>
        </Space>
      </SectionCard>
      <SectionCard title="生产链路覆盖">
        <Steps size="small" responsive items={STAGES.map(stage => {
              const count = nodes.value.filter(n => stageOf(n) === stage.key).length;
              return {
                title: stage.title,
                description: count ? `${count} 条真实记录` : '暂无记录',
                status: count ? 'finish' as const : 'wait' as const
              };
            })} />
      </SectionCard>
      <SectionCard title="全链路事实记录">
        {!nodes.value.length ? <Empty description={loading.value ? '正在查询…' : '该批次暂无链路记录'} /> : <Timeline items={nodes.value.map((node: any, index) => ({
              key: `${node.nodeType}-${node.refId || index}`,
              color: node.chainStatus === 'FAILED' ? 'red' : 'green',
              children: <div class="trace-event-row"><Space wrap><Typography.Text strong>{node.nodeName}</Typography.Text><Tag>{node.refNo || '未记录编号'}</Tag><Tag>{evidence(node)}</Tag></Space>
            <p>{node.description || '未记录详情'}</p><Typography.Text type="secondary">{node.occurredAt || '未记录时间'}{node.operatorName ? ` · ${node.operatorName}` : ''}</Typography.Text>
            {node.failedReason && <Alert type="warning" message={node.failedReason} />}</div>
            }))} />}
      </SectionCard>
    </>}
  </PageContainer>;
    };
  }
});
export default FullChainTrace;
