import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { Button, Card, Descriptions, Drawer, Input, Select, Space, Table, Tag, message } from "@/vue/ui";
import { ListRowActions } from "@/vue/shared";
import { getAdminOrderDetail, getAdminOrderPage } from '@/api/admin';
import { TradeFilters, TradeList } from '@/components/TradeList';
interface OrderRow {
  id: number;
  orderNo: string;
  buyerName: string;
  sellerName: string;
  categoryName: string;
  totalAmount: number;
  paidAmount: number;
  orderStatus: string;
  paymentStatus: string;
  logisticsNo: string;
  source: string;
  createTime: string;
}
interface OrderItemRow {
  id: number;
  productName: string;
  specLevel: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}
const ORDER_STATUS: Record<string, {
  text: string;
  color: string;
}> = {
  pending_confirm: {
    text: '待确认',
    color: 'warning'
  },
  pending: {
    text: '待付款',
    color: 'warning'
  },
  paid: {
    text: '已付款',
    color: 'processing'
  },
  shipped: {
    text: '已发货',
    color: 'blue'
  },
  received: {
    text: '已收货',
    color: 'cyan'
  },
  completed: {
    text: '已完成',
    color: 'success'
  },
  cancelled: {
    text: '已取消',
    color: 'default'
  },
  refunding: {
    text: '退款中',
    color: 'orange'
  },
  refunded: {
    text: '已退款',
    color: 'default'
  }
};

/**
 * 订单监管（PRD 10.2 第三组）。
 */
const AdminOrderOversight = defineComponent({
  name: "AdminOrderOversight",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const rows = shallowRef<OrderRow[]>([]);
    const setRows = (next: typeof rows.value | ((previous: typeof rows.value) => typeof rows.value)) => {
      rows.value = typeof next === 'function' ? (next as (previous: typeof rows.value) => typeof rows.value)(rows.value) : next;
    };
    const total = shallowRef(0);
    const setTotal = (next: typeof total.value | ((previous: typeof total.value) => typeof total.value)) => {
      total.value = typeof next === 'function' ? (next as (previous: typeof total.value) => typeof total.value)(total.value) : next;
    };
    const loading = shallowRef(false);
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const pageNum = shallowRef(1);
    const setPageNum = (next: typeof pageNum.value | ((previous: typeof pageNum.value) => typeof pageNum.value)) => {
      pageNum.value = typeof next === 'function' ? (next as (previous: typeof pageNum.value) => typeof pageNum.value)(pageNum.value) : next;
    };
    const pageSize = shallowRef(20);
    const setPageSize = (next: typeof pageSize.value | ((previous: typeof pageSize.value) => typeof pageSize.value)) => {
      pageSize.value = typeof next === 'function' ? (next as (previous: typeof pageSize.value) => typeof pageSize.value)(pageSize.value) : next;
    };
    const orderStatus = shallowRef<string | undefined | undefined>(undefined);
    const setOrderStatus = (next: typeof orderStatus.value | ((previous: typeof orderStatus.value) => typeof orderStatus.value)) => {
      orderStatus.value = typeof next === 'function' ? (next as (previous: typeof orderStatus.value) => typeof orderStatus.value)(orderStatus.value) : next;
    };
    const keyword = shallowRef('');
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    const draftStatus = shallowRef<string | undefined | undefined>(undefined);
    const setDraftStatus = (next: typeof draftStatus.value | ((previous: typeof draftStatus.value) => typeof draftStatus.value)) => {
      draftStatus.value = typeof next === 'function' ? (next as (previous: typeof draftStatus.value) => typeof draftStatus.value)(draftStatus.value) : next;
    };
    const draftKeyword = shallowRef('');
    const setDraftKeyword = (next: typeof draftKeyword.value | ((previous: typeof draftKeyword.value) => typeof draftKeyword.value)) => {
      draftKeyword.value = typeof next === 'function' ? (next as (previous: typeof draftKeyword.value) => typeof draftKeyword.value)(draftKeyword.value) : next;
    };
    const detail = shallowRef<{
      order: OrderRow;
      items: OrderItemRow[];
    } | null>(null);
    const setDetail = (next: typeof detail.value | ((previous: typeof detail.value) => typeof detail.value)) => {
      detail.value = typeof next === 'function' ? (next as (previous: typeof detail.value) => typeof detail.value)(detail.value) : next;
    };
    const load = () => {
      setLoading(true);
      getAdminOrderPage({
        pageNum: pageNum.value,
        pageSize: pageSize.value,
        orderStatus: orderStatus.value,
        keyword: keyword.value || undefined
      }).then((res: {
        code: number;
        data?: {
          records?: OrderRow[];
          total?: number;
        };
        message?: string;
      }) => {
        if (res?.code === 200) {
          setRows(res.data?.records ?? []);
          setTotal(res.data?.total ?? 0);
        } else {
          message.error(res?.message ?? '加载订单失败');
        }
      }).catch(() => message.error('加载订单失败（检查后端是否在运行）')).finally(() => setLoading(false));
    };
    onMounted(() => {
      watch(() => [pageNum.value, pageSize.value, orderStatus.value, keyword.value], (_next, _previous, onCleanup) => {
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
      setPageNum(1);
      setOrderStatus(draftStatus.value);
      setKeyword(draftKeyword.value.trim());
    };
    const handleReset = () => {
      setDraftStatus(undefined);
      setDraftKeyword('');
      setPageNum(1);
      setOrderStatus(undefined);
      setKeyword('');
    };
    const openDetail = async (id: number) => {
      const res = await getAdminOrderDetail(id);
      if (res?.code === 200) {
        setDetail(res.data);
      } else {
        message.error(res?.message ?? '加载订单详情失败');
      }
    };
    return () => {
      const view_detail = detail.value;
      return <div style={{
        padding: 20
      }}>
      <TradeList listId="admin-order" rowKey="id" loading={loading.value} dataSource={rows.value} onRefresh={load} toolbarLeft={<span style={{
          fontWeight: 600
        }}>全平台订单（共 {total.value} 条）</span>} filterSlot={<TradeFilters loading={loading.value} onQuery={handleQuery} onReset={handleReset} fields={[{
          label: '订单状态',
          control: <Select allowClear value={draftStatus.value} placeholder="全部订单状态" onChange={value => {
            setDraftStatus(value);
            setPageNum(1);
            setOrderStatus(value);
          }} options={Object.entries(ORDER_STATUS).map(([value, item]) => ({
            value,
            label: item.text
          }))} />
        }, {
          label: '关键字',
          control: <Input allowClear value={draftKeyword.value} placeholder="订单号 / 采购方 / 供货方" onChange={e => setDraftKeyword(e.target.value ?? '')} onPressEnter={handleQuery} />
        }]} />} pagination={{
          current: pageNum.value,
          pageSize: pageSize.value,
          total: total.value,
          onChange: (page, size) => {
            setPageNum(page);
            setPageSize(size);
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
          title: '供货方',
          dataIndex: 'sellerName',
          width: 160,
          ellipsis: true
        }, {
          title: '品类',
          dataIndex: 'categoryName',
          width: 90,
          ellipsis: true
        }, {
          title: '订单金额',
          dataIndex: 'totalAmount',
          width: 130,
          render: (val: number) => `¥${val}`
        }, {
          title: '已付',
          dataIndex: 'paidAmount',
          width: 120,
          render: (val: number) => val ? `¥${val}` : '—'
        }, {
          title: '订单状态',
          dataIndex: 'orderStatus',
          width: 110,
          render: (val: string) => {
            const tag = ORDER_STATUS[val] ?? {
              text: val,
              color: 'default'
            };
            return <Tag color={tag.color}>{tag.text}</Tag>;
          }
        }, {
          title: '来源',
          dataIndex: 'source',
          width: 90,
          render: (val: string) => val === 'quote' ? '报价' : val === 'product' ? '货源' : val ?? '—'
        }, {
          title: '下单时间',
          dataIndex: 'createTime',
          width: 170
        }, {
          title: '操作',
          key: 'action',
          width: 96,
          render: (_: unknown, row: OrderRow) => <ListRowActions>
                <Button type="link" size="small" onClick={() => openDetail(row.id)}>详情</Button>
              </ListRowActions>
        }]} />

      <Drawer width={720} open={Boolean(view_detail)} onClose={() => setDetail(null)} title="订单监管详情">
        {view_detail && <>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="订单号" span={2}>
                {view_detail.order.orderNo}
              </Descriptions.Item>
              <Descriptions.Item label="采购方">{view_detail.order.buyerName ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="供货方">{view_detail.order.sellerName ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="订单金额">¥{view_detail.order.totalAmount}</Descriptions.Item>
              <Descriptions.Item label="已付金额">
                {view_detail.order.paidAmount ? `¥${view_detail.order.paidAmount}` : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="订单状态">{view_detail.order.orderStatus}</Descriptions.Item>
              <Descriptions.Item label="支付状态">{view_detail.order.paymentStatus}</Descriptions.Item>
              <Descriptions.Item label="物流单号">{view_detail.order.logisticsNo ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="来源">
                {view_detail.order.source === 'quote' ? '报价转单' : view_detail.order.source === 'product' ? '货源直下单' : view_detail.order.source ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="下单时间" span={2}>
                {view_detail.order.createTime}
              </Descriptions.Item>
            </Descriptions>
            <Card title="订单明细" size="small" style={{
              marginTop: 16
            }}>
              <Table rowKey="id" size="small" pagination={false} dataSource={view_detail.items} columns={[{
                title: '商品',
                dataIndex: 'productName'
              }, {
                title: '等级',
                dataIndex: 'specLevel',
                render: (val: string) => val || '—'
              }, {
                title: '数量',
                dataIndex: 'quantity',
                align: 'right',
                render: (val: number, row: OrderItemRow) => `${val} ${row.unit ?? ''}`
              }, {
                title: '单价',
                dataIndex: 'unitPrice',
                align: 'right',
                render: (val: number) => `¥${val}`
              }, {
                title: '金额',
                dataIndex: 'totalPrice',
                align: 'right',
                render: (val: number) => `¥${val}`
              }]} />
            </Card>
            <Space style={{
              marginTop: 16
            }}>
              <Button onClick={() => setDetail(null)}>关闭</Button>
            </Space>
          </>}
      </Drawer>
    </div>;
    };
  }
});
export default AdminOrderOversight;
