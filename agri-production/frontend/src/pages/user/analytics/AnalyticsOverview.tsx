/**
 * 页面名称：数据分析总览
 * 路由路径：/production/analytics
 * 所属模块：报表与设置
 * PRD 序号：PRD 6.1 #43
 *
 * 还原要点（PRD 6.1 #43「多维度数据分析、可视化图表」）：
 * - 指标卡：农场 / 地块 / 在种面积 / 在种计划 / 待办任务 / 本月采收 / 合格率 / 活跃设备
 * - 维度切换：按作物 / 按地块 / 按时间（月）三组口径对比产量、投入、产值与任务完成情况
 * - 图表组：产量趋势（折线）、任务完成趋势（柱状）、维度对比（柱线组合）、
 *   作物分布（饼图）、投入品消耗排行（条形）
 * - 任务完成率与投入产出比作为关键结论指标单独呈现
 *
 * 数据来源：`/analytics/dashboard`（总览）、`/analytics/dimension`（多维分析）；
 * 后端骨架无数据时按示例口径本地推导，保证维度切换与图表交互完整可用。
 */
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
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
  Typography,
} from 'antd'
import {
  ApartmentOutlined,
  CheckCircleOutlined,
  DashboardOutlined,
  FieldTimeOutlined,
  FundOutlined,
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
import { formatNumber } from '@/utils/production-adapter'
import type { AnalyticsOverview, ProductionOverview } from '@/types'
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

/** 示例作物分布 */
const DEMO_CROP_DISTRIBUTION: { name: string; value: number }[] = [
  { name: '番茄', value: 120 },
  { name: '黄瓜', value: 86 },
  { name: '辣椒', value: 64 },
  { name: '茄子', value: 52 },
  { name: '白菜', value: 40 },
  { name: '苹果', value: 160 },
]

/** 示例投入品消耗排行 */
const DEMO_INPUT_RANKING: { name: string; value: number }[] = [
  { name: '复合肥', value: 12800 },
  { name: '尿素', value: 8600 },
  { name: '代森锰锌', value: 1240 },
  { name: '烯酰吗啉', value: 680 },
  { name: '滴灌带', value: 4200 },
  { name: '生物菌肥', value: 3200 },
]

/**
 * 生成示例趋势序列
 *
 * @param days 天数
 * @param base 基线值
 * @param wave 波动幅度
 * @returns 趋势点
 */
function buildTrend(
  days: number,
  base: number,
  wave: number,
): { date: string; value: number }[] {
  return Array.from({ length: days }, (_unused, index) => {
    const day = dayjs('2026-06-03').subtract(days - 1 - index, 'day')
    const delta = Math.sin(index / 3) * wave + ((index * 7) % 5) * (wave / 6)
    return {
      date: day.format('YYYY-MM-DD'),
      value: Math.max(0, Number((base + delta).toFixed(1))),
    }
  })
}

/** 示例总览指标 */
const DEMO_PRODUCTION_OVERVIEW: ProductionOverview = {
  farmCount: 3,
  plotCount: 12,
  plantingArea: 2500,
  runningPlanCount: 8,
  pendingTaskCount: 58,
  monthHarvestQty: 12850,
  passRate: 98.6,
  activeDeviceCount: 18,
}

/** 示例分析总览 */
const DEMO_ANALYTICS: AnalyticsOverview = {
  overview: DEMO_PRODUCTION_OVERVIEW,
  yieldTrend: buildTrend(30, 420, 90),
  taskTrend: buildTrend(30, 12, 4),
  inputRanking: DEMO_INPUT_RANKING,
  cropDistribution: DEMO_CROP_DISTRIBUTION,
}

/** 示例维度数据（按作物） */
const DEMO_DIMENSION_CROP: DimensionPoint[] = [
  { name: '番茄', yieldQty: 62400, areaMu: 120, inputCost: 186000, outputValue: 349440, taskCount: 168, doneCount: 156 },
  { name: '黄瓜', yieldQty: 39560, areaMu: 86, inputCost: 124000, outputValue: 166152, taskCount: 132, doneCount: 121 },
  { name: '辣椒', yieldQty: 20480, areaMu: 64, inputCost: 96000, outputValue: 139264, taskCount: 96, doneCount: 88 },
  { name: '茄子', yieldQty: 21320, areaMu: 52, inputCost: 78000, outputValue: 98072, taskCount: 78, doneCount: 74 },
  { name: '白菜', yieldQty: 15200, areaMu: 40, inputCost: 42000, outputValue: 31920, taskCount: 54, doneCount: 51 },
  { name: '苹果', yieldQty: 448000, areaMu: 160, inputCost: 320000, outputValue: 3360000, taskCount: 210, doneCount: 198 },
]

/** 示例维度数据（按地块） */
const DEMO_DIMENSION_PLOT: DimensionPoint[] = [
  { name: '1号田', yieldQty: 23400, areaMu: 45, inputCost: 72000, outputValue: 131040, taskCount: 62, doneCount: 58 },
  { name: '2号田', yieldQty: 19760, areaMu: 38, inputCost: 61000, outputValue: 110656, taskCount: 55, doneCount: 50 },
  { name: '3号棚', yieldQty: 6240, areaMu: 12, inputCost: 28000, outputValue: 34944, taskCount: 40, doneCount: 38 },
  { name: '4号棚', yieldQty: 5200, areaMu: 10, inputCost: 24000, outputValue: 29120, taskCount: 36, doneCount: 34 },
  { name: '水稻A区', yieldQty: 198400, areaMu: 320, inputCost: 156000, outputValue: 595200, taskCount: 88, doneCount: 82 },
  { name: '果园北区', yieldQty: 448000, areaMu: 160, inputCost: 320000, outputValue: 3360000, taskCount: 120, doneCount: 113 },
]

/** 示例维度数据（按时间） */
const DEMO_DIMENSION_MONTH: DimensionPoint[] = [
  { name: '2026-01', yieldQty: 186000, areaMu: 520, inputCost: 210000, outputValue: 620000, taskCount: 320, doneCount: 298 },
  { name: '2026-02', yieldQty: 142000, areaMu: 520, inputCost: 186000, outputValue: 486000, taskCount: 286, doneCount: 268 },
  { name: '2026-03', yieldQty: 214000, areaMu: 620, inputCost: 248000, outputValue: 742000, taskCount: 356, doneCount: 336 },
  { name: '2026-04', yieldQty: 268000, areaMu: 680, inputCost: 296000, outputValue: 918000, taskCount: 402, doneCount: 386 },
  { name: '2026-05', yieldQty: 296000, areaMu: 680, inputCost: 312000, outputValue: 1024000, taskCount: 428, doneCount: 410 },
  { name: '2026-06', yieldQty: 162000, areaMu: 660, inputCost: 178000, outputValue: 568000, taskCount: 246, doneCount: 214 },
]

/** 维度 → 示例数据 */
const DEMO_DIMENSION_MAP: Record<AnalyticsDimension, DimensionPoint[]> = {
  crop: DEMO_DIMENSION_CROP,
  plot: DEMO_DIMENSION_PLOT,
  month: DEMO_DIMENSION_MONTH,
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
    dayjs('2026-06-03').subtract(29, 'day'),
    dayjs('2026-06-03'),
  ])

  const startDate: string = range[0].format('YYYY-MM-DD')
  const endDate: string = range[1].format('YYYY-MM-DD')

  /** 总览数据 */
  const overviewQuery = useQuery({
    queryKey: ['analytics-overview', farmId, startDate, endDate],
    queryFn: () => getAnalyticsOverview({ farmId, startDate, endDate }),
  })

  /** 生产总览指标（补充总览接口无数据时的口径） */
  const productionQuery = useQuery({
    queryKey: ['analytics-production-overview', farmId],
    queryFn: () => getProductionOverview(farmId),
  })

  /** 维度数据 */
  const dimensionQuery = useQuery({
    queryKey: ['analytics-dimension', farmId, dimension, startDate, endDate],
    queryFn: () => getAnalyticsDimension({ dimension, farmId, startDate, endDate }),
  })

  /** 最终总览（接口优先，回落示例） */
  const overviewData: AnalyticsOverview = useMemo(() => {
    const remote = overviewQuery.data
    if (remote && remote.overview) return remote
    const production = productionQuery.data
    return {
      ...DEMO_ANALYTICS,
      overview: production ?? DEMO_ANALYTICS.overview,
    }
  }, [overviewQuery.data, productionQuery.data])

  /** 最终维度数据 */
  const dimensionData: DimensionPoint[] = useMemo(() => {
    const remote = dimensionQuery.data
    if (Array.isArray(remote) && remote.length > 0) return remote
    return DEMO_DIMENSION_MAP[dimension]
  }, [dimensionQuery.data, dimension])

  /** 指标卡 */
  const metricCards: { title: string; value: number; suffix: string; precision: number }[] =
    useMemo(() => {
      const overview = overviewData.overview
      return [
        { title: '农场数量', value: overview.farmCount, suffix: '个', precision: 0 },
        { title: '地块数量', value: overview.plotCount, suffix: '块', precision: 0 },
        { title: '在种面积', value: overview.plantingArea, suffix: '亩', precision: 0 },
        { title: '进行中计划', value: overview.runningPlanCount, suffix: '个', precision: 0 },
        { title: '待办任务', value: overview.pendingTaskCount, suffix: '条', precision: 0 },
        { title: '本月采收量', value: overview.monthHarvestQty, suffix: 'kg', precision: 0 },
        { title: '质量合格率', value: overview.passRate, suffix: '%', precision: 1 },
        { title: '活跃设备', value: overview.activeDeviceCount, suffix: '台', precision: 0 },
      ]
    }, [overviewData])

  /** 产量趋势图 */
  const yieldOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis' },
      grid: { left: 60, right: 24, top: 30, bottom: 40 },
      xAxis: {
        type: 'category',
        data: overviewData.yieldTrend.map((item) => item.date),
        axisLabel: { rotate: 30 },
      },
      yAxis: { type: 'value', name: '产量(kg)' },
      series: [
        {
          name: '日产量',
          type: 'line',
          smooth: true,
          areaStyle: { opacity: 0.15 },
          data: overviewData.yieldTrend.map((item) => item.value),
          itemStyle: { color: '#1677ff' },
        },
      ],
    }),
    [overviewData.yieldTrend],
  )

  /** 任务完成趋势图 */
  const taskOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis' },
      grid: { left: 60, right: 24, top: 30, bottom: 40 },
      xAxis: {
        type: 'category',
        data: overviewData.taskTrend.map((item) => item.date),
        axisLabel: { rotate: 30 },
      },
      yAxis: { type: 'value', name: '任务数' },
      series: [
        {
          name: '任务完成数',
          type: 'bar',
          data: overviewData.taskTrend.map((item) => item.value),
          itemStyle: { color: '#52c41a' },
        },
      ],
    }),
    [overviewData.taskTrend],
  )

  /** 维度对比图（产量柱 + 投入产出比折线） */
  const dimensionOption = useMemo(
    () => ({
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
    }),
    [dimensionData],
  )

  /** 作物分布饼图 */
  const cropOption = useMemo(
    () => ({
      tooltip: { trigger: 'item' },
      legend: { bottom: 0 },
      series: [
        {
          name: '作物分布',
          type: 'pie',
          radius: ['40%', '70%'],
          data: overviewData.cropDistribution,
        },
      ],
    }),
    [overviewData.cropDistribution],
  )

  /** 投入品消耗排行 */
  const inputOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis' },
      grid: { left: 90, right: 40, top: 20, bottom: 30 },
      xAxis: { type: 'value', name: '用量' },
      yAxis: {
        type: 'category',
        data: overviewData.inputRanking.map((item) => item.name).reverse(),
      },
      series: [
        {
          name: '消耗量',
          type: 'bar',
          data: overviewData.inputRanking.map((item) => item.value).reverse(),
          itemStyle: { color: '#722ed1' },
        },
      ],
    }),
    [overviewData.inputRanking],
  )

  /** 任务完成率 */
  const taskSummary = useMemo(() => {
    const total = dimensionData.reduce((sum, item) => sum + item.taskCount, 0)
    const done = dimensionData.reduce((sum, item) => sum + item.doneCount, 0)
    return { total, done, rate: total === 0 ? 0 : Number(((done / total) * 100).toFixed(1)) }
  }, [dimensionData])

  /** 投入产出合计 */
  const ioSummary = useMemo(() => {
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

        <Spin spinning={overviewQuery.isLoading}>
          <Row gutter={[16, 16]}>
            {metricCards.map((card, index) => (
              <Col span={6} key={card.title}>
                <Card>
                  <Statistic
                    title={card.title}
                    value={card.value}
                    precision={card.precision}
                    suffix={card.suffix}
                    valueStyle={{ color: METRIC_COLORS[index % METRIC_COLORS.length] }}
                  />
                </Card>
              </Col>
            ))}
          </Row>
        </Spin>

        <Row gutter={16}>
          <Col span={12}>
            <Card title="产量趋势">
              <ReactECharts option={yieldOption} style={{ height: 300 }} notMerge />
            </Card>
          </Col>
          <Col span={12}>
            <Card title="任务完成趋势">
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
                  <Progress percent={taskSummary.rate} status="active" />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    已完成 {formatNumber(taskSummary.done)} / 共 {formatNumber(taskSummary.total)} 条
                  </Text>
                </div>
                <div>
                  <Space size={8}>
                    <FundOutlined style={{ color: '#fa8c16' }} />
                    <Text strong>投入产出比</Text>
                  </Space>
                  <Statistic
                    value={ioSummary.ratio}
                    precision={2}
                    valueStyle={{ color: '#fa8c16' }}
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    投入 ¥{formatNumber(ioSummary.cost)} · 产值 ¥{formatNumber(ioSummary.output)}
                  </Text>
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
            <Card title="作物分布">
              <ReactECharts option={cropOption} style={{ height: 300 }} notMerge />
            </Card>
          </Col>
          <Col span={12}>
            <Card title="投入品消耗排行">
              <ReactECharts option={inputOption} style={{ height: 300 }} notMerge />
            </Card>
          </Col>
        </Row>

        {overviewQuery.isError && dimensionQuery.isError && (
          <Card>
            <Empty description="分析接口暂未返回数据，当前按示例口径展示（维度切换与图表交互可用）" />
          </Card>
        )}
      </Space>
    </div>
  )
}
