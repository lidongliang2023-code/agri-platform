import ProTable from '@/components/ProductionTable'
import Card from '@/components/SectionCard'
import './inputs.css'
/**
 * 页面名称：出入库管理（已拆入「农资管理」页的投入品档案 / 使用台账两个 Tab）
 * 路由路径：无独立路由（旧 /production/inputs/stock 回落到 /production/inputs）
 * 所属模块：农资管理
 * PRD 序号：PRD 6.1 #21「出入库管理」（原型未覆盖，按 PRD 7.2 闭环与 11.2.4 表结构实现）
 *
 * 实现要点：
 * - 作业入口：入库（flow_type 1）/ 使用登记（走使用台账，生成 2 领用流水）/ 退回（3）/ 盘点（4 盘盈 · 5 盘亏 · 6 报损）
 * - 入库走后端 /stock-in；领用由「登记使用记录」统一触发 /consume，流水与库存原子联动
 * - 退回 / 盘点走 /stock-flows 写流水，并同步校正投入品库存
 * - 库存总览（part=overview）：按剩余量升序，低库存置顶，含预警阈值与库存状态，挂在投入品档案 Tab
 * - 流水查询（part=flows）：按流水类型 / 批次号 / 日期区间筛选，支持导出，挂在使用台账 Tab 底部
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { ProColumns } from '@ant-design/pro-components'
import {
  Alert,
  Button,
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
import {
  DownloadOutlined,
  FormOutlined,
  InboxOutlined,
  ReconciliationOutlined,
  RollbackOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import useFarmStore from '@/store/farm'
import { listMembers } from '@/api/members'
import { fetchTaskPage } from '@/api/tasks'
import {
  createStockFlow,
  fetchInputStockOverview,
  fetchInputWarning,
  pageAllStockFlows,
  pageInputs,
  stockIn,
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

/**
 * 作业弹窗类型。
 *
 * <p><b>领用不在这里</b>：领用必须走「使用台账 → 登记使用记录」，
 * 由后端在同一次事务里写使用记录 + 领用流水 + 扣库存，保证台账与库存对得上。</p>
 */
type ActionKey = 'in' | 'return' | 'check' | null

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

/** 面板分区：库存总览并入「投入品档案」Tab，出入库流水并入「使用台账」Tab */
export type InputStockPart = 'overview' | 'flows'

/** 从合并台账中的单行操作打开库存作业弹窗。 */
export interface StockActionShortcut {
  /** 每次点击递增，允许连续打开同一个作业 */
  requestId: number
  /** 作业类型 */
  action: Exclude<ActionKey, null>
  /** 预选投入品 */
  inputId: string
}

interface InputStockProps {
  /** 渲染哪一块：overview = 库存总览与四类作业；flows = 出入库流水 */
  part?: InputStockPart
  /** 是否渲染内置库存列表；合并到投入品档案主表时关闭，避免重复列表 */
  showTable?: boolean
  /** 外部主表触发的单行库存作业 */
  shortcut?: StockActionShortcut
}

/**
 * 出入库面板（拆分后分别并入「投入品档案」「使用台账」两个 Tab）
 *
 * 业务职责：投入品入库 / 领用 / 退回 / 盘点四类作业，库存总览与流水查询。
 *
 * @param props 分区选择
 * @returns 面板内容（页头由外层「农资管理」页统一提供）
 */
export default function InputStock({
  part = 'overview',
  showTable = true,
  shortcut,
}: InputStockProps): JSX.Element {
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
  const [returnForm] = Form.useForm<ReturnForm>()
  const [checkForm] = Form.useForm<CheckForm>()
  const [checkInputId, setCheckInputId] = useState<string | undefined>(undefined)
  const [checkActual, setCheckActual] = useState<number | undefined>(undefined)

  useEffect(() => {
    if (!shortcut) return
    setAction(shortcut.action)
    if (shortcut.action === 'in') inForm.setFieldValue('inputId', shortcut.inputId)
    if (shortcut.action === 'return') returnForm.setFieldValue('inputId', shortcut.inputId)
    if (shortcut.action === 'check') {
      setCheckInputId(shortcut.inputId)
      setCheckActual(undefined)
      checkForm.setFieldValue('inputId', shortcut.inputId)
      checkForm.setFieldValue('actualQty', undefined)
    }
  }, [shortcut, inForm, returnForm, checkForm])

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

  /**
   * 跨投入品流水（服务端筛选 / 分页）。
   *
   * <p>原实现按投入品逐项拉流水再合并，最多只覆盖 50 个投入品 × 每个 100 条 ——
   * 数据一多就会截断。改为单个分页接口后，新增流水会真实追加到列表，不受前端上限影响。</p>
   */
  const flowsQuery = useQuery({
    queryKey: ['production-inputs', 'stock-flows', pageNum, pageSize, filters],
    enabled: part === 'flows',
    queryFn: () =>
      pageAllStockFlows({
        pageNum,
        pageSize,
        flowType: filters.flowType,
        batchNo: filters.batchNo,
        startDate: filters.dateRange?.[0]?.format('YYYY-MM-DD'),
        endDate: filters.dateRange?.[1]?.format('YYYY-MM-DD'),
      }),
  })

  /** 本月流水笔数（只取 total，不拉整页数据） */
  const monthFlowQuery = useQuery({
    queryKey: ['production-inputs', 'stock-flows-month'],
    queryFn: () =>
      pageAllStockFlows({
        pageNum: 1,
        pageSize: 1,
        startDate: dayjs().startOf('month').format('YYYY-MM-DD'),
        endDate: dayjs().format('YYYY-MM-DD'),
      }),
  })

  /** 成员下拉 */
  const membersQuery = useQuery({
    queryKey: ['member-options', farmId],
    enabled: Boolean(farmId),
    queryFn: () => listMembers({ farmId, pageNum: 1, pageSize: 200 }),
  })

  /** 农事任务下拉（退回时可关联任务） */
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

  /**
   * 退回作业：写退回流水。
   *
   * <p>库存由后端 `createFlow` 在同一次事务里回补（流水 = 库存的唯一改动入口），
   * 前端不再额外调 `updateInputInfo` —— 两处都改会把库存重复加一遍。</p>
   */
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
    },
    onSuccess: () => {
      message.success('退回成功，已写入退回流水并回补库存')
      setAction(null)
      returnForm.resetFields()
      void invalidateAll()
    },
  })

  /**
   * 盘点作业：按差异生成盘盈 / 盘亏 / 报损流水，库存由后端随流水校正。
   *
   * <p>差异为 0 时不再发「数量 0」的流水（后端会拒绝），直接提示库存一致。</p>
   */
  const checkMutation = useMutation({
    mutationFn: async (values: CheckForm): Promise<boolean> => {
      const inputId = String(values.inputId)
      const systemQty = inputMap.get(inputId)?.stockQty ?? 0
      const actualQty = values.actualQty ?? 0
      const diff = Number((actualQty - systemQty).toFixed(3))
      if (Math.abs(diff) < 0.0001) {
        return false
      }
      const flowType = values.flowType ?? (diff > 0 ? 4 : 5)
      await createStockFlow(inputId, {
        inputId,
        flowType,
        qty: Math.abs(diff),
        operatorId: values.operatorId,
        remark: values.remark ?? `库存盘点：系统 ${systemQty} → 实盘 ${actualQty}`,
      })
      return true
    },
    onSuccess: (changed) => {
      message.success(changed ? '盘点完成，已写入盘点流水并校正库存' : '库存一致，无需调整')
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

  /** 临期投入品（30 天内到期，按最近批次效期统计） */
  const expiringCount = useMemo(() => {
    const limit = dayjs().add(30, 'day').format('YYYY-MM-DD')
    const today = dayjs().format('YYYY-MM-DD')
    return allStockRows.filter((item) => {
      if (!item.nearestExpireDate) return false
      const key = dateKey(item.nearestExpireDate)
      return key >= today && key <= limit
    }).length
  }, [allStockRows])

  /** 本月流水笔数（服务端 total，不受分页影响） */
  const monthFlowCount = monthFlowQuery.data?.total ?? 0

  /** 当前页流水（服务端已筛选 / 排序） */
  const flowRows = useMemo(() => flowsQuery.data?.list ?? [], [flowsQuery.data])

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
      title: '投入品类型',
      key: 'inputType',
      width: 110,
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
      fixed: 'right',
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
          key="usage"
          onClick={() => navigate('/production/inputs?tab=ledger&create=1')}
        >
          使用登记
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
  const flowColumns: ProColumns<InputStockFlow>[] = [
    {
      title: '时间',
      key: 'createdAt',
      width: 160,
      render: (_, record) => fmtDate(record.createdAt, 'YYYY-MM-DD HH:mm'),
    },
    {
      title: '投入品',
      key: 'inputName',
      width: 160,
      render: (_, record) => (
        <Typography.Link onClick={() => navigate(`/production/inputs/${record.inputId ?? ''}`)}>
          {record.inputName ??
            (record.inputId ? inputMap.get(record.inputId)?.inputName : undefined) ??
            record.inputId ??
            '-'}
        </Typography.Link>
      ),
    },
    {
      title: '流水类型',
      key: 'flowType',
      width: 100,
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

  /** 导出流水（按当前筛选条件重新拉全量，避免只导出当前页） */
  const handleExport = async (): Promise<void> => {
    try {
      const result = await pageAllStockFlows({
        pageNum: 1,
        pageSize: 2000,
        flowType: filters.flowType,
        batchNo: filters.batchNo,
        startDate: filters.dateRange?.[0]?.format('YYYY-MM-DD'),
        endDate: filters.dateRange?.[1]?.format('YYYY-MM-DD'),
      })
      const rows = result.list ?? []
      if (rows.length === 0) {
        message.warning('暂无可导出的数据')
        return
      }
      downloadCsv(
        '投入品出入库流水',
        ['时间', '投入品', '流水类型', '数量', '批次号', '有效期至', '操作人', '关联任务', '备注'],
        rows.map((row) => [
          fmtDate(row.createdAt, 'YYYY-MM-DD HH:mm'),
          row.inputName ??
            (row.inputId ? inputMap.get(row.inputId)?.inputName : undefined) ??
            row.inputId ??
            '',
          flowTypeMeta(row.flowType).label,
          fmtNumber(row.qty),
          row.batchNo ?? '',
          fmtDate(row.expireDate),
          row.operatorId ?? '',
          row.relatedTaskId ?? '',
          row.remark ?? '',
        ]),
      )
    } catch (error) {
      message.error((error as Error).message || '导出失败，请稍后重试')
    }
  }

  /** 盘点差异与推荐类型 */
  const checkDiff = useMemo(() => {
    if (!checkInputId) return 0
    const systemQty = inputMap.get(checkInputId)?.stockQty ?? 0
    return Number(((checkActual ?? systemQty) - systemQty).toFixed(3))
  }, [checkInputId, checkActual, inputMap])

  const loading =
    part === 'flows'
      ? flowsQuery.isFetching
      : inputsQuery.isFetching || stockQuery.isFetching
  const isError =
    part === 'flows' ? flowsQuery.isError : inputsQuery.isError || stockQuery.isError
  const warningCount = (warningQuery.data ?? []).length

  /**
   * 作业入口。
   *
   * <p>领用不在这里单独做一遍：统一跳「使用台账 → 登记使用记录」，
   * 由后端一次事务完成「使用记录 + 领用流水 + 扣库存」，避免两套入口各扣一次。</p>
   */
  const actionButtons = (
    <Space wrap>
      <Button type="primary" icon={<InboxOutlined />} onClick={() => setAction('in')}>
        入库
      </Button>
      <Button
        icon={<FormOutlined />}
        onClick={() => navigate('/production/inputs?tab=ledger&create=1')}
      >
        使用登记
      </Button>
      <Button icon={<RollbackOutlined />} onClick={() => setAction('return')}>
        退回
      </Button>
      <Button icon={<ReconciliationOutlined />} onClick={() => setAction('check')}>
        盘点
      </Button>
    </Space>
  )

  return (
    <>
      {part === 'overview' && (
        <>
          <div style={{ marginBottom: 16 }}>{actionButtons}</div>

          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={12} lg={6}>
              <Card>
                <Statistic title="在库投入品" value={allStockRows.length} suffix="种" />
              </Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card>
                <Statistic
                  title="低库存预警"
                  value={warningCount}
                  suffix="种"
                  valueStyle={{ color: warningCount > 0 ? '#cf1322' : undefined }}
                />
              </Card>
            </Col>
            <Col xs={12} lg={6}>
              <Card>
                <Statistic
                  title="30 天内到期投入品"
                  value={expiringCount}
                  suffix="个"
                  valueStyle={{ color: expiringCount > 0 ? '#fa8c16' : undefined }}
                />
              </Card>
            </Col>
            <Col xs={12} lg={6}>
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

          {showTable && (
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
            cardProps={false}
            className="input-record-table"
                rowKey="inputId"
                columns={stockColumns}
                dataSource={stockRows}
                loading={loading}
                search={false}
                // 列宽合计约 920，窄屏时在卡片内横向滚动
                scroll={{ x: 940 }}
                options={{ reload: () => void invalidateAll(), density: true, setting: true }}
                pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 种` }}
              />
            </Card>
          )}
        </>
      )}

      {part === 'flows' && (
        <Card title="📋 出入库流水">
          <Form form={filterForm} layout="inline" style={{ rowGap: 12, marginBottom: 12 }}>
            <Form.Item name="flowType" label="流水类型">
              <Select
                allowClear
                placeholder="全部流水类型"
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
                <Button icon={<DownloadOutlined />} onClick={() => void handleExport()}>
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
            <ProTable<InputStockFlow>
            cardProps={false}
            className="input-record-table"
              rowKey="flowId"
              columns={flowColumns}
              dataSource={flowRows}
              loading={loading}
              search={false}
              // 固定列宽合计约 1070，备注列需要额外空间，窄屏时表格内部横向滚动
              scroll={{ x: 1200 }}
              options={{ reload: () => void invalidateAll(), density: true, setting: true }}
              pagination={{
                current: pageNum,
                pageSize,
                total: flowsQuery.data?.total ?? 0,
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
      )}

      {part === 'overview' && (
        <>
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
          <Form.Item label="调整流水类型（默认按差异自动判定）" name="flowType">
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
        </>
      )}
    </>
  )
}
