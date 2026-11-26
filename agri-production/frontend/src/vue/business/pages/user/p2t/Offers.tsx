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
import ListRowActions from '@/vue/business/components/ListRowActions';
import '@/components/ProductionDetailCompact.css';
import '@/components/ProductionListDense.css';
import ProTable from '@/vue/ProductionRequestTable';
import { PageContainer } from '@/vue/pro';
import DetailInfoGrid from '@/vue/business/components/DetailInfoGrid';
import SectionCard from '@/vue/business/components/SectionCard';
import OfferSubscriptionFlows from './OfferSubscriptionFlows';
/**
 * 页面名称：供给意向发布
 * 路由路径：/production/p2t/offers
 * 所属模块：产销对接
 *
 * 供给意向只说「有什么、有多少、什么时候能出、什么等级」，不说价格。
 * 价格参考区间仅内部可见，不对外、不参与撮合。
 */

import { Alert, App as AntdApp, Button, Drawer, Spin, Popconfirm, Space, Tag, Typography } from '@/vue/ui';
import { ModalForm, ProFormDatePicker, ProFormDigit, ProFormSelect, ProFormTextArea } from '@/vue/pro';
import type { ActionType, ProColumns } from '@/vue/pro';
import { useMutation, useQuery } from '@/vue/query';
import { CloseCircleOutlined, DeleteOutlined, EditOutlined, PlusOutlined, SendOutlined } from '@ant-design/icons-vue';
import { useNavigate, useSearchParams } from '@/vue/router';
import dayjs from 'dayjs';
import { getP2tOffer, closeP2tOffer, createP2tOffer, listP2tBatches, listP2tOffers, listVarietyMapsOfCrop, removeP2tOffer, submitP2tOffer, updateP2tOffer } from '@/api/p2t';
import type { P2tBatchRow, P2tOffer, P2tOfferPayload } from '@/api/p2t';
import useAuthStore from '@/vue/authStore';
import { SCROLL_BY_CONTENT } from '@/components/tableScroll';
const AUDIT_TAG: Record<string, {
  text: string;
  color: string;
}> = {
  PENDING: {
    text: '待承接',
    color: 'orange'
  },
  APPROVED: {
    text: '已承接',
    color: 'green'
  },
  REJECTED: {
    text: '已驳回',
    color: 'red'
  }
};
const TRADE_TAG: Record<string, {
  text: string;
  color: string;
}> = {
  PENDING: {
    text: '待建品',
    color: 'default'
  },
  LISTED: {
    text: '已上架',
    color: 'green'
  },
  SOLD: {
    text: '已售罄',
    color: 'blue'
  },
  CLOSED: {
    text: '已关闭',
    color: 'default'
  }
};
interface OfferFormValue extends P2tOfferPayload {
  batchId?: number;
  windowStartText?: string;
  windowEndText?: string;
}
const P2tOffers = defineComponent({
  name: "P2tOffers",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const {
      message
    } = AntdApp.useApp();
    const subjectId = useAuthStore(state => state.userInfo?.tenantId);
    const previousSubjectId = shallowRef(subjectId.value);
    const actionRef = shallowRef<ActionType | null>(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const linkedBatchId = computed(() => searchParams.value.get('batchId') || undefined);
    const linkedSubjectId = computed(() => searchParams.value.get('subjectId'));
    const invalidBatch = computed(() => !!linkedBatchId.value && !/^[1-9]\d{0,18}$/.test(linkedBatchId.value));
    const subjectMismatch = computed(() => !!linkedSubjectId.value && String(subjectId.value) !== linkedSubjectId.value);
    const linkBlocked = computed(() => invalidBatch.value || subjectMismatch.value);
    const clearBatchFilter = () => {
      const next = new URLSearchParams(searchParams.value);
      next.delete('batchId');
      next.delete('subjectId');
      next.delete('create');
      setSearchParams(next);
    };
    const detailTarget = shallowRef<{
      offerNo: string;
      subjectId: typeof subjectId.value;
    } | null>(null);
    const setDetailTarget = (next: typeof detailTarget.value | ((previous: typeof detailTarget.value) => typeof detailTarget.value)) => {
      detailTarget.value = typeof next === 'function' ? (next as (previous: typeof detailTarget.value) => typeof detailTarget.value)(detailTarget.value) : next;
    };
    const detailVisible = computed(() => !!detailTarget.value && detailTarget.value.subjectId === subjectId.value && !linkBlocked.value);
    const detailQuery = useQuery(() => ({
      queryKey: ['p2t-offer-detail', subjectId.value, detailTarget.value?.offerNo],
      enabled: detailVisible.value && !!subjectId.value,
      queryFn: () => getP2tOffer(detailTarget.value!.offerNo),
      staleTime: 0
    }));
    const detail = computed(() => detailVisible.value && !detailQuery.isError ? detailQuery.data : undefined);
    const openDetail = (row: P2tOffer) => setDetailTarget({
      offerNo: row.offerNo,
      subjectId: subjectId.value
    });
    onMounted(() => {
      watch(() => [searchParams.value, subjectId.value, linkBlocked.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          const offerNo = searchParams.value.get('offerNo');
          if (offerNo && subjectId.value && !linkBlocked.value) setDetailTarget({
            offerNo,
            subjectId: subjectId.value
          });
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const quantity = (value: number | undefined, unit?: string) => value == null ? '—' : `${value} ${unit || ''}`.trim();
    const ratio = (value?: number) => value == null ? '—' : `${value}%`;
    const formOpen = shallowRef<boolean>(false);
    const setFormOpen = (next: typeof formOpen.value | ((previous: typeof formOpen.value) => typeof formOpen.value)) => {
      formOpen.value = typeof next === 'function' ? (next as (previous: typeof formOpen.value) => typeof formOpen.value)(formOpen.value) : next;
    };
    const editing = shallowRef<P2tOffer | null>(null);
    const setEditing = (next: typeof editing.value | ((previous: typeof editing.value) => typeof editing.value)) => {
      editing.value = typeof next === 'function' ? (next as (previous: typeof editing.value) => typeof editing.value)(editing.value) : next;
    };
    const batchId = shallowRef<number | undefined>(undefined);
    const setBatchId = (next: typeof batchId.value | ((previous: typeof batchId.value) => typeof batchId.value)) => {
      batchId.value = typeof next === 'function' ? (next as (previous: typeof batchId.value) => typeof batchId.value)(batchId.value) : next;
    };
    const batchQuery = useQuery(() => ({
      queryKey: ['p2t-offer-batches', subjectId.value],
      queryFn: async () => {
        const rows: P2tBatchRow[] = [];
        for (let pageNum = 1;; pageNum++) {
          const page = await listP2tBatches({
            pageNum,
            pageSize: 200
          });
          rows.push(...page.list);
          if (!page.list.length || rows.length >= page.total) return {
            ...page,
            list: rows
          };
        }
      }
    }));
    const batches = computed(() => batchQuery.data?.list ?? []);
    const selectedBatch = computed(() => batches.value.find(b => b.batchId === batchId.value) as P2tBatchRow | undefined);
    const mapQuery = useQuery(() => ({
      queryKey: ['p2t-crop-maps', subjectId.value, selectedBatch.value?.cropId, selectedBatch.value?.cropName],
      queryFn: () => listVarietyMapsOfCrop({
        cropId: selectedBatch.value?.cropId,
        cropName: selectedBatch.value?.cropName
      }),
      enabled: !!selectedBatch.value
    }));
    const categoryOptions = computed(() => (mapQuery.data ?? []).map(m => ({
      value: m.categoryCode,
      label: `${m.categoryName ?? m.categoryCode}（${m.categoryCode}）`
    })));

    // 从批次页跳转过来：?batchId=..&create=1 直接打开发布弹窗
    onMounted(() => {
      watch(() => [searchParams.value, linkBlocked.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          const raw = searchParams.value.get('batchId');
          if (raw && !linkBlocked.value && searchParams.value.get('create') === '1') {
            setBatchId(Number(raw));
            setEditing(null);
            setFormOpen(true);
          }
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    onMounted(() => {
      watch(() => [subjectId.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          if (previousSubjectId.value === subjectId.value) return;
          previousSubjectId.value = subjectId.value;
          setFormOpen(false);
          setEditing(null);
          setDetailTarget(null);
          setBatchId(undefined);
          void actionRef.value?.reload();
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const reload = () => {
      void batchQuery.refetch();
      return actionRef.value?.reload();
    };
    const createMutation = useMutation(() => ({
      mutationFn: (values: OfferFormValue) => createP2tOffer(values),
      onSuccess: () => {
        message.success('供给意向已发布，等待供应商在交易撮合平台承接');
        setFormOpen(false);
        setEditing(null);
        reload();
      },
      onError: (e: Error) => {
        message.error(e.message || '发布失败');
        void batchQuery.refetch();
      }
    }));
    const updateMutation = useMutation(() => ({
      mutationFn: ({
        id,
        values
      }: {
        id: number;
        values: OfferFormValue;
      }) => updateP2tOffer(id, values),
      onSuccess: () => {
        message.success('供给单已变更并再次发布');
        setFormOpen(false);
        setEditing(null);
        reload();
      },
      onError: (e: Error) => {
        message.error(e.message || '变更失败');
        void batchQuery.refetch();
      }
    }));
    const submitMutation = useMutation(() => ({
      mutationFn: (id: number) => submitP2tOffer(id),
      onSuccess: () => {
        message.success('已再次发布');
        reload();
      },
      onError: (e: Error) => message.error(e.message || '提交失败')
    }));
    const closeMutation = useMutation(() => ({
      mutationFn: (id: number) => closeP2tOffer(id),
      onSuccess: () => {
        message.success('供给单已关闭');
        reload();
      },
      onError: (e: Error) => message.error(e.message || '关闭失败')
    }));
    const removeMutation = useMutation(() => ({
      mutationFn: (id: number) => removeP2tOffer(id),
      onSuccess: () => {
        message.success('供给单已删除');
        reload();
      },
      onError: (e: Error) => message.error(e.message || '删除失败')
    }));
    const columns = computed<ProColumns<P2tOffer>[]>(() => [{
      title: '供给单号',
      dataIndex: 'offerNo',
      width: 170,
      fixed: 'left',
      render: (_, row) => <Button type="link" size="small" onClick={() => openDetail(row)}>{row.offerNo}</Button>
    }, {
      title: '品种 / 批次',
      search: false,
      render: (_, row) => <div>
          <b>{row.cropName}{row.varietyName ? `·${row.varietyName}` : ''}</b>
          <div><Button type="link" size="small" onClick={() => navigate(`/production/harvests/${row.batchId}`)}>{row.batchNo || '查看采收批次'}</Button> · {row.categoryName}</div>
        </div>
    }, {
      title: '可供量',
      dataIndex: 'availableQty',
      search: false,
      align: 'right',
      width: 110,
      render: (v, r) => `${v} ${r.unit}`
    }, {
      title: '已认购',
      dataIndex: 'reservedQty',
      search: false,
      align: 'right',
      width: 110,
      render: (v, r) => `${v} ${r.unit}`
    }, {
      title: '等级结构',
      search: false,
      width: 150,
      render: (_, r) => `${r.gradeARatio ?? 0}% / ${r.gradeBRatio ?? 0}% / ${r.gradeCRatio ?? 0}%`
    }, {
      title: '上市窗口',
      search: false,
      width: 180,
      render: (_, r) => r.windowStart ? `${r.windowStart} ~ ${r.windowEnd}` : '—'
    }, {
      title: '承接状态',
      dataIndex: 'auditStatus',
      valueType: 'select',
      valueEnum: {
        PENDING: '待承接',
        APPROVED: '已承接',
        REJECTED: '已驳回'
      },
      width: 100,
      render: (_, row) => <Tag color={AUDIT_TAG[row.auditStatus]?.color}>{AUDIT_TAG[row.auditStatus]?.text ?? row.auditStatus}</Tag>
    }, {
      title: '交易状态',
      dataIndex: 'tradeStatus',
      search: false,
      width: 100,
      render: (_, row) => <Tag color={TRADE_TAG[row.tradeStatus]?.color}>{TRADE_TAG[row.tradeStatus]?.text ?? row.tradeStatus}</Tag>
    }, {
      title: '商品',
      search: false,
      width: 150,
      render: (_, row) => row.productCode ? <div><div>{row.productName}</div><Typography.Text type="secondary" style={{
          fontSize: 12
        }}>{row.productCode}</Typography.Text></div> : '—'
    }, {
      title: '操作',
      key: 'option',
      valueType: 'option',
      search: false,
      width: 150,
      fixed: 'right',
      render: (_, row) => <ListRowActions>
          <Button key="detail" size="small" type="link" onClick={() => openDetail(row)}>详情</Button>
          {row.tradeStatus === 'PENDING' && row.auditStatus === 'REJECTED' ? <Button key="resubmit" size="small" type="link" icon={<SendOutlined />} onClick={() => submitMutation.mutate(row.id)}>重新提交</Button> : null}
          {row.tradeStatus === 'PENDING' ? <Button key="edit" size="small" type="link" icon={<EditOutlined />} onClick={() => {
          setEditing(row);
          setBatchId(row.batchId);
          setFormOpen(true);
        }}>变更</Button> : null}
          {row.tradeStatus === 'PENDING' ? <Popconfirm key="close" title="关闭供给单？" onConfirm={() => closeMutation.mutate(row.id)}>
              <Button size="small" type="link" danger icon={<CloseCircleOutlined />}>关闭</Button>
            </Popconfirm> : null}
          {row.reservedQty > 0 || !['PENDING', 'CLOSED'].includes(row.tradeStatus) ? null : <Popconfirm key="delete" title="删除供给单？" onConfirm={() => removeMutation.mutate(row.id)}>
              <Button size="small" type="link" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>}
        </ListRowActions>
    }]);
    return () => {
      const _detailSnapshot = detail.value;
      return <PageContainer class="production-list-dense production-member-list" title="供给意向">
    <>
      {linkedBatchId.value && <Alert style={{
            marginBottom: 16
          }} type={linkBlocked.value ? 'warning' : 'info'} showIcon message={invalidBatch.value ? '采收批次参数无效，请清除筛选后重试' : subjectMismatch.value ? '当前经营主体已变化，请切回原主体查看关联供给，或清除批次筛选' : `当前仅显示采收批次 ${batches.value.find(b => String(b.batchId) === linkedBatchId.value)?.batchNo ?? linkedBatchId.value} 的关联供给（含已关闭、已驳回）`} action={<Space>
          {!linkBlocked.value && <Button size="small" onClick={() => navigate(`/production/harvests/${linkedBatchId.value}`)}>返回采收详情</Button>}
          <Button size="small" onClick={clearBatchFilter}>清除批次筛选</Button>
        </Space>} />}
      {!linkBlocked.value && <ProTable memberListToolbar actionRef={actionRef} class="p2t-scroll-table" headerTitle={false} tableAlertRender={false} key={`${subjectId.value}-${linkedBatchId.value ?? "all"}`} columnWidthStorageKey="p2t-offers" params={{
            subjectId: subjectId.value,
            batchId: linkedBatchId.value
          }} rowKey="offerNo" columns={columns.value} scroll={SCROLL_BY_CONTENT} search={{
            labelWidth: 'auto',
            layout: 'vertical'
          }} rowSelection={{}} pagination={{
            defaultPageSize: 20,
            showSizeChanger: true
          }} request={async params => {
            const res = await listP2tOffers({
              batchId: params.batchId as string | undefined,
              pageNum: params.current ?? 1,
              pageSize: params.pageSize ?? 20,
              keyword: params.offerNo as string || params.keyword as string || undefined,
              auditStatus: params.auditStatus as string | undefined
            });
            return {
              data: res.list,
              total: res.total,
              success: true
            };
          }} toolbar={{
            title: <Space size={8} wrap>
              <Button key="add" type="primary" icon={<PlusOutlined />} onClick={() => {
                setEditing(null);
                setBatchId(linkedBatchId.value ? Number(linkedBatchId.value) : undefined);
                setFormOpen(true);
              }}>新建供给意向</Button>
            </Space>
          }} toolBarRender={false} />}

      <Drawer rootClassName="production-detail-compact production-detail-dialog" title="供给详情" width="min(920px, 100vw)" open={detailVisible.value} onClose={() => setDetailTarget(null)} destroyOnClose extra={<Button loading={detailQuery.isFetching} onClick={() => void detailQuery.refetch()}>刷新</Button>}>
        {detailQuery.isError ? <Alert type="error" showIcon message="供给详情加载失败" description={detailQuery.error instanceof Error ? detailQuery.error.message : '请稍后重试'} action={<Button onClick={() => void detailQuery.refetch()}>重试</Button>} /> : <Spin spinning={detailQuery.isFetching}>
            {_detailSnapshot && <Space direction="vertical" size={12} style={{
                width: '100%'
              }}>
              <SectionCard title="供给与来源" extra={<Button onClick={() => {
                  setDetailTarget(null);
                  navigate(`/production/harvests/${_detailSnapshot.batchId}`);
                }}>查看采收详情</Button>}>
                <DetailInfoGrid items={[{
                    label: '供给单号',
                    value: <Typography.Text copyable>{_detailSnapshot.offerNo}</Typography.Text>
                  }, {
                    label: '采收批次',
                    value: _detailSnapshot.batchNo
                  }, {
                    label: '作物 / 品种',
                    value: [_detailSnapshot.cropName, _detailSnapshot.varietyName].filter(Boolean).join(' / ')
                  }, {
                    label: '交易品类',
                    value: _detailSnapshot.categoryName
                  }, {
                    label: '农场',
                    value: _detailSnapshot.farmName
                  }, {
                    label: '产地',
                    value: _detailSnapshot.origin
                  }, {
                    label: '供给总量',
                    value: quantity(_detailSnapshot.availableQty, _detailSnapshot.unit)
                  }, {
                    label: '已认购量',
                    value: quantity(_detailSnapshot.reservedQty, _detailSnapshot.unit)
                  }, {
                    label: '未认购意向量',
                    value: quantity(_detailSnapshot.remainingQty, _detailSnapshot.unit)
                  }, {
                    label: '起订量',
                    value: quantity(_detailSnapshot.minOrderQty, _detailSnapshot.unit)
                  }]} />
              </SectionCard>
              <SectionCard title="交付与质量">
                <DetailInfoGrid items={[{
                    label: '交割方式',
                    value: ({
                      ORIGIN: '产地自提',
                      WAREHOUSE: '送到指定仓',
                      PLATFORM: '平台统仓'
                    } as Record<string, string>)[_detailSnapshot.deliveryType || ''] || _detailSnapshot.deliveryType
                  }, {
                    label: '上市窗口',
                    value: _detailSnapshot.windowStart || _detailSnapshot.windowEnd ? `${_detailSnapshot.windowStart || '—'} 至 ${_detailSnapshot.windowEnd || '—'}` : undefined
                  }, {
                    label: '一级占比',
                    value: ratio(_detailSnapshot.gradeARatio)
                  }, {
                    label: '二级占比',
                    value: ratio(_detailSnapshot.gradeBRatio)
                  }, {
                    label: '等外占比',
                    value: ratio(_detailSnapshot.gradeCRatio)
                  }, {
                    label: '质检编号',
                    value: _detailSnapshot.qualityNo
                  }, {
                    label: '质检有效期',
                    value: _detailSnapshot.qualityValidUntil
                  }, {
                    label: '溯源码段',
                    value: _detailSnapshot.traceCodeSeg
                  }, {
                    label: '内部参考价格区间',
                    value: _detailSnapshot.priceRefMin == null && _detailSnapshot.priceRefMax == null ? undefined : `${_detailSnapshot.priceRefMin ?? '—'} ～ ${_detailSnapshot.priceRefMax ?? '—'}`
                  }, {
                    label: '备注',
                    value: _detailSnapshot.remark,
                    fullWidth: true
                  }]} />
              </SectionCard>
              <SectionCard title="审核与商品">
                <DetailInfoGrid items={[{
                    label: '承接状态',
                    value: <Tag color={AUDIT_TAG[_detailSnapshot.auditStatus]?.color}>{AUDIT_TAG[_detailSnapshot.auditStatus]?.text || _detailSnapshot.auditStatus}</Tag>
                  }, {
                    label: '交易状态',
                    value: <Tag color={TRADE_TAG[_detailSnapshot.tradeStatus]?.color}>{TRADE_TAG[_detailSnapshot.tradeStatus]?.text || _detailSnapshot.tradeStatus}</Tag>
                  }, {
                    label: '审核人',
                    value: _detailSnapshot.auditor
                  }, {
                    label: '审核时间',
                    value: _detailSnapshot.auditTime
                  }, {
                    label: '承接反馈',
                    value: _detailSnapshot.auditRemark,
                    fullWidth: true
                  }, {
                    label: '商品名称',
                    value: _detailSnapshot.productName
                  }, {
                    label: '商品编码',
                    value: _detailSnapshot.productCode
                  }, {
                    label: '上架数量',
                    value: quantity(_detailSnapshot.listedQty, _detailSnapshot.unit)
                  }, {
                    label: '上架时间',
                    value: _detailSnapshot.listedTime
                  }, {
                    label: '发布时间',
                    value: _detailSnapshot.publishTime
                  }, {
                    label: '创建时间',
                    value: _detailSnapshot.createTime
                  }]} />
              </SectionCard>
              <OfferSubscriptionFlows key={`${subjectId.value}:${_detailSnapshot.offerNo}`} offerNo={_detailSnapshot.offerNo} unit={_detailSnapshot.unit} subjectId={String(subjectId.value)} />
            </Space>}
          </Spin>}
      </Drawer>
      <ModalForm title={editing.value ? `变更供给意向 ${editing.value.offerNo}` : '新建供给意向'} open={formOpen.value} onOpenChange={open => {
            setFormOpen(open);
            if (!open) {
              setEditing(null);
              setBatchId(undefined);
            }
          }} initialValues={editing.value ? {
            batchId: editing.value.batchId,
            categoryCode: editing.value.categoryCode,
            availableQty: editing.value.availableQty,
            minOrderQty: editing.value.minOrderQty,
            deliveryType: editing.value.deliveryType,
            windowStartText: editing.value.windowStart,
            windowEndText: editing.value.windowEnd,
            gradeARatio: editing.value.gradeARatio,
            gradeBRatio: editing.value.gradeBRatio,
            gradeCRatio: editing.value.gradeCRatio,
            priceRefMin: editing.value.priceRefMin,
            priceRefMax: editing.value.priceRefMax,
            remark: editing.value.remark
          } : {
            batchId: batchId.value,
            deliveryType: 'WAREHOUSE'
          }} modalProps={{
            className: "production-form-dialog",
            destroyOnClose: true,
            width: 760
          }} onFinish={async values => {
            if (useAuthStore.getState().userInfo?.tenantId !== subjectId.value) {
              message.error('经营主体已切换，请重新填写');
              return false;
            }
            if (!values.availableQty || values.availableQty <= 0) {
              message.error('可供量必须大于 0');
              return false;
            }
            if (!selectedBatch.value || selectedBatch.value.stockUnitMismatch) {
              message.error('请重新选择批次并核对库存单位');
              return false;
            }
            const ownOccupied = editing.value ? editing.value.auditStatus === 'REJECTED' ? editing.value.reservedQty : Math.max(editing.value.availableQty, editing.value.reservedQty) : 0;
            const maxSupply = Math.max(0, selectedBatch.value.availableStockQty - selectedBatch.value.publishedQty + ownOccupied);
            if (values.availableQty > maxSupply) {
              message.error(`现货可供量不能超过 ${maxSupply} ${selectedBatch.value.unit}`);
              return false;
            }
            if ((values.minOrderQty ?? 0) > values.availableQty) {
              message.error('起订量不能超过可供量');
              return false;
            }
            const ratioTotal = (values.gradeARatio ?? 0) + (values.gradeBRatio ?? 0) + (values.gradeCRatio ?? 0);
            if (ratioTotal !== 0 && Math.abs(ratioTotal - 100) > 0.000001) {
              message.error('等级占比合计必须为 100%');
              return false;
            }
            if (values.priceRefMin != null && values.priceRefMax != null && values.priceRefMin > values.priceRefMax) {
              message.error('参考价下限不能高于上限');
              return false;
            }
            if (values.windowStartText && values.windowEndText && dayjs(values.windowEndText).isBefore(dayjs(values.windowStartText), 'day')) {
              message.error('上市窗口结束日不能早于开始日');
              return false;
            }
            const payload: OfferFormValue = {
              ...values,
              windowStart: values.windowStartText ? dayjs(values.windowStartText as unknown as dayjs.Dayjs).format('YYYY-MM-DD') : undefined,
              windowEnd: values.windowEndText ? dayjs(values.windowEndText as unknown as dayjs.Dayjs).format('YYYY-MM-DD') : undefined
            };
            try {
              if (editing.value) await updateMutation.mutateAsync({
                id: editing.value.id,
                values: payload
              });else await createMutation.mutateAsync(payload);
              return true;
            } catch {
              // 错误由 mutation 提示；保留弹窗和用户输入，便于修正后重试。
              return false;
            }
          }}>
        <ProFormSelect name="batchId" label="采收批次" options={batches.value.filter(b => b.publishable || b.batchId === editing.value?.batchId).map(b => ({
              value: b.batchId,
              label: `${b.batchNo} · ${b.cropName} · 现货可发布 ${b.publishableQty} ${b.unit}`
            }))} rules={[{
              required: true,
              message: '请选择批次'
            }]} showSearch disabled={!!editing.value} fieldProps={{
              onChange: (value: number) => setBatchId(value)
            }} />
        {selectedBatch.value && <Typography.Paragraph type="secondary" style={{
              marginTop: -8
            }}>
            当前库存 {selectedBatch.value.stockQty} {selectedBatch.value.unit} · 冻结 {selectedBatch.value.frozenQty} · 过期未冻结 {selectedBatch.value.unusableQty} · 库存可用 {selectedBatch.value.availableStockQty} · 供给占用 {selectedBatch.value.publishedQty} · 现货可发布 {selectedBatch.value.publishableQty}
            {!selectedBatch.value.qualityJudged && ' · 质检未判定（承接方通常会要求先出质检结论）'}
          </Typography.Paragraph>}
        <ProFormSelect name="categoryCode" label="交易品类" options={categoryOptions.value} rules={[{
              required: !editing.value,
              message: '请选择交易品类'
            }]} placeholder="先选择批次，再选择品类" showSearch disabled={!!editing.value} />
        <ProFormDigit name="availableQty" label="可供量" min={0} rules={[{
              required: true,
              message: '请填写可供量'
            }]} fieldProps={{
              precision: 1
            }} />
        <ProFormDigit name="minOrderQty" label="起订量" min={0} fieldProps={{
              precision: 1
            }} />
        <ProFormSelect name="deliveryType" label="交割方式" options={[{
              value: 'ORIGIN',
              label: '产地自提'
            }, {
              value: 'WAREHOUSE',
              label: '送到指定仓'
            }, {
              value: 'PLATFORM',
              label: '平台统仓'
            }]} />
        <ProFormDatePicker name="windowStartText" label="上市窗口起" fieldProps={{
              style: {
                width: '100%'
              }
            }} />
        <ProFormDatePicker name="windowEndText" label="上市窗口止" fieldProps={{
              style: {
                width: '100%'
              }
            }} />
        <Space>
          <ProFormDigit name="gradeARatio" label="一级占比 %" min={0} max={100} width="xs" />
          <ProFormDigit name="gradeBRatio" label="二级占比 %" min={0} max={100} width="xs" />
          <ProFormDigit name="gradeCRatio" label="等外占比 %" min={0} max={100} width="xs" />
        </Space>
        <Space>
          <ProFormDigit name="priceRefMin" label="参考价下限" min={0} width="sm" />
          <ProFormDigit name="priceRefMax" label="参考价上限" min={0} width="sm" />
          <Typography.Text type="secondary" style={{
                fontSize: 12
              }}>
            仅内部参考，不对外、不参与撮合（定价权归交易端）
          </Typography.Text>
        </Space>
        <ProFormTextArea name="remark" label="备注" />
      </ModalForm>
    </>
    </PageContainer>;
    };
  }
});
export default P2tOffers;
