/**
 * 页面名称：出入库管理
 * 路由路径：/production/inputs/stock
 * 所属模块：农资投入品管理
 * PRD 序号：PRD 6.1 #21「出入库管理」（原型未覆盖，按 PRD 7.2 闭环与 11.2.4 表结构实现）
 *
 * 实现要点：
 * - 四类作业：入库（flow_type 1）/ 领用（2）/ 退回（3）/ 盘点（4 盘盈 · 5 盘亏 · 6 报损）
 * - 入库与领用走后端 /stock-in、/consume，流水与库存原子联动
 * - 退回 / 盘点走 /stock-flows 写流水，并同步校正投入品库存
 * - 库存总览：按剩余量升序，低库存置顶，含预警阈值与库存状态
 * - 流水查询：按类型 / 批次号 / 日期区间筛选，支持导出
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageContainer, ProTable } from '@ant-design/pro-components'
import type { ProColumns } from '@ant-design/pro-components'
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Segmented,
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
  message,
} from 'antd'
import { DownloadOutlined, InboxOutlined, ReconciliationOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import useFarmStore from '@/store/farm'
import { listMembers } from '@/api/members'
import { fetchTaskPage } from '@/api/tasks'
import {
  consume,
  createStockFlow,
  fetchInputStockOverview,
  fetchInputWarning,
  pageInputs,
  pageStockFlows,
  stockIn,
  updateInputInfo,
} from '@/api/inputs'
import type { InputInfo, InputStockFlow } from '@/api/inputs'
import type { Member, Task } from '@/types'
import {
  FLOW_TYPE_OPTIONS,
  STOCK_STATE_META,
  STOCK_STATE_OPTIONS,
  categoryMeta,
  downloadCsv,
  fmtDate,
  fmtNumber,
  flowTypeMeta,
  resolveStockState,
} from './shared'
import type { StockState } from './shared'

/** 作业弹窗类型 */
type ActionKey = 'in' | 'consume' | 'return' | 'check' | null

/** 流水筛选条件 */
interface FlowFilters {
  /** 流水类型 */
  flowType?: number
  /** 批次号 */
  batchNo?: string
  /** 日期区间 */
  dateRange?: [Dayjs, Dayjs]
}

/** 入库表单值 */
interface StockInForm {
  inputId?: string
  qty?: number
  batchNo?: string
  expireDate?: Dayjs
  operatorId?: string
  remark?: string
}

/** 领用表单值 */
interface ConsumeForm {
  inputId?: string
  qty?: number
  relatedTaskId?: string
  operatorId?: string
  remark?: string
}

/** 退回表单值 */
interface ReturnForm {
  inputId?: string
  qty?: number
  batchNo?: string
  expireDate?: Dayjs
  relatedTaskId?: string
  operatorId?: string
  remark?: string
}

/** 盘点表单值 */
interface CheckForm {
  inputId?: string
  actualQty?: number
  flowType?: number
  operatorId?: string
  remark?: string
}

/** 日期归一：截取 yyyy-MM-dd 前缀 */
function dateKey(value?: string): string {
  return (value ?? '').slice(0, 10)
}

/**
 * 出入库管理页
 *
 * 业务职责：投入品入库 / 领用 / 退回 / 盘点四类作业，库存总览与流水查询。
 *
 * @returns 页面内容
 */
export default function InputStock(): JSX.Element {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const currentFarm = useFarmStore((state) => state.currentFarm)
  const farmId = currentFarm?.farmId

  const [action, setAction] = useState<ActionKey>(null)
  const [pageNum, setPageNum] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(20)
  const [filters, setFilters] = useState<FlowFilters>({})
  const [filterForm] = Form.useForm<FlowFilters>()

  const [inForm] = Form.useForm<StockInForm>()
  const [consumeForm] = Form.useForm<ConsumeForm>()
  const [returnForm] = Form.useForm<ReturnForm>()
  const [checkForm] = Form.useForm<CheckForm>()
  const [checkInputId, setCheckInputId] = useState<string | undefined>(undefined)
  const [checkActual, setCheckActual] = useState<number | undefined>(undefined)

  /** 投入品档案 */
  const inputsQuery = useQuery({
    queryKey: ['production-inputs', 'archive'],
    queryFn: () => pageInputs({ pageNum: 1, pageSize: 500 }),
  })

  /** 库存总览（低库存优先） */
  const stockQuery = useQuery({
    queryKey: ['production-inputs', 'stock-overview'],
    queryFn: () => fetchInputStockOverview(),
  })

  /** 低库存预警清单 */
  const warningQuery = useQuery({
    queryKey: ['production-inputs', 'stock-warning'],
    queryFn: () => fetchInputWarning(),
  })

  /** 出入库流水（按投入品逐项拉取后合并） */
  const flowsQuery = useQuery({
    queryKey: ['production-inputs', 'all-stock-flows'],
    queryFn: async () => {
      const inputs = await pageInputs({ pageNum: 1, pageSize: 100 })
      const targets = inputs.list.slice(0, 50)
      const lists = await Promise.all(
        targets.map((input) => pageStockFlows(input.inputId, { pageNum: 1, pageSize: 100 })),
      )
      return lists.flatMap((page) => page.list ?? [])
    },
  })

  /** 成员下拉 */
  const membersQuery = useQuery({
    queryKey: ['member-options', farmId],
    enabled: Boolean(farmId),
    queryFn: () => listMembers({ farmId, pageNum: 1, pageSize: 200 }),
  })

  /** 农事任务下拉（领用必填关联任务） */
  const tasksQuery = useQuery({
    queryKey: ['task-options', farmId],
    enabled: Boolean(farmId),
    queryFn: () => fetchTaskPage({ farmId, pageNum: 1, pageSize: 200 }),
  })

  /** 统一刷新 */
  const invalidateAll = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: ['production-inputs'] })
  }

  const inputMap = useMemo<Map<string, InputInfo>>(() => {
    const map = new Map<string, InputInfo>()
    ;(inputsQuery.data?.list ?? []).forEach((item) => map.set(item.inputId, item))
    return map
  }, [inputsQuery.data])

  const inputOptions = useMemo(
    () =>
      (inputsQuery.data?.list ?? []).map((item) => ({
        value: item.inputId,
        label: `${item.inputName ?? item.inputId}${item.spec ? `（${item.spec}）` : ''}`,
      })),
    [inputsQuery.data],
  )

  const memberOptions = useMemo(
    () =>
      (membersQuery.data?.list ?? []).map((member: Member) => ({
        value: member.memberId,
        label: member.realName,
      })),
    [membersQuery.data],
  )

  const taskOptions = useMemo(
    () =>
      (tasksQuery.data?.list ?? []).map((task: Task) => ({
        value: task.taskId,
        label: task.taskName ?? task.taskNo ?? task.taskId,
      })),
    [tasksQuery.data],
  )

  /** 入库作业 */
  const stockInMutation = useMutation({
    mutationFn: (values: StockInForm) =>
      stockIn(String(values.inputId), {
        qty: values.qty ?? 0,
        batchNo: values.batchNo,
        expireDate: values.expireDate ? values.expireDate.format('YYYY-MM-DD') : undefined,
        operatorId: values.operatorId,
      }),
    onSuccess: () => {
      message.success('入库成功，库存已更新')
      setAction(null)
      inForm.resetFields()
      void invalidateAll()
    },
  })

  /** 领用作业 */
  const consumeMutation = useMutation({
    mutationFn: (values: ConsumeForm) =>
      consume(String(values.inputId), {
        qty: values.qty ?? 0,
        relatedTaskId: values.relatedTaskId,
        operatorId: values.operatorId,
      }),
    onSuccess: () => {
      message.success('领用成功，库存已扣减')
      setAction(null)
      consumeForm.resetFields()
      void invalidateAll()
    },
  })

  /** 退回作业：写流水 + 回补库存 */
  const returnMutation = useMutation({
    mutationFn: async (values: ReturnForm) => {
      const inputId = String(values.inputId)
      const qty = values.qty ?? 0
      await createStockFlow(inputId, {
        inputId,
        flowType: 3,
        qty,
        batchNo: values.batchNo,
        expireDate: values.expireDate ? values.expireDate.format('YYYY-MM-DD') : undefined,
        operatorId: values.operatorId,
        relatedTaskId: values.relatedTaskId,
        remark: values.remark,
      })
      const current = inputMap.get(inputId)?.stockQty ?? 0
      await updateInputInfo(inputId, { stockQty: Number((current + qty).toFixed(3)) })
    },
    onSuccess: () => {
      message.success('退回成功，库存已回补')
      setAction(null)
      returnForm.resetFields()
      void invalidateAll()
    },
  })

  /** 盘点作业：按差异生成盘盈 / 盘亏 / 报损流水并校正库存 */
  const checkMutation = useMutation({
    mutationFn: async (values: CheckForm) => {
      const inputId = String(values.inputId)
      const systemQty = inputMap.get(inputId)?.stockQty ?? 0
      const actualQty = values.actualQty ?? 0
      const diff = Number((actualQty - systemQty).toFixed(3))
      const flowType = values.flowType ?? (diff > 0 ? 4 : 5)
      await createStockFlow(inputId, {
        inputId,
        flowType,
        qty: Math.abs(diff),
        operatorId: values.operatorId,
        remark: values.remark ?? `库存盘点：系统 ${systemQty} → 实盘 ${actualQty}`,
      })
      await updateInputInfo(inputId, { stockQty: actualQty })
    },
    onSuccess: () => {
      message.success('盘点完成，库存已校正')
      setAction(null)
      checkForm.resetFields()
      setCheckInputId(undefined)
      setCheckActual(undefined)
      void invalidateAll()
    },
  })

  /** 库存状态筛选：全部 / 正常 / 预警 / 临期 / 不足 */
  const [stockState, setStockState] = useState<StockState | 'all'>('all')

  /** 库存总览原始行（后端已按剩余量升序返回，低库存置顶） */
  const allStockRows = useMemo<InputInfo[]>(() => stockQuery.data ?? [], [stockQuery.data])

  /** 库存总览行（按四态筛选后） */
  const stockRows = useMemo<InputInfo[]>(() => {
    if (stockState === 'all') return allStockRows
    return allStockRows.filter(
      (item) =>
        resolveStockState(item.stockQty, item.warnQty, item.nearestExpireDate) === stockState,
    )
  }, [allStockRows, stockState])

  /** 各状态数量（筛选器角标） */
  const stockStateCounts = useMemo<Record<StockState | 'all', number>>(() => {
    const counts: Record<StockState | 'all', number> = {
      all: allStockRows.length,
      normal: 0,
      warning: 0,
      expiring: 0,
      shortage: 0,
    }
    allStockRows.forEach((item) => {
      counts[resolveStockState(item.stockQty, item.warnQty, item.nearestExpireDate)] += 1
    })
    return counts
  }, [allStockRows])

  /** 临期批次（30 天内到期） */
  const expiringCount = useMemo(() => {
    const limit = dayjs().add(30, 'day').format('YYYY-MM-DD')
    return (flowsQuery.data ?? []).filter((flow) => {
      if (!flow.expireDate) return false
      const key = dateKey(flow.expireDate)
      return key >= dayjs().format('YYYY-MM-DD') && key <= limit
    }).length
  }, [flowsQuery.data])

  /** 本月流水笔数 */
  const monthFlowCount = useMemo(() => {
    const start = dayjs().startOf('month').format('YYYY-MM-DD')
    return (flowsQuery.data ?? []).filter((flow) => dateKey(flow.createdAt) >= start).length
  }, [flowsQuery.data])

  /** 流水行（含投入品名称） */
  const flowRows = useMemo<(InputStockFlow & { inputLabel: string })[]>(() => {
    const start = filters.dateRange?.[0]?.format('YYYY-MM-DD')
    const end = filters.dateRange?.[1]?.format('YYYY-MM-DD')
    const batchNo = (filters.batchNo ?? '').trim()
    return (flowsQuery.data ?? [])
      .filter((flow) => {
        if (filters.flowType && flow.flowType !== filters.flowType) return false
        if (start && dateKey(flow.createdAt) < start) return false
        if (end && dateKey(flow.createdAt) > end) return false
        if (batchNo && !(flow.batchNo ?? '').includes(batchNo)) return false
        return true
      })
      .map((flow) => ({
        ...flow,
        inputLabel: (flow.inputId ? inputMap.get(flow.inputId)?.inputName : undefined) ?? flow.inputId ?? '-',
      }))
      .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
  }, [flowsQuery.data, inputMap, filters])

  const pagedFlows = useMemo(
    () => flowRows.slice((pageNum - 1) * pageSize, pageNum * pageSize),
    [flowRows, pageNum, pageSize],
  )

  /** 库存总览列 */
  const stockColumns: ProColumns<InputInfo>[] = [
    {
      title: '投入品',
      key: 'inputName',
      width: 180,
      render: (_, record) => (
        <Typography.Link onClick={() => navigate(`/production/inputs/${record.inputId}`)}>
          {record.inputName ?? '-'}
        </Typography.Link>
      ),
    },
    {
      title: '分类',
      key: 'inputType',
      width: 90,
      render: (_, record) => {
        const meta = categoryMeta(record.inputType)
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    { title: '规格', key: 'spec', width: 120, render: (_, record) => record.spec ?? '-' },
    {
      title: '当前库存',
      key: 'stockQty',
      width: 130,
      render: (_, record) => `${fmtNumber(record.stockQty)} ${record.unit ?? ''}`,
    },
    {
      title: '预警阈值',
      key: 'warnQty',
      width: 120,
      render: (_, record) =>
        record.warnQty === undefined || record.warnQty === null
          ? '-'
          : `${fmtNumber(record.warnQty)} ${record.unit ?? ''}`,
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_, record) => {
        const state = resolveStockState(record.stockQty, record.warnQty, record.nearestExpireDate)
        const meta = STOCK_STATE_META[state]
        return <Tag color={meta.tagColor}>{meta.label}</Tag>
      },
    },
    {
      title: '操作',
      key: 'option',
      width: 160,
      valueType: 'option',
      render: (_, record) => [
        <Typography.Link
          key="in"
          onClick={() => {
            setAction('in')
            inForm.setFieldsValue({ inputId: record.inputId })
          }}
        >
          入库
        </Typography.Link>,
        <Typography.Link
          key="consume"
          onClick={() => {
            setAction('consume')
            consumeForm.setFieldsValue({ inputId: record.inputId })
          }}
        >
          领用
        </Typography.Link>,
        <Typography.Link
          key="detail"
          onClick={() => navigate(`/production/inputs/${record.inputId}`)}
        >
          明细
        </Typography.Link>,
      ],
    },
  ]

  /** 流水列 */
  const flowColumns: ProColumns<InputStockFlow & { inputLabel: string }>[] = [
    {
      title: '时间',
      key: 'createdAt',
      width: 160,
      render: (_, record) => fmtDate(record.createdAt, 'YYYY-MM-DD HH:mm'),
    },
    {
      title: '投入品',
      key: 'inputLabel',
      width: 160,
      render: (_, record) => (
        <Typography.Link onClick={() => navigate(`/production/inputs/${record.inputId ?? ''}`)}>
          {record.inputLabel}
        </Typography.Link>
      ),
    },
    {
      title: '类型',
      key: 'flowType',
      width: 90,
      render: (_, record) => {
        const meta = flowTypeMeta(record.flowType)
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: '数量',
      key: 'qty',
      width: 120,
      render: (_, record) => {
        const meta = flowTypeMeta(record.flowType)
        return (
          <Typography.Text type={meta.direction === 1 ? 'success' : 'danger'}>
            {meta.direction === 1 ? '+' : '-'}
            {fmtNumber(Math.abs(record.qty ?? 0))}
          </Typography.Text>
        )
      },
    },
    { title: '批次号', key: 'batchNo', width: 140, render: (_, record) => record.batchNo ?? '-' },
    {
      title: '有效期至',
      key: 'expireDate',
      width: 120,
      render: (_, record) => fmtDate(record.expireDate),
    },
    {
      title: '操作人',
      key: 'operatorId',
      width: 110,
      render: (_, record) => record.operatorId ?? '-',
    },
    {
      title: '关联任务',
      key: 'relatedTaskId',
      width: 160,
      render: (_, record) => record.relatedTaskId ?? '-',
    },
    { title: '备注', key: 'remark', render: (_, record) => record.remark ?? '-' },
  ]

  /** 查询 */
  const handleSearch = (): void => {
    setPageNum(1)
    setFilters(filterForm.getFieldsValue())
  }

  /** 重置 */
  const handleReset = (): void => {
    filterForm.resetFields()
    setPageNum(1)
    setFilters({})
  }

  /** 导出流水 */
  const handleExport = (): void => {
    if (flowRows.length === 0) {
      message.warning('暂无可导出的数据')
      return
    }
    downloadCsv(
      '投入品出入库流水',
      ['时间', '投入品', '类型', '数量', '批次号', '有效期至', '操作人', '关联任务', '备注'],
      flowRows.map((row) => [
        fmtDate(row.createdAt, 'YYYY-MM-DD HH:mm'),
        row.inputLabel,
        flowTypeMeta(row.flowType).label,
        fmtNumber(row.qty),
        row.batchNo ?? '',
        fmtDate(row.expireDate),
        row.operatorId ?? '',
        row.relatedTaskId ?? '',
        row.remark ?? '',
      ]),
    )
  }

  /** 盘点差异与推荐类型 */
  const checkDiff = useMemo(() => {
    if (!checkInputId) return 0
    const systemQty = inputMap.get(checkInputId)?.stockQty ?? 0
    return Number(((checkActual ?? systemQty) - systemQty).toFixed(3))
  }, [checkInputId, checkActual, inputMap])

  const loading = inputsQuery.isFetching || stockQuery.isFetching || flowsQuery.isFetching
  const isError = inputsQuery.isError || stockQuery.isError || flowsQuery.isError
  const warningCount = (warningQuery.data ?? []).length

  return (
    <PageContainer
      title="📦 投入品出入库管理"
      subTitle={currentFarm ? currentFarm.farmName : undefined}
      extra={[
        <Button
          key="in"
          type="primary"
          icon={<InboxOutlined />}
          onClick={() => setAction('in')}
        >
          入库
        </Button>,
        <Button key="consume" onClick={() => setAction('consume')}>
          领用
        </Button>,
        <Button key="return" onClick={() => setAction('return')}>
          退回
        </Button>,
        <Button
          key="check"
          icon={<ReconciliationOutlined />}
          onClick={() => setAction('check')}
        >
          盘点
        </Button>,
      ]}
    >
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="在库投入品" value={allStockRows.length} suffix="种" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="低库存预警"
              value={warningCount}
              suffix="种"
              valueStyle={{ color: warningCount > 0 ? '#cf1322' : undefined }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="30 天内到期批次"
              value={expiringCount}
              suffix="个"
              valueStyle={{ color: expiringCount > 0 ? '#fa8c16' : undefined }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="本月流水" value={monthFlowCount} suffix="笔" />
          </Card>
        </Col>
      </Row>

      {warningCount > 0 && (
        <Alert
          style={{ marginBottom: 16 }}
          type="warning"
          showIcon
          message={`⚠️ 库存预警：${warningCount} 种投入品库存已低于预警阈值，请及时补货（R-INPUT-05）`}
        />
      )}

      <Card
        title="🏪 库存总览（低库存优先）"
        style={{ marginBottom: 16 }}
        extra={
          <Segmented
            value={stockState}
            onChange={(value) => setStockState(value as StockState | 'all')}
            options={STOCK_STATE_OPTIONS.map((option) => ({
              value: option.value,
              label: `${option.label}(${stockStateCounts[option.value]})`,
            }))}
          />
        }
      >
        <ProTable<InputInfo>
          rowKey="inputId"
          columns={stockColumns}
          dataSource={stockRows}
          loading={loading}
          search={false}
          options={{ reload: () => void invalidateAll(), density: true, setting: true }}
          pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 种` }}
        />
      </Card>

      <Card title="📋 出入库流水">
        <Form form={filterForm} layout="inline" style={{ rowGap: 12, marginBottom: 12 }}>
          <Form.Item name="flowType" label="类型">
            <Select
              allowClear
              placeholder="全部类型"
              options={FLOW_TYPE_OPTIONS}
              style={{ width: 120 }}
            />
          </Form.Item>
          <Form.Item name="batchNo" label="批次号">
            <Input allowClear placeholder="请输入批次号" style={{ width: 160 }} />
          </Form.Item>
          <Form.Item name="dateRange" label="日期区间">
            <DatePicker.RangePicker allowClear placeholder={['开始日期', '结束日期']} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" onClick={handleSearch}>
                查询
              </Button>
              <Button onClick={handleReset}>重置</Button>
              <Button icon={<DownloadOutlined />} onClick={handleExport}>
                导出
              </Button>
            </Space>
          </Form.Item>
        </Form>
        {isError ? (
          <Empty
            description={
              <Space direction="vertical">
                <Typography.Text type="danger">出入库数据加载失败，请稍后重试</Typography.Text>
                <Button onClick={() => void invalidateAll()}>重新加载</Button>
              </Space>
            }
          />
        ) : (
          <ProTable<InputStockFlow & { inputLabel: string }>
            rowKey="flowId"
            columns={flowColumns}
            dataSource={pagedFlows}
            loading={loading}
            search={false}
            options={{ reload: () => void invalidateAll(), density: true, setting: true }}
            pagination={{
              current: pageNum,
              pageSize,
              total: flowRows.length,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
              onChange: (nextPage, nextSize) => {
                setPageNum(nextPage)
                setPageSize(nextSize)
              },
            }}
          />
        )}
      </Card>

      {/* 入库 */}
      <Modal
        title="投入品入库"
        open={action === 'in'}
        okText="确认入库"
        cancelText="取消"
        confirmLoading={stockInMutation.isPending}
        onOk={() => {
          void inForm.validateFields().then((values) => {
            stockInMutation.mutate(values)
          })
        }}
        onCancel={() => setAction(null)}
        destroyOnClose
      >
        <Form form={inForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            label="投入品"
            name="inputId"
            rules={[{ required: true, message: '请选择投入品' }]}
          >
            <Select showSearch optionFilterProp="label" options={inputOptions} placeholder="请选择投入品" />
          </Form.Item>
          <Form.Item label="入库数量" name="qty" rules={[{ required: true, message: '请输入入库数量' }]}>
            <InputNumber min={0} precision={3} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="批次号" name="batchNo" rules={[{ required: true, message: '入库必填批次号' }]}>
            <Input placeholder="如 BN20260501" />
          </Form.Item>
          <Form.Item
            label="有效期至"
            name="expireDate"
            rules={[{ required: true, message: '入库必填有效期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="操作人" name="operatorId">
            <Select showSearch optionFilterProp="label" options={memberOptions} placeholder="请选择操作人" />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input placeholder="如 采购到货入库" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 领用 */}
      <Modal
        title="投入品领用"
        open={action === 'consume'}
        okText="确认领用"
        cancelText="取消"
        confirmLoading={consumeMutation.isPending}
        onOk={() => {
          void consumeForm.validateFields().then((values) => {
            consumeMutation.mutate(values)
          })
        }}
        onCancel={() => setAction(null)}
        destroyOnClose
      >
        <Form form={consumeForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            label="投入品"
            name="inputId"
            rules={[{ required: true, message: '请选择投入品' }]}
          >
            <Select showSearch optionFilterProp="label" options={inputOptions} placeholder="请选择投入品" />
          </Form.Item>
          <Form.Item label="领用数量" name="qty" rules={[{ required: true, message: '请输入领用数量' }]}>
            <InputNumber min={0} precision={3} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="关联农事任务"
            name="relatedTaskId"
            rules={[{ required: true, message: '领用必填关联任务（PRD 11.2.4）' }]}
          >
            <Select showSearch optionFilterProp="label" options={taskOptions} placeholder="请选择关联任务" />
          </Form.Item>
          <Form.Item label="操作人" name="operatorId">
            <Select showSearch optionFilterProp="label" options={memberOptions} placeholder="请选择操作人" />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input placeholder="如 1号田番茄追肥" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 退回 */}
      <Modal
        title="投入品退回"
        open={action === 'return'}
        okText="确认退回"
        cancelText="取消"
        confirmLoading={returnMutation.isPending}
        onOk={() => {
          void returnForm.validateFields().then((values) => {
            returnMutation.mutate(values)
          })
        }}
        onCancel={() => setAction(null)}
        destroyOnClose
      >
        <Form form={returnForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            label="投入品"
            name="inputId"
            rules={[{ required: true, message: '请选择投入品' }]}
          >
            <Select showSearch optionFilterProp="label" options={inputOptions} placeholder="请选择投入品" />
          </Form.Item>
          <Form.Item label="退回数量" name="qty" rules={[{ required: true, message: '请输入退回数量' }]}>
            <InputNumber min={0} precision={3} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="批次号" name="batchNo">
            <Input placeholder="未用完退回的原批次号" />
          </Form.Item>
          <Form.Item label="有效期至" name="expireDate">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="关联农事任务" name="relatedTaskId">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              options={taskOptions}
              placeholder="请选择关联任务（可选）"
            />
          </Form.Item>
          <Form.Item label="操作人" name="operatorId">
            <Select showSearch optionFilterProp="label" options={memberOptions} placeholder="请选择操作人" />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input placeholder="如 未用完退回，冲减使用量" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 盘点 */}
      <Modal
        title="库存盘点"
        open={action === 'check'}
        okText="确认盘点"
        cancelText="取消"
        confirmLoading={checkMutation.isPending}
        okButtonProps={{ disabled: !checkInputId || checkDiff === 0 }}
        onOk={() => {
          void checkForm.validateFields().then((values) => {
            checkMutation.mutate(values)
          })
        }}
        onCancel={() => setAction(null)}
        destroyOnClose
      >
        <Form form={checkForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            label="投入品"
            name="inputId"
            rules={[{ required: true, message: '请选择投入品' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={inputOptions}
              placeholder="请选择投入品"
              onChange={(value) => {
                setCheckInputId(value)
                setCheckActual(undefined)
                checkForm.setFieldValue('actualQty', undefined)
              }}
            />
          </Form.Item>
          <Form.Item label="系统库存">
            <Input
              readOnly
              value={
                checkInputId
                  ? `${fmtNumber(inputMap.get(checkInputId)?.stockQty)} ${
                      inputMap.get(checkInputId)?.unit ?? ''
                    }`
                  : '请先选择投入品'
              }
            />
          </Form.Item>
          <Form.Item label="实盘数量" name="actualQty" rules={[{ required: true, message: '请输入实盘数量' }]}>
            <InputNumber
              min={0}
              precision={3}
              style={{ width: '100%' }}
              onChange={(value) => setCheckActual(value ?? undefined)}
            />
          </Form.Item>
          <Form.Item label="盘点差异">
            <Segmented
              value={checkDiff === 0 ? 'even' : checkDiff > 0 ? 'surplus' : 'loss'}
              options={[
                {
                  label: `盘盈 ${checkDiff > 0 ? `+${checkDiff}` : ''}`,
                  value: 'surplus',
                  disabled: checkDiff <= 0,
                },
                { label: '无差异', value: 'even', disabled: checkDiff !== 0 },
                {
                  label: `盘亏 ${checkDiff < 0 ? checkDiff : ''}`,
                  value: 'loss',
                  disabled: checkDiff >= 0,
                },
              ]}
            />
          </Form.Item>
          <Form.Item label="调整类型（默认按差异自动判定）" name="flowType">
            <Select
              allowClear
              options={[
                { value: 4, label: '盘盈' },
                { value: 5, label: '盘亏' },
                { value: 6, label: '报损' },
              ]}
              placeholder="留空则按差异自动判定"
            />
          </Form.Item>
          <Form.Item label="操作人" name="operatorId">
            <Select showSearch optionFilterProp="label" options={memberOptions} placeholder="请选择操作人" />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input placeholder="如 月末盘点" />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  )
}
