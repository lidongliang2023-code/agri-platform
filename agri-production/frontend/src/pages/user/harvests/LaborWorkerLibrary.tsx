import { useState } from 'react'
import type { Key } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App as AntdApp, Button, Card, Col, DatePicker, Empty, Form, Input, InputNumber, Modal, Row, Select, Space, Switch, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { EditOutlined, PlusOutlined, UserDeleteOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import BusinessRecordList from '@/components/BusinessRecordList'
import ListRowActions from '@/components/ListRowActions'
import PageContainer from '@/components/ProductionPageContainer'
import '@/components/ProductionListDense.css'
import '@/components/ProductionTable.css'
import useFarmStore from '@/store/farm'
import { createLaborWorker, deleteLaborWorker, getLaborWorkerSummary, listLaborWorkers, updateLaborWorker } from '@/api/labor-workers'
import type { LaborWorker, LaborWorkerPayload, LaborWorkerSkill, LaborWorkerSource, LaborWorkerStatus } from '@/api/labor-workers'
import './LaborWorkerLibrary.css'

const SOURCE_OPTIONS: Array<{ value: LaborWorkerSource; label: string }> = [
  { value: 'VILLAGE', label: '本村劳务' },
  { value: 'NEIGHBORING', label: '邻村调剂' },
  { value: 'AGENCY', label: '劳务合作社' },
  { value: 'OTHER', label: '其他来源' },
]
const SKILL_OPTIONS: Array<{ value: LaborWorkerSkill; label: string }> = [
  { value: 'HARVEST', label: '采收' },
  { value: 'MACHINE', label: '农机协作' },
  { value: 'DRIVER', label: '运输驾驶' },
  { value: 'MIXED', label: '综合工种' },
]
const WEEKDAY_OPTIONS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

function labelOf(options: Array<{ value: string; label: string }>, value?: string): string {
  return options.find((item) => item.value === value)?.label ?? value ?? '-'
}

function weekdaysToText(value?: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '每日'
  return value.split(',').map((item) => WEEKDAY_OPTIONS[Number(item) - 1]).filter(Boolean).join('、') || '每日'
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
    note: values.note?.trim() || undefined,
  }
}

interface LaborWorkerFormValues {
  workerNo: string
  workerName: string
  phone?: string
  sourceType: LaborWorkerSource
  sourceName?: string
  skillType: LaborWorkerSkill
  dailyWage: number
  availabilityRate: number
  dailyCapacity: number
  maxHours: number
  availableWeekdays: string[]
  availableRange?: [Dayjs, Dayjs]
  status: LaborWorkerStatus
  note?: string
}

export default function LaborWorkerLibrary(): JSX.Element {
  const { message } = AntdApp.useApp()
  const currentFarm = useFarmStore((state) => state.currentFarm)
  const farmId = currentFarm?.farmId
  const queryClient = useQueryClient()
  const [pageNum, setPageNum] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [keyword, setKeyword] = useState('')
  const [sourceType, setSourceType] = useState<LaborWorkerSource>()
  const [skillType, setSkillType] = useState<LaborWorkerSkill>()
  const [status, setStatus] = useState<LaborWorkerStatus | undefined>('ACTIVE')
  const [draftKeyword, setDraftKeyword] = useState('')
  const [draftSourceType, setDraftSourceType] = useState<LaborWorkerSource>()
  const [draftSkillType, setDraftSkillType] = useState<LaborWorkerSkill>()
  const [draftStatus, setDraftStatus] = useState<LaborWorkerStatus | undefined>('ACTIVE')
  const [targetDate, setTargetDate] = useState(dayjs())
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<LaborWorker | null>(null)
  const [form] = Form.useForm<LaborWorkerFormValues>()

  const listQuery = useQuery({
    queryKey: ['labor-workers', farmId, pageNum, pageSize, keyword, sourceType, skillType, status],
    enabled: Boolean(farmId),
    queryFn: () => listLaborWorkers({ farmId: farmId as string, pageNum, pageSize, keyword: keyword || undefined, sourceType, skillType, status }),
  })
  const summaryQuery = useQuery({
    queryKey: ['labor-workers-summary', farmId, targetDate.format('YYYY-MM-DD')],
    enabled: Boolean(farmId),
    queryFn: () => getLaborWorkerSummary(farmId as string, targetDate.format('YYYY-MM-DD')),
  })

  const invalidate = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: ['labor-workers', farmId] })
    await queryClient.invalidateQueries({ queryKey: ['labor-workers-summary', farmId] })
    await queryClient.invalidateQueries({ queryKey: ['harvest-window-overview', farmId] })
  }

  const createMutation = useMutation({
    mutationFn: (values: LaborWorkerFormValues) => createLaborWorker(toPayload(values, farmId as string)),
    onSuccess: async () => { message.success('劳务人员已加入人员库'); setModalOpen(false); await invalidate() },
    onError: (error: Error) => message.error(error.message || '新增失败'),
  })
  const updateMutation = useMutation({
    mutationFn: (values: LaborWorkerFormValues) => updateLaborWorker(editing?.id ?? '', toPayload(values, farmId as string)),
    onSuccess: async () => { message.success('劳务人员信息已更新'); setModalOpen(false); await invalidate() },
    onError: (error: Error) => message.error(error.message || '更新失败'),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteLaborWorker(id),
    onSuccess: async () => { message.success('劳务人员已移出人员库'); await invalidate() },
    onError: (error: Error) => message.error(error.message || '删除失败'),
  })

  const rows = listQuery.data?.list ?? []
  const summary = summaryQuery.data
  const total = listQuery.data?.total ?? 0
  const busy = createMutation.isPending || updateMutation.isPending

  const openCreate = (): void => {
    setEditing(null)
    form.setFieldsValue({ workerNo: '', workerName: '', sourceType: 'VILLAGE', skillType: 'HARVEST', dailyWage: 180, availabilityRate: 100, dailyCapacity: 1, maxHours: 8, availableWeekdays: ['1', '2', '3', '4', '5', '6', '7'], status: 'ACTIVE' })
    setModalOpen(true)
  }
  const openEdit = (row: LaborWorker): void => {
    setEditing(row)
    form.setFieldsValue({
      workerNo: row.workerNo, workerName: row.workerName, phone: row.phone, sourceType: row.sourceType, sourceName: row.sourceName,
      skillType: row.skillType, dailyWage: Number(row.dailyWage), availabilityRate: Number(row.availabilityRate), dailyCapacity: Number(row.dailyCapacity), maxHours: Number(row.maxHours),
      availableWeekdays: row.availableWeekdays?.split(',') ?? ['1', '2', '3', '4', '5', '6', '7'],
      availableRange: row.availableFrom && row.availableTo ? [dayjs(row.availableFrom), dayjs(row.availableTo)] : undefined,
      status: row.status, note: row.note,
    })
    setModalOpen(true)
  }
  const submit = async (): Promise<void> => {
    const values = await form.validateFields()
    if (editing) updateMutation.mutate(values)
    else createMutation.mutate(values)
  }
  const remove = (row: LaborWorker): void => {
    Modal.confirm({ title: `移出 ${row.workerName}？`, content: '移出后不会参与后续采收窗口用工计算，历史排程留痕不受影响。', okText: '移出人员库', cancelText: '取消', okButtonProps: { danger: true }, onOk: () => deleteMutation.mutateAsync(row.id) })
  }
  const toggleStatus = (row: LaborWorker, checked: boolean): void => {
    updateLaborWorker(row.id, { status: checked ? 'ACTIVE' : 'INACTIVE' }).then(async () => { message.success(checked ? '人员已启用' : '人员已停用'); await invalidate() }).catch((error: Error) => message.error(error.message || '状态更新失败'))
  }

  const handleSearch = (): void => {
    setKeyword(draftKeyword.trim())
    setSourceType(draftSourceType)
    setSkillType(draftSkillType)
    setStatus(draftStatus)
    setPageNum(1)
  }
  const handleReset = (): void => {
    setDraftKeyword('')
    setDraftSourceType(undefined)
    setDraftSkillType(undefined)
    setDraftStatus('ACTIVE')
    setKeyword('')
    setSourceType(undefined)
    setSkillType(undefined)
    setStatus('ACTIVE')
    setPageNum(1)
  }

  const columns: ColumnsType<LaborWorker> = [
    {
      title: '人员',
      key: 'worker',
      fixed: 'left',
      width: 190,
      ellipsis: true,
      render: (_, row) => (
        <span className="production-dense-name-wrap" title={`${row.workerName} (${row.workerNo})`}>
          <span className="lw-avatar">{row.workerName.slice(0, 1)}</span>
          <Typography.Text strong>{row.workerName}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{row.workerNo}</Typography.Text>
        </span>
      ),
    },
    {
      title: '来源',
      dataIndex: 'sourceType',
      width: 190,
      ellipsis: true,
      render: (value: LaborWorkerSource, row) => {
        const srcName = row.sourceName || '未注明'
        return (
          <span className="production-dense-name-wrap" title={`${labelOf(SOURCE_OPTIONS, value)} · ${srcName}`}>
            <Tag color={value === 'VILLAGE' ? 'green' : value === 'NEIGHBORING' ? 'blue' : 'gold'}>
              {labelOf(SOURCE_OPTIONS, value)}
            </Tag>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>{srcName}</Typography.Text>
          </span>
        )
      },
    },
    { title: '技能', dataIndex: 'skillType', width: 110, ellipsis: true, render: (value: LaborWorkerSkill) => labelOf(SKILL_OPTIONS, value) },
    { title: '日薪', dataIndex: 'dailyWage', width: 100, align: 'right', render: (value: number) => `${Number(value).toFixed(0)} 元` },
    { title: '可到岗率', dataIndex: 'availabilityRate', width: 100, align: 'right', render: (value: number) => `${Number(value).toFixed(0)}%` },
    { title: '工时上限', dataIndex: 'maxHours', width: 105, align: 'right', render: (value: number) => `${Number(value).toFixed(1)} 小时` },
    {
      title: '可用日期',
      dataIndex: 'availableWeekdays',
      width: 210,
      ellipsis: true,
      render: (value: string, row) => {
        const rangeText = row.availableFrom || row.availableTo ? `${row.availableFrom || '不限'} 至 ${row.availableTo || '不限'}` : '长期有效'
        const full = `${weekdaysToText(value)}（${rangeText}）`
        return <span className="production-dense-link-ellipsis" title={full}>{full}</span>
      },
    },
    { title: '状态', dataIndex: 'status', width: 96, render: (value: LaborWorkerStatus, row) => <Switch size="small" checked={value === 'ACTIVE'} checkedChildren="在册" unCheckedChildren="停用" onChange={(checked) => toggleStatus(row, checked)} /> },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      width: 140,
      render: (_, row) => (
        <ListRowActions>
          <Button key="edit" type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>编辑</Button>
          <Button key="remove" type="link" danger size="small" icon={<UserDeleteOutlined />} onClick={() => remove(row)}>移出</Button>
        </ListRowActions>
      ),
    },
  ]

  if (!farmId) return <PageContainer title="劳务人员库"><Empty description="请先在顶部选择当前农场" /></PageContainer>

  return <PageContainer
    className="labor-worker-page production-list-dense production-member-list"
    title="劳务人员库"
    subTitle={
      <span className="production-dense-summary-inline">
        <span className="production-dense-metric">
          <span className="production-dense-metric-label">在册</span>
          <span className="production-dense-metric-value">{summary?.activeCount ?? 0} 人</span>
        </span>
        <span className="production-dense-metric">
          <span className="production-dense-metric-label">当日可到岗</span>
          <span className="production-dense-metric-value is-success">{summary?.availableCount ?? 0} 人</span>
        </span>
        <span className="production-dense-metric">
          <span className="production-dense-metric-label">本村</span>
          <span className="production-dense-metric-value">{summary?.villageAvailable ?? 0} 人</span>
        </span>
        <span className="production-dense-metric">
          <span className="production-dense-metric-label">邻村调剂</span>
          <span className="production-dense-metric-value">{summary?.neighboringAvailable ?? 0} 人</span>
        </span>
        <span className="production-dense-metric">
          <span className="production-dense-metric-label">均薪</span>
          <span className="production-dense-metric-value">{Number(summary?.averageDailyWage ?? 0).toFixed(0)} 元/人</span>
        </span>
      </span>
    }
    extra={
      <Space size={8}>
        <Tooltip title="这里维护季节性、临时性劳务人员的来源、技能与可到岗能力，供采收窗口决策计算每日用工和跨村调剂。长期组织成员与角色权限仍在“团队与人员”中维护。">
          <span className="production-dense-summary-note">口径日期</span>
        </Tooltip>
        <DatePicker size="small" value={targetDate} onChange={(value) => value && setTargetDate(value)} allowClear={false} />
      </Space>
    }
  >
    <Card className="production-dense-filter-card">
      <div className="production-filter-grid">
        <div className="production-filter-field">
          <label>关键字</label>
          <Input
            placeholder="姓名 / 编号 / 手机号 / 来源"
            allowClear
            value={draftKeyword}
            onChange={(event) => setDraftKeyword(event.target.value)}
            onPressEnter={handleSearch}
          />
        </div>
        <div className="production-filter-field">
          <label>来源</label>
          <Select allowClear placeholder="全部来源" value={draftSourceType} onChange={setDraftSourceType} options={SOURCE_OPTIONS} />
        </div>
        <div className="production-filter-field">
          <label>技能</label>
          <Select allowClear placeholder="全部技能" value={draftSkillType} onChange={setDraftSkillType} options={SKILL_OPTIONS} />
        </div>
        <div className="production-filter-field">
          <label>状态</label>
          <Select
            allowClear
            placeholder="全部状态"
            value={draftStatus}
            onChange={setDraftStatus}
            options={[{ value: 'ACTIVE', label: '在册人员' }, { value: 'INACTIVE', label: '已停用' }]}
          />
        </div>
        <div className="production-filter-actions">
          <Button onClick={handleReset}>重置</Button>
          <Button type="primary" onClick={handleSearch}>查询</Button>
        </div>
      </div>
    </Card>

    <Card className="lw-table-card">
      <BusinessRecordList<LaborWorker>
        memberListToolbar
        columnWidthStorageKey="labor-worker-library"
        rowKey="id"
        loading={listQuery.isLoading}
        dataSource={rows}
        columns={columns}
        onReload={() => invalidate()}
        rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
        toolbarTitle={
          <Space size={8} wrap>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增劳务人员</Button>
          </Space>
        }
        scroll={{ x: 1250 }}
        locale={{ emptyText: '当前筛选下暂无劳务人员，请调整条件或新增劳务人员' }}
        pagination={{
          current: pageNum,
          pageSize,
          total,
          onChange: (page, size) => { setPageNum(page); setPageSize(size) },
        }}
      />
    </Card>
    <Modal title={editing ? '编辑劳务人员' : '新增劳务人员'} open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => void submit()} okText="保存到人员库" cancelText="取消" confirmLoading={busy} width={720} destroyOnClose>
      <Form form={form} layout="vertical" preserve={false}><Row gutter={16}><Col span={12}><Form.Item name="workerNo" label="劳务编号" rules={[{ required: true, message: '请输入劳务编号' }]}><Input placeholder="如 LW-013" /></Form.Item></Col><Col span={12}><Form.Item name="workerName" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}><Input /></Form.Item></Col><Col span={12}><Form.Item name="phone" label="联系电话"><Input /></Form.Item></Col><Col span={12}><Form.Item name="sourceType" label="来源" rules={[{ required: true }]}><Select options={SOURCE_OPTIONS} /></Form.Item></Col><Col span={12}><Form.Item name="sourceName" label="来源名称"><Input placeholder="如本村劳务队、丰收劳务合作社" /></Form.Item></Col><Col span={12}><Form.Item name="skillType" label="主要技能" rules={[{ required: true }]}><Select options={SKILL_OPTIONS} /></Form.Item></Col><Col span={8}><Form.Item name="dailyWage" label="日薪（元）" rules={[{ required: true }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col><Col span={8}><Form.Item name="availabilityRate" label="可到岗率（%）" rules={[{ required: true }]}><InputNumber min={0} max={100} style={{ width: '100%' }} /></Form.Item></Col><Col span={8}><Form.Item name="maxHours" label="单日工时上限" rules={[{ required: true }]}><InputNumber min={1} max={24} step={0.5} style={{ width: '100%' }} /></Form.Item></Col><Col span={12}><Form.Item name="availableWeekdays" label="可用星期" rules={[{ required: true, type: 'array', min: 1, message: '至少选择一天' }]}><Select mode="multiple" options={WEEKDAY_OPTIONS.map((label, index) => ({ label, value: String(index + 1) }))} /></Form.Item></Col><Col span={12}><Form.Item name="availableRange" label="可用日期范围"><DatePicker.RangePicker style={{ width: '100%' }} /></Form.Item></Col><Col span={12}><Form.Item name="status" label="状态" rules={[{ required: true }]}><Select options={[{ value: 'ACTIVE', label: '在册' }, { value: 'INACTIVE', label: '停用' }]} /></Form.Item></Col><Col span={24}><Form.Item name="note" label="备注"><Input.TextArea rows={2} maxLength={500} showCount /></Form.Item></Col></Row></Form>
    </Modal>
  </PageContainer>
}
