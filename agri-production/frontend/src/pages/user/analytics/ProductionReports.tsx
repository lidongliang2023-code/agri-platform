/**
 * 页面名称：生产报表
 * 路由路径：/production/analytics/reports
 * 所属模块：报表与设置
 * PRD 序号：PRD 6.1 #44
 *
 * 还原要点（PRD 6.1 #44「报表生成、订阅、导出打印」）：
 * - 报表列表：报表名称、类型、统计周期、生成时间、生成人、文件大小、状态
 * - 生成报表：选模板（日报 / 周报 / 月报 / 季报 / 年报 + 专题模板）与统计周期，
 *   生成过程展示「生成中」并在完成后自动置为「已完成」
 * - 订阅：订阅周期（每日 / 每周 / 每月 / 每季）+ 接收渠道 + 接收人，支持停用与删除
 * - 导出 / 打印：优先调用后端导出接口获取文件地址，回落为前端 Blob 下载；
 *   打印输出独立可打印视图（window.print）
 *
 * 数据来源：`/analytics/reports`（列表 / 生成 / 删除 / 导出）、
 * `/analytics/reports/subscriptions`（订阅）。
 *
 * ⚠️ 本页**没有任何示例 / 兜底报表数据**（BT-33 已删除 16 条 `DEMO-REPORT-*`
 * 内置示例及其 `usingFallback` 回落机制）。用户端报表能力当前**后端确实没有**：
 * `GET /analytics/reports` 返回的是指标快照，另一个候选 `GET /admin/reports`
 * 是运营端监管报表（词表 / 生成人 / 农场范围都不对）。因此列表为空是**真实状态**，
 * 空态文案写明原因即可，不能用示例数据把页面"填起来"。
 *
 * 实测现状（逐条依据见 docs/backend-tickets.md BT-23 ~ BT-33）：
 * - 生成：`POST /analytics/reports` 不存在（实测 500）→ 点击如实报错，不造本地行；
 * - 删除：`DELETE /analytics/{id}` 删的是**指标快照**（错误实体）→ 只有「本页暂存」
 *   的行允许移除，服务端行的删除按钮置灰并写明原因（BT-27）；
 * - 导出：后端导出端点不存在 → 回落本地 CSV，文件名与提示均标注
 *   「本地生成，未同步服务端」，且 CSV 里**不含任何编造的业务指标**（BT-26）；
 * - 订阅：4 个订阅端点全部不存在（实测 500）→ 只落浏览器本地，页面常驻横幅
 *   明示「不会真的推送」（BT-24）。
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
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  BellOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FileTextOutlined,
  PlusOutlined,
  PrinterOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import useFarmStore from '@/store/farm'
import {
  deleteReport,
  exportReport,
  generateReport,
  listReportSubscriptions,
  listReports,
  subscribeReport,
  unsubscribeReport,
} from '@/api/analytics'
import { formatNumber } from '@/utils/production-adapter'
import { hasNonEmptyTextFields } from '@/utils/shape-guard'
import { asApiRequestError, httpStatusOf } from '@/utils/request'
import type { ReportItem, ReportType } from '@/types'
import type { ReportSubscription, SubscribePeriod } from '@/api/analytics'

const { Text } = Typography
const { RangePicker } = DatePicker

/** 报表类型文案 */
const REPORT_TYPE_LABEL: Record<number, string> = {
  1: '日报',
  2: '周报',
  3: '月报',
  4: '季报',
  5: '年报',
}

/** 报表模板（类型 + 专题名称） */
const REPORT_TEMPLATES: { value: string; label: string; type: ReportType }[] = [
  { value: 'daily-production', label: '生产日报（任务 / 采收 / 告警）', type: 1 },
  { value: 'weekly-production', label: '生产周报（进度 / 投入 / 质量）', type: 2 },
  { value: 'monthly-production', label: '生产月报（产量 / 成本 / 收益）', type: 3 },
  { value: 'quarterly-production', label: '生产季报（多农场对比）', type: 4 },
  { value: 'annual-production', label: '生产年报（全年经营分析）', type: 5 },
  { value: 'input-ledger', label: '专题：投入品台账', type: 3 },
  { value: 'harvest-stat', label: '专题：采收统计', type: 3 },
  { value: 'quality-stat', label: '专题：质量检测', type: 3 },
  { value: 'cost-profit', label: '专题：成本收益', type: 4 },
]

/** 订阅周期选项 */
const PERIOD_OPTIONS: { value: SubscribePeriod; label: string }[] = [
  { value: 'daily', label: '每日' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
  { value: 'quarterly', label: '每季' },
]

/** 订阅周期文案 */
const PERIOD_LABEL: Record<string, string> = {
  daily: '每日',
  weekly: '每周',
  monthly: '每月',
  quarterly: '每季',
}

/** 接收渠道选项 */
const CHANNEL_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: '站内消息' },
  { value: 2, label: '邮件' },
  { value: 3, label: '微信' },
]

/** 订阅本地持久化键 */
const SUBSCRIPTION_STORAGE_KEY = 'agri_report_subscriptions'

/*
 * 说明：这里曾有两套按 id 前缀识别"非服务端数据"的判断——
 *   `LOCAL_REPORT_ID_PREFIX` + `isLocalReport()`：BT-25 之后不再有任何代码造本地
 *     报表行（生成失败就是失败），没有生产者 → 已删；
 *   `DEMO_REPORT_ID_PREFIX` + `isDemoReport()`：BT-33 删掉 16 条内置示例报表后
 *     同样没有生产者 → 一并删。
 *
 * 现在只剩一种区分（见组件内 `isSessionReport`）：本次会话由「生成报表」
 * 真实成功后返回的、但还没进服务端列表的行。
 */

/**
 * 把写操作失败原因写成一句能据此排障的话（只陈述实测现象，不猜原因）。
 *
 * @param error catch 到的未知错误
 * @returns 失败原因描述
 */
function describeFailure(error: unknown): string {
  const apiError = asApiRequestError(error)
  if (apiError) {
    return `后端返回业务码 ${apiError.bizCode}（${apiError.message || '无提示'}）`
  }
  const status = httpStatusOf(error)
  if (status === 0) {
    return `无法连接到服务端（${(error as Error)?.message ?? '网络异常'}）`
  }
  return `HTTP ${status}（${(error as Error)?.message ?? '未知原因'}）`
}

/**
 * 后端「生成报表」能力当前不存在，点击后如实失败时的统一提示语。
 *
 * ⚠️ 不要为了消掉 500 而改打 `POST /analytics`：那是往**指标快照表**
 * （prod_analytics_snapshot）里插一条报表数据 —— 会把"假装成功"升级成
 * "真的把库写脏"。端点修好前保持失败态即可。
 */
const GENERATE_UNAVAILABLE_HINT =
  '报表生成服务未接入（后端 POST /analytics/reports 不存在），未生成任何文件'

/**
 * 删除不可用原因（BT-27）。
 *
 * 后端 `DELETE /analytics/{id}` 落到 `AnalyticsSnapshotService.delete()`，
 * 删的是**指标快照**（prod_analytics_snapshot），不是报表——删错实体。
 * 端点修正前，服务端行的删除按钮置灰，并把原因写在 tooltip 里，
 * 不能让使用者以为"点一下就删掉了"。
 */
const DELETE_UNAVAILABLE_REASON =
  '删除暂不可用：后端 DELETE /analytics/{id} 删的是指标快照（错误实体，见 BT-27 / 治理项 G-01），端点修正前不开放'

/*
 * ⚠️ 这里原本有 16 条 `DEMO_REPORT_ID_PREFIX`（`DEMO-REPORT-*`）内置示例报表，
 * 在列表接口报错（`usingFallback`）时铺满列表。BT-33 已裁决删除，理由：
 *
 * 1. 它掩盖的是**契约错位**而不是"暂时没数据"——页面打的是
 *    `GET /analytics/reports`，那个端点返回的是**指标快照**
 *    （`AnalyticsSnapshotService#reports` 查 `prod_analytics_snapshot`），
 *    从来就不是报表。铺上 16 条像模像样的"报表"，使用者会以为
 *    「报表功能已经能用，只是这批数据碰巧长这样」，反而没人去修端点。
 * 2. 另一个候选 `GET /admin/reports` 也不是答案（运营端监管报表：类型词表
 *    GOV/BIZ/QUALITY ≠ 本页日报/周报/月报；生成人恒为 SUPER_ADMIN；
 *    不接受 farmId；隔离只到 market_id，会把全市场的报表列给用户端农场）。
 *    → 既然"改端点"这条路不通，就该**如实承认用户端报表能力不存在**。
 * 3. `usingFallback` 这条分支本身也随之删除——没有生产者就别留机制，
 *    留着迟早被当成"合法的兜底写法"复制到别的页面。
 *
 * 现在的口径：接口报错 / 返回空 / 形状不对，一律走空态 + 写明真实原因。
 */

/**
 * 按「报表类型 + 关键字」过滤一行报表。
 *
 * @param item 报表行
 * @param type 报表类型过滤值，为空表示不过滤
 * @param kw 已转小写并 trim 过的关键字
 * @returns 命中过滤时返回 true
 */
function matchFilter(item: ReportItem, type: number | undefined, kw: string): boolean {
  if (type && item.reportType !== type) return false
  if (kw && !`${item.reportName} ${item.period}`.toLowerCase().includes(kw)) return false
  return true
}

/**
 * 格式化文件大小
 *
 * @param size 字节数
 * @returns 可读文本
 */
function formatFileSize(size?: number): string {
  if (!size) return '-'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(2)} MB`
}

/**
 * 触发浏览器下载
 *
 * @param filename 文件名
 * @param content 文本内容
 * @param mime MIME 类型
 * @returns void
 */
function downloadBlob(filename: string, content: string, mime: string): void {
  const blob = new Blob([`\uFEFF${content}`], { type: `${mime};charset=utf-8;` })
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
 * 生成报表导出内容（CSV）
 *
 * ⚠️ 旧实现在末尾硬编码了 5 行"业务指标"（在种面积 2500 / 本月采收量 12850 /
 * 任务完成率 92.8 / 质量合格率 98.6 / 投入产出比 3.42）。那是**编造的业务数据**——
 * 落到用户磁盘上就是一份看起来有内容的假报表，比在页面上显示更难被发现。
 * BT-26 已删除：CSV 只写这一行报表**自身的真实字段**，后端没给明细指标就写明
 * "无"，绝不补数。
 *
 * @param report 报表
 * @returns CSV 文本
 */
function buildReportCsv(report: ReportItem): string {
  const rows: string[][] = []
  rows.push(['项目', '内容'])
  rows.push(['报表名称', report.reportName])
  rows.push(['报表类型', REPORT_TYPE_LABEL[report.reportType] ?? '其他'])
  rows.push(['统计周期', report.period])
  rows.push(['生成时间', report.generatedAt])
  rows.push(['生成人', report.generatorName ?? '系统自动'])
  rows.push([
    '状态',
    report.status === 2 ? '已完成' : report.status === 1 ? '生成中' : '失败',
  ])
  rows.push(['文件大小', formatFileSize(report.fileSize)])
  rows.push(['数据来源', '本页当前展示的字段；后端未提供报表明细'])
  rows.push(['', ''])
  rows.push(['指标', '数值'])
  rows.push(['后端未提供报表明细指标，本文件不含任何业务指标数值', ''])
  return rows.map((row) => row.join(',')).join('\n')
}

/**
 * 打开可打印视图
 *
 * @param report 报表
 * @returns void
 */
function printReport(report: ReportItem): void {
  const rows: string[][] = [
    ['报表名称', report.reportName],
    ['报表类型', REPORT_TYPE_LABEL[report.reportType] ?? '其他'],
    ['统计周期', report.period],
    ['生成时间', report.generatedAt],
    ['生成人', report.generatorName ?? '系统自动'],
    ['文件大小', formatFileSize(report.fileSize)],
  ]
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${report.reportName}</title>
<style>body{font-family:'Microsoft YaHei',sans-serif;padding:24px;color:#222}h1{font-size:20px;margin-bottom:16px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:8px 12px;font-size:14px}th{background:#f5f5f5;width:140px;text-align:left}</style>
</head><body><h1>${report.reportName}</h1><table>${rows
    .map((row) => `<tr><th>${row[0]}</th><td>${row[1]}</td></tr>`)
    .join('')}</table></body></html>`
  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  win.print()
}

/** 生成表单字段 */
interface GenerateFormValues {
  /** 报表模板 */
  template: string
  /** 统计周期 */
  range: [dayjs.Dayjs, dayjs.Dayjs]
}

/** 订阅表单字段 */
interface SubscribeFormValues {
  /** 报表模板 */
  template: string
  /** 订阅周期 */
  period: SubscribePeriod
  /** 接收渠道 */
  channels: number[]
  /** 接收人 */
  receivers: string[]
}

/**
 * 生产报表
 *
 * 业务职责：报表生成、订阅管理与导出打印。
 *
 * @returns 页面内容
 */
export default function ProductionReports(): JSX.Element {
  const { message } = AntdApp.useApp()
  const queryClient = useQueryClient()
  const farmId = useFarmStore((state) => state.currentFarm?.farmId)

  const [pageNum, setPageNum] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(10)
  const [typeFilter, setTypeFilter] = useState<number | undefined>(undefined)
  const [keyword, setKeyword] = useState<string>('')

  /** 生成弹窗 */
  const [generateOpen, setGenerateOpen] = useState<boolean>(false)
  const [generating, setGenerating] = useState<boolean>(false)
  const [generateForm] = Form.useForm<GenerateFormValues>()

  /** 订阅弹窗 */
  const [subscribeOpen, setSubscribeOpen] = useState<boolean>(false)
  const [subscribeForm] = Form.useForm<SubscribeFormValues>()

  /** 本次会话由「生成报表」成功返回后新增的报表（服务端生成，只是还没进列表） */
  const [extraReports, setExtraReports] = useState<ReportItem[]>([])
  /** 使用者在本页移除的行 id（示例行不在服务端，只能从本页消失） */
  const [hiddenIds, setHiddenIds] = useState<string[]>([])
  /** 订阅列表 */
  const [subscriptions, setSubscriptions] = useState<ReportSubscription[]>([])
  /**
   * 订阅未同步到服务端的**真实原因**（端点不存在时由实测写入）。
   * 用于常驻横幅——不能只靠 3 秒就消失的 toast 说明"未同步"。
   */
  const [subscribeNote, setSubscribeNote] = useState<string | null>(null)

  /** 报表列表 */
  const listQuery = useQuery({
    queryKey: ['production-reports', farmId, pageNum, pageSize, typeFilter, keyword],
    queryFn: () =>
      listReports({
        pageNum,
        pageSize,
        reportType: typeFilter,
        period: keyword || undefined,
      }),
  })

  /** 订阅列表 */
  const subscriptionQuery = useQuery({
    queryKey: ['production-report-subscriptions'],
    queryFn: () => listReportSubscriptions(),
  })

  /** 同步订阅：接口优先，其次本地存储 */
  useEffect(() => {
    const remote = subscriptionQuery.data
    if (Array.isArray(remote) && remote.length > 0) {
      setSubscriptions(remote)
      return
    }
    try {
      const raw = localStorage.getItem(SUBSCRIPTION_STORAGE_KEY)
      if (raw) {
        setSubscriptions(JSON.parse(raw) as ReportSubscription[])
      }
    } catch {
      setSubscriptions([])
    }
  }, [subscriptionQuery.data])

  /**
   * 持久化订阅到本地
   * @param next 订阅列表
   * @returns void
   */
  const persistSubscriptions = (next: ReportSubscription[]): void => {
    setSubscriptions(next)
    try {
      localStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // 忽略存储失败
    }
  }

  /** 接口原始返回行（形状未校验，可能是指标快照而不是报表） */
  const rawRows: ReportItem[] = listQuery.data?.list ?? []
  /**
   * 形状校验（实测依据见 @/utils/shape-guard）：
   * `GET /analytics/reports` 当前返回的是**指标快照**
   * `{ metricCode, metricName, metricValue, unit, bizDate }`，不是报表——
   * 没有 reportId / reportName / reportType / period。
   * 因此以「同时具备 reportId 与 reportName」作为「这是一份报表」的最小必要形状，
   * 不满足的行一律不展示（不能用指标冒充报表行：三列全空比空列表更难读）。
   */
  const remoteRows: ReportItem[] = rawRows.filter((item) =>
    hasNonEmptyTextFields(item, ['reportId', 'reportName']),
  )
  /**
   * 接口通了、也返了数据，但没有一行是报表。
   *
   * 当前 `/analytics/reports` 就是这种情况（返回指标快照）。此时**不**回落示例
   * 报表（会掩盖真实状态），也**不**把指标拼成报表行（三列全空更难读），
   * 走空态 + 明示说明，把「后端返回的是什么」直接写给使用者看。
   *
   * 但用户自己点「生成报表」真实成功后返回的 `extraReports` **不在此列**：
   * 那是使用者主动操作产生的数据，不是开发者编造的示例，不能因为服务端列表
   * 返的不是报表就让它凭空消失。故此处仍然展示，并打标区分来源。
   */
  const shapeMismatch: boolean =
    !listQuery.isLoading && rawRows.length > 0 && remoteRows.length === 0

  /**
   * 空态原因（BT-33：不回落示例数据，改为把真实原因写出来）。
   *
   * 三种情况分别给不同文案，避免一律说"暂无数据"——
   * "接口挂了"和"后端没这个能力"对使用者是完全不同的两件事。
   */
  const emptyReason: string = (() => {
    if (listQuery.isLoading) return ''
    if (listQuery.isError) {
      return `报表列表接口请求失败：${describeFailure(listQuery.error)}`
    }
    if (shapeMismatch) {
      return `后端暂未提供用户端报表能力：GET /analytics/reports 本次返回 ${rawRows.length} 条记录，均为指标快照（metricCode / metricName / metricValue / unit / bizDate），不含 reportId / reportName / reportType，因此不作为报表展示`
    }
    return '服务端当前没有任何报表记录'
  })()

  /** 最终报表数据：服务端报表行 + 本次会话生成的行，不做任何示例兜底 */
  const { rows, total } = useMemo<{ rows: ReportItem[]; total: number }>(() => {
    // 关键字先归一化（trim + 转小写）
    const kw = keyword.trim().toLowerCase()
    const visible = [...extraReports, ...remoteRows].filter(
      (item) => matchFilter(item, typeFilter, kw) && !hiddenIds.includes(item.reportId),
    )
    // 服务端分页只对 remoteRows 有意义；这里合并后统一前端切片，避免 total 撒谎
    const start = (pageNum - 1) * pageSize
    return { rows: visible.slice(start, start + pageSize), total: visible.length }
  }, [remoteRows, typeFilter, keyword, pageNum, pageSize, extraReports, hiddenIds])

  /**
   * 本次会话新增行的 reportId 集合。
   *
   * 这些行是「生成报表」真实成功后返回的，但服务端列表接口当前返回的是指标快照，
   * 刷新后不会出现，所以先留在本页状态里并打标，避免看起来像凭空冒出来。
   */
  const extraIds = useMemo<Set<string>>(
    () => new Set(extraReports.map((item) => item.reportId)),
    [extraReports],
  )

  /**
   * 判断一行是不是**本次会话生成的**（服务端返回了，但还没进服务端列表）。
   *
   * 只有这类行的「移除」是纯前端操作、且能如实说明；服务端列表返回的行不在此列——
   * 它们的删除端点删错实体，按钮必须置灰（BT-27）。
   *
   * @param report 报表行
   * @returns 是本次会话生成的行时返回 true
   */
  const isSessionReport = (report: ReportItem | undefined | null): boolean => {
    if (!report || typeof report.reportId !== 'string') return false
    return extraIds.has(report.reportId)
  }

  /**
   * 提交生成报表。
   *
   * ⚠️ 历史实现（已删除，见 docs/backend-tickets.md BT-25）：
   * 先在本地塞一条 `draft`，后端失败被 `catch {}` **完全静默**，然后**无条件**
   * `setTimeout(…, 2500)` 把该行改成 `status: 2`（已完成）+ `fileSize: 156 * 1024`
   * （**硬编码 156KB**）+ `fileUrl: ''`，并弹「生成完成」。
   * 实测 `POST /analytics/reports` 返回 500（端点不存在），所以那套流程从状态到
   * 文件大小到成功提示 **没有一处是真实数据**——属于"写操作谎称成功"。
   *
   * 现在：后端成不成功以**服务端返回**为准。端点不存在就如实报错，
   * 不造本地行、不定时把状态改成"已完成"、不硬编码文件大小。
   *
   * @returns Promise
   */
  const submitGenerate = async (): Promise<void> => {
    let values: GenerateFormValues
    try {
      values = await generateForm.validateFields()
    } catch {
      message.warning('请选择报表模板与统计周期')
      return
    }
    const template = REPORT_TEMPLATES.find((item) => item.value === values.template)
    const period = values.range[0].format('YYYY-MM-DD')
    setGenerating(true)
    try {
      const created = await generateReport({
        reportType: template?.type ?? 3,
        period,
        farmId,
      })
      if (!created?.reportId) {
        // 端点不存在时后端不会给 reportId，这里如实失败，绝不补一条本地行冒充
        message.error(`生成失败：${GENERATE_UNAVAILABLE_HINT}`)
        return
      }
      setExtraReports((prev) => [{ ...created }, ...prev])
      message.success(`${created.reportName ?? '报表'} 已由服务端生成`)
    } catch (error) {
      message.error(`生成失败：${describeFailure(error)}。${GENERATE_UNAVAILABLE_HINT}`)
    } finally {
      setGenerating(false)
      setGenerateOpen(false)
    }
    void queryClient.invalidateQueries({ queryKey: ['production-reports'] })
  }

  /**
   * 导出报表（BT-26）。
   *
   * 两条硬规矩：
   * 1. **示例数据不可导出**——导出来的 CSV 会被当成真有一份报表，属于把假数据
   *    落到用户磁盘上，比在页面上显示更严重；
   * 2. 后端 `GET /analytics/reports/{id}/export` 实测 500（端点不存在），
   *    回落本地 CSV 时必须明示「本地生成，未同步服务端」，不能只说"已导出"。
   *
   * 注：BT-33 删掉内置示例报表后，"示例行禁导出"这个分支已无生产者，一并删除。
   *
   * @param report 报表
   * @returns Promise
   */
  const handleExport = async (report: ReportItem): Promise<void> => {
    try {
      const res = await exportReport(report.reportId)
      if (res?.fileUrl) {
        window.open(res.fileUrl, '_blank')
        message.success('已打开服务端导出文件')
        return
      }
      message.warning('后端未返回导出文件地址')
    } catch (error) {
      // 后端无导出能力 → 本地拼 CSV，但必须说清楚这是本地产物
      message.warning(`后端导出不可用（${describeFailure(error)}），以下为本地生成的文件`)
    }
    downloadBlob(`本地导出-${report.reportName}.csv`, buildReportCsv(report), 'text/csv')
    message.success('已导出 CSV（本地生成，未同步服务端）')
  }

  /**
   * 删除报表（BT-27）。
   *
   * 旧实现：`void deleteReport(id).catch(() => undefined)` 之后**无条件**
   * `message.success('报表已删除')` —— 后端删没删不知道，前端一律报成功。
   * 且实测 `DELETE /analytics/{id}` 删的是**指标快照**（删错实体），
   * 在端点修正前这个按钮不能看起来"能删"。
   *
   * 本次会话生成的行还没进服务端列表，从列表移除是**纯前端状态**操作，
   * 这部分照常做，但提示语要说明它本来就不在服务端。
   *
   * @param report 报表
   * @returns Promise
   */
  const handleDelete = async (report: ReportItem): Promise<void> => {
    if (isSessionReport(report)) {
      // 纯前端状态操作：这一行本来就不在服务端报表列表里，移除它不产生任何服务端影响
      setExtraReports((prev) => prev.filter((item) => item.reportId !== report.reportId))
      setHiddenIds((prev) => [...prev, report.reportId])
      void queryClient.invalidateQueries({ queryKey: ['production-reports'] })
      message.success('已移除本页记录（该记录不在服务端报表列表中）')
      return
    }
    /*
     * 服务端返回的报表行：删除端点当前删的是指标快照（错误实体，BT-27 / G-01）。
     * 页面上按钮已置灰，这里保留的是「端点修好之后的验收口径」——
     * 必须拿到"确有记录被删除"的返回才算成功，返回成功但没删掉任何行要如实报错。
     */
    try {
      const deleted = await deleteReport(report.reportId)
      if (!deleted) {
        // 后端返回成功但没删掉任何行（见治理项 G-01），如实说没删成
        message.error('删除未生效：后端返回成功但没有记录被删除')
        return
      }
      void queryClient.invalidateQueries({ queryKey: ['production-reports'] })
      message.success('报表已删除')
    } catch (error) {
      message.error(`删除失败，未执行删除：${describeFailure(error)}`)
    }
  }

  /**
   * 提交订阅（BT-24）。
   *
   * 订阅 4 个端点实测全部 500（不存在），所以这里只能落到浏览器本地。
   * 按手册规矩：本地暂存必须**明示未同步服务端**——成功提示改口径，
   * 页面上另有常驻横幅（见订阅卡片顶部）。
   *
   * @returns Promise
   */
  const submitSubscribe = async (): Promise<void> => {
    let values: SubscribeFormValues
    try {
      values = await subscribeForm.validateFields()
    } catch {
      message.warning('请完整填写订阅配置')
      return
    }
    const template = REPORT_TEMPLATES.find((item) => item.value === values.template)
    const payload = {
      reportType: template?.type ?? 3,
      period: values.period,
      channels: values.channels,
      receivers: values.receivers ?? [],
      status: 1 as 0 | 1,
    }
    let synced = false
    try {
      await subscribeReport(payload)
      synced = true
    } catch (error) {
      // 端点不存在（实测 500）：不再静默，把原因记下来给常驻横幅用
      setSubscribeNote(`订阅未同步到服务端：${describeFailure(error)}`)
    }
    const next: ReportSubscription = {
      ...payload,
      subscribeId: `LOCAL-SUB-${Date.now()}`,
      updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    }
    persistSubscriptions([next, ...subscriptions])
    setSubscribeOpen(false)
    if (synced) {
      message.success('订阅已保存到服务端')
    } else {
      message.warning('订阅仅保存在本浏览器，不会推送，也未同步到服务端')
    }
  }

  /** 删除订阅 */
  const removeSubscription = async (subscribeId: string): Promise<void> => {
    let synced = false
    try {
      await unsubscribeReport(subscribeId)
      synced = true
    } catch {
      // 端点不存在：只在本地移除，提示语如实说明
    }
    persistSubscriptions(subscriptions.filter((item) => item.subscribeId !== subscribeId))
    if (synced) {
      message.success('订阅已取消（服务端已同步）')
    } else {
      message.warning('已在本浏览器移除该订阅；服务端未同步（订阅端点不存在）')
    }
  }

  /** 启停订阅 */
  const toggleSubscription = (subscribeId: string, status: 0 | 1): void => {
    persistSubscriptions(
      subscriptions.map((item) =>
        item.subscribeId === subscribeId
          ? { ...item, status, updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss') }
          : item,
      ),
    )
  }

  /** 表格列定义 */
  const columns: ColumnsType<ReportItem> = [
    {
      title: '报表名称',
      dataIndex: 'reportName',
      render: (value: string, record) => (
        <Space direction="vertical" size={0}>
          <Space size={6}>
            <FileTextOutlined />
            <Text strong>{value}</Text>
            <Tag color="blue">{REPORT_TYPE_LABEL[record.reportType] ?? '其他'}</Tag>
            {/*
              本次会话生成的行还没进服务端列表，必须标出来；
              不标的话使用者会以为它已经在服务端了。
            */}
            {extraIds.has(record.reportId) ? <Tag color="orange">本次生成</Tag> : null}
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            周期 {record.period}
          </Text>
        </Space>
      ),
    },
    {
      title: '生成时间',
      dataIndex: 'generatedAt',
      width: 170,
    },
    {
      title: '生成人',
      dataIndex: 'generatorName',
      width: 120,
      render: (value?: string) => value || '系统自动',
    },
    {
      title: '文件大小',
      dataIndex: 'fileSize',
      width: 110,
      render: (value?: number) => formatFileSize(value),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: number) => {
        if (status === 1) return <Tag color="processing">生成中</Tag>
        if (status === 3) return <Tag color="error">生成失败</Tag>
        return <Tag color="success">已完成</Tag>
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 230,
      fixed: 'right',
      render: (_value: unknown, record) => (
        <Space size={0}>
          <Button
            type="link"
            size="small"
            icon={<DownloadOutlined />}
            disabled={record.status !== 2}
            onClick={() => void handleExport(record)}
          >
            导出
          </Button>
          <Button
            type="link"
            size="small"
            icon={<PrinterOutlined />}
            disabled={record.status !== 2}
            onClick={() => printReport(record)}
          >
            打印
          </Button>
          {isSessionReport(record) ? (
            <Popconfirm
              title="确认移除该报表？"
              description="该行不在服务端，移除只是从本页消失，不影响任何服务端数据。"
              onConfirm={() => void handleDelete(record)}
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                移除
              </Button>
            </Popconfirm>
          ) : (
            // 服务端行的删除端点删错实体（BT-27）：置灰 + 写明原因，不能看着"能删"
            <Tooltip title={DELETE_UNAVAILABLE_REASON}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled>
                删除
              </Button>
            </Tooltip>
          )}
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
                <FileTextOutlined style={{ fontSize: 20, color: '#1677ff' }} />
                <span style={{ fontSize: 18, fontWeight: 600 }}>生产报表</span>
                <Text type="secondary">
                  共 {formatNumber(total)} 份报表 · {subscriptions.length} 项订阅
                </Text>
              </Space>
            </Col>
            <Col>
              <Space>
                <Button
                  icon={<BellOutlined />}
                  onClick={() => {
                    subscribeForm.resetFields()
                    subscribeForm.setFieldsValue({
                      template: 'daily-production',
                      period: 'daily',
                      channels: [1],
                      receivers: [],
                    })
                    setSubscribeOpen(true)
                  }}
                >
                  订阅报表
                </Button>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    generateForm.resetFields()
                    generateForm.setFieldsValue({
                      template: 'daily-production',
                      range: [dayjs().subtract(6, 'day'), dayjs()],
                    })
                    setGenerateOpen(true)
                  }}
                >
                  生成报表
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>

        <Card>
          <Space wrap size={12} style={{ marginBottom: 16 }}>
            <Select
              allowClear
              placeholder="报表类型"
              style={{ width: 150 }}
              value={typeFilter}
              onChange={(value) => {
                setTypeFilter(value)
                setPageNum(1)
              }}
              options={[1, 2, 3, 4, 5].map((value) => ({
                value,
                label: REPORT_TYPE_LABEL[value],
              }))}
            />
            <Input.Search
              allowClear
              placeholder="报表名称 / 周期"
              style={{ width: 220 }}
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onSearch={() => setPageNum(1)}
            />
          </Space>

          {/*
            空态：BT-33 起不再回落任何示例报表，改用 Empty + 真实原因。
            原因分三种（接口失败 / 返回的是指标快照 / 确实没有记录），
            不能一律说"暂无数据"——"接口挂了"和"后端没这个能力"是两件事。
          */}
          {rows.length === 0 && !listQuery.isLoading ? (
            <Empty
              style={{ margin: '24px 0' }}
              description={
                <Space direction="vertical" size={4}>
                  <Text strong>暂无报表</Text>
                  <Text type="secondary" style={{ maxWidth: 620, display: 'inline-block' }}>
                    {emptyReason}
                  </Text>
                  <Text type="secondary" style={{ maxWidth: 620, display: 'inline-block' }}>
                    「生成报表」当前也会如实报错（后端 POST /analytics/reports 不存在，
                    实测返回 500），不会产生任何报表文件。
                  </Text>
                </Space>
              }
            />
          ) : null}

          <Spin spinning={listQuery.isLoading || generating}>
            <Table<ReportItem>
              rowKey="reportId"
              columns={columns}
              dataSource={rows}
              locale={{ emptyText: emptyReason || '暂无报表' }}
              scroll={{ x: 1100 }}
              pagination={{
                current: pageNum,
                pageSize,
                total,
                showSizeChanger: true,
                showTotal: (value) => `共 ${value} 份`,
                onChange: (page, size) => {
                  setPageNum(page)
                  setPageSize(size)
                },
              }}
            />
          </Spin>
        </Card>

        <Card title="报表订阅">
          {/*
            订阅只落在浏览器 localStorage，服务端 4 个订阅端点实测全部 500（不存在），
            所以**不会真的推送**。这条横幅常驻——只弹 toast 的话，3 秒后列表里
            仍是一套服务端并不存在、也不会执行的"订阅"。
          */}
          {subscriptions.length > 0 ? (
            <Alert
              showIcon
              type="warning"
              banner
              style={{ marginBottom: 12 }}
              message="以下订阅配置仅保存在本浏览器（localStorage），未同步服务端，不会真的推送"
              description={subscribeNote ?? '订阅端点当前不可用（POST/GET/PUT/DELETE /analytics/reports/subscriptions 实测均返回 500），换浏览器或清缓存后配置会丢失。'}
            />
          ) : null}
          {subscriptions.length === 0 ? (
            <Empty description="暂无订阅，点击右上角「订阅报表」按周期自动推送" />
          ) : (
            <Table<ReportSubscription>
              rowKey="subscribeId"
              pagination={false}
              dataSource={subscriptions}
              columns={[
                {
                  title: '报表类型',
                  dataIndex: 'reportType',
                  render: (value: number) => (
                    <Tag color="blue">{REPORT_TYPE_LABEL[value] ?? '其他'}</Tag>
                  ),
                },
                {
                  title: '订阅周期',
                  dataIndex: 'period',
                  width: 100,
                  render: (value: string) => PERIOD_LABEL[value] ?? value,
                },
                {
                  title: '接收渠道',
                  dataIndex: 'channels',
                  render: (channels: number[]) => (
                    <Space size={4} wrap>
                      {(channels ?? []).map((item) => (
                        <Tag key={item}>
                          {CHANNEL_OPTIONS.find((option) => option.value === item)?.label ?? '其他'}
                        </Tag>
                      ))}
                    </Space>
                  ),
                },
                {
                  title: '接收人',
                  dataIndex: 'receivers',
                  render: (receivers: string[]) =>
                    (receivers ?? []).length > 0 ? receivers.join('、') : '-',
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
                      onChange={(checked) => toggleSubscription(record.subscribeId, checked ? 1 : 0)}
                    />
                  ),
                },
                {
                  title: '操作',
                  key: 'action',
                  width: 90,
                  render: (_value: unknown, record) => (
                    <Popconfirm
                      title="确认取消该订阅？"
                      onConfirm={() => void removeSubscription(record.subscribeId)}
                    >
                      <Button type="link" size="small" danger>
                        取消
                      </Button>
                    </Popconfirm>
                  ),
                },
              ]}
            />
          )}
        </Card>
      </Space>

      {/* 生成报表 */}
      <Modal
        title="生成生产报表"
        open={generateOpen}
        onCancel={() => setGenerateOpen(false)}
        onOk={() => void submitGenerate()}
        confirmLoading={generating}
        width={560}
      >
        <Form form={generateForm} layout="vertical">
          {/* 后端没有生成能力，先把话说明白：点击后会如实报错，不会"转两秒就完成" */}
          <Alert
            showIcon
            type="warning"
            style={{ marginBottom: 16 }}
            message="报表生成服务未接入"
            description="后端 POST /analytics/reports 当前不存在（实测返回 500）。点击「确定」会如实报错，不会产生任何报表文件。"
          />
          <Form.Item
            name="template"
            label="报表模板"
            rules={[{ required: true, message: '请选择报表模板' }]}
          >
            <Select
              options={REPORT_TEMPLATES.map((item) => ({ value: item.value, label: item.label }))}
              placeholder="请选择模板"
            />
          </Form.Item>
          <Form.Item
            name="range"
            label="统计周期"
            rules={[{ required: true, message: '请选择统计周期' }]}
          >
            <RangePicker style={{ width: '100%' }} allowClear={false} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 订阅报表 */}
      <Modal
        title="订阅生产报表"
        open={subscribeOpen}
        onCancel={() => setSubscribeOpen(false)}
        onOk={() => void submitSubscribe()}
        width={560}
      >
        <Form form={subscribeForm} layout="vertical">
          <Form.Item
            name="template"
            label="报表模板"
            rules={[{ required: true, message: '请选择报表模板' }]}
          >
            <Select
              options={REPORT_TEMPLATES.map((item) => ({ value: item.value, label: item.label }))}
              placeholder="请选择模板"
            />
          </Form.Item>
          <Form.Item
            name="period"
            label="订阅周期"
            rules={[{ required: true, message: '请选择订阅周期' }]}
          >
            <Select options={PERIOD_OPTIONS} placeholder="请选择周期" />
          </Form.Item>
          <Form.Item
            name="channels"
            label="接收渠道"
            rules={[{ required: true, message: '请选择接收渠道' }]}
          >
            <Select mode="multiple" options={CHANNEL_OPTIONS} placeholder="请选择渠道" />
          </Form.Item>
          <Form.Item name="receivers" label="接收人">
            <Select
              mode="tags"
              placeholder="输入姓名后回车，如：张三"
              tokenSeparators={[',', '，']}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
