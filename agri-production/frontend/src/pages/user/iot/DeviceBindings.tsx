/**
 * 页面名称：设备绑定管理
 * 路由路径：/production/iot/bindings
 * 所属模块：IoT设备管理
 * PRD 序号：PRD 6.1 #30（设备与地块/网关绑定、传感器映射）
 *
 * 设计决策：
 * - 绑定关系主体取 `GET /iot/bindings/page`（真实绑定关系对象），`@/api/iot` 内部已完成
 *   `targetType 1/2/3 ⇄ bindType PLOT/GREENHOUSE/FARM`、`status 1/0 ⇄ BOUND/UNBOUND`、
 *   `metrics 数组 ⇄ 逗号串`、`collectInterval ⇄ frequency` 的双向映射，页面无需感知
 * - 后端未返回绑定记录时，用设备实体上的地块字段推导「隐式绑定」行并标注来源，保证页面不空白
 * - **本地暂存兜底已整体删除**：新增 / 编辑 / 解绑 / 指标回写全部直连服务端，
 *   用户填写的采集指标与频率真实落库，不再写入 localStorage
 * - 编辑已有绑定走 `bindDevice`（后端「同设备+类型+对象重复绑定」= upsert 语义），
 *   保证采集指标 / 采集频率能被真实保存，而不是只改状态
 * - 传感器映射（通道 → 监测指标）前端按设备维度持久化，并把映射出的指标回写绑定关系的 metrics
 */
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DeleteOutlined, PlusOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import useFarmStore from '@/store/farm'
import {
  ENV_METRIC_DEFS,
  bindDevice,
  createDeviceBinding,
  deleteDeviceBinding,
  deviceTypeLabel,
  listDeviceBindings,
  listDevices,
  metricLabel,
  toDeviceBinding,
  unbindBinding,
  unwrapList,
} from '@/api/iot'
import { listPlots } from '@/api/plots'
import type { BindTargetType, DeviceBinding, IotBindType, IotDevice, Plot } from '@/types'

/** 旧结构 targetType（1 地块 2 大棚 3 农场）→ 后端 bindType 枚举 */
const BIND_TYPE_BY_TARGET: Record<BindTargetType, IotBindType> = {
  1: 'PLOT',
  2: 'GREENHOUSE',
  3: 'FARM',
}

/** 绑定对象类型选项 */
const TARGET_TYPE_OPTIONS: { value: BindTargetType; label: string }[] = [
  { value: 1, label: '地块' },
  { value: 2, label: '大棚' },
  { value: 3, label: '农场' },
]

/** 绑定状态选项 */
const STATUS_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: '已绑定' },
  { value: 0, label: '已解绑' },
]

/** 默认采集频率（分钟） */
const DEFAULT_INTERVAL = 10

/** 传感器通道映射行 */
interface SensorChannel {
  /** 行标识 */
  key: string
  /** 通道编码 */
  channel: string
  /** 传感器类型 */
  sensorType: string
  /** 映射指标编码 */
  metric: string
  /** 单位 */
  unit: string
  /** 倍率（原始值 × 倍率 = 上报值） */
  factor: number
}

/** 绑定行（扩展隐式绑定标记） */
interface BindingRow extends DeviceBinding {
  /** 是否由设备地块字段推导的隐式绑定（未落库，需「转为正式绑定」） */
  implicit?: boolean
}

/** 新增 / 编辑绑定表单值 */
interface BindingFormValues {
  /** 设备 ID */
  deviceId: string
  /** 绑定对象类型 */
  targetType: BindTargetType
  /** 绑定对象 ID */
  targetId: string
  /** 绑定对象名称（大棚 / 农场手填场景） */
  targetName?: string
  /** 采集指标 */
  metrics: string[]
  /** 采集频率（分钟） */
  collectInterval: number
}

/**
 * 从 localStorage 读取传感器通道映射。
 *
 * @param key 存储键
 * @returns 通道列表
 */
function loadChannels(key: string): SensorChannel[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as SensorChannel[]) : []
  } catch {
    return []
  }
}

/**
 * 生成默认通道映射（按指标顺序生成 CH1..CHn）。
 *
 * @param metrics 指标编码列表
 * @returns 通道列表
 */
function defaultChannels(metrics: string[]): SensorChannel[] {
  return metrics.map((metric, index) => {
    const def = ENV_METRIC_DEFS.find((item) => item.key === metric)
    return {
      key: `${metric}-${index}`,
      channel: `CH${index + 1}`,
      sensorType: def?.label ?? metric,
      metric,
      unit: def?.unit ?? '',
      factor: 1,
    }
  })
}

/**
 * 设备绑定管理页面
 *
 * 业务职责：维护设备与地块 / 大棚 / 农场的绑定关系、采集指标与采集频率，
 * 并提供传感器通道 → 监测指标的映射配置。
 *
 * @returns 页面内容
 */
export default function DeviceBindings(): JSX.Element {
  const queryClient = useQueryClient()
  const { currentFarm, farmOptions } = useFarmStore()
  const farmId = currentFarm?.farmId

  /** 设备筛选 */
  const [deviceFilter, setDeviceFilter] = useState<string | undefined>(undefined)
  /** 绑定对象类型筛选 */
  const [targetTypeFilter, setTargetTypeFilter] = useState<BindTargetType | undefined>(undefined)
  /** 状态筛选 */
  const [statusFilter, setStatusFilter] = useState<number | undefined>(undefined)
  /** 绑定弹窗 */
  const [modalOpen, setModalOpen] = useState<boolean>(false)
  /** 编辑中的绑定 */
  const [editing, setEditing] = useState<BindingRow | null>(null)
  /** 传感器映射弹窗：目标设备与绑定 */
  const [mappingDevice, setMappingDevice] = useState<string | undefined>(undefined)
  const [mappingBinding, setMappingBinding] = useState<BindingRow | null>(null)
  const [mappingOpen, setMappingOpen] = useState<boolean>(false)
  /** 通道映射编辑态 */
  const [channels, setChannels] = useState<SensorChannel[]>([])

  const [form] = Form.useForm<BindingFormValues>()

  /** 设备列表 */
  const devicesQuery = useQuery({
    queryKey: ['binding-devices', farmId],
    queryFn: () => listDevices({ pageNum: 1, pageSize: 100, farmId }),
    retry: false,
  })
  const devices: IotDevice[] = useMemo(() => unwrapList<IotDevice>(devicesQuery.data), [devicesQuery.data])
  const deviceNameMap = useMemo(() => {
    const map = new Map<string, string>()
    devices.forEach((item) => map.set(item.deviceId, item.deviceName || item.deviceCode || item.deviceId))
    return map
  }, [devices])

  /** 地块列表 */
  const plotsQuery = useQuery({
    queryKey: ['binding-plots', farmId],
    queryFn: () => listPlots({ pageNum: 1, pageSize: 100, farmId }),
    retry: false,
  })
  const plots: Plot[] = useMemo(() => unwrapList<Plot>(plotsQuery.data), [plotsQuery.data])

  /** 绑定关系 */
  const bindingsQuery = useQuery({
    queryKey: ['binding-list'],
    queryFn: () => listDeviceBindings({ pageNum: 1, pageSize: 100 }),
    retry: false,
  })

  /**
   * 绑定行数据来源（按优先级）：
   * 1. 服务端返回的真实绑定关系（`GET /iot/bindings/page`）
   * 2. 接口为空时用设备地块字段推导的「隐式绑定」，提示用户转为正式绑定
   */
  const rows = useMemo<BindingRow[]>(() => {
    const apiRows = unwrapList<DeviceBinding>(bindingsQuery.data)
    const implicitRows =
      apiRows.length > 0
        ? []
        : devices
            .filter((device) => Boolean((device as unknown as { plotId?: string }).plotId))
            .map<BindingRow>((device) => {
              const plotId = (device as unknown as { plotId?: string }).plotId as string
              return {
                bindingId: `IMPL-${device.deviceId}`,
                deviceId: device.deviceId,
                deviceName: device.deviceName || device.deviceCode,
                targetType: 1,
                targetId: plotId,
                targetName: plots.find((item) => item.plotId === plotId)?.plotName ?? plotId,
                metrics: [],
                collectInterval: DEFAULT_INTERVAL,
                status: 1,
                boundAt: device.createdAt,
                implicit: true,
              }
            })
    return [...apiRows, ...implicitRows]
  }, [bindingsQuery.data, devices, plots])

  /** 过滤后的绑定行 */
  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (deviceFilter && row.deviceId !== deviceFilter) return false
        if (targetTypeFilter && row.targetType !== targetTypeFilter) return false
        if (statusFilter !== undefined && row.status !== statusFilter) return false
        return true
      }),
    [rows, deviceFilter, targetTypeFilter, statusFilter],
  )

  /** 打开映射弹窗时载入通道配置 */
  useEffect(() => {
    if (!mappingOpen || !mappingDevice) return
    const key = `agri_iot_sensor_mapping_${mappingDevice}`
    const saved = loadChannels(key)
    if (saved.length > 0) {
      setChannels(saved)
      return
    }
    setChannels(defaultChannels(mappingBinding?.metrics ?? ['airTemperature', 'airHumidity']))
  }, [mappingOpen, mappingDevice, mappingBinding])

  /**
   * 保存绑定（全量直连服务端，无本地兜底）。
   *
   * 编辑已有绑定走 `bindDevice`：后端「同设备+类型+对象重复绑定」为 upsert 语义，
   * 能把采集指标 / 采集频率一起落库；若编辑时改了绑定对象，则顺带把旧的绑定关系解绑，
   * 避免残留一条仍然 BOUND 的旧记录。
   */
  const saveMutation = useMutation({
    mutationFn: async (values: BindingFormValues): Promise<DeviceBinding> => {
      const targetName =
        values.targetType === 1
          ? plots.find((item) => item.plotId === values.targetId)?.plotName
          : values.targetType === 3
            ? farmOptions.find((item) => item.farmId === values.targetId)?.farmName
            : values.targetName
      const payload: Partial<DeviceBinding> = {
        deviceId: values.deviceId,
        deviceName: deviceNameMap.get(values.deviceId),
        targetType: values.targetType,
        targetId: values.targetId,
        targetName,
        metrics: values.metrics,
        collectInterval: values.collectInterval,
        status: 1,
      }
      if (editing && !editing.implicit) {
        const targetChanged =
          editing.deviceId !== values.deviceId ||
          editing.targetType !== values.targetType ||
          editing.targetId !== values.targetId
        const saved = await bindDevice({
          deviceId: values.deviceId,
          bindType: BIND_TYPE_BY_TARGET[values.targetType],
          bindTargetId: values.targetId,
          targetName,
          metrics: values.metrics,
          frequency: values.collectInterval,
        })
        if (targetChanged) {
          // 绑定对象已变更：旧绑定关系解绑，避免残留重复的有效绑定
          await unbindBinding(editing.bindingId).catch(() => undefined)
        }
        return toDeviceBinding(saved)
      }
      return createDeviceBinding(payload)
    },
    onSuccess: () => {
      message.success(editing && !editing.implicit ? '绑定关系已更新' : '设备已绑定')
      setModalOpen(false)
      setEditing(null)
      form.resetFields()
      void queryClient.invalidateQueries({ queryKey: ['binding-list'] })
      void queryClient.invalidateQueries({ queryKey: ['binding-devices'] })
    },
    onError: (error: Error) => {
      message.error(error.message || '绑定保存失败，请稍后重试')
    },
  })

  /** 解绑（POST /iot/bindings/{bindingId}/unbind，记录保留、状态置 UNBOUND） */
  const unbindMutation = useMutation({
    mutationFn: (row: BindingRow): Promise<boolean> => deleteDeviceBinding(row.bindingId),
    onSuccess: () => {
      message.success('设备已解绑')
      void queryClient.invalidateQueries({ queryKey: ['binding-list'] })
      void queryClient.invalidateQueries({ queryKey: ['binding-devices'] })
    },
    onError: (error: Error) => {
      message.error(error.message || '解绑失败，请稍后重试')
    },
  })

  /** 打开新增绑定 */
  const openCreate = (): void => {
    setEditing(null)
    form.setFieldsValue({
      targetType: 1,
      metrics: ['airTemperature', 'airHumidity'],
      collectInterval: DEFAULT_INTERVAL,
    } as BindingFormValues)
    setModalOpen(true)
  }

  /** 打开编辑绑定 */
  const openEdit = (row: BindingRow): void => {
    setEditing(row)
    form.setFieldsValue({
      deviceId: row.deviceId,
      targetType: row.targetType,
      targetId: row.targetId,
      targetName: row.targetName,
      metrics: row.metrics ?? [],
      collectInterval: row.collectInterval ?? DEFAULT_INTERVAL,
    } as BindingFormValues)
    setModalOpen(true)
  }

  /** 打开传感器映射 */
  const openMapping = (row: BindingRow): void => {
    setMappingDevice(row.deviceId)
    setMappingBinding(row)
    setMappingOpen(true)
  }

  /**
   * 保存传感器映射。
   *
   * 通道 → 指标的映射关系按设备维度持久化在前端（后端暂无通道表）；
   * 映射出的指标列表回写服务端绑定关系（走 bindDevice upsert，保证 metrics 真实落库）。
   */
  const saveMapping = async (): Promise<void> => {
    if (!mappingDevice) return
    const key = `agri_iot_sensor_mapping_${mappingDevice}`
    localStorage.setItem(key, JSON.stringify(channels))
    const metrics = Array.from(new Set(channels.map((item) => item.metric).filter(Boolean)))
    if (mappingBinding && !mappingBinding.implicit) {
      try {
        await bindDevice({
          deviceId: mappingBinding.deviceId,
          bindType: BIND_TYPE_BY_TARGET[mappingBinding.targetType],
          bindTargetId: mappingBinding.targetId,
          targetName: mappingBinding.targetName,
          metrics,
          frequency: mappingBinding.collectInterval,
        })
        message.success('传感器映射已保存并回写到绑定关系')
      } catch (error) {
        message.error((error as Error).message || '映射已本地保存，但回写绑定关系失败')
      }
    } else {
      message.success('传感器映射已保存到本地（该绑定为隐式绑定，未回写）')
    }
    setMappingOpen(false)
    void queryClient.invalidateQueries({ queryKey: ['binding-list'] })
  }

  /** 表格列定义 */
  const columns: ColumnsType<BindingRow> = [
    {
      title: '设备名称',
      key: 'deviceName',
      render: (_value: unknown, row: BindingRow) => (
        <Space size={4}>
          <span>{row.deviceName ?? deviceNameMap.get(row.deviceId) ?? row.deviceId}</span>
          {row.implicit && <Tag color="orange">隐式</Tag>}
        </Space>
      ),
    },
    {
      title: '类型',
      key: 'deviceType',
      render: (_value: unknown, row: BindingRow) => {
        const device = devices.find((item) => item.deviceId === row.deviceId)
        return <Tag>{device ? deviceTypeLabel(device.deviceType) : '-'}</Tag>
      },
    },
    {
      title: '绑定对象类型',
      dataIndex: 'targetType',
      key: 'targetType',
      render: (value: BindTargetType) =>
        TARGET_TYPE_OPTIONS.find((item) => item.value === value)?.label ?? '-',
    },
    {
      title: '绑定对象',
      key: 'targetName',
      render: (_value: unknown, row: BindingRow) => row.targetName ?? row.targetId ?? '-',
    },
    {
      title: '采集指标',
      key: 'metrics',
      render: (_value: unknown, row: BindingRow) => {
        const metrics = row.metrics ?? []
        if (metrics.length === 0) return <Typography.Text type="secondary">未配置</Typography.Text>
        return (
          <Space wrap size={4}>
            {metrics.map((metric) => (
              <Tag key={metric} color="blue">
                {metricLabel(metric)}
              </Tag>
            ))}
          </Space>
        )
      },
    },
    {
      title: '采集频率',
      dataIndex: 'collectInterval',
      key: 'collectInterval',
      render: (value?: number) => (typeof value === 'number' ? `${value} 分钟` : '-'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: number) => (
        <Tag color={Number(status) === 1 ? 'green' : 'default'}>
          {Number(status) === 1 ? '已绑定' : '已解绑'}
        </Tag>
      ),
    },
    {
      title: '绑定时间',
      dataIndex: 'boundAt',
      key: 'boundAt',
      render: (value?: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_value: unknown, row: BindingRow) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<SettingOutlined />} onClick={() => openMapping(row)}>
            传感器映射
          </Button>
          <Button type="link" size="small" onClick={() => openEdit(row)}>
            {row.implicit ? '转为正式绑定' : '编辑'}
          </Button>
          <Popconfirm
            title="确认解除该绑定关系？"
            okText="解绑"
            cancelText="取消"
            onConfirm={() => unbindMutation.mutate(row)}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              解绑
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          🔗 设备绑定管理
        </Typography.Title>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: ['binding-list'] })
              void queryClient.invalidateQueries({ queryKey: ['binding-devices'] })
            }}
          >
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增绑定
          </Button>
        </Space>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap size={12}>
          <Select
            allowClear
            style={{ width: 200 }}
            placeholder="全部设备"
            value={deviceFilter}
            options={devices.map((item) => ({
              value: item.deviceId,
              label: item.deviceName || item.deviceCode || item.deviceId,
            }))}
            onChange={setDeviceFilter}
          />
          <Select
            allowClear
            style={{ width: 160 }}
            placeholder="全部绑定对象"
            value={targetTypeFilter}
            options={TARGET_TYPE_OPTIONS}
            onChange={setTargetTypeFilter}
          />
          <Select
            allowClear
            style={{ width: 140 }}
            placeholder="全部状态"
            value={statusFilter}
            options={STATUS_OPTIONS}
            onChange={setStatusFilter}
          />
        </Space>
      </Card>

      {bindingsQuery.isError && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="绑定关系接口暂不可用，已使用设备地块字段推导展示"
          description={(bindingsQuery.error as Error)?.message ?? '请稍后重试'}
        />
      )}

      {bindingsQuery.data && unwrapList<DeviceBinding>(bindingsQuery.data).length === 0 && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="后端未返回绑定记录"
          description="当前列表由设备实体上的地块字段推导（标记「隐式」），点击「转为正式绑定」可写入正式绑定关系。"
        />
      )}

      <Card>
        <Table<BindingRow>
          rowKey="bindingId"
          loading={bindingsQuery.isLoading || devicesQuery.isLoading}
          dataSource={filteredRows}
          columns={columns}
          locale={{ emptyText: <Empty description="暂无绑定关系，点击「新增绑定」开始配置" /> }}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (value) => `共 ${value} 条` }}
        />
      </Card>

      <Modal
        title={editing ? '编辑绑定关系' : '新增设备绑定'}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false)
          setEditing(null)
        }}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        okText="保存"
        cancelText="取消"
        width={560}
        destroyOnClose
      >
        <Form<BindingFormValues> form={form} layout="vertical" onFinish={(values) => saveMutation.mutate(values)} preserve={false}>
          <Form.Item name="deviceId" label="设备" rules={[{ required: true, message: '请选择设备' }]}>
            <Select
              placeholder="请选择设备"
              options={devices.map((item) => ({
                value: item.deviceId,
                label: `${item.deviceName || item.deviceCode}（${deviceTypeLabel(item.deviceType)}）`,
              }))}
            />
          </Form.Item>
          <Form.Item name="targetType" label="绑定对象类型" rules={[{ required: true, message: '请选择绑定对象类型' }]}>
            <Select options={TARGET_TYPE_OPTIONS} onChange={() => form.setFieldValue('targetId', undefined)} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, next) => prev.targetType !== next.targetType}>
            {({ getFieldValue }) => {
              const targetType = getFieldValue('targetType') as BindTargetType
              if (targetType === 1) {
                return (
                  <Form.Item name="targetId" label="绑定地块" rules={[{ required: true, message: '请选择地块' }]}>
                    <Select
                      placeholder="请选择地块"
                      options={plots.map((item) => ({ value: item.plotId, label: item.plotName }))}
                    />
                  </Form.Item>
                )
              }
              if (targetType === 3) {
                return (
                  <Form.Item name="targetId" label="绑定农场" rules={[{ required: true, message: '请选择农场' }]}>
                    <Select
                      placeholder="请选择农场"
                      options={farmOptions.map((item) => ({ value: item.farmId, label: item.farmName }))}
                    />
                  </Form.Item>
                )
              }
              return (
                <>
                  <Form.Item name="targetId" label="大棚编号" rules={[{ required: true, message: '请填写大棚编号' }]}>
                    <Input placeholder="如：GH-01" />
                  </Form.Item>
                  <Form.Item name="targetName" label="大棚名称">
                    <Input placeholder="如：1号连栋大棚" />
                  </Form.Item>
                </>
              )
            }}
          </Form.Item>
          <Form.Item name="metrics" label="采集指标" rules={[{ required: true, message: '请至少选择一个采集指标' }]}>
            <Checkbox.Group
              options={ENV_METRIC_DEFS.map((item) => ({ label: item.label, value: item.key }))}
            />
          </Form.Item>
          <Form.Item name="collectInterval" label="采集频率（分钟）" rules={[{ required: true, message: '请填写采集频率' }]}>
            <InputNumber min={1} max={1440} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`传感器映射配置${mappingBinding?.deviceName ? ` · ${mappingBinding.deviceName}` : ''}`}
        open={mappingOpen}
        onCancel={() => setMappingOpen(false)}
        onOk={() => void saveMapping()}
        okText="保存映射"
        cancelText="取消"
        width={760}
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Typography.Text type="secondary">
            配置设备各采集通道与监测指标的映射关系（含单位与倍率），保存后自动回写到绑定关系的采集指标。
          </Typography.Text>
          <Table<SensorChannel>
            size="small"
            rowKey="key"
            dataSource={channels}
            pagination={false}
            locale={{ emptyText: <Empty description="暂无通道，请点击下方新增" /> }}
            columns={[
              {
                title: '通道',
                dataIndex: 'channel',
                key: 'channel',
                render: (value: string, row: SensorChannel) => (
                  <Input
                    value={value}
                    onChange={(event) =>
                      setChannels((prev) =>
                        prev.map((item) =>
                          item.key === row.key ? { ...item, channel: event.target.value } : item,
                        ),
                      )
                    }
                  />
                ),
              },
              {
                title: '传感器类型',
                dataIndex: 'sensorType',
                key: 'sensorType',
                render: (value: string, row: SensorChannel) => (
                  <Input
                    value={value}
                    onChange={(event) =>
                      setChannels((prev) =>
                        prev.map((item) =>
                          item.key === row.key ? { ...item, sensorType: event.target.value } : item,
                        ),
                      )
                    }
                  />
                ),
              },
              {
                title: '映射指标',
                dataIndex: 'metric',
                key: 'metric',
                render: (value: string, row: SensorChannel) => (
                  <Select
                    style={{ width: 140 }}
                    value={value}
                    options={ENV_METRIC_DEFS.map((item) => ({ value: item.key, label: item.label }))}
                    onChange={(next) =>
                      setChannels((prev) =>
                        prev.map((item) =>
                          item.key === row.key
                            ? {
                                ...item,
                                metric: next,
                                unit: ENV_METRIC_DEFS.find((def) => def.key === next)?.unit ?? item.unit,
                              }
                            : item,
                        ),
                      )
                    }
                  />
                ),
              },
              {
                title: '单位',
                dataIndex: 'unit',
                key: 'unit',
                render: (value: string) => value || '-',
              },
              {
                title: '倍率',
                dataIndex: 'factor',
                key: 'factor',
                render: (value: number, row: SensorChannel) => (
                  <InputNumber
                    min={0}
                    step={0.1}
                    value={value}
                    onChange={(next) =>
                      setChannels((prev) =>
                        prev.map((item) =>
                          item.key === row.key ? { ...item, factor: Number(next ?? 1) } : item,
                        ),
                      )
                    }
                  />
                ),
              },
              {
                title: '操作',
                key: 'action',
                render: (_value: unknown, row: SensorChannel) => (
                  <Button
                    type="link"
                    size="small"
                    danger
                    onClick={() => setChannels((prev) => prev.filter((item) => item.key !== row.key))}
                  >
                    删除
                  </Button>
                ),
              },
            ]}
          />
          <Button
            icon={<PlusOutlined />}
            onClick={() =>
              setChannels((prev) => [
                ...prev,
                {
                  key: `ch-${Date.now()}`,
                  channel: `CH${prev.length + 1}`,
                  sensorType: '通用传感器',
                  metric: ENV_METRIC_DEFS[0]?.key ?? 'airTemperature',
                  unit: ENV_METRIC_DEFS[0]?.unit ?? '',
                  factor: 1,
                },
              ])
            }
          >
            新增通道
          </Button>
        </Space>
      </Modal>
    </div>
  )
}
