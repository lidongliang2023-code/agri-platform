import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
/**
 * 页面名称：产销对账
 * 路由路径：/admin/trade/p2t/recon
 * 所属模块：数据 / 产销对账
 */
import { Card, Col, Input, Row, Select, Statistic, Tag, Typography } from "@/vue/ui";
import { getP2tRecon } from '@/api/p2t';
import { TradeFilters, TradeList } from '@/components/TradeList';
interface ReconRow {
  offerNo: string;
  cropName?: string;
  unit: string;
  supplyQty: number;
  tradedQty: number;
  remainingQty: number;
  tradeRate: number;
  auditStatus: string;
  tradeStatus: string;
  productCode?: string;
  batchNo?: string;
}
const P2tRecon = defineComponent({
  name: "P2tRecon",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const rows = shallowRef<ReconRow[]>([]);
    const setRows = (next: typeof rows.value | ((previous: typeof rows.value) => typeof rows.value)) => {
      rows.value = typeof next === 'function' ? (next as (previous: typeof rows.value) => typeof rows.value)(rows.value) : next;
    };
    const loading = shallowRef(false);
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const keyword = shallowRef('');
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    const status = shallowRef<string | undefined | undefined>(undefined);
    const setStatus = (next: typeof status.value | ((previous: typeof status.value) => typeof status.value)) => {
      status.value = typeof next === 'function' ? (next as (previous: typeof status.value) => typeof status.value)(status.value) : next;
    };
    const draftKeyword = shallowRef('');
    const setDraftKeyword = (next: typeof draftKeyword.value | ((previous: typeof draftKeyword.value) => typeof draftKeyword.value)) => {
      draftKeyword.value = typeof next === 'function' ? (next as (previous: typeof draftKeyword.value) => typeof draftKeyword.value)(draftKeyword.value) : next;
    };
    const draftStatus = shallowRef<string | undefined | undefined>(undefined);
    const setDraftStatus = (next: typeof draftStatus.value | ((previous: typeof draftStatus.value) => typeof draftStatus.value)) => {
      draftStatus.value = typeof next === 'function' ? (next as (previous: typeof draftStatus.value) => typeof draftStatus.value)(draftStatus.value) : next;
    };
    const load = () => {
      setLoading(true);
      getP2tRecon().then((res: {
        code: number;
        data?: ReconRow[];
      }) => {
        if (res?.code === 200) setRows(res.data ?? []);
      }).catch(() => setRows([])).finally(() => setLoading(false));
    };
    onMounted(() => {
      watch(() => [load], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          load();
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const filteredRows = computed(() => {
      const kw = keyword.value.trim().toLowerCase();
      return rows.value.filter(r => (!status.value || r.tradeStatus === status.value) && (!kw || [r.offerNo, r.cropName, r.batchNo, r.productCode].some(v => String(v ?? '').toLowerCase().includes(kw))));
    });
    const statusOptions = computed(() => {
      const set = new Set(rows.value.map(r => r.tradeStatus).filter(Boolean));
      return Array.from(set).map(value => ({
        value,
        label: value
      }));
    });
    const supply = computed(() => filteredRows.value.reduce((sum, r) => sum + Number(r.supplyQty ?? 0), 0));
    const traded = computed(() => filteredRows.value.reduce((sum, r) => sum + Number(r.tradedQty ?? 0), 0));
    const remaining = computed(() => filteredRows.value.reduce((sum, r) => sum + Number(r.remainingQty ?? 0), 0));
    const handleQuery = () => {
      setKeyword(draftKeyword.value);
      setStatus(draftStatus.value);
    };
    const handleReset = () => {
      setDraftKeyword('');
      setDraftStatus(undefined);
      setKeyword('');
      setStatus(undefined);
    };
    return () => {
      return <div style={{
        padding: 20,
        display: 'grid',
        gap: 16
      }}>
      <Row gutter={16}>
        <Col span={8}><Card><Statistic title="供给量合计" value={supply.value} precision={1} /></Card></Col>
        <Col span={8}><Card><Statistic title="成交量合计" value={traded.value} precision={1} /></Card></Col>
        <Col span={8}><Card><Statistic title="剩余可售" value={remaining.value} precision={1} /></Card></Col>
      </Row>

      <TradeList listId="admin-p2t-recon" rowKey="offerNo" loading={loading.value} dataSource={filteredRows.value} onRefresh={load} toolbarLeft={<span style={{
          fontWeight: 600
        }}>供给单三维对账（共 {filteredRows.value.length} 条）</span>} filterSlot={<TradeFilters loading={loading.value} onQuery={handleQuery} onReset={handleReset} fields={[{
          label: '关键字',
          control: <Input allowClear value={draftKeyword.value} placeholder="供给单 / 品种 / 批次 / 商品" onChange={e => setDraftKeyword(e.target.value ?? '')} onPressEnter={handleQuery} />
        }, {
          label: '交易状态',
          control: <Select allowClear value={draftStatus.value} placeholder="全部状态" onChange={setDraftStatus} options={statusOptions.value} />
        }]} />} columns={[{
          title: '供给单',
          dataIndex: 'offerNo',
          width: 170,
          ellipsis: true
        }, {
          title: '品种',
          dataIndex: 'cropName',
          width: 130,
          ellipsis: true
        }, {
          title: '批次',
          dataIndex: 'batchNo',
          width: 150,
          ellipsis: true
        }, {
          title: '供给量',
          dataIndex: 'supplyQty',
          width: 115,
          render: (v, r) => `${v} ${r.unit}`
        }, {
          title: '成交量',
          dataIndex: 'tradedQty',
          width: 115,
          render: (v, r) => `${v} ${r.unit}`
        }, {
          title: '剩余',
          dataIndex: 'remainingQty',
          width: 115,
          render: (v, r) => `${v} ${r.unit}`
        }, {
          title: '成交率',
          dataIndex: 'tradeRate',
          width: 96,
          render: v => `${v}%`
        }, {
          title: '入仓量',
          key: 'warehouseQty',
          width: 125,
          render: () => <Typography.Text type="secondary">仓储管理只读</Typography.Text>
        }, {
          title: '状态',
          dataIndex: 'tradeStatus',
          width: 110,
          render: (v: string) => <Tag color={v === 'LISTED' ? 'green' : 'default'}>{v}</Tag>
        }, {
          title: '商品',
          dataIndex: 'productCode',
          width: 160,
          ellipsis: true,
          render: v => v ?? '—'
        }]} locale={{
          emptyText: '还没有供给数据'
        }} />
    </div>;
    };
  }
});
export default P2tRecon;
