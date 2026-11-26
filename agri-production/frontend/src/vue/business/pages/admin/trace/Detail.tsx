import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event & {
  target: T;
  currentTarget: T;
  nativeEvent: Event;
  key: string;
};
import { Alert, Button, Empty, Space, Tag, Timeline } from '@/vue/ui';
import { useQuery } from '@/vue/query';
import { useNavigate, useParams } from '@/vue/router';
import type { ProColumns } from '@/vue/pro';
import DetailInfoGrid from '@/vue/business/components/DetailInfoGrid';
import ListRowActions from '@/vue/business/components/ListRowActions';
import { fetchAdminTraceChain, type AdminInspectionRow } from '@/api/admin/trace';
import { Card, Table, QualityPage, LoadError, codeName, resultName, InspectionDetail } from '../quality/QualityShared';
const Detail = defineComponent({
  name: "Detail",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const _params = useParams(),
      nav = useNavigate();
    const active = shallowRef<string>();
    const setActive = (next: typeof active.value | ((previous: typeof active.value) => typeof active.value)) => {
      active.value = typeof next === 'function' ? (next as (previous: typeof active.value) => typeof active.value)(active.value) : next;
    };
    const query = useQuery(() => ({
      queryKey: ['admin', 'trace', 'chain', _params.code],
      queryFn: () => fetchAdminTraceChain(String(_params.code)),
      enabled: !!_params.code,
      retry: false
    }));
    const d = computed(() => query.data),
      c = computed(() => d.value?.traceCode),
      b = computed(() => d.value?.batch);
    const cols = computed<ProColumns<AdminInspectionRow>[]>(() => [{
      title: '检测单号',
      dataIndex: 'inspectionNo',
      width: 210,
      render: (_, r) => <Button type="link" onClick={() => setActive(r.inspectionId)}>{r.inspectionNo || r.inspectionId}</Button>
    }, {
      title: '机构',
      dataIndex: 'labName',
      width: 200
    }, {
      title: '抽样时间',
      dataIndex: 'sampleAt',
      width: 180
    }, {
      title: '结论',
      width: 110,
      render: (_, r) => <Tag color={r.result === 'FAIL' ? 'red' : r.result === 'PASS' ? 'green' : 'default'}>{resultName(r.result)}</Tag>
    }, {
      title: '操作',
      valueType: 'option',
      width: 120,
      render: (_, r) => <ListRowActions items={[<Button key="detail" type="link" size="small" onClick={() => setActive(r.inspectionId)}>报告详情</Button>]} />
    }]);
    return () => {
      return <QualityPage title="溯源监管详情" subTitle={String(_params.code ?? '')} extra={<Button onClick={() => nav('/admin/production/trace/codes')}>返回台账</Button>}>
    <LoadError error={query.error} />
    {query.isFetching && <Card loading />}
    {d.value && !d.value.found && <Empty description="未找到该溯源码" />}
    {c.value && <div class="quality-detail quality-detail-stack">
      <Card title="单品码档案" extra={<Space size={4}><Tag>{codeName(c.value.status)}</Tag><Tag color={c.value.onChain ? 'green' : 'default'}>{c.value.onChain ? '已上链' : '未确认上链'}</Tag></Space>}>
        <DetailInfoGrid columns={3} items={[{
              key: 'code',
              label: '溯源码',
              value: c.value.code,
              fullWidth: true
            }, {
              key: 'batch',
              label: '批次号',
              value: c.value.batchNo
            }, {
              key: 'scan',
              label: '扫码次数',
              value: c.value.scanCount
            }, {
              key: 'expire',
              label: '有效期',
              value: c.value.expireDate || '未设置'
            }, {
              key: 'activate',
              label: '激活时间',
              value: c.value.activateTime || '未激活'
            }, {
              key: 'create',
              label: '生成时间',
              value: c.value.createdAt
            }]} />
      </Card>
      <Card title="批次来源" extra={b.value?.batchNo && <Button size="small" onClick={() => nav(`/admin/production/quality/inspections?batchNo=${encodeURIComponent(b.value?.batchNo!)}`)}>批次检测台账</Button>}>
        {b.value ? <DetailInfoGrid columns={3} items={[{
              key: 'no',
              label: '批次号',
              value: b.value?.batchNo
            }, {
              key: 'crop',
              label: '产品',
              value: b.value.cropName
            }, {
              key: 'farm',
              label: '农场',
              value: b.value.farmName
            }, {
              key: 'harvest',
              label: '采收日期',
              value: b.value.harvestDate
            }, {
              key: 'qty',
              label: '数量',
              value: b.value.quantity
            }, {
              key: 'state',
              label: '管控状态',
              value: <Tag color={Number(b.value.status) === 4 ? 'red' : 'default'}>{Number(b.value.status) === 4 ? '已冻结' : '未冻结'}</Tag>
            }]} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未关联有效批次" />}
      </Card>
      <Card title="检测与风险记录"><Table rowKey="inspectionId" memberListToolbar rowSelection={{}} cardProps={false} columns={cols.value} dataSource={d.value?.inspections ?? []} search={false} pagination={{
              defaultPageSize: 20,
              showSizeChanger: true
            }} scroll={{
              x: 820
            }} options={{
              reload: () => void query.refetch()
            }} /></Card>
      <Card title="真实生产链路" extra={<span class="quality-detail-muted">{d.value?.nodes?.length ?? 0} 个关联节点</span>}>
        {d.value?.nodes?.length ? <Timeline class="quality-trace-timeline" items={d.value.nodes.map((n, index) => ({
              key: `${n.nodeType}-${n.refId}-${index}`,
              color: n.onChain ? 'green' : 'blue',
              children: <div class="quality-trace-node">
          <div class="quality-trace-node-heading"><strong>{n.nodeName || n.nodeType}</strong><span class="quality-detail-muted">{n.occurredAt?.replace('T', ' ') || '未登记时间'}</span><Tag color={n.onChain ? 'green' : 'default'}>{n.onChain ? '已上链' : n.chainStatus || '无成功存证'}</Tag></div>
          {n.description && <div class="quality-trace-description">{n.description}</div>}
          <DetailInfoGrid items={[{
                  key: 'ref',
                  label: '关联单据',
                  value: n.refNo || n.refId
                }, {
                  key: 'operator',
                  label: '操作人',
                  value: n.operatorName || '未登记'
                }]} />
        </div>
            }))} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无关联生产节点" />}
      </Card>
      <Alert type="info" showIcon message="生产节点复用用户端真实事实。交易订单、物流与售后由交易履约域维护，生产链路与存证不代表已交付或质量合格。" />
    </div>}
    <InspectionDetail id={active.value} onClose={() => setActive(undefined)} />
  </QualityPage>;
    };
  }
});
export default Detail;
