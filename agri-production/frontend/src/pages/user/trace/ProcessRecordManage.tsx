import Card from '@/components/SectionCard'
import '@/pages/user/quality/quality-trace.css'
import ProTable from '@/components/ProductionTable'
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
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import PageContainer from '@/components/ProductionPageContainer'
import type { ProColumns } from '@ant-design/pro-components'
import {
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Tag,
} from 'antd'
import {
  createProcess,
  deleteProcess,
  listProcessByBatch,
  PROCESS_STATUS,
  PROCESS_TYPES,
  updateProcess,
  type ProcessRecord,
  type ProcessSavePayload,
} from '@/api/process'
import { listHarvests } from '@/api/harvests'

const typeLabel = (value?: string) =>
  PROCESS_TYPES.find((item) => item.value === value)?.label ?? value ?? '—'

const statusColor: Record<string, string> = { DONE: 'green', DOING: 'blue', CANCELED: 'default' }

/**
 * 表单值形状。
 *
 * antd v5 的 DatePicker 没有 valueFormat（那是 element-plus 的写法），拿到的是 dayjs 对象，
 * 因此**在提交时**统一转成后端要的 ISO 字符串、回填时反向 parse 成 dayjs。
 */
interface ProcessFormValues extends Omit<ProcessSavePayload, 'startedAt' | 'finishedAt'> {
  startedAt?: Dayjs | string
  finishedAt?: Dayjs | string
}

const toIso = (value?: Dayjs | string): string | undefined => {
  if (!value) return undefined
  if (typeof value === 'string') return value
  return value.format('YYYY-MM-DDTHH:mm:ss')
}

const toDayjs = (value?: string) => (value ? dayjs(value) : undefined)

export default function ProcessRecordManage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [batchNo, setBatchNo] = useState<string>('')
  const [editing, setEditing] = useState<ProcessRecord | null>(null)
  const [creating, setCreating] = useState(false)
  const [form] = Form.useForm<ProcessFormValues>()

  const batches = useQuery({
    queryKey: ['harvest-batches-for-process'],
    queryFn: () => listHarvests({ pageNum: 1, pageSize: 100 }),
  })

  const batchOptions = useMemo(
    // 响应拦截器已把后端 records 归一为 list（见 @agri/shared PageResult 注释），取 records 会永远是空的
    () => (batches.data?.list ?? []).map((b) => ({
      value: b.batchNo ?? String(b.batchId ?? ''),
      label: `${b.batchNo ?? '—'} · ${b.cropName ?? '未填作物'}`
        + (b.harvestDate ? ` · 采收 ${b.harvestDate}` : ''),
    })).filter((option) => !!option.value),
    [batches.data],
  )

  const activeBatch = batchNo || batchOptions[0]?.value || ''

  const records = useQuery({
    queryKey: ['process-records', activeBatch],
    queryFn: () => listProcessByBatch(activeBatch),
    enabled: !!activeBatch,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['process-records'] })

  const save = useMutation({
    mutationFn: async (values: ProcessFormValues) => {
      const payload: ProcessSavePayload = {
        ...values,
        batchId: values.batchId || activeBatch,
        startedAt: toIso(values.startedAt),
        finishedAt: toIso(values.finishedAt),
      }
      return editing ? updateProcess(editing.id, payload) : createProcess(payload)
    },
    onSuccess: (row) => {
      message.success(editing ? `加工记录已更新：${row.processCode}` : `已登记加工工序：${row.processCode}`)
      setEditing(null)
      setCreating(false)
      form.resetFields()
      refresh()
    },
    // 后端拒绝时必须看到原因（词表不对、批次不是本主体、结束早于开始…），静默失败最误导
    onError: (err: Error) => message.error(err.message || '保存失败'),
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteProcess(id),
    onSuccess: () => {
      message.success('加工记录已删除')
      refresh()
    },
    onError: (err: Error) => message.error(err.message || '删除失败'),
  })

  const openForm = (row: ProcessRecord | null) => {
    const target = row ?? null
    setEditing(target)
    setCreating(!target)
    form.resetFields()
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
        remark: target.remark,
      })
    } else {
      form.setFieldsValue({ batchId: activeBatch, status: 'DONE' })
    }
  }

  const columns: ProColumns<ProcessRecord>[] = [
    { title: '加工单号', dataIndex: 'processCode', width: 160 },
    {
      title: '类型',
      dataIndex: 'processType',
      width: 110,
      render: (_, row) => <Tag>{typeLabel(row.processType)}</Tag>,
    },
    { title: '工序名称', dataIndex: 'processName', render: (_, r) => r.processName || '—' },
    { title: '场地', dataIndex: 'location', width: 140, render: (_, r) => r.location || '—' },
    { title: '操作人', dataIndex: 'operatorName', width: 100, render: (_, r) => r.operatorName || '—' },
    { title: '开始', dataIndex: 'startedAt', width: 160, render: (_, r) => r.startedAt?.replace('T', ' ').slice(0, 16) ?? '—' },
    { title: '结束', dataIndex: 'finishedAt', width: 160, render: (_, r) => r.finishedAt?.replace('T', ' ').slice(0, 16) ?? '—' },
    {
      title: '投入 → 产出',
      dataIndex: 'inputQuantity',
      width: 170,
      // 损耗只在投入产出都填了且同单位时由后端算；null 就如实显示"—"，不拿 0 冒充
      render: (_, r) => (r.inputQuantity != null || r.outputQuantity != null
        ? `${r.inputQuantity ?? '—'}${r.inputUnit ?? ''} → ${r.outputQuantity ?? '—'}${r.outputUnit ?? ''}
           ${r.lossQuantity != null ? `（损耗 ${r.lossQuantity}${r.inputUnit ?? ''}）` : ''}`.replace(/\s+/g, ' ')
        : '—'),
    },
    { title: '工艺参数', dataIndex: 'processParams', ellipsis: true, render: (_, r) => r.processParams || '—' },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (_, r) => <Tag color={statusColor[r.status] ?? 'default'}>{PROCESS_STATUS.find((s) => s.value === r.status)?.label ?? r.status}</Tag>,
    },
    {
      title: '操作',
      fixed: 'right',
      dataIndex: 'action',
      width: 130,
      render: (_, row) => (
        <Space size={4}>
          <Button size="small" type="link" onClick={() => openForm(row)}>编辑</Button>
          <Popconfirm title="删除该加工记录？" onConfirm={() => remove.mutate(row.id)}>
            <Button size="small" type="link" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <PageContainer className="quality-trace-page"
      header={{ title: '加工记录', onBack: undefined }}
      extra={[
        <Button key="chain" onClick={() => navigate('/production/trace/full-chain')}>查看全链路</Button>,
        <Button key="new" type="primary" onClick={() => openForm(null)} disabled={!activeBatch}>登记加工工序</Button>,
      ]}
    >
      <Card style={{ marginBottom: 16 }}><Space wrap>
        <span>采收批次</span>
        <Select
          style={{ minWidth: 320 }}
          placeholder={batches.isLoading ? '加载中…' : '选择批次'}
          loading={batches.isLoading}
          value={activeBatch || undefined}
          options={batchOptions}
          onChange={(value) => setBatchNo(value)}
          showSearch
        />
        {!activeBatch && !batches.isLoading && (
          <span style={{ color: '#c54b4b' }}>
            本主体名下没有采收批次：请先到「采收管理」登记批次，加工工序必须挂在真实批次上。
          </span>
        )}
      </Space></Card>

      <ProTable<ProcessRecord>
        rowKey="id"
        search={false}
        pagination={false}
        toolBarRender={false}
        loading={records.isFetching}
        columns={columns}
        dataSource={records.data ?? []}
        locale={{
          emptyText: activeBatch
            ? '该批次还没有登记加工工序（消费者详情页的加工环节因此为空，链路照实只显示到采收）'
            : '请先选择采收批次',
        }}
      />

      <Modal className="quality-trace-dialog"
        open={creating || !!editing}
        title={editing ? `编辑加工记录 ${editing.processCode}` : '登记加工工序'}
        onCancel={() => { setCreating(false); setEditing(null) }}
        onOk={() => form.submit()}
        confirmLoading={save.isPending}
        width={720}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(values) => save.mutate(values)}>
          <Form.Item name="batchId" label="采收批次" rules={[{ required: true, message: '请选择采收批次' }]}>
            <Select options={batchOptions} showSearch />
          </Form.Item>
          <Form.Item name="processType" label="加工类型" rules={[{ required: true, message: '请选择加工类型' }]}>
            <Select options={PROCESS_TYPES.map((t) => ({ value: t.value, label: t.label }))} />
          </Form.Item>
          <Form.Item name="processName" label="工序名称"><Input placeholder="如：采后预冷与分级装箱" /></Form.Item>
          <Form.Item name="location" label="加工场地"><Input placeholder="如：A区分装车间" /></Form.Item>
          <Form.Item name="operatorName" label="操作人"><Input /></Form.Item>
          <Form.Item name="startedAt" label="开始时间">
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="finishedAt" label="结束时间">
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Space align="start" wrap>
            <Form.Item name="inputQuantity" label="投入量"><InputNumber min={0} step={0.01} /></Form.Item>
            <Form.Item name="inputUnit" label="投入单位"><Input style={{ width: 90 }} placeholder="kg" /></Form.Item>
            <Form.Item name="outputQuantity" label="产出量"><InputNumber min={0} step={0.01} /></Form.Item>
            <Form.Item name="outputUnit" label="产出单位"><Input style={{ width: 90 }} placeholder="kg" /></Form.Item>
          </Space>
          <Form.Item name="processParams" label="工艺参数"><Input.TextArea rows={2} placeholder="照实记录，如：冷风预冷至果心 8℃，历时 3.5 小时" /></Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={PROCESS_STATUS.map((s) => ({ value: s.value, label: s.label }))} />
          </Form.Item>
          <Form.Item name="remark" label="备注"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  )
}
