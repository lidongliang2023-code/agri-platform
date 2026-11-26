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
import { useNavigate } from '@/vue/router';
import { App, Alert, Button, Drawer, Input, Modal, Select, Space, Tag } from '@/vue/ui';
import type { ActionType, ProColumns } from '@/vue/pro';
import useAuthStore from '@/vue/authStore';
import ProTable from '@/vue/ProductionRequestTable';
import { PageContainer } from '@/vue/pro';
import DetailInfoGrid from '@/vue/business/components/DetailInfoGrid';
import { handleP2tDiff, listP2tDiffs } from '@/api/p2t';
import type { P2tDiffTicket } from '@/api/p2t';
import { SCROLL_BY_CONTENT } from '@/components/tableScroll';
const TYPES: Record<string, string> = {
  SHORT_SHIP: '短装',
  GRADE_DOWN: '等级降级',
  WINDOW_EXPIRED: '窗口过期',
  OVERSELL: '超卖'
};
const STATUSES: Record<string, string> = {
  OPEN: '待处理',
  PENDING: '待处理',
  PROCESSING: '处理中',
  CLOSED: '已关闭'
};
const OWNERS: Record<string, string> = {
  PRODUCTION: '生产侧',
  TRADE: '交易侧',
  SYSTEM: '系统'
};
const P2tDiffs = defineComponent({
  name: "P2tDiffs",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const navigate = useNavigate();
    const subjectId = useAuthStore(s => s.userInfo?.tenantId);
    const scope = computed(() => String(subjectId.value ?? ''));
    const current = () => !!scope.value && String(useAuthStore.getState().userInfo?.tenantId ?? '') === scope.value;
    const {
      message
    } = App.useApp();
    const elementRef = shallowRef<ActionType | null>(null);
    const selected = shallowRef<P2tDiffTicket | null>(null);
    const setSelected = (next: typeof selected.value | ((previous: typeof selected.value) => typeof selected.value)) => {
      selected.value = typeof next === 'function' ? (next as (previous: typeof selected.value) => typeof selected.value)(selected.value) : next;
    };
    const handling = shallowRef<P2tDiffTicket | null>(null);
    const setHandling = (next: typeof handling.value | ((previous: typeof handling.value) => typeof handling.value)) => {
      handling.value = typeof next === 'function' ? (next as (previous: typeof handling.value) => typeof handling.value)(handling.value) : next;
    };
    const status = shallowRef('PROCESSING');
    const setStatus = (next: typeof status.value | ((previous: typeof status.value) => typeof status.value)) => {
      status.value = typeof next === 'function' ? (next as (previous: typeof status.value) => typeof status.value)(status.value) : next;
    };
    const way = shallowRef('补发');
    const setWay = (next: typeof way.value | ((previous: typeof way.value) => typeof way.value)) => {
      way.value = typeof next === 'function' ? (next as (previous: typeof way.value) => typeof way.value)(way.value) : next;
    };
    const remark = shallowRef('');
    const setRemark = (next: typeof remark.value | ((previous: typeof remark.value) => typeof remark.value)) => {
      remark.value = typeof next === 'function' ? (next as (previous: typeof remark.value) => typeof remark.value)(remark.value) : next;
    };
    const evidenceNo = shallowRef('');
    const setEvidenceNo = (next: typeof evidenceNo.value | ((previous: typeof evidenceNo.value) => typeof evidenceNo.value)) => {
      evidenceNo.value = typeof next === 'function' ? (next as (previous: typeof evidenceNo.value) => typeof evidenceNo.value)(evidenceNo.value) : next;
    };
    const saving = shallowRef(false);
    const setSaving = (next: typeof saving.value | ((previous: typeof saving.value) => typeof saving.value)) => {
      saving.value = typeof next === 'function' ? (next as (previous: typeof saving.value) => typeof saving.value)(saving.value) : next;
    };
    const failed = shallowRef(false);
    const setFailed = (next: typeof failed.value | ((previous: typeof failed.value) => typeof failed.value)) => {
      failed.value = typeof next === 'function' ? (next as (previous: typeof failed.value) => typeof failed.value)(failed.value) : next;
    };
    onMounted(() => {
      watch(() => [subjectId.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          setSelected(null);
          setHandling(null);
          setRemark('');
          setFailed(false);
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const begin = (row: P2tDiffTicket) => {
      setHandling(row);
      setStatus('PROCESSING');
      setWay(row.handleWay || '补发');
      setRemark('');
      setEvidenceNo('');
    };
    const submit = async () => {
      if (!handling.value || !current() || saving.value) return;
      if (!remark.value.trim()) {
        message.warning('请填写处置说明');
        return;
      }
      if (status.value === 'CLOSED' && !evidenceNo.value.trim()) {
        message.warning(way.value === '降级' ? '请填写正式等级复核单号' : way.value === '补发' ? '请填写补发物流单号' : '请填写退款单号');
        return;
      }
      setSaving(true);
      try {
        const result = await handleP2tDiff(handling.value.id, {
          status: status.value,
          handleWay: way.value,
          remark: remark.value.trim(),
          evidenceNo: evidenceNo.value.trim(),
          expectedStatus: handling.value.status
        });
        if (!current()) return;
        message.success(status.value === 'CLOSED' ? way.value === '降级' ? '正式等级复核核验通过，工单已关闭（不含价款调整）' : way.value === '补发' ? '足额补发及买方签收核验通过，工单已关闭' : '交易账务全额退款核验通过，工单已关闭（不代表外部资金到账）' : '处理进展已追加保存');
        setHandling(null);
        setSelected(old => old?.id === result.id ? result : old);
        elementRef.value?.reload();
      } catch (e) {
        if (current()) message.error((e as Error).message || '处置失败');
      } finally {
        setSaving(false);
      }
    };
    const columns = computed<ProColumns<P2tDiffTicket>[]>(() => [{
      title: '工单／供给／订单',
      dataIndex: 'keyword',
      hideInTable: true
    }, {
      title: '工单号',
      dataIndex: 'ticketNo',
      width: 190,
      search: false,
      render: (_, r) => <Button type="link" onClick={() => setSelected(r)}>{r.ticketNo}</Button>
    }, {
      title: '差异类型',
      dataIndex: 'diffType',
      valueType: 'select',
      valueEnum: TYPES,
      width: 120
    }, {
      title: '供给单号',
      dataIndex: 'offerNo',
      search: false,
      width: 190
    }, {
      title: '订单号',
      dataIndex: 'orderNo',
      search: false,
      width: 190
    }, {
      title: '差异量',
      dataIndex: 'diffQty',
      search: false,
      align: 'right',
      width: 100
    }, {
      title: '责任方',
      dataIndex: 'ownerSide',
      search: false,
      width: 100,
      render: (_, r) => OWNERS[r.ownerSide] || r.ownerSide || '—'
    }, {
      title: '状态',
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: STATUSES,
      width: 110,
      render: (_, r) => <Tag color={r.status === 'CLOSED' ? 'green' : r.status === 'PROCESSING' ? 'blue' : 'orange'}>{STATUSES[r.status] || r.status}</Tag>
    }, {
      title: '发现时间',
      dataIndex: 'discoveredAt',
      search: false,
      width: 170
    }, {
      title: '处置方式',
      dataIndex: 'handleWay',
      search: false,
      width: 120
    }, {
      title: '处置说明',
      dataIndex: 'handleRemark',
      search: false,
      width: 240,
      ellipsis: true
    }, {
      title: '处置时间',
      dataIndex: 'handleTime',
      search: false,
      width: 170
    }, {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      width: 150,
      render: (_, r) => <ListRowActions>
          <Button key="detail" type="link" size="small" onClick={() => setSelected(r)}>详情</Button>
          {r.status !== 'CLOSED' && r.ownerSide === 'PRODUCTION' ? <Button key="handle" type="link" size="small" onClick={() => begin(r)}>登记处置</Button> : null}
        </ListRowActions>
    }]);
    return () => {
      const _handlingAtStart = handling.value;
      return <PageContainer class="production-list-dense production-member-list" header={{
        title: '差异与异常处置'
      }}>
    {failed.value && <Alert type="error" message="工单加载失败" action={<Button onClick={() => elementRef.value?.reload()}>重试</Button>} />}
    <ProTable memberListToolbar headerTitle={false} tableAlertRender={false} key={scope.value} actionRef={elementRef} rowKey="id" columns={columns.value} params={{
          subjectId: subjectId.value
        }} columnWidthStorageKey="p2t-diff-tickets" scroll={SCROLL_BY_CONTENT} options={{
          reload: true,
          density: true,
          setting: true
        }} search={{
          labelWidth: 'auto',
          layout: 'vertical'
        }} rowSelection={{}} pagination={{
          defaultPageSize: 20,
          showSizeChanger: true
        }} request={async p => {
          if (!current()) return {
            data: [],
            total: 0,
            success: false
          };
          setFailed(false);
          const result = await listP2tDiffs({
            pageNum: p.current ?? 1,
            pageSize: p.pageSize ?? 20,
            keyword: p.keyword,
            status: p.status,
            diffType: p.diffType
          });
          return current() ? {
            data: result.list,
            total: result.total,
            success: true
          } : {
            data: [],
            total: 0,
            success: false
          };
        }} onRequestError={() => {
          if (current()) setFailed(true);
        }} />
    <Drawer rootClassName="production-detail-compact production-detail-dialog" open={!!selected.value} title="差异工单详情" width={760} onClose={() => setSelected(null)} destroyOnClose>
      {selected.value && <><DetailInfoGrid items={[{
              label: '工单号',
              value: selected.value.ticketNo
            }, {
              label: '差异类型',
              value: TYPES[selected.value.diffType] || selected.value.diffType
            }, {
              label: '状态',
              value: STATUSES[selected.value.status] || selected.value.status
            }, {
              label: '责任方',
              value: OWNERS[selected.value.ownerSide] || selected.value.ownerSide
            }, {
              label: '供给单号',
              value: selected.value.offerNo
            }, {
              label: '订单号',
              value: selected.value.orderNo
            }, {
              label: '差异量',
              value: selected.value.diffQty
            }, {
              label: '发现时间',
              value: selected.value.discoveredAt
            }, {
              label: '处置方式',
              value: selected.value.handleWay
            }, {
              label: '处置时间',
              value: selected.value.handleTime
            }, {
              label: '处置说明',
              value: selected.value.handleRemark,
              fullWidth: true
            }]} />{selected.value.status !== 'CLOSED' && selected.value.ownerSide === 'PRODUCTION' && <Button style={{
              marginTop: 16
            }} type="primary" onClick={() => { if(selected.value) begin(selected.value) }}>登记处置</Button>}</>}
    </Drawer>
    <Modal class="production-form-dialog" title={`登记处置 ${_handlingAtStart?.ticketNo || ''}`} open={!!_handlingAtStart} confirmLoading={saving.value} onCancel={() => {
          if (!saving.value) setHandling(null);
        }} onOk={() => void submit()}>
      <Space direction="vertical" style={{
            width: '100%'
          }}>
        <Alert type="info" showIcon message="此处仅登记协同处置记录" description="先登记处理中，再核验关闭。短装工单可用原订单足额补发且买方签收的专用物流单核验关闭；退款仅核验交易账务全额记账，不代表外部到账。等级降级可凭双人确认的正式复核单关闭，仅认定履约商品等级，不含价款调整；其他方案保留处理中。先在交易物流页从原物流单登记补发。交易或系统责任工单仅可查看。" />
        <span>处置状态</span><Select style={{
              width: '100%'
            }} value={status.value} onChange={setStatus} options={[{
              value: 'PROCESSING',
              label: '处理中'
            }, {
              value: 'CLOSED',
              label: '核验凭据并关闭',
              disabled: _handlingAtStart?.status !== 'PROCESSING' || !(way.value === '退款' || way.value === '降级' && _handlingAtStart?.diffType === 'GRADE_DOWN' || way.value === '补发' && _handlingAtStart?.diffType === 'SHORT_SHIP')
            }]} />
        <span>处置方式</span><Select style={{
              width: '100%'
            }} value={way.value} onChange={value => {
              setWay(value);
              setStatus('PROCESSING');
            }} options={['补发', '降级', '退款', '其他'].map(value => ({
              value,
              label: `${value}（登记方案）`
            }))} />
        {_handlingAtStart?.diffType === 'GRADE_DOWN' && <Button onClick={() => navigate(`/production/quality/grading?ticketId=${_handlingAtStart.id}`)}>查看或申请正式等级复核</Button>}
        {status.value === 'CLOSED' && <><span>{way.value === '降级' ? '正式等级复核单号（双人确认通过）' : way.value === '补发' ? '补发物流单号（足额及买方签收核验）' : '退款单号（交易账务核验）'}</span><Input value={evidenceNo.value} onChange={e => setEvidenceNo(e.target.value)} maxLength={64} placeholder={way.value === '降级' ? 'GR 开头的正式等级复核单号' : way.value === '补发' ? 'RS 开头的专用补发物流单号' : '原订单关联的退款单号'} /></>}
        <span>本次处理结果（追加保留历史）</span><Input.TextArea value={remark.value} onChange={e => setRemark(e.target.value)} maxLength={200} showCount rows={4} />
      </Space>
    </Modal>
  </PageContainer>;
    };
  }
});
export default P2tDiffs;
