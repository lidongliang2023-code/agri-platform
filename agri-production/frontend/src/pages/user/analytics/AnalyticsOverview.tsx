/**
 * 页面名称：数据分析总览
 * 路由路径：/production/analytics
 * 所属模块：报表与设置
 * PRD 序号：PRD 6.1 #43
 *
 * 还原要点（PRD 6.1 #43「多维度数据分析、可视化图表」）：
 * - 指标卡：累计产量 / 检测合格率 / 亩均成本 / 农场 / 地块 / 在种面积 / 进行中计划 / 待办任务
 * - 维度切换：按作物 / 按地块 / 按时间三组口径对比产量、投入、产值与任务完成情况
 * - 图表组：产量趋势（折线）、任务完成趋势（柱状）、维度对比（柱线组合）、
 *   作物分布（饼图）、投入品消耗排行（条形）
 * - 任务完成率与投入产出比作为关键结论指标单独呈现
 *
 * 数据纪律（项目铁规矩：可以降级，不能骗人）：
 * - 后端 `GET /analytics/dashboard|overview` 返回的是 `prod_analytics_snapshot` 的
 *   `metricCode → metricValue` 映射（YIELD / PASS_RATE / COST …），**没有的指标一律显示「—」**，
 *   绝不使用本地示例值回填（此前本页整页都是 DEMO_* 常量在兜底，属于把假数据当真数据展示）；
 * - 作物分布 / 投入品排行由真实接口（地块列表、投入品使用记录）聚合而来；
 *   接口无数据时图表显示「暂无数据」，不生成任何本地序列；
 * - 后端暂无 `/analytics/dimension` 与任务趋势端点，对应图表显示「后端暂无数据源」。
 */
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Alert,
  Card,
  Col,
  DatePicker,
  Empty,
  Progress,
  Row,
  Segmented,
  Space,
  Spin,
  Statistic,
  Tooltip,
  Typography,
} from 'antd'
import {
  ApartmentOutlined,
  CheckCircleOutlined,
  DashboardOutlined,
  FieldTimeOutlined,
  FundOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import useFarmStore from '@/store/farm'
import {
  getAnalyticsDimension,
  getAnalyticsOverview,
  getProductionOverview,
} from '@/api/analytics'
import { fetchMetricTrend } from '@/api/production-view'
import { listInputUsages } from '@/api/inputs'
import { listPlots } from '@/api/plots'
import { aggregateInputRanking, buildOverview, formatNumber } from '@/utils/production-adapter'
import type { DashboardOverview } from '@/utils/production-adapter'
import { MetricStatistic, MetricText } from '@/components'
import type { AnalyticsDimension, DimensionPoint } from '@/api/analytics'

const { RangePicker } = DatePicker
const { Text } = Typography

/** 分析维度选项 */
const DIMENSION_OPTIONS: { value: AnalyticsDimension; label: string }[] = [
  { value: 'crop', label: '按作物' },
  { value: 'plot', label: '按地块' },
  { value: 'month', label: '按时间' },
]

/** 指标卡配色 */
const METRIC_COLORS: string[] = [
  '#1677ff',
  '#52c41a',
  '#fa8c16',
  '#722ed1',
  '#13c2c2',
  '#eb2f96',
  '#2f54eb',
  '#a0d911',
]

/** 图表无数据时的统一占位文案 */
const NO_SOURCE_TEXT = '后端暂无该数据源，暂不展示'

/**
 * 构造「暂无数据源」图表配置。
 *
 * @param text 占位文案
 * @returns ECharts 配置
 */
function emptyChartOption(text: string): Record<string, unknown> {
  return {
    xAxis: { type: 'category', data: [], show: false },
    yAxis: { type: 'value', show: false },
    series: [],
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: 'middle',
        style: { text, fill: '#999', fontSize: 13 },
      },
    ],
  }
}

/**
 * 判断一次总览响应里是否至少命中了一个真实指标（用于决定要不要再试备用接口）。
 *
 * @param overview 映射后的总览
 * @returns 至少有一个非 null 指标时返回 true
 */
function hasAnyMetric(overview: DashboardOverview): boolean {
  return [
    overview.metricCount,
    overview.yieldTotal,
    overview.passRate,
    overview.avgCostPerMu,
    overview.farmCount,
    overview.plotCount,
    overview.plantingArea,
    overview.runningPlanCount,
    overview.pendingTaskCount,
    overview.monthHarvestQty,
    overview.activeDeviceCount,
  ].some((value) => value !== null)
}

/**
 * 数据分析总览
 *
 * 业务职责：按作物 / 地块 / 时间多维度呈现产量、投入产出与任务完成情况。
 *
 * @returns 页面内容
 */
export default function AnalyticsOverview(): JSX.Element {
  const farmId = useFarmStore((state) => state.currentFarm?.farmId)

  /** 分析维度 */
  const [dimension, setDimension] = useState<AnalyticsDimension>('crop')
  /** 统计时间范围 */
  const [range, setRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(29, 'day'),
    dayjs(),
  ])

  const startDate: string = range[0].format('YYYY-MM-DD')
  const endDate: string = range[1].format('YYYY-MM-DD')

  /**
   * 总览数据。
   *
   * 后端返回 Map（metricCode → metricValue），这里用 buildOverview 映射：
   * 命中的指标取真实值，未命中的为 null（页面显示「—」）。
   */
  const overviewQuery = useQuery({
    queryKey: ['analytics-overview', farmId, startDate, endDate],
    queryFn: () => getAnalyticsOverview({ farmId, startDate, endDate }),
    retry: false,
  })

  /** 生产总览指标（/analytics/overview，与 dashboard 同源，作为补充数据源） */
  const productionQuery = useQuery({
    queryKey: ['analytics-production-overview', farmId],
    queryFn: () => getProductionOverview(farmId),
    retry: false,
  })

  /** 产量趋势（后端 GET /analytics/trend?metricCode=YIELD） */
  const yieldTrendQuery = useQuery({
    queryKey: ['analytics-yield-trend', farmId],
    queryFn: () => fetchMetricTrend('YIELD'),
    retry: false,
  })

  /** 维度数据（后端暂无 /analytics/dimension，返回空即空态） */
  const dimensionQuery = useQuery({
    queryKey: ['analytics-dimension', farmId, dimension, startDate, endDate],
    queryFn: () => getAnalyticsDimension({ dimension, farmId, startDate, endDate }),
    retry: false,
  })

  /** 地块列表（作物分布聚合源） */
  const plotsQuery = useQuery({
    queryKey: ['analytics-plots', farmId],
    queryFn: () => listPlots({ pageNum: 1, pageSize: 200, farmId }),
    retry: false,
  })

  /** 投入品使用记录（消耗排行聚合源） */
  const usageQuery = useQuery({
    queryKey: ['analytics-input-usages', farmId],
    queryFn: () => listInputUsages({ pageNum: 1, pageSize: 200 }),
    retry: false,
  })

  /**
   * 最终总览：接口优先取 dashboard，其次 overview，**两者都失败才标记不可用**；
   * 无论走哪条路径，缺失字段都是 null，不做任何示例值回填。
   */
  const overview: DashboardOverview = useMemo(() => {
    const dashboard = overviewQuery.data
    if (hasAnyMetric(buildOverview(dashboard, true))) {
      return buildOverview(dashboard, true)
    }
    const production = productionQuery.data
    if (hasAnyMetric(buildOverview(production, true))) {
      return buildOverview(production, true)
    }
    return buildOverview(null, false)
  }, [overviewQuery.data, productionQuery.data])

  /** 最终维度数据：接口有就用，没有就是空（不回落到示例维度表） */
  const dimensionData: DimensionPoint[] = useMemo(() => {
    const remote = dimensionQuery.data
    return Array.isArray(remote) ? remote : []
  }, [dimensionQuery.data])

  /** 作物分布（真实地块面积聚合） */
  const cropDistribution = useMemo<{ name: string; value: number }[]>(() => {
    const buckets = new Map<string, number>()
    for (const plot of plotsQuery.data?.list ?? []) {
      const name = plot.cropVariety || plot.cropId || '未种植'
      buckets.set(name, (buckets.get(name) ?? 0) + (Number(plot.area) || 0))
    }
    return Array.from(buckets.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [plotsQuery.data])

  /** 投入品消耗排行（真实使用记录聚合；用量字段读后端 dosage，按名称+单位分组） */
  const inputRanking = useMemo<{ name: string; value: number }[]>(
    () => aggregateInputRanking(usageQuery.data?.list ?? [], 6),
    [usageQuery.data],
  )

  /** 指标卡 */
  const metricCards: {
    title: string
    value: number | null
    suffix: string
    precision: number
  }[] = useMemo(
    () => [
      { title: '累计产量', value: overview.yieldTotal, suffix: 'kg', precision: 0 },
      { title: '检测合格率', value: overview.passRate, suffix: '%', precision: 1 },
      { title: '亩均生产成本', value: overview.avgCostPerMu, suffix: '元', precision: 0 },
      { title: '农场数量', value: overview.farmCount, suffix: '个', precision: 0 },
      { title: '地块数量', value: overview.plotCount, suffix: '块', precision: 0 },
      { title: '在种面积', value: overview.plantingArea, suffix: '亩', precision: 0 },
      { title: '进行中计划', value: overview.runningPlanCount, suffix: '个', precision: 0 },
      { title: '待办任务', value: overview.pendingTaskCount, suffix: '条', precision: 0 },
    ],
    [overview],
  )

  /** 产量趋势图（真实指标序列；无数据则占位） */
  const yieldOption = useMemo<Record<string, unknown>>(() => {
    const rows = yieldTrendQuery.data ?? []
    if (rows.length === 0) return emptyChartOption(NO_SOURCE_TEXT)
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 60, right: 24, top: 30, bottom: 40 },
      xAxis: {
        type: 'category',
        data: rows.map((item) => item.date),
        axisLabel: { rotate: 30 },
      },
      yAxis: { type: 'value', name: '产量(kg)' },
      series: [
        {
          name: '产量',
          type: 'line',
          smooth: true,
          areaStyle: { opacity: 0.15 },
          data: rows.map((item) => item.value),
          itemStyle: { color: '#1677ff' },
        },
      ],
    }
  }, [yieldTrendQuery.data])

  /** 任务完成趋势图（后端暂无端点） */
  const taskOption = useMemo<Record<string, unknown>>(
    () => emptyChartOption(NO_SOURCE_TEXT),
    [],
  )

  /** 维度对比图（真实维度数据；空则占位） */
  const dimensionOption = useMemo<Record<string, unknown>>(() => {
    if (dimensionData.length === 0) return emptyChartOption(NO_SOURCE_TEXT)
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['产量(kg)', '投入产出比'], bottom: 0 },
      grid: { left: 70, right: 70, top: 30, bottom: 50 },
      xAxis: { type: 'category', data: dimensionData.map((item) => item.name) },
      yAxis: [
        { type: 'value', name: '产量(kg)' },
        { type: 'value', name: '投入产出比' },
      ],
      series: [
        {
          name: '产量(kg)',
          type: 'bar',
          data: dimensionData.map((item) => item.yieldQty),
          itemStyle: { color: '#1677ff' },
        },
        {
          name: '投入产出比',
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          data: dimensionData.map((item) =>
            Number((item.outputValue / Math.max(1, item.inputCost)).toFixed(2)),
          ),
          itemStyle: { color: '#fa8c16' },
        },
      ],
    }
  }, [dimensionData])

  /** 作物分布饼图 */
  const cropOption = useMemo<Record<string, unknown>>(() => {
    if (cropDistribution.length === 0) return emptyChartOption(NO_SOURCE_TEXT)
    return {
      tooltip: { trigger: 'item' },
      legend: { bottom: 0 },
      series: [
        {
          name: '作物分布',
          type: 'pie',
          radius: ['40%', '70%'],
          data: cropDistribution,
        },
      ],
    }
  }, [cropDistribution])

  /** 投入品消耗排行 */
  const inputOption = useMemo<Record<string, unknown>>(() => {
    if (inputRanking.length === 0) return emptyChartOption(NO_SOURCE_TEXT)
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 140, right: 40, top: 20, bottom: 30 },
      xAxis: { type: 'value', name: '用量（按名称+单位分组，单位见条目名）' },
      yAxis: {
        type: 'category',
        data: inputRanking.map((item) => item.name).reverse(),
      },
      series: [
        {
          name: '消耗量',
          type: 'bar',
          data: inputRanking.map((item) => item.value).reverse(),
          itemStyle: { color: '#722ed1' },
        },
      ],
    }
  }, [inputRanking])

  /** 任务完成率（维度数据为空时整体显示「—」） */
  const taskSummary = useMemo(() => {
    if (dimensionData.length === 0) return null
    const total = dimensionData.reduce((sum, item) => sum + item.taskCount, 0)
    const done = dimensionData.reduce((sum, item) => sum + item.doneCount, 0)
    return { total, done, rate: total === 0 ? 0 : Number(((done / total) * 100).toFixed(1)) }
  }, [dimensionData])

  /** 投入产出合计（维度数据为空时整体显示「—」） */
  const ioSummary = useMemo(() => {
    if (dimensionData.length === 0) return null
    const cost = dimensionData.reduce((sum, item) => sum + item.inputCost, 0)
    const output = dimensionData.reduce((sum, item) => sum + item.outputValue, 0)
    return {
      cost,
      output,
      ratio: cost === 0 ? 0 : Number((output / cost).toFixed(2)),
    }
  }, [dimensionData])

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Card>
          <Space size={8} wrap>
            <DashboardOutlined style={{ fontSize: 20, color: '#1677ff' }} />
            <span style={{ fontSize: 18, fontWeight: 600 }}>数据分析总览</span>
            <Text type="secondary">产量 / 投入产出 / 任务完成多维度分析</Text>
            <RangePicker
              value={range}
              allowClear={false}
              onChange={(value) => {
                if (value?.[0] && value?.[1]) {
                  setRange([value[0], value[1]])
                }
              }}
            />
            <Segmented
              value={dimension}
              onChange={(value) => setDimension(value as AnalyticsDimension)}
              options={DIMENSION_OPTIONS}
            />
          </Space>
        </Card>

        {overview.available === false ? (
          <Alert
            type="warning"
            showIcon
            message="分析接口暂不可用，本页指标显示为「—」"
            description="GET /analytics/dashboard 与 /analytics/overview 均未返回数据。本页不使用本地示例口径，接口恢复后自动填充。"
          />
        ) : overview.missingFields.length > 0 ? (
          <Alert
            type="warning"
            showIcon
            message="本页部分指标后端暂未提供数据源，显示为「—」"
            description={`暂无数据源的指标：${overview.missingFields.join('、')}。带 ⓘ 图标的数值即为后端未接入项，接口补齐后自动填充。`}
          />
        ) : null}

        <Spin spinning={overviewQuery.isLoading}>
          <Row gutter={[16, 16]}>
            {metricCards.map((card, index) => (
              <Col span={6} key={card.title}>
                <Card>
                  <MetricStatistic
                    title={card.title}
                    value={card.value}
                    precision={card.precision}
                    suffix={card.value === null ? undefined : card.suffix}
                    valueStyle={{ color: METRIC_COLORS[index % METRIC_COLORS.length] }}
                  />
                </Card>
              </Col>
            ))}
          </Row>
        </Spin>

        <Row gutter={16}>
          <Col span={12}>
            <Card
              title="产量趋势"
              extra={
                (yieldTrendQuery.data?.length ?? 0) === 0 ? (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    后端暂无趋势数据源
                  </Text>
                ) : undefined
              }
            >
              <ReactECharts option={yieldOption} style={{ height: 300 }} notMerge />
            </Card>
          </Col>
          <Col span={12}>
            <Card
              title="任务完成趋势"
              extra={
                <Text type="secondary" style={{ fontSize: 12 }}>
                  后端暂无趋势数据源
                </Text>
              }
            >
              <ReactECharts option={taskOption} style={{ height: 300 }} notMerge />
            </Card>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={16}>
            <Card
              title={`维度分析（${
                DIMENSION_OPTIONS.find((item) => item.value === dimension)?.label ?? ''
              }）`}
              extra={<ApartmentOutlined />}
            >
              <ReactECharts option={dimensionOption} style={{ height: 320 }} notMerge />
            </Card>
          </Col>
          <Col span={8}>
            <Card title="结论指标">
              <Space direction="vertical" size={20} style={{ width: '100%' }}>
                <div>
                  <Space size={8}>
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    <Text strong>任务完成率</Text>
                  </Space>
                  {taskSummary === null ? (
                    <Tooltip title="后端暂无 /analytics/dimension 数据源，无法计算完成率">
                      <div>
                        <Statistic value="—" valueStyle={{ color: '#bfbfbf' }} />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          未接入
                          <InfoCircleOutlined
                            style={{ fontSize: 11, color: '#faad14', marginLeft: 2 }}
                          />
                        </Text>
                      </div>
                    </Tooltip>
                  ) : (
                    <>
                      <Progress percent={taskSummary.rate} status="active" />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        已完成 {formatNumber(taskSummary.done)} / 共{' '}
                        {formatNumber(taskSummary.total)} 条
                      </Text>
                    </>
                  )}
                </div>
                <div>
                  <Space size={8}>
                    <FundOutlined style={{ color: '#fa8c16' }} />
                    <Text strong>投入产出比</Text>
                  </Space>
                  {ioSummary === null ? (
                    <Tooltip title="后端暂无 /analytics/dimension 数据源，无法计算投入产出比">
                      <div>
                        <Statistic value="—" valueStyle={{ color: '#bfbfbf' }} />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          未接入
                          <InfoCircleOutlined
                            style={{ fontSize: 11, color: '#faad14', marginLeft: 2 }}
                          />
                        </Text>
                      </div>
                    </Tooltip>
                  ) : (
                    <>
                      <Statistic
                        value={ioSummary.ratio}
                        precision={2}
                        valueStyle={{ color: '#fa8c16' }}
                      />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        投入 ¥{formatNumber(ioSummary.cost)} · 产值 ¥
                        {formatNumber(ioSummary.output)}
                      </Text>
                    </>
                  )}
                </div>
                <div>
                  <Space size={8}>
                    <FieldTimeOutlined style={{ color: '#1677ff' }} />
                    <Text strong>统计周期</Text>
                  </Space>
                  <div>
                    <Text>
                      {startDate} ~ {endDate}
                    </Text>
                  </div>
                </div>
              </Space>
            </Card>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Card
              title="作物分布"
              extra={
                cropDistribution.length === 0 ? (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    暂无地块数据
                  </Text>
                ) : undefined
              }
            >
              <ReactECharts option={cropOption} style={{ height: 300 }} notMerge />
            </Card>
          </Col>
          <Col span={12}>
            <Card
              title="投入品消耗排行"
              extra={
                inputRanking.length === 0 ? (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    暂无使用记录
                  </Text>
                ) : undefined
              }
            >
              <ReactECharts option={inputOption} style={{ height: 300 }} notMerge />
            </Card>
          </Col>
        </Row>

        {overview.available === false || overviewQuery.isError ? (
          <Card>
            <Empty
              description={
                <Space direction="vertical">
                  <Text type="secondary">
                    分析接口暂未返回数据，本页按真实接口渲染，缺失项显示「—」
                  </Text>
                  <Text type="secondary">
                    已接入指标 {overview.metricCount === null ? '—' : overview.metricCount} 项 ·
                    累计产量 <MetricText value={overview.yieldTotal} suffix=" kg" />
                  </Text>
                </Space>
              }
            />
          </Card>
        ) : null}
      </Space>
    </div>
  )
}
