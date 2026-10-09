/**
 * 页面名称：设备列表（IoT设备管理）
 * 路由路径：/production/iot
 * 所属模块：IoT设备管理
 * 原型来源：用户端原型 P21 iot
 *
 * 还原要点：
 * - 标题「📡 IoT设备管理」+ `+ 绑定设备`、`批量操作 ▾` 按钮
 * - 状态卡 4 项：在线 / 离线 / 故障 / 总计
 * - 筛选：状态（全部/在线/离线/故障）、类型、地块、关键字
 * - 表格列：复选框 | 设备名称 | 设备编码 | 类型 | 关联地块 | 状态 | 电量 | 最后上报 | 操作
 * - 在线设备操作 `配置 | 数据`，离线 / 故障设备操作 `配置 | 排查`
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Card,
  Col,
  Dropdown,
  Empty,
  Input,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ApiOutlined,
  DeleteOutlined,
  DownloadOutlined,
  PlusOutlined,
  ReloadOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import useFarmStore from '@/store/farm'
import {
  deleteDevice,
  deviceTypeLabel,
  heartbeatDevice,
  listBoundDevices,
  listDevices,
  onlineStatusMeta,
  unwrapList,
} from '@/api/iot'
import { listPlots } from '@/api/plots'
import type { IotDevice, Plot } from '@/types'

/** 设备状态筛选项 */
const STATUS_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: '在线' },
  { value: 2, label: '离线' },
  { value: 3, label: '故障' },
]

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
 * 读取设备绑定地块 ID（来自绑定关系或设备实体字段）。
 *
 * @param device 设备
 * @returns 地块 ID，无绑定返回 undefined
 */
function plotIdOf(device: IotDevice): string | undefined {
  const raw = device as unknown as { plotId?: string }
  return raw.plotId
}

/**
 * 格式化最后上报时间为相对时间。
 *
 * @param time 时间字符串
 * @returns 相对时间文案
 */
function formatRelative(time?: string): string {
  if (!time) return '从未上报'
  const target = dayjs(time)
  if (!target.isValid()) return '从未上报'
  const minutes = dayjs().diff(target, 'minute')
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  return `${Math.floor(hours / 24)}天前`
}

/**
 * 导出设备台账为 CSV。
 *
 * @param rows 设备行
 */
function exportCsv(rows: IotDevice[]): void {
  const header = '设备名称,设备编码,类型,关联地块,状态,电量,最后上报\n'
  const body = rows
    .map((row) =>
      [
        row.deviceName ?? '',
        row.deviceCode ?? '',
        deviceTypeLabel(row.deviceType),
        row.location ?? '',
        onlineStatusMeta(statusOf(row)).label,
        row.battery ?? '',
        row.lastHeartbeatAt ?? '',
      ].join(','),
    )
    .join('\n')
  const blob = new Blob([`${header}${body}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `设备台账_${dayjs().format('YYYYMMDDHHmmss')}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * IoT 设备列表页面
 *
 * 业务职责：维护设备台账、监控在线状态，支持筛选、批量操作与下钻到设备详情。
 *
 * @returns 页面内容
 */
export default function DeviceList(): JSX.Element {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { currentFarm } = useFarmStore()
  const farmId = currentFarm?.farmId

  /** 状态筛选 */
  const [statusFilter, setStatusFilter] = useState<number | undefined>(undefined)
  /** 类型筛选 */
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined)
  /** 地块筛选 */
  const [plotFilter, setPlotFilter] = useState<string | undefined>(undefined)
  /** 关键字 */
  const [keyword, setKeyword] = useState<string>('')
  /** 勾选的设备 */
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  /** 批量操作是否执行中 */
  const [batchLoading, setBatchLoading] = useState<boolean>(false)

  /** 设备列表 */
  const devicesQuery = useQuery({
    queryKey: ['iot-devices', farmId],
    queryFn: () => listDevices({ pageNum: 1, pageSize: 100, farmId }),
    retry: false,
  })

  /** 地块列表（关联地块名称映射） */
  const plotsQuery = useQuery({
    queryKey: ['iot-plots', farmId],
    queryFn: () => listPlots({ pageNum: 1, pageSize: 100, farmId }),
    retry: false,
  })
  const plots: Plot[] = useMemo(() => unwrapList<Plot>(plotsQuery.data), [plotsQuery.data])
  const plotNameMap = useMemo(() => {
    const map = new Map<string, string>()
    plots.forEach((item) => map.set(item.plotId, item.plotName))
    return map
  }, [plots])

  /** 设备 × 地块绑定关系 */
  const bindingsQuery = useQuery({
    queryKey: ['iot-bindings-all'],
    queryFn: () => listBoundDevices(),
    retry: false,
  })
  const bindingPlotMap = useMemo(() => {
    const map = new Map<string, string>()
    unwrapList<IotDevice>(bindingsQuery.data).forEach((row) => {
      const plotId = plotIdOf(row)
      if (plotId) map.set(row.deviceId, plotId)
    })
    return map
  }, [bindingsQuery.data])

  const devices: IotDevice[] = useMemo(
    () => unwrapList<IotDevice>(devicesQuery.data),
    [devicesQuery.data],
  )

  /** 设备类型下拉（按实际台账去重，避免与后端字典不一致） */
  const typeOptions = useMemo(() => {
    const set = new Set<string>()
    devices.forEach((item) => {
      const label = deviceTypeLabel(item.deviceType)
      if (label && label !== '-') set.add(label)
    })
    return Array.from(set).map((label) => ({ value: label, label }))
  }, [devices])

  /** 过滤后的设备 */
  const filteredDevices = useMemo(
    () =>
      devices.filter((device) => {
        if (statusFilter && statusOf(device) !== statusFilter) return false
        if (typeFilter && deviceTypeLabel(device.deviceType) !== typeFilter) return false
        const plotId = bindingPlotMap.get(device.deviceId) ?? plotIdOf(device)
        if (plotFilter && plotId !== plotFilter) return false
        if (keyword) {
          const text = `${device.deviceName ?? ''}${device.deviceCode ?? ''}`
          if (!text.toLowerCase().includes(keyword.toLowerCase())) return false
        }
        return true
      }),
    [devices, statusFilter, typeFilter, plotFilter, keyword, bindingPlotMap],
  )

  /** 状态统计 */
  const stats = useMemo(() => {
    const online = devices.filter((item) => statusOf(item) === 1).length
    const offline = devices.filter((item) => statusOf(item) === 2).length
    const fault = devices.filter((item) => statusOf(item) === 3).length
    return { online, offline, fault, total: devices.length }
  }, [devices])

  /** 批量心跳检测 */
  const runBatchHeartbeat = async (): Promise<void> => {
    if (selectedIds.length === 0) {
      message.warning('请先勾选需要检测的设备')
      return
    }
    setBatchLoading(true)
    try {
      const results = await Promise.allSettled(selectedIds.map((id) => heartbeatDevice(id)))
      const success = results.filter((item) => item.status === 'fulfilled').length
      message.success(`批量心跳完成：成功 ${success} 台 / 共 ${selectedIds.length} 台`)
      void queryClient.invalidateQueries({ queryKey: ['iot-devices'] })
    } finally {
      setBatchLoading(false)
    }
  }

  /** 批量删除 */
  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => deleteDevice(id)))
      return ids.length
    },
    onSuccess: (count: number) => {
      message.success(`已删除 ${count} 台设备`)
      setSelectedIds([])
      void queryClient.invalidateQueries({ queryKey: ['iot-devices'] })
    },
    onError: (error: Error) => {
      message.error(error.message || '批量删除失败，请稍后重试')
    },
  })

  /** 表格列定义 */
  const columns: ColumnsType<IotDevice> = [
    { title: '设备名称', dataIndex: 'deviceName', key: 'deviceName', render: (value?: string) => value || '-' },
    { title: '设备编码', dataIndex: 'deviceCode', key: 'deviceCode', render: (value?: string) => value || '-' },
    {
      title: '类型',
      dataIndex: 'deviceType',
      key: 'deviceType',
      render: (value: IotDevice['deviceType']) => <Tag>{deviceTypeLabel(value)}</Tag>,
    },
    {
      title: '关联地块',
      key: 'plot',
      render: (_value: unknown, row: IotDevice) => {
        const plotId = bindingPlotMap.get(row.deviceId) ?? plotIdOf(row)
        return plotId ? plotNameMap.get(plotId) ?? plotId : <Typography.Text type="secondary">未绑定</Typography.Text>
      },
    },
    {
      title: '状态',
      key: 'status',
      render: (_value: unknown, row: IotDevice) => {
        const meta = onlineStatusMeta(statusOf(row))
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: '电量',
      dataIndex: 'battery',
      key: 'battery',
      render: (value?: number) => (typeof value === 'number' ? `${value}%` : '-'),
    },
    {
      title: '最后上报',
      dataIndex: 'lastHeartbeatAt',
      key: 'lastHeartbeatAt',
      render: (value?: string) => formatRelative(value),
    },
    {
      title: '操作',
      key: 'action',
      render: (_value: unknown, row: IotDevice) => {
        const status = statusOf(row)
        return (
          <Space size={4}>
            <Button type="link" size="small" onClick={() => navigate(`/production/iot/${row.deviceId}`)}>
              配置
            </Button>
            {status === 1 ? (
              <Button
                type="link"
                size="small"
                icon={<ApiOutlined />}
                onClick={() => navigate(`/production/iot/${row.deviceId}?tab=data`)}
              >
                数据
              </Button>
            ) : (
              <Button
                type="link"
                size="small"
                icon={<ToolOutlined />}
                onClick={() => navigate(`/production/iot/${row.deviceId}?tab=maintain`)}
              >
                排查
              </Button>
            )}
          </Space>
        )
      },
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          📡 IoT设备管理
        </Typography.Title>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: ['iot-devices'] })
              void queryClient.invalidateQueries({ queryKey: ['iot-bindings-all'] })
            }}
          >
            刷新
          </Button>
          <Dropdown
            menu={{
              items: [
                { key: 'heartbeat', label: `批量心跳检测（${selectedIds.length}）` },
                { key: 'export', label: '导出设备台账' },
              ],
              onClick: ({ key }) => {
                if (key === 'heartbeat') void runBatchHeartbeat()
                if (key === 'export') {
                  if (filteredDevices.length === 0) {
                    message.warning('当前没有可导出的设备')
                    return
                  }
                  exportCsv(filteredDevices)
                  message.success(`已导出 ${filteredDevices.length} 台设备`)
                }
              },
            }}
          >
            <Button loading={batchLoading}>批量操作 ▾</Button>
          </Dropdown>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/production/iot/bindings')}>
            绑定设备
          </Button>
        </Space>
      </Row>

      {selectedIds.length > 0 && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={`已选择 ${selectedIds.length} 台设备`}
          action={
            <Popconfirm
              title={`确认删除选中的 ${selectedIds.length} 台设备？`}
              okText="删除"
              cancelText="取消"
              onConfirm={() => deleteMutation.mutate(selectedIds)}
            >
              <Button size="small" danger icon={<DeleteOutlined />}>
                批量删除
              </Button>
            </Popconfirm>
          }
        />
      )}

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} lg={6}>
          <Card>
            <Statistic
              title="在线"
              value={stats.online}
              valueStyle={{ color: '#3f8600' }}
              suffix={`/ ${stats.total}`}
              prefix={<ApiOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card>
            <Statistic title="离线" value={stats.offline} valueStyle={{ color: 'rgba(0,0,0,0.45)' }} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card>
            <Statistic
              title="故障"
              value={stats.fault}
              valueStyle={{ color: stats.fault > 0 ? '#cf1322' : undefined }}
            />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card>
            <Statistic title="总计" value={stats.total} suffix="台" prefix={<DownloadOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap size={12}>
          <Select
            allowClear
            style={{ width: 140 }}
            placeholder="全部状态"
            value={statusFilter}
            options={STATUS_OPTIONS}
            onChange={setStatusFilter}
          />
          <Select
            allowClear
            style={{ width: 160 }}
            placeholder="全部类型"
            value={typeFilter}
            options={typeOptions}
            onChange={setTypeFilter}
          />
          <Select
            allowClear
            style={{ width: 180 }}
            placeholder="全部地块"
            value={plotFilter}
            options={plots.map((item) => ({ value: item.plotId, label: item.plotName }))}
            onChange={setPlotFilter}
          />
          <Input.Search
            allowClear
            style={{ width: 220 }}
            placeholder="设备名称 / 编码"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </Space>
      </Card>

      {devicesQuery.isError && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="设备列表加载失败"
          description={(devicesQuery.error as Error)?.message ?? '请稍后重试'}
        />
      )}

      <Card>
        <Table<IotDevice>
          rowKey="deviceId"
          loading={devicesQuery.isLoading}
          dataSource={filteredDevices}
          columns={columns}
          locale={{ emptyText: <Empty description="暂无设备，点击「绑定设备」添加" /> }}
          rowSelection={{
            selectedRowKeys: selectedIds,
            onChange: (keys) => setSelectedIds(keys as string[]),
          }}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (value) => `共 ${value} 台` }}
        />
      </Card>
    </div>
  )
}
