import ProductionListFilters from '@/vue/business/components/ProductionListFilters';
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
import '@/components/ProductionListDense.css';
import '@/components/ProductionTable.css';
import { Alert, Button, Card, Empty, Input, Select, Space, Steps, Tag, Typography } from '@/vue/ui';
import { useNavigate, useSearchParams } from '@/vue/router';
import { useQuery } from '@/vue/query';
import type { ProColumns } from '@/vue/pro';
import useAuthStore from '@/vue/authStore';
import ListRowActions from '@/vue/business/components/ListRowActions';
import { PageContainer } from '@/vue/pro';
import SectionCard from '@/vue/business/components/SectionCard';
import DetailInfoGrid from '@/vue/business/components/DetailInfoGrid';
import ProTable from '@/vue/ProductionRequestTable';
import { SCROLL_BY_CONTENT } from '@/components/tableScroll';
import { fetchP2tTrace } from '@/api/p2t';
import type { P2tOffer } from '@/api/p2t';
import OfferSubscriptionFlows from './OfferSubscriptionFlows';
import BulkLogisticsTrace from './BulkLogisticsTrace';
const TRADE_STATUSES: Record<string, string> = {
  PENDING: '待建品',
  LISTED: '已上架',
  SOLD: '已售罄',
  CLOSED: '已关闭'
};
const P2tTrace = defineComponent({
  name: "P2tTrace",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const subjectId = useAuthStore(s => s.userInfo?.tenantId);
    const scope = computed(() => String(subjectId.value ?? ''));
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const initial = computed(() => params.value.get('batchNo')?.trim() || '');
    const inputNo = shallowRef(initial.value);
    const setInputNo = (next: typeof inputNo.value | ((previous: typeof inputNo.value) => typeof inputNo.value)) => {
      inputNo.value = typeof next === 'function' ? (next as (previous: typeof inputNo.value) => typeof inputNo.value)(inputNo.value) : next;
    };
    const draftTradeStatus = shallowRef<string | undefined>(undefined);
    const setDraftTradeStatus = (next: typeof draftTradeStatus.value | ((previous: typeof draftTradeStatus.value) => typeof draftTradeStatus.value)) => {
      draftTradeStatus.value = typeof next === 'function' ? (next as (previous: typeof draftTradeStatus.value) => typeof draftTradeStatus.value)(draftTradeStatus.value) : next;
    };
    const tradeStatusFilter = shallowRef<string | undefined>(undefined);
    const setTradeStatusFilter = (next: typeof tradeStatusFilter.value | ((previous: typeof tradeStatusFilter.value) => typeof tradeStatusFilter.value)) => {
      tradeStatusFilter.value = typeof next === 'function' ? (next as (previous: typeof tradeStatusFilter.value) => typeof tradeStatusFilter.value)(tradeStatusFilter.value) : next;
    };
    const selectedRowKeys = shallowRef<(string | number)[]>([]);
    const setSelectedRowKeys = (next: typeof selectedRowKeys.value | ((previous: typeof selectedRowKeys.value) => typeof selectedRowKeys.value)) => {
      selectedRowKeys.value = typeof next === 'function' ? (next as (previous: typeof selectedRowKeys.value) => typeof selectedRowKeys.value)(selectedRowKeys.value) : next;
    };
    const selectedOffer = shallowRef<{
      offerNo: string;
      unit?: string;
    } | null>(null);
    const setSelectedOffer = (next: typeof selectedOffer.value | ((previous: typeof selectedOffer.value) => typeof selectedOffer.value)) => {
      selectedOffer.value = typeof next === 'function' ? (next as (previous: typeof selectedOffer.value) => typeof selectedOffer.value)(selectedOffer.value) : next;
    };
    onMounted(() => {
      watch(() => [initial.value, subjectId.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          setInputNo(initial.value);
          setSelectedOffer(null);
          setSelectedRowKeys([]);
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const query = useQuery(() => ({
      queryKey: ['p2t-trace', scope.value, initial.value],
      enabled: !!scope.value && !!initial.value,
      queryFn: () => fetchP2tTrace(initial.value, false)
    }));
    const onSearch = () => {
      const value = inputNo.value.trim();
      setTradeStatusFilter(draftTradeStatus.value);
      if (value) params.value.set('batchNo', value);else params.value.delete('batchNo');
      setParams(params.value, {
        replace: true
      });
    };
    const onReset = () => {
      setInputNo('');
      setDraftTradeStatus(undefined);
      setTradeStatusFilter(undefined);
      params.value.delete('batchNo');
      setParams(params.value, {
        replace: true
      });
    };
    const data = computed(() => query.data as {
      batch?: {
        batchId?: number;
        batchNo?: string;
        cropName?: string;
        farmName?: string;
        quantity?: number;
        unit?: string;
        harvestDate?: string;
        inspectionNo?: string;
      };
      offers?: P2tOffer[];
    } | undefined);
    const offers = computed(() => {
      const list = data.value?.offers || [];
      return tradeStatusFilter.value ? list.filter(item => item.tradeStatus === tradeStatusFilter.value) : list;
    });
    const activeOffer = computed(() => offers.value.find(o => o.offerNo === selectedOffer.value?.offerNo) || offers.value[0] || null);
    const columns = computed<ProColumns<P2tOffer>[]>(() => [{
      title: '供给单号',
      dataIndex: 'offerNo',
      width: 190,
      render: (_, r) => <Button type="link" size="small" onClick={() => setSelectedOffer({
        offerNo: r.offerNo,
        unit: r.unit
      })}>{r.offerNo}</Button>
    }, {
      title: '作物',
      dataIndex: 'cropName',
      width: 120
    }, {
      title: '品类',
      dataIndex: 'categoryName',
      width: 120
    }, {
      title: '供给总量',
      dataIndex: 'availableQty',
      align: 'right',
      width: 110,
      render: (_, r) => `${r.availableQty ?? '—'} ${r.unit || ''}`
    }, {
      title: '净认购量',
      dataIndex: 'reservedQty',
      align: 'right',
      width: 110,
      render: (_, r) => `${r.reservedQty ?? '—'} ${r.unit || ''}`
    }, {
      title: '商品编码',
      dataIndex: 'productCode',
      width: 160,
      render: (_, r) => r.productCode || '—'
    }, {
      title: '交易状态',
      dataIndex: 'tradeStatus',
      width: 110,
      render: (_, r) => <Tag color={r.tradeStatus === 'LISTED' ? 'green' : 'default'}>{TRADE_STATUSES[r.tradeStatus] || r.tradeStatus}</Tag>
    }, {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      width: 170,
      render: (_, r) => <ListRowActions><Button key="flow" type="link" size="small" onClick={() => setSelectedOffer({
          offerNo: r.offerNo,
          unit: r.unit
        })}>查看认购流水</Button><Button key="detail" type="link" size="small" onClick={() => navigate(`/production/p2t/offers?offerNo=${encodeURIComponent(r.offerNo)}&subjectId=${encodeURIComponent(scope.value)}`)}>供给详情</Button></ListRowActions>
    }]);
    return () => {
      const _dataSnapshot = data.value;
      return <PageContainer class="production-list-dense production-member-list" header={{
        title: '供给与履约追踪',
        subTitle: '生产端只读核对供给、成交回写和大宗履约；订单与物流由交易端维护'
      }}>
    <Card class="production-dense-filter-card">
      <ProductionListFilters onSearch={onSearch} onReset={onReset}>
        <div class="production-filter-field">
          <label>采收批次号</label>
          <Input allowClear placeholder="输入采收批次号，如 H20260601" value={inputNo.value} onChange={e => setInputNo(e.target.value)}  />
        </div>
        <div class="production-filter-field">
          <label>交易状态</label>
          <Select allowClear placeholder="全部状态" value={draftTradeStatus.value} onChange={setDraftTradeStatus} options={Object.entries(TRADE_STATUSES).map(([value, label]) => ({
                value,
                label
              }))} />
        </div>
      </ProductionListFilters>
    </Card>
    {!initial.value && <Empty description="输入批次号后查看「批次 → 供给 → 商品 → 订单 → 回写」链路" />}
    {initial.value && query.isFetching && <Typography.Text>正在加载链路…</Typography.Text>}
    {initial.value && !query.isPending && !query.isError && !_dataSnapshot?.batch && <Empty description={`未找到批次 ${initial.value} 的链路数据`} />}
    {initial.value && query.isError && <Alert type="error" message="链路数据加载失败" action={<Button onClick={() => void query.refetch()}>重试</Button>} />}
    {initial.value && _dataSnapshot?.batch && <Space direction="vertical" size={12} style={{
          width: '100%'
        }}>
      <SectionCard title="链路主键" extra={_dataSnapshot.batch.batchId && <Button type="link" onClick={() => navigate(`/production/harvests/${_dataSnapshot.batch?.batchId}`)}>查看来源采收</Button>}>
        <DetailInfoGrid items={[{
              label: '批次号',
              value: <Typography.Text copyable>{_dataSnapshot.batch.batchNo}</Typography.Text>
            }, {
              label: '品种',
              value: _dataSnapshot.batch.cropName
            }, {
              label: '农场',
              value: _dataSnapshot.batch.farmName
            }, {
              label: '产量',
              value: `${_dataSnapshot.batch.quantity ?? '—'} ${_dataSnapshot.batch.unit || ''}`
            }, {
              label: '采收日期',
              value: _dataSnapshot.batch.harvestDate
            }, {
              label: '关联检测单号',
              value: _dataSnapshot.batch.inspectionNo || '未关联（不代表检测结论）'
            }]} />
      </SectionCard>
      <SectionCard title="链路阶段">
        <Steps size="small" items={[{
              title: '采收',
              description: _dataSnapshot.batch.harvestDate,
              status: 'finish'
            }, {
              title: '供给发布',
              description: activeOffer.value?.offerNo || '未发布',
              status: offers.value.length ? 'finish' : 'wait'
            }, {
              title: '交易建品',
              description: activeOffer.value?.productCode || '未建品',
              status: !!activeOffer.value?.productCode ? 'finish' : 'wait'
            }, {
              title: '认购核对',
              description: activeOffer.value ? `当前净认购 ${activeOffer.value.reservedQty ?? '—'} ${activeOffer.value.unit || ''}，历史以流水为准` : '无供给',
              status: activeOffer.value ? 'process' : 'wait'
            }]} />
      </SectionCard>
      <SectionCard title={`供给单列表${activeOffer.value ? ` · 当前查看 ${activeOffer.value.offerNo}` : ''}`}>
        <ProTable memberListToolbar key={`trace-offers-${scope.value}-${initial.value}`} rowKey="offerNo" columns={columns.value} dataSource={offers.value} columnWidthStorageKey="p2t-trace-offers" scroll={SCROLL_BY_CONTENT} search={false} pagination={{
              defaultPageSize: 20,
              showSizeChanger: true
            }} rowSelection={{
              selectedRowKeys: selectedRowKeys.value,
              onChange: setSelectedRowKeys
            }} toolBarRender={() => [<Button key="full-chain" onClick={() => navigate(`/production/trace/full-chain?batchId=${encodeURIComponent(String(_dataSnapshot.batch?.batchId || ''))}`)}>查看生产与质量链路</Button>]} options={{
              reload: () => {
                void query.refetch();
              }
            }} />
      </SectionCard>
      <BulkLogisticsTrace key={`${scope.value}:${initial.value}`} batchNo={initial.value} subject={scope.value} offerNo={activeOffer.value?.offerNo || ''} />
      {activeOffer.value && <OfferSubscriptionFlows key={`${scope.value}:${activeOffer.value.offerNo}`} offerNo={activeOffer.value.offerNo} unit={activeOffer.value.unit} subjectId={scope.value} />}
    </Space>}
  </PageContainer>;
    };
  }
});
export default P2tTrace;
