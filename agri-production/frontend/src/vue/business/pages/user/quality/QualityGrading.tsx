import ProductionListFilters from '@/vue/business/components/ProductionListFilters';
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
import '@/components/ProductionDetailCompact.css';
import '@/components/ProductionListDense.css';
import '@/components/ProductionTable.css';
import { useQuery } from '@/vue/query';
import { getP2tOffer, listP2tDiffs } from '@/api/p2t';
import { Alert, App, Button, Card, Drawer, Form, Input, Modal, Select, Space, Tabs, Tag } from '@/vue/ui';
import { useNavigate, useSearchParams } from '@/vue/router';
import type { ActionType } from '@/vue/pro';
import { applyGradeReview, decideGradeReview, pageGradeReviews, fetchInspectionPage } from '@/api/quality';
import type { GradeReview } from '@/api/quality';
import DetailInfoGrid from '@/vue/business/components/DetailInfoGrid';
import ListRowActions from '@/vue/business/components/ListRowActions';
import type { ProColumns } from '@/vue/pro';
import { PageContainer } from '@/vue/pro';
import ProTable from '@/vue/ProductionRequestTable';
import { SCROLL_BY_CONTENT } from '@/components/tableScroll';
import { listHarvests } from '@/api/harvests';
import useFarmStore from '@/vue/farmStore';
import useAuthStore from '@/vue/authStore';
import type { HarvestBatch, PageResult } from '@/types';

/** 全部分页成功后才提供选项，不将截断列表当作完整结果。 */
async function loadOptions<T>(fetchPage: (page: number) => Promise<PageResult<T>>, signal: AbortSignal): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1;; page++) {
    signal.throwIfAborted();
    const result = await fetchPage(page);
    signal.throwIfAborted();
    rows.push(...result.list);
    if (rows.length >= result.total) return rows;
    if (!result.list.length) throw new Error('选项分页数据不完整，请刷新重试');
  }
}

/** 批次等级是生产事实；浏览器缓存不作为复核结论或审计记录。 */
const QualityGrading = defineComponent({
  name: "QualityGrading",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const farmId = useFarmStore(s => s.currentFarm?.farmId);
    const subjectId = useAuthStore(s => s.userInfo?.tenantId);
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const ticketId = computed(() => params.value.get('ticketId') || undefined);
    const tab = shallowRef(ticketId.value ? 'reviews' : 'batches');
    const setTab = (next: typeof tab.value | ((previous: typeof tab.value) => typeof tab.value)) => {
      tab.value = typeof next === 'function' ? (next as (previous: typeof tab.value) => typeof tab.value)(tab.value) : next;
    };
    const draftBatchKeyword = shallowRef('');
    const setDraftBatchKeyword = (next: typeof draftBatchKeyword.value | ((previous: typeof draftBatchKeyword.value) => typeof draftBatchKeyword.value)) => {
      draftBatchKeyword.value = typeof next === 'function' ? (next as (previous: typeof draftBatchKeyword.value) => typeof draftBatchKeyword.value)(draftBatchKeyword.value) : next;
    };
    const draftBatchGrade = shallowRef<string | undefined>(undefined);
    const setDraftBatchGrade = (next: typeof draftBatchGrade.value | ((previous: typeof draftBatchGrade.value) => typeof draftBatchGrade.value)) => {
      draftBatchGrade.value = typeof next === 'function' ? (next as (previous: typeof draftBatchGrade.value) => typeof draftBatchGrade.value)(draftBatchGrade.value) : next;
    };
    const batchKeyword = shallowRef('');
    const setBatchKeyword = (next: typeof batchKeyword.value | ((previous: typeof batchKeyword.value) => typeof batchKeyword.value)) => {
      batchKeyword.value = typeof next === 'function' ? (next as (previous: typeof batchKeyword.value) => typeof batchKeyword.value)(batchKeyword.value) : next;
    };
    const batchGrade = shallowRef<string | undefined>(undefined);
    const setBatchGrade = (next: typeof batchGrade.value | ((previous: typeof batchGrade.value) => typeof batchGrade.value)) => {
      batchGrade.value = typeof next === 'function' ? (next as (previous: typeof batchGrade.value) => typeof batchGrade.value)(batchGrade.value) : next;
    };
    const draftReviewStatus = shallowRef<string | undefined>(undefined);
    const setDraftReviewStatus = (next: typeof draftReviewStatus.value | ((previous: typeof draftReviewStatus.value) => typeof draftReviewStatus.value)) => {
      draftReviewStatus.value = typeof next === 'function' ? (next as (previous: typeof draftReviewStatus.value) => typeof draftReviewStatus.value)(draftReviewStatus.value) : next;
    };
    const draftReviewKeyword = shallowRef('');
    const setDraftReviewKeyword = (next: typeof draftReviewKeyword.value | ((previous: typeof draftReviewKeyword.value) => typeof draftReviewKeyword.value)) => {
      draftReviewKeyword.value = typeof next === 'function' ? (next as (previous: typeof draftReviewKeyword.value) => typeof draftReviewKeyword.value)(draftReviewKeyword.value) : next;
    };
    const reviewStatus = shallowRef<string | undefined>(undefined);
    const setReviewStatus = (next: typeof reviewStatus.value | ((previous: typeof reviewStatus.value) => typeof reviewStatus.value)) => {
      reviewStatus.value = typeof next === 'function' ? (next as (previous: typeof reviewStatus.value) => typeof reviewStatus.value)(reviewStatus.value) : next;
    };
    const reviewKeyword = shallowRef('');
    const setReviewKeyword = (next: typeof reviewKeyword.value | ((previous: typeof reviewKeyword.value) => typeof reviewKeyword.value)) => {
      reviewKeyword.value = typeof next === 'function' ? (next as (previous: typeof reviewKeyword.value) => typeof reviewKeyword.value)(reviewKeyword.value) : next;
    };
    const selectedBatchKeys = shallowRef<(string | number)[]>([]);
    const setSelectedBatchKeys = (next: typeof selectedBatchKeys.value | ((previous: typeof selectedBatchKeys.value) => typeof selectedBatchKeys.value)) => {
      selectedBatchKeys.value = typeof next === 'function' ? (next as (previous: typeof selectedBatchKeys.value) => typeof selectedBatchKeys.value)(selectedBatchKeys.value) : next;
    };
    const selectedReviewKeys = shallowRef<(string | number)[]>([]);
    const setSelectedReviewKeys = (next: typeof selectedReviewKeys.value | ((previous: typeof selectedReviewKeys.value) => typeof selectedReviewKeys.value)) => {
      selectedReviewKeys.value = typeof next === 'function' ? (next as (previous: typeof selectedReviewKeys.value) => typeof selectedReviewKeys.value)(selectedReviewKeys.value) : next;
    };
    const open = shallowRef(false);
    const setOpen = (next: typeof open.value | ((previous: typeof open.value) => typeof open.value)) => {
      open.value = typeof next === 'function' ? (next as (previous: typeof open.value) => typeof open.value)(open.value) : next;
    };
    const detail = shallowRef<GradeReview | null>(null);
    const setDetail = (next: typeof detail.value | ((previous: typeof detail.value) => typeof detail.value)) => {
      detail.value = typeof next === 'function' ? (next as (previous: typeof detail.value) => typeof detail.value)(detail.value) : next;
    };
    const decision = shallowRef<GradeReview | null>(null);
    const setDecision = (next: typeof decision.value | ((previous: typeof decision.value) => typeof decision.value)) => {
      decision.value = typeof next === 'function' ? (next as (previous: typeof decision.value) => typeof decision.value)(decision.value) : next;
    };
    const busy = shallowRef(false);
    const setBusy = (next: typeof busy.value | ((previous: typeof busy.value) => typeof busy.value)) => {
      busy.value = typeof next === 'function' ? (next as (previous: typeof busy.value) => typeof busy.value)(busy.value) : next;
    };
    const [form] = Form.useForm();
    const [decisionForm] = Form.useForm();
    const actionRef = shallowRef<ActionType | null>(null);
    const {
      message
    } = App.useApp();
    const scope = computed(() => String(subjectId.value ?? ''));
    const current = () => !!scope.value && String(useAuthStore.getState().userInfo?.tenantId ?? '') === scope.value;
    const selectedTicketId = Form.useWatch('ticketId', form);
    const selectedInspectionId = Form.useWatch('inspectionId', form);
    const tickets = useQuery(() => ({
      queryKey: ['grade-review-ticket-options', scope.value, open.value],
      enabled: open.value && !!scope.value,
      retry: false,
      queryFn: async ({
        signal
      }) => (await loadOptions(pageNum => listP2tDiffs({
        pageNum,
        pageSize: 100,
        status: 'PROCESSING',
        diffType: 'GRADE_DOWN'
      }), signal)).filter(row => row.ownerSide === 'PRODUCTION' && row.status === 'PROCESSING' && row.diffType === 'GRADE_DOWN' && row.offerNo && row.orderNo)
    }));
    const selectedTicket = computed(() => tickets.data?.find(row => String(row.id) === selectedTicketId.value));
    const offer = useQuery(() => ({
      queryKey: ['grade-review-offer', scope.value, selectedTicket.value?.offerNo, open.value],
      enabled: open.value && !!scope.value && !!selectedTicket.value?.offerNo,
      retry: false,
      queryFn: () => getP2tOffer(selectedTicket.value!.offerNo!)
    }));
    const batchId = computed(() => offer.data?.batchId == null ? undefined : String(offer.data.batchId));
    const inspections = useQuery(() => ({
      queryKey: ['grade-review-inspection-options', scope.value, selectedTicketId.value, batchId.value, open.value],
      enabled: open.value && !!scope.value && !!selectedTicket.value && !!batchId.value,
      retry: false,
      queryFn: async ({
        signal
      }) => (await loadOptions(pageNum => fetchInspectionPage({
        pageNum,
        pageSize: 100,
        batchId: batchId.value,
        status: 'DONE',
        result: 'PASS'
      }), signal)).filter(row => String(row.batchId) === batchId.value && row.status === 'DONE' && row.result === 'PASS')
    }));
    const selectedInspection = computed(() => inspections.data?.find(row => String(row.inspectionId) === selectedInspectionId.value));
    const selectionBusy = computed(() => tickets.isFetching || offer.isFetching || inspections.isFetching);
    const selectionError = computed(() => tickets.error || offer.error || inspections.error);
    const retrySelection = () => {
      if (tickets.isError) void tickets.refetch();else if (offer.isError) void offer.refetch();else void inspections.refetch();
    };
    onMounted(() => {
      watch(() => [subjectId.value, form, decisionForm], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          setOpen(false);
          setDetail(null);
          setDecision(null);
          form.resetFields();
          decisionForm.resetFields();
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    onMounted(() => {
      watch(() => [ticketId.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          if (ticketId.value) setTab('reviews');
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const save = async (confirm: boolean) => {
      if (busy.value || !current()) return;
      try {
        const values = await (confirm ? decisionForm : form).validateFields();
        if (!confirm && (selectionBusy.value || selectionError.value || !selectedTicket.value || !selectedInspection.value)) {
          message.warning('请先选择有效工单及同批次已完成合格检测单');
          return;
        }
        setBusy(true);
        if (confirm && decision.value) await decideGradeReview(decision.value.id, values as Parameters<typeof decideGradeReview>[1]);else await applyGradeReview(values as Parameters<typeof applyGradeReview>[0]);
        if (!current()) return;
        message.success(confirm ? '复核决定已保存' : '复核申请已保存，请由另一位用户确认');
        setOpen(false);
        setDecision(null);
        actionRef.value?.reload();
      } catch (e) {
        if (current() && e instanceof Error) message.error(e.message);
      } finally {
        setBusy(false);
      }
    };
    const labels = computed<Record<string, string>>(() => ({
      PENDING: '待确认',
      APPROVED: '已通过',
      REJECTED: '已驳回',
      CONSUMED: '已核销关闭工单'
    }));
    const reviewColumns = computed<ProColumns<GradeReview>[]>(() => [{
      title: '复核单号',
      dataIndex: 'reviewNo',
      width: 320,
      copyable: true
    }, {
      title: '工单号',
      dataIndex: 'ticketNo',
      width: 180
    }, {
      title: '原订单',
      dataIndex: 'orderNo',
      width: 190
    }, {
      title: '原等级',
      dataIndex: 'originalGrade',
      width: 90
    }, {
      title: '复核等级',
      dataIndex: 'reviewedGrade',
      width: 100
    }, {
      title: '检测单号',
      dataIndex: 'inspectionNo',
      width: 180
    }, {
      title: '状态',
      dataIndex: 'status',
      width: 160,
      render: (_, row) => <Tag color={row.status === 'APPROVED' || row.status === 'CONSUMED' ? 'green' : row.status === 'REJECTED' ? 'red' : 'orange'}>{labels.value[row.status] || row.status}</Tag>
    }, {
      title: '申请时间',
      dataIndex: 'createTime',
      width: 180
    }, {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      width: 150,
      render: (_, row) => <ListRowActions><Button key="detail" type="link" size="small" onClick={() => setDetail(row)}>详情</Button>{row.status === 'PENDING' && <Button key="confirm" type="link" size="small" onClick={() => {
          decisionForm.resetFields();
          setDecision(row);
        }}>确认</Button>}</ListRowActions>
    }]);
    const columns = computed<ProColumns<HarvestBatch>[]>(() => [{
      title: '采收批次号',
      dataIndex: 'batchNo',
      width: 190,
      copyable: true
    }, {
      title: '作物',
      dataIndex: 'cropName',
      width: 140
    }, {
      title: '地块',
      dataIndex: 'plotName',
      width: 150
    }, {
      title: '采收日期',
      dataIndex: 'harvestDate',
      width: 140
    }, {
      title: '批次等级',
      dataIndex: 'grade',
      width: 110
    }, {
      title: '检测单号（非检测结论）',
      dataIndex: 'inspectionNo',
      width: 200
    }]);
    const handleBatchSearch = () => {
      setBatchKeyword(draftBatchKeyword.value.trim());
      setBatchGrade(draftBatchGrade.value);
    };
    const handleBatchReset = () => {
      setDraftBatchKeyword('');
      setDraftBatchGrade(undefined);
      setBatchKeyword('');
      setBatchGrade(undefined);
    };
    const handleReviewSearch = () => {
      setReviewKeyword(draftReviewKeyword.value.trim());
      setReviewStatus(draftReviewStatus.value);
    };
    const handleReviewReset = () => {
      setDraftReviewKeyword('');
      setDraftReviewStatus(undefined);
      setReviewKeyword('');
      setReviewStatus(undefined);
    };
    return () => {
      const _detailSnapshot = detail.value;
      return <PageContainer class="production-list-dense production-member-list" header={{
        title: '批次等级查询',
        subTitle: '查询正式批次等级，质量合格与否以检测台账为准'
      }}>
    <Space direction="vertical" size={12} style={{
          width: '100%'
        }}>
      <Alert type="info" showIcon message="批次等级与检测结论分别管理" description="等级来自采收批次。正式等级复核请切换复核凭据标签，由另一位用户确认。复核只认定关联工单履约商品等级，不改写批次原值、历史订单或价格。检测合格不能由等级推断；已关联供给的批次继续受后端变更保护。" action={<Button onClick={() => navigate('/production/harvests')}>采收记录</Button>} />
      <Tabs activeKey={tab.value} onChange={setTab} items={[{
            key: 'batches',
            label: '批次等级'
          }, {
            key: 'reviews',
            label: '正式复核凭据'
          }]} />
      {tab.value === 'reviews' && <>
        <Alert type="info" showIcon message="申请 → 双人确认 → 差异工单引用核销" description="仅支持生产侧处理中等级降级工单。关联同批次已完成且合格的检测单，复核等级须低于原等级。不合格检测继续走冻结及召回流程；退款、补差价由交易域另行执行。" />
        <Card class="production-dense-filter-card">
          <ProductionListFilters onSearch={handleReviewSearch} onReset={handleReviewReset}>
            <div class="production-filter-field">
              <label>关键字</label>
              <Input allowClear placeholder="复核单号 / 工单号 / 原订单 / 检测单号" value={draftReviewKeyword.value} onChange={e => setDraftReviewKeyword(e.target.value)}  />
            </div>
            <div class="production-filter-field">
              <label>状态</label>
              <Select allowClear placeholder="全部状态" value={draftReviewStatus.value} onChange={setDraftReviewStatus} options={Object.entries(labels.value).map(([value, label]) => ({
                    value,
                    label
                  }))} />
            </div>
          </ProductionListFilters>
        </Card>
        <ProTable memberListToolbar key={`reviews:${scope.value}:${ticketId.value ?? ''}`} actionRef={actionRef} rowKey="id" columns={reviewColumns.value} search={false} params={{
              subjectId: subjectId.value,
              ticketId: ticketId.value,
              reviewKeyword: reviewKeyword.value,
              reviewStatus: reviewStatus.value
            }} columnWidthStorageKey="quality-grade-reviews" scroll={SCROLL_BY_CONTENT} rowSelection={{
              selectedRowKeys: selectedReviewKeys.value,
              onChange: setSelectedReviewKeys
            }} options={{
              reload: true
            }} pagination={{
              defaultPageSize: 20,
              showSizeChanger: true
            }} toolBarRender={() => [<Button key="apply" type="primary" disabled={!scope.value} onClick={() => {
              form.resetFields();
              form.setFieldsValue({
                ticketId: ticketId.value
              });
              setOpen(true);
            }}>+ 申请等级复核</Button>]} request={async p => {
              if (!current()) return {
                data: [],
                total: 0,
                success: false
              };
              const result = await pageGradeReviews({
                pageNum: p.current ?? 1,
                pageSize: p.pageSize ?? 20,
                ticketId: ticketId.value
              });
              const kw = reviewKeyword.value.trim().toLowerCase();
              const filtered = result.list.filter(row => {
                if (reviewStatus.value && row.status !== reviewStatus.value) return false;
                if (kw) {
                  const hay = `${row.reviewNo ?? ''} ${row.ticketNo ?? ''} ${row.orderNo ?? ''} ${row.inspectionNo ?? ''}`.toLowerCase();
                  if (!hay.includes(kw)) return false;
                }
                return true;
              });
              return current() ? {
                data: filtered,
                total: kw || reviewStatus.value ? filtered.length : result.total,
                success: true
              } : {
                data: [],
                total: 0,
                success: false
              };
            }} />
      </>}
      {tab.value === 'batches' && (!farmId.value ? <Alert type="warning" message="请先选择农场后查询批次等级" /> : <>
        <Card class="production-dense-filter-card">
          <ProductionListFilters onSearch={handleBatchSearch} onReset={handleBatchReset}>
            <div class="production-filter-field">
              <label>关键字</label>
              <Input allowClear placeholder="批次号 / 作物 / 地块 / 检测单号" value={draftBatchKeyword.value} onChange={e => setDraftBatchKeyword(e.target.value)}  />
            </div>
            <div class="production-filter-field">
              <label>批次等级</label>
              <Select allowClear placeholder="全部等级" value={draftBatchGrade.value} onChange={setDraftBatchGrade} options={['特级', '一级', '二级', 'A', 'B', 'C', 'D'].map(v => ({
                    value: v,
                    label: v
                  }))} />
            </div>
          </ProductionListFilters>
        </Card>
        <ProTable memberListToolbar key={`${subjectId.value}:${farmId.value}`} rowKey="batchId" columns={columns.value} params={{
              subjectId: subjectId.value,
              farmId: farmId.value,
              batchKeyword: batchKeyword.value,
              batchGrade: batchGrade.value
            }} columnWidthStorageKey="quality-batch-grades" rowSelection={{
              selectedRowKeys: selectedBatchKeys.value,
              onChange: setSelectedBatchKeys
            }} scroll={SCROLL_BY_CONTENT} search={false} options={{
              reload: true
            }} pagination={{
              defaultPageSize: 20,
              showSizeChanger: true
            }} request={async p => {
              const result = await listHarvests({
                farmId: farmId.value,
                pageNum: p.current ?? 1,
                pageSize: p.pageSize ?? 20
              });
              const kw = batchKeyword.value.trim().toLowerCase();
              const filtered = result.list.filter(row => {
                if (batchGrade.value && row.grade !== batchGrade.value) return false;
                if (kw) {
                  const hay = `${row.batchNo ?? ''} ${row.cropName ?? ''} ${row.plotName ?? ''} ${row.inspectionNo ?? ''}`.toLowerCase();
                  if (!hay.includes(kw)) return false;
                }
                return true;
              });
              return {
                data: filtered,
                total: kw || batchGrade.value ? filtered.length : result.total,
                success: true
              };
            }} />
      </>)}
    </Space>
    <Modal class="production-form-dialog" title="申请正式等级复核" open={open.value} confirmLoading={busy.value} okButtonProps={{
          disabled: selectionBusy.value || !!selectionError.value || !selectedTicket.value || !selectedInspection.value
        }} onCancel={() => {
          if (!busy.value) setOpen(false);
        }} onOk={() => void save(false)}>
      <Form form={form} layout="vertical">
        <Form.Item name="ticketId" label="等级降级工单" rules={[{
              required: true,
              message: '请选择待复核工单'
            }]}>
          <Select showSearch allowClear optionFilterProp="label" loading={tickets.isFetching} placeholder="搜索工单号、订单号或供给单号" onChange={() => form.setFieldsValue({
                inspectionId: undefined,
                reviewedGrade: undefined
              })} options={(tickets.data ?? []).map(row => ({
                value: String(row.id),
                label: `${row.ticketNo} · 订单 ${row.orderNo} · ${row.offerNo}`
              }))} notFoundContent={tickets.isFetching ? '正在加载工单…' : tickets.isError ? '加载失败，请重试' : '暂无生产侧处理中等级降级工单'} />
        </Form.Item>
        {selectedTicketId.value && !tickets.isFetching && !tickets.isError && !selectedTicket.value && <Alert type="warning" showIcon message="原工单已不满足申请条件，请重新选择工单" />}
        {selectedTicket.value && <Alert type="info" showIcon message={offer.isFetching ? '正在解析关联采收批次…' : `关联批次：${offer.data?.batchNo || batchId.value || '未取得'}`} description="仅列出该批次已完成且合格的检测单。切换工单将清空检测依据。" />}
        {selectionError.value && <Alert type="error" showIcon message="检测依据加载失败" description={selectionError.value instanceof Error ? selectionError.value.message : '未取得完整选项，请重试'} action={<Button onClick={retrySelection}>重试</Button>} />}
        <Form.Item name="inspectionId" label="检测依据" rules={[{
              required: true,
              message: '请选择同批次已完成合格检测单'
            }]}>
          <Select showSearch allowClear optionFilterProp="label" loading={inspections.isFetching} disabled={!selectedTicket.value || !batchId.value || !!selectionError.value || offer.isFetching} placeholder={selectedTicket.value ? '搜索检测单号、机构或抽样时间' : '请先选择等级降级工单'} options={(inspections.data ?? []).map(row => ({
                value: String(row.inspectionId),
                label: `${row.inspectionNo || row.inspectionId} · ${row.labName || '未登记机构'} · ${row.sampleAt || '未登记抽样时间'} · 已完成·合格`
              }))} notFoundContent={inspections.isFetching ? '正在加载检测单…' : '该批次暂无已完成且合格的检测单，请先完成质量检测'} />
        </Form.Item>
        {selectedInspection.value && <Alert type="success" showIcon message={`已选检测单：${selectedInspection.value.inspectionNo || selectedInspection.value.inspectionId}`} description={`批次：${selectedInspection.value.batchNo || offer.data?.batchNo || batchId.value}；机构：${selectedInspection.value.labName || '未登记'}；抽样时间：${selectedInspection.value.sampleAt || '未登记'}；已完成·合格。提交时服务端将重新核验。`} />}

        <Form.Item name="reviewedGrade" label="履约商品复核等级" rules={[{
              required: true
            }]}><Select options={['B', 'C', 'D'].map(value => ({
                value,
                label: value
              }))} /></Form.Item>
        <Form.Item name="reason" label="复核依据及适用范围" rules={[{
              required: true,
              whitespace: true
            }]}><Input.TextArea rows={4} maxLength={500} showCount /></Form.Item>
      </Form>
    </Modal>
    <Modal class="production-form-dialog" title={`复核确认 ${decision.value?.reviewNo ?? ''}`} open={!!decision.value} confirmLoading={busy.value} onCancel={() => {
          if (!busy.value) setDecision(null);
        }} onOk={() => void save(true)}>
      <Alert type="info" message="申请人不能确认自己的申请；确认后不可修改。" />
      {decision.value && <p>{decision.value.ticketNo}：{decision.value.originalGrade} → {decision.value.reviewedGrade}；依据：{decision.value.reason}</p>}
      <Form form={decisionForm} layout="vertical">
        <Form.Item name="approved" label="决定" rules={[{
              required: true
            }]}><Select options={[{
                value: true,
                label: '确认通过'
              }, {
                value: false,
                label: '驳回'
              }]} /></Form.Item>
        <Form.Item name="remark" label="确认意见" rules={[{
              required: true,
              whitespace: true
            }]}><Input.TextArea rows={3} maxLength={500} showCount /></Form.Item>
      </Form>
    </Modal>
    <Drawer rootClassName="production-detail-compact production-detail-dialog" title="正式等级复核凭据" open={!!_detailSnapshot} onClose={() => setDetail(null)} width={760}>
      {_detailSnapshot && <DetailInfoGrid items={Object.entries({
            复核单号: _detailSnapshot.reviewNo,
            工单号: _detailSnapshot.ticketNo,
            供给单号: _detailSnapshot.offerNo,
            订单号: _detailSnapshot.orderNo,
            批次ID: _detailSnapshot.batchId,
            原等级: _detailSnapshot.originalGrade,
            复核等级: _detailSnapshot.reviewedGrade,
            检测单号: _detailSnapshot.inspectionNo,
            检测单ID: _detailSnapshot.inspectionId,
            状态: labels.value[_detailSnapshot.status],
            申请人: _detailSnapshot.applicantId,
            确认人: _detailSnapshot.reviewerId,
            申请时间: _detailSnapshot.createTime,
            确认时间: _detailSnapshot.reviewedAt,
            核销时间: _detailSnapshot.consumedAt,
            复核依据: _detailSnapshot.reason,
            确认意见: _detailSnapshot.reviewRemark
          }).map(([label, value]) => ({
            label,
            value,
            fullWidth: ['复核依据', '确认意见'].includes(label)
          }))} />}
    </Drawer>
  </PageContainer>;
    };
  }
});
export default QualityGrading;
