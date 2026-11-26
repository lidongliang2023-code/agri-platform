import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { Alert, Button, DatePicker, Select, Tabs, Typography, message } from "@/vue/ui";
import { DownloadOutlined } from "@ant-design/icons-vue";
import dayjs, { type Dayjs } from 'dayjs';
import { exportReport, getCategoryReport, getTradeReport, type CategoryReportRow, type TradeReportRow } from '@/api/report';
import { TradeFilters, TradeList } from '@/components/TradeList';
const GRANULARITY = [{
  value: 'day',
  label: '按日'
}, {
  value: 'week',
  label: '按周'
}, {
  value: 'month',
  label: '按月'
}];
const defaultRange = (): [Dayjs, Dayjs] => [dayjs().subtract(6, 'day'), dayjs()];
const AdminReport = defineComponent({
  name: "AdminReport",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const range = shallowRef<[Dayjs, Dayjs]>(defaultRange());
    const setRange = (next: typeof range.value | ((previous: typeof range.value) => typeof range.value)) => {
      range.value = typeof next === 'function' ? (next as (previous: typeof range.value) => typeof range.value)(range.value) : next;
    };
    const granularity = shallowRef('day');
    const setGranularity = (next: typeof granularity.value | ((previous: typeof granularity.value) => typeof granularity.value)) => {
      granularity.value = typeof next === 'function' ? (next as (previous: typeof granularity.value) => typeof granularity.value)(granularity.value) : next;
    };
    const draftRange = shallowRef<[Dayjs, Dayjs]>(defaultRange());
    const setDraftRange = (next: typeof draftRange.value | ((previous: typeof draftRange.value) => typeof draftRange.value)) => {
      draftRange.value = typeof next === 'function' ? (next as (previous: typeof draftRange.value) => typeof draftRange.value)(draftRange.value) : next;
    };
    const draftGranularity = shallowRef('day');
    const setDraftGranularity = (next: typeof draftGranularity.value | ((previous: typeof draftGranularity.value) => typeof draftGranularity.value)) => {
      draftGranularity.value = typeof next === 'function' ? (next as (previous: typeof draftGranularity.value) => typeof draftGranularity.value)(draftGranularity.value) : next;
    };
    const tradeRows = shallowRef<TradeReportRow[]>([]);
    const setTradeRows = (next: typeof tradeRows.value | ((previous: typeof tradeRows.value) => typeof tradeRows.value)) => {
      tradeRows.value = typeof next === 'function' ? (next as (previous: typeof tradeRows.value) => typeof tradeRows.value)(tradeRows.value) : next;
    };
    const categoryRows = shallowRef<CategoryReportRow[]>([]);
    const setCategoryRows = (next: typeof categoryRows.value | ((previous: typeof categoryRows.value) => typeof categoryRows.value)) => {
      categoryRows.value = typeof next === 'function' ? (next as (previous: typeof categoryRows.value) => typeof categoryRows.value)(categoryRows.value) : next;
    };
    const loading = shallowRef(false);
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const exporting = shallowRef(false);
    const setExporting = (next: typeof exporting.value | ((previous: typeof exporting.value) => typeof exporting.value)) => {
      exporting.value = typeof next === 'function' ? (next as (previous: typeof exporting.value) => typeof exporting.value)(exporting.value) : next;
    };
    const startDate = computed(() => range.value[0].format('YYYY-MM-DD'));
    const endDate = computed(() => range.value[1].format('YYYY-MM-DD'));
    const load = async () => {
      setLoading(true);
      try {
        const [t, c] = await Promise.all([getTradeReport({
          startDate: startDate.value,
          endDate: endDate.value,
          granularity: granularity.value
        }), getCategoryReport({
          startDate: startDate.value,
          endDate: endDate.value
        })]);
        if (t?.code === 200) setTradeRows(t.data ?? []);
        if (c?.code === 200) setCategoryRows(c.data ?? []);
      } catch {
        message.error('加载报表失败（请检查后端是否在运行）');
      } finally {
        setLoading(false);
      }
    };
    onMounted(() => {
      watch(() => [startDate.value, endDate.value, granularity.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          load();
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const handleQuery = () => {
      setRange(draftRange.value);
      setGranularity(draftGranularity.value);
    };
    const handleReset = () => {
      const next = defaultRange();
      setDraftRange(next);
      setDraftGranularity('day');
      setRange(next);
      setGranularity('day');
    };
    const doExport = async (type: 'trade' | 'category') => {
      setExporting(true);
      try {
        await exportReport({
          startDate: startDate.value,
          endDate: endDate.value,
          granularity: granularity.value,
          type
        });
        message.success('已开始下载');
      } catch {
        message.error('导出失败');
      } finally {
        setExporting(false);
      }
    };
    const money = (v: number | undefined | null) => v == null ? '—' : `¥${Number(v).toLocaleString('zh-CN', {
      minimumFractionDigits: 2
    })}`;
    const filterBar = computed(() => <TradeFilters loading={loading.value} onQuery={handleQuery} onReset={handleReset} fields={[{
      label: '统计期间',
      wide: true,
      control: <DatePicker.RangePicker value={draftRange.value} allowClear={false} onChange={v => {
        if (v && v[0] && v[1]) setDraftRange([dayjs(v[0]), dayjs(v[1])]);
      }} />
    }, {
      label: '统计粒度',
      control: <Select value={draftGranularity.value} onChange={setDraftGranularity} options={GRANULARITY} />
    }]} />);
    const tradeTab = computed(() => <>
      <TradeList listId="admin-report-trade" rowKey="period" size="small" loading={loading.value} dataSource={tradeRows.value} onRefresh={load} filterSlot={filterBar.value} toolbarLeft={<>
            <Button icon={<DownloadOutlined />} loading={exporting.value} onClick={() => doExport('trade')}>
              导出 CSV
            </Button>
            <span style={{
          color: '#595959',
          fontSize: 13
        }}>交易报表 {startDate.value} ~ {endDate.value}</span>
          </>} columns={[{
        title: '期间',
        dataIndex: 'period',
        width: 130,
        fixed: 'left' as const
      }, {
        title: '订单笔数',
        dataIndex: 'orderCount',
        width: 100
      }, {
        title: '订单金额',
        dataIndex: 'orderAmount',
        width: 140,
        render: money
      }, {
        title: '成交笔数',
        dataIndex: 'dealCount',
        width: 100
      }, {
        title: '成交额',
        dataIndex: 'dealAmount',
        width: 140,
        render: money
      }, {
        title: '退款额',
        dataIndex: 'refundAmount',
        width: 130,
        render: money
      }, {
        title: '结算笔数',
        dataIndex: 'settleCount',
        width: 100
      }, {
        title: '结算金额',
        dataIndex: 'settleAmount',
        width: 140,
        render: money
      }, {
        title: '平台服务费',
        dataIndex: 'platformFee',
        width: 130,
        render: money
      }, {
        title: '客单价',
        dataIndex: 'avgOrderAmount',
        width: 130,
        render: money
      }]} />
      <Typography.Paragraph type="secondary" style={{
        marginTop: 12,
        marginBottom: 0
      }}>
        口径：成交排除已取消订单；退款额取订单上的已退金额；结算额取结算表里已结算记录（按结算时间落入期间）。空档期会补 0 行，便于对齐。
      </Typography.Paragraph>
    </>);
    const categoryTab = computed(() => <>
      <TradeList listId="admin-report-category" rowKey="categoryName" size="small" loading={loading.value} dataSource={categoryRows.value} onRefresh={load} filterSlot={filterBar.value} toolbarLeft={<>
            <Button icon={<DownloadOutlined />} loading={exporting.value} onClick={() => doExport('category')}>
              导出 CSV
            </Button>
            <span style={{
          color: '#595959',
          fontSize: 13
        }}>品类报表 {startDate.value} ~ {endDate.value}</span>
          </>} locale={{
        emptyText: '期间内没有成交'
      }} columns={[{
        title: '品类',
        dataIndex: 'categoryName',
        width: 220,
        ellipsis: true
      }, {
        title: '成交笔数',
        dataIndex: 'orderCount',
        width: 120
      }, {
        title: '成交额',
        dataIndex: 'dealAmount',
        width: 160,
        render: money
      }, {
        title: '占比',
        dataIndex: 'share',
        width: 120,
        render: (v: number) => `${v}%`
      }]} />
      <Typography.Paragraph type="secondary" style={{
        marginTop: 12,
        marginBottom: 0
      }}>
        口径：按订单上的品类聚合，排除已取消订单；占比 = 该品类成交额 ÷ 期间成交总额。
      </Typography.Paragraph>
    </>);
    return () => {
      return <div style={{
        padding: 20
      }}>
      <Alert type="info" showIcon style={{
          marginBottom: 12
        }} message="报表里的每个数字都能在明细里对上" description="交易报表按所选粒度聚合；品类报表按订单品类聚合。两者都可以导出 CSV（带 BOM，Excel 直接打开不乱码）。" />
      <Tabs items={[{
          key: 'trade',
          label: '交易报表',
          children: tradeTab.value
        }, {
          key: 'category',
          label: '品类报表',
          children: categoryTab.value
        }]} />
    </div>;
    };
  }
});
export default AdminReport;
