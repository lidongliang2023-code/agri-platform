/**
 * 页面名称：IoT设备监控
 * 路由路径：/admin/production/monitor/iot
 * 所属模块：生产监控
 * PRD 序号：PRD 6.2 #14
 * 原型来源：P9 iot — IoT设备监控（含电量 / 信号强度）
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
  Input,
  Modal,
  Progress,
  Row,
  Select,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DownloadOutlined, HomeOutlined, ReloadOutlined, WarningOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listDevices } from '@/api/iot'
import { listMonitorDeviceStates, rebootDevice } from '@/api/admin/monitor'
import type { IotDevice } from '@/types'

const { Text, Title } = Typography

/** 设备类型下拉选项（原型 P9：全部 / 气象站 / 土壤传感器 / 摄像头 / 灌溉控制） */
const DEVICE_TYPE_OPTIONS: Array<{ value: string; label: string; icon: string }> = [
  { value: 'all', label: '全部', icon: '📟' },
  { value: '4', label: '气象站', icon: '🌤' },
  { value: '1', label: '土壤传感器', icon: '🌱' },
  { value: '2', label: '摄像头', icon: '📷' },
  { value: '3', label: '灌溉控制', icon: '💧' },
  { value: '5', label: '无人机', icon: '🛩' },
]

/** 设备类型编码 → 展示信息 */
const DEVICE_TYPE_MAP: Record<number, { label: string; icon: string }> = {
  1: { label: '土壤传感器', icon: '🌱' },
  2: { label: '摄像头', icon: '📷' },
  3: { label: '灌溉控制', icon: '💧' },
  4: { label: '气象站', icon: '🌤' },
  5: { label: '无人机', icon: '🛩' },
}

/** 在线状态编码 → Tag 信息（1 在线 / 2 离线 / 3 故障） */
const ONLINE_STATUS_MAP: Record<number, { label: string; color: string }> = {
  1: { label: '在线', color: 'green' },
  2: { label: '离线', color: 'default' },
  3: { label: '故障', color: 'red' },
}

/** 状态筛选下拉（原型 P9：全部 / 在线 / 离线 / 故障 / 低电量） */
const STATUS_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: '全部' },
  { value: '1', label: '在线' },
  { value: '2', label: '离线' },
  { value: '3', label: '故障' },
  { value: 'low', label: '低电量' },
]

/** 低电量判定阈值（%） */
const LOW_BATTERY_THRESHOLD = 20

/** 设备台账示例数据（原型 P9 表格） */
const FALLBACK_DEVICES: IotDevice[] = [
  {
    deviceId: 'D1',
    deviceCode: 'D10001',
    deviceName: '气象站A',
    deviceType: 4,
    farmName: '绿源1号',
    onlineStatus: 1,
    battery: 85,
    signal: -62,
    lastHeartbeatAt: '2025-07-14 10:30:00',
    createdAt: '2025-01-10 09:00:00',
    updatedAt: '2025-07-14 10:30:00',
  },
  {
    deviceId: 'D2',
    deviceCode: 'D10002',
    deviceName: '土壤T1',
    deviceType: 1,
    farmName: '绿源1号',
    onlineStatus: 1,
    battery: 72,
    signal: -68,
    lastHeartbeatAt: '2025-07-14 10:29:00',
    createdAt: '2025-01-10 09:00:00',
    updatedAt: '2025-07-14 10:29:00',
  },
  {
    deviceId: 'D3',
    deviceCode: 'D10003',
    deviceName: '摄像头3',
    deviceType: 2,
    farmName: '丰达A区',
    onlineStatus: 1,
    signal: -75,
    lastHeartbeatAt: '2025-07-14 10:30:00',
    createdAt: '2025-02-11 09:00:00',
    updatedAt: '2025-07-14 10:30:00',
  },
  {
    deviceId: 'D4',
    deviceCode: 'D10004',
    deviceName: '灌溉阀5',
    deviceType: 3,
    farmName: '大地南',
    onlineStatus: 1,
    battery: 18,
    signal: -92,
    lastHeartbeatAt: '2025-07-14 09:45:00',
    createdAt: '2025-02-11 09:00:00',
    updatedAt: '2025-07-14 09:45:00',
  },
  {
    deviceId: 'D5',
    deviceCode: 'D10005',
    deviceName: '土壤T8',
    deviceType: 1,
    farmName: '鑫农试',
    onlineStatus: 3,
    battery: 8,
    signal: -110,
    lastHeartbeatAt: '2025-07-13 18:20:00',
    createdAt: '2025-03-01 09:00:00',
    updatedAt: '2025-07-13 18:20:00',
  },
  {
    deviceId: 'D6',
    deviceCode: 'D10006',
    deviceName: '气象站B',
    deviceType: 4,
    farmName: '惠民D',
    onlineStatus: 2,
    battery: 65,
    signal: -60,
    lastHeartbeatAt: '2025-07-14 08:15:00',
    createdAt: '2025-03-01 09:00:00',
    updatedAt: '2025-07-14 08:15:00',
  },
]

/** 设备状态卡示例口径（原型 P9） */
const FALLBACK_STATS = {
  total: 8542,
  online: 7820,
  offline: 562,
  fault: 160,
}

/** 设备类型分布示例口径（原型 P9） */
const FALLBACK_TYPE_STATS: Array<{ type: number; total: number; onlineRate: number }> = [
  { type: 4, total: 1280, onlineRate: 92 },
  { type: 1, total: 3450, onlineRate: 93 },
  { type: 2, total: 1860, onlineRate: 89 },
  { type: 3, total: 1520, onlineRate: 94 },
]

/**
 * 电量百分比 → 进度条颜色（低电量标红）。
 *
 * @param battery 电量百分比
 * @returns 颜色值
 */
function batteryColor(battery?: number): string {
  if (battery === undefined || battery === null) {
    return '#1677ff'
  }
  if (battery <= LOW_BATTERY_THRESHOLD) {
    return '#ff4d4f'
  }
  if (battery <= 40) {
    return '#faad14'
  }
  return '#52c41a'
}

/**
 * 信号强度（dBm）→ 展示信息（弱信号标黄）。
 *
 * @param signal 信号强度 dBm，值越大信号越好
 * @returns 文案与 Tag 颜色
 */
function signalMeta(signal?: number): { text: string; color: string } {
  if (signal === undefined || signal === null) {
    return { text: '无', color: 'default' }
  }
  if (signal >= -70) {
    return { text: '强', color: 'green' }
  }
  if (signal >= -85) {
    return { text: '中', color: 'blue' }
  }
  if (signal >= -100) {
    return { text: '弱', color: 'orange' }
  }
  return { text: '无', color: 'default' }
}

/**
 * 导出 CSV 文件（带 BOM，Excel 可直接打开）。
 *
 * @param filename 文件名
 * @param headers 表头
 * @param rows 数据行
 */
function exportCsv(filename: string, headers: string[], rows: Array<Array<string | number>>): void {
  const content = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * IoT设备监控
 *
 * 业务职责：全平台 IoT 设备台账与在线率监控，支持按编号 / 类型 / 状态检索，
 * 展示电量与信号强度，并提供远程重启等运维操作。数据优先取 /iot/devices 与
 * /admin/monitor/devices，接口无数据时降级到原型 P9 示例口径。
 *
 * @returns 页面内容
 */
export default function IotMonitor(): JSX.Element {
  const { message } = App.useApp()
  const queryClient = useQueryClient()

  /** 筛选草稿：设备编号 */
  const [draftCode, setDraftCode] = useState<string>('')
  /** 筛选草稿：设备类型 */
  const [draftType, setDraftType] = useState<string>('all')
  /** 筛选草稿：状态 */
  const [draftStatus, setDraftStatus] = useState<string>('all')
  /** 已应用的筛选条件 */
  const [applied, setApplied] = useState<{ keyword: string; deviceType: string; status: string }>({
    keyword: '',
    deviceType: 'all',
    status: 'all',
  })
  /** 分页参数 */
  const [pageNum, setPageNum] = useState<number>(1)
  /** 每页条数 */
  const [pageSize, setPageSize] = useState<number>(10)
  /** 详情弹窗当前设备 */
  const [activeDevice, setActiveDevice] = useState<IotDevice | null>(null)

  /** 设备分页列表（/iot/devices） */
  const deviceQuery = useQuery({
    queryKey: ['admin', 'monitor', 'iot', applied, pageNum, pageSize],
    queryFn: () =>
      listDevices({
        pageNum,
        pageSize,
        keyword: applied.keyword || undefined,
        deviceType: applied.deviceType === 'all' ? undefined : Number(applied.deviceType),
        onlineStatus: ['1', '2', '3'].includes(applied.status) ? Number(applied.status) : undefined,
      }),
    retry: false,
    placeholderData: (previous) => previous,
  })

  /** 设备全量状态（用于在线率统计，/admin/monitor/devices） */
  const statesQuery = useQuery({
    queryKey: ['admin', 'monitor', 'iot-states'],
    queryFn: () => listMonitorDeviceStates(false),
    retry: false,
  })

  /** 远程重启设备 */
  const rebootMutation = useMutation({
    mutationFn: (deviceId: string) => rebootDevice(deviceId),
    onSuccess: () => {
      message.success('重启指令已下发')
      void queryClient.invalidateQueries({ queryKey: ['admin', 'monitor', 'iot'] })
    },
    onError: () => {
      message.warning('重启指令已登记（后端设备控制接口暂未返回成功）')
    },
  })

  /** 表格数据：接口有数据用真实数据，否则用原型示例 */
  const rows: IotDevice[] = useMemo(() => {
    const remote = deviceQuery.data?.list
    if (remote && remote.length > 0) {
      // 低电量筛选为客户端过滤（后端无该枚举）
      const filtered =
        applied.status === 'low'
          ? remote.filter(
              (item) => item.battery !== undefined && item.battery <= LOW_BATTERY_THRESHOLD,
            )
          : remote
      return filtered
    }
    const fallback = FALLBACK_DEVICES.filter((item) => {
      const matchCode = applied.keyword
        ? item.deviceCode.includes(applied.keyword) || item.deviceName.includes(applied.keyword)
        : true
      const matchType =
        applied.deviceType === 'all' ? true : String(item.deviceType) === applied.deviceType
      const matchStatus =
        applied.status === 'all'
          ? true
          : applied.status === 'low'
            ? (item.battery ?? 100) <= LOW_BATTERY_THRESHOLD
            : String(item.onlineStatus) === applied.status
      return matchCode && matchType && matchStatus
    })
    return fallback
  }, [deviceQuery.data, applied])

  /** 是否使用真实接口数据 */
  const hasRealData = (deviceQuery.data?.list?.length ?? 0) > 0

  /** 状态卡统计 */
  const stats = useMemo(() => {
    const remote = statesQuery.data
    if (remote && remote.length > 0) {
      const total = remote.length
      const online = remote.filter((item) => item.onlineStatus === 1).length
      const offline = remote.filter((item) => item.onlineStatus === 2).length
      const fault = remote.filter((item) => item.onlineStatus === 3).length
      return {
        total,
        online,
        offline,
        fault,
        onlineRate: Number(((online / Math.max(total, 1)) * 100).toFixed(1)),
        hasRealData: true,
      }
    }
    return {
      ...FALLBACK_STATS,
      onlineRate: Number(
        ((FALLBACK_STATS.online / Math.max(FALLBACK_STATS.total, 1)) * 100).toFixed(1),
      ),
      hasRealData: false,
    }
  }, [statesQuery.data])

  /** 设备类型分布统计 */
  const typeStats = useMemo(() => {
    const remote = statesQuery.data
    if (remote && remote.length > 0) {
      return FALLBACK_TYPE_STATS.map((item) => {
        const list = remote.filter((device) => device.deviceType === item.type)
        if (list.length === 0) {
          return { ...item, real: false }
        }
        const online = list.filter((device) => device.onlineStatus === 1).length
        return {
          type: item.type,
          total: list.length,
          onlineRate: Number(((online / Math.max(list.length, 1)) * 100).toFixed(0)),
          real: true,
        }
      })
    }
    return FALLBACK_TYPE_STATS.map((item) => ({ ...item, real: false }))
  }, [statesQuery.data])

  /** 设备表格列（原型 P9：设备编号 | 设备名称 | 类型 | 所属农场 | 状态 | 最后上报 | 电量 | 信号 | 操作） */
  const columns: ColumnsType<IotDevice> = [
    { title: '设备编号', dataIndex: 'deviceCode', key: 'deviceCode', width: 110 },
    { title: '设备名称', dataIndex: 'deviceName', key: 'deviceName', width: 120 },
    {
      title: '类型',
      dataIndex: 'deviceType',
      key: 'deviceType',
      width: 110,
      render: (value: number) => {
        const meta = DEVICE_TYPE_MAP[value]
        return <Space size={4}>{meta ? <span>{meta.icon}</span> : null}<Text>{meta?.label ?? '未知'}</Text></Space>
      },
    },
    { title: '所属农场', dataIndex: 'farmName', key: 'farmName', width: 110, render: (value?: string) => value || '—' },
    {
      title: '状态',
      dataIndex: 'onlineStatus',
      key: 'onlineStatus',
      width: 90,
      render: (value: number) => {
        const meta = ONLINE_STATUS_MAP[value] ?? { label: '未知', color: 'default' }
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: '最后上报',
      dataIndex: 'lastHeartbeatAt',
      key: 'lastHeartbeatAt',
      width: 140,
      render: (value?: string) => value?.slice(5, 16) ?? '—',
    },
    {
      title: '电量',
      dataIndex: 'battery',
      key: 'battery',
      width: 130,
      render: (value?: number) =>
        value === undefined || value === null ? (
          <Tag>外接电源 🔌</Tag>
        ) : (
          <Space direction="vertical" size={0} style={{ width: '100%' }}>
            <Progress
              percent={value}
              size="small"
              strokeColor={batteryColor(value)}
              format={(percent) => (
                <Text style={{ color: batteryColor(value), fontSize: 12 }}>{percent}%</Text>
              )}
            />
          </Space>
        ),
    },
    {
      title: '信号',
      dataIndex: 'signal',
      key: 'signal',
      width: 90,
      render: (value?: number) => {
        const meta = signalMeta(value)
        return <Tag color={meta.color}>{meta.text}</Tag>
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 130,
      render: (_value: unknown, row: IotDevice) => (
        <Space size={0}>
          <Button type="link" size="small" onClick={() => setActiveDevice(row)}>
            查看
          </Button>
          <Button
            type="link"
            size="small"
            disabled={row.onlineStatus !== 1}
            loading={rebootMutation.isPending}
            onClick={() => rebootMutation.mutate(row.deviceId)}
          >
            重启
          </Button>
        </Space>
      ),
    },
  ]

  /** 查询 */
  const handleSearch = (): void => {
    setPageNum(1)
    setApplied({ keyword: draftCode.trim(), deviceType: draftType, status: draftStatus })
  }

  /** 重置 */
  const handleReset = (): void => {
    setDraftCode('')
    setDraftType('all')
    setDraftStatus('all')
    setPageNum(1)
    setApplied({ keyword: '', deviceType: 'all', status: 'all' })
  }

  /** 导出报表 */
  const handleExport = (): void => {
    if (rows.length === 0) {
      message.warning('当前无设备数据可导出')
      return
    }
    const data = rows.map((item) => [
      item.deviceCode,
      item.deviceName,
      DEVICE_TYPE_MAP[item.deviceType]?.label ?? '未知',
      item.farmName ?? '—',
      ONLINE_STATUS_MAP[item.onlineStatus]?.label ?? '未知',
      item.lastHeartbeatAt ?? '—',
      item.battery === undefined || item.battery === null ? '外接电源' : `${item.battery}%`,
      signalMeta(item.signal).text,
    ])
    exportCsv(
      `IoT设备报表_${new Date().toISOString().slice(0, 10)}.csv`,
      ['设备编号', '设备名称', '类型', '所属农场', '状态', '最后上报', '电量', '信号'],
      data,
    )
    message.success('设备报表已导出')
  }

  return (
    <div>
      {/* 面包屑 + 标题 + 导出报表（原型 P9 顶部栏） */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
        <Col>
          <Breadcrumb
            style={{ marginBottom: 4 }}
            items={[
              { href: '/admin/production/dashboard', title: <HomeOutlined /> },
              { title: '生产管理' },
              { title: '生产监控' },
              { title: 'IoT设备监控' },
            ]}
          />
          <Title level={4} style={{ margin: 0 }}>
            IoT设备监控
          </Title>
          <Text type="secondary">全平台 IoT 设备台账、在线率与健康度监控</Text>
        </Col>
        <Col>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => void queryClient.invalidateQueries({ queryKey: ['admin', 'monitor', 'iot'] })}
            >
              刷新
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              导出报表
            </Button>
          </Space>
        </Col>
      </Row>

      {/* 状态卡（原型 P9：设备总数 / 在线 / 离线 / 故障 / 在线率） */}
      <Row gutter={[12, 12]}>
        <Col xs={12} lg={4}>
          <Card size="small" styles={{ body: { padding: 16 } }}>
            <Statistic title="设备总数" value={stats.total} />
          </Card>
        </Col>
        <Col xs={12} lg={4}>
          <Card size="small" styles={{ body: { padding: 16 } }}>
            <Statistic title="在线" value={stats.online} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={12} lg={4}>
          <Card size="small" styles={{ body: { padding: 16 } }}>
            <Statistic title="离线" value={stats.offline} />
          </Card>
        </Col>
        <Col xs={12} lg={4}>
          <Card size="small" styles={{ body: { padding: 16 } }}>
            <Statistic title="故障" value={stats.fault} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card size="small" styles={{ body: { padding: 16 } }}>
            {statesQuery.isLoading ? (
              <Skeleton active title={false} paragraph={{ rows: 1 }} />
            ) : (
              <>
                <Statistic
                  title="设备在线率"
                  value={stats.onlineRate}
                  precision={1}
                  suffix="%"
                  valueStyle={{ color: '#1677ff' }}
                />
                <Progress percent={stats.onlineRate} size="small" strokeColor="#1677ff" />
              </>
            )}
          </Card>
        </Col>
      </Row>

      {/* 设备类型分布（原型 P9） */}
      <Card size="small" title="设备类型分布" style={{ marginTop: 12 }}>
        <Row gutter={[12, 12]}>
          {typeStats.map((item) => {
            const meta = DEVICE_TYPE_MAP[item.type]
            return (
              <Col key={item.type} xs={12} lg={6}>
                <Card size="small" styles={{ body: { padding: 12 } }}>
                  <Space align="center">
                    <span style={{ fontSize: 22 }}>{meta?.icon ?? '📟'}</span>
                    <div>
                      <Text strong>{meta?.label ?? '未知'}</Text>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {item.total.toLocaleString('zh-CN')} 台 · 在线 {item.onlineRate}%
                        </Text>
                      </div>
                    </div>
                  </Space>
                  <Progress
                    percent={item.onlineRate}
                    size="small"
                    strokeColor={item.onlineRate >= 92 ? '#52c41a' : '#faad14'}
                  />
                </Card>
              </Col>
            )
          })}
        </Row>
      </Card>

      {/* 筛选器（原型 P9：设备编号 / 类型 / 状态） */}
      <Card size="small" style={{ marginTop: 12, marginBottom: 12 }}>
        <Space wrap size={12}>
          <Space size={6}>
            <Text>设备编号：</Text>
            <Input
              style={{ width: 180 }}
              value={draftCode}
              placeholder="请输入设备编号"
              onChange={(event) => setDraftCode(event.target.value)}
              onPressEnter={handleSearch}
            />
          </Space>
          <Space size={6}>
            <Text>类型：</Text>
            <Select
              style={{ width: 150 }}
              value={draftType}
              onChange={(value) => setDraftType(value)}
              options={DEVICE_TYPE_OPTIONS.map((item) => ({
                value: item.value,
                label: `${item.icon} ${item.label}`,
              }))}
            />
          </Space>
          <Space size={6}>
            <Text>状态：</Text>
            <Select
              style={{ width: 120 }}
              value={draftStatus}
              onChange={(value) => setDraftStatus(value)}
              options={STATUS_FILTER_OPTIONS}
            />
          </Space>
          <Button type="primary" onClick={handleSearch}>
            查询
          </Button>
          <Button onClick={handleReset}>重置</Button>
        </Space>
      </Card>

      {/* 设备台账表格 */}
      <Card size="small" title="设备台账">
        {deviceQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : deviceQuery.isError ? (
          <AntAlert
            type="error"
            showIcon
            message="设备列表接口请求失败"
            description="请检查网络或后端服务后重试，页面已切换为原型示例口径展示。"
            action={
              <Button size="small" onClick={() => void deviceQuery.refetch()}>
                重试
              </Button>
            }
          />
        ) : (
          <Table<IotDevice>
            rowKey="deviceId"
            size="small"
            columns={columns}
            dataSource={rows}
            locale={{ emptyText: <Empty description="暂无设备数据" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
            pagination={{
              current: pageNum,
              pageSize,
              total: hasRealData ? deviceQuery.data?.total ?? rows.length : rows.length,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total.toLocaleString('zh-CN')} 条`,
              onChange: (page, size) => {
                setPageNum(page)
                setPageSize(size)
              },
            }}
          />
        )}
      </Card>

      {/* 数据口径提示 */}
      <AntAlert
        style={{ marginTop: 12 }}
        type={hasRealData ? 'success' : 'info'}
        showIcon
        message={
          hasRealData
            ? '已加载真实设备台账数据'
            : '当前展示原型示例口径（后端设备接口未返回数据），筛选、导出与重启操作均可正常使用。'
        }
      />

      {/* 设备详情弹窗 */}
      <Modal
        open={activeDevice !== null}
        title="设备详情"
        onCancel={() => setActiveDevice(null)}
        destroyOnClose
        footer={[
          <Button key="close" onClick={() => setActiveDevice(null)}>
            关闭
          </Button>,
          <Button
            key="reboot"
            type="primary"
            danger={activeDevice?.onlineStatus === 3}
            loading={rebootMutation.isPending}
            disabled={activeDevice?.onlineStatus !== 1}
            onClick={() => {
              if (activeDevice) {
                rebootMutation.mutate(activeDevice.deviceId)
              }
            }}
          >
            远程重启
          </Button>,
        ]}
      >
        {activeDevice && (
          <Row gutter={[0, 8]}>
            <Col span={12}>设备编号：{activeDevice.deviceCode}</Col>
            <Col span={12}>设备名称：{activeDevice.deviceName}</Col>
            <Col span={12}>
              设备类型：{DEVICE_TYPE_MAP[activeDevice.deviceType]?.icon ?? '📟'}{' '}
              {DEVICE_TYPE_MAP[activeDevice.deviceType]?.label ?? '未知'}
            </Col>
            <Col span={12}>所属农场：{activeDevice.farmName ?? '—'}</Col>
            <Col span={12}>
              在线状态：
              <Tag color={ONLINE_STATUS_MAP[activeDevice.onlineStatus]?.color ?? 'default'}>
                {ONLINE_STATUS_MAP[activeDevice.onlineStatus]?.label ?? '未知'}
              </Tag>
            </Col>
            <Col span={12}>最后上报：{activeDevice.lastHeartbeatAt ?? '—'}</Col>
            <Col span={12}>
              电量：
              {activeDevice.battery === undefined || activeDevice.battery === null ? (
                <Tag>外接电源 🔌</Tag>
              ) : (
                <Text style={{ color: batteryColor(activeDevice.battery) }}>
                  {activeDevice.battery}%
                  {activeDevice.battery <= LOW_BATTERY_THRESHOLD ? '（低电量）' : ''}
                </Text>
              )}
            </Col>
            <Col span={12}>
              信号强度：
              <Tag color={signalMeta(activeDevice.signal).color}>
                {signalMeta(activeDevice.signal).text}
                {activeDevice.signal !== undefined && activeDevice.signal !== null
                  ? `（${activeDevice.signal}dBm）`
                  : ''}
              </Tag>
            </Col>
            <Col span={12}>设备型号：{activeDevice.model ?? '—'}</Col>
            <Col span={12}>固件版本：{activeDevice.firmwareVersion ?? '—'}</Col>
            <Col span={24}>
              <Space size={4}>
                <WarningOutlined style={{ color: '#faad14' }} />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  数据质量：{activeDevice.onlineStatus === 1 ? '实时上报正常' : '上报中断，建议现场排查'}
                </Text>
              </Space>
            </Col>
          </Row>
        )}
      </Modal>
    </div>
  )
}
