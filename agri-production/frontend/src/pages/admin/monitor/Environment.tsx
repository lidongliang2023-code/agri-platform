/**
 * 页面名称：环境数据监控
 * 路由路径：/admin/production/monitor/environment
 * 所属模块：生产监控
 * 原型来源：P10 environment — 环境数据监控
 */
import { useMemo, useState } from 'react'
import {
  Alert as AntAlert,
  App,
  Breadcrumb,
  Button,
  Card,
  Col,
  Empty,
  Modal,
  Radio,
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

/** 区域选项 */
const REGION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'north', label: '华北' },
  { value: 'east', label: '华东' },
  { value: 'central', label: '华中' },
  { value: 'south', label: '华南' },
]

/** 监测站点（地块）选项 */
const STATION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'A', label: 'A区' },
  { value: 'B', label: 'B区' },
  { value: 'C', label: 'C区' },
]

/** 站点 → 设备编码（真实取数用，/iot/readings/series 需 deviceId） */
const STATION_DEVICE_MAP: Array<{ station: string; deviceId: string }> = [
  { station: 'A', deviceId: 'D10001' },
  { station: 'B', deviceId: 'D10006' },
  { station: 'C', deviceId: 'D10003' },
]

/** 气温阈值（℃），对应原型 P10 阈值35° */
const TEMP_THRESHOLD = 35

/** 多站点气温示例数据（原型 P10：X 轴 06:00 / 09:00 / 12:00 / 15:00） */
const FALLBACK_TEMP_SERIES: Array<{ station: string; points: number[] }> = [
  { station: 'A区', points: [18.5, 24.6, 32.4, 29.8] },
  { station: 'B区', points: [17.8, 23.1, 30.2, 28.4] },
  { station: 'C区', points: [19.2, 25.4, 33.8, 31.0] },
]

/** 区域 → 气温修正系数（示例口径下用于体现区域差异） */
const REGION_FACTOR: Record<string, number> = {
  all: 1,
  north: 0.86,
  east: 1,
  central: 1.06,
  south: 1.15,
}

/** 时间范围 → 逐点波动系数，用于生成对应长度的趋势 */
const RANGE_FACTOR: Record<string, number[]> = {
  today: [1, 1, 1, 1],
  '7d': [0.92, 1.04, 0.97, 1.12, 1.02, 0.94, 1.08],
  '30d': [0.88, 0.95, 1.02, 1.1, 1.16, 1.05, 0.98],
}

/**
 * 按时间范围与区域生成示例气温序列。
 *
 * @param range 时间范围：today / 7d / 30d
 * @param regionKey 区域编码
 * @returns 各站点的气温序列
 */
function buildFallbackTempSeries(
  range: string,
  regionKey: string,
): Array<{ station: string; points: number[] }> {
  const factors = RANGE_FACTOR[range] ?? RANGE_FACTOR.today
  const regionValue = REGION_FACTOR[regionKey] ?? 1
  return FALLBACK_TEMP_SERIES.map((item) => ({
    station: item.station,
    points: factors.map((factor, index) =>
      Number((item.points[index % item.points.length] * factor * regionValue).toFixed(1)),
    ),
  }))
}

/** 土壤温度热力图示例数据（原型 P10 16 格） */
const FALLBACK_SOIL_CELLS: number[] = [22, 23, 21, 20, 25, 24, 23, 22, 32, 30, 28, 27, 23, 22, 21, 19]

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

/** 环境异常预警示例数据 */
const FALLBACK_ENV_ALERTS: EnvAlertRow[] = [
  { id: 'EA1', time: '12:35', station: 'A区', type: '高温', value: '38.2°C', threshold: '35°C', level: '紧急', status: '待处理' },
  { id: 'EA2', time: '11:20', station: 'B区', type: '低湿度', value: '32.1%', threshold: '40%', level: '重要', status: '待处理' },
  { id: 'EA3', time: '09:45', station: 'C区', type: '强风', value: '8.5m/s', threshold: '7m/s', level: '重要', status: '待处理' },
  { id: 'EA4', time: '08:10', station: 'A区', type: '暴雨', value: '25mm', threshold: '20mm', level: '一般', status: '已处理' },
]

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
 * 业务职责：全平台气象 / 土壤环境数据监控，支持时间范围回溯、区域与站点筛选，
 * 输出多站点气温对比、土壤热力图与环境异常预警处理。数据优先取
 * /iot/readings/series，接口无数据时降级到原型 P10 示例口径。
 *
 * @returns 页面内容
 */
export default function Environment(): JSX.Element {
  const { message } = App.useApp()
  const queryClient = useQueryClient()

  /** 时间范围 */
  const [range, setRange] = useState<string>('today')
  /** 区域 */
  const [region, setRegion] = useState<string>('all')
  /** 站点 */
  const [station, setStation] = useState<string>('all')
  /** 已处理的预警 ID 列表（本地处置闭环） */
  const [handledIds, setHandledIds] = useState<string[]>([])
  /** 处理弹窗当前预警 */
  const [activeAlert, setActiveAlert] = useState<EnvAlertRow | null>(null)
  /** 处理措施 */
  const [measure, setMeasure] = useState<string>('下发整改通知')
  /** 处理说明 */
  const [remark, setRemark] = useState<string>('')

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

  /** 指标卡数据：气温取真实末点，其余取原型 P10 口径 */
  const metrics = useMemo(() => {
    const first = (seriesQuery.data ?? []).find((item) => (item.readings?.length ?? 0) > 0)
    const lastReading = first?.readings?.[first.readings.length - 1]
    return {
      temperature: lastReading ? Number(lastReading.metricValue) : 23.5,
      humidity: 68.2,
      rainfall: 12.3,
      illuminance: 45.6,
      windSpeed: 3.2,
      hasRealData: Boolean(lastReading),
    }
  }, [seriesQuery.data])

  /** 多站点对比 - 气温（原型 P10） */
  const tempChartOption: EChartsOption = useMemo(() => {
    const labels = buildAxisLabels(range)
    const remote = seriesQuery.data ?? []
    const series = hasRealSeries
      ? remote
          .filter((item) => (item.readings?.length ?? 0) > 0)
          .filter((item) => station === 'all' || item.station === station)
          .map((item) => ({
            type: 'line' as const,
            name: `${item.station}区`,
            smooth: true,
            data: (item.readings ?? []).slice(-labels.length).map((reading) => Number(reading.metricValue)),
          }))
      : buildFallbackTempSeries(range, region).filter(
          (item) => station === 'all' || item.station.startsWith(station),
        ).map((item) => ({
          type: 'line' as const,
          name: item.station,
          smooth: true,
          data: item.points,
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
  }, [range, region, station, seriesQuery.data, hasRealSeries])

  /** 土壤数据热力图（原型 P10：4 × 4 数值格 + 低/中/高 图例） */
  const soilChartOption: EChartsOption = useMemo(() => {
    const cells = FALLBACK_SOIL_CELLS
    const data: Array<[number, number, number]> = cells.map((value, index) => [
      index % 4,
      Math.floor(index / 4),
      value,
    ])
    return {
      tooltip: {
        position: 'top',
        formatter: (raw: unknown) => {
          const item = raw as { value: [number, number, number] }
          return `第${item.value[1] + 1}行 第${item.value[0] + 1}列：${item.value[2]}°C`
        },
      },
      grid: { left: 8, right: 16, top: 8, bottom: 40, containLabel: true },
      xAxis: { type: 'category', data: ['1', '2', '3', '4'], splitArea: { show: true } },
      yAxis: { type: 'category', data: ['1', '2', '3', '4'], splitArea: { show: true } },
      visualMap: {
        min: 18,
        max: 34,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        itemWidth: 12,
        itemHeight: 80,
        pieces: [
          { min: 18, max: 22, label: '低', color: '#52c41a' },
          { min: 22, max: 28, label: '中', color: '#faad14' },
          { min: 28, max: 34, label: '高', color: '#ff4d4f' },
        ],
      },
      series: [
        {
          type: 'heatmap',
          name: '土壤温度',
          data,
          label: { show: true, formatter: '{c}°' },
          emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.3)' } },
        },
      ],
    }
  }, [])

  /** 环境异常预警列表（含本地处置状态） */
  const alertRows: EnvAlertRow[] = useMemo(
    () =>
      FALLBACK_ENV_ALERTS.filter((item) => station === 'all' || item.station.startsWith(station)).map(
        (item) =>
          handledIds.includes(item.id) ? { ...item, status: '已处理' } : item,
      ),
    [station, handledIds],
  )

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
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_value: unknown, row: EnvAlertRow) => (
        <Button
          type="link"
          size="small"
          disabled={row.status === '已处理'}
          onClick={() => {
            setActiveAlert(row)
            setMeasure('下发整改通知')
            setRemark('')
          }}
        >
          处理
        </Button>
      ),
    },
  ]

  /** 重置筛选 */
  const handleReset = (): void => {
    setRange('today')
    setRegion('all')
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
            <Text>区域：</Text>
            <Select
              style={{ width: 120 }}
              value={region}
              onChange={(value) => setRegion(value)}
              options={REGION_OPTIONS}
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

      {/* 指标卡（原型 P10：气温 / 湿度 / 降水 / 光照 / 风速） */}
      <Row gutter={[12, 12]}>
        <Col xs={12} lg={4}>
          <Card size="small" styles={{ body: { padding: 16 } }}>
            {seriesQuery.isLoading ? (
              <Skeleton active title={false} paragraph={{ rows: 2 }} />
            ) : (
              <Statistic title="🌡️ 气温" value={metrics.temperature} precision={1} suffix="°C" />
            )}
            <Text style={{ color: '#ff4d4f', fontSize: 12 }}>↑ 1.2°C</Text>
          </Card>
        </Col>
        <Col xs={12} lg={4}>
          <Card size="small" styles={{ body: { padding: 16 } }}>
            <Statistic title="💧 湿度" value={metrics.humidity} precision={1} suffix="%" />
            <Text style={{ color: '#52c41a', fontSize: 12 }}>↓ 2.1%</Text>
          </Card>
        </Col>
        <Col xs={12} lg={4}>
          <Card size="small" styles={{ body: { padding: 16 } }}>
            <Statistic title="🌧️ 降水" value={metrics.rainfall} precision={1} suffix="mm" />
            <Text style={{ color: '#ff4d4f', fontSize: 12 }}>↑ 5.8mm</Text>
          </Card>
        </Col>
        <Col xs={12} lg={4}>
          <Card size="small" styles={{ body: { padding: 16 } }}>
            <Statistic title="☀️ 光照" value={metrics.illuminance} precision={1} suffix="klx" />
            <Text style={{ color: '#52c41a', fontSize: 12 }}>↓ 3.2klx</Text>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card size="small" styles={{ body: { padding: 16 } }}>
            <Statistic title="💨 风速" value={metrics.windSpeed} precision={1} suffix="m/s" />
            <Text style={{ color: '#ff4d4f', fontSize: 12 }}>↑ 0.5m/s</Text>
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
            ) : (
              <ReactECharts option={tempChartOption} style={{ height: 320 }} notMerge />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card
            size="small"
            title="土壤数据热力图"
            extra={
              <Space size={4}>
                <Tag color="success">低</Tag>
                <Tag color="warning">中</Tag>
                <Tag color="error">高</Tag>
              </Space>
            }
          >
            <ReactECharts option={soilChartOption} style={{ height: 320 }} notMerge />
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
          locale={{ emptyText: <Empty description="暂无环境异常预警" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        />
      </Card>

      {/* 数据口径提示 */}
      <AntAlert
        style={{ marginTop: 12 }}
        type={metrics.hasRealData ? 'success' : 'info'}
        showIcon
        message={
          metrics.hasRealData
            ? '已加载真实环境时序数据（/iot/readings/series）'
            : '当前展示原型示例口径（后端环境时序接口未返回数据），时间范围与站点筛选、预警处理均可正常使用。'
        }
      />

      {/* 预警处理弹窗 */}
      <Modal
        open={activeAlert !== null}
        title="环境预警处理"
        okText="确认处理"
        cancelText="取消"
        destroyOnClose
        onCancel={() => setActiveAlert(null)}
        onOk={() => {
          if (!activeAlert) {
            return
          }
          if (!remark.trim()) {
            message.warning('请填写处理说明')
            return
          }
          setHandledIds((prev) => [...prev, activeAlert.id])
          message.success(`${activeAlert.station} ${activeAlert.type} 预警已处理：${measure}`)
          setActiveAlert(null)
          setRemark('')
        }}
      >
        {activeAlert && (
          <div>
            <Row gutter={[0, 8]}>
              <Col span={12}>站点：{activeAlert.station}</Col>
              <Col span={12}>异常类型：{activeAlert.type}</Col>
              <Col span={12}>当前值：{activeAlert.value}</Col>
              <Col span={12}>阈值：{activeAlert.threshold}</Col>
              <Col span={12}>级别：{activeAlert.level}</Col>
              <Col span={12}>时间：{activeAlert.time}</Col>
            </Row>
            <div style={{ marginTop: 12 }}>
              <Text>处理措施：</Text>
              <Radio.Group
                style={{ marginTop: 6, display: 'block' }}
                value={measure}
                onChange={(event) => setMeasure(String(event.target.value))}
                options={[
                  { label: '下发整改通知', value: '下发整改通知' },
                  { label: '现场核查', value: '现场核查' },
                  { label: '调整灌溉/通风策略', value: '调整灌溉/通风策略' },
                ]}
              />
            </div>
            <div style={{ marginTop: 12 }}>
              <Text>处理说明：</Text>
              <textarea
                value={remark}
                onChange={(event) => setRemark(event.target.value)}
                rows={3}
                placeholder="请输入处理说明（必填）"
                style={{
                  width: '100%',
                  marginTop: 6,
                  padding: 8,
                  border: '1px solid rgba(0,0,0,0.15)',
                  borderRadius: 6,
                  resize: 'vertical',
                  color: 'inherit',
                  background: 'transparent',
                }}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
