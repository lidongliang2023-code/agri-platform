import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
/**
 * 页面名称：撮合订单与回写
 * 路由路径：/admin/trade/p2t/orders
 * 所属模块：订单管理 / 生产直供
 */

import { Button, Input, Select, Tag, message } from "@/vue/ui";
import { ListRowActions } from "@/vue/shared";
import { getP2tOrders, retryP2tWriteback } from '@/api/p2t';
import type { P2tOrder } from '@/api/p2t';
import { TradeFilters, TradeList } from '@/components/TradeList';
const WB: Record<string, {
  text: string;
  color: string;
}> = {
  SUCCESS: {
    text: '成功',
    color: 'green'
  },
  FAILED: {
    text: '失败待重试',
    color: 'red'
  },
  RETRYING: {
    text: '重试中',
    color: 'blue'
  },
  PENDING: {
    text: '待支付回写',
    color: 'default'
  }
};
const P2tOrders = defineComponent({
  name: "P2tOrders",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const rows = shallowRef<P2tOrder[]>([]);
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
    const keyword = shallowRef('');
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    const status = shallowRef<string>('');
    const setStatus = (next: typeof status.value | ((previous: typeof status.value) => typeof status.value)) => {
      status.value = typeof next === 'function' ? (next as (previous: typeof status.value) => typeof status.value)(status.value) : next;
    };
    const draftKeyword = shallowRef('');
    const setDraftKeyword = (next: typeof draftKeyword.value | ((previous: typeof draftKeyword.value) => typeof draftKeyword.value)) => {
      draftKeyword.value = typeof next === 'function' ? (next as (previous: typeof draftKeyword.value) => typeof draftKeyword.value)(draftKeyword.value) : next;
    };
    const draftStatus = shallowRef<string>('');
    const setDraftStatus = (next: typeof draftStatus.value | ((previous: typeof draftStatus.value) => typeof draftStatus.value)) => {
      draftStatus.value = typeof next === 'function' ? (next as (previous: typeof draftStatus.value) => typeof draftStatus.value)(draftStatus.value) : next;
    };
    const load = () => {
      setLoading(true);
      getP2tOrders({
        pageNum: pageNum.value,
        pageSize: pageSize.value,
        keyword: keyword.value || undefined,
        status: status.value || undefined
      }).then((res: {
        code: number;
        data?: {
          records?: P2tOrder[];
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
      }).catch(() => message.error('加载订单失败')).finally(() => setLoading(false));
    };
    onMounted(() => {
      watch(() => [pageNum.value, pageSize.value, keyword.value, status.value], (_next, _previous, onCleanup) => {
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
      setStatus(draftStatus.value);
      setKeyword(draftKeyword.value.trim());
    };
    const handleReset = () => {
      setDraftStatus('');
      setDraftKeyword('');
      setPageNum(1);
      setStatus('');
      setKeyword('');
    };
    const retry = async (orderNo: string): Promise<void> => {
      const res = await retryP2tWriteback(orderNo);
      if (res?.code === 200) {
        message.success(res.data?.status === 'SUCCESS' ? '回写成功' : `回写仍失败：${res.data?.message ?? ''}`);
        load();
      } else {
        message.error(res?.message ?? '重试失败');
      }
    };
    return () => {
      return <div style={{
        padding: 20
      }}>
      <TradeList listId="admin-p2t-orders" rowKey="orderNo" loading={loading.value} dataSource={rows.value} onRefresh={load} toolbarLeft={<span style={{
          fontWeight: 600
        }}>生产直供订单（共 {total.value} 条）</span>} filterSlot={<TradeFilters loading={loading.value} onQuery={handleQuery} onReset={handleReset} fields={[{
          label: '回写状态',
          control: <Select value={draftStatus.value} onChange={v => {
            setDraftStatus(v);
            setPageNum(1);
            setStatus(v);
          }} options={[{
            value: '',
            label: '全部回写状态'
          }, {
            value: 'SUCCESS',
            label: '成功'
          }, {
            value: 'FAILED',
            label: '失败待重试'
          }, {
            value: 'PENDING',
            label: '待回写'
          }]} />
        }, {
          label: '关键字',
          control: <Input allowClear value={draftKeyword.value} placeholder="订单号 / 买家 / 供给单号" onChange={e => setDraftKeyword(e.target.value ?? '')} onPressEnter={handleQuery} />
        }]} />} pagination={{
          current: pageNum.value,
          pageSize: pageSize.value,
          total: total.value,
          onChange: (p, s) => {
            setPageNum(p);
            setPageSize(s);
          }
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
          title: '商品',
          dataIndex: 'productName',
          width: 180,
          ellipsis: true
        }, {
          title: '来源供给',
          dataIndex: 'sourceOfferNo',
          width: 165,
          ellipsis: true
        }, {
          title: '数量',
          dataIndex: 'totalQuantity',
          width: 96
        }, {
          title: '金额',
          dataIndex: 'totalAmount',
          width: 120,
          render: v => v == null ? '—' : `¥${v}`
        }, {
          title: '订单状态',
          dataIndex: 'paymentStatus',
          width: 110,
          render: (v: string) => <Tag color={v === 'paid' ? 'green' : 'default'}>{v}</Tag>
        }, {
          title: '回写',
          dataIndex: 'p2tWritebackStatus',
          width: 120,
          render: (v: string) => v ? <Tag color={WB[v]?.color}>{WB[v]?.text ?? v}</Tag> : '—'
        }, {
          title: '操作',
          key: 'action',
          width: 110,
          render: (_, r) => r.p2tWritebackStatus === 'FAILED' || r.p2tWritebackStatus === 'PENDING' ? <ListRowActions>
                  <Button size="small" type="link" onClick={() => void retry(r.orderNo)}>重试回写</Button>
                </ListRowActions> : <span style={{
            color: '#a0aec0'
          }}>—</span>
        }]} locale={{
          emptyText: '还没有生产直供订单：先在供给池「转商品」，买家下单支付后才会产生'
        }} />
    </div>;
    };
  }
});
export default P2tOrders;
