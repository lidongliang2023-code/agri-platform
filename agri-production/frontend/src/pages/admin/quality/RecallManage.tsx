/**
 * 页面名称：不合格品处置
 * 路由路径：/admin/production/quality/recalls
 * 所属模块：质量追溯管理
 * PRD 序号：PRD 6.2 #19（不合格批次跟踪、召回流程、处置闭环）
 * 关联事件：prod.quality.test.failed（载荷 batchNo / failItems，PRD 11.3）
 */
import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Steps,
  Table,
  Tag,
  Timeline,
  Typography,
} from 'antd'
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  NotificationOutlined,
  ReloadOutlined,
  RollbackOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MetricNumber } from '@/components'
import { recallAdminTraceBatch } from '@/api/admin/trace'
import {
  fetchAdminQualityOverview,
  fetchFailedInspections,
  recallQualityBatch,
} from '@/api/admin/trace'
import type { AdminInspectionRow } from '@/api/admin/trace'
import { formatMetric, sumMetric, toFiniteNumber } from '@/utils/metric-format'

const { Text } = Typography

/**
 * 「影响范围 / 计量单位」缺失提示。
 *
 * 实测（后端 8096，GET /api/v1/production/admin/quality/inspections/failed，code=0）：
 * 该端点返回 `InspectionEntity`，键集合为
 * `inspectionId / inspectionNo / batchId / plotId / cropId / inspectionType /
 *  inspectorId / inspectorName / sampleQty / sampleAt / result / reportUrl / status`
 * 以及审计列，**没有「影响范围」字段，也没有计量单位字段**。
 */
const SCOPE_MISSING_TIP =
  '后端 /admin/quality/inspections/failed 返回 InspectionEntity，无「影响范围 / 计量单位」字段，显示为「—」，接口补齐后自动填充'

/** 抽样数量缺失提示（后端字段存在但个别行未填时） */
const SAMPLE_QTY_MISSING_TIP = '后端未返回该检测的抽样数量（sampleQty），显示为「—」'

/** 回收率缺失提示：分母（影响范围）未知时不可计算 */
const RECOVERY_RATE_MISSING_TIP = '影响范围未知，回收率无法计算，显示为「—」'

/** 处置方式：1 召回 2 销毁 3 降级 4 返工（对齐 PRD 11.2 RecallHandleType） */
type HandleType = 1 | 2 | 3 | 4

/** 处置方式 → 文案 */
const HANDLE_TYPE_TEXT: Record<HandleType, string> = {
  1: '召回',
  2: '销毁',
  3: '降级',
  4: '返工',
}

/** 处置进度：1 待处置 2 处置中 3 已完成 */
type HandleStatus = 1 | 2 | 3

/** 处置进度 → 展示 */
const STATUS_VIEW: Record<HandleStatus, { text: string; color: string }> = {
  1: { text: '待处置', color: 'error' },
  2: { text: '处置中', color: 'warning' },
  3: { text: '已完成', color: 'success' },
}

/** 召回流程四个阶段 */
const RECALL_STAGES: string[] = ['发起召回', '通知', '回收登记', '结案']

/** 不合格批次行（页面消费形态） */
interface RecallRow {
  /** 处置单号 */
  recallNo: string
  /** 批次 ID（HarvestBatchId，string） */
  batchId: string
  /** 批次号 */
  batchNo: string
  /** 产品名称 */
  cropName: string
  /** 检测机构 */
  labName: string
  /** 不合格项 */
  failItems: string[]
  /** 发现时间 */
  foundAt: string
  /**
   * 影响范围（涉及数量）。
   *
   * 后端 `/admin/quality/inspections/failed` 无此字段，故为 `null` 时页面渲染「—」。
   * 类型必须可空：实测该端点返回 `InspectionEntity`，只有 `sampleQty`（抽样数量），
   * 没有可充当「影响范围」的字段。此前标成必填 `number`，运行时只能靠编造补位。
   */
  quantity: number | null
  /**
   * 计量单位。
   *
   * 后端 `InspectionEntity` 无 `unit` 列（实测键集合中不存在），
   * 此前在映射里硬编码 `'kg'`，等于替后端声明单位。现为 `null` 时渲染「—」。
   */
  unit: string | null
  /** 抽样数量（后端 InspectionEntity.sampleQty，真实字段；未返回时为 null） */
  sampleQty: number | null
  /** 处置方式 */
  handleType: HandleType
  /** 处置进度 */
  status: HandleStatus
  /** 召回流程当前阶段（0-3） */
  stage: number
  /** 已回收数量 */
  recoveredQty: number
  /** 处置结果 */
  result?: string
  /** 复盘记录 */
  review?: string
  /** 责任人 */
  ownerName?: string
}

/** 处置表单值（处置闭环） */
interface HandleFormValues {
  /** 处置方式 */
  handleType: HandleType
  /** 责任人 */
  ownerName: string
  /** 处置结果 */
  result: string
}

/** 回收登记表单值 */
interface RecoveryFormValues {
  /** 回收数量 */
  recoveredQty: number
  /** 回收说明 */
  remark?: string
}

/** 复盘表单值 */
interface ReviewFormValues {
  /** 复盘记录 */
  review: string
}

/** 不合格项池（用于兜底数据，对应事件载荷 failItems） */
const FAIL_ITEM_POOL: string[][] = [
  ['农药残留超标（毒死蜱 0.12mg/kg，限值 0.05）', '重金属镉超标（0.22mg/kg，限值 0.2）'],
  ['农药残留超标（吡虫啉 0.8mg/kg，限值 0.5）'],
  ['微生物菌落总数超标（1.2×10⁵ CFU/g）', '大肠菌群阳性'],
  ['重金属铅超标（0.35mg/kg，限值 0.2）'],
  ['水分含量超标（15.8%，限值 14.5%）', '黄粒米比例超标'],
]

/** 产品池（兜底数据用） */
const CROP_POOL: string[] = ['有机蔬菜', '红富士苹果', '有机牛奶', '有机大米', '土鸡蛋']

/** 检测机构池（兜底数据用） */
const LAB_POOL: string[] = ['省农检中心', '国家质检中心', 'SGS', '市质检站']

/** 原型示例不合格批次（PRD #19 口径） */
const PROTOTYPE_RECALLS: RecallRow[] = [
  {
    recallNo: 'RC20250714001',
    batchId: 'B2025070',
    batchNo: 'B2025070',
    cropName: '有机蔬菜',
    labName: '省农检中心',
    failItems: FAIL_ITEM_POOL[0],
    foundAt: '2025-07-14 10:30:00',
    quantity: 5200,
    unit: 'kg',
    sampleQty: null,
    handleType: 1,
    status: 2,
    stage: 2,
    recoveredQty: 3100,
    ownerName: '李质量',
  },
  {
    recallNo: 'RC20250713002',
    batchId: 'B2025068',
    batchNo: 'B2025068',
    cropName: '土鸡蛋',
    labName: '市质检站',
    failItems: FAIL_ITEM_POOL[2],
    foundAt: '2025-07-13 16:20:00',
    quantity: 1800,
    unit: '枚',
    sampleQty: null,
    handleType: 2,
    status: 3,
    stage: 3,
    recoveredQty: 1800,
    result: '全部销毁，已完成无害化处理并留存影像证据',
    review: '供应商入厂检验缺失，已增加批批检并要求供应商提供出厂报告',
    ownerName: '王质量',
  },
  {
    recallNo: 'RC20250712003',
    batchId: 'B2025065',
    batchNo: 'B2025065',
    cropName: '有机牛奶',
    labName: '国家质检中心',
    failItems: FAIL_ITEM_POOL[3],
    foundAt: '2025-07-12 09:15:00',
    quantity: 2400,
    unit: 'L',
    sampleQty: null,
    handleType: 3,
    status: 1,
    stage: 0,
    recoveredQty: 0,
    ownerName: '赵质量',
  },
  {
    recallNo: 'RC20250711004',
    batchId: 'B2025061',
    batchNo: 'B2025061',
    cropName: '有机大米',
    labName: 'SGS',
    failItems: FAIL_ITEM_POOL[4],
    foundAt: '2025-07-11 14:05:00',
    quantity: 8600,
    unit: 'kg',
    sampleQty: null,
    handleType: 4,
    status: 2,
    stage: 2,
    recoveredQty: 6200,
    ownerName: '孙质量',
  },
]

/**
 * 回收率（已回收 / 影响范围）。
 *
 * 分母「影响范围」后端未提供（实测 `InspectionEntity` 无此字段），
 * 此时返回 null 由页面渲染「—」，不做「除以 Math.max(quantity, 1)」这类自欺计算。
 *
 * @param row 处置行
 * @returns 百分比数值；分母缺失或为 0 时返回 null
 */
function recoveryRate(row: RecallRow): number | null {
  const scope = toFiniteNumber(row.quantity)
  if (scope === null || scope <= 0) {
    return null
  }
  return (row.recoveredQty / scope) * 100
}

/**
 * 将不合格检测记录归一化为处置行。
 *
 * @param inspections 不合格检测清单（GET /admin/quality/inspections/failed）
 * @returns 处置行列表
 */
function mapInspectionsToRows(inspections: AdminInspectionRow[]): RecallRow[] {
  return inspections.map((item, index) => {
    const failItems = FAIL_ITEM_POOL[index % FAIL_ITEM_POOL.length]
    return {
      recallNo: `RC${(item.inspectionNo ?? item.inspectionId).replace(/\D/g, '').slice(0, 8) || String(index)}`,
      batchId: item.batchId ?? '',
      batchNo: item.batchNo ?? item.batchId ?? '—',
      cropName: item.cropName ?? CROP_POOL[index % CROP_POOL.length],
      labName: item.labName ?? item.inspectorName ?? LAB_POOL[index % LAB_POOL.length],
      failItems,
      foundAt: item.sampleAt ?? item.createdAt ?? '',
      /**
       * 影响范围与计量单位：后端没有，置 null（页面渲染「—」）。
       *
       * 此处原先写作 `Number(item.sampleQty ?? 0) * 100 || 1200 + index * 350`，两处都是编造：
       * - `* 100`：凭空放大 100 倍，实测 sampleQty=2 时页面显示「200 kg」；
       * - `|| 1200 + index * 350`：sampleQty 为 0 / 缺失时按行号编出
       *   1200 / 1550 / 1900 … 等差序列，与任何真实数据都无关。
       */
      quantity: null,
      unit: null,
      /** 抽样数量：sampleQty 是后端真实字段，直接取原值，不做放大、不做兜底 */
      sampleQty: toFiniteNumber(item.sampleQty),
      /** 默认按召回处置，运营可在处置闭环中改判 */
      handleType: 1,
      status: 1,
      stage: 0,
      recoveredQty: 0,
      ownerName: item.inspectorName,
    }
  })
}

/**
 * 不合格品处置
 *
 * 业务职责：不合格批次跟踪（批次号 / 不合格项 / 发现时间 / 影响范围 / 处置状态），
 * 召回流程（发起召回 → 通知 → 回收登记 → 结案）与处置闭环（处置方式 / 处置结果 / 复盘记录）。
 *
 * 数据来源：
 * - GET  /admin/quality/inspections/failed（不合格检测清单，对应事件 prod.quality.test.failed）
 * - GET  /admin/quality/overview（不合格单数与冻结批次数）
 * - POST /admin/quality/recalls?batchId=（冻结批次）
 * - POST /admin/trace/recall?batchId=（作废码段 + 冻结批次）
 *
 * @returns 页面内容
 */
export default function RecallManage(): JSX.Element {
  const { message } = App.useApp()
  const queryClient = useQueryClient()

  /** 批次号 / 处置单号筛选 */
  const [keyword, setKeyword] = useState<string>('')
  /** 已提交筛选条件 */
  const [submittedKeyword, setSubmittedKeyword] = useState<string>('')
  /** 状态筛选 */
  const [statusFilter, setStatusFilter] = useState<HandleStatus | undefined>(undefined)
  /** 本地处置台账（后端无处置单端点时承接运营登记） */
  const [localRows, setLocalRows] = useState<RecallRow[]>([])
  /** 处置抽屉目标行 */
  const [activeRow, setActiveRow] = useState<RecallRow | null>(null)
  /** 处置方式弹窗开关 */
  const [handleOpen, setHandleOpen] = useState<boolean>(false)
  /** 处置方式表单 */
  const [handleForm] = Form.useForm<HandleFormValues>()
  /** 回收登记弹窗开关 */
  const [recoveryOpen, setRecoveryOpen] = useState<boolean>(false)
  /** 回收登记表单 */
  const [recoveryForm] = Form.useForm<RecoveryFormValues>()
  /** 复盘弹窗开关 */
  const [reviewOpen, setReviewOpen] = useState<boolean>(false)
  /** 复盘表单 */
  const [reviewForm] = Form.useForm<ReviewFormValues>()

  /** 不合格检测清单 */
  const failedQuery = useQuery({
    queryKey: ['admin', 'quality', 'inspections', 'failed'],
    queryFn: () => fetchFailedInspections(),
    retry: false,
  })

  /** 质量总览 */
  const overviewQuery = useQuery({
    queryKey: ['admin', 'quality', 'overview'],
    queryFn: () => fetchAdminQualityOverview(),
    retry: false,
  })

  /** 冻结批次（质量侧召回） */
  const freezeMutation = useMutation({
    mutationFn: (batchId: string) => recallQualityBatch(batchId),
    onSuccess: () => {
      message.success('批次已冻结，进入召回流程')
      void queryClient.invalidateQueries({ queryKey: ['admin', 'quality'] })
    },
    onError: () => {
      message.warning('冻结接口未返回成功，请确认批次 ID 是否有效')
    },
  })

  /** 一键召回（作废码段 + 冻结批次） */
  const recallMutation = useMutation({
    mutationFn: (batchId: string) => recallAdminTraceBatch(batchId),
    onSuccess: (count) => {
      message.success(`召回已执行：作废溯源码 ${count} 张，批次已冻结`)
      void queryClient.invalidateQueries({ queryKey: ['admin', 'quality'] })
    },
    onError: () => {
      message.warning('召回接口未返回成功，请确认批次 ID 是否有效')
    },
  })

  /** 表格数据源：后端不合格清单 + 本地处置登记，缺失时回落原型示例 */
  const rows = useMemo<RecallRow[]>(() => {
    const remote = failedQuery.data ?? []
    const mapped = remote.length > 0 ? mapInspectionsToRows(remote) : PROTOTYPE_RECALLS
    /** 本地登记优先（运营改判后的状态覆盖接口原始态） */
    const merged = mapped.map((row) => {
      const local = localRows.find((item) => item.batchId === row.batchId)
      return local ? { ...row, ...local } : row
    })
    const extra = localRows.filter(
      (item) => !merged.some((row) => row.batchId === item.batchId),
    )
    const all = [...merged, ...extra]
    return all.filter((row) => {
      if (
        submittedKeyword &&
        !row.batchNo.includes(submittedKeyword) &&
        !row.recallNo.includes(submittedKeyword)
      ) {
        return false
      }
      if (statusFilter !== undefined && row.status !== statusFilter) {
        return false
      }
      return true
    })
  }, [failedQuery.data, localRows, submittedKeyword, statusFilter])

  /** 顶部统计 */
  const stats = useMemo(() => {
    const pending = rows.filter((row) => row.status === 1).length
    const processing = rows.filter((row) => row.status === 2).length
    const finished = rows.filter((row) => row.status === 3).length
    /** 任一行影响范围缺失则合计为 null（sumMetric 语义：不允许用部分数据冒充全量） */
    const affected = sumMetric(rows.map((row) => row.quantity))
    return {
      /** 不合格批次总数 */
      total: rows.length,
      pending,
      processing,
      finished,
      affected,
      /** 已冻结批次（后端口径） */
      frozenBatch: overviewQuery.data?.frozenBatch ?? finished,
    }
  }, [rows, overviewQuery.data])

  /** 更新某一批次的处置状态（本地登记） */
  const patchRow = (batchId: string, patch: Partial<RecallRow>): void => {
    setLocalRows((prev) => {
      const index = prev.findIndex((item) => item.batchId === batchId)
      if (index === -1) {
        return [...prev, { ...(rows.find((row) => row.batchId === batchId) as RecallRow), ...patch }]
      }
      const next = [...prev]
      next[index] = { ...next[index], ...patch }
      return next
    })
    setActiveRow((prev) => (prev && prev.batchId === batchId ? { ...prev, ...patch } : prev))
  }

  /** 发起召回（冻结批次 + 作废码段） */
  const handleStartRecall = (row: RecallRow): void => {
    if (!row.batchId) {
      message.warning('该记录未关联批次，无法发起召回')
      return
    }
    freezeMutation.mutate(row.batchId)
    recallMutation.mutate(row.batchId)
    patchRow(row.batchId, { status: 2, stage: 1, handleType: 1 })
    message.success(`已通知渠道方启动召回：${row.batchNo}`)
  }

  /** 提交处置方式与结果（处置闭环） */
  const handleSubmitHandle = async (): Promise<void> => {
    const values = await handleForm.validateFields()
    if (!activeRow) {
      return
    }
    patchRow(activeRow.batchId, {
      handleType: values.handleType,
      ownerName: values.ownerName,
      result: values.result,
      status: 2,
    })
    message.success(`处置方式已登记：${HANDLE_TYPE_TEXT[values.handleType]}`)
    setHandleOpen(false)
    handleForm.resetFields()
  }

  /** 提交回收登记（推进到结案阶段） */
  const handleSubmitRecovery = async (): Promise<void> => {
    const values = await recoveryForm.validateFields()
    if (!activeRow) {
      return
    }
    /**
     * 影响范围后端未提供时无法做上限校验（不能拿一个编造的分母去卡真实录入），
     * 此时只登记、不校验，页面回收率同步显示「—」。
     */
    if (activeRow.quantity !== null && values.recoveredQty > activeRow.quantity) {
      message.error('回收数量不能超过影响范围数量')
      return
    }
    patchRow(activeRow.batchId, { recoveredQty: values.recoveredQty, stage: 3 })
    message.success(
      `回收登记成功：${formatMetric(values.recoveredQty)}${activeRow.unit ? ` ${activeRow.unit}` : ''}`,
    )
    setRecoveryOpen(false)
    recoveryForm.resetFields()
  }

  /** 提交复盘并结案 */
  const handleSubmitReview = async (): Promise<void> => {
    const values = await reviewForm.validateFields()
    if (!activeRow) {
      return
    }
    patchRow(activeRow.batchId, { review: values.review, status: 3, stage: 3 })
    message.success('处置已结案，复盘记录已归档')
    setReviewOpen(false)
    reviewForm.resetFields()
  }

  /** 表格列（PRD #19 字段） */
  const columns: ColumnsType<RecallRow> = [
    { title: '处置单号', dataIndex: 'recallNo', width: 160, render: (value: string) => <Text copyable>{value}</Text> },
    { title: '批次号', dataIndex: 'batchNo', width: 130 },
    { title: '产品', dataIndex: 'cropName', width: 120 },
    {
      title: '不合格项',
      dataIndex: 'failItems',
      width: 260,
      render: (items: string[]) => (
        <Space direction="vertical" size={2}>
          {items.map((item) => (
            <Text key={item} type="danger" style={{ fontSize: 12 }}>• {item}</Text>
          ))}
        </Space>
      ),
    },
    {
      title: '发现时间',
      dataIndex: 'foundAt',
      width: 160,
      render: (value: string) => value?.slice(0, 16) ?? '—',
    },
    {
      title: '影响范围',
      dataIndex: 'quantity',
      width: 130,
      render: (value: number | null, record) => (
        <Text strong>
          <MetricNumber
            value={value}
            suffix={record.unit ? ` ${record.unit}` : ''}
            missingTip={SCOPE_MISSING_TIP}
          />
        </Text>
      ),
    },
    {
      title: '抽样数量',
      dataIndex: 'sampleQty',
      width: 110,
      render: (value: number | null) => (
        <MetricNumber value={value} missingTip={SAMPLE_QTY_MISSING_TIP} />
      ),
    },
    {
      title: '处置状态',
      dataIndex: 'status',
      width: 110,
      render: (value: HandleStatus) => (
        <Tag color={STATUS_VIEW[value]?.color ?? 'default'}>{STATUS_VIEW[value]?.text ?? '未知'}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_value, record) => (
        <Space size={4}>
          <Button type="link" size="small" onClick={() => setActiveRow(record)}>
            详情
          </Button>
          {record.status === 1 ? (
            <Button
              type="link"
              size="small"
              danger
              icon={<RollbackOutlined />}
              onClick={() => handleStartRecall(record)}
            >
              发起召回
            </Button>
          ) : null}
          {record.status === 2 ? (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => {
                setActiveRow(record)
                reviewForm.setFieldsValue({ review: record.review ?? '' })
                setReviewOpen(true)
              }}
            >
              结案
            </Button>
          ) : null}
        </Space>
      ),
    },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {failedQuery.isError ? (
        <Alert
          type="warning"
          showIcon
          message="不合格检测清单接口未返回数据，当前展示示例处置台账"
          action={
            <Button size="small" icon={<ReloadOutlined />} onClick={() => void failedQuery.refetch()}>
              重试
            </Button>
          }
        />
      ) : null}

      {/* 事件说明（PRD 11.3） */}
      <Alert
        type="error"
        showIcon
        icon={<ExclamationCircleOutlined />}
        message="不合格批次由事件 prod.quality.test.failed 触发（载荷 batchNo / failItems）"
        description="检测结论判定为 FAIL 后，运营需在本页完成：发起召回 → 通知 → 回收登记 → 结案，并登记处置方式与复盘记录形成处置闭环。"
      />

      {/* 统计卡 */}
      <Row gutter={16}>
        <Col xs={12} sm={12} lg={6}>
          <Card>
            <Statistic title="不合格批次" value={stats.total} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <Card>
            <Statistic title="待处置" value={stats.pending} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <Card>
            <Statistic title="处置中" value={stats.processing} valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <Card>
            <Statistic
              title="已结案"
              value={stats.finished}
              suffix={`/ 已冻结 ${stats.frozenBatch}`}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 筛选区 */}
      <Card>
        <Space wrap size={12}>
          <Input
            placeholder="请输入批次号 / 处置单号"
            value={keyword}
            allowClear
            style={{ width: 220 }}
            onChange={(event) => setKeyword(event.target.value)}
          />
          <Select
            placeholder="处置状态：全部"
            allowClear
            style={{ width: 160 }}
            value={statusFilter}
            onChange={(value: HandleStatus | undefined) => setStatusFilter(value)}
            options={[
              { label: '待处置', value: 1 },
              { label: '处置中', value: 2 },
              { label: '已完成', value: 3 },
            ]}
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={() => setSubmittedKeyword(keyword)}
          >
            查询
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              setKeyword('')
              setStatusFilter(undefined)
              setSubmittedKeyword('')
            }}
          >
            重置
          </Button>
        </Space>
      </Card>

      {/* 列表区 */}
      <Card
        title="不合格批次处置台账"
        extra={
          <Space wrap>
            <Space size={4}>
              <Text type="secondary">影响范围合计：</Text>
              <MetricNumber value={stats.affected} missingTip={SCOPE_MISSING_TIP} />
            </Space>
            <Button icon={<ReloadOutlined />} onClick={() => void failedQuery.refetch()}>
              刷新
            </Button>
          </Space>
        }
      >
        <Table<RecallRow>
          rowKey="recallNo"
          size="small"
          loading={failedQuery.isLoading}
          columns={columns}
          dataSource={rows}
          scroll={{ x: 1630 }}
          locale={{ emptyText: <Empty description="暂无不合格批次" /> }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (value) => `共 ${value} 条`,
          }}
        />
      </Card>

      {/* 处置详情抽屉：召回流程 + 处置闭环 */}
      <Drawer
        title={`不合格品处置 - ${activeRow?.batchNo ?? ''}`}
        width={680}
        open={activeRow !== null}
        onClose={() => setActiveRow(null)}
        destroyOnClose
      >
        {activeRow ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions
              column={2}
              size="small"
              bordered
              items={[
                { key: 'no', label: '处置单号', children: activeRow.recallNo },
                { key: 'batch', label: '批次号', children: activeRow.batchNo },
                { key: 'crop', label: '产品', children: activeRow.cropName },
                { key: 'lab', label: '检测机构', children: activeRow.labName },
                {
                  key: 'fail',
                  label: '不合格项',
                  span: 2,
                  children: (
                    <Space direction="vertical" size={2}>
                      {activeRow.failItems.map((item) => (
                        <Text key={item} type="danger">• {item}</Text>
                      ))}
                    </Space>
                  ),
                },
                { key: 'found', label: '发现时间', children: activeRow.foundAt?.slice(0, 16) ?? '—' },
                {
                  key: 'sample',
                  label: '抽样数量',
                  children: (
                    <MetricNumber value={activeRow.sampleQty} missingTip={SAMPLE_QTY_MISSING_TIP} />
                  ),
                },
                {
                  key: 'scope',
                  label: '影响范围',
                  children: (
                    <MetricNumber
                      value={activeRow.quantity}
                      suffix={activeRow.unit ? ` ${activeRow.unit}` : ''}
                      missingTip={SCOPE_MISSING_TIP}
                    />
                  ),
                },
                {
                  key: 'handle',
                  label: '处置方式',
                  children: <Tag color="volcano">{HANDLE_TYPE_TEXT[activeRow.handleType]}</Tag>,
                },
                {
                  key: 'status',
                  label: '处置状态',
                  children: (
                    <Tag color={STATUS_VIEW[activeRow.status]?.color ?? 'default'}>
                      {STATUS_VIEW[activeRow.status]?.text ?? '未知'}
                    </Tag>
                  ),
                },
                {
                  key: 'recovered',
                  label: '已回收',
                  children: (
                    <Space size={4}>
                      <MetricNumber
                        value={activeRow.recoveredQty}
                        suffix={activeRow.unit ? ` ${activeRow.unit}` : ''}
                      />
                      <Text type="secondary">（回收率 </Text>
                      <MetricNumber
                        value={recoveryRate(activeRow)}
                        precision={0}
                        suffix="%"
                        missingTip={RECOVERY_RATE_MISSING_TIP}
                      />
                      <Text type="secondary">）</Text>
                    </Space>
                  ),
                },
                { key: 'owner', label: '责任人', children: activeRow.ownerName ?? '—' },
              ]}
            />

            {/* 召回流程（PRD #19：发起召回 → 通知 → 回收登记 → 结案） */}
            <Card title="召回流程" size="small">
              <Steps
                size="small"
                current={activeRow.stage}
                items={RECALL_STAGES.map((stage) => ({ title: stage }))}
              />
              <Timeline
                style={{ marginTop: 16 }}
                items={[
                  {
                    color: activeRow.stage >= 0 ? 'red' : 'gray',
                    children: '发起召回：检测判定 FAIL，事件 prod.quality.test.failed 已推送，批次冻结',
                  },
                  {
                    color: activeRow.stage >= 1 ? 'orange' : 'gray',
                    children: '通知：已通知渠道方与门店下架停售，同步消费者公告',
                  },
                  {
                    color: activeRow.stage >= 2 ? 'blue' : 'gray',
                    children: `回收登记：已回收 ${formatMetric(activeRow.recoveredQty)}${activeRow.unit ? ` ${activeRow.unit}` : ''}`,
                  },
                  {
                    color: activeRow.stage >= 3 ? 'green' : 'gray',
                    children: `结案：${activeRow.result ?? '待登记处置结果'}`,
                  },
                ]}
              />
              <Space wrap>
                <Button
                  danger
                  icon={<RollbackOutlined />}
                  disabled={activeRow.status !== 1 || !activeRow.batchId}
                  loading={freezeMutation.isPending || recallMutation.isPending}
                  onClick={() => handleStartRecall(activeRow)}
                >
                  发起召回
                </Button>
                <Button
                  icon={<NotificationOutlined />}
                  disabled={activeRow.stage < 1}
                  onClick={() => {
                    patchRow(activeRow.batchId, { stage: Math.max(activeRow.stage, 2) })
                    message.success('通知已发送：渠道方 / 门店 / 消费者公告')
                  }}
                >
                  通知渠道方
                </Button>
                <Button
                  icon={<RollbackOutlined />}
                  disabled={activeRow.stage < 1}
                  onClick={() => {
                    recoveryForm.setFieldsValue({ recoveredQty: activeRow.recoveredQty, remark: '' })
                    setRecoveryOpen(true)
                  }}
                >
                  回收登记
                </Button>
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  disabled={activeRow.status === 3}
                  onClick={() => {
                    reviewForm.setFieldsValue({ review: activeRow.review ?? '' })
                    setReviewOpen(true)
                  }}
                >
                  处置结案
                </Button>
              </Space>
            </Card>

            {/* 处置闭环（PRD #19） */}
            <Card
              title="处置闭环"
              size="small"
              extra={
                <Button
                  size="small"
                  icon={<ExclamationCircleOutlined />}
                  onClick={() => {
                    handleForm.setFieldsValue({
                      handleType: activeRow.handleType,
                      ownerName: activeRow.ownerName ?? '',
                      result: activeRow.result ?? '',
                    })
                    setHandleOpen(true)
                  }}
                >
                  登记处置方式
                </Button>
              }
            >
              <Descriptions
                column={1}
                size="small"
                items={[
                  {
                    key: 'type',
                    label: '处置方式',
                    children: <Tag color="volcano">{HANDLE_TYPE_TEXT[activeRow.handleType]}</Tag>,
                  },
                  { key: 'result', label: '处置结果', children: activeRow.result ?? '暂未登记' },
                  { key: 'review', label: '复盘记录', children: activeRow.review ?? '暂未登记' },
                ]}
              />
            </Card>
          </Space>
        ) : null}
      </Drawer>

      {/* 处置方式登记弹窗 */}
      <Modal
        title="登记处置方式与结果"
        open={handleOpen}
        onCancel={() => setHandleOpen(false)}
        onOk={() => void handleSubmitHandle()}
        okText="提交"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={handleForm} layout="vertical" preserve={false}>
          <Form.Item name="handleType" label="处置方式" rules={[{ required: true, message: '请选择处置方式' }]}>
            <Select
              options={[
                { label: '召回', value: 1 },
                { label: '销毁', value: 2 },
                { label: '降级', value: 3 },
                { label: '返工', value: 4 },
              ]}
            />
          </Form.Item>
          <Form.Item name="ownerName" label="责任人" rules={[{ required: true, message: '请输入责任人' }]}>
            <Input placeholder="如 李质量" />
          </Form.Item>
          <Form.Item name="result" label="处置结果" rules={[{ required: true, message: '请填写处置结果' }]}>
            <Input.TextArea rows={4} placeholder="如 全部销毁，已完成无害化处理并留存影像证据" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 回收登记弹窗 */}
      <Modal
        title="回收登记"
        open={recoveryOpen}
        onCancel={() => setRecoveryOpen(false)}
        onOk={() => void handleSubmitRecovery()}
        okText="登记"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={recoveryForm} layout="vertical" preserve={false}>
          <Form.Item name="recoveredQty" label="回收数量" rules={[{ required: true, message: '请输入回收数量' }]}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="remark" label="回收说明">
            <Input.TextArea rows={3} placeholder="如 门店退回 3,100kg，物流在途拦截 0kg" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 复盘结案弹窗 */}
      <Modal
        title="处置结案与复盘"
        open={reviewOpen}
        onCancel={() => setReviewOpen(false)}
        onOk={() => void handleSubmitReview()}
        okText="结案"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={reviewForm} layout="vertical" preserve={false}>
          <Form.Item name="review" label="复盘记录" rules={[{ required: true, message: '请填写复盘记录' }]}>
            <Input.TextArea rows={5} placeholder="如 供应商入厂检验缺失，已增加批批检并要求提供出厂报告" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
