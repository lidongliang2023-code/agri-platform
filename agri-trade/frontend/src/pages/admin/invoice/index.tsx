import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { Button, Form, Input, Modal, Popconfirm, Select, Tag, message } from "@/vue/ui";
import { ListRowActions } from "@/vue/shared";
import { getAdminInvoices, reviewInvoice, type InvoiceRow } from '@/api/invoice';
import { TradeFilters, TradeList } from '@/components/TradeList';
const INVOICE_STATUS: Record<string, {
  text: string;
  color: string;
}> = {
  pending: {
    text: '待开票',
    color: 'warning'
  },
  issued: {
    text: '已开票',
    color: 'success'
  },
  rejected: {
    text: '已驳回',
    color: 'error'
  }
};
const AdminInvoice = defineComponent({
  name: "AdminInvoice",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const rows = shallowRef<InvoiceRow[]>([]);
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
    const rejecting = shallowRef<InvoiceRow | null>(null);
    const setRejecting = (next: typeof rejecting.value | ((previous: typeof rejecting.value) => typeof rejecting.value)) => {
      rejecting.value = typeof next === 'function' ? (next as (previous: typeof rejecting.value) => typeof rejecting.value)(rejecting.value) : next;
    };
    const form = Form.useForm<{
      remark: string;
    }>();
    const load = () => {
      setLoading(true);
      getAdminInvoices({
        pageNum: pageNum.value,
        pageSize: pageSize.value,
        invoiceStatus: status.value || undefined,
        keyword: keyword.value || undefined
      }).then(body => {
        if (body?.code === 200) {
          setRows(body.data?.records ?? []);
          setTotal(body.data?.total ?? 0);
        } else {
          message.error(body?.message ?? '加载发票申请失败');
        }
      }).catch(() => message.error('加载发票申请失败（请检查后端是否在运行）')).finally(() => setLoading(false));
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
    const handleIssue = async (row: InvoiceRow) => {
      const body = await reviewInvoice(row.id, 'issued', '运营审核通过并完成开票');
      if (body?.code === 200) {
        message.success('已开票');
        load();
      } else {
        message.error(body?.message ?? '开票失败');
      }
    };
    const handleReject = async () => {
      if (!rejecting.value) return;
      const values = await form.validateFields();
      const body = await reviewInvoice(rejecting.value.id, 'rejected', values.remark);
      if (body?.code === 200) {
        message.success('已驳回');
        setRejecting(null);
        form.resetFields();
        load();
      } else {
        message.error(body?.message ?? '驳回失败');
      }
    };
    return () => {
      const view_rejecting = rejecting.value;
      return <div style={{
        padding: 20
      }}>
      <TradeList listId="admin-invoice" rowKey="id" loading={loading.value} dataSource={rows.value} onRefresh={load} toolbarLeft={<span style={{
          fontWeight: 600
        }}>发票申请（共 {total.value} 条）</span>} filterSlot={<TradeFilters loading={loading.value} onQuery={handleQuery} onReset={handleReset} fields={[{
          label: '开票状态',
          control: <Select value={draftStatus.value} onChange={value => {
            setDraftStatus(value);
            setPageNum(1);
            setStatus(value);
          }} options={[{
            value: 'pending',
            label: '待开票'
          }, {
            value: 'issued',
            label: '已开票'
          }, {
            value: 'rejected',
            label: '已驳回'
          }, {
            value: '',
            label: '全部状态'
          }]} />
        }, {
          label: '关键字',
          control: <Input allowClear value={draftKeyword.value} placeholder="申请单号 / 订单号 / 采购方 / 发票抬头" onChange={e => setDraftKeyword(e.target.value ?? '')} onPressEnter={handleQuery} />
        }]} />} pagination={{
          current: pageNum.value,
          pageSize: pageSize.value,
          total: total.value,
          onChange: (page, size) => {
            setPageNum(page);
            setPageSize(size);
          }
        }} columns={[{
          title: '申请单号',
          dataIndex: 'invoiceNo',
          width: 170,
          ellipsis: true
        }, {
          title: '订单号',
          dataIndex: 'orderNo',
          width: 170,
          ellipsis: true
        }, {
          title: '采购方',
          dataIndex: 'buyerName',
          width: 190,
          ellipsis: true
        }, {
          title: '发票抬头',
          dataIndex: 'title',
          width: 190,
          ellipsis: true
        }, {
          title: '税号',
          dataIndex: 'taxNo',
          width: 180,
          ellipsis: true,
          render: (value: string) => value || '—'
        }, {
          title: '发票类型',
          dataIndex: 'invoiceType',
          width: 150,
          ellipsis: true
        }, {
          title: '开票金额',
          dataIndex: 'amount',
          width: 120,
          render: (value: number) => `¥${value}`
        }, {
          title: '状态',
          dataIndex: 'invoiceStatus',
          width: 104,
          render: (value: string) => {
            const item = INVOICE_STATUS[value] ?? {
              text: value,
              color: 'default'
            };
            return <Tag color={item.color}>{item.text}</Tag>;
          }
        }, {
          title: '申请时间',
          dataIndex: 'applyTime',
          width: 170
        }, {
          title: '开票时间',
          dataIndex: 'issueTime',
          width: 170,
          render: (value: string) => value || '—'
        }, {
          title: '备注',
          dataIndex: 'remark',
          width: 220,
          ellipsis: true,
          render: (value: string) => value || '—'
        }, {
          title: '操作',
          key: 'action',
          width: 140,
          render: (_: unknown, row: InvoiceRow) => row.invoiceStatus === 'pending' ? <ListRowActions>
                <Popconfirm title="确认完成开票？" onConfirm={() => void handleIssue(row)}>
                  <Button type="link" size="small">开票</Button>
                </Popconfirm>
                <Button type="link" size="small" danger onClick={() => setRejecting(row)}>驳回</Button>
              </ListRowActions> : <span style={{
            color: '#a0aec0'
          }}>已处理</span>
        }]} />

      <Modal title={`驳回发票申请：${view_rejecting?.invoiceNo ?? ''}`} open={Boolean(view_rejecting)} onCancel={() => setRejecting(null)} onOk={() => form.submit()} okText="确认驳回" okButtonProps={{
          danger: true
        }}>
        <Form form={form} layout="vertical" onFinish={handleReject}>
          <Form.Item label="驳回原因" name="remark" rules={[{
              required: true,
              message: '请填写驳回原因'
            }]}>
            <Input.TextArea rows={3} placeholder="例如：发票抬头与认证主体名称不一致" />
          </Form.Item>
        </Form>
      </Modal>
    </div>;
    };
  }
});
export default AdminInvoice;
