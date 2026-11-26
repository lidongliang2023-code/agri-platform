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
import Card from '@/vue/business/components/SectionCard';
import '@/pages/user/quality/quality-trace.css';
import ListRowActions from '@/vue/business/components/ListRowActions';
import ProTable from '@/vue/ProductionRequestTable';
/**
 * 页面名称：加工记录
 * 路由路径：/production/process
 * 所属模块：质量检测与溯源
 *
 * 为什么要有这一页：溯源码能还原到"采收"就断了 —— 加工环节此前在生产域没有任何业务实体，
 * 消费者详情页那句"加工信息"只能靠商城自己编。现在加工工序在这里登记，
 * 全链路页（/production/trace/full-chain）与公众核验读的都是这批记录。
 *
 * 一物一码闭环里的位置：
 *   种植（地块品种台账）→ 采收（本模块批次）→ **加工（本页登记）** → 质检 → 仓储 → 溯源码
 */

import { useNavigate } from '@/vue/router';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { useMutation, useQuery, useQueryClient } from '@/vue/query';
import { PageContainer as PageContainer } from '@/vue/pro';
import type { ProColumns } from '@/vue/pro';
import { Button, DatePicker, Form, Input, InputNumber, message, Modal, Popconfirm, Select, Space, Tag } from '@/vue/ui';
import { createProcess, deleteProcess, listProcessByBatch, PROCESS_STATUS, PROCESS_TYPES, updateProcess, type ProcessRecord, type ProcessSavePayload } from '@/api/process';
import { listHarvests } from '@/api/harvests';
const typeLabel = (value?: string) => PROCESS_TYPES.find(item => item.value === value)?.label ?? value ?? '—';
const statusColor: Record<string, string> = {
  DONE: 'green',
  DOING: 'blue',
  CANCELED: 'default'
};

/**
 * 表单值形状。
 *
 * antd v5 的 DatePicker 没有 valueFormat（那是 element-plus 的写法），拿到的是 dayjs 对象，
 * 因此**在提交时**统一转成后端要的 ISO 字符串、回填时反向 parse 成 dayjs。
 */
interface ProcessFormValues extends Omit<ProcessSavePayload, 'startedAt' | 'finishedAt'> {
  startedAt?: Dayjs | string;
  finishedAt?: Dayjs | string;
}
const toIso = (value?: Dayjs | string): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  return value.format('YYYY-MM-DDTHH:mm:ss');
};
const toDayjs = (value?: string) => value ? dayjs(value) : undefined;
const ProcessRecordManage = defineComponent({
  name: "ProcessRecordManage",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const batchNo = shallowRef<string>('');
    const setBatchNo = (next: typeof batchNo.value | ((previous: typeof batchNo.value) => typeof batchNo.value)) => {
      batchNo.value = typeof next === 'function' ? (next as (previous: typeof batchNo.value) => typeof batchNo.value)(batchNo.value) : next;
    };
    const draftBatchNo = shallowRef<string>('');
    const setDraftBatchNo = (next: typeof draftBatchNo.value | ((previous: typeof draftBatchNo.value) => typeof draftBatchNo.value)) => {
      draftBatchNo.value = typeof next === 'function' ? (next as (previous: typeof draftBatchNo.value) => typeof draftBatchNo.value)(draftBatchNo.value) : next;
    };
    const draftProcessType = shallowRef<string | undefined>(undefined);
    const setDraftProcessType = (next: typeof draftProcessType.value | ((previous: typeof draftProcessType.value) => typeof draftProcessType.value)) => {
      draftProcessType.value = typeof next === 'function' ? (next as (previous: typeof draftProcessType.value) => typeof draftProcessType.value)(draftProcessType.value) : next;
    };
    const draftStatus = shallowRef<string | undefined>(undefined);
    const setDraftStatus = (next: typeof draftStatus.value | ((previous: typeof draftStatus.value) => typeof draftStatus.value)) => {
      draftStatus.value = typeof next === 'function' ? (next as (previous: typeof draftStatus.value) => typeof draftStatus.value)(draftStatus.value) : next;
    };
    const draftKeyword = shallowRef<string>('');
    const setDraftKeyword = (next: typeof draftKeyword.value | ((previous: typeof draftKeyword.value) => typeof draftKeyword.value)) => {
      draftKeyword.value = typeof next === 'function' ? (next as (previous: typeof draftKeyword.value) => typeof draftKeyword.value)(draftKeyword.value) : next;
    };
    const processTypeFilter = shallowRef<string | undefined>(undefined);
    const setProcessTypeFilter = (next: typeof processTypeFilter.value | ((previous: typeof processTypeFilter.value) => typeof processTypeFilter.value)) => {
      processTypeFilter.value = typeof next === 'function' ? (next as (previous: typeof processTypeFilter.value) => typeof processTypeFilter.value)(processTypeFilter.value) : next;
    };
    const statusFilter = shallowRef<string | undefined>(undefined);
    const setStatusFilter = (next: typeof statusFilter.value | ((previous: typeof statusFilter.value) => typeof statusFilter.value)) => {
      statusFilter.value = typeof next === 'function' ? (next as (previous: typeof statusFilter.value) => typeof statusFilter.value)(statusFilter.value) : next;
    };
    const keywordFilter = shallowRef<string>('');
    const setKeywordFilter = (next: typeof keywordFilter.value | ((previous: typeof keywordFilter.value) => typeof keywordFilter.value)) => {
      keywordFilter.value = typeof next === 'function' ? (next as (previous: typeof keywordFilter.value) => typeof keywordFilter.value)(keywordFilter.value) : next;
    };
    const selectedRowKeys = shallowRef<(string | number)[]>([]);
    const setSelectedRowKeys = (next: typeof selectedRowKeys.value | ((previous: typeof selectedRowKeys.value) => typeof selectedRowKeys.value)) => {
      selectedRowKeys.value = typeof next === 'function' ? (next as (previous: typeof selectedRowKeys.value) => typeof selectedRowKeys.value)(selectedRowKeys.value) : next;
    };
    const editing = shallowRef<ProcessRecord | null>(null);
    const setEditing = (next: typeof editing.value | ((previous: typeof editing.value) => typeof editing.value)) => {
      editing.value = typeof next === 'function' ? (next as (previous: typeof editing.value) => typeof editing.value)(editing.value) : next;
    };
    const creating = shallowRef(false);
    const setCreating = (next: typeof creating.value | ((previous: typeof creating.value) => typeof creating.value)) => {
      creating.value = typeof next === 'function' ? (next as (previous: typeof creating.value) => typeof creating.value)(creating.value) : next;
    };
    const [form] = Form.useForm<ProcessFormValues>();
    const batches = useQuery(() => ({
      queryKey: ['harvest-batches-for-process'],
      queryFn: () => listHarvests({
        pageNum: 1,
        pageSize: 100
      })
    }));
    const batchOptions = computed(
    // 响应拦截器已把后端 records 归一为 list（见 @agri/shared PageResult 注释），取 records 会永远是空的
    () => (batches.data?.list ?? []).map(b => ({
      value: b.batchNo ?? String(b.batchId ?? ''),
      label: `${b.batchNo ?? '—'} · ${b.cropName ?? '未填作物'}` + (b.harvestDate ? ` · 采收 ${b.harvestDate}` : '')
    })).filter(option => !!option.value));
    const activeBatch = computed(() => batchNo.value || batchOptions.value[0]?.value || '');
    const selectedDraftBatch = computed(() => draftBatchNo.value || activeBatch.value);
    const records = useQuery(() => ({
      queryKey: ['process-records', activeBatch.value],
      queryFn: () => listProcessByBatch(activeBatch.value),
      enabled: !!activeBatch.value
    }));
    const filteredRecords = computed(() => {
      const kw = keywordFilter.value.trim().toLowerCase();
      return (records.data ?? []).filter(row => {
        if (processTypeFilter.value && row.processType !== processTypeFilter.value) return false;
        if (statusFilter.value && row.status !== statusFilter.value) return false;
        if (kw) {
          const hay = `${row.processCode ?? ''} ${row.processName ?? ''} ${row.location ?? ''} ${row.operatorName ?? ''}`.toLowerCase();
          if (!hay.includes(kw)) return false;
        }
        return true;
      });
    });
    const handleSearch = () => {
      setBatchNo(selectedDraftBatch.value);
      setProcessTypeFilter(draftProcessType.value);
      setStatusFilter(draftStatus.value);
      setKeywordFilter(draftKeyword.value.trim());
    };
    const handleReset = () => {
      setDraftBatchNo('');
      setDraftProcessType(undefined);
      setDraftStatus(undefined);
      setDraftKeyword('');
      setBatchNo('');
      setProcessTypeFilter(undefined);
      setStatusFilter(undefined);
      setKeywordFilter('');
    };
    const refresh = () => queryClient.invalidateQueries({
      queryKey: ['process-records']
    });
    const save = useMutation(() => ({
      mutationFn: async (values: ProcessFormValues) => {
        const payload: ProcessSavePayload = {
          ...values,
          batchId: values.batchId || activeBatch.value,
          startedAt: toIso(values.startedAt),
          finishedAt: toIso(values.finishedAt)
        };
        return editing.value ? updateProcess(editing.value.id, payload) : createProcess(payload);
      },
      onSuccess: row => {
        message.success(editing.value ? `加工记录已更新：${row.processCode}` : `已登记加工工序：${row.processCode}`);
        setEditing(null);
        setCreating(false);
        form.resetFields();
        refresh();
      },
      // 后端拒绝时必须看到原因（词表不对、批次不是本主体、结束早于开始…），静默失败最误导
      onError: (err: Error) => message.error(err.message || '保存失败')
    }));
    const remove = useMutation(() => ({
      mutationFn: (id: number) => deleteProcess(id),
      onSuccess: () => {
        message.success('加工记录已删除');
        refresh();
      },
      onError: (err: Error) => message.error(err.message || '删除失败')
    }));
    const openForm = (row: ProcessRecord | null) => {
      const target = row ?? null;
      setEditing(target);
      setCreating(!target);
      form.resetFields();
      if (target) {
        form.setFieldsValue({
          batchId: target.batchNo,
          processType: target.processType,
          processName: target.processName,
          location: target.location,
          operatorName: target.operatorName,
          startedAt: toDayjs(target.startedAt),
          finishedAt: toDayjs(target.finishedAt),
          inputQuantity: target.inputQuantity,
          inputUnit: target.inputUnit,
          outputQuantity: target.outputQuantity,
          outputUnit: target.outputUnit,
          processParams: target.processParams,
          status: target.status,
          remark: target.remark
        });
      } else {
        form.setFieldsValue({
          batchId: activeBatch.value,
          status: 'DONE'
        });
      }
    };
    const columns = computed<ProColumns<ProcessRecord>[]>(() => [{
      title: '加工单号',
      dataIndex: 'processCode',
      width: 160
    }, {
      title: '类型',
      dataIndex: 'processType',
      width: 110,
      render: (_, row) => <Tag>{typeLabel(row.processType)}</Tag>
    }, {
      title: '工序名称',
      dataIndex: 'processName',
      render: (_, r) => r.processName || '—'
    }, {
      title: '场地',
      dataIndex: 'location',
      width: 140,
      render: (_, r) => r.location || '—'
    }, {
      title: '操作人',
      dataIndex: 'operatorName',
      width: 100,
      render: (_, r) => r.operatorName || '—'
    }, {
      title: '开始',
      dataIndex: 'startedAt',
      width: 160,
      render: (_, r) => r.startedAt?.replace('T', ' ').slice(0, 16) ?? '—'
    }, {
      title: '结束',
      dataIndex: 'finishedAt',
      width: 160,
      render: (_, r) => r.finishedAt?.replace('T', ' ').slice(0, 16) ?? '—'
    }, {
      title: '投入 → 产出',
      dataIndex: 'inputQuantity',
      width: 170,
      // 损耗只在投入产出都填了且同单位时由后端算；null 就如实显示"—"，不拿 0 冒充
      render: (_, r) => r.inputQuantity != null || r.outputQuantity != null ? `${r.inputQuantity ?? '—'}${r.inputUnit ?? ''} → ${r.outputQuantity ?? '—'}${r.outputUnit ?? ''}
           ${r.lossQuantity != null ? `（损耗 ${r.lossQuantity}${r.inputUnit ?? ''}）` : ''}`.replace(/\s+/g, ' ') : '—'
    }, {
      title: '工艺参数',
      dataIndex: 'processParams',
      ellipsis: true,
      render: (_, r) => r.processParams || '—'
    }, {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (_, r) => <Tag color={statusColor[r.status] ?? 'default'}>{PROCESS_STATUS.find(s => s.value === r.status)?.label ?? r.status}</Tag>
    }, {
      title: '操作',
      fixed: 'right',
      dataIndex: 'action',
      valueType: 'option',
      width: 130,
      render: (_, row) => <ListRowActions>
          <Button key="edit" size="small" type="link" onClick={() => openForm(row)}>编辑</Button>
          <Popconfirm key="delete" title="删除该加工记录？" onConfirm={() => remove.mutate(row.id)}>
            <Button size="small" type="link" danger>删除</Button>
          </Popconfirm>
        </ListRowActions>
    }]);
    return () => {
      return <PageContainer class="quality-trace-page production-list-dense production-member-list" header={{
        title: '加工记录',
        onBack: undefined
      }}>
      <Card class="production-dense-filter-card">
        <ProductionListFilters onSearch={handleSearch} onReset={handleReset} loading={records.isFetching}>
          <div class="production-filter-field">
            <label>采收批次</label>
            <Select placeholder={batches.isLoading ? '加载中…' : '选择批次'} loading={batches.isLoading} value={selectedDraftBatch.value || undefined} options={batchOptions.value} onChange={value => setDraftBatchNo(value)} showSearch />
          </div>
          <div class="production-filter-field">
            <label>加工类型</label>
            <Select allowClear placeholder="全部类型" value={draftProcessType.value} options={PROCESS_TYPES.map(t => ({
                value: t.value,
                label: t.label
              }))} onChange={setDraftProcessType} />
          </div>
          <div class="production-filter-field">
            <label>状态</label>
            <Select allowClear placeholder="全部状态" value={draftStatus.value} options={PROCESS_STATUS.map(s => ({
                value: s.value,
                label: s.label
              }))} onChange={setDraftStatus} />
          </div>
          <div class="production-filter-field">
            <label>关键字</label>
            <Input allowClear placeholder="加工单号 / 工序 / 场地 / 操作人" value={draftKeyword.value} onChange={e => setDraftKeyword(e.target.value)}  />
          </div>
        </ProductionListFilters>
        {!activeBatch.value && !batches.isLoading && <div style={{
            color: '#c54b4b',
            marginTop: 8,
            fontSize: 12
          }}>
            本主体名下没有采收批次：请先到「采收管理」登记批次，加工工序必须挂在真实批次上。
          </div>}
      </Card>

      <ProTable memberListToolbar columnWidthStorageKey="process-record-manage" rowKey="id" search={false} pagination={{
          defaultPageSize: 20,
          showSizeChanger: true
        }} rowSelection={{
          selectedRowKeys: selectedRowKeys.value,
          onChange: setSelectedRowKeys
        }} options={{
          reload: () => {
            void refresh();
          }
        }} toolBarRender={() => [<Button key="new" type="primary" onClick={() => openForm(null)} disabled={!activeBatch.value}>登记加工工序</Button>, <Button key="chain" onClick={() => navigate('/production/trace/full-chain')}>查看全链路</Button>]} loading={records.isFetching} columns={columns.value} dataSource={filteredRecords.value} locale={{
          emptyText: activeBatch.value ? '该批次还没有登记加工工序（消费者详情页的加工环节因此为空，链路照实只显示到采收）' : '请先选择采收批次'
        }} />

      <Modal class="production-form-dialog quality-trace-dialog" open={creating.value || !!editing.value} title={editing.value ? `编辑加工记录 ${editing.value.processCode}` : '登记加工工序'} onCancel={() => {
          setCreating(false);
          setEditing(null);
        }} onOk={() => form.submit()} confirmLoading={save.isPending} width={720} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={values => save.mutate(values)}>
          <Form.Item name="batchId" label="采收批次" rules={[{
              required: true,
              message: '请选择采收批次'
            }]}>
            <Select options={batchOptions.value} showSearch />
          </Form.Item>
          <Form.Item name="processType" label="加工类型" rules={[{
              required: true,
              message: '请选择加工类型'
            }]}>
            <Select options={PROCESS_TYPES.map(t => ({
                value: t.value,
                label: t.label
              }))} />
          </Form.Item>
          <Form.Item name="processName" label="工序名称"><Input placeholder="如：采后预冷与分级装箱" /></Form.Item>
          <Form.Item name="location" label="加工场地"><Input placeholder="如：A区分装车间" /></Form.Item>
          <Form.Item name="operatorName" label="操作人"><Input /></Form.Item>
          <Form.Item name="startedAt" label="开始时间">
            <DatePicker showTime style={{
                width: '100%'
              }} />
          </Form.Item>
          <Form.Item name="finishedAt" label="结束时间">
            <DatePicker showTime style={{
                width: '100%'
              }} />
          </Form.Item>
          <Space align="start" wrap>
            <Form.Item name="inputQuantity" label="投入量"><InputNumber min={0} step={0.01} /></Form.Item>
            <Form.Item name="inputUnit" label="投入单位"><Input style={{
                  width: 90
                }} placeholder="kg" /></Form.Item>
            <Form.Item name="outputQuantity" label="产出量"><InputNumber min={0} step={0.01} /></Form.Item>
            <Form.Item name="outputUnit" label="产出单位"><Input style={{
                  width: 90
                }} placeholder="kg" /></Form.Item>
          </Space>
          <Form.Item name="processParams" label="工艺参数"><Input.TextArea rows={2} placeholder="照实记录，如：冷风预冷至果心 8℃，历时 3.5 小时" /></Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={PROCESS_STATUS.map(s => ({
                value: s.value,
                label: s.label
              }))} />
          </Form.Item>
          <Form.Item name="remark" label="备注"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </PageContainer>;
    };
  }
});
export default ProcessRecordManage;
