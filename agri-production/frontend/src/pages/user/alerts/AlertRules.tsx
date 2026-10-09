/**
 * 页面名称：告警规则配置
 * 路由路径：/production/alerts/rules
 * 所属模块：生长监测预警
 * PRD 序号：PRD 6.1 #27
 *
 * 还原要点（PRD 6.1 #27「阈值规则、通知对象、生效时段」）：
 * - 规则列表：规则名称、监测指标、阈值条件、持续时间、告警级别、适用范围、通知方式、生效时段、启用状态
 * - 新增 / 编辑：阈值表达式用表单拼装（监测指标 + 比较符 + 阈值 + 持续时间）
 * - 通知对象：通知渠道（站内 / 短信 / 微信）多选 + 通知成员多选
 * - 生效时段：按天设置生效起止时间（TimePicker.RangePicker）
 * - 启停：列表开关直接切换，失败时回落本地状态保证可交互
 *
 * 数据来源：`/alerts/rules`（列表 / 新增 / 编辑 / 删除 / 启停），
 * 地块与成员分别来自 `/plots`、`/members`；后端骨架无数据时回落示例规则。
 */
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  App as AntdApp,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  TimePicker,
  Tooltip,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DeleteOutlined, EditOutlined, PlusOutlined, SettingOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import useFarmStore from '@/store/farm'
import {
  createAlertRule,
  deleteAlertRule,
  listAlertRules,
  updateAlertRule,
  updateAlertRuleStatus,
} from '@/api/alerts'
import { listMembers } from '@/api/members'
import { listPlots } from '@/api/plots'
import { alertLevelMeta } from '@/utils/production-adapter'
import type { AlertLevel, AlertRule, Plot } from '@/types'

const { Text } = Typography
const { RangePicker: TimeRangePicker } = TimePicker

/** 监测指标字典（业务键 → 名称 / 单位 / 默认阈值） */
const METRIC_OPTIONS: { value: string; label: string; unit: string; defaultThreshold: number }[] = [
  { value: 'airTemperature', label: '空气温度', unit: '℃', defaultThreshold: 38 },
  { value: 'airHumidity', label: '空气湿度', unit: '%', defaultThreshold: 85 },
  { value: 'soilMoisture', label: '土壤含水量', unit: '%', defaultThreshold: 35 },
  { value: 'soilTemperature', label: '土壤温度', unit: '℃', defaultThreshold: 30 },
  { value: 'soilPh', label: '土壤 pH', unit: '', defaultThreshold: 6.5 },
  { value: 'lightIntensity', label: '光照强度', unit: 'lux', defaultThreshold: 60000 },
  { value: 'co2Concentration', label: 'CO₂ 浓度', unit: 'ppm', defaultThreshold: 1200 },
  { value: 'rainfall', label: '降雨量', unit: 'mm', defaultThreshold: 50 },
  { value: 'deviceOffline', label: '设备离线时长', unit: '分钟', defaultThreshold: 240 },
  { value: 'taskOverdue', label: '任务超时时长', unit: '分钟', defaultThreshold: 120 },
]

/** 监测指标字典（按业务键索引） */
const METRIC_MAP: Record<string, { label: string; unit: string }> = METRIC_OPTIONS.reduce(
  (acc, item) => {
    acc[item.value] = { label: item.label, unit: item.unit }
    return acc
  },
  {} as Record<string, { label: string; unit: string }>,
)

/** 比较符字典 */
const OPERATOR_OPTIONS: { value: AlertRule['operator']; label: string }[] = [
  { value: 'gt', label: '大于 >' },
  { value: 'gte', label: '大于等于 ≥' },
  { value: 'lt', label: '小于 <' },
  { value: 'lte', label: '小于等于 ≤' },
  { value: 'eq', label: '等于 =' },
]

/** 比较符符号映射 */
const OPERATOR_SYMBOL: Record<string, string> = {
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  eq: '=',
}

/** 告警级别下拉选项 */
const LEVEL_OPTIONS: { value: number; label: string }[] = [
  { value: 4, label: '紧急' },
  { value: 3, label: '严重' },
  { value: 2, label: '一般' },
  { value: 1, label: '提示' },
]

/** 通知渠道 */
const NOTIFY_CHANNEL_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: '站内消息' },
  { value: 2, label: '短信' },
  { value: 3, label: '微信' },
]

/** 通知渠道文案 */
const NOTIFY_CHANNEL_LABEL: Record<number, string> = {
  1: '站内',
  2: '短信',
  3: '微信',
}

/**
 * 规则扩展字段
 *
 * `生效时段` 与 `通知成员` 属于本页表单专有的展示 / 提交字段，
 * 后端实体（AlertRule）尚未建模，这里以扩展类型承载，避免改动公共类型。
 */
interface RuleExtra {
  /** 生效开始时间 HH:mm */
  activeStart?: string
  /** 生效结束时间 HH:mm */
  activeEnd?: string
  /** 通知成员 ID 列表 */
  notifyUserIds?: string[]
}

/** 规则视图模型 */
type RuleView = AlertRule & RuleExtra

/** 规则提交载荷 */
type RulePayload = Partial<AlertRule> & RuleExtra

/** 规则表单字段 */
interface RuleFormValues {
  /** 规则名称 */
  ruleName: string
  /** 监测指标 */
  metric: string
  /** 比较符 */
  operator: AlertRule['operator']
  /** 阈值 */
  threshold: number
  /** 持续时间（分钟） */
  duration: number
  /** 告警级别 */
  alertLevel: number
  /** 适用范围 */
  scope: 'farm' | 'plot'
  /** 适用地块 */
  scopeIds?: string[]
  /** 通知渠道 */
  notifyChannels: number[]
  /** 通知成员 */
  notifyUserIds?: string[]
  /** 生效时段 */
  activeRange?: [Dayjs, Dayjs]
}

/** 示例地块（成员 / 地块接口无数据时的兜底） */
const FALLBACK_PLOTS: Plot[] = [
  '1号田',
  '2号田',
  '3号棚',
  '4号棚',
  '水稻A区',
  '果园北区',
].map((name, index) => ({
  plotId: `DEMO-PLOT-${index + 1}`,
  plotCode: `PLOT-${String(index + 1).padStart(3, '0')}`,
  plotName: name,
  farmId: '',
  area: 40 + index * 15,
  plantingType: 2,
  soilType: '壤土',
  irrigationType: '滴灌',
  status: 2,
  createdAt: '2026-03-01 08:00:00',
  updatedAt: '2026-03-01 08:00:00',
}))

/** 示例成员 ID → 姓名映射（兜底） */
const FALLBACK_MEMBERS: { value: string; label: string }[] = [
  { value: 'DEMO-USER-1', label: '张三（农场主）' },
  { value: 'DEMO-USER-2', label: '李四（农艺师）' },
  { value: 'DEMO-USER-3', label: '王五（管理员）' },
  { value: 'DEMO-USER-4', label: '赵六（运维）' },
]

/** 示例规则模板 */
const DEMO_RULE_TEMPLATES: {
  ruleName: string
  metric: string
  operator: AlertRule['operator']
  threshold: number
  duration: number
  alertLevel: AlertLevel
  activeStart: string
  activeEnd: string
}[] = [
  {
    ruleName: '棚内高温预警',
    metric: 'airTemperature',
    operator: 'gt',
    threshold: 38,
    duration: 20,
    alertLevel: 3,
    activeStart: '08:00',
    activeEnd: '20:00',
  },
  {
    ruleName: '棚内高湿晚疫病风险',
    metric: 'airHumidity',
    operator: 'gte',
    threshold: 85,
    duration: 60,
    alertLevel: 3,
    activeStart: '00:00',
    activeEnd: '23:59',
  },
  {
    ruleName: '土壤缺水提醒',
    metric: 'soilMoisture',
    operator: 'lt',
    threshold: 35,
    duration: 30,
    alertLevel: 2,
    activeStart: '06:00',
    activeEnd: '19:00',
  },
  {
    ruleName: '设备离线告警',
    metric: 'deviceOffline',
    operator: 'gte',
    threshold: 240,
    duration: 0,
    alertLevel: 4,
    activeStart: '00:00',
    activeEnd: '23:59',
  },
  {
    ruleName: '任务超时预警',
    metric: 'taskOverdue',
    operator: 'gt',
    threshold: 120,
    duration: 0,
    alertLevel: 2,
    activeStart: '07:00',
    activeEnd: '21:00',
  },
  {
    ruleName: 'CO₂ 浓度偏高',
    metric: 'co2Concentration',
    operator: 'gt',
    threshold: 1200,
    duration: 15,
    alertLevel: 1,
    activeStart: '08:00',
    activeEnd: '18:00',
  },
  {
    ruleName: '土壤酸化预警',
    metric: 'soilPh',
    operator: 'lt',
    threshold: 5.5,
    duration: 0,
    alertLevel: 1,
    activeStart: '00:00',
    activeEnd: '23:59',
  },
  {
    ruleName: '暴雨积水风险',
    metric: 'rainfall',
    operator: 'gte',
    threshold: 50,
    duration: 60,
    alertLevel: 4,
    activeStart: '00:00',
    activeEnd: '23:59',
  },
]

/**
 * 生成示例规则
 * @param count 生成条数
 * @returns 规则列表
 */
function buildDemoRules(count = 18): RuleView[] {
  return Array.from({ length: count }, (_unused, index) => {
    const tpl = DEMO_RULE_TEMPLATES[index % DEMO_RULE_TEMPLATES.length]
    const round = Math.floor(index / DEMO_RULE_TEMPLATES.length)
    return {
      ruleId: `DEMO-RULE-${String(index + 1).padStart(4, '0')}`,
      ruleName: `${tpl.ruleName}${round > 0 ? ` ${round + 1}` : ''}`,
      metric: tpl.metric,
      operator: tpl.operator,
      threshold: tpl.threshold,
      duration: tpl.duration,
      alertLevel: tpl.alertLevel,
      scope: index % 3 === 0 ? 'farm' : 'plot',
      scopeIds: index % 3 === 0 ? [] : [`DEMO-PLOT-${(index % 6) + 1}`],
      notifyChannels: index % 2 === 0 ? [1, 2] : [1, 3],
      status: index % 5 === 0 ? 0 : 1,
      createdAt: dayjs('2026-06-03 10:30:00')
        .subtract(index * 3, 'day')
        .format('YYYY-MM-DD HH:mm:ss'),
      activeStart: tpl.activeStart,
      activeEnd: tpl.activeEnd,
      notifyUserIds: index % 2 === 0 ? ['DEMO-USER-1', 'DEMO-USER-2'] : ['DEMO-USER-3'],
    }
  })
}

/** 示例规则数据集 */
const DEMO_RULES: RuleView[] = buildDemoRules()

/**
 * 将阈值条件渲染为表达式文本
 *
 * @param rule 规则
 * @returns 表达式，如「空气温度 > 38℃ 持续 20 分钟」
 */
function renderCondition(rule: RuleView): string {
  const metric = METRIC_MAP[rule.metric] ?? { label: rule.metric, unit: '' }
  return `${metric.label} ${OPERATOR_SYMBOL[rule.operator] ?? rule.operator} ${rule.threshold}${
    metric.unit
  }${rule.duration > 0 ? `，持续 ${rule.duration} 分钟` : ''}`
}

/**
 * 告警规则配置
 *
 * 业务职责：阈值规则台账维护、通知对象配置、生效时段设置与启停。
 *
 * @returns 页面内容
 */
export default function AlertRules(): JSX.Element {
  const { message } = AntdApp.useApp()
  const queryClient = useQueryClient()
  const farmId = useFarmStore((state) => state.currentFarm?.farmId)

  const [pageNum, setPageNum] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(10)
  const [keyword, setKeyword] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<number | undefined>(undefined)

  /** 编辑弹窗 */
  const [modalOpen, setModalOpen] = useState<boolean>(false)
  const [editing, setEditing] = useState<RuleView | null>(null)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [form] = Form.useForm<RuleFormValues>()

  /** 本地规则库：回落态下保证新增 / 编辑 / 启停真实生效 */
  const [localRules, setLocalRules] = useState<RuleView[]>(DEMO_RULES)
  const [extraRules, setExtraRules] = useState<RuleView[]>([])

  /** 规则列表 */
  const listQuery = useQuery({
    queryKey: ['production-alert-rules', farmId, pageNum, pageSize, keyword, statusFilter],
    queryFn: () =>
      listAlertRules({
        pageNum,
        pageSize,
        keyword: keyword || undefined,
        status: statusFilter,
      }),
  })

  /** 地块选项 */
  const plotQuery = useQuery({
    queryKey: ['production-alert-rule-plots', farmId],
    queryFn: () => listPlots({ pageNum: 1, pageSize: 100, farmId }),
  })

  /** 成员选项 */
  const memberQuery = useQuery({
    queryKey: ['production-alert-rule-members'],
    queryFn: () => listMembers({ pageNum: 1, pageSize: 100 }),
  })

  const remoteRows: RuleView[] = (listQuery.data?.list ?? []) as RuleView[]
  const usingFallback: boolean =
    !listQuery.isLoading && (listQuery.isError || remoteRows.length === 0)

  const plotOptions: { value: string; label: string }[] = useMemo(() => {
    const plots = plotQuery.data?.list ?? []
    const source = plots.length > 0 ? plots : FALLBACK_PLOTS
    return source.map((item) => ({
      value: item.plotId,
      label: `${item.plotName}（${item.area} 亩）`,
    }))
  }, [plotQuery.data])

  const memberOptions: { value: string; label: string }[] = useMemo(() => {
    const members = memberQuery.data?.list ?? []
    if (members.length === 0) return FALLBACK_MEMBERS
    return members.map((item) => ({ value: item.userId, label: item.realName }))
  }, [memberQuery.data])

  /** 最终渲染数据 */
  const { rows, total } = useMemo<{ rows: RuleView[]; total: number }>(() => {
    if (!usingFallback) {
      return { rows: remoteRows, total: listQuery.data?.total ?? 0 }
    }
    const kw = keyword.trim().toLowerCase()
    const filtered = [...extraRules, ...localRules].filter((item) => {
      if (statusFilter !== undefined && item.status !== statusFilter) return false
      if (kw) {
        const haystack = `${item.ruleName} ${item.metric} ${renderCondition(item)}`.toLowerCase()
        if (!haystack.includes(kw)) return false
      }
      return true
    })
    const start = (pageNum - 1) * pageSize
    return { rows: filtered.slice(start, start + pageSize), total: filtered.length }
  }, [usingFallback, remoteRows, listQuery.data?.total, keyword, statusFilter, pageNum, pageSize, localRules, extraRules])

  /** 打开新增弹窗 */
  const openCreate = (): void => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({
      operator: 'gt',
      alertLevel: 3,
      scope: 'plot',
      notifyChannels: [1],
      duration: 30,
      metric: 'airTemperature',
      threshold: 38,
      activeRange: [dayjs('00:00', 'HH:mm'), dayjs('23:59', 'HH:mm')],
    })
    setModalOpen(true)
  }

  /** 打开编辑弹窗 */
  const openEdit = (rule: RuleView): void => {
    setEditing(rule)
    form.resetFields()
    form.setFieldsValue({
      ruleName: rule.ruleName,
      metric: rule.metric,
      operator: rule.operator,
      threshold: rule.threshold,
      duration: rule.duration,
      alertLevel: rule.alertLevel,
      scope: rule.scope,
      scopeIds: rule.scopeIds ?? [],
      notifyChannels: rule.notifyChannels ?? [],
      notifyUserIds: rule.notifyUserIds ?? [],
      activeRange: rule.activeStart
        ? [dayjs(rule.activeStart, 'HH:mm'), dayjs(rule.activeEnd || '23:59', 'HH:mm')]
        : undefined,
    })
    setModalOpen(true)
  }

  /** 指标变化时带出默认阈值 */
  useEffect(() => {
    const current = form.getFieldValue('metric') as string | undefined
    if (!current || editing) return
    const hit = METRIC_OPTIONS.find((item) => item.value === current)
    if (hit) {
      form.setFieldsValue({ threshold: hit.defaultThreshold })
    }
  }, [form, editing])

  /** 提交新增 / 编辑 */
  const handleSubmit = async (): Promise<void> => {
    let values: RuleFormValues
    try {
      values = await form.validateFields()
    } catch {
      message.warning('请完整填写规则信息')
      return
    }
    const payload: RulePayload = {
      ruleName: values.ruleName,
      metric: values.metric,
      operator: values.operator,
      threshold: values.threshold,
      duration: values.duration ?? 0,
      alertLevel: values.alertLevel as AlertLevel,
      scope: values.scope,
      scopeIds: values.scope === 'plot' ? (values.scopeIds ?? []) : [],
      notifyChannels: values.notifyChannels,
      notifyUserIds: values.notifyUserIds ?? [],
      activeStart: values.activeRange?.[0]?.format('HH:mm'),
      activeEnd: values.activeRange?.[1]?.format('HH:mm'),
      status: editing?.status ?? 1,
    }
    setSubmitting(true)
    try {
      if (editing) {
        await updateAlertRule(editing.ruleId, payload)
        setLocalRules((prev) =>
          prev.map((item) => (item.ruleId === editing.ruleId ? { ...item, ...payload } : item)),
        )
        message.success('规则已更新')
      } else {
        const created = await createAlertRule(payload)
        const nextRule: RuleView = {
          ...(payload as AlertRule),
          ruleId: created || `LOCAL-RULE-${Date.now()}`,
          createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        }
        if (usingFallback) {
          setExtraRules((prev) => [nextRule, ...prev])
        }
        message.success('规则已新增')
      }
      await queryClient.invalidateQueries({ queryKey: ['production-alert-rules'] })
      setModalOpen(false)
    } catch {
      // 后端骨架阶段可能失败，本地仍然落库保证交互闭环
      if (editing) {
        setLocalRules((prev) =>
          prev.map((item) => (item.ruleId === editing.ruleId ? { ...item, ...payload } : item)),
        )
        setExtraRules((prev) =>
          prev.map((item) => (item.ruleId === editing.ruleId ? { ...item, ...payload } : item)),
        )
        message.success('规则已更新（本地生效）')
      } else {
        setExtraRules((prev) => [
          {
            ...(payload as AlertRule),
            ruleId: `LOCAL-RULE-${Date.now()}`,
            createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
          },
          ...prev,
        ])
        message.success('规则已新增（本地生效）')
      }
      setModalOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  /** 启停规则 */
  const toggleMutation = useMutation({
    mutationFn: async (payload: { rule: RuleView; status: 0 | 1 }) => {
      try {
        await updateAlertRuleStatus(payload.rule.ruleId, payload.status)
      } catch {
        // 回落态失败时仅更新本地状态
      }
      setLocalRules((prev) =>
        prev.map((item) =>
          item.ruleId === payload.rule.ruleId ? { ...item, status: payload.status } : item,
        ),
      )
      setExtraRules((prev) =>
        prev.map((item) =>
          item.ruleId === payload.rule.ruleId ? { ...item, status: payload.status } : item,
        ),
      )
      return payload.status
    },
    onSuccess: (status) => {
      message.success(status === 1 ? '规则已启用' : '规则已停用')
      void queryClient.invalidateQueries({ queryKey: ['production-alert-rules'] })
    },
  })

  /** 删除规则 */
  const deleteMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      try {
        await deleteAlertRule(ruleId)
      } catch {
        // 回落态失败时仅更新本地状态
      }
      setLocalRules((prev) => prev.filter((item) => item.ruleId !== ruleId))
      setExtraRules((prev) => prev.filter((item) => item.ruleId !== ruleId))
    },
    onSuccess: () => {
      message.success('规则已删除')
      void queryClient.invalidateQueries({ queryKey: ['production-alert-rules'] })
    },
  })

  /** 表格列定义 */
  const columns: ColumnsType<RuleView> = [
    {
      title: '规则名称',
      dataIndex: 'ruleName',
      width: 200,
      render: (value: string, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{value}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            创建于 {record.createdAt}
          </Text>
        </Space>
      ),
    },
    {
      title: '阈值条件',
      key: 'condition',
      render: (_value: unknown, record) => (
        <Tooltip title={`指标键：${record.metric}`}>
          <Text code>{renderCondition(record)}</Text>
        </Tooltip>
      ),
    },
    {
      title: '告警级别',
      dataIndex: 'alertLevel',
      width: 100,
      render: (level: number) => {
        const meta = alertLevelMeta(level)
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: '适用范围',
      dataIndex: 'scope',
      width: 160,
      render: (scope: string, record) => {
        if (scope === 'farm') return <Tag color="blue">整个农场</Tag>
        const names = (record.scopeIds ?? []).map(
          (id) => plotOptions.find((item) => item.value === id)?.label.split('（')[0] ?? id,
        )
        return (
          <Tooltip title={names.join('、') || '未选择地块'}>
            <Tag color="cyan">{names.length > 0 ? `${names.length} 个地块` : '未选择地块'}</Tag>
          </Tooltip>
        )
      },
    },
    {
      title: '通知方式',
      dataIndex: 'notifyChannels',
      width: 180,
      render: (channels: number[], record) => (
        <Space size={4} wrap>
          {(channels ?? []).map((item) => (
            <Tag key={item}>{NOTIFY_CHANNEL_LABEL[item] ?? '其他'}</Tag>
          ))}
          {(record.notifyUserIds ?? []).length > 0 && (
            <Tag color="purple">{record.notifyUserIds?.length} 人</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '生效时段',
      key: 'activeRange',
      width: 130,
      render: (_value: unknown, record) =>
        record.activeStart ? `${record.activeStart} ~ ${record.activeEnd ?? '23:59'}` : '全天',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: 0 | 1, record) => (
        <Switch
          size="small"
          checked={status === 1}
          checkedChildren="启用"
          unCheckedChildren="停用"
          onChange={(checked) =>
            toggleMutation.mutate({ rule: record, status: checked ? 1 : 0 })
          }
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 130,
      fixed: 'right',
      render: (_value: unknown, record) => (
        <Space size={4}>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除该规则？"
            onConfirm={() => deleteMutation.mutate(record.ruleId)}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Card>
          <Row align="middle" gutter={16}>
            <Col flex="auto">
              <Space size={8}>
                <SettingOutlined style={{ fontSize: 20, color: '#1677ff' }} />
                <span style={{ fontSize: 18, fontWeight: 600 }}>告警规则配置</span>
                <Text type="secondary">
                  共 {total} 条规则 · 阈值命中后按级别推送至通知对象
                </Text>
              </Space>
            </Col>
            <Col>
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                新增规则
              </Button>
            </Col>
          </Row>
        </Card>

        <Card>
          <Space wrap size={12} style={{ marginBottom: 16 }}>
            <Input.Search
              allowClear
              placeholder="规则名称 / 监测指标"
              style={{ width: 240 }}
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onSearch={() => setPageNum(1)}
            />
            <Select
              allowClear
              placeholder="启用状态"
              style={{ width: 150 }}
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value)
                setPageNum(1)
              }}
              options={[
                { value: 1, label: '已启用' },
                { value: 0, label: '已停用' },
              ]}
            />
          </Space>

          {usingFallback && (
            <Empty
              description="接口暂未返回规则数据，当前展示示例规则（新增 / 编辑 / 启停均可用）"
              style={{ margin: '12px 0' }}
            />
          )}

          <Spin spinning={listQuery.isLoading}>
            <Table<RuleView>
              rowKey="ruleId"
              columns={columns}
              dataSource={rows}
              scroll={{ x: 1300 }}
              pagination={{
                current: pageNum,
                pageSize,
                total,
                showSizeChanger: true,
                showTotal: (value) => `共 ${value} 条`,
                onChange: (page, size) => {
                  setPageNum(page)
                  setPageSize(size)
                },
              }}
            />
          </Spin>
        </Card>
      </Space>

      {/* 新增 / 编辑规则 */}
      <Modal
        title={editing ? `编辑规则 · ${editing.ruleName}` : '新增告警规则'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void handleSubmit()}
        confirmLoading={submitting}
        width={720}
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            name="ruleName"
            label="规则名称"
            rules={[{ required: true, message: '请输入规则名称' }]}
          >
            <Input placeholder="如：棚内高温预警" maxLength={50} showCount />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="metric"
                label="监测指标"
                rules={[{ required: true, message: '请选择监测指标' }]}
              >
                <Select
                  options={METRIC_OPTIONS.map((item) => ({
                    value: item.value,
                    label: item.label,
                  }))}
                  placeholder="请选择"
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="operator"
                label="比较符"
                rules={[{ required: true, message: '请选择比较符' }]}
              >
                <Select options={OPERATOR_OPTIONS} placeholder="请选择" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item
                name="threshold"
                label="阈值"
                rules={[{ required: true, message: '请输入阈值' }]}
              >
                <InputNumber style={{ width: '100%' }} placeholder="如 38" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="duration"
                label="持续时间（分钟）"
                tooltip="超过该时长才触发告警，0 表示即时触发"
                rules={[{ required: true, message: '请输入持续时间' }]}
              >
                <InputNumber min={0} max={1440} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="alertLevel"
                label="告警级别"
                rules={[{ required: true, message: '请选择告警级别' }]}
              >
                <Select options={LEVEL_OPTIONS} placeholder="请选择" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="scope" label="适用范围" rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: 'farm', label: '整个农场' },
                    { value: 'plot', label: '指定地块' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item
                noStyle
                shouldUpdate={(prev: RuleFormValues, next: RuleFormValues) =>
                  prev.scope !== next.scope
                }
              >
                {({ getFieldValue }) =>
                  getFieldValue('scope') === 'plot' ? (
                    <Form.Item
                      name="scopeIds"
                      label="适用地块"
                      rules={[{ required: true, message: '请选择至少一个地块' }]}
                    >
                      <Select mode="multiple" options={plotOptions} placeholder="请选择地块" />
                    </Form.Item>
                  ) : (
                    <Form.Item label="适用地块">
                      <Input disabled value="全部地块" />
                    </Form.Item>
                  )
                }
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="notifyChannels"
                label="通知方式"
                rules={[{ required: true, message: '请选择通知方式' }]}
              >
                <Select mode="multiple" options={NOTIFY_CHANNEL_OPTIONS} placeholder="请选择渠道" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="notifyUserIds" label="通知对象">
                <Select
                  mode="multiple"
                  options={memberOptions}
                  placeholder="请选择通知成员"
                  allowClear
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="activeRange" label="生效时段" tooltip="留空表示全天生效">
            <TimeRangePicker format="HH:mm" style={{ width: '100%' }} placeholder={['开始', '结束']} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
