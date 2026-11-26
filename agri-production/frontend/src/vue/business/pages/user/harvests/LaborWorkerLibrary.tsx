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
import { useMutation, useQuery, useQueryClient } from '@/vue/query';
import { App as AntdApp, Button, Card, Col, DatePicker, Empty, Form, Input, InputNumber, Modal, Row, Select, Space, Switch, Tag, Tooltip, Typography } from '@/vue/ui';
import type { ColumnsType } from '@/vue/ui';
import { EditOutlined, PlusOutlined, UserDeleteOutlined } from '@ant-design/icons-vue';
import dayjs, { Dayjs } from 'dayjs';
import BusinessRecordList from '@/vue/business/components/BusinessRecordList';
import ListRowActions from '@/vue/business/components/ListRowActions';
import { PageContainer as PageContainer } from '@/vue/pro';
import '@/components/ProductionListDense.css';
import '@/components/ProductionTable.css';
import useFarmStore from '@/vue/farmStore';
import { createLaborWorker, deleteLaborWorker, getLaborWorkerSummary, listLaborWorkers, updateLaborWorker } from '@/api/labor-workers';
import type { LaborWorker, LaborWorkerPayload, LaborWorkerSkill, LaborWorkerSource, LaborWorkerStatus } from '@/api/labor-workers';
import '@/pages/user/harvests/LaborWorkerLibrary.css'
const SOURCE_OPTIONS: Array<{
  value: LaborWorkerSource;
  label: string;
}> = [{
  value: 'VILLAGE',
  label: '本村劳务'
}, {
  value: 'NEIGHBORING',
  label: '邻村调剂'
}, {
  value: 'AGENCY',
  label: '劳务合作社'
}, {
  value: 'OTHER',
  label: '其他来源'
}];
const SKILL_OPTIONS: Array<{
  value: LaborWorkerSkill;
  label: string;
}> = [{
  value: 'HARVEST',
  label: '采收'
}, {
  value: 'MACHINE',
  label: '农机协作'
}, {
  value: 'DRIVER',
  label: '运输驾驶'
}, {
  value: 'MIXED',
  label: '综合工种'
}];
const WEEKDAY_OPTIONS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
function labelOf(options: Array<{
  value: string;
  label: string;
}>, value?: string): string {
  return options.find(item => item.value === value)?.label ?? value ?? '-';
}
function weekdaysToText(value?: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '每日';
  return value.split(',').map(item => WEEKDAY_OPTIONS[Number(item) - 1]).filter(Boolean).join('、') || '每日';
}
function toPayload(values: LaborWorkerFormValues, farmId: string): LaborWorkerPayload {
  return {
    farmId,
    workerNo: values.workerNo.trim(),
    workerName: values.workerName.trim(),
    phone: values.phone?.trim() || undefined,
    sourceType: values.sourceType,
    sourceName: values.sourceName?.trim() || undefined,
    skillType: values.skillType,
    dailyWage: values.dailyWage,
    availabilityRate: values.availabilityRate,
    dailyCapacity: values.dailyCapacity,
    maxHours: values.maxHours,
    availableWeekdays: values.availableWeekdays.join(','),
    availableFrom: values.availableRange?.[0]?.format('YYYY-MM-DD'),
    availableTo: values.availableRange?.[1]?.format('YYYY-MM-DD'),
    status: values.status,
    note: values.note?.trim() || undefined
  };
}
interface LaborWorkerFormValues {
  workerNo: string;
  workerName: string;
  phone?: string;
  sourceType: LaborWorkerSource;
  sourceName?: string;
  skillType: LaborWorkerSkill;
  dailyWage: number;
  availabilityRate: number;
  dailyCapacity: number;
  maxHours: number;
  availableWeekdays: string[];
  availableRange?: [Dayjs, Dayjs];
  status: LaborWorkerStatus;
  note?: string;
}
const LaborWorkerLibrary = defineComponent({
  name: "LaborWorkerLibrary",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const {
      message
    } = AntdApp.useApp();
    const currentFarm = useFarmStore(state => state.currentFarm);
    const farmId = computed(() => currentFarm.value?.farmId);
    const queryClient = useQueryClient();
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
    const sourceType = shallowRef<LaborWorkerSource>();
    const setSourceType = (next: typeof sourceType.value | ((previous: typeof sourceType.value) => typeof sourceType.value)) => {
      sourceType.value = typeof next === 'function' ? (next as (previous: typeof sourceType.value) => typeof sourceType.value)(sourceType.value) : next;
    };
    const skillType = shallowRef<LaborWorkerSkill>();
    const setSkillType = (next: typeof skillType.value | ((previous: typeof skillType.value) => typeof skillType.value)) => {
      skillType.value = typeof next === 'function' ? (next as (previous: typeof skillType.value) => typeof skillType.value)(skillType.value) : next;
    };
    const status = shallowRef<LaborWorkerStatus | undefined>('ACTIVE');
    const setStatus = (next: typeof status.value | ((previous: typeof status.value) => typeof status.value)) => {
      status.value = typeof next === 'function' ? (next as (previous: typeof status.value) => typeof status.value)(status.value) : next;
    };
    const draftKeyword = shallowRef('');
    const setDraftKeyword = (next: typeof draftKeyword.value | ((previous: typeof draftKeyword.value) => typeof draftKeyword.value)) => {
      draftKeyword.value = typeof next === 'function' ? (next as (previous: typeof draftKeyword.value) => typeof draftKeyword.value)(draftKeyword.value) : next;
    };
    const draftSourceType = shallowRef<LaborWorkerSource>();
    const setDraftSourceType = (next: typeof draftSourceType.value | ((previous: typeof draftSourceType.value) => typeof draftSourceType.value)) => {
      draftSourceType.value = typeof next === 'function' ? (next as (previous: typeof draftSourceType.value) => typeof draftSourceType.value)(draftSourceType.value) : next;
    };
    const draftSkillType = shallowRef<LaborWorkerSkill>();
    const setDraftSkillType = (next: typeof draftSkillType.value | ((previous: typeof draftSkillType.value) => typeof draftSkillType.value)) => {
      draftSkillType.value = typeof next === 'function' ? (next as (previous: typeof draftSkillType.value) => typeof draftSkillType.value)(draftSkillType.value) : next;
    };
    const draftStatus = shallowRef<LaborWorkerStatus | undefined>('ACTIVE');
    const setDraftStatus = (next: typeof draftStatus.value | ((previous: typeof draftStatus.value) => typeof draftStatus.value)) => {
      draftStatus.value = typeof next === 'function' ? (next as (previous: typeof draftStatus.value) => typeof draftStatus.value)(draftStatus.value) : next;
    };
    const targetDate = shallowRef(dayjs());
    const setTargetDate = (next: typeof targetDate.value | ((previous: typeof targetDate.value) => typeof targetDate.value)) => {
      targetDate.value = typeof next === 'function' ? (next as (previous: typeof targetDate.value) => typeof targetDate.value)(targetDate.value) : next;
    };
    const selectedRowKeys = shallowRef<(string | number)[]>([]);
    const setSelectedRowKeys = (next: typeof selectedRowKeys.value | ((previous: typeof selectedRowKeys.value) => typeof selectedRowKeys.value)) => {
      selectedRowKeys.value = typeof next === 'function' ? (next as (previous: typeof selectedRowKeys.value) => typeof selectedRowKeys.value)(selectedRowKeys.value) : next;
    };
    const modalOpen = shallowRef(false);
    const setModalOpen = (next: typeof modalOpen.value | ((previous: typeof modalOpen.value) => typeof modalOpen.value)) => {
      modalOpen.value = typeof next === 'function' ? (next as (previous: typeof modalOpen.value) => typeof modalOpen.value)(modalOpen.value) : next;
    };
    const editing = shallowRef<LaborWorker | null>(null);
    const setEditing = (next: typeof editing.value | ((previous: typeof editing.value) => typeof editing.value)) => {
      editing.value = typeof next === 'function' ? (next as (previous: typeof editing.value) => typeof editing.value)(editing.value) : next;
    };
    const [form] = Form.useForm<LaborWorkerFormValues>();
    const listQuery = useQuery(() => ({
      queryKey: ['labor-workers', farmId.value, pageNum.value, pageSize.value, keyword.value, sourceType.value, skillType.value, status.value],
      enabled: Boolean(farmId.value),
      queryFn: () => listLaborWorkers({
        farmId: farmId.value as string,
        pageNum: pageNum.value,
        pageSize: pageSize.value,
        keyword: keyword.value || undefined,
        sourceType: sourceType.value,
        skillType: skillType.value,
        status: status.value
      })
    }));
    const summaryQuery = useQuery(() => ({
      queryKey: ['labor-workers-summary', farmId.value, targetDate.value.format('YYYY-MM-DD')],
      enabled: Boolean(farmId.value),
      queryFn: () => getLaborWorkerSummary(farmId.value as string, targetDate.value.format('YYYY-MM-DD'))
    }));
    const invalidate = async (): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: ['labor-workers', farmId.value]
      });
      await queryClient.invalidateQueries({
        queryKey: ['labor-workers-summary', farmId.value]
      });
      await queryClient.invalidateQueries({
        queryKey: ['harvest-window-overview', farmId.value]
      });
    };
    const createMutation = useMutation(() => ({
      mutationFn: (values: LaborWorkerFormValues) => createLaborWorker(toPayload(values, farmId.value as string)),
      onSuccess: async () => {
        message.success('劳务人员已加入人员库');
        setModalOpen(false);
        await invalidate();
      },
      onError: (error: Error) => message.error(error.message || '新增失败')
    }));
    const updateMutation = useMutation(() => ({
      mutationFn: (values: LaborWorkerFormValues) => updateLaborWorker(editing.value?.id ?? '', toPayload(values, farmId.value as string)),
      onSuccess: async () => {
        message.success('劳务人员信息已更新');
        setModalOpen(false);
        await invalidate();
      },
      onError: (error: Error) => message.error(error.message || '更新失败')
    }));
    const deleteMutation = useMutation(() => ({
      mutationFn: (id: string) => deleteLaborWorker(id),
      onSuccess: async () => {
        message.success('劳务人员已移出人员库');
        await invalidate();
      },
      onError: (error: Error) => message.error(error.message || '删除失败')
    }));
    const rows = computed(() => listQuery.data?.list ?? []);
    const summary = computed(() => summaryQuery.data);
    const total = computed(() => listQuery.data?.total ?? 0);
    const busy = computed(() => createMutation.isPending || updateMutation.isPending);
    const openCreate = (): void => {
      setEditing(null);
      form.setFieldsValue({
        workerNo: '',
        workerName: '',
        sourceType: 'VILLAGE',
        skillType: 'HARVEST',
        dailyWage: 180,
        availabilityRate: 100,
        dailyCapacity: 1,
        maxHours: 8,
        availableWeekdays: ['1', '2', '3', '4', '5', '6', '7'],
        status: 'ACTIVE'
      });
      setModalOpen(true);
    };
    const openEdit = (row: LaborWorker): void => {
      setEditing(row);
      form.setFieldsValue({
        workerNo: row.workerNo,
        workerName: row.workerName,
        phone: row.phone,
        sourceType: row.sourceType,
        sourceName: row.sourceName,
        skillType: row.skillType,
        dailyWage: Number(row.dailyWage),
        availabilityRate: Number(row.availabilityRate),
        dailyCapacity: Number(row.dailyCapacity),
        maxHours: Number(row.maxHours),
        availableWeekdays: row.availableWeekdays?.split(',') ?? ['1', '2', '3', '4', '5', '6', '7'],
        availableRange: row.availableFrom && row.availableTo ? [dayjs(row.availableFrom), dayjs(row.availableTo)] : undefined,
        status: row.status,
        note: row.note
      });
      setModalOpen(true);
    };
    const submit = async (): Promise<void> => {
      const values = await form.validateFields();
      if (editing.value) updateMutation.mutate(values);else createMutation.mutate(values);
    };
    const remove = (row: LaborWorker): void => {
      Modal.confirm({
        title: `移出 ${row.workerName}？`,
        content: '移出后不会参与后续采收窗口用工计算，历史排程留痕不受影响。',
        okText: '移出人员库',
        cancelText: '取消',
        okButtonProps: {
          danger: true
        },
        onOk: () => deleteMutation.mutateAsync(row.id)
      });
    };
    const toggleStatus = (row: LaborWorker, checked: boolean): void => {
      updateLaborWorker(row.id, {
        status: checked ? 'ACTIVE' : 'INACTIVE'
      }).then(async () => {
        message.success(checked ? '人员已启用' : '人员已停用');
        await invalidate();
      }).catch((error: Error) => message.error(error.message || '状态更新失败'));
    };
    const handleSearch = (): void => {
      setKeyword(draftKeyword.value.trim());
      setSourceType(draftSourceType.value);
      setSkillType(draftSkillType.value);
      setStatus(draftStatus.value);
      setPageNum(1);
    };
    const handleReset = (): void => {
      setDraftKeyword('');
      setDraftSourceType(undefined);
      setDraftSkillType(undefined);
      setDraftStatus('ACTIVE');
      setKeyword('');
      setSourceType(undefined);
      setSkillType(undefined);
      setStatus('ACTIVE');
      setPageNum(1);
    };
    const columns = computed<ColumnsType<LaborWorker>>(() => [{
      title: '人员',
      key: 'worker',
      fixed: 'left',
      width: 190,
      ellipsis: true,
      render: (_, row) => <span class="production-dense-name-wrap" title={`${row.workerName} (${row.workerNo})`}>
          <span class="lw-avatar">{row.workerName.slice(0, 1)}</span>
          <Typography.Text strong>{row.workerName}</Typography.Text>
          <Typography.Text type="secondary" style={{
          fontSize: 12
        }}>{row.workerNo}</Typography.Text>
        </span>
    }, {
      title: '来源',
      dataIndex: 'sourceType',
      width: 190,
      ellipsis: true,
      render: (value: LaborWorkerSource, row) => {
        const srcName = row.sourceName || '未注明';
        return <span class="production-dense-name-wrap" title={`${labelOf(SOURCE_OPTIONS, value)} · ${srcName}`}>
            <Tag color={value === 'VILLAGE' ? 'green' : value === 'NEIGHBORING' ? 'blue' : 'gold'}>
              {labelOf(SOURCE_OPTIONS, value)}
            </Tag>
            <Typography.Text type="secondary" style={{
            fontSize: 12
          }}>{srcName}</Typography.Text>
          </span>;
      }
    }, {
      title: '技能',
      dataIndex: 'skillType',
      width: 110,
      ellipsis: true,
      render: (value: LaborWorkerSkill) => labelOf(SKILL_OPTIONS, value)
    }, {
      title: '日薪',
      dataIndex: 'dailyWage',
      width: 100,
      align: 'right',
      render: (value: number) => `${Number(value).toFixed(0)} 元`
    }, {
      title: '可到岗率',
      dataIndex: 'availabilityRate',
      width: 100,
      align: 'right',
      render: (value: number) => `${Number(value).toFixed(0)}%`
    }, {
      title: '工时上限',
      dataIndex: 'maxHours',
      width: 105,
      align: 'right',
      render: (value: number) => `${Number(value).toFixed(1)} 小时`
    }, {
      title: '可用日期',
      dataIndex: 'availableWeekdays',
      width: 210,
      ellipsis: true,
      render: (value: string, row) => {
        const rangeText = row.availableFrom || row.availableTo ? `${row.availableFrom || '不限'} 至 ${row.availableTo || '不限'}` : '长期有效';
        const full = `${weekdaysToText(value)}（${rangeText}）`;
        return <span class="production-dense-link-ellipsis" title={full}>{full}</span>;
      }
    }, {
      title: '状态',
      dataIndex: 'status',
      width: 96,
      render: (value: LaborWorkerStatus, row) => <Switch size="small" checked={value === 'ACTIVE'} checkedChildren="在册" unCheckedChildren="停用" onChange={checked => toggleStatus(row, checked)} />
    }, {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      width: 140,
      render: (_, row) => <ListRowActions>
          <Button key="edit" type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>编辑</Button>
          <Button key="remove" type="link" danger size="small" icon={<UserDeleteOutlined />} onClick={() => remove(row)}>移出</Button>
        </ListRowActions>
    }]);
    return () => {
      if (!farmId.value) return <PageContainer title="劳务人员库"><Empty description="请先在顶部选择当前农场" /></PageContainer>;
      return <PageContainer class="labor-worker-page production-list-dense production-member-list" title="劳务人员库" subTitle={<span class="production-dense-summary-inline">
        <span class="production-dense-metric">
          <span class="production-dense-metric-label">在册</span>
          <span class="production-dense-metric-value">{summary.value?.activeCount ?? 0} 人</span>
        </span>
        <span class="production-dense-metric">
          <span class="production-dense-metric-label">当日可到岗</span>
          <span class="production-dense-metric-value is-success">{summary.value?.availableCount ?? 0} 人</span>
        </span>
        <span class="production-dense-metric">
          <span class="production-dense-metric-label">本村</span>
          <span class="production-dense-metric-value">{summary.value?.villageAvailable ?? 0} 人</span>
        </span>
        <span class="production-dense-metric">
          <span class="production-dense-metric-label">邻村调剂</span>
          <span class="production-dense-metric-value">{summary.value?.neighboringAvailable ?? 0} 人</span>
        </span>
        <span class="production-dense-metric">
          <span class="production-dense-metric-label">均薪</span>
          <span class="production-dense-metric-value">{Number(summary.value?.averageDailyWage ?? 0).toFixed(0)} 元/人</span>
        </span>
      </span>} extra={<Space size={8}>
        <Tooltip title="这里维护季节性、临时性劳务人员的来源、技能与可到岗能力，供采收窗口决策计算每日用工和跨村调剂。长期组织成员与角色权限仍在“团队与人员”中维护。">
          <span class="production-dense-summary-note">口径日期</span>
        </Tooltip>
        <DatePicker size="small" value={targetDate.value} onChange={value => value && setTargetDate(value)} allowClear={false} />
      </Space>}>
    <Card class="production-dense-filter-card">
      <ProductionListFilters onSearch={handleSearch} onReset={handleReset} loading={listQuery.isLoading}>
        <div class="production-filter-field">
          <label>关键字</label>
          <Input placeholder="姓名 / 编号 / 手机号 / 来源" allowClear value={draftKeyword.value} onChange={event => setDraftKeyword(event.target.value ?? '')}  />
        </div>
        <div class="production-filter-field">
          <label>来源</label>
          <Select allowClear placeholder="全部来源" value={draftSourceType.value} onChange={setDraftSourceType} options={SOURCE_OPTIONS} />
        </div>
        <div class="production-filter-field">
          <label>技能</label>
          <Select allowClear placeholder="全部技能" value={draftSkillType.value} onChange={setDraftSkillType} options={SKILL_OPTIONS} />
        </div>
        <div class="production-filter-field">
          <label>状态</label>
          <Select allowClear placeholder="全部状态" value={draftStatus.value} onChange={setDraftStatus} options={[{
                value: 'ACTIVE',
                label: '在册人员'
              }, {
                value: 'INACTIVE',
                label: '已停用'
              }]} />
        </div>
      </ProductionListFilters>
    </Card>

    <Card class="lw-table-card">
      <BusinessRecordList memberListToolbar columnWidthStorageKey="labor-worker-library" rowKey="id" loading={listQuery.isLoading} dataSource={rows.value} columns={columns.value} onReload={() => invalidate()} rowSelection={{
            selectedRowKeys: selectedRowKeys.value,
            onChange: setSelectedRowKeys
          }} toolbarTitle={<Space size={8} wrap>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增劳务人员</Button>
          </Space>} scroll={{
            x: 1250
          }} locale={{
            emptyText: '当前筛选下暂无劳务人员，请调整条件或新增劳务人员'
          }} pagination={{
            current: pageNum.value,
            pageSize: pageSize.value,
            total: total.value,
            onChange: (page, size) => {
              setPageNum(page);
              setPageSize(size);
            }
          }} />
    </Card>
    <Modal title={editing.value ? '编辑劳务人员' : '新增劳务人员'} open={modalOpen.value} onCancel={() => setModalOpen(false)} onOk={() => void submit()} okText="保存到人员库" cancelText="取消" confirmLoading={busy.value} width={720} destroyOnClose>
      <Form form={form} layout="vertical" preserve={false}><Row gutter={16}><Col span={12}><Form.Item name="workerNo" label="劳务编号" rules={[{
                  required: true,
                  message: '请输入劳务编号'
                }]}><Input placeholder="如 LW-013" /></Form.Item></Col><Col span={12}><Form.Item name="workerName" label="姓名" rules={[{
                  required: true,
                  message: '请输入姓名'
                }]}><Input /></Form.Item></Col><Col span={12}><Form.Item name="phone" label="联系电话"><Input /></Form.Item></Col><Col span={12}><Form.Item name="sourceType" label="来源" rules={[{
                  required: true
                }]}><Select options={SOURCE_OPTIONS} /></Form.Item></Col><Col span={12}><Form.Item name="sourceName" label="来源名称"><Input placeholder="如本村劳务队、丰收劳务合作社" /></Form.Item></Col><Col span={12}><Form.Item name="skillType" label="主要技能" rules={[{
                  required: true
                }]}><Select options={SKILL_OPTIONS} /></Form.Item></Col><Col span={8}><Form.Item name="dailyWage" label="日薪（元）" rules={[{
                  required: true
                }]}><InputNumber min={0} style={{
                    width: '100%'
                  }} /></Form.Item></Col><Col span={8}><Form.Item name="availabilityRate" label="可到岗率（%）" rules={[{
                  required: true
                }]}><InputNumber min={0} max={100} style={{
                    width: '100%'
                  }} /></Form.Item></Col><Col span={8}><Form.Item name="maxHours" label="单日工时上限" rules={[{
                  required: true
                }]}><InputNumber min={1} max={24} step={0.5} style={{
                    width: '100%'
                  }} /></Form.Item></Col><Col span={12}><Form.Item name="availableWeekdays" label="可用星期" rules={[{
                  required: true,
                  type: 'array',
                  min: 1,
                  message: '至少选择一天'
                }]}><Select mode="multiple" options={WEEKDAY_OPTIONS.map((label, index) => ({
                    label,
                    value: String(index + 1)
                  }))} /></Form.Item></Col><Col span={12}><Form.Item name="availableRange" label="可用日期范围"><DatePicker.RangePicker style={{
                    width: '100%'
                  }} /></Form.Item></Col><Col span={12}><Form.Item name="status" label="状态" rules={[{
                  required: true
                }]}><Select options={[{
                    value: 'ACTIVE',
                    label: '在册'
                  }, {
                    value: 'INACTIVE',
                    label: '停用'
                  }]} /></Form.Item></Col><Col span={24}><Form.Item name="note" label="备注"><Input.TextArea rows={2} maxLength={500} showCount /></Form.Item></Col></Row></Form>
    </Modal>
  </PageContainer>;
    };
  }
});
export default LaborWorkerLibrary;
