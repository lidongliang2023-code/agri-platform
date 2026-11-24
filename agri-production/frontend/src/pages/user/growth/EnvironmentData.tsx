import { CollapsibleFilterDiv } from '@/components/CollapsibleFilterGrid'
import Table from '@/components/BusinessRecordList'
import PageContainer from '@/components/ProductionPageContainer'
import '@/components/ProductionListDense.css'
import '@/components/ProductionTable.css'
/**
 * 页面名称：环境数据
 * 路由路径：/production/growth/environment
 * 所属模块：生长监测与IoT
 * PRD 序号：PRD 6.1 #25（温湿度/土壤/气象曲线、历史回溯）
 *
 * 数据来源：
 * - 选中设备时走 `GET /iot/readings/series?deviceId=&metric=`
 * - 未选设备（按地块）时走 `GET /growth/environment?plotId=`
 * 两条链路在前端统一归一为「指标点」后绘曲线，兼容后端命名差异（见 METRIC_ALIAS）。
 */
import { useMemo, useState } from 'react'
import type { Key } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Empty,
  Segmented,
  Select,
  Skeleton,
  Space,
  Tooltip,
  message,
} from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import useFarmStore from '@/store/farm'
import { listEnvironmentData } from '@/api/growth'
import {
  DEFAULT_ENV_METRICS,
  ENV_METRIC_DEFS,
  listDevices,
  listReadingSeries,
  normalizeMetric,
  unwrapList,
} from '@/api/iot'
import { listPlots } from '@/api/plots'
import type { EnvironmentData, IotDevice, Plot } from '@/types'

/** 时间范围快捷选项 */
const RANGE_PRESETS: { label: string; value: string; days: number }[] = [
  { label: '今日', value: 'today', days: 1 },
  { label: '近7天', value: '7d', days: 7 },
  { label: '近30天', value: '30d', days: 30 },
]

/** 统一指标点（屏蔽两种数据源字段差异） */
interface MetricPoint {
  /** 采集时间 */
  time: string
  /** 指标编码（已标准化） */
  metric: string
  /** 指标值 */
  value: number
  /** 单位 */
  unit: string
  /** 来源描述 */
  source: string
}

/** 土壤湿度偏低阈值（%） */
const SOIL_LOW = 40

/**
 * 读取环境数据行的采集时间（兼容 collectedAt / readTime）。
 *
 * @param row 环境数据行
 * @returns 时间字符串
 */
function envTime(row: EnvironmentData): string {
  const raw = row as unknown as { readTime?: string }
  return row.collectedAt ?? raw.readTime ?? ''
}

/**
 * 将环境数据行展开为指标点数组。
 *
 * @param rows 环境数据行
 * @returns 指标点数组
 */
function expandEnvRows(rows: EnvironmentData[]): MetricPoint[] {
  const points: MetricPoint[] = []
  rows.forEach((row) => {
    const time = envTime(row)
    if (!time) return
    ENV_METRIC_DEFS.forEach((def) => {
      const value = row[def.key as keyof EnvironmentData]
      if (typeof value === 'number') {
        points.push({ time, metric: def.key, value, unit: def.unit, source: '地块环境' })
      }
    })
  })
  return points
}

/**
 * 导出数据为 CSV 文件。
 *
 * @param rows 数据行
 * @param fileName 文件名
 */
function exportCsv(rows: MetricPoint[], fileName: string): void {
  const header = '采集时间,指标,数值,单位,来源\n'
  const body = rows
    .map((row) => `${row.time},${row.metric},${row.value},${row.unit},${row.source}`)
    .join('\n')
  const blob = new Blob([`${header}${body}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * 环境数据页面
 *
 * 业务职责：展示空气温湿度、土壤温湿度、光照、CO₂ 等环境指标曲线，
 * 支持地块 / 设备 / 时间范围筛选、历史回溯与原始数据导出。
 *
 * @returns 页面内容
 */
export default function EnvironmentData(): JSX.Element {
  const { currentFarm } = useFarmStore()
  const farmId = currentFarm?.farmId

  /** 地块筛选（草稿与已生效） */
  const [draftPlotId, setDraftPlotId] = useState<string | undefined>(undefined)
  const [plotId, setPlotId] = useState<string | undefined>(undefined)
  /** 设备筛选 */
  const [draftDeviceId, setDraftDeviceId] = useState<string | undefined>(undefined)
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined)
  /** 时间范围快捷选项 */
  const [draftRangePreset, setDraftRangePreset] = useState<string>('7d')
  const [rangePreset, setRangePreset] = useState<string>('7d')
  /** 自定义时间范围 */
  const [draftCustomRange, setDraftCustomRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [customRange, setCustomRange] = useState<[Dayjs, Dayjs] | null>(null)
  /** 历史回溯日期（优先于快捷范围） */
  const [draftBacktrackDate, setDraftBacktrackDate] = useState<Dayjs | null>(null)
  const [backtrackDate, setBacktrackDate] = useState<Dayjs | null>(null)
  /** 展示指标 */
  const [metrics, setMetrics] = useState<string[]>(DEFAULT_ENV_METRICS)
  /** 手动刷新计数 */
  const [refreshKey, setRefreshKey] = useState<number>(0)
  /** 行勾选 */
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([])

  const handleSearch = (): void => {
    setPlotId(draftPlotId)
    setDeviceId(draftDeviceId)
    setRangePreset(draftRangePreset)
    setCustomRange(draftCustomRange)
    setBacktrackDate(draftBacktrackDate)
  }

  const handleReset = (): void => {
    setDraftPlotId(undefined)
    setDraftDeviceId(undefined)
    setDraftRangePreset('7d')
    setDraftCustomRange(null)
    setDraftBacktrackDate(null)
    setPlotId(undefined)
    setDeviceId(undefined)
    setRangePreset('7d')
    setCustomRange(null)
    setBacktrackDate(null)
    setMetrics(DEFAULT_ENV_METRICS)
  }

  /** 地块列表 */
  const plotsQuery = useQuery({
    queryKey: ['env-plots', farmId],
    queryFn: () => listPlots({ pageNum: 1, pageSize: 100, farmId }),
    retry: false,
  })
  const plots: Plot[] = useMemo(() => unwrapList<Plot>(plotsQuery.data), [plotsQuery.data])

  /** 设备列表 */
  const devicesQuery = useQuery({
    queryKey: ['env-devices', farmId],
    queryFn: () => listDevices({ pageNum: 1, pageSize: 100, farmId }),
    retry: false,
  })
  const devices: IotDevice[] = useMemo(() => unwrapList<IotDevice>(devicesQuery.data), [devicesQuery.data])

  /** 设备读数时序（选中设备时） */
  const seriesQuery = useQuery({
    queryKey: ['env-series', deviceId, refreshKey],
    queryFn: () => listReadingSeries(deviceId as string),
    retry: false,
    enabled: Boolean(deviceId),
  })

  /** 地块环境数据（未选设备时） */
  const envQuery = useQuery({
    queryKey: ['env-rows', plotId, refreshKey],
    queryFn: () => listEnvironmentData({ pageNum: 1, pageSize: 200, plotId }),
    retry: false,
    enabled: !deviceId,
  })

  /** 统一指标点 */
  const points = useMemo<MetricPoint[]>(() => {
    if (deviceId) {
      const rows = seriesQuery.data ?? []
      return rows
        .filter((row) => typeof row.metricValue === 'number')
        .map((row) => ({
          time: row.readTime,
          metric: normalizeMetric(row.metric),
          value: Number(row.metricValue),
          unit: row.unit ?? '',
          source: '设备读数',
        }))
    }
    return expandEnvRows(unwrapList<EnvironmentData>(envQuery.data))
  }, [deviceId, seriesQuery.data, envQuery.data])

  /** 生效时间区间 */
  const effectiveRange = useMemo<[Dayjs, Dayjs] | null>(() => {
    if (backtrackDate) return [backtrackDate.startOf('day'), backtrackDate.endOf('day')]
    if (customRange) return customRange
    const days = RANGE_PRESETS.find((item) => item.value === rangePreset)?.days ?? 7
    return [dayjs().startOf('day').subtract(days - 1, 'day'), dayjs().endOf('day')]
  }, [backtrackDate, customRange, rangePreset])

  /** 时间过滤后的指标点 */
  const filteredPoints = useMemo(() => {
    if (!effectiveRange) return points
    const [start, end] = effectiveRange
    return points.filter((point) => {
      const time = dayjs(point.time)
      return time.isValid() && !time.isBefore(start) && !time.isAfter(end)
    })
  }, [points, effectiveRange])

  /** 最新读数（每个指标最后一条） */
  const latestMap = useMemo(() => {
    const map = new Map<string, MetricPoint>()
    filteredPoints
      .slice()
      .sort((a, b) => dayjs(a.time).valueOf() - dayjs(b.time).valueOf())
      .forEach((point) => map.set(point.metric, point))
    return map
  }, [filteredPoints])

  /** 曲线配置 */
  const chartOption = useMemo<EChartsOption>(() => {
    const times = Array.from(
      new Set(
        filteredPoints
          .filter((point) => metrics.includes(point.metric))
          .map((point) => dayjs(point.time).format('YYYY-MM-DD HH:mm'))
          .sort((a, b) => dayjs(a).valueOf() - dayjs(b).valueOf()),
      ),
    )
    const series = metrics.map((metric) => {
      const def = ENV_METRIC_DEFS.find((item) => item.key === metric)
      const rows = filteredPoints.filter((point) => point.metric === metric)
      const valueMap = new Map<string, number[]>()
      rows.forEach((row) => {
        const key = dayjs(row.time).format('YYYY-MM-DD HH:mm')
        const list = valueMap.get(key) ?? []
        list.push(row.value)
        valueMap.set(key, list)
      })
      return {
        name: def?.label ?? metric,
        type: 'line' as const,
        smooth: true,
        yAxisIndex: def?.axis ?? 0,
        connectNulls: true,
        itemStyle: { color: def?.color },
        data: times.map((time) => {
          const list = valueMap.get(time)
          if (!list || list.length === 0) return null
          return Number((list.reduce((acc, item) => acc + item, 0) / list.length).toFixed(2))
        }),
      }
    })
    return {
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0 },
      grid: { left: 56, right: 56, top: 24, bottom: 48 },
      xAxis: { type: 'category', data: times, boundaryGap: false },
      yAxis: [
        { type: 'value', name: '温度(℃)/湿度(%)/mm', position: 'left' },
        { type: 'value', name: 'lux/ppm', position: 'right', splitLine: { show: false } },
      ],
      dataZoom: [
        { type: 'inside' },
        { type: 'slider', height: 18, bottom: 24 },
      ],
      series,
    }
  }, [filteredPoints, metrics])

  /** 原始数据表行 */
  const tableRows = useMemo(() => {
    const labelOf = (metric: string): string =>
      ENV_METRIC_DEFS.find((item) => item.key === metric)?.label ?? metric
    return filteredPoints
      .filter((point) => metrics.includes(point.metric))
      .slice()
      .sort((a, b) => dayjs(b.time).valueOf() - dayjs(a.time).valueOf())
      .map((point) => ({
        key: `${point.time}-${point.metric}`,
        time: dayjs(point.time).format('YYYY-MM-DD HH:mm'),
        metric: labelOf(point.metric),
        value: point.value,
        unit: point.unit,
        source: point.source,
      }))
  }, [filteredPoints, metrics])

  const soilPoint = latestMap.get('soilMoisture')
  const soilLow = typeof soilPoint?.value === 'number' && soilPoint.value < SOIL_LOW

  const isLoading = deviceId ? seriesQuery.isLoading : envQuery.isLoading
  const isError = deviceId ? seriesQuery.isError : envQuery.isError
  const errorMessage = ((deviceId ? seriesQuery.error : envQuery.error) as Error | undefined)?.message

  return (
    <PageContainer
      className="production-list-dense production-member-list"
      title="环境数据"
      subTitle={
        deviceId
          ? `设备读数时序（设备 ${deviceId}）`
          : plotId
            ? '地块环境数据 /growth/environment'
            : '全部地块环境数据 /growth/environment'
      }
      extra={
        <Segmented
          size="small"
          value={draftRangePreset}
          onChange={(value) => {
            const next = String(value)
            setDraftRangePreset(next)
            setRangePreset(next)
            setDraftCustomRange(null)
            setCustomRange(null)
            setDraftBacktrackDate(null)
            setBacktrackDate(null)
          }}
          options={RANGE_PRESETS.map((item) => ({ label: item.label, value: item.value }))}
        />
      }
    >
      <div className="production-dense-summary">
        <div className="production-dense-summary-items">
          {ENV_METRIC_DEFS.map((def) => {
            const point = latestMap.get(def.key)
            return (
              <Tooltip
                key={def.key}
                title={point ? `最近采集：${dayjs(point.time).format('YYYY-MM-DD HH:mm')}` : '暂无采集数据'}
              >
                <span className="production-dense-metric">
                  <span className="production-dense-metric-label">{def.label}</span>
                  <span className="production-dense-metric-value">
                    {point ? `${Number(point.value.toFixed(1))}${def.unit}` : '—'}
                  </span>
                </span>
              </Tooltip>
            )
          })}
        </div>
        {soilLow && (
          <span className="production-dense-metric-chip">
            土壤湿度 {soilPoint?.value}% 低于 {SOIL_LOW}%，建议灌溉
          </span>
        )}
      </div>

      <Card className="production-dense-filter-card">
        <CollapsibleFilterDiv fieldCount={5} className="production-filter-grid">
          {({ toggleButton }) => (
            <>
          <div className="production-filter-field">
            <label>地块</label>
            <Select
              allowClear
              placeholder="全部地块"
              value={draftPlotId}
              options={plots.map((item) => ({ value: item.plotId, label: item.plotName }))}
              onChange={setDraftPlotId}
            />
          </div>
          <div className="production-filter-field">
            <label>设备</label>
            <Select
              allowClear
              placeholder="按设备查看时序"
              value={draftDeviceId}
              options={devices.map((item) => ({ value: item.deviceId, label: item.deviceName || item.deviceCode }))}
              onChange={setDraftDeviceId}
            />
          </div>
          <div className="production-filter-field">
            <label>时间范围</label>
            <DatePicker.RangePicker
              style={{ width: '100%' }}
              value={draftCustomRange}
              onChange={(value) => {
                setDraftCustomRange(value as [Dayjs, Dayjs] | null)
                if (value) setDraftBacktrackDate(null)
              }}
            />
          </div>
          <div className="production-filter-field">
            <label>历史回溯日期</label>
            <DatePicker
              style={{ width: '100%' }}
              placeholder="选择单日回溯"
              value={draftBacktrackDate}
              onChange={(value) => setDraftBacktrackDate(value)}
            />
          </div>
          <div className="production-filter-field" style={{ gridColumn: '1 / span 3' }}>
            <label>展示指标</label>
            <Checkbox.Group
              value={metrics}
              onChange={(value) => setMetrics(value as string[])}
              options={ENV_METRIC_DEFS.map((item) => ({ label: item.label, value: item.key }))}
            />
          </div>
          <div className="production-filter-actions">
            <Button onClick={handleReset}>重置</Button>
            <Button type="primary" onClick={handleSearch}>查询</Button>
            {toggleButton}
          </div>
            </>
          )}
        </CollapsibleFilterDiv>
      </Card>

      {isError && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 10 }}
          message="环境数据加载失败"
          description={errorMessage ?? '请稍后重试'}
        />
      )}

      <Card title="环境指标曲线" style={{ marginBottom: 10 }}>
        {isLoading ? (
          <Skeleton active paragraph={{ rows: 5 }} />
        ) : filteredPoints.length === 0 ? (
          <Empty description="当前筛选条件下暂无环境数据，请调整地块 / 设备 / 时间范围" />
        ) : (
          <ReactECharts option={chartOption} style={{ height: 300 }} notMerge />
        )}
      </Card>

      <Card>
        <Table
          memberListToolbar
          columnWidthStorageKey="environment-data"
          rowKey="key"
          loading={isLoading}
          dataSource={tableRows}
          onReload={() => setRefreshKey((key) => key + 1)}
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          toolbarTitle={
            <Space size={8} wrap>
              <Button
                icon={<DownloadOutlined />}
                disabled={tableRows.length === 0}
                onClick={() => {
                  const rows = filteredPoints.filter((point) => metrics.includes(point.metric))
                  if (rows.length === 0) {
                    message.warning('当前筛选条件下暂无可导出数据')
                    return
                  }
                  exportCsv(rows, `环境数据_${dayjs().format('YYYYMMDDHHmmss')}.csv`)
                  message.success(`已导出 ${rows.length} 条环境数据`)
                }}
              >
                导出 CSV
              </Button>
            </Space>
          }
          pagination={{ defaultPageSize: 20, showSizeChanger: true }}
          locale={{ emptyText: <Empty description="当前筛选条件下暂无环境明细数据，请调整地块、设备或时间范围" /> }}
          columns={[
            { title: '采集时间', dataIndex: 'time', key: 'time', width: 180 },
            { title: '指标', dataIndex: 'metric', key: 'metric', width: 150 },
            { title: '数值', dataIndex: 'value', key: 'value', width: 120, align: 'right' },
            { title: '单位', dataIndex: 'unit', key: 'unit', width: 100 },
            { title: '来源', dataIndex: 'source', key: 'source', width: 140 },
          ]}
        />
      </Card>
    </PageContainer>
  )
}
