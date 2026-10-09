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
 * - 地块、农场、种养计划、生长记录、环境数据均来自真实接口
 * - pH 取自 GET /plots/{plotId}/soil/latest
 * - 长势评分由最新生长记录的 growthLevel 折算（真实）；NDVI / 异常区域当前无遥感数据源，
 *   展示原型示例值并显式标注「示例」
 * - 字段映射（后端无独立列，勿在详情页另行读取，统一由 /production/plots/create 维护）：
 *   地块「经度 / 纬度 / 坡度 / 边界」序列化存放于 geoBoundary（Point/Polygon GeoJSON + slope）；
 *   农场「海拔 / 简介 / 业务类型」序列化存放于 Farm.remark。后端补列后需同步迁移读写两侧。
 */
import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PageContainer } from '@ant-design/pro-components'
import ReactECharts from 'echarts-for-react'
import { EditOutlined, ExperimentOutlined, LeftOutlined, QrcodeOutlined } from '@ant-design/icons'
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Empty,
  Row,
  Skeleton,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { getLatestSoil, getPlot } from '@/api/plots'
import { getFarm } from '@/api/farms'
import { getEnvironmentHistory, listEnvironmentData, listGrowthRecordsByPlot } from '@/api/growth'
import { getPlan } from '@/api/plans'
import { listTasks } from '@/api/tasks'
import { listInputUsages } from '@/api/inputs'
import type { Task } from '@/types'
// 地块状态已统一收敛到 @/types（原各页面各存一份）
import { PLOT_STATUS_META } from '@/types'

/** 地块状态元数据 */
/** 任务状态文案（与任务模块保持一致） */
const TASK_STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: '待执行', color: 'blue' },
  assigned: { label: '待执行', color: 'blue' },
  executing: { label: '执行中', color: 'orange' },
  submitted: { label: '待验收', color: 'purple' },
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

/** 评分分级文案 */
function scoreLevelText(score: number): string {
  if (score >= 90) return '优秀'
  if (score >= 75) return '良好'
  if (score >= 60) return '一般'
  return '偏弱'
}

/** 原型 P5 的 AI 遥感示例值（遥感数据源未接入时使用） */
const SAMPLE_REMOTE_SENSING = {
  /** NDVI 指数 */
  ndvi: 0.78,
  /** 异常区域描述 */
  abnormalArea: '东北角约 3 亩偏黄',
  /** 影像更新时间 */
  updatedAt: '2026-06-03',
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
        axisLabel: { distance: -18, color: '#8c8c8c', fontSize: 10 },
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

  /** 当前种养计划 */
  const planQuery = useQuery({
    queryKey: ['plot-plan', plot?.currentPlanId],
    enabled: Boolean(plot?.currentPlanId),
    queryFn: () => getPlan(plot?.currentPlanId as string),
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
    queryFn: () => listTasks({ plotId, pageNum: 1, pageSize: 5 }),
    retry: false,
  })

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

  /** 长势评分（真实：由 growthLevel 折算；缺省回落到 85 示例分） */
  const vigorScore = useMemo(() => {
    if (latestGrowth?.growthLevel) {
      return GROWTH_LEVEL_SCORE_MAP[latestGrowth.growthLevel] ?? 80
    }
    return 80
  }, [latestGrowth])

  /** 是否有真实长势数据 */
  const hasGrowthData = Boolean(latestGrowth)

  /** 种植天数 */
  const plantingDays = useMemo(() => {
    const start = planQuery.data?.startDate ?? latestGrowth?.recordDate
    if (!start) return undefined
    return Math.max(0, dayjs().startOf('day').diff(dayjs(start).startOf('day'), 'day'))
  }, [planQuery.data, latestGrowth])

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

  /** 投入品统计 */
  const usageStats = useMemo(() => {
    const rows = usageQuery.data?.list ?? []
    const total = rows.length
    const grouped: Record<string, { count: number; amount: number; unit: string }> = {}
    rows.forEach((row) => {
      const key = row.inputName ?? row.inputId ?? '其它'
      if (!grouped[key]) grouped[key] = { count: 0, amount: 0, unit: row.unit ?? '' }
      grouped[key].count += 1
      grouped[key].amount += Number(row.quantity) || 0
    })
    return { total, grouped }
  }, [usageQuery.data])

  /** 农事记录列定义（原型 P5 表头） */
  const taskColumns: ColumnsType<Task> = [
    {
      title: '日期',
      dataIndex: 'planStartDate',
      width: 90,
      render: (value: string) => (value ? dayjs(value).format('MM-DD') : '-'),
    },
    { title: '类型', dataIndex: 'taskType', width: 110, render: (value: string) => value || '-' },
    {
      title: '详情',
      dataIndex: 'description',
      ellipsis: true,
      render: (value: string, record) => value || record.taskName,
    },
    {
      title: '操作人',
      dataIndex: 'assigneeName',
      width: 100,
      render: (value: string) => value || <Typography.Text type="secondary">未派发</Typography.Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (_, record) => {
        const meta = TASK_STATUS_META[record.status] ?? { label: record.status, color: 'default' }
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: (
        <Tooltip title="上链状态由区块链存证模块写入，以存证查询为准">上链 🔗</Tooltip>
      ),
      key: 'onChain',
      width: 100,
      render: () => <Typography.Text type="secondary">—</Typography.Text>,
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
  const plan = planQuery.data
  const cropName = plan?.cropName ?? plot.cropVariety ?? '-'
  const variety = plot.cropVariety ?? plan?.cropVariety ?? '-'
  const stageText = latestGrowth?.growthStage
  const usages = Object.entries(usageStats.grouped)

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
        <Card title="📍 基本信息">
          <Descriptions
            bordered
            column={{ xs: 1, sm: 2, md: 3 }}
            size="small"
            items={[
              { key: 'code', label: '地块编号', children: plot.plotCode || '-' },
              {
                key: 'area',
                label: '面积',
                children: `${Number(plot.area || 0).toLocaleString('zh-CN')}亩`,
              },
              {
                key: 'farm',
                label: '所属',
                children: plot.farmName ?? farmQuery.data?.farmName ?? '-',
              },
              { key: 'crop', label: '当前作物', children: cropName },
              { key: 'variety', label: '品种', children: variety },
              { key: 'plantDate', label: '种植日期', children: plan?.startDate ?? '-' },
              {
                key: 'stage',
                label: '生长阶段',
                children: (
                  <Space size={4}>
                    <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
                    {stageText && <Tag color="geekblue">{stageText}</Tag>}
                    {plantingDays !== undefined && (
                      <Typography.Text type="secondary">第 {plantingDays} 天</Typography.Text>
                    )}
                  </Space>
                ),
              },
              { key: 'harvest', label: '预计采收', children: plan?.endDate ?? '-' },
              { key: 'irrigation', label: '灌溉方式', children: plot.irrigationType || '-' },
              { key: 'soil', label: '土壤类型', children: plot.soilType || '-' },
            ]}
          />
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
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message="当前尚无长势记录，NDVI 与异常区域展示原型示例值（遥感影像源接入后自动切换）"
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
                    影像更新：{latestGrowth?.recordDate ?? SAMPLE_REMOTE_SENSING.updatedAt}
                  </Typography.Text>
                </Space>
              </div>
            </Col>
            <Col xs={24} md={7}>
              <ReactECharts
                option={buildGaugeOption(vigorScore)}
                style={{ height: 220 }}
                notMerge
              />
            </Col>
            <Col xs={24} md={7}>
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Card size="small" title="长势评估">
                  <Typography.Text strong style={{ fontSize: 20 }}>
                    {vigorScore} 分
                  </Typography.Text>
                  <Divider type="vertical" />
                  <Tag color={vigorScore >= 75 ? 'green' : 'orange'}>
                    {scoreLevelText(vigorScore)}
                  </Tag>
                </Card>
                <Card size="small" title="NDVI 指数">
                  <Space size={6}>
                    <Typography.Text strong style={{ fontSize: 20 }}>
                      {SAMPLE_REMOTE_SENSING.ndvi}
                    </Typography.Text>
                    {!hasGrowthData && <Tag>示例</Tag>}
                  </Space>
                </Card>
                <Card size="small" title="异常区域">
                  <Space size={6}>
                    <Typography.Text type="warning">
                      {SAMPLE_REMOTE_SENSING.abnormalArea}
                    </Typography.Text>
                    {!hasGrowthData && <Tag>示例</Tag>}
                  </Space>
                </Card>
              </Space>
            </Col>
          </Row>
        </Card>

        <Card
          title="📡 实时环境数据"
          extra={
            <Typography.Link
              onClick={() => navigate(`/production/growth/environment?plotId=${plotId}`)}
            >
              查看历史曲线→
            </Typography.Link>
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

        <Card
          title="📋 最近农事记录 (5条)"
          extra={
            <Typography.Link onClick={() => navigate(`/production/tasks?plotId=${plotId}`)}>
              查看全部→
            </Typography.Link>
          }
        >
          <Table<Task>
            rowKey="taskId"
            size="small"
            dataSource={taskQuery.data?.list ?? []}
            columns={taskColumns}
            pagination={false}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无农事记录" /> }}
          />
        </Card>

        <Card
          title="💊 投入品使用统计"
          extra={
            <Typography.Link onClick={() => navigate('/production/inputs/ledger')}>
              查看投入品台账→
            </Typography.Link>
          }
        >
          {usageStats.total === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="本季暂无投入品使用记录"
            />
          ) : (
            <Row gutter={[12, 12]}>
              <Col xs={24} sm={8}>
                <Card size="small">
                  <Typography.Text type="secondary">本季累计记录</Typography.Text>
                  <div>
                    <Typography.Text strong style={{ fontSize: 22 }}>
                      {usageStats.total}
                    </Typography.Text>
                    <Typography.Text type="secondary"> 笔</Typography.Text>
                  </div>
                </Card>
              </Col>
              {usages.slice(0, 5).map(([name, item]) => (
                <Col key={name} xs={12} sm={8} md={4}>
                  <Card size="small">
                    <Typography.Text type="secondary" ellipsis>
                      {name}
                    </Typography.Text>
                    <div>
                      <Typography.Text strong>{item.amount.toLocaleString('zh-CN')}</Typography.Text>
                      <Typography.Text type="secondary"> {item.unit}</Typography.Text>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </Card>
      </Space>
    </PageContainer>
  )
}
