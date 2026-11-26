import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { Alert, Button, Card, Col, Popconfirm, Row, Statistic, Tag, Typography, message } from "@/vue/ui";
import { ListRowActions } from "@/vue/shared";
import { getPendingSettlements, getSettledSettlements, getSettlementSummary, settleOrder, type PendingSettlementRow, type SettlementRow, type SettlementSummary } from '@/api/settlement';
import { TradeList } from '@/components/TradeList';
const ORDER_STATUS: Record<string, string> = {
  received: '已收货',
  completed: '已完成'
};

/**
 * 结算与分账（运营端）。
 */
const AdminSettlement = defineComponent({
  name: "AdminSettlement",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const summary = shallowRef<SettlementSummary | null>(null);
    const setSummary = (next: typeof summary.value | ((previous: typeof summary.value) => typeof summary.value)) => {
      summary.value = typeof next === 'function' ? (next as (previous: typeof summary.value) => typeof summary.value)(summary.value) : next;
    };
    const pending = shallowRef<PendingSettlementRow[]>([]);
    const setPending = (next: typeof pending.value | ((previous: typeof pending.value) => typeof pending.value)) => {
      pending.value = typeof next === 'function' ? (next as (previous: typeof pending.value) => typeof pending.value)(pending.value) : next;
    };
    const pendingTotal = shallowRef(0);
    const setPendingTotal = (next: typeof pendingTotal.value | ((previous: typeof pendingTotal.value) => typeof pendingTotal.value)) => {
      pendingTotal.value = typeof next === 'function' ? (next as (previous: typeof pendingTotal.value) => typeof pendingTotal.value)(pendingTotal.value) : next;
    };
    const pendingPage = shallowRef(1);
    const setPendingPage = (next: typeof pendingPage.value | ((previous: typeof pendingPage.value) => typeof pendingPage.value)) => {
      pendingPage.value = typeof next === 'function' ? (next as (previous: typeof pendingPage.value) => typeof pendingPage.value)(pendingPage.value) : next;
    };
    const pendingPageSize = shallowRef(20);
    const setPendingPageSize = (next: typeof pendingPageSize.value | ((previous: typeof pendingPageSize.value) => typeof pendingPageSize.value)) => {
      pendingPageSize.value = typeof next === 'function' ? (next as (previous: typeof pendingPageSize.value) => typeof pendingPageSize.value)(pendingPageSize.value) : next;
    };
    const settled = shallowRef<SettlementRow[]>([]);
    const setSettled = (next: typeof settled.value | ((previous: typeof settled.value) => typeof settled.value)) => {
      settled.value = typeof next === 'function' ? (next as (previous: typeof settled.value) => typeof settled.value)(settled.value) : next;
    };
    const settledTotal = shallowRef(0);
    const setSettledTotal = (next: typeof settledTotal.value | ((previous: typeof settledTotal.value) => typeof settledTotal.value)) => {
      settledTotal.value = typeof next === 'function' ? (next as (previous: typeof settledTotal.value) => typeof settledTotal.value)(settledTotal.value) : next;
    };
    const settledPage = shallowRef(1);
    const setSettledPage = (next: typeof settledPage.value | ((previous: typeof settledPage.value) => typeof settledPage.value)) => {
      settledPage.value = typeof next === 'function' ? (next as (previous: typeof settledPage.value) => typeof settledPage.value)(settledPage.value) : next;
    };
    const settledPageSize = shallowRef(20);
    const setSettledPageSize = (next: typeof settledPageSize.value | ((previous: typeof settledPageSize.value) => typeof settledPageSize.value)) => {
      settledPageSize.value = typeof next === 'function' ? (next as (previous: typeof settledPageSize.value) => typeof settledPageSize.value)(settledPageSize.value) : next;
    };
    const loading = shallowRef(false);
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const acting = shallowRef<number | null>(null);
    const setActing = (next: typeof acting.value | ((previous: typeof acting.value) => typeof acting.value)) => {
      acting.value = typeof next === 'function' ? (next as (previous: typeof acting.value) => typeof acting.value)(acting.value) : next;
    };
    const load = async () => {
      setLoading(true);
      try {
        const [s, p, d] = await Promise.all([getSettlementSummary(), getPendingSettlements({
          pageNum: pendingPage.value,
          pageSize: pendingPageSize.value
        }), getSettledSettlements({
          pageNum: settledPage.value,
          pageSize: settledPageSize.value
        })]);
        if (s?.code === 200) setSummary(s.data);
        if (p?.code === 200) {
          setPending(p.data?.records ?? []);
          setPendingTotal(Number(p.data?.total ?? 0));
        }
        if (d?.code === 200) {
          setSettled(d.data?.records ?? []);
          setSettledTotal(Number(d.data?.total ?? 0));
        }
      } catch {
        message.error('加载结算数据失败（请检查后端是否在运行）');
      } finally {
        setLoading(false);
      }
    };
    onMounted(() => {
      watch(() => [pendingPage.value, pendingPageSize.value, settledPage.value, settledPageSize.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          load();
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const handleSettle = async (row: PendingSettlementRow) => {
      setActing(row.orderId);
      try {
        const res = await settleOrder(row.orderId);
        if (res?.code === 200) {
          message.success(`已结算：卖家应收 ¥${res.data?.sellerReceivable ?? ''}`);
          load();
        } else {
          message.error(res?.message ?? '结算失败');
        }
      } catch {
        message.error('结算失败（请检查后端是否在运行）');
      } finally {
        setActing(null);
      }
    };
    const money = (v: number | undefined | null) => v == null ? '—' : `¥${Number(v).toLocaleString('zh-CN', {
      minimumFractionDigits: 2
    })}`;
    const feePercent = computed(() => summary.value ? `${(Number(summary.value.platformFeeRate) * 100).toFixed(2)}%` : '—');
    return () => {
      const view_acting = acting.value;
      const view_summary = summary.value;
      return <div style={{
        padding: 20,
        display: 'grid',
        gap: 16
      }}>
      <Row gutter={16}>
        <Col span={6}>
          <Card><Statistic title="待结算订单" value={view_summary?.pendingCount ?? 0} suffix="笔" /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="待结算金额" value={view_summary?.pendingAmount ?? 0} prefix="¥" precision={2} /></Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title={`预估平台服务费（费率 ${feePercent.value}，按货款）`} value={view_summary?.pendingPlatformFee ?? 0} prefix="¥" precision={2} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="预估卖家应收合计" value={view_summary?.pendingSellerReceivable ?? 0} prefix="¥" precision={2} />
          </Card>
        </Col>
      </Row>

      <Alert type="info" showIcon message="结算条件：已确认收货（或已完成）且已付款" description={`平台服务费按货款计，费率 ${feePercent.value}；卖家应收 = 订单总额 − 平台服务费。金额由服务端按订单真实数据重算，一笔订单只能结算一次。`} />

      <TradeList listId="admin-settlement-pending" rowKey="orderId" loading={loading.value} dataSource={pending.value} onRefresh={load} toolbarLeft={<span style={{
          fontWeight: 600
        }}>待结算订单（共 {pendingTotal.value} 笔）</span>} locale={{
          emptyText: '暂无待结算订单（订单需先走到「已收货」）'
        }} pagination={{
          current: pendingPage.value,
          pageSize: pendingPageSize.value,
          total: pendingTotal.value,
          onChange: (page, size) => {
            setPendingPage(page);
            setPendingPageSize(size);
          }
        }} columns={[{
          title: '订单号',
          dataIndex: 'orderNo',
          width: 170,
          ellipsis: true
        }, {
          title: '采购方',
          dataIndex: 'buyerName',
          width: 160,
          ellipsis: true
        }, {
          title: '供应方',
          dataIndex: 'sellerName',
          width: 160,
          ellipsis: true
        }, {
          title: '订单状态',
          dataIndex: 'orderStatus',
          width: 104,
          render: (v: string) => <Tag color="success">{ORDER_STATUS[v] ?? v}</Tag>
        }, {
          title: '货款',
          dataIndex: 'goodsAmount',
          width: 130,
          render: money
        }, {
          title: '运费',
          dataIndex: 'freightAmount',
          width: 110,
          render: money
        }, {
          title: '订单总额',
          dataIndex: 'totalAmount',
          width: 130,
          render: money
        }, {
          title: '平台服务费',
          dataIndex: 'platformFee',
          width: 120,
          render: money
        }, {
          title: '卖家应收',
          dataIndex: 'sellerReceivable',
          width: 130,
          render: (v: number) => <strong>{money(v)}</strong>
        }, {
          title: '操作',
          key: 'action',
          width: 104,
          render: (_: unknown, row: PendingSettlementRow) => <ListRowActions>
                <Popconfirm title="确认结算这笔订单？" description={`结算后卖家应收 ¥${row.sellerReceivable}，不可撤销。`} okText="确 定" cancelText="取 消" onConfirm={() => handleSettle(row)}>
                  <Button type="link" size="small" loading={view_acting === row.orderId}>结算</Button>
                </Popconfirm>
              </ListRowActions>
        }]} />

      <Card size="small">
        <Row gutter={16}>
          <Col span={8}>
            <Statistic title="已结算金额" value={view_summary?.settledAmount ?? 0} prefix="¥" precision={2} />
          </Col>
          <Col span={8}>
            <Statistic title="累计平台服务费" value={view_summary?.settledPlatformFee ?? 0} prefix="¥" precision={2} />
          </Col>
          <Col span={8}>
            <Statistic title="累计卖家应收" value={view_summary?.settledSellerReceivable ?? 0} prefix="¥" precision={2} />
          </Col>
        </Row>
      </Card>

      <TradeList listId="admin-settlement-settled" rowKey="id" loading={loading.value} dataSource={settled.value} onRefresh={load} toolbarLeft={<span style={{
          fontWeight: 600
        }}>已结算记录（共 {settledTotal.value} 笔）</span>} locale={{
          emptyText: '还没有结算记录'
        }} pagination={{
          current: settledPage.value,
          pageSize: settledPageSize.value,
          total: settledTotal.value,
          onChange: (page, size) => {
            setSettledPage(page);
            setSettledPageSize(size);
          }
        }} columns={[{
          title: '结算单号',
          dataIndex: 'settlementNo',
          width: 170,
          ellipsis: true
        }, {
          title: '订单号',
          dataIndex: 'orderNo',
          width: 170,
          ellipsis: true
        }, {
          title: '供应方',
          dataIndex: 'sellerName',
          width: 160,
          ellipsis: true
        }, {
          title: '订单总额',
          dataIndex: 'totalAmount',
          width: 130,
          render: money
        }, {
          title: '平台服务费',
          dataIndex: 'platformFee',
          width: 120,
          render: money
        }, {
          title: '卖家应收',
          dataIndex: 'sellerReceivable',
          width: 130,
          render: money
        }, {
          title: '结算时间',
          dataIndex: 'settleTime',
          width: 170
        }, {
          title: '操作人',
          dataIndex: 'settleBy',
          width: 110,
          render: (v: string) => v ?? '—'
        }]} />

      <Typography.Paragraph type="secondary" style={{
          margin: 0
        }}>
        说明：分账口径（费率、卖家应收）在结算那一刻由服务端重算并落库留痕，订单上的“已结算”标记与这里一一对应。
      </Typography.Paragraph>
    </div>;
    };
  }
});
export default AdminSettlement;
