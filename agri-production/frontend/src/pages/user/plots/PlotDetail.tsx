import BusinessRecordList from '@/components/BusinessRecordList'
import Card from '@/components/SectionCard'
/**
 * 页面名称：地块详情
 * 路由路径：/production/plots/:plotId
 * 所属模块：农场数字化管理
 * PRD 序号：PRD 6.1 #7
 * 原型来源：用户端原型 P5 plot-detail
 *
 * 还原要点（对照原型 P5）：
 * - 头部 `< 返回 {地块名}` ｜ `✏️ 编辑`、`🔗 溯源码`
 * - 「📍 基本信息」：地块编号 / 面积 / 所属农场 / 当前作物 / 品种 / 种植日期 /
 *   生长阶段（含第 N 天）/ 预计采收 / 灌溉方式 / 土壤类型
 * - 「🛰️ AI遥感分析 (V3.0)」：遥感影像占位 + 长势评估（ECharts 仪表盘）/ NDVI / 异常区域
 * - 「📡 实时环境数据」8 项指标格 + 近 7 日环境趋势折线
 * - 「📋 最近农事记录」5 条 + `查看全部→`
 * - 「💊 投入品使用统计」+ `查看投入品台账→`
 *
 * 数据说明：
 * - 地块、农场、农事计划、生长记录、环境数据均来自真实接口
 * - pH 取自 GET /plots/{plotId}/soil/latest
 * - 长势评分由最新生长记录的 growthLevel 折算（真实）；NDVI / 异常区域当前无遥感数据源，
 *   展示原型示例值并显式标注「示例」
 * - 字段映射（后端无独立列，勿在详情页另行读取，统一由 /production/plots/create 维护）：
 *   地块边界存 `boundary`（GeoJSON，坡度作为 slope 扩展属性）；中心点存 `center_longitude` / `center_latitude`。
 *   2026-10-17 修正：此前前端自造的 `geoBoundary` 键后端不收，位置信息实际没落库。
 *   农场「海拔 / 简介 / 业务类型」序列化存放于 Farm.remark。后端补列后需同步迁移读写两侧。
 */
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import PageContainer from '@/components/ProductionPageContainer'
import ReactECharts from 'echarts-for-react'
import {
  DeleteOutlined,
  EditOutlined,
  ExperimentOutlined,
  LeftOutlined,
  PlusOutlined,
  QrcodeOutlined,
} from '@ant-design/icons'
import {
  Alert,
  Button,
  Col,
  DatePicker,
  Divider,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Radio,
  Row,
  Select,
  Skeleton,
  Space,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { DetailInfoGrid } from '@/components'
import {
  createPlotCrop,
  deletePlotCrop,
  getLatestSoil,
  getPlot,
  listPlotCrops,
  updatePlotCrop,
  type PlotCropPayload,
} from '@/api/plots'
import { getFarm } from '@/api/farms'
import { listCropOptions } from '@/api/crops'
import { listHarvests } from '@/api/harvests'
import { getEnvironmentHistory, listEnvironmentData, listGrowthRecordsByPlot } from '@/api/growth'
import { listTasks } from '@/api/tasks'
import { listInputUsages } from '@/api/inputs'
import type {
  GrowthRecord,
  HarvestBatch,
  InputUsageRecord,
  PlotCrop,
  Task,
} from '@/types'
import {
  TiandituMap,
  parseBoundaryVertices,
  polygonCentroid,
  type TiandituMapPoint,
} from '@agri/shared'
// 地块状态与采收 / 投入品展示口径统一从 @/types 引入
import {
  BATCH_STATUS_META,
  GRADE_LABEL_MAP,
  PLOT_STATUS_META,
} from '@/types'

/** 地块状态元数据 */
/**
 * 任务状态文案。
 *
 * 键必须是后端真值 `pending/assigned/doing/done/rejected`；
 * `executing` / `accepted` 是前端历史字面量，后端不产出，仅作兼容保留，
 * 缺了 `done` 这一项会导致「已完成」标签永不命中（旧代码就是只有 accepted）。
 */
const TASK_STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: '待执行', color: 'blue' },
  assigned: { label: '待执行', color: 'blue' },
  doing: { label: '执行中', color: 'orange' },
  executing: { label: '执行中', color: 'orange' },
  done: { label: '已完成', color: 'green' },
  accepted: { label: '已完成', color: 'green' },
  rejected: { label: '已驳回', color: 'red' },
}

/** 长势评级 → 评分（growthLevel：1 弱 2 偏弱 3 正常 4 旺盛） */
const GROWTH_LEVEL_SCORE_MAP: Record<number, number> = {
  1: 45,
  2: 65,
  3: 80,
  4: 92,
}

/** 长势评级文案 */
const GROWTH_LEVEL_LABEL: Record<number, string> = {
  1: '弱',
  2: '偏弱',
  3: '正常',
  4: '旺盛',
}

/** 长势评级颜色 */
const GROWTH_LEVEL_COLOR: Record<number, string> = {
  1: 'red',
  2: 'orange',
  3: 'green',
  4: 'lime',
}

/** 种植标准（「添加种养品种」弹窗：有机 / 绿色 / 普通） */
const PLANTING_STANDARD_OPTIONS: Array<{
  value: 'ORGANIC' | 'GREEN' | 'NORMAL'
  label: string
  icon: string
  color: string
}> = [
  { value: 'ORGANIC', label: '有机', icon: '🌿', color: 'green' },
  { value: 'GREEN', label: '绿色', icon: '🍃', color: 'cyan' },
  { value: 'NORMAL', label: '普通', icon: '🌱', color: 'default' },
]

/** 种植标准元数据（未知 / 空值回落「未设置」） */
function plantingStandardMeta(value?: string): { label: string; icon: string; color: string } {
  return (
    PLANTING_STANDARD_OPTIONS.find((option) => option.value === value) ?? {
      label: '未设置',
      icon: '🌱',
      color: 'default',
    }
  )
}

/** 种植方式文案 */
const PLANTING_METHOD_LABEL: Record<string, string> = {
  TRANSPLANT: '移栽',
  DIRECT: '直播',
}

/** 作业方式文案 */
const OPERATION_METHOD_LABEL: Record<string, string> = {
  MANUAL: '人工',
  MECHANICAL: '机械',
}

/** 「添加种养品种」表单值（日期控件是 dayjs，提交时格式化为 YYYY-MM-DD） */
interface CropFormValues {
  /** 种类（作物主数据 ID） */
  cropId: string
  /** 品种 */
  cropVariety?: string
  /** 种植标准 */
  plantingStandard: 'ORGANIC' | 'GREEN' | 'NORMAL'
  /** 种植方式 */
  plantingMethod: 'TRANSPLANT' | 'DIRECT'
  /** 作业方式 */
  operationMethod: 'MANUAL' | 'MECHANICAL'
  /** 移栽时间 */
  transplantDate: Dayjs
  /** 预计采收时间 */
  expectedHarvestDate?: Dayjs
  /** 预计亩产（公斤/亩） */
  expectedYieldPerMu?: number
  /** 株数 */
  plantCount?: number
  /** 株间距（cm） */
  plantSpacing?: number
}

/** 评分分级文案 */
function scoreLevelText(score: number): string {
  if (score >= 90) return '优秀'
  if (score >= 75) return '良好'
  if (score >= 60) return '一般'
  return '偏弱'
}

/** 环境指标卡片定义 */
interface EnvMetric {
  /** 唯一键 */
  key: string
  /** 图标 + 名称 */
  label: string
  /** 数值 */
  value: string
  /** 单位 */
  unit: string
  /** 是否异常 */
  warning?: boolean
}

/**
 * 构建长势评分仪表盘配置。
 *
 * @param score 长势评分（0-100）
 * @returns ECharts 配置
 */
function buildGaugeOption(score: number): Record<string, unknown> {
  return {
    series: [
      {
        type: 'gauge',
        min: 0,
        max: 100,
        radius: '92%',
        startAngle: 210,
        endAngle: -30,
        progress: { show: true, width: 12, itemStyle: { color: '#52c41a' } },
        axisLine: { lineStyle: { width: 12, color: [[1, '#f0f0f0']] } },
        axisTick: { show: false },
        splitLine: { length: 8, lineStyle: { width: 1, color: '#d9d9d9' } },
        axisLabel: { distance: -18, color: '#8c8c8c', fontSize: 12 },
        pointer: { width: 4, itemStyle: { color: '#52c41a' } },
        detail: {
          valueAnimation: true,
          offsetCenter: [0, '40%'],
          fontSize: 24,
          color: '#262626',
          formatter: '{value} 分',
        },
        title: { offsetCenter: [0, '72%'], fontSize: 12, color: '#8c8c8c' },
        data: [{ value: score, name: scoreLevelText(score) }],
      },
    ],
  }
}

/**
 * 构建环境近 7 日趋势折线配置。
 *
 * @param dates 日期序列
 * @param temperatures 空气温度序列
 * @returns ECharts 配置
 */
/**
 * 构建近 7 日空气温度趋势图配置。
 *
 * @param dates 日期序列（yyyy-MM-dd）
 * @param temperatures 温度序列，**缺测为 null 且不补 0**（后端 EnvTrendVO 约定），
 *   这里靠 `connectNulls: false` 让折线自动断线，避免用 0 值伪造低温
 * @returns ECharts 配置
 */
function buildEnvTrendOption(
  dates: string[],
  temperatures: (number | null)[],
): Record<string, unknown> {
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['空气温度'], bottom: 0 },
    grid: { left: 48, right: 24, top: 24, bottom: 48 },
    xAxis: { type: 'category', data: dates, boundaryGap: false },
    yAxis: [
      { type: 'value', name: '℃', min: 'dataMin', max: 'dataMax' },
    ],
    series: [
      {
        name: '空气温度',
        type: 'line',
        smooth: true,
        data: temperatures,
        // 缺测点位断线，不把 null 当作 0 连过去
        connectNulls: false,
        itemStyle: { color: '#ff7a45' },
        areaStyle: { color: 'rgba(255,122,69,0.12)' },
      },
    ],
  }
}

/**
 * 地块详情页
 *
 * 业务职责：展示地块档案、AI 遥感概览、实时环境、最近农事与投入品统计。
 *
 * @returns 页面内容
 */
export default function PlotDetail(): JSX.Element {
  const { plotId } = useParams<{ plotId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  /** 种养品种弹窗：editingCrop 为空表示新增，有值表示编辑该条 */
  const [cropModalOpen, setCropModalOpen] = useState(false)
  const [editingCrop, setEditingCrop] = useState<PlotCrop | null>(null)
  const [cropForm] = Form.useForm<CropFormValues>()

  /** 地块信息 */
  const plotQuery = useQuery({
    queryKey: ['plot-detail', plotId],
    enabled: Boolean(plotId),
    queryFn: () => getPlot(plotId as string),
  })

  const plot = plotQuery.data

  /** 所属农场 */
  const farmQuery = useQuery({
    queryKey: ['plot-farm', plot?.farmId],
    enabled: Boolean(plot?.farmId),
    queryFn: () => getFarm(plot?.farmId as string),
    retry: false,
  })

  /**
   * 该地块最新生长记录。
   *
   * 走 `GET /growth/by-plot`（后端按 plotId 过滤）——分页的 `/growth/records`
   * 不接受 plotId，传了会被忽略导致取到其它地块的数据。
   */
  const growthQuery = useQuery({
    queryKey: ['plot-growth-latest', plotId],
    enabled: Boolean(plotId),
    queryFn: () => listGrowthRecordsByPlot(plotId as string),
    retry: false,
  })

  /**
   * 实时环境数据（宽表，服务端已把窄表透视成一行多指标）。
   *
   * 始终显式传起止日期：后端不传日期时曾经 NPE（MyBatis-Plus `ge(boolean, col, val)`
   * 会先求值 val），虽然现已修，但显式给窗口语义更明确也更稳。
   */
  const envQuery = useQuery({
    queryKey: ['plot-env-latest', plotId],
    enabled: Boolean(plotId),
    queryFn: () =>
      listEnvironmentData({
        plotId,
        startDate: dayjs().subtract(6, 'day').format('YYYY-MM-DD'),
        endDate: dayjs().format('YYYY-MM-DD'),
        pageNum: 1,
        pageSize: 20,
      }),
    retry: false,
  })

  /** 土壤检测最新记录（取 pH） */
  const soilQuery = useQuery({
    queryKey: ['plot-soil-latest', plotId],
    enabled: Boolean(plotId),
    queryFn: () => getLatestSoil(plotId as string),
    retry: false,
  })

  /** 最近的农事任务 */
  const taskQuery = useQuery({
    queryKey: ['plot-tasks', plotId],
    enabled: Boolean(plotId),
    queryFn: () => listTasks({ plotId, pageNum: 1, pageSize: 100 }),
    retry: false,
  })

  /** 采收记录 */
  const harvestQuery = useQuery({
    queryKey: ['plot-harvests', plotId],
    enabled: Boolean(plotId),
    queryFn: () => listHarvests({ plotId, pageNum: 1, pageSize: 100 }),
    retry: false,
  })

  /** 作物主数据（种养品种维护） */
  const cropOptionsQuery = useQuery({
    queryKey: ['crop-options'],
    queryFn: () => listCropOptions(),
    staleTime: 60_000,
  })

  /** 地块已登记的种养品种（一个地块可多条） */
  const plotCropsQuery = useQuery({
    queryKey: ['plot-crops', plotId],
    enabled: Boolean(plotId),
    queryFn: () => listPlotCrops(plotId as string),
    retry: false,
  })

  const plotCrops = useMemo(() => plotCropsQuery.data ?? [], [plotCropsQuery.data])

  /** 投入品使用记录 */
  const usageQuery = useQuery({
    queryKey: ['plot-input-usages', plotId],
    enabled: Boolean(plotId),
    queryFn: () => listInputUsages({ plotId, pageNum: 1, pageSize: 200 }),
    retry: false,
  })

  /** 近 7 日环境趋势 */
  const startDate = dayjs().subtract(6, 'day').format('YYYY-MM-DD')
  const endDate = dayjs().format('YYYY-MM-DD')
  const trendQuery = useQuery({
    queryKey: ['plot-env-history', plotId, startDate, endDate],
    enabled: Boolean(plotId),
    queryFn: () =>
      // 走 /growth/environment/history（后端已透视成 EnvTrendVO）；
      // 不再用 /environment/trend —— 那个返回窄表原始行 readTime+metricValue，没有 date/value 键
      getEnvironmentHistory(plotId as string, {
        metrics: 'air_temperature',
        startDate,
        endDate,
      }),
    retry: false,
  })

  /** 最新一条环境数据 */
  const latestEnv = useMemo(() => {
    const list = envQuery.data?.list ?? []
    if (list.length === 0) return undefined
    return [...list].sort((a, b) =>
      (a.collectedAt ?? '').localeCompare(b.collectedAt ?? ''),
    )[list.length - 1]
  }, [envQuery.data])

  /** 最新一条生长记录（by-plot 返回纯数组，非分页结构） */
  const latestGrowth = useMemo(() => {
    const list = growthQuery.data ?? []
    if (list.length === 0) return undefined
    return [...list].sort((a, b) =>
      (a.recordDate ?? '').localeCompare(b.recordDate ?? ''),
    )[list.length - 1]
  }, [growthQuery.data])

  /**
   * 地图点位：中心点优先，缺失但有多边形边界时用边界质心定位。
   *
   * <p>400 米外没中心点的存量地块也能在详情里看到边界，而不是只剩一个空白占位。</p>
   */
  const plotMapPoint = useMemo<TiandituMapPoint | null>(() => {
    if (!plot) return null
    const rawBoundary = plot.boundary ?? plot.geoBoundary
    const vertices = parseBoundaryVertices(rawBoundary)
    const hasCenter =
      plot.centerLongitude !== undefined &&
      plot.centerLongitude !== null &&
      plot.centerLatitude !== undefined &&
      plot.centerLatitude !== null
    const center = hasCenter
      ? {
          longitude: Number(plot.centerLongitude),
          latitude: Number(plot.centerLatitude),
        }
      : vertices.length >= 3
        ? polygonCentroid(vertices)
        : null
    if (!center) return null
    return {
      id: plot.plotId,
      longitude: center.longitude,
      latitude: center.latitude,
      title: plot.plotName,
      meta: `${Number(plot.area || 0).toLocaleString('zh-CN')}亩`,
      boundary: rawBoundary ?? null,
    }
  }, [plot])

  /** 是否已绘制多边形边界（用于详情地图下方的提示） */
  const hasBoundary = useMemo(
    () => parseBoundaryVertices(plot?.boundary ?? plot?.geoBoundary).length >= 3,
    [plot],
  )

  /**
   * 长势评分：由真实 growthLevel 折算；无长势记录时为 null，页面显示「未接入」，
   * 不再回落到示例分 80（那个数字会被当成该地块的真实长势分）。
   */
  const vigorScore = useMemo<number | null>(() => {
    if (latestGrowth?.growthLevel) {
      return GROWTH_LEVEL_SCORE_MAP[latestGrowth.growthLevel] ?? null
    }
    return null
  }, [latestGrowth])

  /** 是否有真实长势数据 */
  const hasGrowthData = Boolean(latestGrowth)

  /** 环境 8 项指标（原型 P5） */
  const envMetrics = useMemo<EnvMetric[]>(() => {
    const env = latestEnv
    return [
      { key: 'airTemp', label: '🌡️ 空气温度', value: env?.airTemperature?.toFixed(1) ?? '-', unit: '°C' },
      {
        key: 'airHumidity',
        label: '💧 湿度',
        value: env?.airHumidity?.toFixed(0) ?? '-',
        unit: '%',
        warning: (env?.airHumidity ?? 0) > 85,
      },
      { key: 'soilTemp', label: '🌡️ 土壤温度', value: env?.soilTemperature?.toFixed(1) ?? '-', unit: '°C' },
      {
        key: 'ph',
        label: '📊 pH',
        value: soilQuery.data?.ph !== undefined ? String(soilQuery.data.ph) : '-',
        unit: '',
      },
      {
        key: 'soilMoisture',
        label: '💧 土壤水分',
        value: env?.soilMoisture?.toFixed(0) ?? '-',
        unit: '%',
        warning: (env?.soilMoisture ?? 100) < 30,
      },
      {
        key: 'illuminance',
        label: '💡 光照强度',
        value: env?.illuminance?.toFixed(0) ?? '-',
        unit: 'lux',
      },
      { key: 'windSpeed', label: '🌬️ 风速', value: '-', unit: 'm/s' },
      { key: 'rainfall', label: '🌧️ 降雨', value: env?.rainfall?.toFixed(0) ?? '-', unit: 'mm' },
      {
        key: 'co2',
        label: '🌫️ CO₂ 浓度',
        value: env?.co2?.toFixed(0) ?? '-',
        unit: 'ppm',
      },
    ]
  }, [latestEnv, soilQuery.data])

  /**
   * 趋势图数据。
   *
   * 后端 `EnvTrendVO` 已给好 `dates` / `temperatures`，缺测点位是 **null 而不是 0**，
   * 这里原样透传给 ECharts（`connectNulls: false` 会断线），绝不补 0 伪造低温。
   */
  const trendData = useMemo(() => {
    const vo = trendQuery.data
    return {
      dates: vo?.dates ?? [],
      temperatures:
        vo?.temperatures?.map((value) => (value === null ? null : Number(value))) ?? [],
    }
  }, [trendQuery.data])

  /** 作物下拉（种养品种维护） */
  const cropOptions = useMemo(
    () =>
      (cropOptionsQuery.data ?? []).map((item) => ({
        value: item.cropId,
        label: item.cropName,
      })),
    [cropOptionsQuery.data],
  )

  /** 弹窗里已选的种类（品种输入框占位文案用） */
  const selectedCropId = Form.useWatch('cropId', cropForm)
  const selectedCropName = cropOptions.find((item) => item.value === selectedCropId)?.label

  /** 关联记录（统一在详情页展示与维护） */
  const tasks = taskQuery.data?.list ?? []
  const harvests = harvestQuery.data?.list ?? []
  const usages = usageQuery.data?.list ?? []
  const growthRecords = useMemo(
    () =>
      [...(growthQuery.data ?? [])].sort((a, b) =>
        (b.recordDate ?? '').localeCompare(a.recordDate ?? ''),
      ),
    [growthQuery.data],
  )

  /** 打开「添加种养品种」弹窗 */
  const openAddCropModal = (): void => {
    setEditingCrop(null)
    cropForm.resetFields()
    cropForm.setFieldsValue({
      plantingStandard: 'NORMAL',
      plantingMethod: 'TRANSPLANT',
      operationMethod: 'MANUAL',
    })
    setCropModalOpen(true)
  }

  /** 打开「编辑种养品种」弹窗 */
  const openEditCropModal = (record: PlotCrop): void => {
    setEditingCrop(record)
    cropForm.resetFields()
    cropForm.setFieldsValue({
      cropId:
        record.cropId === undefined || record.cropId === null ? '' : String(record.cropId),
      cropVariety: record.cropVariety,
      plantingStandard: record.plantingStandard ?? 'NORMAL',
      plantingMethod: record.plantingMethod ?? 'TRANSPLANT',
      operationMethod: record.operationMethod ?? 'MANUAL',
      transplantDate: record.transplantDate ? dayjs(record.transplantDate) : undefined,
      expectedHarvestDate: record.expectedHarvestDate
        ? dayjs(record.expectedHarvestDate)
        : undefined,
      expectedYieldPerMu: record.expectedYieldPerMu,
      plantCount: record.plantCount,
      plantSpacing: record.plantSpacing,
    })
    setCropModalOpen(true)
  }

  /** 新增 / 编辑种养品种 */
  const saveCropMutation = useMutation({
    mutationFn: async (values: CropFormValues) => {
      if (!plotId) throw new Error('地块信息尚未加载，请稍后重试')
      const payload: PlotCropPayload = {
        cropId: values.cropId,
        cropVariety: values.cropVariety?.trim() || undefined,
        plantingStandard: values.plantingStandard,
        plantingMethod: values.plantingMethod,
        operationMethod: values.operationMethod,
        transplantDate: values.transplantDate.format('YYYY-MM-DD'),
        expectedHarvestDate: values.expectedHarvestDate?.format('YYYY-MM-DD'),
        expectedYieldPerMu: values.expectedYieldPerMu,
        plantCount: values.plantCount,
        plantSpacing: values.plantSpacing,
      }
      return editingCrop
        ? updatePlotCrop(plotId, editingCrop.cropRecordId, payload)
        : createPlotCrop(plotId, payload)
    },
    onSuccess: () => {
      message.success(editingCrop ? '种养品种已更新' : '种养品种已添加')
      setCropModalOpen(false)
      setEditingCrop(null)
      void queryClient.invalidateQueries({ queryKey: ['plot-crops', plotId] })
    },
    onError: (error: Error) => message.error(error.message || '保存失败，请稍后重试'),
  })

  /** 删除种养品种 */
  const deleteCropMutation = useMutation({
    mutationFn: (record: PlotCrop) => deletePlotCrop(plotId as string, record.cropRecordId),
    onSuccess: (_data, record) => {
      message.success(`已删除种养品种：${record.cropName}`)
      void queryClient.invalidateQueries({ queryKey: ['plot-crops', plotId] })
    },
    onError: (error: Error) => message.error(error.message || '删除失败，请稍后重试'),
  })

  /** 农事记录列定义 */
  const taskColumns: ColumnsType<Task> = [
    {
      title: '日期',
      dataIndex: 'planStartDate',
      width: 96,
      render: (value: string) => (value ? dayjs(value).format('MM-DD') : '-'),
    },
    {
      title: '类型',
      dataIndex: 'taskType',
      width: 100,
      render: (value: string) => value || '-',
    },
    {
      title: '详情',
      dataIndex: 'description',
      ellipsis: true,
      render: (value: string, record) => value || record.taskName,
    },
    {
      title: '执行人',
      dataIndex: 'assigneeName',
      width: 100,
      render: (value: string) =>
        value || <Typography.Text type="secondary">未派发</Typography.Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 96,
      render: (_, record) => {
        const meta = TASK_STATUS_META[record.status] ?? { label: record.status, color: 'default' }
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Typography.Link onClick={() => navigate(`/production/tasks/${record.taskId}`)}>
          查看
        </Typography.Link>
      ),
    },
  ]

  /** 采收记录列定义 */
  const harvestColumns: ColumnsType<HarvestBatch> = [
    { title: '采收日期', dataIndex: 'harvestDate', width: 110 },
    {
      title: '数量',
      key: 'quantity',
      width: 120,
      render: (_, record) =>
        `${Number(record.quantity || 0).toLocaleString('zh-CN')} ${record.unit ?? ''}`,
    },
    {
      title: '质量等级',
      dataIndex: 'grade',
      width: 96,
      render: (value: string) => <Tag>{GRADE_LABEL_MAP[value] ?? value ?? '-'}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 96,
      render: (value: HarvestBatch['status']) => {
        const meta = BATCH_STATUS_META[value] ?? { label: value, color: 'default' }
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Typography.Link onClick={() => navigate(`/production/harvests/${record.batchId}`)}>
          查看
        </Typography.Link>
      ),
    },
  ]

  /** 农资使用记录列定义 */
  const usageColumns: ColumnsType<InputUsageRecord> = [
    {
      title: '使用日期',
      dataIndex: 'usedAt',
      width: 110,
      render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD') : '-'),
    },
    {
      title: '投入品',
      dataIndex: 'inputName',
      ellipsis: true,
      render: (value: string) => value || '-',
    },
    {
      title: '用量',
      key: 'dosage',
      width: 120,
      render: (_, record) => `${record.dosage ?? '-'} ${record.unit ?? ''}`,
    },
    {
      title: '方式',
      dataIndex: 'method',
      width: 90,
      render: (value: string) => value || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) =>
        record.inputId ? (
          <Typography.Link onClick={() => navigate(`/production/inputs/${record.inputId}`)}>
            查看
          </Typography.Link>
        ) : (
          '-'
        ),
    },
  ]

  /** 种植模型（生长）记录列定义 */
  const growthColumns: ColumnsType<GrowthRecord> = [
    { title: '记录日期', dataIndex: 'recordDate', width: 110 },
    { title: '生育期', dataIndex: 'growthStage', width: 110 },
    {
      title: '株高(cm)',
      dataIndex: 'plantHeight',
      width: 100,
      render: (value: number | undefined) => value ?? '-',
    },
    {
      title: '叶面积指数',
      dataIndex: 'leafAreaIndex',
      width: 110,
      render: (value: number | undefined) => value ?? '-',
    },
    {
      title: '长势',
      dataIndex: 'growthLevel',
      width: 90,
      render: (value: number) => (
        <Tag color={GROWTH_LEVEL_COLOR[value] ?? 'default'}>
          {GROWTH_LEVEL_LABEL[value] ?? value}
        </Tag>
      ),
    },
    {
      title: '记录人',
      dataIndex: 'recorderName',
      width: 100,
      render: (value: string) => value || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: () => (
        <Typography.Link
          onClick={() => navigate(`/production/growth/records?plotId=${plotId}`)}
        >
          维护
        </Typography.Link>
      ),
    },
  ]

  /** 主内容 */
  if (plotQuery.isLoading) {
    return (
      <PageContainer title="地块详情">
        <Skeleton active paragraph={{ rows: 12 }} />
      </PageContainer>
    )
  }

  if (plotQuery.isError || !plot) {
    return (
      <PageContainer title="地块详情">
        <Empty
          description={
            <Space direction="vertical">
              <Typography.Text type="danger">地块数据加载失败，请稍后重试</Typography.Text>
              <Button onClick={() => void plotQuery.refetch()}>重新加载</Button>
              <Button onClick={() => navigate('/production/plots')}>返回地块列表</Button>
            </Space>
          }
        />
      </PageContainer>
    )
  }

  const statusMeta = PLOT_STATUS_META[plot.status] ?? { label: '未知', color: 'default' }

  return (
    <PageContainer
      title={`🗺️ ${plot.plotName}`}
      subTitle={plot.plotCode}
      onBack={() => navigate('/production/plots')}
      backIcon={<LeftOutlined />}
      extra={[
        <Button
          key="soil"
          icon={<ExperimentOutlined />}
          onClick={() => navigate(`/production/plots/${plotId}/soil`)}
        >
          🧪 土壤档案
        </Button>,
        <Button
          key="edit"
          icon={<EditOutlined />}
          // 编辑走 plots/Create 的编辑态，字段映射（geoBoundary / remark）由该页统一维护
          onClick={() => navigate(`/production/plots/create?plotId=${plotId}`)}
        >
          ✏️ 编辑
        </Button>,
        <Button
          key="trace"
          icon={<QrcodeOutlined />}
          onClick={() => navigate('/production/trace')}
        >
          🔗 溯源码
        </Button>,
      ]}
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Card
          title="📋 基本信息"
          extra={<Tag color={statusMeta.color}>{statusMeta.label}</Tag>}
        >
          <DetailInfoGrid
            columns={2}
            items={[
              { key: 'code', label: '地块编号', value: plot.plotCode || '-' },
              {
                key: 'area',
                label: '面积',
                value: `${Number(plot.area || 0).toLocaleString('zh-CN')}亩`,
              },
              {
                key: 'farm',
                label: '所属农场',
                value: plot.farmName ?? farmQuery.data?.farmName ?? '-',
              },
              { key: 'irrigation', label: '灌溉方式', value: plot.irrigationType || '-' },
              { key: 'soil', label: '土壤类型', value: plot.soilType || '-' },
            ]}
          />
        </Card>

        <Card
          title={`🌱 种养品种（${plotCrops.length}）`}
          extra={
            <Typography.Link onClick={openAddCropModal}>
              <PlusOutlined /> 添加种养品种
            </Typography.Link>
          }
        >
          {plotCrops.length === 0 ? (
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {(plot.currentCrop || plot.cropVariety) && (
                <Alert
                  type="info"
                  showIcon
                  message={`该地块此前登记的单一种养品种：${plot.currentCrop ?? plot.cropVariety}${
                    plot.cropVariety ? `（${plot.cropVariety}）` : ''
                  }`}
                  description="添加种养品种后，详情页按多品种台账展示与维护；地块原有的「当前作物」仍用于列表显示。"
                />
              )}
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="尚未添加种养品种"
              >
                <Button type="primary" icon={<PlusOutlined />} onClick={openAddCropModal}>
                  添加种养品种
                </Button>
              </Empty>
            </Space>
          ) : (
            <Row gutter={[12, 12]}>
              {plotCrops.map((record) => {
                const standard = plantingStandardMeta(record.plantingStandard)
                return (
                  <Col key={record.cropRecordId} xs={24} sm={12} xl={8}>
                    <Card
                      size="small"
                      style={{ height: '100%', borderColor: '#b7eb8f' }}
                      title={
                        <Space size={8} wrap>
                          <Typography.Text strong style={{ fontSize: 16 }}>
                            {standard.icon} {record.cropName}
                          </Typography.Text>
                          <Tag color={standard.color}>{standard.label}</Tag>
                        </Space>
                      }
                      extra={
                        <Space size={8}>
                          <Typography.Link onClick={() => openEditCropModal(record)}>
                            <EditOutlined /> 编辑
                          </Typography.Link>
                          <Popconfirm
                            title="删除该种养品种？"
                            description="删除后该品种明细不再展示，地块其他记录不受影响。"
                            okText="删除"
                            cancelText="取消"
                            okButtonProps={{ danger: true }}
                            onConfirm={() => deleteCropMutation.mutate(record)}
                          >
                            <Typography.Link type="danger">
                              <DeleteOutlined /> 删除
                            </Typography.Link>
                          </Popconfirm>
                        </Space>
                      }
                    >
                      <DetailInfoGrid
                        columns={2}
                        items={[
                          { key: 'variety', label: '品种', value: record.cropVariety || '-' },
                          {
                            key: 'method',
                            label: '种植方式',
                            value: PLANTING_METHOD_LABEL[record.plantingMethod ?? ''] ?? '-',
                          },
                          {
                            key: 'operation',
                            label: '作业方式',
                            value: OPERATION_METHOD_LABEL[record.operationMethod ?? ''] ?? '-',
                          },
                          {
                            key: 'transplant',
                            label: '移栽时间',
                            value: record.transplantDate || '-',
                          },
                          {
                            key: 'harvest',
                            label: '预计采收',
                            value: record.expectedHarvestDate || '-',
                          },
                          {
                            key: 'yield',
                            label: '预计亩产',
                            value:
                              record.expectedYieldPerMu !== undefined
                                ? `${record.expectedYieldPerMu} 公斤/亩`
                                : '-',
                          },
                          {
                            key: 'count',
                            label: '株数',
                            value:
                              record.plantCount !== undefined ? `${record.plantCount} 株` : '-',
                          },
                          {
                            key: 'spacing',
                            label: '株间距',
                            value:
                              record.plantSpacing !== undefined
                                ? `${record.plantSpacing} cm`
                                : '-',
                          },
                        ]}
                      />
                    </Card>
                  </Col>
                )
              })}
              <Col xs={24} sm={12} xl={8}>
                <Card
                  size="small"
                  hoverable
                  style={{
                    height: '100%',
                    minHeight: 240,
                    borderStyle: 'dashed',
                    cursor: 'pointer',
                  }}
                  onClick={openAddCropModal}
                >
                  <div
                    style={{
                      height: '100%',
                      minHeight: 190,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Space direction="vertical" align="center" size={8}>
                      <PlusOutlined style={{ fontSize: 28, color: '#52c41a' }} />
                      <Typography.Text type="secondary">添加种养品种</Typography.Text>
                    </Space>
                  </div>
                </Card>
              </Col>
            </Row>
          )}
        </Card>

        <Card
          title="🗺️ 地块位置与边界"
          extra={<Tag color="green">天地图</Tag>}
        >
          {plotMapPoint ? (
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <TiandituMap
                points={[plotMapPoint]}
                height={360}
                zoom={15}
                showLegend={false}
              />
              {!hasBoundary && (
                <Typography.Text type="secondary">
                  该地块尚未绘制边界，可在编辑页用天地图绘制，保存后在此展示。
                </Typography.Text>
              )}
            </Space>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="该地块尚未维护中心点与边界"
            >
              <Button onClick={() => navigate(`/production/plots/create?plotId=${plotId}`)}>
                去编辑
              </Button>
            </Empty>
          )}
        </Card>

        <Card
          title="🛰️ AI遥感分析 (V3.0)"
          extra={
            <Typography.Link onClick={() => navigate(`/production/growth?plotId=${plotId}`)}>
              查看遥感详情→
            </Typography.Link>
          }
        >
          {!hasGrowthData && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message="遥感影像源未接入：NDVI、异常区域、影像更新时间均无真实数据，显示「未接入」"
              description="后端暂无遥感/NDVI 数据源。原实现会显示原型示例值（NDVI 0.78、东北角约 3 亩偏黄、2026-06-03），可能被误判为该地块的真实长势，已改为显式标注未接入。"
            />
          )}
          <Row gutter={16}>
            <Col xs={24} md={10}>
              <div
                style={{
                  height: 220,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background:
                    'repeating-linear-gradient(45deg, #d9f7be, #d9f7be 14px, #b7eb8f 14px, #b7eb8f 28px)',
                }}
              >
                <Space direction="vertical" align="center">
                  <Typography.Text strong style={{ fontSize: 18 }}>
                    🛰️ 遥感影像
                  </Typography.Text>
                  <Typography.Text type="secondary">
                    影像更新：{latestGrowth?.recordDate ?? '未接入'}
                  </Typography.Text>
                </Space>
              </div>
            </Col>
            <Col xs={24} md={7}>
              {vigorScore === null ? (
                <div
                  style={{
                    height: 220,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography.Text type="secondary">长势评分 未接入</Typography.Text>
                </div>
              ) : (
                <ReactECharts
                  option={buildGaugeOption(vigorScore)}
                  style={{ height: 220 }}
                  notMerge
                />
              )}
            </Col>
            <Col xs={24} md={7}>
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Card size="small" title="长势评估">
                  {vigorScore === null ? (
                    <Space size={6} wrap>
                      <Typography.Text strong style={{ fontSize: 20 }}>
                        未接入
                      </Typography.Text>
                      <Tag color="orange">无长势记录</Tag>
                    </Space>
                  ) : (
                    <>
                      <Typography.Text strong style={{ fontSize: 20 }}>
                        {vigorScore} 分
                      </Typography.Text>
                      <Divider type="vertical" />
                      <Tag color={vigorScore >= 75 ? 'green' : 'orange'}>
                        {scoreLevelText(vigorScore)}
                      </Tag>
                    </>
                  )}
                </Card>
                <Card size="small" title="NDVI 指数">
                  {/*
                    后端生长记录（GrowthRecord）根本没有 NDVI 列，
                    只有株高 / 叶面积指数 / 长势评级，因此 NDVI 一律显示「未接入」，
                    不拿叶面积指数顶替，也不再显示原型示例的 0.78。
                  */}
                  <Space size={6} wrap>
                    <Typography.Text strong style={{ fontSize: 20 }}>
                      未接入
                    </Typography.Text>
                    <Tag color="orange">遥感源未接入</Tag>
                  </Space>
                </Card>
                <Card size="small" title="异常区域">
                  <Space size={6} wrap>
                    <Typography.Text type="warning" style={{ fontSize: 20 }}>
                      未接入
                    </Typography.Text>
                    <Tag color="orange">遥感源未接入</Tag>
                  </Space>
                </Card>
              </Space>
            </Col>
          </Row>
        </Card>

        <Card
          title="📡 实时环境数据"
          extra={
            <Space size={12}>
              <Typography.Link
                onClick={() => navigate(`/production/iot/bindings?plotId=${plotId}`)}
              >
                绑定监测设备→
              </Typography.Link>
              <Typography.Link
                onClick={() => navigate(`/production/growth/environment?plotId=${plotId}`)}
              >
                查看历史曲线→
              </Typography.Link>
            </Space>
          }
        >
          {!latestEnv && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message="暂无环境数据，请先为该地块绑定 IoT 设备或人工录入环境数据"
            />
          )}
          <Row gutter={[12, 12]}>
            {envMetrics.map((metric) => (
              <Col key={metric.key} xs={12} sm={8} md={6} xl={4}>
                <Card size="small" style={{ textAlign: 'center' }}>
                  <Typography.Text type="secondary">{metric.label}</Typography.Text>
                  <div>
                    <Typography.Text
                      strong
                      style={{ fontSize: 20, color: metric.warning ? '#ff4d4f' : undefined }}
                    >
                      {metric.value}
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ marginLeft: 4 }}>
                      {metric.unit}
                    </Typography.Text>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
          <Divider orientation="left" plain>
            近 7 日空气温度趋势
          </Divider>
          {trendData.dates.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无历史环境曲线数据"
            />
          ) : (
            <ReactECharts
              option={buildEnvTrendOption(trendData.dates, trendData.temperatures)}
              style={{ height: 260 }}
              notMerge
            />
          )}
        </Card>

        <Card title="📋 关联记录">
          <Tabs
            items={[
              {
                key: 'tasks',
                label: `农事记录（${tasks.length}）`,
                children: (
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    <Row justify="space-between" align="middle" gutter={[12, 8]}>
                      <Col>

                      </Col>
                      <Col>
                        <Button
                          size="small"
                          type="primary"
                          onClick={() =>
                            navigate(
                              `/production/tasks/create?plotId=${plotId}&farmId=${plot.farmId}`,
                            )
                          }
                        >
                          新增农事记录
                        </Button>
                      </Col>
                    </Row>
                    <BusinessRecordList<Task>
                      rowKey="taskId"
                      size="small"
                      dataSource={tasks}
                      columns={taskColumns}
                      pagination={{ pageSize: 5, size: 'small', showSizeChanger: false }}
                      scroll={{ x: 720 }}
                      locale={{
                        emptyText: (
                          <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description="暂无农事记录"
                          />
                        ),
                      }}
                    />
                  </Space>
                ),
              },
              {
                key: 'harvests',
                label: `采收记录（${harvests.length}）`,
                children: (
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    <Row justify="space-between" align="middle" gutter={[12, 8]}>
                      <Col>
                        <Typography.Text type="secondary">
                          该地块的采收批次，进入详情可确认入库
                        </Typography.Text>
                      </Col>
                      <Col>
                        <Button
                          size="small"
                          type="primary"
                          onClick={() =>
                            navigate(
                              `/production/harvests/create?plotId=${plotId}&farmId=${plot.farmId}`,
                            )
                          }
                        >
                          新增采收记录
                        </Button>
                      </Col>
                    </Row>
                    <BusinessRecordList<HarvestBatch>
                      rowKey="batchId"
                      size="small"
                      dataSource={harvests}
                      columns={harvestColumns}
                      pagination={{ pageSize: 5, size: 'small', showSizeChanger: false }}
                      scroll={{ x: 620 }}
                      locale={{
                        emptyText: (
                          <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description="暂无采收记录"
                          />
                        ),
                      }}
                    />
                  </Space>
                ),
              },
              {
                key: 'usages',
                label: `农资使用（${usages.length}）`,
                children: (
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    <Row justify="space-between" align="middle" gutter={[12, 8]}>
                      <Col>

                      </Col>
                      <Col>
                        <Button
                          size="small"
                          type="primary"
                          onClick={() =>
                            navigate(
                              `/production/inputs?tab=ledger&plotId=${plotId}&create=1`,
                            )
                          }
                        >
                          新增农资使用
                        </Button>
                      </Col>
                    </Row>
                    <BusinessRecordList<InputUsageRecord>
                      rowKey="usageId"
                      size="small"
                      dataSource={usages}
                      columns={usageColumns}
                      pagination={{ pageSize: 5, size: 'small', showSizeChanger: false }}
                      scroll={{ x: 620 }}
                      locale={{
                        emptyText: (
                          <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description="暂无农资使用记录"
                          />
                        ),
                      }}
                    />
                  </Space>
                ),
              },
              {
                key: 'growth',
                label: `种植模型（${growthRecords.length}）`,
                children: (
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    <Row justify="space-between" align="middle" gutter={[12, 8]}>
                      <Col>

                      </Col>
                      <Col>
                        <Button
                          size="small"
                          type="primary"
                          onClick={() =>
                            navigate(
                              `/production/growth/records?plotId=${plotId}&create=1`,
                            )
                          }
                        >
                          新增模型记录
                        </Button>
                      </Col>
                    </Row>
                    <BusinessRecordList<GrowthRecord>
                      rowKey="recordId"
                      size="small"
                      dataSource={growthRecords}
                      columns={growthColumns}
                      pagination={{ pageSize: 5, size: 'small', showSizeChanger: false }}
                      scroll={{ x: 820 }}
                      locale={{
                        emptyText: (
                          <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description="暂无种植模型记录"
                          />
                        ),
                      }}
                    />
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      </Space>

      <Modal
        title={editingCrop ? '🌱 编辑种养品种' : '🌱 添加种养品种'}
        open={cropModalOpen}
        okText="确定"
        cancelText="取消"
        width={640}
        destroyOnHidden
        forceRender
        confirmLoading={saveCropMutation.isPending}
        onCancel={() => {
          setCropModalOpen(false)
          setEditingCrop(null)
        }}
        onOk={() => {
          void cropForm.validateFields().then((values) => saveCropMutation.mutate(values))
        }}
      >
        <Form form={cropForm} layout="vertical" preserve={false}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="cropId"
                label="种类"
                rules={[{ required: true, message: '请选择种类' }]}
                extra="取自作物主数据；没有需要的作物请联系平台运营新增"
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={cropOptions}
                  placeholder="请选择种类"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="cropVariety" label="品种">
                <Input
                  placeholder={
                    selectedCropName ? `${selectedCropName}的哪个品种` : '该作物下的哪个品种'
                  }
                  maxLength={50}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="plantingStandard"
            label="种植标准"
            rules={[{ required: true, message: '请选择种植标准' }]}
          >
            <Radio.Group style={{ width: '100%' }}>
              <Row gutter={8}>
                {PLANTING_STANDARD_OPTIONS.map((option) => (
                  <Col span={8} key={option.value}>
                    <Radio.Button
                      value={option.value}
                      style={{
                        width: '100%',
                        height: 64,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      <span style={{ fontSize: 18 }}>{option.icon}</span>
                      {option.label}
                    </Radio.Button>
                  </Col>
                ))}
              </Row>
            </Radio.Group>
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="plantingMethod"
                label="种植方式"
                rules={[{ required: true, message: '请选择种植方式' }]}
              >
                <Radio.Group>
                  <Radio value="TRANSPLANT">移栽</Radio>
                  <Radio value="DIRECT">直播</Radio>
                </Radio.Group>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="operationMethod"
                label="作业方式"
                rules={[{ required: true, message: '请选择作业方式' }]}
              >
                <Radio.Group>
                  <Radio value="MANUAL">人工</Radio>
                  <Radio value="MECHANICAL">机械</Radio>
                </Radio.Group>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="transplantDate"
                label="移栽时间"
                rules={[{ required: true, message: '请选择移栽时间' }]}
              >
                <DatePicker
                  style={{ width: '100%' }}
                  format="YYYY-MM-DD"
                  placeholder="请选择移栽时间"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="expectedHarvestDate" label="预计采收时间">
                <DatePicker
                  style={{ width: '100%' }}
                  format="YYYY-MM-DD"
                  placeholder="请选择预计采收时间"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="expectedYieldPerMu" label="预计亩产">
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                  addonAfter="公斤/亩"
                  placeholder="如 5000"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="plantCount" label="株数">
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={0}
                  addonAfter="株"
                  placeholder="如 1200"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="plantSpacing" label="株间距">
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                  addonAfter="cm"
                  placeholder="如 35"
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </PageContainer>
  )
}
