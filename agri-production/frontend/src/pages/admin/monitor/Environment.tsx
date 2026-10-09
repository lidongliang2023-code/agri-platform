/**
 * 页面名称：环境数据监控
 * 路由路径：/admin/production/monitor/environment
 * 所属模块：生产监控
 * 原型来源：P10 environment — 环境数据监控
 */
import { useMemo, useState } from 'react'
import {
  Alert as AntAlert,
  Breadcrumb,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Segmented,
  Select,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { HomeOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { listReadingSeries } from '@/api/iot'

const { Text, Title } = Typography

/** 时间范围选项 */
const RANGE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'today', label: '今日' },
  { value: '7d', label: '近7天' },
  { value: '30d', label: '近30天' },
]

/**
 * 监测站点选项。
 *
 * 取值必须是库里真实存在的 deviceId（/iot/readings/series 需要 deviceId），
 * 名称取自真实设备台账，不再使用编造的 D10001 之类设备编码。
 */
const STATION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'DEMO-DEV-002', label: 'A区环境监测站' },
  { value: 'DEMO-DEV-003', label: 'B区虫情测报灯' },
  { value: 'DEMO-DEV-005', label: '1号温室环境监控' },
]

/** 站点 → 设备编码（真实取数用，/iot/readings/series 需 deviceId） */
const STATION_DEVICE_MAP: Array<{ station: string; deviceId: string }> = [
  { station: 'DEMO-DEV-002', deviceId: 'DEMO-DEV-002' },
  { station: 'DEMO-DEV-003', deviceId: 'DEMO-DEV-003' },
  { station: 'DEMO-DEV-005', deviceId: 'DEMO-DEV-005' },
]

/** deviceId → 设备名称（图例展示用） */
const DEVICE_NAME_MAP: Record<string, string> = {
  'DEMO-DEV-002': 'A区环境监测站',
  'DEMO-DEV-003': 'B区虫情测报灯',
  'DEMO-DEV-005': '1号温室环境监控',
}

/** 气温阈值（℃），对应原型 P10 阈值35° */
const TEMP_THRESHOLD = 35

/** 环境异常预警行（原型 P10：时间 | 站点 | 异常类型 | 当前值 | 阈值 | 级别 | 操作） */
interface EnvAlertRow {
  /** 预警 ID */
  id: string
  /** 时间 HH:mm */
  time: string
  /** 站点 */
  station: string
  /** 异常类型 */
  type: string
  /** 当前值 */
  value: string
  /** 阈值 */
  threshold: string
  /** 级别 */
  level: string
  /** 处理状态 */
  status: string
}

/** 预警级别 → Tag 颜色 */
const LEVEL_COLOR_MAP: Record<string, string> = {
  紧急: 'red',
  重要: 'orange',
  一般: 'blue',
}

/**
 * 生成时间轴标签（按时间范围）。
 *
 * @param range 时间范围：today / 7d / 30d
 * @returns X 轴标签数组
 */
function buildAxisLabels(range: string): string[] {
  if (range === 'today') {
    return ['06:00', '09:00', '12:00', '15:00']
  }
  if (range === '7d') {
    return ['7/8', '7/9', '7/10', '7/11', '7/12', '7/13', '7/14']
  }
  return ['6/15', '6/20', '6/25', '6/30', '7/5', '7/10', '7/14']
}

/**
 * 环境数据监控
 *
 * 业务职责：全平台气象 / 土壤环境数据监控，支持时间范围回溯与站点筛选，
 * 输出多站点气温对比与环境异常预警处理。数据只取 /iot/readings/series；
 * 后端无数据时各区块展示空态 / 「—」，不用示例数字顶替。
 *
 * @returns 页面内容
 */
export default function Environment(): JSX.Element {
  const queryClient = useQueryClient()

  /** 时间范围 */
  const [range, setRange] = useState<string>('today')
  /** 站点 */
  const [station, setStation] = useState<string>('all')

  /** 多站点气温时序（/iot/readings/series） */
  const seriesQuery = useQuery({
    queryKey: ['admin', 'monitor', 'environment', 'series'],
    queryFn: async () => {
      const results = await Promise.all(
        STATION_DEVICE_MAP.map(async (item) => ({
          station: item.station,
          readings: await listReadingSeries(item.deviceId, 'airTemperature'),
        })),
      )
      return results
    },
    retry: false,
  })

  /** 是否取到真实时序数据 */
  const hasRealSeries = useMemo(
    () => (seriesQuery.data ?? []).some((item) => (item.readings?.length ?? 0) > 0),
    [seriesQuery.data],
  )

  /**
   * 指标卡数据。
   *
   * 气温取真实时序末点；湿度 / 降水 / 光照 / 风速后端**没有任何数据源**，
   * 一律为 null（展示「—」），不再用示例数字顶替。
   */
  const metrics = useMemo(() => {
    const first = (seriesQuery.data ?? []).find((item) => (item.readings?.length ?? 0) > 0)
    const lastReading = first?.readings?.[first.readings.length - 1]
    return {
      temperature: lastReading ? Number(lastReading.metricValue) : null,
      humidity: null,
      rainfall: null,
      illuminance: null,
      windSpeed: null,
      hasRealData: Boolean(lastReading),
    }
  }, [seriesQuery.data])

  /** 多站点对比 - 气温：只用后端真实读数，无数据则 series 为空（图表区渲染空态） */
  const tempChartOption: EChartsOption = useMemo(() => {
    const labels = buildAxisLabels(range)
    const remote = seriesQuery.data ?? []
    const series = remote
      .filter((item) => (item.readings?.length ?? 0) > 0)
      .filter((item) => station === 'all' || item.station === station)
      .map((item) => ({
        type: 'line' as const,
        name: DEVICE_NAME_MAP[item.station] ?? item.station,
        smooth: true,
        data: (item.readings ?? []).slice(-labels.length).map((reading) => Number(reading.metricValue)),
      }))
    const axisData = hasRealSeries
      ? (remote.find((item) => (item.readings?.length ?? 0) > 0)?.readings ?? [])
          .slice(-labels.length)
          .map((reading) => reading.readTime?.slice(11, 16) || '--:--')
      : labels
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: series.map((item) => item.name), top: 0 },
      grid: { left: 8, right: 24, top: 36, bottom: 8, containLabel: true },
      xAxis: { type: 'category', boundaryGap: false, data: axisData },
      yAxis: { type: 'value', name: '℃', min: 10, max: 40 },
      series: series.map((item, index) =>
        index === 0
          ? {
              ...item,
              markLine: {
                silent: true,
                symbol: 'none',
                lineStyle: { color: '#ff4d4f', type: 'dashed' },
                label: { formatter: `阈值${TEMP_THRESHOLD}°`, position: 'insideEndTop' },
                data: [{ yAxis: TEMP_THRESHOLD }],
              },
            }
          : item,
      ),
    }
  }, [range, station, seriesQuery.data, hasRealSeries])

  /**
   * 环境异常预警列表。
   *
   * 后端暂无「环境异常预警」数据源（/admin/monitor/alerts 当前返回空、
   * 也没有按站点/阈值的环境预警聚合接口），故列表恒为空并展示空态，
   * 不再用编造的 4 行预警（38.2°C / 32.1% / 8.5m/s / 25mm）顶替。
   */
  const alertRows: EnvAlertRow[] = useMemo(() => [], [])

  /** 预警表格列 */
  const alertColumns: ColumnsType<EnvAlertRow> = [
    { title: '时间', dataIndex: 'time', key: 'time', width: 90 },
    { title: '站点', dataIndex: 'station', key: 'station', width: 80 },
    { title: '异常类型', dataIndex: 'type', key: 'type', width: 100 },
    { title: '当前值', dataIndex: 'value', key: 'value', width: 100 },
    { title: '阈值', dataIndex: 'threshold', key: 'threshold', width: 90 },
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 90,
      render: (level: string) => <Tag color={LEVEL_COLOR_MAP[level]}>{level}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => (
        <Tag color={status === '已处理' ? 'green' : 'red'}>{status}</Tag>
      ),
    },
  ]

  /** 重置筛选 */
  const handleReset = (): void => {
    setRange('today')
    setStation('all')
  }

  return (
    <div>
      {/* 面包屑 + 标题（原型 P10 顶部栏） */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
        <Col>
          <Breadcrumb
            style={{ marginBottom: 4 }}
            items={[
              { href: '/admin/production/dashboard', title: <HomeOutlined /> },
              { title: '生产管理' },
              { title: '生产监控' },
              { title: '环境数据监控' },
            ]}
          />
          <Title level={4} style={{ margin: 0 }}>
            环境数据监控
          </Title>
          <Text type="secondary">气象 / 土壤环境数据监控与阈值预警</Text>
        </Col>
        <Col>
          <Button
            icon={<ReloadOutlined />}
            onClick={() =>
              void queryClient.invalidateQueries({ queryKey: ['admin', 'monitor', 'environment'] })
            }
          >
            刷新
          </Button>
        </Col>
      </Row>

      {/* 筛选器：时间范围 / 区域 / 站点 */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap size={12}>
          <Space size={6}>
            <Text>时间范围：</Text>
            <Segmented
              value={range}
              onChange={(value) => setRange(String(value))}
              options={RANGE_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
            />
          </Space>
          <Space size={6}>
            <Text>地块站点：</Text>
            <Select
              style={{ width: 120 }}
              value={station}
              onChange={(value) => setStation(value)}
              options={STATION_OPTIONS}
            />
          </Space>
          <Button onClick={handleReset}>重置</Button>
        </Space>
      </Card>

      {/* 指标卡：气温取真实末点；湿度 / 降水 / 光照 / 风速后端无数据源，统一显示「—」 */}
      <Row gutter={[12, 12]}>
        <Col xs={12} lg={4}>
          <Card size="small" styles={{ body: { padding: 16 } }}>
            {seriesQuery.isLoading ? (
              <Skeleton active title={false} paragraph={{ rows: 2 }} />
            ) : (
              <Statistic title="🌡️ 气温" value={metrics.temperature ?? '—'} precision={1} suffix="°C" />
            )}
            <Text type="secondary" style={{ fontSize: 12 }}>
              {metrics.temperature === null ? '后端暂无读数' : '末次读数'}
            </Text>
          </Card>
        </Col>
        <Col xs={12} lg={4}>
          <Card size="small" styles={{ body: { padding: 16 } }}>
            <Statistic title="💧 湿度" value={metrics.humidity ?? '—'} suffix="%" />
            <Text type="secondary" style={{ fontSize: 12 }}>无数据源</Text>
          </Card>
        </Col>
        <Col xs={12} lg={4}>
          <Card size="small" styles={{ body: { padding: 16 } }}>
            <Statistic title="🌧️ 降水" value={metrics.rainfall ?? '—'} suffix="mm" />
            <Text type="secondary" style={{ fontSize: 12 }}>无数据源</Text>
          </Card>
        </Col>
        <Col xs={12} lg={4}>
          <Card size="small" styles={{ body: { padding: 16 } }}>
            <Statistic title="☀️ 光照" value={metrics.illuminance ?? '—'} suffix="klx" />
            <Text type="secondary" style={{ fontSize: 12 }}>无数据源</Text>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card size="small" styles={{ body: { padding: 16 } }}>
            <Statistic title="💨 风速" value={metrics.windSpeed ?? '—'} suffix="m/s" />
            <Text type="secondary" style={{ fontSize: 12 }}>无数据源</Text>
          </Card>
        </Col>
      </Row>

      {/* 多站点对比 - 气温 + 土壤数据热力图 */}
      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col xs={24} lg={14}>
          <Card
            size="small"
            title="多站点对比 - 气温"
            extra={<Tag color="red">阈值{TEMP_THRESHOLD}°</Tag>}
          >
            {seriesQuery.isLoading ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : hasRealSeries ? (
              <ReactECharts option={tempChartOption} style={{ height: 320 }} notMerge />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  seriesQuery.isError
                    ? `气温时序加载失败：${(seriesQuery.error as Error | null)?.message ?? '未知错误'}`
                    : '后端暂无气温时序数据（/iot/readings/series 未返回读数）'
                }
              />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card size="small" title="土壤数据热力图">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="后端暂无土壤温度数据源，无法绘制热力图"
            />
          </Card>
        </Col>
      </Row>

      {/* 环境异常预警列表 */}
      <Card size="small" title="⚠️ 环境异常预警列表" style={{ marginTop: 12 }}>
        <Table<EnvAlertRow>
          rowKey="id"
          size="small"
          columns={alertColumns}
          dataSource={alertRows}
          pagination={false}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="后端暂无环境异常预警数据源（无按站点 / 阈值的环境预警聚合接口）"
              />
            ),
          }}
        />
      </Card>

      {/* 数据口径提示：只说明真实口径，不再出现「示例口径」话术 */}
      <AntAlert
        style={{ marginTop: 12 }}
        type={seriesQuery.isError ? 'error' : metrics.hasRealData ? 'success' : 'info'}
        showIcon
        message={
          seriesQuery.isError
            ? `环境时序接口加载失败：${(seriesQuery.error as Error | null)?.message ?? '未知错误'}（页面不使用示例数据兜底）`
            : metrics.hasRealData
              ? '已加载真实环境时序数据（/iot/readings/series）'
              : '后端未返回环境时序数据，气温区块显示空态。湿度 / 降水 / 光照 / 风速、土壤热力图与环境异常预警暂无数据源，统一显示「—」或空态。'
        }
      />
    </div>
  )
}
