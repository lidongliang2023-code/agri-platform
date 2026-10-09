/**
 * 页面名称：设备详情
 * 路由路径：/production/iot/:deviceId
 * 所属模块：IoT设备管理
 * PRD 序号：PRD 6.1 #29（设备信息、实时数据、指令下发、维修记录）
 *
 * 设计决策：
 * - 实时数据：走 `GET /iot/readings/series` 与 `GET /iot/readings/latest`，真实接口
 * - 指令下发 / 维修记录：后端 `prod_iot_command`、`prod_iot_maintenance` 及
 *   `/iot/devices/{id}/commands`、`/iot/devices/{id}/maintenances` 已上线（SE-1，F-IOT-04/05）。
 *   页面直连 `@/api/iot` 原生契约函数（sendCommand / listCommands /
 *   createIotMaintenance / listIotMaintenances），字段严格对齐后端实体：
 *   IotCommand   = commandId / deviceId / commandType / params / status / receipt / sendAt / receiptAt
 *   IotMaintenance = maintainId / deviceId / maintainType / content / operator / maintainAt / result
 * - 指令状态由服务端按设备 `online_flag` + 10 分钟心跳窗口判定并落库（在线 → SUCCESS，
 *   离线 → FAILED「送达失败」），下发接口返回的即为终态；
 *   **页面只渲染服务端返回值，不做任何本地暂存、不做 setTimeout 模拟回执**。
 */
import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Timeline,
  Typography,
  message,
} from 'antd'
import {
  ArrowLeftOutlined,
  EditOutlined,
  ReloadOutlined,
  SendOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import {
  commandStatusMeta,
  createIotMaintenance,
  getDevice,
  getLatestReading,
  listBoundDevices,
  listCommands,
  listIotMaintenances,
  listReadingSeries,
  maintainTypeLabel,
  metricLabel,
  normalizeMetric,
  onlineStatusMeta,
  sendCommand,
  unwrapList,
  updateDevice,
} from '@/api/iot'
import { listPlots } from '@/api/plots'
import type { IotCommand, IotDevice, IotMaintainType, IotMaintenance, Plot } from '@/types'

/** 指令类型选项 */
const COMMAND_TYPES: string[] = [
  '重启设备',
  '校准传感器',
  '开启灌溉',
  '关闭灌溉',
  '调整采样频率',
  '固件升级',
]

/** 维修类型选项（对齐后端 maintainType 枚举） */
const MAINTAIN_TYPE_OPTIONS: { value: IotMaintainType; label: string }[] = [
  { value: 'INSPECT', label: '巡检' },
  { value: 'REPAIR', label: '维修' },
  { value: 'REPLACE', label: '更换' },
  { value: 'CALIBRATE', label: '校准' },
  { value: 'UPGRADE', label: '升级' },
]

/** 指令表单值 */
interface CommandFormValues {
  /** 指令类型 */
  type: string
  /** 指令参数 */
  params?: string
  /** 操作人 */
  operator: string
}

/** 维修表单值 */
interface MaintenanceFormValues {
  /** 维修时间 */
  time: Dayjs
  /** 维修类型 */
  maintainType: IotMaintainType
  /** 维修内容 */
  content: string
  /** 操作人 */
  operator: string
  /** 维修结果 */
  result: string
}

/** 设备编辑表单值 */
interface DeviceFormValues {
  /** 设备名称 */
  deviceName: string
  /** 型号 */
  model?: string
  /** 厂商 */
  manufacturer?: string
  /** 固件版本 */
  firmwareVersion?: string
  /** 安装位置 */
  location?: string
  /** 经度 */
  longitude?: number
  /** 纬度 */
  latitude?: number
}

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
 * 格式化时间串（空值回退占位符）。
 *
 * @param value 时间串
 * @returns 展示文案
 */
function formatTime(value?: string): string {
  if (!value) return '-'
  const date = dayjs(value)
  return date.isValid() ? date.format('YYYY-MM-DD HH:mm:ss') : value
}

/**
 * 设备详情页面
 *
 * 业务职责：展示设备档案、实时遥测数据，支持控制指令下发与维修记录登记。
 *
 * @returns 页面内容
 */
export default function DeviceDetail(): JSX.Element {
  const navigate = useNavigate()
  const { deviceId = '' } = useParams<{ deviceId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const activeTab = searchParams.get('tab') ?? 'data'

  /** 指标筛选（空表示全部指标） */
  const [metric, setMetric] = useState<string | undefined>(undefined)
  /** 指令下发弹窗 */
  const [commandOpen, setCommandOpen] = useState<boolean>(false)
  /** 维修登记弹窗 */
  const [maintainOpen, setMaintainOpen] = useState<boolean>(false)
  /** 设备编辑弹窗 */
  const [editOpen, setEditOpen] = useState<boolean>(false)

  const [commandForm] = Form.useForm<CommandFormValues>()
  const [maintainForm] = Form.useForm<MaintenanceFormValues>()
  const [deviceForm] = Form.useForm<DeviceFormValues>()

  /** 设备详情 */
  const deviceQuery = useQuery({
    queryKey: ['iot-device', deviceId],
    queryFn: () => getDevice(deviceId),
    retry: false,
    enabled: Boolean(deviceId),
  })
  const device = deviceQuery.data

  /** 遥测时序 */
  const seriesQuery = useQuery({
    queryKey: ['iot-device-series', deviceId, metric],
    queryFn: () => listReadingSeries(deviceId, metric),
    retry: false,
    enabled: Boolean(deviceId),
  })

  /** 最新读数 */
  const latestQuery = useQuery({
    queryKey: ['iot-device-latest', deviceId],
    queryFn: () => getLatestReading(deviceId),
    retry: false,
    enabled: Boolean(deviceId),
  })

  /**
   * 指令记录（GET /iot/devices/{deviceId}/commands）。
   *
   * 状态由服务端落库，页面直接渲染，不再本地暂存、不再定时轮询模拟。
   */
  const commandsQuery = useQuery({
    queryKey: ['iot-device-commands', deviceId],
    queryFn: () => listCommands(deviceId, { limit: 100 }),
    retry: false,
    enabled: Boolean(deviceId),
  })
  const commands: IotCommand[] = commandsQuery.data ?? []

  /**
   * 维修记录（GET /iot/devices/{deviceId}/maintenances）。
   */
  const maintenancesQuery = useQuery({
    queryKey: ['iot-device-maintenances', deviceId],
    queryFn: () => listIotMaintenances(deviceId, 100),
    retry: false,
    enabled: Boolean(deviceId),
  })
  const maintenances: IotMaintenance[] = maintenancesQuery.data ?? []

  /** 绑定地块名称 */
  const plotsQuery = useQuery({
    queryKey: ['iot-device-plots'],
    queryFn: () => listPlots({ pageNum: 1, pageSize: 100 }),
    retry: false,
  })
  const plots: Plot[] = useMemo(() => unwrapList<Plot>(plotsQuery.data), [plotsQuery.data])
  const bindingsQuery = useQuery({
    queryKey: ['iot-device-bindings'],
    queryFn: () => listBoundDevices(),
    retry: false,
  })
  const boundPlotName = useMemo(() => {
    const rows = unwrapList<IotDevice>(bindingsQuery.data)
    const row = rows.find((item) => item.deviceId === deviceId)
    if (!row) return undefined
    const plotId = (row as unknown as { plotId?: string }).plotId
    if (!plotId) return undefined
    return plots.find((item) => item.plotId === plotId)?.plotName ?? plotId
  }, [bindingsQuery.data, deviceId, plots])

  /** 可选指标（来自遥测数据去重） */
  const metricOptions = useMemo(() => {
    const set = new Set<string>()
    ;(seriesQuery.data ?? []).forEach((row) => {
      const key = normalizeMetric(row.metric)
      if (key) set.add(key)
    })
    return Array.from(set)
  }, [seriesQuery.data])

  /** 曲线配置 */
  const chartOption = useMemo<EChartsOption>(() => {
    const rows = (seriesQuery.data ?? [])
      .slice()
      .sort((a, b) => dayjs(a.readTime).valueOf() - dayjs(b.readTime).valueOf())
    const times = Array.from(new Set(rows.map((row) => dayjs(row.readTime).format('MM-DD HH:mm'))))
    const groups = new Map<string, Map<string, number>>()
    rows.forEach((row) => {
      const key = normalizeMetric(row.metric)
      const time = dayjs(row.readTime).format('MM-DD HH:mm')
      const map = groups.get(key) ?? new Map<string, number>()
      map.set(time, Number(row.metricValue))
      groups.set(key, map)
    })
    return {
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0 },
      grid: { left: 56, right: 24, top: 24, bottom: 48 },
      xAxis: { type: 'category', data: times, boundaryGap: false },
      yAxis: { type: 'value', name: '指标值' },
      series: Array.from(groups.entries()).map(([key, map]) => ({
        name: metricLabel(key),
        type: 'line' as const,
        smooth: true,
        connectNulls: true,
        data: times.map((time) => map.get(time) ?? null),
      })),
    }
  }, [seriesQuery.data])

  /** 遥测明细行 */
  const telemetryRows = useMemo(
    () =>
      (seriesQuery.data ?? [])
        .slice()
        .sort((a, b) => dayjs(b.readTime).valueOf() - dayjs(a.readTime).valueOf())
        .map((row) => ({
          key: row.readingId || `${row.metric}-${row.readTime}`,
          time: dayjs(row.readTime).format('YYYY-MM-DD HH:mm'),
          metric: metricLabel(row.metric),
          value: Number(row.metricValue),
          unit: row.unit ?? '-',
          quality: Number(row.qualityFlag ?? 1) === 1,
        })),
    [seriesQuery.data],
  )

  /** 更新设备档案 */
  const updateMutation = useMutation({
    mutationFn: (values: DeviceFormValues) => updateDevice(deviceId, values),
    onSuccess: () => {
      message.success('设备信息已更新')
      setEditOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['iot-device', deviceId] })
    },
    onError: (error: Error) => {
      message.error(error.message || '设备信息更新失败')
    },
  })

  /**
   * 下发控制指令（POST /iot/devices/{deviceId}/commands）。
   *
   * 服务端按设备在线状态落库终态并同步返回：在线 → SUCCESS，离线 → FAILED「送达失败」。
   * 页面不做任何模拟，直接按服务端返回的状态提示。
   */
  const commandMutation = useMutation({
    mutationFn: (values: CommandFormValues) =>
      sendCommand(deviceId, {
        commandType: values.type,
        params: values.params,
        operator: values.operator,
      }),
    onSuccess: (record: IotCommand) => {
      setCommandOpen(false)
      commandForm.resetFields()
      void queryClient.invalidateQueries({ queryKey: ['iot-device-commands', deviceId] })
      const meta = commandStatusMeta(record.status)
      const receipt = record.receipt ? `：${record.receipt}` : ''
      if (record.status === 'SUCCESS') {
        message.success(`指令「${record.commandType}」${meta.label}${receipt}`)
      } else if (record.status === 'FAILED') {
        message.error(`指令「${record.commandType}」${meta.label}${receipt}`)
      } else {
        message.info(`指令「${record.commandType}」${meta.label}，等待设备回执`)
      }
    },
    onError: (error: Error) => {
      message.error(error.message || '指令下发失败，请稍后重试')
    },
  })

  /** 登记维修记录（POST /iot/devices/{deviceId}/maintenances） */
  const maintenanceMutation = useMutation({
    mutationFn: (values: MaintenanceFormValues) =>
      createIotMaintenance(deviceId, {
        maintainType: values.maintainType,
        content: values.content,
        operator: values.operator,
        result: values.result,
        maintainAt: values.time.format('YYYY-MM-DD HH:mm:ss'),
      }),
    onSuccess: () => {
      setMaintainOpen(false)
      maintainForm.resetFields()
      void queryClient.invalidateQueries({ queryKey: ['iot-device-maintenances', deviceId] })
      message.success('维修记录已登记')
    },
    onError: (error: Error) => {
      message.error(error.message || '维修记录登记失败，请稍后重试')
    },
  })

  if (deviceQuery.isLoading) {
    return (
      <div style={{ padding: 24 }}>
        <Card>
          <Skeleton active paragraph={{ rows: 8 }} />
        </Card>
      </div>
    )
  }

  if (deviceQuery.isError || !device) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          type="error"
          showIcon
          message="设备详情加载失败"
          description={(deviceQuery.error as Error)?.message ?? '设备不存在或已解绑'}
          action={
            <Button size="small" onClick={() => navigate('/production/iot')}>
              返回设备列表
            </Button>
          }
        />
      </div>
    )
  }

  const statusMeta = onlineStatusMeta(statusOf(device))
  const latest = latestQuery.data ?? null

  return (
    <div style={{ padding: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Space size={12}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/production/iot')}>
            返回
          </Button>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {device.deviceName || device.deviceCode || '设备详情'}
          </Typography.Title>
          <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
        </Space>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: ['iot-device', deviceId] })
              void queryClient.invalidateQueries({ queryKey: ['iot-device-series', deviceId, metric] })
              void queryClient.invalidateQueries({ queryKey: ['iot-device-latest', deviceId] })
            }}
          >
            刷新
          </Button>
          <Button
            icon={<EditOutlined />}
            onClick={() => {
              deviceForm.setFieldsValue({
                deviceName: device.deviceName,
                model: device.model,
                manufacturer: device.manufacturer,
                firmwareVersion: device.firmwareVersion,
                location: device.location,
                longitude: device.longitude,
                latitude: device.latitude,
              })
              setEditOpen(true)
            }}
          >
            编辑
          </Button>
          <Button type="primary" icon={<SendOutlined />} onClick={() => setCommandOpen(true)}>
            下发指令
          </Button>
        </Space>
      </Row>

      {statusOf(device) !== 1 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={`设备当前${statusMeta.label}，控制指令可能无法送达（服务端将判定为「送达失败」），建议先排查设备供电与网络`}
        />
      )}

      <Card title="设备信息" style={{ marginBottom: 16 }}>
        <Descriptions bordered size="small" column={{ xs: 1, sm: 2, lg: 3 }}>
          <Descriptions.Item label="设备编码">{device.deviceCode || '-'}</Descriptions.Item>
          <Descriptions.Item label="设备名称">{device.deviceName || '-'}</Descriptions.Item>
          <Descriptions.Item label="设备ID">{device.deviceId}</Descriptions.Item>
          <Descriptions.Item label="型号">{device.model || '-'}</Descriptions.Item>
          <Descriptions.Item label="厂商">{device.manufacturer || '-'}</Descriptions.Item>
          <Descriptions.Item label="固件版本">{device.firmwareVersion || '-'}</Descriptions.Item>
          <Descriptions.Item label="所属农场">{device.farmName || device.farmId || '-'}</Descriptions.Item>
          <Descriptions.Item label="关联地块">{boundPlotName ?? '未绑定'}</Descriptions.Item>
          <Descriptions.Item label="安装位置">{device.location || '-'}</Descriptions.Item>
          <Descriptions.Item label="经纬度">
            {typeof device.longitude === 'number' && typeof device.latitude === 'number'
              ? `${device.longitude}, ${device.latitude}`
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="电量">
            {typeof device.battery === 'number' ? `${device.battery}%` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="信号强度">
            {typeof device.signal === 'number' ? `${device.signal} dBm` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="最近心跳">
            {device.lastHeartbeatAt ? dayjs(device.lastHeartbeatAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {device.createdAt ? dayjs(device.createdAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">
            {device.updatedAt ? dayjs(device.updatedAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setSearchParams({ tab: key })}
          items={[
            {
              key: 'data',
              label: '实时数据',
              children: (
                <Space direction="vertical" style={{ width: '100%' }} size={16}>
                  <Row gutter={[12, 12]}>
                    <Col xs={24} sm={12} lg={6}>
                      <Card size="small">
                        <Statistic
                          title={latest ? metricLabel(latest.metric) : '最新指标'}
                          value={latest ? Number(Number(latest.metricValue).toFixed(2)) : '-'}
                          suffix={latest?.unit ?? ''}
                        />
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {latest ? dayjs(latest.readTime).format('YYYY-MM-DD HH:mm') : '暂无读数'}
                        </Typography.Text>
                      </Card>
                    </Col>
                    <Col xs={24} sm={12} lg={6}>
                      <Card size="small">
                        <Statistic
                          title="数据质量"
                          value={latest ? (Number(latest.qualityFlag ?? 1) === 1 ? '正常' : '异常') : '-'}
                          valueStyle={{
                            color:
                              latest && Number(latest.qualityFlag ?? 1) !== 1 ? '#cf1322' : '#3f8600',
                          }}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} sm={12} lg={6}>
                      <Card size="small">
                        <Statistic title="遥测点数" value={telemetryRows.length} suffix="条" />
                      </Card>
                    </Col>
                    <Col xs={24} sm={12} lg={6}>
                      <Card size="small">
                        <Statistic
                          title="运行状态"
                          value={statusMeta.label}
                          valueStyle={{ color: statusMeta.color === 'green' ? '#3f8600' : '#cf1322' }}
                        />
                      </Card>
                    </Col>
                  </Row>

                  <Card
                    size="small"
                    title="遥测曲线"
                    extra={
                      <Space>
                        <Select
                          allowClear
                          style={{ width: 180 }}
                          placeholder="全部指标"
                          value={metric}
                          options={metricOptions.map((item) => ({ value: item, label: metricLabel(item) }))}
                          onChange={setMetric}
                        />
                        <Button
                          icon={<ReloadOutlined />}
                          onClick={() =>
                            void queryClient.invalidateQueries({
                              queryKey: ['iot-device-series', deviceId, metric],
                            })
                          }
                        >
                          刷新曲线
                        </Button>
                      </Space>
                    }
                  >
                    {seriesQuery.isLoading ? (
                      <Skeleton active paragraph={{ rows: 5 }} />
                    ) : telemetryRows.length === 0 ? (
                      <Empty description="该设备暂无遥测数据" />
                    ) : (
                      <ReactECharts option={chartOption} style={{ height: 300 }} notMerge />
                    )}
                  </Card>

                  <Table
                    size="small"
                    rowKey="key"
                    loading={seriesQuery.isLoading}
                    dataSource={telemetryRows}
                    pagination={{ pageSize: 8, showTotal: (value) => `共 ${value} 条` }}
                    locale={{ emptyText: <Empty description="暂无遥测明细" /> }}
                    columns={[
                      { title: '采集时间', dataIndex: 'time', key: 'time' },
                      { title: '指标', dataIndex: 'metric', key: 'metric' },
                      { title: '数值', dataIndex: 'value', key: 'value' },
                      { title: '单位', dataIndex: 'unit', key: 'unit' },
                      {
                        title: '数据质量',
                        dataIndex: 'quality',
                        key: 'quality',
                        render: (value: boolean) => (
                          <Tag color={value ? 'green' : 'red'}>{value ? '正常' : '异常'}</Tag>
                        ),
                      },
                    ]}
                  />
                </Space>
              ),
            },
            {
              key: 'commands',
              label: `指令记录（${commands.length}）`,
              children: (
                <Space direction="vertical" style={{ width: '100%' }} size={12}>
                  <Space wrap>
                    <Button type="primary" icon={<SendOutlined />} onClick={() => setCommandOpen(true)}>
                      + 下发指令
                    </Button>
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={() =>
                        void queryClient.invalidateQueries({ queryKey: ['iot-device-commands', deviceId] })
                      }
                    >
                      刷新
                    </Button>
                    <Typography.Text type="secondary">
                      指令状态由服务端按设备在线状态（10 分钟心跳窗口）落库，非前端计算
                    </Typography.Text>
                  </Space>
                  <Table<IotCommand>
                    size="small"
                    rowKey="commandId"
                    loading={commandsQuery.isLoading}
                    dataSource={commands}
                    locale={{ emptyText: <Empty description="暂无指令记录" /> }}
                    pagination={false}
                    columns={[
                      { title: '指令单号', dataIndex: 'commandId', key: 'commandId' },
                      {
                        title: '下发时间',
                        dataIndex: 'sendAt',
                        key: 'sendAt',
                        render: (value?: string) => formatTime(value),
                      },
                      { title: '指令类型', dataIndex: 'commandType', key: 'commandType' },
                      {
                        title: '参数',
                        dataIndex: 'params',
                        key: 'params',
                        render: (value?: string) => value || '-',
                      },
                      {
                        title: '操作人',
                        dataIndex: 'operator',
                        key: 'operator',
                        render: (value?: string) => value || '-',
                      },
                      {
                        title: '状态',
                        dataIndex: 'status',
                        key: 'status',
                        render: (status: IotCommand['status']) => {
                          const meta = commandStatusMeta(status)
                          return <Tag color={meta.color}>{meta.label}</Tag>
                        },
                      },
                      {
                        title: '回执',
                        dataIndex: 'receipt',
                        key: 'receipt',
                        render: (value?: string) => value || '-',
                      },
                      {
                        title: '回执时间',
                        dataIndex: 'receiptAt',
                        key: 'receiptAt',
                        render: (value?: string) => formatTime(value),
                      },
                    ]}
                  />
                </Space>
              ),
            },
            {
              key: 'maintain',
              label: `维修记录（${maintenances.length}）`,
              children: (
                <Space direction="vertical" style={{ width: '100%' }} size={12}>
                  <Button
                    icon={<ToolOutlined />}
                    onClick={() => {
                      maintainForm.setFieldsValue({ time: dayjs(), maintainType: 'REPAIR' })
                      setMaintainOpen(true)
                    }}
                  >
                    + 登记维修
                  </Button>
                  {maintenances.length === 0 ? (
                    <Empty description="暂无维修记录" />
                  ) : (
                    <Timeline
                      items={maintenances.map((item) => ({
                        color: 'blue',
                        children: (
                          <Space direction="vertical" size={2}>
                            <Space wrap size={8}>
                              <Tag color="geekblue">{maintainTypeLabel(item.maintainType)}</Tag>
                              <Typography.Text strong>{item.content}</Typography.Text>
                              <Typography.Text type="secondary">{formatTime(item.maintainAt)}</Typography.Text>
                            </Space>
                            <Typography.Text>维修结果：{item.result || '-'}</Typography.Text>
                            <Typography.Text type="secondary">
                              操作人：{item.operator || '-'}
                            </Typography.Text>
                          </Space>
                        ),
                      }))}
                    />
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="下发控制指令"
        open={commandOpen}
        onCancel={() => setCommandOpen(false)}
        onOk={() => commandForm.submit()}
        confirmLoading={commandMutation.isPending}
        okText="下发"
        cancelText="取消"
        destroyOnClose
      >
        <Form<CommandFormValues>
          form={commandForm}
          layout="vertical"
          onFinish={(values) => commandMutation.mutate(values)}
          preserve={false}
        >
          <Form.Item name="type" label="指令类型" rules={[{ required: true, message: '请选择指令类型' }]}>
            <Select options={COMMAND_TYPES.map((item) => ({ value: item, label: item }))} />
          </Form.Item>
          <Form.Item name="params" label="指令参数">
            <Input placeholder="如：频率=5分钟 / 阀门=A区" />
          </Form.Item>
          <Form.Item name="operator" label="操作人" rules={[{ required: true, message: '请填写操作人' }]}>
            <Input placeholder="如：张三" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="登记维修记录"
        open={maintainOpen}
        onCancel={() => setMaintainOpen(false)}
        onOk={() => maintainForm.submit()}
        confirmLoading={maintenanceMutation.isPending}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form<MaintenanceFormValues>
          form={maintainForm}
          layout="vertical"
          onFinish={(values) => maintenanceMutation.mutate(values)}
          preserve={false}
        >
          <Form.Item name="time" label="维修时间" rules={[{ required: true, message: '请选择维修时间' }]}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="maintainType"
            label="维修类型"
            rules={[{ required: true, message: '请选择维修类型' }]}
          >
            <Select options={MAINTAIN_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item name="content" label="维修内容" rules={[{ required: true, message: '请填写维修内容' }]}>
            <Input.TextArea rows={2} placeholder="如：土壤传感器数据跳变，更换探头并重新校准" />
          </Form.Item>
          <Form.Item name="operator" label="操作人" rules={[{ required: true, message: '请填写操作人' }]}>
            <Input placeholder="如：李四" />
          </Form.Item>
          <Form.Item name="result" label="维修结果">
            <Input.TextArea rows={2} placeholder="如：更换探头并重新校准，数据恢复正常" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑设备信息"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={() => deviceForm.submit()}
        confirmLoading={updateMutation.isPending}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form<DeviceFormValues> form={deviceForm} layout="vertical" onFinish={(values) => updateMutation.mutate(values)} preserve={false}>
          <Form.Item name="deviceName" label="设备名称" rules={[{ required: true, message: '请填写设备名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="model" label="设备型号">
            <Input />
          </Form.Item>
          <Form.Item name="manufacturer" label="厂商">
            <Input />
          </Form.Item>
          <Form.Item name="firmwareVersion" label="固件版本">
            <Input />
          </Form.Item>
          <Form.Item name="location" label="安装位置">
            <Input />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="longitude" label="经度">
                <InputNumber precision={6} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="latitude" label="纬度">
                <InputNumber precision={6} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}
