/**
 * 页面名称：AI模型管理
 * 路由路径：/admin/production/ai/models
 * 所属模块：AI中心
 * 原型页码：P20 ai-models（原型补充页面，PRD 6.2 未列出）
 *
 * 交互说明（对照原型 P20）：
 * - 顶部统计卡：模型总数 24 / 运行中 18 / 待上线 4 / 今日调用量 12,450；
 * - 模型卡片：名称 + 状态标签 / 版本·类型·框架 / 准确率 / 今日调用 / 平均延迟 / GPU使用率；
 * - 支持卡片视图与列表视图切换；列表列：名称 / 类型 / 版本 / 准确率 / 状态 / 更新时间 / 操作；
 * - 支持创建模型、编辑、启用 / 停用，并在抽屉中查看「准确率趋势(近7天)」与「调用量趋势(近7天)」；
 * - 说明：后端**确实没有** AI 模型注册表能力（已核实：7 个 Flyway 迁移文件中无 ai_model /
 *   model_registry 表；mod-produce 的 AiController 只是 prod_ai_diagnosis 诊断记录 CRUD；
 *   satellite-ai-gateway 的 VisionController 是空壳桩，永远返回 degraded=true）。
 *   因此本页**不接任何不存在的接口**，改为本机模型注册表：数据持久化在浏览器
 *   localStorage（key: agri:admin:ai:models），跨刷新保留以便演示完整流程，
 *   后续后端补齐接口只需替换 queryFn。
 * - 明示（三件套，缺一不可，避免"看起来像真的"）：
 *   ① 页面顶部常驻 Alert：当前配置保存在本机浏览器，未同步至服务端，不会对线上生效；
 *      换设备 / 换浏览器 / 清理浏览器数据后数据会丢失；
 *   ② 所有写操作的成功提示均带限定语「已保存到本机（未写入服务端）」；
 *   ③ 来自本机注册表的数据行统一带「本机」Tag；若内容为内置示例数据再叠「示例数据」Tag；
 * - 空态：本机注册表为空时**不再静默回退示例数据**，改为空态 + 「载入示例数据」按钮，
 *   载入后整页数据带「示例数据」标记，杜绝"假台账看起来像真的"。
 */
import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
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
  Progress,
  Row,
  Segmented,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import { EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'

/** 模型类型：图像分类 / 回归预测 / 多模态 / 目标检测 / NLP */
type ModelType = '图像分类' | '回归预测' | '多模态' | '目标检测' | 'NLP'

/** 模型状态：running 运行中 / pending 待上线 / offline 已下线 */
type ModelStatus = 'running' | 'pending' | 'offline'

/** AI 模型 */
interface AiModel {
  /** 模型 ID */
  modelId: string
  /** 模型名称 */
  modelName: string
  /** 模型类型 */
  modelType: ModelType
  /** 框架 */
  framework: string
  /** 版本 */
  version: string
  /** 准确率（%） */
  accuracy: number
  /** 今日调用量 */
  todayCalls: number
  /** 平均延迟（ms） */
  avgLatency: number
  /** GPU 使用率（%） */
  gpuUsage: number
  /** 状态 */
  status: ModelStatus
  /** 更新时间 */
  updatedAt: string
  /** 近 7 天准确率序列 */
  accuracyTrend: number[]
  /** 近 7 天调用量序列 */
  callTrend: number[]
}

/** 状态文案与颜色 */
const STATUS_MAP: Record<ModelStatus, { label: string; color: string }> = {
  running: { label: '运行中', color: 'green' },
  pending: { label: '待上线', color: 'gold' },
  offline: { label: '已下线', color: 'default' },
}

/** 演示模型数据（原型 P20 列出的 3 个主模型 + 补充） */
const MOCK_MODELS: AiModel[] = [
  {
    modelId: 'AI-001',
    modelName: '病虫害识别模型',
    modelType: '图像分类',
    framework: 'TensorFlow',
    version: 'V3.2.1',
    accuracy: 96.5,
    todayCalls: 3200,
    avgLatency: 45,
    gpuUsage: 72,
    status: 'running',
    updatedAt: '2025-07-12 10:20',
    accuracyTrend: [93.8, 94.5, 95.1, 95.6, 96.0, 96.3, 96.5],
    callTrend: [2800, 2950, 3100, 3020, 3180, 3250, 3200],
  },
  {
    modelId: 'AI-002',
    modelName: '产量预测模型',
    modelType: '回归预测',
    framework: 'PyTorch',
    version: 'V2.1.0',
    accuracy: 89.2,
    todayCalls: 850,
    avgLatency: 120,
    gpuUsage: 45,
    status: 'running',
    updatedAt: '2025-07-08 16:40',
    accuracyTrend: [86.4, 87.1, 87.8, 88.4, 88.9, 89.1, 89.2],
    callTrend: [620, 700, 760, 810, 840, 830, 850],
  },
  {
    modelId: 'AI-003',
    modelName: '土壤分析模型',
    modelType: '多模态',
    framework: 'TensorFlow',
    version: 'V1.5.3',
    accuracy: 93.8,
    todayCalls: 1560,
    avgLatency: 65,
    gpuUsage: 85,
    status: 'running',
    updatedAt: '2025-07-10 09:05',
    accuracyTrend: [90.2, 91.0, 91.8, 92.5, 93.1, 93.5, 93.8],
    callTrend: [1200, 1300, 1400, 1450, 1500, 1530, 1560],
  },
  {
    modelId: 'AI-004',
    modelName: '杂草识别模型',
    modelType: '目标检测',
    framework: 'PyTorch',
    version: 'V1.2.0',
    accuracy: 91.4,
    todayCalls: 980,
    avgLatency: 58,
    gpuUsage: 38,
    status: 'running',
    updatedAt: '2025-07-06 14:22',
    accuracyTrend: [88.0, 88.9, 89.6, 90.3, 90.9, 91.2, 91.4],
    callTrend: [760, 820, 880, 910, 950, 970, 980],
  },
  {
    modelId: 'AI-005',
    modelName: '农技问答大模型',
    modelType: 'NLP',
    framework: 'PyTorch',
    version: 'V4.0.0-beta',
    accuracy: 87.6,
    todayCalls: 2100,
    avgLatency: 320,
    gpuUsage: 91,
    status: 'pending',
    updatedAt: '2025-07-13 08:15',
    accuracyTrend: [82.1, 83.4, 84.6, 85.8, 86.7, 87.2, 87.6],
    callTrend: [1500, 1680, 1800, 1900, 1980, 2050, 2100],
  },
  {
    modelId: 'AI-006',
    modelName: '长势评估模型',
    modelType: '多模态',
    framework: 'TensorFlow',
    version: 'V0.9.2',
    accuracy: 84.3,
    todayCalls: 420,
    avgLatency: 96,
    gpuUsage: 26,
    status: 'offline',
    updatedAt: '2025-06-26 11:30',
    accuracyTrend: [78.5, 79.8, 81.0, 82.2, 83.1, 83.8, 84.3],
    callTrend: [520, 500, 480, 460, 450, 430, 420],
  },
]

/** 本机模型注册表的 localStorage key（跨刷新保留，仅存在于当前浏览器） */
const MODEL_STORE_KEY = 'agri:admin:ai:models'

/** 本机注册表数据来源：local=用户在本机写入 / demo=内置示例数据 / empty=空 */
type StoreSource = 'local' | 'demo' | 'empty'

/**
 * 读取本机模型注册表。
 *
 * 注意：**不再**在缺失时静默回退示例数据——缺失即返回 null（未初始化），
 * 由页面展示空态并让用户显式点击「载入示例数据」，避免示例台账伪装成真实数据。
 *
 * @returns 模型列表；null 表示本机从未写入过注册表（未初始化）
 */
const loadModelStore = (): AiModel[] | null => {
  try {
    const raw = window.localStorage.getItem(MODEL_STORE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AiModel[]
      if (Array.isArray(parsed)) {
        return parsed
      }
    }
  } catch {
    // 浏览器禁用存储或数据损坏时按「未初始化」处理，由页面显式提示
  }
  return null
}

/**
 * 写入本机模型注册表
 * @param list 模型列表
 */
const persistModelStore = (list: AiModel[]): void => {
  try {
    window.localStorage.setItem(MODEL_STORE_KEY, JSON.stringify(list))
  } catch {
    // 浏览器禁用存储时忽略，退化为纯内存态
  }
}

/** 本机模型注册表（null = 未初始化，页面展示空态） */
let mockModelStore: AiModel[] | null = loadModelStore()

/** 当前数据来源（与 mockModelStore 同步维护，用于页面提示） */
let storeSource: StoreSource = mockModelStore === null ? 'empty' : 'local'

/** 本机数据标记：所有来自本地注册表的行都需带上该标签，与服务端返回数据区分 */
const LOCAL_TAG: JSX.Element = <Tag color="purple">本机</Tag>

/** 示例数据标记：内容为内置演示数据时额外叠加，避免被当成真实台账 */
const DEMO_TAG: JSX.Element = <Tag color="orange">示例数据</Tag>

/** 模型类型选项 */
const TYPE_OPTIONS: { value: ModelType; label: string }[] = [
  { value: '图像分类', label: '图像分类' },
  { value: '回归预测', label: '回归预测' },
  { value: '多模态', label: '多模态' },
  { value: '目标检测', label: '目标检测' },
  { value: 'NLP', label: 'NLP' },
]

/** 新建/编辑表单值 */
interface ModelFormValues {
  modelName: string
  modelType: ModelType
  framework: string
  version: string
  accuracy: number
  avgLatency: number
}

/** 查询条件 */
interface FilterState {
  modelName?: string
  modelType?: ModelType
  status?: ModelStatus
}

/**
 * AI模型管理页面
 * @returns 页面内容
 */
export default function Models(): JSX.Element {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [form] = Form.useForm<ModelFormValues>()
  const [filters, setFilters] = useState<FilterState>({})
  const [models, setModels] = useState<AiModel[]>(mockModelStore ?? [])
  const [source, setSource] = useState<StoreSource>(storeSource)
  const [view, setView] = useState<'card' | 'table'>('card')
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false)
  const [editingId, setEditingId] = useState<string | undefined>(undefined)
  const [detailRow, setDetailRow] = useState<AiModel | undefined>(undefined)

  /** 行来源标签：本机 + （示例数据时）示例数据 */
  const sourceTag: JSX.Element = (
    <Space size={4}>
      {LOCAL_TAG}
      {source === 'demo' ? DEMO_TAG : null}
    </Space>
  )

  const listQuery = useQuery({
    queryKey: ['admin-ai-models'],
    queryFn: async (): Promise<AiModel[]> => mockModelStore ?? [],
  })

  useEffect(() => {
    if (listQuery.data) {
      setModels(listQuery.data)
    }
  }, [listQuery.data])

  /** 展示数据（叠加筛选） */
  const displayRows = useMemo(
    () =>
      models.filter((item) => {
        if (filters.modelName && !item.modelName.includes(filters.modelName)) {
          return false
        }
        if (filters.modelType && item.modelType !== filters.modelType) {
          return false
        }
        if (filters.status && item.status !== filters.status) {
          return false
        }
        return true
      }),
    [models, filters],
  )

  /** 统计（全部来自本机注册表；后端未提供任何模型指标，不套用平台级硬编码口径） */
  const stats = useMemo(
    () => ({
      total: models.length,
      running: models.filter((item) => item.status === 'running').length,
      pending: models.filter((item) => item.status === 'pending').length,
      todayCalls: models
        .filter((item) => item.status === 'running')
        .reduce((sum, item) => sum + item.todayCalls, 0),
    }),
    [models],
  )

  /**
   * 保存模型
   * @param values 表单值
   */
  const handleSave = (values: ModelFormValues): void => {
    if (editingId) {
      mockModelStore = (mockModelStore ?? []).map((item) =>
        item.modelId === editingId
          ? {
              ...item,
              modelName: values.modelName,
              modelType: values.modelType,
              framework: values.framework,
              version: values.version,
              accuracy: values.accuracy,
              avgLatency: values.avgLatency,
              updatedAt: dayjs().format('YYYY-MM-DD HH:mm'),
            }
          : item,
      )
      persistModelStore(mockModelStore)
      storeSource = 'local'
      setSource('local')
      setModels(mockModelStore)
      message.success('模型信息已保存到本机（未写入服务端），不会对线上生效')
    } else {
      const nextModel: AiModel = {
        modelId: `AI-${String((mockModelStore?.length ?? 0) + 1).padStart(3, '0')}`,
        modelName: values.modelName,
        modelType: values.modelType,
        framework: values.framework,
        version: values.version,
        accuracy: values.accuracy,
        todayCalls: 0,
        avgLatency: values.avgLatency,
        gpuUsage: 0,
        status: 'pending',
        updatedAt: dayjs().format('YYYY-MM-DD HH:mm'),
        // 本机新建模型没有历史趋势：服务端未提供趋势数据，此处留空（页面显示「未接入」），
        // 绝不本地编造一条"看起来在涨"的曲线。
        accuracyTrend: [],
        callTrend: [],
      }
      mockModelStore = [...(mockModelStore ?? []), nextModel]
      persistModelStore(mockModelStore)
      storeSource = 'local'
      setSource('local')
      setModels(mockModelStore)
      message.success('模型已保存到本机（未写入服务端），等待上线，不会对线上生效')
    }
    setDrawerOpen(false)
    setEditingId(undefined)
    form.resetFields()
    void queryClient.invalidateQueries({ queryKey: ['admin-ai-models'] })
  }

  /**
   * 启用 / 停用模型
   * @param row 目标模型
   * @param nextStatus 目标状态
   */
  const handleToggle = (row: AiModel, nextStatus: ModelStatus): void => {
    mockModelStore = (mockModelStore ?? []).map((item) =>
      item.modelId === row.modelId
        ? { ...item, status: nextStatus, updatedAt: dayjs().format('YYYY-MM-DD HH:mm') }
        : item,
    )
    persistModelStore(mockModelStore)
    storeSource = 'local'
    setSource('local')
    setModels(mockModelStore)
    message.success(
      nextStatus === 'running'
        ? `「${row.modelName}」已在本机启用（未写入服务端），不会对线上生效`
        : `「${row.modelName}」已在本机停用下线（未写入服务端），不会对线上生效`,
    )
    void queryClient.invalidateQueries({ queryKey: ['admin-ai-models'] })
  }

  /**
   * 载入内置示例数据（显式触发，绝不静默回退）
   */
  const handleLoadDemo = (): void => {
    mockModelStore = [...MOCK_MODELS]
    persistModelStore(mockModelStore)
    storeSource = 'demo'
    setSource('demo')
    setModels(mockModelStore)
    setEditingId(undefined)
    form.resetFields()
    message.warning('已载入内置示例数据 —— 仅存在于本机浏览器，不是服务端真实模型台账')
    void queryClient.invalidateQueries({ queryKey: ['admin-ai-models'] })
  }

  /**
   * 清空本机模型注册表（回到空态，不再自动填充示例数据）
   */
  const handleClearLocal = (): void => {
    try {
      window.localStorage.removeItem(MODEL_STORE_KEY)
    } catch {
      // 浏览器禁用存储时忽略
    }
    mockModelStore = []
    storeSource = 'empty'
    setSource('empty')
    setModels([])
    setEditingId(undefined)
    form.resetFields()
    message.success('已清空本机模型注册表（页内回到空态，不会自动填充示例数据）')
    void queryClient.invalidateQueries({ queryKey: ['admin-ai-models'] })
  }

  /** 近 7 天 X 轴 */
  const weekAxis: string[] = Array.from({ length: 7 }, (_, index) =>
    dayjs().subtract(6 - index, 'day').format('MM-DD'),
  )

  /**
   * 构建双轴趋势图配置
   * @param row 目标模型
   * @returns ECharts 配置
   */
  const buildTrendOption = (row: AiModel): EChartsOption => ({
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, itemWidth: 10, itemHeight: 10 },
    grid: { left: 56, right: 56, top: 32, bottom: 48 },
    xAxis: { type: 'category', data: weekAxis },
    yAxis: [
      { type: 'value', name: '准确率(%)', min: 70, max: 100, splitLine: { lineStyle: { type: 'dashed' } } },
      { type: 'value', name: '调用量', splitLine: { show: false } },
    ],
    series: [
      {
        name: '准确率(%)',
        type: 'line',
        smooth: true,
        data: row.accuracyTrend,
        itemStyle: { color: '#13a05a' },
      },
      {
        name: '调用量',
        type: 'bar',
        yAxisIndex: 1,
        barWidth: '40%',
        data: row.callTrend,
        itemStyle: { color: '#1677ff' },
      },
    ],
  })

  /** 平台总调用量趋势（原型 P20 模型调用量趋势；仅聚合本机注册表内已有的调用量序列） */
  const platformTrend: EChartsOption = useMemo(() => {
    const total = Array.from({ length: 7 }, (_, index) =>
      models.reduce((sum, item) => sum + (item.callTrend[index] ?? 0), 0),
    )
    return {
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0, itemWidth: 10, itemHeight: 10 },
      grid: { left: 56, right: 24, top: 32, bottom: 48 },
      xAxis: { type: 'category', data: weekAxis },
      yAxis: { type: 'value', name: '调用量', splitLine: { lineStyle: { type: 'dashed' } } },
      series: [
        {
          name: '总调用',
          type: 'line',
          smooth: true,
          data: total,
          itemStyle: { color: '#1677ff' },
          areaStyle: { color: 'rgba(22,119,255,0.12)' },
        },
      ],
    }
  }, [models, weekAxis])

  /** 是否存在任何趋势数据（本机新建 / 空表时无趋势，需显式空态而非画一条 0 线） */
  const hasTrend: boolean = models.some((item) => item.callTrend.length > 0)

  const columns = useMemo(
    () => [
      {
        title: '模型名称',
        dataIndex: 'modelName',
        width: 180,
        render: (text: string, row: AiModel) => (
          <Space size={4}>
            <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setDetailRow(row)}>
              {text}
            </Button>
            {source === 'demo' ? DEMO_TAG : null}
            {LOCAL_TAG}
          </Space>
        ),
      },
      {
        title: '类型',
        dataIndex: 'modelType',
        width: 120,
        render: (text: ModelType) => <Tag color="geekblue">{text}</Tag>,
      },
      { title: '版本', dataIndex: 'version', width: 110 },
      {
        title: '准确率',
        dataIndex: 'accuracy',
        width: 100,
        render: (v: number) => `${v}%`,
      },
      {
        title: '数据来源',
        key: 'sourceTag',
        width: 150,
        render: () => sourceTag,
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 100,
        render: (status: ModelStatus) => (
          <Tag color={STATUS_MAP[status].color}>{STATUS_MAP[status].label}</Tag>
        ),
      },
      { title: '今日调用', dataIndex: 'todayCalls', width: 110, render: (v: number) => v.toLocaleString() },
      { title: '更新时间', dataIndex: 'updatedAt', width: 150 },
      {
        title: '操作',
        key: 'action',
        width: 200,
        fixed: 'right' as const,
        render: (_: unknown, row: AiModel) => (
          <Space size={0}>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                setEditingId(row.modelId)
                form.setFieldsValue({
                  modelName: row.modelName,
                  modelType: row.modelType,
                  framework: row.framework,
                  version: row.version,
                  accuracy: row.accuracy,
                  avgLatency: row.avgLatency,
                })
                setDrawerOpen(true)
              }}
            >
              编辑
            </Button>
            <Button
              type="link"
              size="small"
              disabled={row.status === 'running'}
              onClick={() => handleToggle(row, 'running')}
            >
              启用
            </Button>
            <Button
              type="link"
              size="small"
              disabled={row.status === 'offline'}
              onClick={() => handleToggle(row, 'offline')}
            >
              停用
            </Button>
          </Space>
        ),
      },
    ],
    [form, source],
  )

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Alert
        type="warning"
        showIcon
        banner
        message="⚠️ 本机演示页：模型注册表仅保存在当前浏览器本地，不会同步到服务端，也不会对线上生效"
        description={
          <span>
            后端 <Typography.Text strong>暂无 AI 模型管理能力</Typography.Text>（已核实：无 ai_model /
            model_registry 表；mod-produce 的 <Typography.Text code>AiController</Typography.Text> 只是
            诊断记录 CRUD；satellite-ai-gateway 的视觉推理是永远降级的空壳桩）。
            因此本页的列表、创建 / 编辑、启用 / 停用全部写入{' '}
            <Typography.Text strong>当前浏览器的本地存储（localStorage）</Typography.Text>
            ：<Typography.Text strong>不会同步到服务端</Typography.Text>、对其他运营账号不可见、
            <Typography.Text strong>不会真正改变线上模型的运行状态</Typography.Text>。
            <Typography.Text strong>
              换设备、换浏览器、清理浏览器数据后，这些数据会丢失。
            </Typography.Text>
            <br />
            列表中带 <Typography.Text code>本机</Typography.Text> 标签的行即为本地数据；若同时带{' '}
            <Typography.Text code>示例数据</Typography.Text> 标签，说明是内置演示台账，
            <Typography.Text strong>不是任何真实模型</Typography.Text>。
            接入服务端接口前，请勿将本页内容当作生产环境的真实模型台账。
          </span>
        }
        action={
          <Space>
            <Button size="small" onClick={handleLoadDemo}>
              载入示例数据
            </Button>
            <Button size="small" danger onClick={handleClearLocal}>
              清空本机注册表
            </Button>
          </Space>
        }
      />

      {source === 'demo' ? (
        <Alert
          type="warning"
          showIcon
          message="当前展示的是内置示例数据（示例数据），不是真实模型台账"
          description="这些内容由前端内置的演示模板生成，仅存在于本机浏览器，用于演示页面交互；服务端不存在这些模型，也不会因本页操作发生任何变化。"
          action={
            <Button size="small" danger onClick={handleClearLocal}>
              清空并回到空态
            </Button>
          }
        />
      ) : null}

      {source === 'empty' ? (
        <Alert
          type="info"
          showIcon
          message="本机模型注册表为空：后端未提供模型注册接口，不会从服务端加载任何模型"
          description="这是本页的真实状态。若只是想演示页面交互，可点击「载入示例数据」；载入后整页会带「示例数据」标记。"
        />
      ) : null}

      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic title="模型总数（本机）" value={stats.total} suffix="个" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="运行中（本机）" value={stats.running} suffix="个" valueStyle={{ color: '#13a05a' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="待上线（本机）" value={stats.pending} suffix="个" valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="今日调用量（本机台账累加）" value={stats.todayCalls} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Space wrap>
          <Input.Search
            allowClear
            placeholder="搜索模型名称"
            style={{ width: 220 }}
            onSearch={(value) => setFilters((prev) => ({ ...prev, modelName: value }))}
          />
          <Select
            allowClear
            placeholder="模型类型"
            style={{ width: 150 }}
            options={TYPE_OPTIONS}
            onChange={(value) => setFilters((prev) => ({ ...prev, modelType: value }))}
          />
          <Select
            allowClear
            placeholder="运行状态"
            style={{ width: 150 }}
            options={[
              { value: 'running', label: '运行中' },
              { value: 'pending', label: '待上线' },
              { value: 'offline', label: '已下线' },
            ]}
            onChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
          />
          <Button onClick={() => setFilters({})}>重置</Button>
          <Button onClick={handleLoadDemo} disabled={source === 'demo'}>
            载入示例数据
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => void queryClient.invalidateQueries({ queryKey: ['admin-ai-models'] })}
          >
            刷新
          </Button>
          <Segmented
            value={view}
            onChange={(value) => setView(value as 'card' | 'table')}
            options={[
              { value: 'card', label: '卡片视图' },
              { value: 'table', label: '列表视图' },
            ]}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingId(undefined)
              form.resetFields()
              setDrawerOpen(true)
            }}
          >
            创建模型
          </Button>
        </Space>
      </Card>

      {models.length === 0 ? (
        <Card>
          <Empty
            description={
              <Space direction="vertical" size={8}>
                <Typography.Text>
                  本机模型注册表为空 —— 后端没有模型注册接口，这里不会从服务端加载任何模型
                </Typography.Text>
                <Typography.Text type="secondary">
                  如需演示页面交互，可载入内置示例数据（载入后全页带「示例数据」标记）
                </Typography.Text>
                <Button type="primary" onClick={handleLoadDemo}>
                  载入示例数据
                </Button>
              </Space>
            }
          />
        </Card>
      ) : displayRows.length === 0 ? (
        <Card>
          <Empty description="暂无符合筛选条件的模型" />
        </Card>
      ) : view === 'card' ? (
        <Row gutter={[16, 16]}>
          {displayRows.map((row) => (
            <Col span={8} key={row.modelId}>
              <Card
                title={
                  <Space>
                    <span>{row.modelName}</span>
                    <Tag color={STATUS_MAP[row.status].color}>{STATUS_MAP[row.status].label}</Tag>
                    {source === 'demo' ? DEMO_TAG : null}
                    {LOCAL_TAG}
                  </Space>
                }
                extra={
                  <Button type="link" size="small" onClick={() => setDetailRow(row)}>
                    趋势
                  </Button>
                }
                actions={[
                  row.status === 'running' ? (
                    <Button key="stop" type="link" size="small" onClick={() => handleToggle(row, 'offline')}>
                      停用
                    </Button>
                  ) : (
                    <Button key="start" type="link" size="small" onClick={() => handleToggle(row, 'running')}>
                      启用
                    </Button>
                  ),
                  <Button
                    key="edit"
                    type="link"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => {
                      setEditingId(row.modelId)
                      form.setFieldsValue({
                        modelName: row.modelName,
                        modelType: row.modelType,
                        framework: row.framework,
                        version: row.version,
                        accuracy: row.accuracy,
                        avgLatency: row.avgLatency,
                      })
                      setDrawerOpen(true)
                    }}
                  >
                    编辑
                  </Button>,
                ]}
              >
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Typography.Text type="secondary">
                    {row.version} · {row.modelType} · {row.framework}
                  </Typography.Text>
                  <Row gutter={8}>
                    <Col span={12}>
                      <Statistic title="准确率" value={row.accuracy} suffix="%" valueStyle={{ fontSize: 20 }} />
                    </Col>
                    <Col span={12}>
                      <Statistic
                        title="今日调用"
                        value={row.todayCalls}
                        valueStyle={{ fontSize: 20 }}
                      />
                    </Col>
                  </Row>
                  <Row gutter={8}>
                    <Col span={12}>
                      <Statistic
                        title="平均延迟"
                        value={row.avgLatency}
                        suffix="ms"
                        valueStyle={{ fontSize: 18 }}
                      />
                    </Col>
                    <Col span={12}>
                      <Statistic
                        title="GPU使用率"
                        value={row.gpuUsage}
                        suffix="%"
                        valueStyle={{ fontSize: 18 }}
                      />
                    </Col>
                  </Row>
                  <Progress
                    percent={row.gpuUsage}
                    size="small"
                    status={row.gpuUsage > 85 ? 'exception' : 'active'}
                  />
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      ) : (
        <Card>
          <Table<AiModel>
            rowKey="modelId"
            columns={columns}
            dataSource={displayRows}
            loading={listQuery.isLoading}
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
            scroll={{ x: 1200 }}
          />
        </Card>
      )}

      <Card
        title="模型调用量趋势(近7天)（本机台账数据）"
        extra={<Typography.Text type="secondary">服务端未提供调用量趋势接口</Typography.Text>}
      >
        {hasTrend ? (
          <ReactECharts option={platformTrend} style={{ height: 280 }} />
        ) : (
          <Empty description="暂无趋势数据：本机注册表内没有可用的调用量序列（服务端未提供该接口，不做本地估算）" />
        )}
      </Card>

      {/* 模型详情抽屉：准确率与调用量趋势 */}
      <Drawer
        title={detailRow ? `模型详情 - ${detailRow.modelName}` : '模型详情'}
        width={760}
        open={Boolean(detailRow)}
        onClose={() => setDetailRow(undefined)}
      >
        {detailRow ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="模型编号">
                <Space size={4}>
                  {detailRow.modelId}
                  {source === 'demo' ? DEMO_TAG : null}
                  {LOCAL_TAG}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="版本">{detailRow.version}</Descriptions.Item>
              <Descriptions.Item label="模型类型">{detailRow.modelType}</Descriptions.Item>
              <Descriptions.Item label="框架">{detailRow.framework}</Descriptions.Item>
              <Descriptions.Item label="准确率">{detailRow.accuracy}%</Descriptions.Item>
              <Descriptions.Item label="平均延迟">{detailRow.avgLatency} ms</Descriptions.Item>
              <Descriptions.Item label="今日调用">{detailRow.todayCalls}</Descriptions.Item>
              <Descriptions.Item label="GPU 使用率">{detailRow.gpuUsage}%</Descriptions.Item>
              <Descriptions.Item label="运行状态">
                <Tag color={STATUS_MAP[detailRow.status].color}>{STATUS_MAP[detailRow.status].label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">{detailRow.updatedAt}</Descriptions.Item>
            </Descriptions>
            <Card title="准确率趋势(近7天)" size="small">
              {detailRow.accuracyTrend.length > 0 || detailRow.callTrend.length > 0 ? (
                <ReactECharts option={buildTrendOption(detailRow)} style={{ height: 280 }} />
              ) : (
                <Empty description="本机新建模型暂无历史趋势（服务端未提供趋势数据，不做本地估算）" />
              )}
            </Card>
          </Space>
        ) : null}
      </Drawer>

      {/* 创建 / 编辑模型抽屉 */}
      <Drawer
        title={editingId ? '编辑 AI 模型' : '创建 AI 模型'}
        width={560}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        destroyOnHidden
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>取消</Button>
            <Button type="primary" onClick={() => form.submit()}>
              保存
            </Button>
          </Space>
        }
      >
        <Form<ModelFormValues> form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="modelName" label="模型名称" rules={[{ required: true, message: '请输入模型名称' }]}>
            <Input placeholder="如：病虫害识别模型" maxLength={40} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="modelType" label="模型类型" rules={[{ required: true, message: '请选择模型类型' }]}>
                <Select options={TYPE_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="framework" label="框架" rules={[{ required: true, message: '请输入框架' }]}>
                <Input placeholder="如：TensorFlow" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="version" label="版本" rules={[{ required: true, message: '请输入版本号' }]}>
                <Input placeholder="如：V1.0.0" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="accuracy"
                label="准确率(%)"
                rules={[{ required: true, message: '请输入准确率' }]}
              >
                <InputNumber min={0} max={100} step={0.1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="avgLatency"
                label="平均延迟(ms)"
                rules={[{ required: true, message: '请输入平均延迟' }]}
              >
                <InputNumber min={0} max={10000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Drawer>
    </Space>
  )
}
