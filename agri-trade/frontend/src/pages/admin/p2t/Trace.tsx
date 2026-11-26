import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
/**
 * 页面名称：全链路追踪（交易视角）
 * 路由路径：/admin/trade/p2t/trace
 * 所属模块：产销对接
 */

import { Alert, Button, Card, Descriptions, Empty, Input, Steps, Tag, Typography } from "@/vue/ui";
import { useSearchParams } from "@/vue/router";
import { getP2tTrace } from '@/api/p2t';
import { TradeFilters, TradeList } from '@/components/TradeList';
interface TraceOffer {
  offerNo: string;
  cropName?: string;
  availableQty?: number;
  reservedQty?: number;
  unit?: string;
  tradeStatus?: string;
  productCode?: string;
}
interface TraceSubscription {
  id: number;
  orderNo: string;
  buyerName?: string;
  qty?: number;
  grade?: string;
  createTime?: string;
}
interface TraceData {
  batch?: {
    batchNo?: string;
    cropName?: string;
    farmName?: string;
    quantity?: number;
    unit?: string;
    harvestDate?: string;
    inspectionNo?: string;
  };
  offers?: TraceOffer[];
  subscriptions?: TraceSubscription[];
}
const P2tTrace = defineComponent({
  name: "P2tTrace",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const [searchParams] = useSearchParams();
    const initialBatchNo = computed(() => searchParams.value.get('batchNo') ?? '');
    const batchNo = shallowRef(initialBatchNo.value);
    const setBatchNo = (next: typeof batchNo.value | ((previous: typeof batchNo.value) => typeof batchNo.value)) => {
      batchNo.value = typeof next === 'function' ? (next as (previous: typeof batchNo.value) => typeof batchNo.value)(batchNo.value) : next;
    };
    const queryBatchNo = shallowRef('');
    const setQueryBatchNo = (next: typeof queryBatchNo.value | ((previous: typeof queryBatchNo.value) => typeof queryBatchNo.value)) => {
      queryBatchNo.value = typeof next === 'function' ? (next as (previous: typeof queryBatchNo.value) => typeof queryBatchNo.value)(queryBatchNo.value) : next;
    };
    const data = shallowRef<TraceData | null>(null);
    const setData = (next: typeof data.value | ((previous: typeof data.value) => typeof data.value)) => {
      data.value = typeof next === 'function' ? (next as (previous: typeof data.value) => typeof data.value)(data.value) : next;
    };
    const loading = shallowRef(false);
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const error = shallowRef('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const query = async (value?: string): Promise<void> => {
      const target = (value ?? batchNo.value).trim();
      if (!target) return;
      setLoading(true);
      setError('');
      setData(null);
      try {
        const res = await getP2tTrace(target);
        setData(res?.code === 200 ? res.data as TraceData : null);
        setQueryBatchNo(target);
      } catch {
        setError('交易链路查询失败，请重试，不能将请求失败视为无记录');
        setData(null);
        setQueryBatchNo(target);
      } finally {
        setLoading(false);
      }
    };
    onMounted(() => {
      watch(() => [initialBatchNo.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          if (initialBatchNo.value) void query(initialBatchNo.value);
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const offers = computed(() => data.value?.offers ?? []);
    const subscriptions = computed(() => data.value?.subscriptions ?? []);
    return () => {
      const view_data = data.value;
      return <div style={{
        padding: 20,
        display: 'grid',
        gap: 16
      }}>
      <Alert type="info" showIcon message="产销对接追踪 · 交易侧" description="本页核对批次、供给、合同订单及成交回写；种植事实、质量结论和单品赋码由生产管理维护，零售履约由商城维护。" />
      {error.value && <Alert type="error" message={error.value} action={<Button onClick={() => void query()}>重试</Button>} />}
      <div class="agri-list-filter-card">
        <TradeFilters loading={loading.value} queryText="查询链路" onQuery={() => void query()} onReset={() => {
            setBatchNo('');
            setQueryBatchNo('');
            setData(null);
            setError('');
          }} fields={[{
            label: '采收批次号',
            wide: true,
            control: <Input allowClear placeholder="输入采收批次号" value={batchNo.value} onChange={e => setBatchNo(e.target.value ?? '')} onPressEnter={() => void query()} />
          }]} />
      </div>

      {!queryBatchNo.value && <Empty description="输入批次号后查看「批次 → 供给 → 商品 → 订单 → 回写」链路" />}

      {queryBatchNo.value && view_data?.batch && <>
          <Card title="链路主键">
            <Descriptions column={3} size="small">
              <Descriptions.Item label="批次">{view_data.batch.batchNo}</Descriptions.Item>
              <Descriptions.Item label="品种">{view_data.batch.cropName}</Descriptions.Item>
              <Descriptions.Item label="农场">{view_data.batch.farmName}</Descriptions.Item>
              <Descriptions.Item label="产量">{view_data.batch.quantity} {view_data.batch.unit}</Descriptions.Item>
              <Descriptions.Item label="采收日期">{view_data.batch.harvestDate}</Descriptions.Item>
              <Descriptions.Item label="质检">{view_data.batch.inspectionNo ?? '未判定'}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="链路阶段">
            <Steps size="small" items={[{
              title: '采收',
              description: view_data.batch.harvestDate,
              status: 'finish' as const
            }, {
              title: '供给发布',
              description: offers.value[0]?.offerNo ?? '未发布',
              status: offers.value.length ? 'finish' as const : 'wait' as const
            }, {
              title: '交易建品',
              description: offers.value.find(o => o.productCode)?.productCode ?? '未建品',
              status: offers.value.some(o => o.productCode) ? 'finish' as const : 'wait' as const
            }, {
              title: '成交回写',
              description: subscriptions.value.length ? `${subscriptions.value.length} 笔` : '暂无',
              status: subscriptions.value.length ? 'finish' as const : 'wait' as const
            }]} />
          </Card>

          <TradeList listId="admin-p2t-trace-offers" rowKey="offerNo" size="small" loading={loading.value} dataSource={offers.value} onRefresh={() => void query(queryBatchNo.value)} toolbarLeft={<span style={{
            fontWeight: 600
          }}>供给单（{offers.value.length}）</span>} columns={[{
            title: '供给单号',
            dataIndex: 'offerNo',
            width: 170,
            ellipsis: true
          }, {
            title: '可供量',
            dataIndex: 'availableQty',
            width: 110
          }, {
            title: '已认购',
            dataIndex: 'reservedQty',
            width: 110
          }, {
            title: '商品',
            dataIndex: 'productCode',
            width: 160,
            ellipsis: true,
            render: v => v ?? '—'
          }, {
            title: '状态',
            dataIndex: 'tradeStatus',
            width: 110,
            render: (v: string) => <Tag color={v === 'LISTED' ? 'green' : 'default'}>{v}</Tag>
          }]} />

          <TradeList listId="admin-p2t-trace-subscriptions" rowKey="id" size="small" loading={loading.value} dataSource={subscriptions.value} onRefresh={() => void query(queryBatchNo.value)} toolbarLeft={<span style={{
            fontWeight: 600
          }}>回写流水（{subscriptions.value.length}）</span>} locale={{
            emptyText: '还没有成交回写'
          }} columns={[{
            title: '订单号',
            dataIndex: 'orderNo',
            width: 180,
            ellipsis: true
          }, {
            title: '买家',
            dataIndex: 'buyerName',
            width: 160,
            ellipsis: true
          }, {
            title: '数量',
            dataIndex: 'qty',
            width: 110
          }, {
            title: '等级',
            dataIndex: 'grade',
            width: 110
          }, {
            title: '回写时间',
            dataIndex: 'createTime',
            width: 170
          }]} />
        </>}

      {queryBatchNo.value && !loading.value && !view_data?.batch && <Typography.Text type="secondary">未找到批次 {queryBatchNo.value} 的链路数据</Typography.Text>}
    </div>;
    };
  }
});
export default P2tTrace;
