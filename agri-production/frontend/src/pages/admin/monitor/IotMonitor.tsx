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

/**
 * 后端真实设备行。
 *
 * prod_iot_device 实际用 `onlineFlag`（1 在线 / 0 离线）表示在线状态，
 * 没有 `onlineStatus` 字段；`deviceType` 是字符串枚举（SENSOR / CONTROLLER …）。
 * 这里只在页面内做字段适配，不改共享类型定义，避免影响其它 IoT 页面。
 */
type RawIotDevice = IotDevice & {
  onlineFlag?: number
  deviceType?: IotDevice['deviceType'] | string
}

/** 后端设备类型字符串枚举 → 前端类型编码 */
const DEVICE_TYPE_CODE: Record<string, number> = {
  SENSOR: 1,
  CAMERA: 2,
  CONTROLLER: 3,
  WEATHER: 4,
  DRONE: 5,
}

/**
 * 归一化设备类型（后端给字符串枚举，前端用数字编码）。
 *
 * @param value 后端原始 deviceType
 * @returns 前端类型编码；无法识别时返回 undefined（展示「未知」）
 */
function resolveDeviceType(value: IotDevice['deviceType'] | string | undefined): number | undefined {
  if (typeof value === 'number') {
    return value
  }
  if (typeof value === 'string') {
    return DEVICE_TYPE_CODE[value]
  }
  return undefined
}

/**
 * 归一化在线状态：优先用 onlineStatus，缺失时按后端 onlineFlag 推导。
 *
 * @param device 设备行
 * @returns 1 在线 / 2 离线 / 3 故障；都取不到时返回 undefined
 */
function resolveOnlineStatus(device: RawIotDevice): number | undefined {
  if (typeof device.onlineStatus === 'number') {
    return device.onlineStatus
  }
  if (device.onlineFlag === 1) {
    return 1
  }
  if (device.onlineFlag === 0) {
    return 2
  }
  return undefined
}

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
    onError: (error) => {
      // 失败就是失败：不能把「没下发成功」说成「已登记」
      message.error(`重启指令下发失败：${(error as Error | null)?.message ?? '未知错误'}`)
    },
  })

  /**
   * 表格数据：只使用 /iot/devices 的真实返回，接口无数据就是空表。
   *
   * 低电量筛选为客户端过滤（后端无该枚举）：后端不返回 battery 时一律视为「非低电量」，
   * 不臆造电量值。
   */
  const rows: IotDevice[] = useMemo(() => {
    const remote = deviceQuery.data?.list ?? []
    if (applied.status !== 'low') {
      return remote
    }
    return remote.filter(
      (item) => item.battery !== undefined && item.battery <= LOW_BATTERY_THRESHOLD,
    )
  }, [deviceQuery.data, applied])

  /** 是否取到真实接口数据 */
  const hasRealData = (deviceQuery.data?.list?.length ?? 0) > 0

  /** 状态卡统计：后端无数据时全部为 null（卡片展示「—」） */
  const stats = useMemo(() => {
    const remote = (statesQuery.data ?? []) as RawIotDevice[]
    if (remote.length === 0) {
      return { total: null, online: null, offline: null, fault: null, onlineRate: null }
    }
    const total = remote.length
    const online = remote.filter((item) => resolveOnlineStatus(item) === 1).length
    const offline = remote.filter((item) => resolveOnlineStatus(item) === 2).length
    const fault = remote.filter((item) => resolveOnlineStatus(item) === 3).length
    return {
      total,
      online,
      offline,
      fault,
      onlineRate: Number(((online / Math.max(total, 1)) * 100).toFixed(1)),
    }
  }, [statesQuery.data])

  /** 设备类型分布：按后端真实设备分组统计，无数据则为空数组 */
  const typeStats = useMemo(() => {
    const remote = (statesQuery.data ?? []) as RawIotDevice[]
    const grouped = new Map<number, { type: number; total: number; online: number }>()
    remote.forEach((device) => {
      const type = resolveDeviceType(device.deviceType)
      if (type === undefined) {
        return
      }
      const bucket = grouped.get(type) ?? { type, total: 0, online: 0 }
      bucket.total += 1
      if (resolveOnlineStatus(device) === 1) {
        bucket.online += 1
      }
      grouped.set(type, bucket)
    })
    return [...grouped.values()]
      .sort((a, b) => a.type - b.type)
      .map((item) => ({
        type: item.type,
        total: item.total,
        onlineRate: Number(((item.online / Math.max(item.total, 1)) * 100).toFixed(0)),
      }))
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
      render: (value: IotDevice['deviceType'] | string) => {
        const meta = DEVICE_TYPE_MAP[resolveDeviceType(value) ?? 0]
        return <Space size={4}>{meta ? <span>{meta.icon}</span> : null}<Text>{meta?.label ?? '未知'}</Text></Space>
      },
    },
    { title: '所属农场', dataIndex: 'farmId', key: 'farmId', width: 110, render: (value?: string) => value || '—' },
    {
      title: '状态',
      dataIndex: 'onlineStatus',
      key: 'onlineStatus',
      width: 90,
      render: (_value: unknown, row: IotDevice) => {
        const status = resolveOnlineStatus(row as RawIotDevice)
        const meta = (status === undefined ? undefined : ONLINE_STATUS_MAP[status]) ?? {
          label: '未知',
          color: 'default',
        }
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
          // 后端不返回电量时不能臆断为「外接电源」，统一显示「—」
          <Text type="secondary">—</Text>
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
        if (value === undefined || value === null) {
          return <Text type="secondary">—</Text>
        }
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
            disabled={resolveOnlineStatus(row as RawIotDevice) !== 1}
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
    const raw = (row: IotDevice): RawIotDevice => row as RawIotDevice
    const data = rows.map((item) => [
      item.deviceCode,
      item.deviceName,
      DEVICE_TYPE_MAP[resolveDeviceType(raw(item).deviceType) ?? 0]?.label ?? '未知',
      item.farmId ?? '—',
      ONLINE_STATUS_MAP[resolveOnlineStatus(raw(item)) ?? 0]?.label ?? '未知',
      item.lastHeartbeatAt ?? '—',
      item.battery === undefined || item.battery === null ? '—' : `${item.battery}%`,
      item.signal === undefined || item.signal === null ? '—' : signalMeta(item.signal).text,
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

      {/* 状态卡（设备总数 / 在线 / 离线 / 故障 / 在线率）：后端无数据时显示「—」 */}
      <Row gutter={[12, 12]}>
        <Col xs={12} lg={4}>
          <Card size="small" styles={{ body: { padding: 16 } }}>
            <Statistic title="设备总数" value={stats.total ?? '—'} />
          </Card>
        </Col>
        <Col xs={12} lg={4}>
          <Card size="small" styles={{ body: { padding: 16 } }}>
            <Statistic title="在线" value={stats.online ?? '—'} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={12} lg={4}>
          <Card size="small" styles={{ body: { padding: 16 } }}>
            <Statistic title="离线" value={stats.offline ?? '—'} />
          </Card>
        </Col>
        <Col xs={12} lg={4}>
          <Card size="small" styles={{ body: { padding: 16 } }}>
            <Statistic title="故障" value={stats.fault ?? '—'} valueStyle={{ color: '#ff4d4f' }} />
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
                  value={stats.onlineRate ?? '—'}
                  precision={1}
                  suffix="%"
                  valueStyle={{ color: '#1677ff' }}
                />
                <Progress
                  percent={stats.onlineRate ?? 0}
                  size="small"
                  strokeColor={stats.onlineRate === null ? 'rgba(0,0,0,0.15)' : '#1677ff'}
                />
              </>
            )}
          </Card>
        </Col>
      </Row>

      {/* 设备类型分布：按后端真实设备分组；无数据展示空态 */}
      <Card size="small" title="设备类型分布" style={{ marginTop: 12 }}>
        {typeStats.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              statesQuery.isError
                ? `设备状态接口加载失败：${(statesQuery.error as Error | null)?.message ?? '未知错误'}`
                : '后端暂无设备数据'
            }
          />
        ) : (
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
        )}
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
            description="请检查网络或后端服务后重试。页面不使用示例数据兜底，失败期间表格为空。"
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
              total: deviceQuery.data?.total ?? rows.length,
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

      {/* 数据口径提示：只说明真实口径，不再出现「示例口径」话术 */}
      <AntAlert
        style={{ marginTop: 12 }}
        type={deviceQuery.isError ? 'error' : hasRealData ? 'success' : 'info'}
        showIcon
        message={
          deviceQuery.isError
            ? `设备台账加载失败：${(deviceQuery.error as Error | null)?.message ?? '未知错误'}`
            : hasRealData
              ? '已加载真实设备台账数据（电量 / 信号后端无该字段，显示「—」）'
              : '后端未返回设备数据，台账为空。统计卡与类型分布同样取真实接口，无数据时显示「—」。'
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
