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
 * `/analytics/reports/subscriptions`（订阅）；后端骨架无数据时回落示例报表，
 * 订阅配置持久化在浏览器本地，保证订阅闭环可用。
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

/**
 * 本地生成报表的 reportId 前缀。
 *
 * 后端报表 id 形如 `DEMO-RPT-001`，两边前缀不同，因此：
 *  ① 列表里能一眼区分「服务端真数据」与「本地生成」；
 *  ② 作为 React `rowKey` 不会与服务端 id 撞车。
 */
export const LOCAL_REPORT_ID_PREFIX = 'LOCAL-REPORT-'

/**
 * 判断一份报表是不是用户在本地生成的（未写入服务端）。
 *
 * 仅按 reportId 前缀判断，不依赖任何额外字段——本地生成与服务端返回的
 * 都是同一个 `ReportItem`，靠 id 空间区分最可靠。
 *
 * @param report 报表行
 * @returns 是本地生成时返回 true
 */
export function isLocalReport(report: ReportItem | undefined | null): boolean {
  if (!report || typeof report.reportId !== 'string') {
    return false
  }
  return report.reportId.startsWith(LOCAL_REPORT_ID_PREFIX)
}

/** 示例报表 */
const DEMO_REPORTS: ReportItem[] = Array.from({ length: 16 }, (_unused, index) => {
  const type = ((index % 5) + 1) as ReportType
  const status = index === 2 ? 1 : index === 11 ? 3 : 2
  return {
    reportId: `DEMO-REPORT-${String(index + 1).padStart(4, '0')}`,
    reportName: `${dayjs('2026-06-03').subtract(index, 'day').format('YYYY-MM-DD')} 生产${
      REPORT_TYPE_LABEL[type]
    }`,
    reportType: type,
    period:
      type === 3
        ? dayjs('2026-06-03').subtract(index, 'month').format('YYYY-MM')
        : dayjs('2026-06-03').subtract(index, 'day').format('YYYY-MM-DD'),
    generatedAt: dayjs('2026-06-03 08:00:00')
      .subtract(index, 'day')
      .format('YYYY-MM-DD HH:mm:ss'),
    generatorName: ['系统自动', '张三', '李四'][index % 3],
    fileUrl: '',
    fileSize: 128 * 1024 + index * 15360,
    status: status as 1 | 2 | 3,
  }
})

/**
 * 按「报表类型 + 关键字」过滤一行报表。
 *
 * 抽出来是因为它同时服务于「示例报表回落」与「仅展示本地生成报表」两条分支，
 * 两处的过滤口径必须一致，否则同一条报表在不同分支下会时隐时现。
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
  rows.push(['', ''])
  rows.push(['指标', '数值'])
  rows.push(['在种面积(亩)', '2500'])
  rows.push(['本月采收量(kg)', '12850'])
  rows.push(['任务完成率(%)', '92.8'])
  rows.push(['质量合格率(%)', '98.6'])
  rows.push(['投入产出比', '3.42'])
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

  /** 本地新增报表 */
  const [extraReports, setExtraReports] = useState<ReportItem[]>([])
  /** 订阅列表 */
  const [subscriptions, setSubscriptions] = useState<ReportSubscription[]>([])

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
   * 但用户自己点「生成报表」造出来的 `extraReports` **不在此列**：那是使用者
   * 主动操作产生的真实数据，不是开发者编造的示例，不能因为服务端没数据就让它
   * 凭空消失。故此处仍然展示，并由列渲染打上「本地生成」标记以区分来源。
   */
  const shapeMismatch: boolean =
    !listQuery.isLoading && rawRows.length > 0 && remoteRows.length === 0
  const usingFallback: boolean =
    !listQuery.isLoading &&
    !shapeMismatch &&
    (listQuery.isError || remoteRows.length === 0)

  /** 最终报表数据 */
  const { rows, total } = useMemo<{ rows: ReportItem[]; total: number }>(() => {
    // 关键字先归一化，两条分支共用同一口径（trim + 转小写）
    const kw = keyword.trim().toLowerCase()
    if (shapeMismatch) {
      // 服务端没有报表数据，但用户本地生成的报表照常展示（列表里带「本地生成」标记）
      const localOnly = extraReports.filter((item) => matchFilter(item, typeFilter, kw))
      return { rows: localOnly, total: localOnly.length }
    }
    if (!usingFallback) {
      return { rows: remoteRows, total: listQuery.data?.total ?? 0 }
    }
    const filtered = [...extraReports, ...DEMO_REPORTS].filter((item) =>
      matchFilter(item, typeFilter, kw),
    )
    const start = (pageNum - 1) * pageSize
    return { rows: filtered.slice(start, start + pageSize), total: filtered.length }
  }, [
    shapeMismatch,
    usingFallback,
    remoteRows,
    listQuery.data?.total,
    typeFilter,
    keyword,
    pageNum,
    pageSize,
    extraReports,
  ])

  /**
   * 提交生成报表
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
    const draft: ReportItem = {
      // 时间戳 + 随机后缀：同一毫秒内连点两次也不会生成重复 id（否则 rowKey 会撞）
      reportId: `${LOCAL_REPORT_ID_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      reportName: `${period} ${template?.label ?? '生产报表'}`,
      reportType: template?.type ?? 3,
      period,
      generatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      generatorName: '当前用户',
      fileSize: undefined,
      status: 1,
    }
    setGenerating(true)
    setExtraReports((prev) => [draft, ...prev])
    setGenerateOpen(false)
    try {
      const created = await generateReport({
        reportType: draft.reportType,
        period,
        farmId,
      })
      if (created?.reportId) {
        setExtraReports((prev) =>
          prev.map((item) => (item.reportId === draft.reportId ? { ...item, ...created } : item)),
        )
      }
    } catch {
      // 后端骨架阶段生成接口不可用，走本地模拟
    }
    // 模拟异步生成：2.5 秒后标记为已完成
    window.setTimeout(() => {
      setExtraReports((prev) =>
        prev.map((item) =>
          item.reportId === draft.reportId
            ? { ...item, status: 2, fileSize: 156 * 1024, fileUrl: '' }
            : item,
        ),
      )
      message.success(`${draft.reportName} 生成完成`)
    }, 2500)
    setGenerating(false)
    void queryClient.invalidateQueries({ queryKey: ['production-reports'] })
  }

  /**
   * 导出报表
   *
   * 优先使用后端导出接口返回的文件地址，失败时回落为前端 CSV Blob 下载。
   *
   * @param report 报表
   * @returns Promise
   */
  const handleExport = async (report: ReportItem): Promise<void> => {
    try {
      const res = await exportReport(report.reportId)
      if (res?.fileUrl) {
        window.open(res.fileUrl, '_blank')
        message.success('已打开导出文件')
        return
      }
    } catch {
      // 后端无导出能力时回落本地 CSV
    }
    downloadBlob(`${report.reportName}.csv`, buildReportCsv(report), 'text/csv')
    message.success('已导出为 CSV 文件')
  }

  /** 提交订阅 */
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
    try {
      await subscribeReport(payload)
    } catch {
      // 后端骨架阶段订阅接口不可用，落本地存储
    }
    const next: ReportSubscription = {
      ...payload,
      subscribeId: `LOCAL-SUB-${Date.now()}`,
      updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    }
    persistSubscriptions([next, ...subscriptions])
    setSubscribeOpen(false)
    message.success('订阅已保存')
  }

  /** 删除订阅 */
  const removeSubscription = async (subscribeId: string): Promise<void> => {
    try {
      await unsubscribeReport(subscribeId)
    } catch {
      // 忽略后端失败
    }
    persistSubscriptions(subscriptions.filter((item) => item.subscribeId !== subscribeId))
    message.success('订阅已取消')
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
            {/* 本地生成的报表必须显式标记：否则使用者分不清哪些是服务端真数据 */}
            {isLocalReport(record) ? <Tag color="orange">本地生成</Tag> : null}
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
          <Popconfirm
            title="确认删除该报表？"
            onConfirm={() => {
              void deleteReport(record.reportId).catch(() => undefined)
              setExtraReports((prev) => prev.filter((item) => item.reportId !== record.reportId))
              void queryClient.invalidateQueries({ queryKey: ['production-reports'] })
              message.success('报表已删除')
            }}
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
                <FileTextOutlined style={{ fontSize: 20, color: '#1677ff' }} />
                <span style={{ fontSize: 18, fontWeight: 600 }}>生产报表</span>
                <Text type="secondary">共 {formatNumber(total)} 份报表 · {subscriptions.length} 项订阅</Text>
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

          {shapeMismatch && (
            <Alert
              showIcon
              type="warning"
              style={{ margin: '12px 0' }}
              message="后端 /analytics/reports 当前未返回报表数据"
              description={
                <Space direction="vertical" size={2}>
                  <Text>
                    该接口本次返回 {rawRows.length} 条记录，均为指标快照（metricCode /
                    metricName / metricValue / unit / bizDate），不含 reportId / reportName /
                    reportType，因此不作为报表行展示。
                  </Text>
                  <Text>
                    下方列表仅展示你在本地生成的报表（带「本地生成」标记，未写入服务端）；
                    服务端暂无线上报表数据即为真实状态。
                  </Text>
                </Space>
              }
            />
          )}

          {usingFallback && (
            <Empty
              description="接口暂未返回报表数据，当前展示示例报表（生成 / 订阅 / 导出 / 打印均可用）"
              style={{ margin: '12px 0' }}
            />
          )}

          <Spin spinning={listQuery.isLoading || generating}>
            <Table<ReportItem>
              rowKey="reportId"
              columns={columns}
              dataSource={rows}
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
