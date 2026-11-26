import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { Button, Input, Modal, Popconfirm, Select, Tag, message } from "@/vue/ui";
import { ListRowActions } from "@/vue/shared";
import { auditProduct, getAdminProductPage } from '@/api/admin';
import { TradeFilters, TradeList } from '@/components/TradeList';
interface ProductRow {
  id: number;
  productCode: string;
  productName: string;
  sellerName: string;
  categoryName: string;
  variety: string;
  unit: string;
  price: number;
  stockQuantity: number;
  originProvince: string;
  originCity: string;
  publishStatus: string;
  auditor: string;
  auditTime: string;
  auditRemark: string;
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
  published: {
    text: '已发布',
    color: 'success'
  },
  offline: {
    text: '已下架',
    color: 'default'
  },
  rejected: {
    text: '已驳回',
    color: 'error'
  },
  draft: {
    text: '草稿',
    color: 'default'
  }
};

/**
 * 货源审核（PRD 10.2 第二组）。
 *
 * <p>通过 / 驳回都会写审核人、审核时间与审核意见 —— 审核动作不留痕，
 * 事后就没法回答"这条货源是谁放行的"。</p>
 */
const AdminProductAudit = defineComponent({
  name: "AdminProductAudit",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const rows = shallowRef<ProductRow[]>([]);
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
    const publishStatus = shallowRef('pending');
    const setPublishStatus = (next: typeof publishStatus.value | ((previous: typeof publishStatus.value) => typeof publishStatus.value)) => {
      publishStatus.value = typeof next === 'function' ? (next as (previous: typeof publishStatus.value) => typeof publishStatus.value)(publishStatus.value) : next;
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
    const rejecting = shallowRef<ProductRow | null>(null);
    const setRejecting = (next: typeof rejecting.value | ((previous: typeof rejecting.value) => typeof rejecting.value)) => {
      rejecting.value = typeof next === 'function' ? (next as (previous: typeof rejecting.value) => typeof rejecting.value)(rejecting.value) : next;
    };
    const rejectRemark = shallowRef('');
    const setRejectRemark = (next: typeof rejectRemark.value | ((previous: typeof rejectRemark.value) => typeof rejectRemark.value)) => {
      rejectRemark.value = typeof next === 'function' ? (next as (previous: typeof rejectRemark.value) => typeof rejectRemark.value)(rejectRemark.value) : next;
    };
    const load = () => {
      setLoading(true);
      getAdminProductPage({
        pageNum: pageNum.value,
        pageSize: pageSize.value,
        publishStatus: publishStatus.value || undefined,
        keyword: keyword.value || undefined
      }).then((res: {
        code: number;
        data?: {
          records?: ProductRow[];
          total?: number;
        };
        message?: string;
      }) => {
        if (res?.code === 200) {
          setRows(res.data?.records ?? []);
          setTotal(res.data?.total ?? 0);
        } else {
          message.error(res?.message ?? '加载货源失败');
        }
      }).catch(() => message.error('加载货源失败（检查后端是否在运行）')).finally(() => setLoading(false));
    };
    onMounted(() => {
      watch(() => [pageNum.value, pageSize.value, publishStatus.value, keyword.value], (_next, _previous, onCleanup) => {
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
      setPublishStatus(draftStatus.value);
      setKeyword(draftKeyword.value.trim());
    };
    const handleReset = () => {
      setDraftStatus('pending');
      setDraftKeyword('');
      setPageNum(1);
      setPublishStatus('pending');
      setKeyword('');
    };
    const handleAudit = async (row: ProductRow, approved: boolean, remark?: string) => {
      const res = await auditProduct(row.id, approved, remark);
      if (res?.code === 200) {
        message.success(approved ? '已通过，货源对买家可见' : '已驳回');
        setRejecting(null);
        setRejectRemark('');
        load();
      } else {
        message.error(res?.message ?? '审核失败');
      }
    };
    return () => {
      const view_rejecting = rejecting.value;
      return <div style={{
        padding: 20
      }}>
      <TradeList listId="admin-product" rowKey="id" loading={loading.value} dataSource={rows.value} onRefresh={load} toolbarLeft={<span style={{
          fontWeight: 600
        }}>货源审核（共 {total.value} 条）</span>} filterSlot={<TradeFilters loading={loading.value} onQuery={handleQuery} onReset={handleReset} fields={[{
          label: '审核状态',
          control: <Select value={draftStatus.value} onChange={value => {
            setDraftStatus(value);
            setPageNum(1);
            setPublishStatus(value);
          }} options={[{
            value: 'pending',
            label: '待审核'
          }, {
            value: 'published',
            label: '已发布'
          }, {
            value: 'offline',
            label: '已下架'
          }, {
            value: 'rejected',
            label: '已驳回'
          }, {
            value: 'draft',
            label: '草稿'
          }, {
            value: '',
            label: '全部状态'
          }]} />
        }, {
          label: '关键字',
          control: <Input allowClear value={draftKeyword.value} placeholder="货源名称 / 编码 / 供应商" onChange={e => setDraftKeyword(e.target.value ?? '')} onPressEnter={handleQuery} />
        }]} />} pagination={{
          current: pageNum.value,
          pageSize: pageSize.value,
          total: total.value,
          onChange: (page, size) => {
            setPageNum(page);
            setPageSize(size);
          }
        }} columns={[{
          title: '货源编码',
          dataIndex: 'productCode',
          width: 150,
          ellipsis: true
        }, {
          title: '货源名称',
          dataIndex: 'productName',
          width: 200,
          ellipsis: true
        }, {
          title: '供应商',
          dataIndex: 'sellerName',
          width: 150,
          ellipsis: true
        }, {
          title: '品类',
          dataIndex: 'categoryName',
          width: 90,
          ellipsis: true
        }, {
          title: '品种',
          dataIndex: 'variety',
          width: 110,
          ellipsis: true
        }, {
          title: '单价',
          dataIndex: 'price',
          width: 110,
          render: (val: number, row: ProductRow) => `¥${val}/${row.unit}`
        }, {
          title: '产地',
          key: 'origin',
          width: 130,
          ellipsis: true,
          render: (_: unknown, row: ProductRow) => [row.originProvince, row.originCity].filter(Boolean).join(' ') || '—'
        }, {
          title: '状态',
          dataIndex: 'publishStatus',
          width: 104,
          render: (val: string) => {
            const tag = STATUS[val] ?? {
              text: val,
              color: 'default'
            };
            return <Tag color={tag.color}>{tag.text}</Tag>;
          }
        }, {
          title: '审核痕迹',
          key: 'auditTrace',
          width: 200,
          ellipsis: true,
          render: (_: unknown, row: ProductRow) => row.auditor ? `${row.auditor} / ${row.auditTime ?? ''}${row.auditRemark ? ' / ' + row.auditRemark : ''}` : '—'
        }, {
          title: '操作',
          key: 'action',
          width: 140,
          render: (_: unknown, row: ProductRow) => row.publishStatus === 'pending' ? <ListRowActions>
                  <Popconfirm title="通过后该货源对买家可见，确认？" onConfirm={() => handleAudit(row, true)}>
                    <Button type="link" size="small">通过</Button>
                  </Popconfirm>
                  <Button type="link" size="small" danger onClick={() => setRejecting(row)}>驳回</Button>
                </ListRowActions> : <span style={{
            color: '#a0aec0'
          }}>已处理</span>
        }]} />

      <Modal open={Boolean(view_rejecting)} title={`驳回货源：${view_rejecting?.productName ?? ''}`} onCancel={() => setRejecting(null)} onOk={() => handleAudit(view_rejecting as ProductRow, false, rejectRemark.value)} okText="确认驳回" okButtonProps={{
          danger: true
        }}>
        <Input.TextArea rows={3} value={rejectRemark.value} onChange={e => setRejectRemark(e.target.value ?? '')} placeholder="请填写驳回原因（会作为审核意见留给供应商）" />
      </Modal>
    </div>;
    };
  }
});
export default AdminProductAudit;
