import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event & {
  target: T;
  currentTarget: T;
  nativeEvent: Event;
  key: string;
};
import { Alert, App, Button, Form, Input, Modal, Tag } from '@/vue/ui';
import { useMutation, useQuery, useQueryClient } from '@/vue/query';
import { useSearchParams } from '@/vue/router';
import type { ProColumns } from '@/vue/pro';
import { qualityRecords, controlQualityBatch, type QualityRecord } from '@/api/admin/quality-workbench';
import ListRowActions from '@/vue/business/components/ListRowActions';
import { Card, Table, QualityPage, LoadError, InspectionDetail } from './QualityShared';
const controlled = (r: QualityRecord) => Number(r.batch?.status) === 4 && Number(r.unrevokedCodeCount ?? 0) === 0 && Number(r.frozenInventoryCount ?? 0) === Number(r.inventoryCount ?? 0) && !!r.batch?.remark?.includes('监管管控：');
const RecallManage = defineComponent({
  name: "RecallManage",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const {
        message
      } = App.useApp(),
      qc = useQueryClient(),
      [params] = useSearchParams();
    const page = shallowRef(1),
      size = shallowRef(20),
      keyword = shallowRef(''),
      selected = shallowRef<QualityRecord>(),
      active = shallowRef(params.value.get('inspectionId') || ''),
      form = Form.useForm<{
        reason: string;
      }>();
    const setActive = (next: typeof active.value | ((previous: typeof active.value) => typeof active.value)) => {
      active.value = typeof next === 'function' ? (next as (previous: typeof active.value) => typeof active.value)(active.value) : next;
    };
    const setSelected = (next: typeof selected.value | ((previous: typeof selected.value) => typeof selected.value)) => {
      selected.value = typeof next === 'function' ? (next as (previous: typeof selected.value) => typeof selected.value)(selected.value) : next;
    };
    const setKeyword = (next: typeof keyword.value | ((previous: typeof keyword.value) => typeof keyword.value)) => {
      keyword.value = typeof next === 'function' ? (next as (previous: typeof keyword.value) => typeof keyword.value)(keyword.value) : next;
    };
    const setSize = (next: typeof size.value | ((previous: typeof size.value) => typeof size.value)) => {
      size.value = typeof next === 'function' ? (next as (previous: typeof size.value) => typeof size.value)(size.value) : next;
    };
    const setPage = (next: typeof page.value | ((previous: typeof page.value) => typeof page.value)) => {
      page.value = typeof next === 'function' ? (next as (previous: typeof page.value) => typeof page.value)(page.value) : next;
    };
    const query = useQuery(() => ({
      queryKey: ['quality-control', page.value, size.value, keyword.value],
      queryFn: () => qualityRecords({
        pageNum: page.value,
        pageSize: size.value,
        keyword: keyword.value,
        result: 'FAIL'
      }),
      retry: false
    }));
    const mutation = useMutation(() => ({
      mutationFn: async () => {
        const v = await form.validateFields();
        if (!selected.value) throw new Error('请选择检测单');
        const d = await controlQualityBatch(selected.value.inspection.inspectionId, v.reason);
        if (Number(d.batch?.status) !== 4) throw new Error('冻结状态未确认，请刷新核验');
        return d;
      },
      onSuccess: () => {
        message.success('批次冻结、分仓库存冻结及溯源码作废已确认');
        setSelected(undefined);
        form.resetFields();
        void qc.invalidateQueries({
          queryKey: ['quality-control']
        });
        void qc.invalidateQueries({
          queryKey: ['quality-inspection']
        });
        void qc.invalidateQueries({
          queryKey: ['admin', 'trace']
        });
      },
      onError: (e: Error) => message.error(e.message)
    }));
    const cols = computed<ProColumns<QualityRecord>[]>(() => [{
      title: '检测单号',
      width: 200,
      render: (_, r) => <Button type="link" onClick={() => setActive(r.inspection.inspectionId)}>{r.inspection.inspectionNo || r.inspection.inspectionId}</Button>
    }, {
      title: '批次号',
      width: 180,
      render: (_, r) => r.inspection.batchNo || '未关联'
    }, {
      title: '产品',
      width: 140,
      render: (_, r) => r.inspection.cropName || '—'
    }, {
      title: '农场',
      dataIndex: 'farmName',
      width: 180
    }, {
      title: '检测机构',
      width: 185,
      render: (_, r) => r.inspection.labName || '—'
    }, {
      title: '管控状态',
      width: 130,
      render: (_, r) => <Tag color={controlled(r) ? 'red' : 'orange'}>{r.batch ? controlled(r) ? '管控已完成' : Number(r.batch.status) === 4 ? '已冻结待补管控' : '待管控' : '无有效批次'}</Tag>
    }, {
      title: '冻结库存记录',
      width: 130,
      render: (_, r) => r.batch ? `${r.frozenInventoryCount ?? 0} / ${r.inventoryCount ?? 0}` : '—'
    }, {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      width: 165,
      render: (_, r) => <ListRowActions items={[<Button key="d" type="link" size="small" onClick={() => setActive(r.inspection.inspectionId)}>详情</Button>, <Button key="c" danger type="link" size="small" disabled={!r.batch || controlled(r)} onClick={() => {
        setSelected(r);
        form.resetFields();
      }}>管控批次</Button>]} />
    }]);
    return () => {
      return <QualityPage title="不合格品处置" subTitle="依据真实检测结论实施生产侧风险管控，跟踪批次与库存状态"><Alert showIcon type="warning" message="冻结同主体批次及分仓库存、作废关联单品码；不自动执行交易下架、物流回收、退款或销毁。相关订单应由交易履约域处理。" /><LoadError error={query.error} /><Card class="production-dense-filter-card"><div class="production-filter-grid"><div class="production-filter-field"><label>检测单号 / 批次 / 产品</label><Input value={keyword.value} allowClear placeholder="请输入单号、批次或产品" onChange={e => {
                setKeyword(e.target.value);
                setPage(1);
              }} /></div><div class="production-filter-actions"><Button onClick={() => {
                setKeyword('');
                setPage(1);
              }}>重置</Button><Button type="primary" loading={query.isFetching} onClick={() => {
                setPage(1);
                void query.refetch();
              }}>查询</Button></div></div></Card><Card><Table rowKey={r => r.inspection.inspectionId} memberListToolbar rowSelection={{}} cardProps={false} headerTitle="不合格批次台账" columns={cols.value} dataSource={query.data?.list ?? []} loading={query.isFetching} search={false} columnWidthStorageKey="quality-controls" options={{
            reload: () => void query.refetch()
          }} pagination={{
            current: page.value,
            pageSize: size.value,
            total: query.data?.total ?? 0,
            showSizeChanger: true,
            onChange: (p, s) => {
              setPage(s === size.value ? p : 1);
              setSize(s);
            }
          }} /></Card><InspectionDetail id={active.value || undefined} onClose={() => setActive('')} /><Modal title="确认冻结不合格批次" class="quality-dialog" open={!!selected.value} onCancel={() => {
          if (!mutation.isPending) setSelected(undefined);
        }} confirmLoading={mutation.isPending} onOk={() => mutation.mutate()} okText="冻结批次并作废码" okButtonProps={{
          danger: true
        }}><p>检测单：{selected.value?.inspection.inspectionNo}</p><p>批次：{selected.value?.inspection.batchNo}</p><Form form={form} layout="horizontal" labelCol={{
            span: 5
          }} wrapperCol={{
            span: 19
          }}><Form.Item name="reason" label="处置依据" rules={[{
              required: true,
              whitespace: true,
              message: '填写不合格事实与处置依据'
            }, {
              max: 200
            }]}><Input.TextArea rows={3} maxLength={200} showCount /></Form.Item></Form></Modal></QualityPage>;
    };
  }
});
export default RecallManage;
