/**
 * 页面名称：生产驾驶舱
 * 路由路径：/production/dashboard/production
 * 所属模块：首页看板
 * PRD 序号：PRD 6.1 #2
 *
 * 页面用途（PRD）：多维度数据展示、图表分析、GIS 地图。
 * 说明：原型 P19 中的地图区块为色块占位，本页沿用同一思路——
 * 「GIS 区域分布」使用区域卡片网格 + 利用率色条等效呈现，不引入额外地图依赖。
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Alert as AntAlert,
  App as AntdApp,
  Button,
  Card,
  Col,
  Empty,
  Progress,
  Row,
  Segmented,
  Skeleton,
  Space,
  Statistic,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import {
  DashboardOutlined,
  EnvironmentOutlined,
  GlobalOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import useFarmStore from '@/store/farm'
import {
  fetchAllPlots,
  fetchDashboardOverview,
  fetchFarms,
  fetchPlotStats,
} from '@/api/production-view'
import {
  buildCropDistributionFallback,
  buildInputRankingFallback,
  buildMonthTrendFallback,
  plotStatusMeta,
} from '@/utils/production-adapter'

/** 趋势图周期 */
type TrendPeriod = 'week' | 'month' | 'quarter'

/** 区域卡片视图模型 */
interface RegionCard {
  /** 农场 ID */
  farmId: string
  /** 农场名称 */
  farmName: string
  /** 行政区划 */
  region: string
  /** 总面积 */
  areaTotal: number
  /** 地块数 */
  plotCount: number
  /** 在种面积 */
  plantingArea: number
  /** 利用率（%） */
  usageRate: number
  /** 状态 */
  status: number
}

/**
 * 生产驾驶舱
 * @returns 页面内容
 */
export default function ProductionCockpit(): JSX.Element {
  const navigate = useNavigate()
  const { message } = AntdApp.useApp()
  const currentFarm = useFarmStore((state) => state.currentFarm)
  const farmId = currentFarm?.farmId
  const [period, setPeriod] = useState<TrendPeriod>('month')
  const [regionFilter, setRegionFilter] = useState<'all' | 'planting'>('all')

  const overviewQuery = useQuery({
    queryKey: ['cockpit-overview', farmId],
    queryFn: () => fetchDashboardOverview(farmId),
  })

  const plotsQuery = useQuery({
    queryKey: ['cockpit-plots', farmId],
    queryFn: () => fetchAllPlots(farmId),
  })

  const statsQuery = useQuery({
    queryKey: ['cockpit-plot-stats', farmId],
    queryFn: () => fetchPlotStats(farmId),
  })

  const farmsQuery = useQuery({
    queryKey: ['cockpit-farms'],
    queryFn: () => fetchFarms({ pageNum: 1, pageSize: 20 }),
  })

  const overview = overviewQuery.data
  const plots = plotsQuery.data ?? []
  const plotStats = statsQuery.data ?? {}
  const farms = farmsQuery.data?.list ?? []

  /**
   * 刷新全部区块
   * @returns void
   */
  async function refreshAll(): Promise<void> {
    await Promise.all([
      overviewQuery.refetch(),
      plotsQuery.refetch(),
      statsQuery.refetch(),
      farmsQuery.refetch(),
    ])
    message.success('驾驶舱数据已刷新')
  }

  /** 地块状态分布 */
  const plotStatusData = useMemo(() => {
    if (plots.length > 0) {
      const buckets = new Map<string, number>()
      for (const plot of plots) {
        const meta = plotStatusMeta(plot.status)
        buckets.set(meta.label, (buckets.get(meta.label) ?? 0) + 1)
      }
      return Array.from(buckets.entries()).map(([name, value]) => ({ name, value }))
    }
    return Object.keys(plotStats)
      .filter((key) => /^\d+$/.test(key))
      .map((key) => ({ name: plotStatusMeta(Number(key)).label, value: plotStats[key] }))
  }, [plots, plotStats])

  /** 作物分布（按面积聚合，无数据回落原型口径） */
  const cropDistribution = useMemo(() => {
    const buckets = new Map<string, number>()
    for (const plot of plots) {
      const name = plot.cropVariety || plot.cropId || '未种植'
      buckets.set(name, (buckets.get(name) ?? 0) + plot.area)
    }
    if (buckets.size > 0) {
      return Array.from(buckets.entries()).map(([name, value]) => ({ name, value }))
    }
    return buildCropDistributionFallback()
  }, [plots])

  /** 趋势数据切片 */
  const trendRows = useMemo(() => buildMonthTrendFallback(), [])
  const trendSlice = useMemo(() => {
    if (period === 'week') return trendRows.slice(0, 7)
    if (period === 'quarter') return trendRows.concat(trendRows.slice(0, 30))
    return trendRows
  }, [period, trendRows])

  /** 投入品消耗排行 */
  const inputRanking = useMemo(() => buildInputRankingFallback(), [])

  /** 区域卡片（GIS 区块） */
  const regionCards = useMemo<RegionCard[]>(() => {
    const mapped = farms.map((farm) => {
      const farmPlots = plots.filter((plot) => !plot.farmId || plot.farmId === farm.farmId)
      const areaTotal =
        farm.areaTotal > 0 ? farm.areaTotal : farmPlots.reduce((sum, plot) => sum + plot.area, 0)
      const plantingArea = farmPlots
        .filter((plot) => plot.status === 2 || plot.status === 3)
        .reduce((sum, plot) => sum + plot.area, 0)
      return {
        farmId: farm.farmId,
        farmName: farm.farmName,
        region: [farm.province, farm.city, farm.district].filter(Boolean).join(' · ') || '未填写',
        areaTotal,
        plotCount: farmPlots.length,
        plantingArea,
        usageRate: areaTotal > 0 ? Math.round((plantingArea / areaTotal) * 100) : 0,
        status: farm.status,
      }
    })
    return regionFilter === 'planting'
      ? mapped.filter((item) => item.plantingArea > 0)
      : mapped
  }, [farms, plots, regionFilter])

  /**
   * 构造环形饼图配置
   * @param title 标题
   * @param data 数据
   * @param colors 配色
   * @returns ECharts 配置
   */
  function buildPieOption(
    title: string,
    data: { name: string; value: number }[],
    colors: string[],
  ): Record<string, unknown> {
    return {
      color: colors,
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { bottom: 0, type: 'scroll' },
      title: {
        text: title,
        left: 'center',
        top: 4,
        textStyle: { fontSize: 13, color: 'rgba(0,0,0,0.65)', fontWeight: 500 },
      },
      series: [
        {
          type: 'pie',
          radius: ['38%', '62%'],
          center: ['50%', '54%'],
          avoidLabelOverlap: true,
          label: { formatter: '{b}\n{d}%', fontSize: 11 },
          data,
        },
      ],
      graphic: data.length
        ? []
        : [
            {
              type: 'text',
              left: 'center',
              top: 'middle',
              style: { text: '暂无数据', fill: '#999', fontSize: 13 },
            },
          ],
    }
  }

  /**
   * 构造横向条形图配置
   * @param data 排行数据
   * @param unit 单位
   * @returns ECharts 配置
   */
  function buildRankOption(
    data: { name: string; value: number }[],
    unit: string,
  ): Record<string, unknown> {
    return {
      color: ['#13a05a'],
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        valueFormatter: (value: number) => `${value} ${unit}`,
      },
      grid: { left: 70, right: 40, top: 10, bottom: 20 },
      xAxis: { type: 'value', splitLine: { lineStyle: { color: '#f0f0f0' } } },
      yAxis: {
        type: 'category',
        data: data.map((item) => item.name).reverse(),
        axisLine: { lineStyle: { color: '#d9d9d9' } },
      },
      series: [
        {
          type: 'bar',
          barWidth: '55%',
          data: data.map((item) => item.value).reverse(),
          itemStyle: { borderRadius: [0, 4, 4, 0] },
        },
      ],
    }
  }

  /**
   * 构造趋势图配置
   * @returns ECharts 配置
   */
  function buildTrendOption(): Record<string, unknown> {
    return {
      color: ['#13a05a', '#fa8c16'],
      tooltip: { trigger: 'axis' },
      legend: { data: ['采收/产出', '农事强度'], bottom: 0 },
      grid: { left: 55, right: 20, top: 30, bottom: 40 },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: trendSlice.map((row) => row.date.slice(5)),
        axisLine: { lineStyle: { color: '#d9d9d9' } },
      },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: '#f0f0f0' } } },
      series: [
        {
          name: '采收/产出',
          type: 'line',
          smooth: true,
          areaStyle: { opacity: 0.15 },
          data: trendSlice.map((row) => row.done * 120),
        },
        {
          name: '农事强度',
          type: 'line',
          smooth: true,
          data: trendSlice.map((row) => row.planned),
        },
      ],
      animationDuration: 400,
    }
  }

  const loading = overviewQuery.isLoading || plotsQuery.isLoading

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card
        title={
          <Space>
            <DashboardOutlined style={{ color: '#13a05a' }} />
            <span>生产驾驶舱</span>
            {currentFarm ? <Tag color="green">{currentFarm.farmName}</Tag> : null}
          </Space>
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => void refreshAll()}>
              刷新
            </Button>
            <Button onClick={() => navigate('/production/dashboard')}>返回数据看板</Button>
          </Space>
        }
      >
        {overviewQuery.isError && !overview ? (
          <AntAlert
            type="warning"
            showIcon
            message="统计接口暂不可用，当前图表使用原型示例口径数据"
          />
        ) : null}
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <Card>
            {loading ? (
              <Skeleton active paragraph={{ rows: 1 }} />
            ) : (
              <Statistic
                title="在田地块"
                value={overview?.plotCount ?? 0}
                suffix="个"
                prefix={<EnvironmentOutlined style={{ color: '#13a05a' }} />}
              />
            )}
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            {loading ? (
              <Skeleton active paragraph={{ rows: 1 }} />
            ) : (
              <Statistic
                title="在线设备"
                value={overview?.activeDeviceCount ?? 0}
                suffix="台"
                valueStyle={{ color: '#1677ff' }}
              />
            )}
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            {loading ? (
              <Skeleton active paragraph={{ rows: 1 }} />
            ) : (
              <Statistic
                title="本月任务完成率"
                value={overview?.taskCompletionRate ?? 0}
                precision={1}
                suffix="%"
                valueStyle={{ color: '#52c41a' }}
              />
            )}
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            {loading ? (
              <Skeleton active paragraph={{ rows: 1 }} />
            ) : (
              <Statistic
                title="活跃告警"
                value={overview?.alertCount ?? 0}
                suffix="条"
                valueStyle={{ color: '#ff4d4f' }}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="作物分布">
            <ReactECharts
              option={buildPieOption('作物分布（按面积 / 亩）', cropDistribution, [
                '#13a05a',
                '#36cfc9',
                '#1677ff',
                '#722ed1',
                '#fa8c16',
                '#f5576c',
              ])}
              style={{ height: 300 }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="地块状态分布">
            <ReactECharts
              option={buildPieOption('地块状态分布（个）', plotStatusData, [
                '#52c41a',
                '#1677ff',
                '#faad14',
                '#bfbfbf',
                '#ff4d4f',
              ])}
              style={{ height: 300 }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card
            title="产量与农事趋势"
            extra={
              <Segmented<TrendPeriod>
                value={period}
                onChange={setPeriod}
                options={[
                  { label: '近 7 天', value: 'week' },
                  { label: '本月', value: 'month' },
                  { label: '本季度', value: 'quarter' },
                ]}
              />
            }
          >
            <ReactECharts option={buildTrendOption()} style={{ height: 320 }} />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card
            title="投入品消耗排行 TOP5"
            extra={<Typography.Text type="secondary">单位：kg</Typography.Text>}
          >
            <ReactECharts option={buildRankOption(inputRanking, 'kg')} style={{ height: 320 }} />
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <Space wrap>
            <GlobalOutlined style={{ color: '#1677ff' }} />
            <span>GIS 区域分布</span>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              原型中地图为色块占位，此处以区域卡片网格 + 利用率色条等效呈现
            </Typography.Text>
          </Space>
        }
        extra={
          <Segmented<'all' | 'planting'>
            value={regionFilter}
            onChange={setRegionFilter}
            options={[
              { label: '全部区域', value: 'all' },
              { label: '仅看在种', value: 'planting' },
            ]}
          />
        }
      >
        {farmsQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : regionCards.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无农场区域数据" />
        ) : (
          <Row gutter={[16, 16]}>
            {regionCards.map((region) => (
              <Col key={region.farmId} xs={24} sm={12} xl={8}>
                <Card
                  size="small"
                  hoverable
                  style={{ backgroundColor: '#f6ffed', borderColor: '#b7eb8f' }}
                  onClick={() => navigate(`/production/farms/${region.farmId}`)}
                >
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Typography.Text strong>{region.farmName}</Typography.Text>
                      <Tag color={region.status === 1 ? 'green' : 'default'}>
                        {region.status === 1 ? '运营中' : '已停用'}
                      </Tag>
                    </Space>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {region.region}
                    </Typography.Text>
                    <Row>
                      <Col span={12}>
                        <Statistic
                          title="总面积"
                          value={region.areaTotal}
                          suffix="亩"
                          valueStyle={{ fontSize: 16 }}
                        />
                      </Col>
                      <Col span={12}>
                        <Statistic
                          title="地块数"
                          value={region.plotCount}
                          suffix="个"
                          valueStyle={{ fontSize: 16 }}
                        />
                      </Col>
                    </Row>
                    <Tooltip title={`在种面积 ${region.plantingArea} 亩`}>
                      <Progress
                        percent={region.usageRate}
                        size="small"
                        strokeColor="#13a05a"
                        format={(percent) => `利用率 ${percent ?? 0}%`}
                      />
                    </Tooltip>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Card>
    </Space>
  )
}
