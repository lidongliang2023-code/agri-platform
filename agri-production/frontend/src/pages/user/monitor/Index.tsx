/**
 * 页面名称：生产监控看板
 * 路由路径：/production/monitor
 * 所属模块：生长监测与IoT
 * 原型来源：用户端原型 P19 monitor
 *
 * 数据边界（2026-10-28 重构）：
 * - **设备**（在线数 / 在线率 / 设备实时）→ 物联网系统。数量走 `GET /iot/device-stats`，
 *   明细走 `GET /iot/devices`，两边同源，不会再出现"看板说 13 台、设备列表有 29 台"。
 * - **环境**（平均温湿度 / 累计降雨 / 24h 曲线）→ 生产端自己的传感器长表，
 *   由后端 `GET /monitor/env-summary` 聚合后返回。页面不再自己 reduce 平均值，
 *   也不再 `slice(-24)` 拿"最后 24 条记录"冒充"近 24 小时"——后者在 30 分钟一次采集时
 *   只有 12 小时，在一分钟一次采集时只有 24 分钟，且会把上周的数据画成实时曲线。
 * - **任务 / 告警 / 投入品 / AI 诊断** → 生产业务域，保持原有口径。
 *
 * 还原要点：
 * - 标题「📡 生产监控看板」+ 农场下拉 + 自动刷新 30s 开关
 * - 概览卡 4 项：在田地块 / 在线设备（在线率）/ 今日任务（完成率）/ 活跃告警
 * - 「🌡️ 环境概览」：平均气温、平均湿度、土壤湿度（偏低告警）、累计降雨 + 近 24h 趋势曲线
 * - 「📡 设备实时」：按状态排序的设备清单，异常优先，可下钻到设备详情
 * - 「🤖 AI诊断快报 (V3.0)」：病虫害风险清单与处置建议
 * - 「📋 今日待办」：今日任务清单与优先级
 * - 「💊 投入品使用快览」：本周肥料 / 农药 / 水用量与合规状态
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Empty,
  Progress,
  Row,
  Select,
  Skeleton,
  Space,
  Statistic,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import {
  ApiOutlined,
  DashboardOutlined,
  ExperimentOutlined,
  FieldTimeOutlined,
  MedicineBoxOutlined,
  ReloadOutlined,
  RobotOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import dayjs from 'dayjs'
import useFarmStore from '@/store/farm'
import { listPestGrowthRecords } from '@/api/growth'
import { getMonitorEnvSummary } from '@/api/monitor'
import { deviceTypeLabel, getDeviceStats, listDevices, onlineStatusMeta, unwrapList } from '@/api/iot'
import { listPlots } from '@/api/plots'
import { listTasks } from '@/api/tasks'
import { listAlerts } from '@/api/alerts'
import { pageUsages } from '@/api/inputs'
import type { Alert as AlertEntity, GrowthRecord, IotDevice, InputUsageRecord, Plot, Task } from '@/types'
import { isTaskDone } from '@/types/task'

/** 环境指标阈值：土壤湿度低于该值判定为偏低 */
const SOIL_MOISTURE_WARN = 40

/** 数据滞后超过该小时数时提示"这不是实时数据" */
const STALE_WARN_HOURS = 24

/** 病虫害等级文案（后端 pestLevel 越小越严重） */
const PEST_LEVEL_TEXT: Record<number, string> = {
  1: '高',
  2: '中',
  3: '低',
}

/** 病虫害处置建议（按等级给出口径，与原型示例保持一致） */
const PEST_SUGGESTION: Record<number, string> = {
  1: '立即通风降湿 + 药剂防治',
  2: '喷施代森锰锌预防',
  3: '持续观察，7 天后复检',
}

/** 任务优先级文案与颜色 */
const PRIORITY_META: Record<number, { label: string; color: string }> = {
  1: { label: '普通', color: 'default' },
  2: { label: '普通', color: 'default' },
  3: { label: '重要', color: 'orange' },
  4: { label: '紧急', color: 'red' },
}

/** 设备状态排序权重：故障 → 离线 → 在线（异常优先，看板要先把问题摆出来） */
const DEVICE_STATUS_WEIGHT: Record<number, number> = { 3: 0, 2: 1, 1: 2 }

/**
 * 读取设备在线状态（兼容实体字段 onlineFlag）。
 *
 * @param device 设备
 * @returns 1 在线 / 2 离线 / 3 故障
 */
function statusOf(device: IotDevice): number {
  const raw = device as unknown as { onlineFlag?: number }
  const value = Number(device.onlineStatus ?? raw.onlineFlag)
  return value === 1 || value === 3 ? value : 2
}

/**
 * 判定投入品类别（后端投入品使用记录无类型字段，按名称关键字归类）。
 *
 * @param name 投入品名称
 * @param unit 用量单位
 * @returns 类别：肥料 / 农药 / 水 / 其他
 */
function classifyUsage(name: string, unit?: string): '肥料' | '农药' | '水' | '其他' {
  if (unit === 'm³' || unit === 'm3') return '水'
  if (/肥/.test(name)) return '肥料'
  if (/虫|菌|霉|草|药|啉|酯|唑|锰锌|菌灵/.test(name)) return '农药'
  return '其他'
}

/**
 * 把"距现在多少小时"说成人话。
 *
 * @param hours 小时数
 * @returns 展示文案
 */
function staleText(hours: number): string {
  if (hours < 1) return '1 小时内'
  if (hours < 24) return `${hours} 小时前`
  return `${Math.floor(hours / 24)} 天前`
}

/**
 * 生产监控看板
 *
 * 业务职责：集中呈现农场实时生产态势，包括地块、设备在线率、任务进度、
 * 活跃告警、环境实时曲线、设备实时清单、AI 诊断快报与投入品使用快览，支持下钻到对应业务页。
 *
 * @returns 页面内容
 */
export default function MonitorIndex(): JSX.Element {
  const navigate = useNavigate()
  const { currentFarm, farmOptions, setCurrentFarm } = useFarmStore()

  /** 手动刷新计数，变更即触发全部查询重新取数 */
  const [refreshKey, setRefreshKey] = useState<number>(0)
  /** 是否开启 30s 自动刷新 */
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true)
  /** 环境概览所选地块，空表示当前农场全部地块 */
  const [envPlotId, setEnvPlotId] = useState<string | undefined>(undefined)

  const farmId = currentFarm?.farmId
  const today = dayjs().format('YYYY-MM-DD')
  const refetchInterval = autoRefresh ? 30000 : false

  /** 地块列表（在田地块口径 + 环境概览的地块下拉） */
  const plotsQuery = useQuery({
    queryKey: ['monitor-plots', farmId, refreshKey],
    queryFn: () => listPlots({ pageNum: 1, pageSize: 100, farmId }),
    retry: false,
    refetchInterval,
  })

  /** 设备数量统计（物联网系统口径：总数 / 在线 / 离线 / 故障） */
  const deviceStatsQuery = useQuery({
    queryKey: ['monitor-device-stats', farmId, refreshKey],
    queryFn: () => getDeviceStats(farmId),
    retry: false,
    refetchInterval,
  })

  /** 设备明细（设备实时清单，与设备列表页同源） */
  const devicesQuery = useQuery({
    queryKey: ['monitor-devices', farmId, refreshKey],
    queryFn: () => listDevices({ pageNum: 1, pageSize: 100, farmId }),
    retry: false,
    refetchInterval,
  })

  /** 今日任务 */
  const tasksQuery = useQuery({
    queryKey: ['monitor-tasks', farmId, today, refreshKey],
    queryFn: () => listTasks({ pageNum: 1, pageSize: 100, farmId, startDate: today, endDate: today }),
    retry: false,
    refetchInterval,
  })

  /** 活跃告警 */
  const alertsQuery = useQuery({
    queryKey: ['monitor-alerts', farmId, refreshKey],
    queryFn: () => listAlerts({ pageNum: 1, pageSize: 100, farmId }),
    retry: false,
    refetchInterval,
  })

  /** 环境实时概览（后端聚合：窗口锚定最新采样 + 按小时曲线） */
  const envQuery = useQuery({
    queryKey: ['monitor-env', farmId, envPlotId, refreshKey],
    queryFn: () => getMonitorEnvSummary({ farmId, plotId: envPlotId, hours: 24 }),
    retry: false,
    refetchInterval,
  })

  /** 病虫害记录（AI 诊断快报） */
  const pestQuery = useQuery({
    queryKey: ['monitor-pest', farmId, refreshKey],
    queryFn: () => listPestGrowthRecords(1),
    retry: false,
    refetchInterval,
  })

  /** 投入品使用记录（本周用量快览） */
  const usageQuery = useQuery({
    queryKey: ['monitor-usages', refreshKey],
    queryFn: () => pageUsages({ pageNum: 1, pageSize: 200 }),
    retry: false,
    refetchInterval,
  })

  const plots: Plot[] = useMemo(() => unwrapList<Plot>(plotsQuery.data), [plotsQuery.data])
  const devices: IotDevice[] = useMemo(() => unwrapList<IotDevice>(devicesQuery.data), [devicesQuery.data])
  const tasks: Task[] = useMemo(() => unwrapList<Task>(tasksQuery.data), [tasksQuery.data])
  const alerts: AlertEntity[] = useMemo(() => unwrapList<AlertEntity>(alertsQuery.data), [alertsQuery.data])
  const pestRows: GrowthRecord[] = useMemo(
    () => unwrapList<GrowthRecord>(pestQuery.data),
    [pestQuery.data],
  )
  const usages: InputUsageRecord[] = useMemo(
    () => unwrapList<InputUsageRecord>(usageQuery.data),
    [usageQuery.data],
  )

  /** 地块 ID → 名称（设备清单里显示"关联地块"用） */
  const plotNameMap = useMemo(() => {
    const map = new Map<string, string>()
    plots.forEach((item) => map.set(String(item.plotId), item.plotName))
    return map
  }, [plots])

  /** 在田地块数（在种 / 采收期） */
  const growingPlots = plots.filter((item) => Number(item.status) === 2 || Number(item.status) === 3)
  const plotCount = growingPlots.length > 0 ? growingPlots.length : plots.length

  /** 设备统计（物联网端口径；拿不到时回落到明细条数，不让卡片空着） */
  const deviceStats = deviceStatsQuery.data
  const deviceTotal = deviceStats ? Number(deviceStats.total ?? 0) : devices.length
  const deviceOnline = deviceStats ? Number(deviceStats.online ?? 0) : devices.filter((d) => statusOf(d) === 1).length
  const deviceAlert = deviceStats ? Number(deviceStats.alert ?? 0) : devices.filter((d) => statusOf(d) === 3).length
  const onlineRate = deviceTotal > 0 ? Math.round((deviceOnline / deviceTotal) * 100) : 0

  /** 设备实时清单：异常优先，最多 6 台 */
  const liveDevices = useMemo(
    () =>
      [...devices]
        .sort((a, b) => (DEVICE_STATUS_WEIGHT[statusOf(a)] ?? 9) - (DEVICE_STATUS_WEIGHT[statusOf(b)] ?? 9))
        .slice(0, 6),
    [devices],
  )

  /** 今日任务统计（「已完成」同时认 completed 与 done，避免词表切换后完成率静默归零） */
  const taskTotal = tasks.length
  const taskDone = tasks.filter((item) => isTaskDone(item.status)).length
  const taskRate = taskTotal > 0 ? Math.round((taskDone / taskTotal) * 100) : 0

  /** 活跃告警（未处理 + 处理中） */
  const activeAlerts = alerts.filter((item) => Number(item.status) === 1 || Number(item.status) === 2)

  /** 环境概览数据（全部来自后端聚合结果） */
  const env = envQuery.data
  const envSummary = env?.summary ?? {}
  const envTemp = envSummary.air_temperature ?? null
  const envHumidity = envSummary.air_humidity ?? null
  const envSoil = envSummary.soil_moisture ?? null
  const envRain = env?.rainfallTotal ?? null
  const envSoilLow = envSoil !== null && envSoil < SOIL_MOISTURE_WARN
  const envStale = env?.staleHours ?? null
  const envIsStale = envStale !== null && envStale >= STALE_WARN_HOURS

  /** 近 24h 环境趋势曲线配置（数据点由后端按小时聚合，前端只负责画） */
  const envChartOption = useMemo<EChartsOption>(() => {
    const points = env?.series ?? []
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['空气温度', '空气湿度', '土壤湿度'], bottom: 0 },
      grid: { left: 48, right: 24, top: 24, bottom: 48 },
      xAxis: { type: 'category', data: points.map((item) => item.time), boundaryGap: false },
      yAxis: { type: 'value', name: '温度(℃)/湿度(%)' },
      series: [
        {
          name: '空气温度',
          type: 'line',
          smooth: true,
          connectNulls: false,
          data: points.map((item) => item.airTemperature),
          itemStyle: { color: '#ff7875' },
        },
        {
          name: '空气湿度',
          type: 'line',
          smooth: true,
          connectNulls: false,
          data: points.map((item) => item.airHumidity),
          itemStyle: { color: '#40a9ff' },
        },
        {
          name: '土壤湿度',
          type: 'line',
          smooth: true,
          connectNulls: false,
          data: points.map((item) => item.soilMoisture),
          itemStyle: { color: '#52c41a' },
        },
      ],
    }
  }, [env])

  /** 本周投入品用量汇总 */
  const usageSummary = useMemo(() => {
    const weekStart = dayjs().startOf('day').subtract(6, 'day')
    const weekRows = usages.filter((item) => {
      const time = item.usedAt ?? item.createdAt
      return time ? dayjs(time).isAfter(weekStart) : false
    })
    const sumBy = (category: '肥料' | '农药' | '水' | '其他'): string => {
      const rows = weekRows.filter((item) => classifyUsage(item.inputName ?? '', item.unit) === category)
      if (rows.length === 0) return '0'
      const total = rows.reduce((acc, item) => acc + (item.dosage ?? 0), 0)
      const unit = rows.find((item) => item.unit)?.unit ?? ''
      return `${Number(total.toFixed(1))}${unit}`
    }
    const blocked = weekRows.filter((item) => Number(item.status) === 0).length
    return {
      total: weekRows.length,
      fertilizer: sumBy('肥料'),
      pesticide: sumBy('农药'),
      water: sumBy('水'),
      blocked,
    }
  }, [usages])

  /** 渲染加载骨架 */
  const renderLoading = (): JSX.Element => <Skeleton active paragraph={{ rows: 3 }} />

  return (
    <div style={{ padding: 24 }}>
      <Row className="production-custom-page-header production-page-header-row" justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Space size={12}>
          <DashboardOutlined style={{ fontSize: 22 }} />
          <Typography.Title className="production-page-heading" level={4} style={{ margin: 0 }}>
            生产监控看板
          </Typography.Title>
          <Select
            style={{ width: 180 }}
            value={currentFarm?.farmId}
            options={farmOptions.map((item) => ({ value: item.farmId, label: item.farmName }))}
            onChange={(value) => {
              const next = farmOptions.find((item) => item.farmId === value)
              if (next) setCurrentFarm(next)
              // 农场变了，地块筛选必须重置 —— 否则会带着上一个农场的地块去查，返回空
              setEnvPlotId(undefined)
            }}
            placeholder="请选择农场"
          />
        </Space>
        <Space size={12}>
          <Space size={4}>
            <Typography.Text type="secondary">刷新: 自动 30s</Typography.Text>
            <Switch checked={autoRefresh} onChange={setAutoRefresh} />
          </Space>
          <Button icon={<ReloadOutlined />} onClick={() => setRefreshKey((key) => key + 1)}>
            立即刷新
          </Button>
        </Space>
      </Row>

      {!currentFarm && (
        <Alert
          type="warning"
          showIcon
          message="未选择农场"
          description="请先在顶部选择农场，看板将按农场作用域统计地块、设备、任务与告警数据。"
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            {plotsQuery.isLoading ? (
              renderLoading()
            ) : (
              <Statistic title="在田地块" value={plotCount} suffix="块" prefix={<FieldTimeOutlined />} />
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable onClick={() => navigate('/production/iot')}>
            {deviceStatsQuery.isLoading ? (
              renderLoading()
            ) : (
              <Space direction="vertical" style={{ width: '100%' }} size={4}>
                <Statistic
                  title={
                    <Space size={4}>
                      <span>在线设备</span>
                      {deviceAlert > 0 && <Badge status="error" text={`${deviceAlert} 故障`} />}
                    </Space>
                  }
                  value={deviceOnline}
                  suffix={`/ ${deviceTotal}`}
                  prefix={<ApiOutlined />}
                />
                <Progress percent={onlineRate} size="small" status={onlineRate >= 90 ? 'success' : 'normal'} />
                <Typography.Text type="secondary">{onlineRate}% 在线 · 点击查看设备台账</Typography.Text>
              </Space>
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable onClick={() => navigate('/production/tasks')}>
            {tasksQuery.isLoading ? (
              renderLoading()
            ) : (
              <Space direction="vertical" style={{ width: '100%' }} size={4}>
                <Statistic title="今日任务" value={taskDone} suffix={`/ ${taskTotal}`} />
                <Progress percent={taskRate} size="small" />
                <Typography.Text type="secondary">{taskRate}% 完成</Typography.Text>
              </Space>
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable onClick={() => navigate('/production/alerts')}>
            {alertsQuery.isLoading ? (
              renderLoading()
            ) : (
              <Statistic
                title="活跃告警"
                value={activeAlerts.length}
                suffix="条"
                valueStyle={{ color: activeAlerts.length > 0 ? '#cf1322' : '#3f8600' }}
                prefix={<WarningOutlined />}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <Card
            title="🌡️ 环境概览"
            extra={
              <Space>
                <Select
                  allowClear
                  style={{ width: 160 }}
                  placeholder="当前农场全部地块"
                  value={envPlotId}
                  options={plots.map((item) => ({ value: item.plotId, label: item.plotName }))}
                  onChange={(value) => setEnvPlotId(value)}
                />
                <Button type="link" onClick={() => navigate('/production/growth/environment')}>
                  查看环境详情→
                </Button>
              </Space>
            }
          >
            {envQuery.isError && (
              <Alert
                type="error"
                showIcon
                message="环境数据加载失败"
                description={(envQuery.error as Error)?.message ?? '请稍后重试'}
              />
            )}
            {envQuery.isLoading && renderLoading()}
            {!envQuery.isLoading && !envQuery.isError && (env?.sampleCount ?? 0) === 0 && (
              <Empty description="该范围内暂无传感器上报数据，请确认设备已绑定地块并正常上报" />
            )}
            {!envQuery.isLoading && !envQuery.isError && (env?.sampleCount ?? 0) > 0 && (
              <Space direction="vertical" style={{ width: '100%' }} size={16}>
                <Space size={12} wrap>
                  <Typography.Text type="secondary">
                    数据窗口 {env?.windowFrom} ~ {env?.windowTo}
                  </Typography.Text>
                  {envIsStale && envStale !== null && (
                    <Tooltip title="窗口锚定在最新一次采样，不是当前时间">
                      <Tag color="orange">数据滞后 {staleText(envStale)}</Tag>
                    </Tooltip>
                  )}
                  <Tag>{env?.sampleCount} 条读数 / {env?.plotCount} 个地块</Tag>
                </Space>
                <Row gutter={16}>
                  <Col span={6}>
                    <Statistic title="平均气温" value={envTemp ?? '-'} suffix="°C" />
                  </Col>
                  <Col span={6}>
                    <Statistic title="平均湿度" value={envHumidity ?? '-'} suffix="%" />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="土壤湿度"
                      value={envSoil ?? '-'}
                      suffix="%"
                      valueStyle={envSoilLow ? { color: '#faad14' } : undefined}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic title="累计降雨" value={envRain ?? '-'} suffix="mm" />
                  </Col>
                </Row>
                {envSoilLow && (
                  <Alert type="warning" showIcon message={`土壤湿度 ${envSoil}% 偏低，建议及时灌溉`} />
                )}
                <ReactECharts option={envChartOption} style={{ height: 260 }} notMerge />
              </Space>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card
            title="📡 设备实时"
            extra={
              <Button type="link" onClick={() => navigate('/production/iot')}>
                查看全部设备→
              </Button>
            }
          >
            {devicesQuery.isError && (
              <Alert
                type="error"
                showIcon
                message="设备数据加载失败"
                description={(devicesQuery.error as Error)?.message ?? '请稍后重试'}
              />
            )}
            {devicesQuery.isLoading && renderLoading()}
            {!devicesQuery.isLoading && !devicesQuery.isError && liveDevices.length === 0 && (
              <Empty description="当前农场暂无设备，请先在物联网系统中注册并绑定地块" />
            )}
            {!devicesQuery.isLoading && !devicesQuery.isError && liveDevices.length > 0 && (
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                {liveDevices.map((device) => {
                  const status = statusOf(device)
                  const meta = onlineStatusMeta(status)
                  const plotName = device.plotId ? plotNameMap.get(String(device.plotId)) : undefined
                  return (
                    <Row
                      key={device.deviceId}
                      align="middle"
                      justify="space-between"
                      style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }}
                      onClick={() => navigate(`/production/iot/${device.deviceId}`)}
                    >
                      <Space size={8} style={{ minWidth: 0 }}>
                        <Tag color={meta.color}>{meta.label}</Tag>
                        <Typography.Text ellipsis style={{ maxWidth: 160 }}>
                          {device.deviceName || device.deviceCode || device.deviceId}
                        </Typography.Text>
                        <Tag>{deviceTypeLabel(device.deviceType)}</Tag>
                      </Space>
                      <Space size={8}>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {plotName ?? '未绑定地块'}
                        </Typography.Text>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {device.lastHeartbeatAt || '从未上报'}
                        </Typography.Text>
                      </Space>
                    </Row>
                  )
                })}
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  按异常优先排序，最多展示 6 台；设备台账与在线状态由物联网系统统一维护。
                </Typography.Text>
              </Space>
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <Card
            title="🤖 AI诊断快报 (V3.0)"
            extra={
              <Button type="link" onClick={() => navigate('/production/ai/pest-detection')}>
                查看AI预警中心→
              </Button>
            }
          >
            {pestQuery.isError && (
              <Alert
                type="error"
                showIcon
                message="AI 诊断数据加载失败"
                description={(pestQuery.error as Error)?.message ?? '请稍后重试'}
              />
            )}
            {pestQuery.isLoading && renderLoading()}
            {!pestQuery.isLoading && !pestQuery.isError && pestRows.length === 0 && (
              <Empty description="暂无病虫害风险，作物长势良好" />
            )}
            {!pestQuery.isLoading && !pestQuery.isError && pestRows.length > 0 && (
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                {pestRows.slice(0, 5).map((row) => {
                  const level = Number((row as unknown as { pestLevel?: number }).pestLevel ?? 2)
                  const riskText = PEST_LEVEL_TEXT[level] ?? '中'
                  const color = level === 1 ? 'red' : level === 2 ? 'orange' : 'green'
                  return (
                    <Card key={row.recordId} size="small" style={{ background: '#fafafa' }}>
                      <Space direction="vertical" size={4} style={{ width: '100%' }}>
                        <Space>
                          <RobotOutlined />
                          <Typography.Text strong>
                            {row.plotName ?? row.plotId ?? '未知地块'}
                            {row.cropName ? ` - ${row.cropName}` : ''}
                          </Typography.Text>
                          <Tag color={color}>
                            {row.pestInfo || '病虫害风险'}（{riskText}）
                          </Tag>
                        </Space>
                        <Typography.Text type="secondary">
                          建议: {PEST_SUGGESTION[level] ?? PEST_SUGGESTION[2]}
                        </Typography.Text>
                      </Space>
                    </Card>
                  )
                })}
              </Space>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card
            title={`📋 今日待办 (${taskTotal}项)`}
            extra={
              <Button type="link" onClick={() => navigate('/production/tasks')}>
                查看全部任务→
              </Button>
            }
          >
            {tasksQuery.isError && (
              <Alert
                type="error"
                showIcon
                message="今日任务加载失败"
                description={(tasksQuery.error as Error)?.message ?? '请稍后重试'}
              />
            )}
            {tasksQuery.isLoading && renderLoading()}
            {!tasksQuery.isLoading && !tasksQuery.isError && tasks.length === 0 && (
              <Empty description="今日暂无待办任务" />
            )}
            {!tasksQuery.isLoading && !tasksQuery.isError && tasks.length > 0 && (
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                {tasks.slice(0, 6).map((task) => {
                  const priority = PRIORITY_META[Number(task.priority)] ?? PRIORITY_META[2]
                  return (
                    <Row key={task.taskId} align="middle" justify="space-between" style={{ padding: '8px 0' }}>
                      <Space size={8}>
                        <Typography.Text type="secondary">
                          {task.planStartDate ? dayjs(task.planStartDate).format('HH:mm') : '今天'}
                        </Typography.Text>
                        <Tag color={priority.color}>{priority.label}</Tag>
                        <Typography.Text>
                          {task.plotName ?? '未指定地块'} - {task.taskName}
                        </Typography.Text>
                      </Space>
                      <Button type="link" size="small" onClick={() => navigate(`/production/tasks/${task.taskId}`)}>
                        去处理
                      </Button>
                    </Row>
                  )
                })}
              </Space>
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24}>
          <Card
            title={
              <Space>
                <MedicineBoxOutlined />
                <span>💊 投入品使用快览</span>
              </Space>
            }
            extra={
              <Button type="link" onClick={() => navigate('/production/inputs?tab=ledger')}>
                查看投入品台账→
              </Button>
            }
          >
            {usageQuery.isError && (
              <Alert
                type="error"
                showIcon
                message="投入品数据加载失败"
                description={(usageQuery.error as Error)?.message ?? '请稍后重试'}
              />
            )}
            {usageQuery.isLoading && renderLoading()}
            {!usageQuery.isLoading && !usageQuery.isError && (
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                <Row gutter={16}>
                  <Col xs={8}>
                    <Statistic title="本周肥料" value={usageSummary.fertilizer} prefix={<ExperimentOutlined />} />
                  </Col>
                  <Col xs={8}>
                    <Statistic title="本周农药" value={usageSummary.pesticide} />
                  </Col>
                  <Col xs={8}>
                    <Statistic title="本周用水" value={usageSummary.water} />
                  </Col>
                </Row>
                <Space size={12}>
                  <Tag color={usageSummary.blocked === 0 ? 'green' : 'red'}>
                    合规状态 {usageSummary.blocked === 0 ? '✅ 全部合规' : `❌ ${usageSummary.blocked} 条异常`}
                  </Tag>
                  <Tag>拦截次数 {usageSummary.blocked}</Tag>
                </Space>
                {usageSummary.total === 0 && (
                  <Typography.Text type="secondary">本周暂无投入品使用记录</Typography.Text>
                )}
              </Space>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
