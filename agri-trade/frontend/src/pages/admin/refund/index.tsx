import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { Button, Form, Input, Modal, Popconfirm, Select, Tag, message } from "@/vue/ui";
import { ListRowActions } from "@/vue/shared";
import { auditRefund, getAdminRefundPage } from '@/api/admin';
import { TradeFilters, TradeList } from '@/components/TradeList';
interface RefundRow {
  id: number;
  refundNo: string;
  orderId: number;
  orderNo: string;
  refundType: string;
  refundAmount: number;
  refundReason: string;
  applicantName: string;
  refundStatus: string;
  reviewer: string;
  reviewTime: string;
  reviewRemark: string;
  createTime: string;
}
const STATUS: Record<string, {
  text: string;
  color: string;
}> = {
  pending: {
    text: '待审核',
    color: 'warning'
  },
  approved: {
    text: '已通过',
    color: 'success'
  },
  rejected: {
    text: '已驳回',
    color: 'error'
  },
  cancelled: {
    text: '已撤销',
    color: 'default'
  }
};

/**
 * 退款审核（运营端）。
 *
 * <p>通过 → 订单置为 refunded 并累加已退金额；驳回 → 只改退款单，不动订单。</p>
 */
const AdminRefund = defineComponent({
  name: "AdminRefund",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const rows = shallowRef<RefundRow[]>([]);
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
    const status = shallowRef('pending');
    const setStatus = (next: typeof status.value | ((previous: typeof status.value) => typeof status.value)) => {
      status.value = typeof next === 'function' ? (next as (previous: typeof status.value) => typeof status.value)(status.value) : next;
    };
    const keyword = shallowRef('');
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    const draftStatus = shallowRef('pending');
    const setDraftStatus = (next: typeof draftStatus.value | ((previous: typeof draftStatus.value) => typeof draftStatus.value)) => {
      draftStatus.value = typeof next === 'function' ? (next as (previous: typeof draftStatus.value) => typeof draftStatus.value)(draftStatus.value) : next;
    };
    const draftKeyword = shallowRef('');
    const setDraftKeyword = (next: typeof draftKeyword.value | ((previous: typeof draftKeyword.value) => typeof draftKeyword.value)) => {
      draftKeyword.value = typeof next === 'function' ? (next as (previous: typeof draftKeyword.value) => typeof draftKeyword.value)(draftKeyword.value) : next;
    };
    const current = shallowRef<RefundRow | null>(null);
    const setCurrent = (next: typeof current.value | ((previous: typeof current.value) => typeof current.value)) => {
      current.value = typeof next === 'function' ? (next as (previous: typeof current.value) => typeof current.value)(current.value) : next;
    };
    const form = Form.useForm();
    const load = () => {
      setLoading(true);
      getAdminRefundPage({
        pageNum: pageNum.value,
        pageSize: pageSize.value,
        refundStatus: status.value || undefined,
        keyword: keyword.value || undefined
      }).then((res: {
        code: number;
        data?: {
          records?: RefundRow[];
          total?: number;
        };
        message?: string;
      }) => {
        if (res?.code === 200) {
          setRows(res.data?.records ?? []);
          setTotal(res.data?.total ?? 0);
        } else {
          message.error(res?.message ?? '加载退款单失败');
        }
      }).catch(() => message.error('加载退款单失败（检查后端是否在运行）')).finally(() => setLoading(false));
    };
    onMounted(() => {
      watch(() => [pageNum.value, pageSize.value, status.value, keyword.value], (_next, _previous, onCleanup) => {
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
      setDraftStatus('pending');
      setDraftKeyword('');
      setPageNum(1);
      setStatus('pending');
      setKeyword('');
    };
    const doAudit = async (row: RefundRow, approved: boolean, remark?: string) => {
      const res = await auditRefund(row.id, approved ? 'approved' : 'rejected', remark);
      if (res?.code === 200) {
        message.success(approved ? '已通过，订单将置为已退款' : '已驳回');
        setCurrent(null);
        form.resetFields();
        load();
      } else {
        message.error(res?.message ?? '审核失败');
      }
    };
    return () => {
      const view_current = current.value;
      return <div style={{
        padding: 20
      }}>
      <TradeList listId="admin-refund" rowKey="id" loading={loading.value} dataSource={rows.value} onRefresh={load} toolbarLeft={<span style={{
          fontWeight: 600
        }}>退款单（共 {total.value} 条）</span>} filterSlot={<TradeFilters loading={loading.value} onQuery={handleQuery} onReset={handleReset} fields={[{
          label: '退款状态',
          control: <Select value={draftStatus.value} onChange={value => {
            setDraftStatus(value);
            setPageNum(1);
            setStatus(value);
          }} options={[{
            value: 'pending',
            label: '待审核'
          }, {
            value: 'approved',
            label: '已通过'
          }, {
            value: 'rejected',
            label: '已驳回'
          }, {
            value: '',
            label: '全部状态'
          }]} />
        }, {
          label: '关键字',
          control: <Input allowClear value={draftKeyword.value} placeholder="退款单号 / 订单号 / 申请人" onChange={e => setDraftKeyword(e.target.value ?? '')} onPressEnter={handleQuery} />
        }]} />} pagination={{
          current: pageNum.value,
          pageSize: pageSize.value,
          total: total.value,
          onChange: (page, size) => {
            setPageNum(page);
            setPageSize(size);
          }
        }} columns={[{
          title: '退款单号',
          dataIndex: 'refundNo',
          width: 160,
          ellipsis: true
        }, {
          title: '关联订单',
          dataIndex: 'orderNo',
          width: 170,
          ellipsis: true
        }, {
          title: '申请人',
          dataIndex: 'applicantName',
          width: 140,
          ellipsis: true
        }, {
          title: '退款类型',
          dataIndex: 'refundType',
          width: 100,
          render: (val: string) => ({
            full: '全额退款',
            partial: '部分退款',
            refund_only: '仅退款',
            return_refund: '退货退款'
          } as Record<string, string>)[val] ?? val ?? '—'
        }, {
          title: '退款金额',
          dataIndex: 'refundAmount',
          width: 120,
          render: (val: number) => `¥${val}`
        }, {
          title: '退款原因',
          dataIndex: 'refundReason',
          width: 240,
          ellipsis: true,
          render: (val: string) => val || '—'
        }, {
          title: '状态',
          dataIndex: 'refundStatus',
          width: 104,
          render: (val: string) => {
            const tag = STATUS[val] ?? {
              text: val,
              color: 'default'
            };
            return <Tag color={tag.color}>{tag.text}</Tag>;
          }
        }, {
          title: '审核记录',
          key: 'reviewRecord',
          width: 220,
          ellipsis: true,
          render: (_: unknown, row: RefundRow) => row.reviewer ? `${row.reviewer} / ${row.reviewTime ?? ''}${row.reviewRemark ? ' / ' + row.reviewRemark : ''}` : '—'
        }, {
          title: '申请时间',
          dataIndex: 'createTime',
          width: 170
        }, {
          title: '操作',
          key: 'action',
          width: 140,
          render: (_: unknown, row: RefundRow) => row.refundStatus === 'pending' ? <ListRowActions>
                  <Popconfirm title="通过后订单将置为已退款并累加已退金额，确认？" onConfirm={() => doAudit(row, true, '审核通过')}>
                    <Button type="link" size="small">通过</Button>
                  </Popconfirm>
                  <Button type="link" size="small" danger onClick={() => setCurrent(row)}>驳回</Button>
                </ListRowActions> : <span style={{
            color: '#a0aec0'
          }}>已处理</span>
        }]} />

      <Modal open={Boolean(view_current)} title={`驳回退款：${view_current?.refundNo ?? ''}`} onCancel={() => setCurrent(null)} onOk={() => form.submit()} okText="确认驳回" okButtonProps={{
          danger: true
        }}>
        <Form form={form} layout="vertical" onFinish={(values: {
            remark: string;
          }) => view_current && doAudit(view_current, false, values.remark)}>
          <Form.Item label="驳回原因（会作为审核备注留痕）" name="remark" rules={[{
              required: true,
              message: '请填写驳回原因'
            }]}>
            <Input.TextArea rows={3} placeholder="例如：商品已签收且无质量证据，不符合退款条件" />
          </Form.Item>
        </Form>
      </Modal>
    </div>;
    };
  }
});
export default AdminRefund;
