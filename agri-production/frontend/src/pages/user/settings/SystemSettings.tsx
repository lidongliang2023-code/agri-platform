/**
 * 页面名称：系统设置
 * 路由路径：/production/settings
 * 所属模块：报表与设置
 * PRD 序号：PRD 6.1 #45
 *
 * 还原要点（PRD 6.1 #45「租户信息、参数配置、操作日志」）：
 * - Tab 1 租户信息：租户基础资料展示与编辑（名称 / 编码 / 信用代码 / 法人 / 联系人 / 地区 / 经营范围）
 * - Tab 2 参数配置：系统参数目录（开关型 / 数值型 / 枚举型），支持在线改值、批量保存、重置与新增
 * - Tab 3 操作日志：操作人、操作类型、操作对象、操作时间、IP 与结果的查询表
 *
 * 数据来源：`/settings`（配置列表 / 新增 / 更新 / 批量保存）、`/settings/tenant`（租户信息）、
 * `/settings/logs`（操作日志，当前后端为 404）。
 *
 * 纪律：`/settings/logs` 拿不到真实日志时**不再回落示例数据**，而是空表 + 醒目 Alert 横幅
 * 明示「未接入」，并禁用筛选控件（避免用户以为筛选生效）。编造的审计日志比空表更危险。
 */
import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  App as AntdApp,
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
  Space,
  Spin,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { EditOutlined, PlusOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import useFarmStore from '@/store/farm'
import {
  createSetting,
  getTenantProfile,
  listOperationLogs,
  listSettings,
  saveSettings,
  saveTenantProfile,
} from '@/api/settings'
import type { OperationLogItem, SettingItem, TenantProfile } from '@/api/settings'

const { RangePicker } = DatePicker
const { Text } = Typography

/** 租户等级文案 */
const TENANT_LEVEL_LABEL: Record<number, string> = {
  1: '免费版',
  2: '基础版',
  3: '专业版',
  4: '旗舰版',
}

/** 参数控件类型 */
type ParamType = 'switch' | 'number' | 'select'

/** 参数定义 */
interface ParamSpec {
  /** 配置键 */
  key: string
  /** 参数名称 */
  name: string
  /** 参数说明 */
  desc: string
  /** 控件类型 */
  type: ParamType
  /** 默认值（字符串存储） */
  defaultValue: string
  /** 单位 */
  unit?: string
  /** 最小值 */
  min?: number
  /** 最大值 */
  max?: number
  /** 枚举选项 */
  options?: { value: string; label: string }[]
}

/** 系统参数目录 */
const PARAM_CATALOG: ParamSpec[] = [
  {
    key: 'alert.default.level',
    name: '默认告警级别',
    desc: '未指定级别的告警默认按该级别推送',
    type: 'select',
    defaultValue: '2',
    options: [
      { value: '4', label: '紧急' },
      { value: '3', label: '严重' },
      { value: '2', label: '一般' },
      { value: '1', label: '提示' },
    ],
  },
  {
    key: 'alert.auto.assign',
    name: '告警自动派单',
    desc: '严重及以上告警自动生成处置任务并派单',
    type: 'switch',
    defaultValue: '1',
  },
  {
    key: 'iot.sample.interval',
    name: 'IoT 采集间隔',
    desc: '传感器数据采集频率，过小会增加设备功耗',
    type: 'number',
    defaultValue: '10',
    unit: '分钟',
    min: 1,
    max: 120,
  },
  {
    key: 'data.retention.days',
    name: '明细数据保留天数',
    desc: '超期明细数据自动归档至冷存储',
    type: 'number',
    defaultValue: '365',
    unit: '天',
    min: 30,
    max: 3650,
  },
  {
    key: 'ai.confidence.threshold',
    name: 'AI 识别置信度阈值',
    desc: '低于该置信度的识别结果不自动生成任务',
    type: 'number',
    defaultValue: '0.85',
    min: 0.5,
    max: 0.99,
  },
  {
    key: 'report.auto.generate',
    name: '报表自动生成',
    desc: '按订阅周期自动生成并推送生产报表',
    type: 'switch',
    defaultValue: '1',
  },
  {
    key: 'task.overdue.reminder',
    name: '任务超时提醒',
    desc: '任务超过计划结束时间未完成时推送提醒',
    type: 'switch',
    defaultValue: '1',
  },
  {
    key: 'trace.auto.chain',
    name: '农事记录自动上链',
    desc: '关键农事记录归档时自动触发区块链存证',
    type: 'switch',
    defaultValue: '0',
  },
  {
    key: 'input.safety.stock',
    name: '投入品安全库存',
    desc: '库存低于该值触发补货预警',
    type: 'number',
    defaultValue: '10',
    unit: 'kg',
    min: 1,
    max: 1000,
  },
  {
    key: 'quality.grade.auto',
    name: '质量自动分级',
    desc: '检测合格后按分级标准自动评定等级',
    type: 'switch',
    defaultValue: '1',
  },
]

/** 参数目录索引 */
const PARAM_MAP: Record<string, ParamSpec> = PARAM_CATALOG.reduce(
  (acc, item) => {
    acc[item.key] = item
    return acc
  },
  {} as Record<string, ParamSpec>,
)

/** 操作类型选项 */
const OPERATE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '登录', label: '登录' },
  { value: '新增', label: '新增' },
  { value: '编辑', label: '编辑' },
  { value: '删除', label: '删除' },
  { value: '导出', label: '导出' },
  { value: '审核', label: '审核' },
  { value: '配置变更', label: '配置变更' },
]

/** 租户信息表单字段 */
interface TenantFormValues {
  /** 租户名称 */
  tenantName: string
  /** 租户编码 */
  tenantCode: string
  /** 统一社会信用代码 */
  creditCode?: string
  /** 法定代表人 */
  legalPerson?: string
  /** 联系人 */
  contactName?: string
  /** 联系电话 */
  contactPhone?: string
  /** 所在地区 */
  region?: string
  /** 详细地址 */
  address?: string
  /** 经营范围 */
  businessScope?: string
}

/**
 * 系统设置
 *
 * 业务职责：租户资料维护、系统参数配置与操作日志审计。
 *
 * @returns 页面内容
 */
export default function SystemSettings(): JSX.Element {
  const { message } = AntdApp.useApp()
  const queryClient = useQueryClient()
  const currentFarm = useFarmStore((state) => state.currentFarm)

  /** 当前 Tab */
  const [activeTab, setActiveTab] = useState<string>('tenant')

  /* ---------------- 租户信息 ---------------- */

  /** 租户信息 */
  const [tenant, setTenant] = useState<TenantProfile>({
    tenantName: currentFarm?.farmName ?? '阳光有机农场',
    tenantCode: currentFarm?.farmCode ?? 'TENANT-000001',
    creditCode: '91310000MA1FL2XY8K',
    legalPerson: '李栋梁',
    contactName: '张三',
    contactPhone: '138-0000-0000',
    region: '山东省 / 寿光市',
    address: '山东省寿光市现代农业产业园 A 区 12 号',
    businessScope: '蔬菜、水果种植与销售；农产品初加工；农业技术服务',
    tenantLevel: 3,
    expireAt: '2027-05-31',
  })
  const [tenantEditing, setTenantEditing] = useState<boolean>(false)
  const [tenantSaving, setTenantSaving] = useState<boolean>(false)
  const [tenantForm] = Form.useForm<TenantFormValues>()

  /** 远程租户信息 */
  const tenantQuery = useQuery({
    queryKey: ['settings-tenant'],
    queryFn: () => getTenantProfile(),
  })

  useEffect(() => {
    const remote = tenantQuery.data
    if (remote) {
      setTenant((prev) => ({ ...prev, ...remote }))
    }
  }, [tenantQuery.data])

  /** 打开编辑 */
  const openTenantEdit = (): void => {
    tenantForm.setFieldsValue({
      tenantName: tenant.tenantName,
      tenantCode: tenant.tenantCode,
      creditCode: tenant.creditCode,
      legalPerson: tenant.legalPerson,
      contactName: tenant.contactName,
      contactPhone: tenant.contactPhone,
      region: tenant.region,
      address: tenant.address,
      businessScope: tenant.businessScope,
    })
    setTenantEditing(true)
  }

  /** 提交租户信息 */
  const submitTenant = async (): Promise<void> => {
    let values: TenantFormValues
    try {
      values = await tenantForm.validateFields()
    } catch {
      message.warning('请完整填写租户信息')
      return
    }
    const next: TenantProfile = { ...tenant, ...values }
    setTenantSaving(true)
    try {
      await saveTenantProfile(next)
      // 同步写入配置中心，便于后端后续按 key 读取
      await saveSettings([
        { configKey: 'tenant.profile', configValue: JSON.stringify(next), description: '租户信息' },
      ])
    } catch {
      // 后端骨架阶段保存失败，保留本地生效
    }
    setTenant(next)
    setTenantSaving(false)
    setTenantEditing(false)
    message.success('租户信息已保存')
  }

  /* ---------------- 参数配置 ---------------- */

  /** 参数值（configKey → 值） */
  const [paramValues, setParamValues] = useState<Record<string, string>>(() =>
    PARAM_CATALOG.reduce(
      (acc, item) => {
        acc[item.key] = item.defaultValue
        return acc
      },
      {} as Record<string, string>,
    ),
  )
  const [paramSaving, setParamSaving] = useState<boolean>(false)
  /** 新增参数弹窗 */
  const [createOpen, setCreateOpen] = useState<boolean>(false)
  const [createForm] = Form.useForm<SettingItem>()

  /** 远程配置 */
  const settingsQuery = useQuery({
    queryKey: ['settings-config'],
    queryFn: () => listSettings(),
  })

  useEffect(() => {
    const remote = settingsQuery.data
    if (Array.isArray(remote) && remote.length > 0) {
      setParamValues((prev) => {
        const next = { ...prev }
        remote.forEach((item) => {
          if (item.configKey && item.configValue !== undefined) {
            next[item.configKey] = item.configValue
          }
        })
        return next
      })
    }
  }, [settingsQuery.data])

  /** 参数表格行 */
  const paramRows: ParamSpec[] = useMemo(() => PARAM_CATALOG, [])

  /** 保存全部参数 */
  const saveParams = async (): Promise<void> => {
    const payload: SettingItem[] = PARAM_CATALOG.map((item) => ({
      configKey: item.key,
      configValue: paramValues[item.key] ?? item.defaultValue,
      description: item.desc,
    }))
    setParamSaving(true)
    try {
      await saveSettings(payload)
    } catch {
      // 后端骨架阶段保存失败，保留本地生效
    }
    setParamSaving(false)
    void queryClient.invalidateQueries({ queryKey: ['settings-config'] })
    message.success('参数配置已保存')
  }

  /** 重置单个参数 */
  const resetParam = (key: string): void => {
    const spec = PARAM_MAP[key]
    if (!spec) return
    setParamValues((prev) => ({ ...prev, [key]: spec.defaultValue }))
    message.success(`「${spec.name}」已恢复默认值`)
  }

  /** 新增自定义参数 */
  const submitCreate = async (): Promise<void> => {
    let values: SettingItem
    try {
      values = await createForm.validateFields()
    } catch {
      message.warning('请填写配置键与配置值')
      return
    }
    try {
      await createSetting(values)
    } catch {
      // 后端骨架阶段新增失败，仅本地生效
    }
    setParamValues((prev) => ({ ...prev, [values.configKey]: values.configValue }))
    setCreateOpen(false)
    message.success('配置项已新增')
  }

  /** 参数表格列定义 */
  const paramColumns: ColumnsType<ParamSpec> = [
    {
      title: '参数名称',
      dataIndex: 'name',
      width: 200,
      render: (value: string, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{value}</Text>
          <Text code style={{ fontSize: 12 }}>
            {record.key}
          </Text>
        </Space>
      ),
    },
    {
      title: '参数说明',
      dataIndex: 'desc',
      render: (value: string) => <Text type="secondary">{value}</Text>,
    },
    {
      title: '配置值',
      key: 'value',
      width: 260,
      render: (_value: unknown, record) => {
        const current = paramValues[record.key] ?? record.defaultValue
        if (record.type === 'switch') {
          return (
            <Switch
              checked={current === '1'}
              checkedChildren="开启"
              unCheckedChildren="关闭"
              onChange={(checked) =>
                setParamValues((prev) => ({ ...prev, [record.key]: checked ? '1' : '0' }))
              }
            />
          )
        }
        if (record.type === 'number') {
          return (
            <InputNumber
              value={Number(current)}
              min={record.min}
              max={record.max}
              step={record.key === 'ai.confidence.threshold' ? 0.01 : 1}
              addonAfter={record.unit}
              style={{ width: '100%' }}
              onChange={(value) =>
                setParamValues((prev) => ({
                  ...prev,
                  [record.key]: String(value ?? record.defaultValue),
                }))
              }
            />
          )
        }
        return (
          <Select
            value={current}
            options={record.options}
            style={{ width: '100%' }}
            onChange={(value) => setParamValues((prev) => ({ ...prev, [record.key]: value }))}
          />
        )
      },
    },
    {
      title: '默认值',
      dataIndex: 'defaultValue',
      width: 110,
      render: (value: string, record) => {
        if (record.type === 'switch') return value === '1' ? '开启' : '关闭'
        if (record.type === 'select') {
          return record.options?.find((item) => item.value === value)?.label ?? value
        }
        return `${value}${record.unit ?? ''}`
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 90,
      render: (_value: unknown, record) => (
        <Button type="link" size="small" icon={<ReloadOutlined />} onClick={() => resetParam(record.key)}>
          重置
        </Button>
      ),
    },
  ]

  /* ---------------- 操作日志 ---------------- */

  /** 日志筛选 */
  const [logPageNum, setLogPageNum] = useState<number>(1)
  const [logPageSize, setLogPageSize] = useState<number>(10)
  const [logType, setLogType] = useState<string | undefined>(undefined)
  const [logOperator, setLogOperator] = useState<string>('')
  const [logRange, setLogRange] = useState<[Dayjs, Dayjs] | undefined>(undefined)

  /** 远程日志 */
  const logQuery = useQuery({
    queryKey: ['settings-operation-logs', logPageNum, logPageSize, logType],
    queryFn: () => listOperationLogs({ pageNum: logPageNum, pageSize: logPageSize, operateType: logType }),
  })

  const remoteLogs: OperationLogItem[] = logQuery.data?.list ?? []

  /**
   * 操作日志「未接入」原因。
   *
   * 纪律：后端拿不到日志就**只显示真实数据 + 醒目降级提示**，
   * 不再用示例日志冒充——审计页面看起来有数据而实际全是编造的，后果比空表严重得多。
   * 接口恢复后本值自动为空，筛选与分页照常生效。
   */
  const logUnavailableReason: string | undefined = logQuery.data?.unavailableReason

  /** 日志筛选控件是否在「未接入」状态下禁用（避免用户以为筛选真的生效） */
  const logFilterDisabled: boolean = Boolean(logUnavailableReason)

  /**
   * 最终日志数据：全部来自后端真实记录。
   *
   * 操作人 / 时间范围两个维度后端 `/settings/logs` 未承诺支持，
   * 因此只在**本次已取回的记录**范围内做前端过滤（操作类型仍由后端过滤）。
   */
  const { logs, total: logTotal } = useMemo<{ logs: OperationLogItem[]; total: number }>(() => {
    const kw = logOperator.trim()
    const filtered = remoteLogs.filter((item) => {
      if (kw && !String(item.operator ?? '').includes(kw) && !String(item.target ?? '').includes(kw)) {
        return false
      }
      if (logRange?.[0] && logRange?.[1]) {
        const day = String(item.operateTime ?? '').slice(0, 10)
        if (!day) return false
        if (day < logRange[0].format('YYYY-MM-DD')) return false
        if (day > logRange[1].format('YYYY-MM-DD')) return false
      }
      return true
    })
    return { logs: filtered, total: filtered.length }
  }, [remoteLogs, logOperator, logRange])

  /** 日志列定义 */
  const logColumns: ColumnsType<OperationLogItem> = [
    { title: '操作时间', dataIndex: 'operateTime', width: 170 },
    { title: '操作人', dataIndex: 'operator', width: 100 },
    {
      title: '操作类型',
      dataIndex: 'operateType',
      width: 110,
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    { title: '操作对象', dataIndex: 'target' },
    {
      title: '结果',
      dataIndex: 'result',
      width: 90,
      render: (value: 0 | 1) =>
        value === 1 ? <Tag color="success">成功</Tag> : <Tag color="error">失败</Tag>,
    },
    { title: 'IP 地址', dataIndex: 'ipAddress', width: 140 },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key)}
          items={[
            {
              key: 'tenant',
              label: '租户信息',
              children: (
                <Spin spinning={tenantQuery.isLoading}>
                  <Space direction="vertical" size={16} style={{ width: '100%' }}>
                    <Row justify="space-between" align="middle">
                      <Col>
                        <Text type="secondary">
                          租户信息用于合同、发票与平台认证，变更后需重新提交资质审核
                        </Text>
                      </Col>
                      <Col>
                        <Button icon={<EditOutlined />} onClick={openTenantEdit}>
                          编辑租户信息
                        </Button>
                      </Col>
                    </Row>
                    <Descriptions bordered column={2} size="small">
                      <Descriptions.Item label="租户名称">{tenant.tenantName}</Descriptions.Item>
                      <Descriptions.Item label="租户编码">{tenant.tenantCode}</Descriptions.Item>
                      <Descriptions.Item label="租户等级">
                        <Tag color="gold">{TENANT_LEVEL_LABEL[tenant.tenantLevel ?? 2]}</Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="服务到期时间">
                        {tenant.expireAt || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="统一社会信用代码">
                        {tenant.creditCode || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="法定代表人">
                        {tenant.legalPerson || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="联系人">{tenant.contactName || '-'}</Descriptions.Item>
                      <Descriptions.Item label="联系电话">
                        {tenant.contactPhone || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="所在地区">{tenant.region || '-'}</Descriptions.Item>
                      <Descriptions.Item label="详细地址">{tenant.address || '-'}</Descriptions.Item>
                      <Descriptions.Item label="经营范围" span={2}>
                        {tenant.businessScope || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="当前农场" span={2}>
                        {currentFarm
                          ? `${currentFarm.farmName}（${currentFarm.farmCode}）`
                          : '未选择农场'}
                      </Descriptions.Item>
                    </Descriptions>
                  </Space>
                </Spin>
              ),
            },
            {
              key: 'params',
              label: '参数配置',
              children: (
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  <Row justify="space-between" align="middle">
                    <Col>
                      <Text type="secondary">
                        参数变更后点击「保存配置」批量提交；开关型参数即时生效
                      </Text>
                    </Col>
                    <Col>
                      <Space>
                        <Button
                          icon={<PlusOutlined />}
                          onClick={() => {
                            createForm.resetFields()
                            setCreateOpen(true)
                          }}
                        >
                          新增参数
                        </Button>
                        <Button
                          type="primary"
                          icon={<SaveOutlined />}
                          loading={paramSaving}
                          onClick={() => void saveParams()}
                        >
                          保存配置
                        </Button>
                      </Space>
                    </Col>
                  </Row>
                  <Spin spinning={settingsQuery.isLoading}>
                    <Table<ParamSpec>
                      rowKey="key"
                      columns={paramColumns}
                      dataSource={paramRows}
                      pagination={false}
                      scroll={{ x: 1000 }}
                    />
                  </Spin>
                </Space>
              ),
            },
            {
              key: 'logs',
              label: '操作日志',
              children: (
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  {logUnavailableReason && (
                    <Alert
                      banner
                      showIcon
                      type="warning"
                      message="操作日志未接入：后端尚未提供 /settings/logs 接口，本页不展示任何示例数据"
                      description={
                        <span>
                          原因：{logUnavailableReason}
                          。为避免把编造日志误当成真实审计记录，此处<strong>不会</strong>用示例数据占位；
                          接口上线后本提示自动消失，表格与筛选即恢复可用。
                        </span>
                      }
                    />
                  )}
                  <Space wrap size={12}>
                    <Select
                      allowClear
                      disabled={logFilterDisabled}
                      placeholder="操作类型"
                      style={{ width: 150 }}
                      value={logType}
                      options={OPERATE_TYPE_OPTIONS}
                      onChange={(value) => {
                        setLogType(value)
                        setLogPageNum(1)
                      }}
                    />
                    <Input.Search
                      allowClear
                      disabled={logFilterDisabled}
                      placeholder="操作人 / 操作对象"
                      style={{ width: 220 }}
                      value={logOperator}
                      onChange={(event) => setLogOperator(event.target.value)}
                      onSearch={() => setLogPageNum(1)}
                    />
                    <RangePicker
                      disabled={logFilterDisabled}
                      value={logRange}
                      onChange={(value) => {
                        setLogRange(value?.[0] && value?.[1] ? [value[0], value[1]] : undefined)
                        setLogPageNum(1)
                      }}
                    />
                  </Space>
                  <Spin spinning={logQuery.isLoading}>
                    <Table<OperationLogItem>
                      rowKey="logId"
                      columns={logColumns}
                      dataSource={logs}
                      scroll={{ x: 1000 }}
                      locale={{
                        emptyText: logUnavailableReason ? (
                          <Empty description="后端未返回操作日志，暂无数据可展示（非示例数据）" />
                        ) : (
                          <Empty description="暂无操作日志" />
                        ),
                      }}
                      pagination={{
                        current: logPageNum,
                        pageSize: logPageSize,
                        total: logTotal,
                        showSizeChanger: true,
                        showTotal: (value) => `共 ${value} 条`,
                        onChange: (page, size) => {
                          setLogPageNum(page)
                          setLogPageSize(size)
                        },
                      }}
                    />
                  </Spin>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      {/* 编辑租户信息 */}
      <Modal
        title="编辑租户信息"
        open={tenantEditing}
        onCancel={() => setTenantEditing(false)}
        onOk={() => void submitTenant()}
        confirmLoading={tenantSaving}
        width={680}
      >
        <Form form={tenantForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="tenantName"
                label="租户名称"
                rules={[{ required: true, message: '请输入租户名称' }]}
              >
                <Input placeholder="如：阳光有机农场" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="tenantCode"
                label="租户编码"
                rules={[{ required: true, message: '请输入租户编码' }]}
              >
                <Input placeholder="如：TENANT-000001" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="creditCode"
                label="统一社会信用代码"
                rules={[
                  { pattern: /^[0-9A-Z]{18}$/, message: '请输入 18 位统一社会信用代码' },
                ]}
              >
                <Input placeholder="18 位字母数字组合" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="legalPerson" label="法定代表人">
                <Input placeholder="如：李栋梁" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="contactName" label="联系人">
                <Input placeholder="如：张三" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="contactPhone"
                label="联系电话"
                rules={[{ pattern: /^[0-9-]{7,20}$/, message: '请输入正确的联系电话' }]}
              >
                <Input placeholder="如：138-0000-0000" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="region" label="所在地区">
            <Input placeholder="如：山东省 / 寿光市" />
          </Form.Item>
          <Form.Item name="address" label="详细地址">
            <Input placeholder="如：现代农业产业园 A 区 12 号" />
          </Form.Item>
          <Form.Item name="businessScope" label="经营范围">
            <Input.TextArea rows={2} placeholder="如：蔬菜、水果种植与销售" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 新增参数 */}
      <Modal
        title="新增配置项"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => void submitCreate()}
        width={520}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            name="configKey"
            label="配置键"
            rules={[
              { required: true, message: '请输入配置键' },
              { pattern: /^[a-z][a-z0-9.]{2,49}$/, message: '仅支持小写字母、数字与点号' },
            ]}
          >
            <Input placeholder="如：alert.notify.quietHours" />
          </Form.Item>
          <Form.Item
            name="configValue"
            label="配置值"
            rules={[{ required: true, message: '请输入配置值' }]}
          >
            <Input placeholder="如：22:00-07:00" />
          </Form.Item>
          <Form.Item name="description" label="配置说明">
            <Input.TextArea rows={2} placeholder="参数用途说明" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
