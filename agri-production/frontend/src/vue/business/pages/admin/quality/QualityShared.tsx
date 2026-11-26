import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event & {
  target: T;
  currentTarget: T;
  nativeEvent: Event;
  key: string;
};
import { Alert, Button, Drawer, Empty, Space, Table as AntTable, Tag } from '@/vue/ui';
import { useQuery } from '@/vue/query';
import { useNavigate } from '@/vue/router';
import { PageContainer } from '@/vue/pro';
import Card from '@/vue/business/components/SectionCard';
import Table from '@/vue/ProductionRequestTable';
import DetailInfoGrid from '@/vue/business/components/DetailInfoGrid';
import { qualityRecord } from '@/api/admin/quality-workbench';
import '@/pages/admin/quality/QualityCompact.css';
import '@/components/ProductionListDense.css';
export { Card, Table };
export const tradeOpsUrl = (page: string) => {
  const u = new URL(window.location.href);
  u.port = '8086';
  u.pathname = `/admin/trade/${page}`;
  u.search = '';
  u.hash = '';
  return u.toString();
};
export const QualityPage = defineComponent({
  name: "QualityPage",
  props: {
    title: null as unknown as PropType<{
      title: string;
      subTitle: string;
      extra?: VNodeChild;
      children: VNodeChild;
    }["title"]>,
    subTitle: null as unknown as PropType<{
      title: string;
      subTitle: string;
      extra?: VNodeChild;
      children: VNodeChild;
    }["subTitle"]>,
    extra: null as unknown as PropType<{
      title: string;
      subTitle: string;
      extra?: VNodeChild;
      children: VNodeChild;
    }["extra"]>
  },
  setup(__props: {
    title: string;
    subTitle: string;
    extra?: VNodeChild;
    children?: VNodeChild;
  }, {
    slots: __slots
  }) {
    return () => {
      return <PageContainer class="quality-workbench production-list-dense production-member-list" title={__props.title} subTitle={__props.subTitle} extra={__props.extra}><Space direction="vertical" size={10} style={{
          width: '100%'
        }}>{__slots.default?.()}</Space></PageContainer>;
    };
  }
});
export const LoadError = defineComponent({
  name: "LoadError",
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
      return __props.error ? <Alert type="error" showIcon message="数据加载失败" description={__props.error instanceof Error ? __props.error.message : '请刷新重试'} /> : null;
    };
  }
});
export const resultName = (v?: string) => v === 'PASS' ? '合格' : v === 'FAIL' ? '不合格' : '未出结论';
export const stateName = (v?: string) => ({
  PENDING: '待检',
  TESTING: '检测中',
  DONE: '已完成'
})[v || ''] || v || '—';
export const codeName = (v?: string) => ({
  generated: '未激活',
  inactive: '未激活',
  active: '已激活',
  scanned: '已扫码',
  revoked: '已作废',
  expired: '已过期'
})[v?.toLowerCase() || ''] || v || '—';

/** 监管详情复用检测事实；交易单据只读关联，处置仍使用既有业务入口。 */
export const InspectionDetail = defineComponent({
  name: "InspectionDetail",
  props: {
    id: null as unknown as PropType<{
      id?: string;
      onClose: () => void;
    }["id"]>,
    onClose: null as unknown as PropType<{
      id?: string;
      onClose: () => void;
    }["onClose"]>
  },
  setup(__props: {
    id?: string;
    onClose: () => void;
  }, {
    slots: __slots
  }) {
    const nav = useNavigate();
    const query = useQuery(() => ({
      queryKey: ['quality-inspection', __props.id],
      queryFn: () => qualityRecord(__props.id!),
      enabled: !!__props.id,
      retry: false
    }));
    const d = computed(() => query.data),
      i = computed(() => d.value?.inspection);
    const go = (path: string) => {
      __props.onClose();
      nav(path);
    };
    return () => {
      const inspection = i.value
      return <Drawer title="检测报告详情" class="quality-dialog quality-detail" width={880} open={!!__props.id} onClose={__props.onClose} extra={inspection && <Space size={4}><Tag color={inspection.result === 'FAIL' ? 'red' : inspection.result === 'PASS' ? 'green' : 'default'}>{resultName(inspection.result)}</Tag><Tag>{stateName(inspection.status)}</Tag></Space>}>
    <LoadError error={query.error} />
    {!query.isFetching && !query.error && !inspection && <Empty description="未找到检测报告" />}
    {inspection && <div class="quality-detail-stack">
      <Card title="检测信息" extra={inspection.reportUrl && /^https?:\/\/|^\/(?!\/)/i.test(inspection.reportUrl) && <Button size="small" href={inspection.reportUrl} target="_blank">查看报告原件</Button>}>
        <DetailInfoGrid items={[{
              key: 'no',
              label: '检测单号',
              value: inspection.inspectionNo || inspection.inspectionId,
              fullWidth: true
            }, {
              key: 'farm',
              label: '农场',
              value: d.value?.farmName || inspection.farmId
            }, {
              key: 'tenant',
              label: '主体标识',
              value: inspection.tenantId
            }, {
              key: 'batch',
              label: '批次号',
              value: inspection.batchNo || '未关联'
            }, {
              key: 'crop',
              label: '产品',
              value: inspection.cropName
            }, {
              key: 'lab',
              label: '检测机构',
              value: inspection.labName
            }, {
              key: 'type',
              label: '检测类型',
              value: {
                SELF: '自检',
                SEND: '送检',
                SAMPLING: '抽检'
              }[inspection.inspectionType || ''] || inspection.inspectionType
            }, {
              key: 'person',
              label: '检测人',
              value: inspection.inspectorName
            }, {
              key: 'time',
              label: '抽样时间',
              value: inspection.sampleAt
            }, {
              key: 'remark',
              label: '检测说明',
              value: inspection.remark,
              fullWidth: true
            }]} />
      </Card>
      <Card title="批次管控" extra={inspection.result === 'FAIL' && <Button size="small" danger onClick={() => go(`/admin/production/quality/recalls?inspectionId=${inspection.inspectionId}`)}>不合格品处置</Button>}>
        <DetailInfoGrid items={[{
              key: 'frozen',
              label: '管控状态',
              value: d.value?.batch ? <Tag color={Number(d.value.batch.status) === 4 ? 'red' : 'default'}>{Number(d.value.batch.status) === 4 ? '已冻结' : '未冻结'}</Tag> : '未关联有效批次'
            }, {
              key: 'stock',
              label: '冻结库存记录',
              value: d.value?.batch ? `${d.value.frozenInventoryCount ?? 0} / ${d.value.inventoryCount ?? 0}` : '—'
            }, {
              key: 'control',
              label: '处置说明',
              value: d.value?.batch?.remark,
              fullWidth: true
            }]} />
        <Space class="quality-detail-actions" wrap size={8}>
          <Button size="small" disabled={!inspection.batchNo} onClick={() => go(`/admin/production/trace/codes?batchNo=${encodeURIComponent(inspection.batchNo || '')}`)}>批次溯源码</Button>
          {inspection.farmId && <Button size="small" onClick={() => go(`/admin/production/farms/${inspection.farmId}`)}>农场监管详情</Button>}
        </Space>
      </Card>
      <Card title="产销与履约关联" extra={<Space wrap size={8}><Button size="small" href={tradeOpsUrl('product')}>交易货源审核</Button><Button size="small" href={tradeOpsUrl('order')}>交易订单监管</Button></Space>}>
        <div class="quality-related-heading">关联供给单 <span>{d.value?.sales?.offers?.length ?? 0} 条</span></div>
        <AntTable size="small" rowKey={(row, index) => `${row.offerNo}-${index}`} pagination={false} dataSource={d.value?.sales?.offers ?? []} scroll={{
              x: 480
            }} locale={{
              emptyText: '暂无关联供给'
            }} columns={[{
              title: '供给单号',
              dataIndex: 'offerNo',
              render: (v: string) => v || '—'
            }, {
              title: '交易状态',
              dataIndex: 'tradeStatus',
              width: 150,
              render: (v: string) => ({
                DRAFT: '草稿',
                PENDING: '待审核',
                APPROVED: '已审核',
                REJECTED: '已驳回',
                LISTED: '已上架',
                DELISTED: '已下架',
                CLOSED: '已关闭'
              })[v] || v || '—'
            }]} />
        <div class="quality-related-heading quality-related-heading-next">认购回写 <span>{d.value?.sales?.subscriptions?.length ?? 0} 条</span></div>
        <AntTable size="small" rowKey={(row, index) => `${row.id || row.orderNo}-${index}`} pagination={false} dataSource={d.value?.sales?.subscriptions ?? []} scroll={{
              x: 560
            }} locale={{
              emptyText: '暂无认购回写'
            }} columns={[{
              title: '认购编号',
              dataIndex: 'id',
              render: (v: string) => v || '—'
            }, {
              title: '交易订单号',
              dataIndex: 'orderNo',
              render: (v: string) => v || '未关联'
            }, {
              title: '回写状态',
              dataIndex: 'writebackStatus',
              width: 130,
              render: (v: string) => ({
                SUCCESS: '回写成功',
                FAILED: '回写失败',
                PENDING: '待回写',
                PROCESSING: '回写中'
              })[v] || v || '未回写'
            }]} />
        <Alert class="quality-detail-note" type="info" showIcon message="按批次关联同主体台账；进入交易模块后按单号核查。冻结不代表已退款或已回收。" />
      </Card>
      <Card title="关联溯源码" extra={<span class="quality-detail-muted">最多展示 20 条</span>}>
        {d.value?.traceCodes?.length ? <div class="quality-code-list">{d.value.traceCodes.map(c => <div class="quality-code-row" key={c.code}>
          <Button type="link" onClick={() => go(`/admin/production/trace/${encodeURIComponent(c.code)}`)}>{c.code}</Button><Tag>{codeName(c.status)}</Tag>
        </div>)}</div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该批次暂无溯源码" />}
      </Card>
    </div>}
  </Drawer>;
    };
  }
});
