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
import { toFiniteNumber } from '@/utils/metric-format'
import { errorMessageOf } from '@/utils/request'
import { MISSING_VALUE_TEXT } from '@/components/MetricStatistic'
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

/**
 * 后端 `alert_level` 取值 → 页面级别数字（1 提示 2 一般 3 严重 4 紧急）。
 *
 * 实测（不是照前端类型猜的）：
 * <pre>
 * GET /production/alerts/rules → AlertRuleEntity 直出，alertLevel 是字符串
 *   DEMO-RULE-001 "WARN"   DEMO-RULE-002 "CRITICAL"
 *   DEMO-RULE-003 "INFO"   DEMO-RULE-006 "URGENT"
 * SELECT DISTINCT alert_level FROM prod_alert_rule → INFO / WARN / CRITICAL / URGENT
 * </pre>
 * 而 {@link alertLevelMeta} 只认数字，字符串进去一律走 default → 列表里
 * 「告警级别」列**所有行都显示「提示」**。此处按真值收窄。
 *
 * 数字口径不是我定的，来自后端 {@code AlertDict} 自己的双向映射
 * （{@code levelOf}: 1→INFO 2→WARN 3→CRITICAL 4→URGENT；
 *  {@code statusOf} 反向同值），与 {@link alertLevelMeta} 的
 *  1 提示 / 2 一般 / 3 严重 / 4 紧急 完全一致。
 *
 * 同时兼容枚举迁移后的小写词表（与 BT-32 同一套对应关系）：
 * `INFO→info`、`WARN→normal`、`CRITICAL→important`、`URGENT→urgent`。
 */
const ALERT_LEVEL_FROM_BACKEND: Record<string, AlertLevel> = {
  INFO: 1,
  WARN: 2,
  CRITICAL: 3,
  URGENT: 4,
  info: 1,
  normal: 2,
  important: 3,
  urgent: 4,
}

/** 级别无法识别时的兜底（不臆造严重程度，取最轻档并保留原值供提示） */
const ALERT_LEVEL_FALLBACK: AlertLevel = 1

/**
 * 后端 `metric` 中文名 → 前端字典 {@link METRIC_OPTIONS} 的 value。
 *
 * 实测后端存的是中文档案名（`空气温度` / `土壤含水量` / `水位` / `CO2浓度` /
 * `心跳间隔`），而前端字典的 value 是英文键（`airTemperature`）。两边对不上时
 * 页面拿不到单位，只能显示「空气温度 > undefined℃」——缺的是阈值（见
 * {@link toRuleView}），单位同样取不到。
 * 命中不了就保留后端原值（页面照常显示中文名，只是没有单位），**不猜**。
 */
const METRIC_VALUE_BY_LABEL: Record<string, string> = METRIC_OPTIONS.reduce(
  (acc, item) => {
    acc[item.label] = item.value
    // 去掉空格 / 下标差异后再收一版：「CO₂ 浓度」↔「CO2浓度」
    acc[item.label.replace(/[\s₂]/g, (m) => (m === '₂' ? '2' : ''))] = item.value
    return acc
  },
  {} as Record<string, string>,
)

/**
 * 通知渠道下拉选项。
 *
 * 取值必须与后端一致：{@code AlertRuleEntity.notifyChannels} 字段注释写明
 * 「通知渠道 站内/短信/微信（逗号分隔）」，{@code prod_alert_rule.notify_channels}
 * 实测就是中文档案名（如 `站内,短信`）。此处不自建数字编码映射
 * —— {@link AlertDict} 里也没有渠道映射，自行造一套会让读写两侧对不上。
 */
const NOTIFY_CHANNEL_OPTIONS: { value: string; label: string }[] = [
  { value: '站内', label: '站内消息' },
  { value: '短信', label: '短信' },
  { value: '微信', label: '微信' },
]

/** 渠道缺失时的提示语 */
const NOTIFY_CHANNEL_MISSING_TIP = '后端未返回该规则的通知渠道（notify_channels 为空），显示为「—」'

/**
 * 解析后端的通知渠道字段。
 *
 * 实测所见形态（{@code SELECT rule_id, notify_channels FROM prod_alert_rule}）：
 * <pre>
 * DEMO-RULE-001  站内,短信
 * DEMO-RULE-002  站内,短信,微信
 * DEMO-RULE-003  站内
 * RULE2026...    NULL
 * </pre>
 * 即「中文档案名 + 英文半角逗号（hex 2C）」的字符串，未配置时为 null。
 * 这里同时兼容全角逗号与数组形态，保证任何返回形态都只做拆分、不做臆造翻译。
 *
 * @param value 后端原值
 * @returns 渠道名列表；空数组表示该规则未配置渠道或后端未返回该字段
 */
function parseNotifyChannels(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }
  if (typeof value !== 'string') return []
  return value
    .split(/[,，;；]/)
    .map((item) => item.trim())
    .filter(Boolean)
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

/**
 * 规则视图模型。
 *
 * 三处按实测契约改掉公共类型 {@code AlertRule} 的声明（公共类型的全局订正需同步
 * `types/alert.ts`，不在本文件扩散修改）：
 * 1. `notifyChannels` 声明为 {@code number[]}，后端 {@code AlertRuleEntity.notifyChannels}
 *    是 String（逗号分隔中文档案名），按 number[] 渲染会 `channels.map is not a function` 崩页；
 * 2. `threshold` / `duration` 声明为非空的 {@code number}，但真实记录可能没配阈值
 *    （实测新建未填时为 null），非空声明会让"缺失"无处安放、只能显示成 0 或 null；
 * 3. `alertLevel` 声明为数字，后端是 {@code "WARN"} 这类字符串枚举，映射见
 *    {@link ALERT_LEVEL_FROM_BACKEND}。
 */
type RuleView = Omit<AlertRule, 'notifyChannels' | 'threshold' | 'duration'> &
  RuleExtra & {
    /** 通知渠道：后端为逗号分隔中文档案名字符串，未配置时为 null */
    notifyChannels?: string | null
    /** 阈值：后端 threshold_value 缺失时为 null（展示「—」，不是 0） */
    threshold: number | null
    /** 持续时间（分钟）：后端 duration_min 缺失时为 null */
    duration: number | null
  }

/** 规则提交载荷（notifyChannels 按后端 String 契约提交逗号串） */
type RulePayload = Partial<Omit<AlertRule, 'notifyChannels'>> &
  RuleExtra & {
    /** 通知渠道，逗号分隔 */
    notifyChannels?: string
  }

/**
 * 提交载荷 → api 层参数。
 *
 * {@code types/alert.ts} 里 {@code AlertRule.notifyChannels} 仍声明为 {@code number[]}，
 * 与后端 {@code AlertRuleEntity.notifyChannels}（String）不符，属于公共类型的历史遗留，
 * 需要连同 threshold / duration / scope 等字段一起全局订正（不在本次改动范围内）。
 * 此处只在「页面 → api」这一个边界做显式收窄，避免散落的隐式 any。
 *
 * @param payload 页面提交载荷
 * @returns api 层入参
 */
function toApiPayload(payload: RulePayload): Partial<AlertRule> {
  return payload as unknown as Partial<AlertRule>
}

/**
 * 后端 {@code AlertRuleEntity} → 页面视图模型 {@link RuleView}。
 *
 * 之前这里是一句 `as unknown as RuleView[]` 的硬转，字段名对不上就直接是
 * `undefined`：阈值读 `threshold`（后端叫 `thresholdValue`）、时长读
 * `duration`（后端叫 `durationMin`）、级别读数字（后端是 `WARN` 这类字符串）、
 * 适用范围读 `scope`/`scopeIds`（后端**根本没有这两个字段**），于是列表里出现
 * 「空气温度 > undefined℃」「告警级别一律提示」「适用范围一律未选择地块」。
 *
 * 实测的单条 JSON（{@code GET /production/alerts/rules}）如下，字段名以它为准：
 * <pre>
 * {
 *   "ruleId": "DEMO-RULE-001", "farmId": "DEMO-FARM-001",
 *   "plotId": null, "deviceId": null, "ruleName": "棚内高温预警",
 *   "metric": "空气温度", "operator": "gt",
 *   "thresholdValue": 35, "durationMin": 10,
 *   "alertLevel": "WARN", "notifyChannels": "站内,短信",
 *   "enabledFlag": 1, "status": 1, "createdAt": "2026-10-10 09:00:00"
 * }
 * </pre>
 *
 * 三个取值口径：
 * - 数值缺失一律 `null`（页面展示「—」），**不补 0**——0 是"统计过，结果是 0"，
 *   与"没这个值"是两回事；
 * - `scope` 由 `plotId` 推导：有 `plotId` 即地块级，否则农场级。后端没有
 *   `scope` 字段，这是**推导出的展示口径**，不是后端返回值；
 * - `metric` 命中不了中文→英文的反向表时保留后端原值，不猜。
 *
 * @param raw 后端单条记录
 * @returns 页面视图模型
 */
function toRuleView(raw: unknown): RuleView {
  const source = (raw ?? {}) as Record<string, unknown>

  // 阈值 / 时长：后端字段是 threshold_value / duration_min，同时兼容旧名
  const threshold = toFiniteNumber(source.thresholdValue ?? source.threshold)
  const duration = toFiniteNumber(source.durationMin ?? source.duration)

  // 适用范围：后端无 scope 字段，按 plotId 推导（展示口径，非后端原值）
  const plotId = typeof source.plotId === 'string' && source.plotId ? source.plotId : null
  const scope: 'farm' | 'plot' = plotId ? 'plot' : 'farm'

  // 告警级别：字符串枚举 → 数字；已经是数字的直接用；都认不出来才兜底
  const rawLevel = source.alertLevel
  const levelFromEnum =
    typeof rawLevel === 'string' ? ALERT_LEVEL_FROM_BACKEND[rawLevel] ?? null : null
  const levelFromNumber = toFiniteNumber(rawLevel)
  const alertLevel: AlertLevel =
    levelFromEnum ??
    (levelFromNumber !== null && [1, 2, 3, 4].includes(levelFromNumber)
      ? (levelFromNumber as AlertLevel)
      : ALERT_LEVEL_FALLBACK)

  const rawMetric = typeof source.metric === 'string' ? source.metric : ''
  const status = source.status === 1 || source.status === '1' ? 1 : 0

  return {
    ruleId: typeof source.ruleId === 'string' ? source.ruleId : '',
    ruleName: typeof source.ruleName === 'string' ? source.ruleName : '',
    metric: METRIC_VALUE_BY_LABEL[rawMetric] ?? rawMetric,
    operator: (typeof source.operator === 'string'
      ? source.operator
      : 'gt') as AlertRule['operator'],
    threshold,
    duration,
    alertLevel,
    scope,
    scopeIds: plotId ? [plotId] : [],
    notifyChannels: typeof source.notifyChannels === 'string' ? source.notifyChannels : null,
    status,
    createdAt: typeof source.createdAt === 'string' ? source.createdAt : '',
  }
}

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
  /** 通知渠道（取值见 NOTIFY_CHANNEL_OPTIONS，与后端中文档案名一致） */
  notifyChannels: string[]
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
      notifyChannels: index % 2 === 0 ? '站内,短信' : '站内,微信',
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
 * 阈值缺失时显示「阈值 —」（不是 0、也不是 null 字符串）：0 会被读成"阈值就是 0"，
 * 与"后端没给这个字段"是两回事。
 *
 * @param rule 规则
 * @returns 表达式，如「空气温度 > 38℃ 持续 20 分钟」；阈值缺失时如「空气温度 > —」
 */
function renderCondition(rule: RuleView): string {
  const metric = METRIC_MAP[rule.metric] ?? { label: rule.metric, unit: '' }
  const thresholdText = rule.threshold === null ? MISSING_VALUE_TEXT : String(rule.threshold)
  const durationText =
    rule.duration !== null && rule.duration > 0 ? `，持续 ${rule.duration} 分钟` : ''
  return `${metric.label} ${OPERATOR_SYMBOL[rule.operator] ?? rule.operator} ${thresholdText}${
    metric.unit
  }${durationText}`
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

  // 后端直出 AlertRuleEntity，字段名与 types/alert.ts 的 AlertRule 并不一致
  // （threshold_value / duration_min / alert_level 字符串 / 无 scope 字段），
  // 走 toRuleView() 按实测契约逐字段映射，不再硬转。
  const remoteRows: RuleView[] = (listQuery.data?.list ?? []).map(toRuleView)
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

  /** 打开新增弹窗（表单回填统一在 {@link modalOpen} 的 effect 里做） */
  const openCreate = (): void => {
    setEditing(null)
    setModalOpen(true)
  }

  /** 打开编辑弹窗 */
  const openEdit = (rule: RuleView): void => {
    setEditing(rule)
    setModalOpen(true)
  }

  /**
   * 回填新增 / 编辑表单。
   *
   * ⚠️ 原来是在 `openCreate / openEdit` 里直接 `form.setFieldsValue()`，但 Modal 里的
   * Form 那一刻还没挂载，`useForm` 实例没连到任何 Form 元素，`setFieldsValue` 是空操作
   * （antd 只在 console 里警告 `Instance created by useForm is not connected to any Form
   * element`，页面上什么都不报、也不报错）。实测后果：
   * **点「编辑」弹出的是一张空表单**，六个必填项全空 → 提交被 `validateFields` 拦住，
   * 只弹「请完整填写规则信息」，规则根本改不了；新增同理（默认阈值 38、30 分钟也没带出来）。
   *
   * 只在弹窗真正打开之后（Modal 的 `afterOpenChange`）回填，此时 Form 已挂载。
   */
  const fillForm = (): void => {
    form.resetFields()
    if (editing) {
      form.setFieldsValue({
        ruleName: editing.ruleName,
        metric: editing.metric,
        operator: editing.operator,
        // 后端缺阈值 / 时长时表单留空（必填校验会拦住），不用 0 顶替
        threshold: editing.threshold ?? undefined,
        duration: editing.duration ?? undefined,
        alertLevel: editing.alertLevel,
        scope: editing.scope,
        scopeIds: editing.scopeIds ?? [],
        notifyChannels: parseNotifyChannels(editing.notifyChannels),
        notifyUserIds: editing.notifyUserIds ?? [],
        activeRange: editing.activeStart
          ? [dayjs(editing.activeStart, 'HH:mm'), dayjs(editing.activeEnd || '23:59', 'HH:mm')]
          : undefined,
      })
      return
    }
    form.setFieldsValue({
      operator: 'gt',
      alertLevel: 3,
      scope: 'plot',
      notifyChannels: ['站内'],
      duration: 30,
      metric: 'airTemperature',
      threshold: 38,
      activeRange: [dayjs('00:00', 'HH:mm'), dayjs('23:59', 'HH:mm')],
    })
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
      notifyChannels: values.notifyChannels.join(','),
      notifyUserIds: values.notifyUserIds ?? [],
      activeStart: values.activeRange?.[0]?.format('HH:mm'),
      activeEnd: values.activeRange?.[1]?.format('HH:mm'),
      status: editing?.status ?? 1,
    }
    setSubmitting(true)
    try {
      if (editing) {
        await updateAlertRule(editing.ruleId, toApiPayload(payload))
        setLocalRules((prev) =>
          prev.map((item) => (item.ruleId === editing.ruleId ? { ...item, ...payload } : item)),
        )
        message.success('规则已更新')
      } else {
        const created = await createAlertRule(toApiPayload(payload))
        const nextRule: RuleView = {
          ...(payload as RuleView),
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
    } catch (error) {
      /**
       * 写入服务端失败：本地仍然落一份以保证页面可交互，
       * 但**不能提示"已保存"**——必须说明"未同步服务端 + 刷新会丢 + 真实原因"。
       */
      const reason = errorMessageOf(error)
      if (editing) {
        setLocalRules((prev) =>
          prev.map((item) => (item.ruleId === editing.ruleId ? { ...item, ...payload } : item)),
        )
        setExtraRules((prev) =>
          prev.map((item) => (item.ruleId === editing.ruleId ? { ...item, ...payload } : item)),
        )
        message.warning(`规则未同步到服务端（${reason}），仅本页本地生效，刷新后会还原`)
      } else {
        setExtraRules((prev) => [
          {
            ...(payload as RuleView),
            ruleId: `LOCAL-RULE-${Date.now()}`,
            createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
          },
          ...prev,
        ])
        message.warning(`规则未写入服务端（${reason}），仅本页本地生效，刷新后会丢失`)
      }
      setModalOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  /**
   * 启停规则。
   *
   * 此前 `catch {}` 空吞后 `onSuccess` 恒触发「规则已启用 / 已停用」——
   * 后端 PATCH 失败时列表开关照样翻、照样报成功，用户以为生效了。
   * 现在把「是否真的写到服务端」作为结果的一部分带回 `onSuccess`，
   * 成功才说成功；失败说「未同步服务端 + 真实原因 + 刷新会还原」。
   */
  const toggleMutation = useMutation({
    mutationFn: async (payload: { rule: RuleView; status: 0 | 1 }) => {
      let remoteOk = true
      let reason = ''
      try {
        await updateAlertRuleStatus(payload.rule.ruleId, payload.status)
      } catch (error) {
        remoteOk = false
        reason = errorMessageOf(error)
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
      return { status: payload.status, remoteOk, reason }
    },
    onSuccess: ({ status, remoteOk, reason }) => {
      if (remoteOk) {
        message.success(status === 1 ? '规则已启用' : '规则已停用')
        void queryClient.invalidateQueries({ queryKey: ['production-alert-rules'] })
        return
      }
      message.warning(
        `${status === 1 ? '启用' : '停用'}未同步到服务端（${reason}），仅本页本地生效，刷新后会还原`,
      )
    },
  })

  /**
   * 删除规则。
   *
   * 同 {@link toggleMutation}：此前 `catch {}` 空吞后无条件报「规则已删除」，
   * 后端记录仍在，刷新就回来。现在按服务端是否真的删除分别提示。
   */
  const deleteMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      let remoteOk = true
      let reason = ''
      try {
        await deleteAlertRule(ruleId)
      } catch (error) {
        remoteOk = false
        reason = errorMessageOf(error)
      }
      setLocalRules((prev) => prev.filter((item) => item.ruleId !== ruleId))
      setExtraRules((prev) => prev.filter((item) => item.ruleId !== ruleId))
      return { remoteOk, reason }
    },
    onSuccess: ({ remoteOk, reason }) => {
      if (remoteOk) {
        message.success('规则已删除')
        void queryClient.invalidateQueries({ queryKey: ['production-alert-rules'] })
        return
      }
      message.warning(`删除未同步到服务端（${reason}），仅在本页移除，刷新后会重新出现`)
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
      render: (channels: RuleView['notifyChannels'], record) => {
        const list = parseNotifyChannels(channels)
        return (
          <Space size={4} wrap>
            {list.length === 0 ? (
              <Tooltip title={NOTIFY_CHANNEL_MISSING_TIP}>
                <Text type="secondary" style={{ cursor: 'help' }}>
                  {MISSING_VALUE_TEXT}
                </Text>
              </Tooltip>
            ) : (
              // 后端给的就是中文档案名，原样展示；不做任何本地编码换算
              list.map((item) => <Tag key={item}>{item}</Tag>)
            )}
            {(record.notifyUserIds ?? []).length > 0 && (
              <Tag color="purple">{record.notifyUserIds?.length} 人</Tag>
            )}
          </Space>
        )
      },
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
        afterOpenChange={(open: boolean) => {
          if (open) fillForm()
        }}
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
