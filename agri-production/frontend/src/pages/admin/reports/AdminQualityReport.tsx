/**
 * 页面名称：质量报表
 * 路由路径：/admin/production/reports/quality
 * 所属模块：统计报表
 * PRD 序号：PRD 6.2 #30
 * 原型页码：P28 quality-reports
 *
 * 交互说明（对照原型 P28）：
 * - 顶部按钮：下载PDF / 导出Excel / 返回报表中心；
 * - 指标卡：检测合格率、本月检测次数、不合格批次、整改完成率；
 * - 多维筛选：统计月份、区域、作物、检测机构；
 * - 图表：检测合格率趋势(近6月) 折线图、不合格原因分布 饼图；
 * - 明细表：质量检测结果明细（月份 / 检测批次 / 合格数 / 不合格数 / 合格率 / 整改数 / 整改完成）。
 *
 * ⚠️ 诚实口径（同 AdminProductionReport.tsx，勿回退）：
 * 后端报表域只有「报表任务」，`AdminReportController` / `ReportTaskEntity` 的可用字段为
 *   reportId / reportType / reportName / farmId / bizDateFrom / bizDateTo /
 *   generatorId / fileUrl / generatedAt / status
 * **没有检测合格率、检测批次、不合格数、整改完成率等任何质量统计端点**。
 *
 * 因此本页拆成互不混淆的两段：
 *   ① 服务端质量报表任务表格 —— 真数据，来自 `GET /admin/reports/quality`，
 *      空就渲染空态、失败就提示失败原因，不编造行；
 *   ② 示例统计区块 —— 沿用原型 P28 的样例常量，顶部常驻 Alert 明示其为演示示例、
 *      **不可用于决策**，并声明筛选只作用于示例数据、不影响服务端。
 *
 * 已清除的造假点（回归时请一并守住）：
 * - 删除原先 catch 分支里的「后端服务暂不可用，当前使用本地计算结果」：
 *   那些数字从来就不是「本地算出来的」，成功失败显示的都是同一套常量；
 * - 删除原先指向不存在端点 `POST /admin/reports/quality` 的「生成报表」按钮，
 *   改为指向真实写端点 `POST /admin/reports` 的「新建报表任务」；
 * - `fileUrl` 只以纯文本展示，不渲染成可点击链接。
 */
import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Divider,
  Empty,
  Form,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { ArrowLeftOutlined, DownloadOutlined, FilePdfOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { createReportTask, listQualityReports } from '@/api'
import type { ReportTask } from '@/api'
import type { PageResult } from '@/types'

/** 本页查询的服务端报表类型（后端 listByType("QUALITY")） */
const TASK_REPORT_TYPE = 'QUALITY'

/** 报表任务列表 queryKey */
const TASK_QUERY_KEY = ['admin-report-tasks', TASK_REPORT_TYPE] as const

/** 示例数据声明：导出文件里也必须带，避免离开页面后失去上下文 */
const DEMO_EXPORT_BANNER =
  '# 示例数据：以下数值为前端演示示例常量，后端不提供质量统计报表内容，不可用于业务决策'

/**
 * 近 6 月合格率趋势样例（原型 P28）
 *
 * ⚠️ 全部为演示示例常量，后端无对应数据源。
 */
const TREND_BASE: { month: string; checkBatch: number; passCount: number; failCount: number; rectifyCount: number; rectifyDone: number }[] = [
  { month: '2025-02', checkBatch: 920, passCount: 861, failCount: 59, rectifyCount: 52, rectifyDone: 46 },
  { month: '2025-03', checkBatch: 1010, passCount: 953, failCount: 57, rectifyCount: 50, rectifyDone: 45 },
  { month: '2025-04', checkBatch: 980, passCount: 918, failCount: 62, rectifyCount: 55, rectifyDone: 48 },
  { month: '2025-05', checkBatch: 1080, passCount: 1020, failCount: 60, rectifyCount: 54, rectifyDone: 50 },
  { month: '2025-06', checkBatch: 1150, passCount: 1092, failCount: 58, rectifyCount: 52, rectifyDone: 48 },
  { month: '2025-07', checkBatch: 1280, passCount: 1218, failCount: 62, rectifyCount: 55, rectifyDone: 49 },
]

/**
 * 不合格原因分布样例（原型 P28）
 *
 * ⚠️ 全部为演示示例常量，后端无对应数据源。
 */
const FAIL_REASON_BASE: { reason: string; rate: number }[] = [
  { reason: '农药超标', rate: 35 },
  { reason: '重金属', rate: 25 },
  { reason: '微生物', rate: 20 },
  { reason: '物理指标', rate: 12 },
  { reason: '其他', rate: 8 },
]

/**
 * 区域选项。
 *
 * `factor` 仅用于**缩放上面的示例常量**；后端报表任务接口没有区域入参，不会下发。
 */
const REGION_OPTIONS: { value: string; label: string; factor: number }[] = [
  { value: 'ALL', label: '全部区域', factor: 1 },
  { value: '河南', label: '河南', factor: 0.26 },
  { value: '山东', label: '山东', factor: 0.24 },
  { value: '黑龙江', label: '黑龙江', factor: 0.19 },
  { value: '江苏', label: '江苏', factor: 0.16 },
  { value: '广东', label: '广东', factor: 0.15 },
]

/** 作物选项（factor 作用同上，仅缩放示例常量） */
const CROP_OPTIONS: { value: string; label: string; factor: number }[] = [
  { value: 'ALL', label: '全部作物', factor: 1 },
  { value: 'RICE', label: '水稻', factor: 0.4 },
  { value: 'WHEAT', label: '小麦', factor: 0.3 },
  { value: 'FRUIT', label: '果蔬', factor: 0.22 },
  { value: 'LIVESTOCK', label: '畜禽产品', factor: 0.16 },
]

/**
 * 检测机构选项（factor 作用同上，仅缩放示例常量）
 *
 * ⚠️ 后端 `ReportTaskEntity` 没有检测机构字段，所选机构不会传给服务端。
 */
const LAB_OPTIONS: { value: string; label: string; factor: number }[] = [
  { value: 'ALL', label: '全部机构', factor: 1 },
  { value: 'NQCC', label: '国家质检中心', factor: 0.45 },
  { value: 'SGS', label: 'SGS', factor: 0.33 },
  { value: 'PROV', label: '省农检中心', factor: 0.22 },
]

/** 服务端任务状态的展示元数据 */
const STATUS_META: Record<string, { color: string; label: string }> = {
  PENDING: { color: 'default', label: '待生成' },
  RUNNING: { color: 'processing', label: '生成中' },
  DONE: { color: 'success', label: '已完成' },
  FAILED: { color: 'error', label: '生成失败' },
}

/** 服务端报表类型编码 → 展示文案 */
const REPORT_TYPE_LABEL: Record<string, string> = {
  GOV: '监管/生产',
  BIZ: '经营',
  QUALITY: '质量',
}

/** 筛选条件 */
interface FilterState {
  month?: dayjs.Dayjs
  region: string
  crop: string
  lab: string
}

/** 报表任务加载结果 */
interface TaskLoadState {
  /** 服务端返回的报表任务（当前页） */
  tasks: ReportTask[]
  /** 服务端全量条数 */
  total: number
  /** 加载失败原因；成功时为 undefined */
  error?: string
}

/**
 * 质量报表页面
 * @returns 页面内容
 */
export default function AdminQualityReport(): JSX.Element {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form] = Form.useForm<FilterState>()
  const [filters, setFilters] = useState<FilterState>({
    month: dayjs('2025-07'),
    region: 'ALL',
    crop: 'ALL',
    lab: 'ALL',
  })
  const [creating, setCreating] = useState<boolean>(false)

  /**
   * 服务端质量报表任务（真数据）。
   *
   * queryFn 永不抛错：失败时把原因写进 `error` 交由 UI 明示，
   * 而不是静默回落到示例数据冒充服务端结果。
   */
  const tasksQuery = useQuery<TaskLoadState>({
    queryKey: TASK_QUERY_KEY,
    queryFn: async (): Promise<TaskLoadState> => {
      try {
        const page: PageResult<ReportTask> = await listQualityReports({ pageNum: 1, pageSize: 50 })
        return { tasks: page?.list ?? [], total: page?.total ?? 0 }
      } catch (error) {
        return {
          tasks: [],
          total: 0,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    },
  })

  /** 当前报表任务列表与其加载错误 */
  const tasks: ReportTask[] = tasksQuery.data?.tasks ?? []
  const taskError: string | undefined = tasksQuery.data?.error

  /** 按筛选条件折算后的**示例**报表数据（后端无对应数据源） */
  const report = useMemo(() => {
    const regionFactor = REGION_OPTIONS.find((item) => item.value === filters.region)?.factor ?? 1
    const cropFactor = CROP_OPTIONS.find((item) => item.value === filters.crop)?.factor ?? 1
    const labFactor = LAB_OPTIONS.find((item) => item.value === filters.lab)?.factor ?? 1
    const factor = Math.max(regionFactor * cropFactor * labFactor, 0.02)
    const rows = TREND_BASE.map((item) => {
      const checkBatch = Math.max(1, Math.round(item.checkBatch * factor))
      const passCount = Math.max(0, Math.round(item.passCount * factor))
      const failCount = Math.max(0, checkBatch - passCount)
      const rectifyCount = Math.max(0, Math.round(item.rectifyCount * factor))
      const rectifyDone = Math.min(rectifyCount, Math.max(0, Math.round(item.rectifyDone * factor)))
      return {
        key: item.month,
        month: item.month,
        checkBatch,
        passCount,
        failCount,
        passRate: Number(((passCount / checkBatch) * 100).toFixed(1)),
        rectifyCount,
        rectifyDone,
      }
    })
    const current = rows[rows.length - 1]
    return {
      rows,
      current,
      passRate: current.passRate,
      checkBatch: current.checkBatch,
      failCount: current.failCount,
      rectifyDoneRate:
        current.rectifyCount === 0
          ? 0
          : Number(((current.rectifyDone / current.rectifyCount) * 100).toFixed(1)),
      failReasons: FAIL_REASON_BASE.map((item) => ({
        reason: item.reason,
        rate: item.rate,
        count: Math.max(0, Math.round((current.failCount * item.rate) / 100)),
      })),
    }
  }, [filters])

  /** 合格率趋势图配置（示例数据） */
  const trendChart: EChartsOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 56, right: 24, top: 32, bottom: 40 },
    legend: { data: ['合格率(%)'], bottom: 0 },
    xAxis: { type: 'category', data: report.rows.map((item) => item.month) },
    yAxis: {
      type: 'value',
      name: '合格率(%)',
      min: 80,
      max: 100,
      splitLine: { lineStyle: { type: 'dashed' } },
    },
    series: [
      {
        name: '合格率(%)',
        type: 'line',
        smooth: true,
        data: report.rows.map((item) => item.passRate),
        itemStyle: { color: '#13a05a' },
        areaStyle: { color: 'rgba(19,160,90,0.12)' },
        markLine: {
          silent: true,
          data: [{ yAxis: 95, name: '目标 95%' }],
          lineStyle: { color: '#faad14', type: 'dashed' },
        },
      },
    ],
  }

  /** 不合格原因分布图配置（示例数据） */
  const reasonChart: EChartsOption = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} 批次 ({d}%)' },
    legend: { bottom: 0, itemWidth: 10, itemHeight: 10 },
    series: [
      {
        type: 'pie',
        radius: ['38%', '62%'],
        data: report.failReasons.map((item) => ({ name: item.reason, value: item.count })),
        label: { formatter: '{b}\n{d}%' },
      },
    ],
  }

  /** 统计月份文案 */
  const monthText = filters.month ? filters.month.format('YYYY-MM') : dayjs().format('YYYY-MM')
  const regionLabel = REGION_OPTIONS.find((item) => item.value === filters.region)?.label ?? '全部区域'
  const cropLabel = CROP_OPTIONS.find((item) => item.value === filters.crop)?.label ?? '全部作物'
  const labLabel = LAB_OPTIONS.find((item) => item.value === filters.lab)?.label ?? '全部机构'

  /**
   * 导出文件通用实现（前端 Blob）
   * @param content 文件内容
   * @param filename 文件名
   */
  const download = (content: string, filename: string): void => {
    const blob = new Blob([`\uFEFF${content}`], { type: 'text/plain;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
    message.success(`${filename} 已导出（内容为示例数据）`)
  }

  /** 导出 Excel（CSV 格式；首行为示例数据声明） */
  const handleExportExcel = (): void => {
    const header = [
      '月份',
      '检测批次',
      '合格数',
      '不合格数',
      '合格率(%)',
      '整改数',
      '整改完成',
    ]
    const rows = report.rows.map((item) => [
      item.month,
      String(item.checkBatch),
      String(item.passCount),
      String(item.failCount),
      String(item.passRate),
      String(item.rectifyCount),
      String(item.rectifyDone),
    ])
    const header2 = ['不合格原因', '占比(%)', '批次']
    const rows2 = report.failReasons.map((item) => [
      item.reason,
      String(item.rate),
      String(item.count),
    ])
    const csv = [header, ...rows, [], header2, ...rows2]
      .map((line) => line.map((cell) => `"${cell}"`).join(','))
      .join('\r\n')
    download(`${DEMO_EXPORT_BANNER}\r\n${csv}`, `质量报表_${monthText}.csv`)
  }

  /** 下载 PDF（摘要文本） */
  const handleDownloadPdf = (): void => {
    const content = [
      DEMO_EXPORT_BANNER,
      `质量月报 · ${monthText}`,
      `示例统计范围：${regionLabel} / ${cropLabel} / ${labLabel}`,
      `检测合格率(%)：${report.passRate}`,
      `检测批次：${report.checkBatch}`,
      `不合格批次：${report.failCount}`,
      `整改完成率(%)：${report.rectifyDoneRate}`,
      '',
      ...report.failReasons.map((item) => `${item.reason}：占比 ${item.rate}%，批次 ${item.count}`),
    ].join('\n')
    download(content, `质量月报_${monthText}.txt`)
  }

  /**
   * 在服务端新建质量报表任务（真实写操作：POST /api/v1/production/admin/reports）。
   *
   * 只创建任务记录（落库后状态为 PENDING），不调用 `/{reportId}/generate`——
   * 该端点在服务端仅把状态改成 DONE 并回填 `/report/{id}.xlsx` 字符串，
   * 不产出真实报表文件。
   */
  const handleCreateTask = async (): Promise<void> => {
    setCreating(true)
    try {
      const reportId = await createReportTask({
        reportType: TASK_REPORT_TYPE,
        reportName: `质量月报 · ${monthText}`,
        bizDateFrom: `${monthText}-01`,
        bizDateTo: dayjs(monthText).endOf('month').format('YYYY-MM-DD'),
      })
      message.success(`已在服务端新建报表任务 ${reportId}（状态 PENDING，报表文件尚未生成）`)
      await queryClient.invalidateQueries({ queryKey: TASK_QUERY_KEY })
    } catch (error) {
      message.error(`服务端新建报表任务失败：${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setCreating(false)
    }
  }

  /** 刷新服务端报表任务列表 */
  const handleRefreshTasks = (): void => {
    void queryClient.invalidateQueries({ queryKey: TASK_QUERY_KEY })
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Alert
        type="warning"
        showIcon
        message="本页仅「服务端报表任务」为真实数据；合格率 / 检测批次 / 不合格数 / 整改完成率等统计后端不提供，下方数字为演示示例常量，不可用于决策"
        description={
          <Space direction="vertical" size={2}>
            <Typography.Text>
              后端报表域只有报表<b>任务</b>元数据，可用字段为{' '}
              <Typography.Text code>
                reportId / reportName / reportType / bizDateFrom / bizDateTo / generatorId / fileUrl / generatedAt /
                status
              </Typography.Text>
              ，<Typography.Text strong>「质量统计报表内容」（检测合格率、检测批次、不合格数、整改完成率、不合格原因分布等）后端一个都没有</Typography.Text>
              ，本页所有质量指标均为前端内置的<b>示例数据（演示示例常量）</b>，随筛选条件做等比缩放只是为了演示交互，
              <Typography.Text strong>不代表任何真实检测结果，也不可用于质量判定或决策</Typography.Text>。
            </Typography.Text>
            <Typography.Text>
              页面顶部的月份 / 区域 / 作物 / 检测机构筛选<b>只作用于示例统计数据，不会下发到服务端</b>
              （报表任务接口不接受这些入参），因此筛选不会改变上方真实任务列表的内容。
            </Typography.Text>
          </Space>
        }
      />

      <Card>
        <Form<FilterState>
          form={form}
          layout="inline"
          style={{ rowGap: 12 }}
          initialValues={filters}
          onFinish={(values) => setFilters({ ...values, month: values.month ?? dayjs() })}
        >
          <Form.Item name="month" label="统计月份">
            <DatePicker picker="month" allowClear={false} />
          </Form.Item>
          <Form.Item
            name="region"
            label="区域"
            tooltip="仅缩放下方示例统计数据，不会下发到服务端（报表任务接口无区域入参）"
          >
            <Select style={{ width: 140 }} options={REGION_OPTIONS} />
          </Form.Item>
          <Form.Item name="crop" label="作物" tooltip="仅缩放示例统计数据，不会下发到服务端">
            <Select style={{ width: 140 }} options={CROP_OPTIONS} />
          </Form.Item>
          <Form.Item
            name="lab"
            label="检测机构"
            tooltip="后端报表任务无检测机构字段，此处仅缩放示例统计数据，不会下发到服务端"
          >
            <Select style={{ width: 160 }} options={LAB_OPTIONS} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                应用到示例统计
              </Button>
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/production/reports')}>
                返回报表中心
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card
        title={
          <Space size={8}>
            <span>服务端质量报表任务</span>
            <Tag color="green" style={{ marginInlineEnd: 0 }}>
              真实数据
            </Tag>
          </Space>
        }
        extra={
          <Space>
            <Typography.Text type="secondary">
              {taskError ? '加载失败' : `共 ${tasksQuery.data?.total ?? 0} 条`}
            </Typography.Text>
            <Button icon={<ReloadOutlined />} loading={tasksQuery.isFetching} onClick={handleRefreshTasks}>
              刷新
            </Button>
            <Button icon={<PlusOutlined />} loading={creating} onClick={() => void handleCreateTask()}>
              新建报表任务
            </Button>
          </Space>
        }
      >
        {taskError ? (
          <Alert
            type="error"
            showIcon
            message="未能从服务端读取报表任务，因此此处不展示任何任务数据"
            description={`接口 GET /api/v1/production/admin/reports/quality 调用失败：${taskError}`}
          />
        ) : (
          <Table<ReportTask>
            size="small"
            rowKey="reportId"
            loading={tasksQuery.isPending}
            dataSource={tasks}
            locale={{ emptyText: <Empty description="服务端暂未返回该类型的报表任务，此处不做任何示例填充" /> }}
            columns={[
              { title: '报表编号', dataIndex: 'reportId' },
              {
                title: '报表名称',
                dataIndex: 'reportName',
                render: (value?: string) => value || '—',
              },
              {
                title: '类型',
                dataIndex: 'reportType',
                render: (value?: string) =>
                  value ? <Tag color="blue">{REPORT_TYPE_LABEL[value] ?? value}</Tag> : '—',
              },
              {
                title: '业务周期',
                key: 'bizRange',
                render: (_: unknown, row: ReportTask) =>
                  row.bizDateFrom || row.bizDateTo
                    ? `${row.bizDateFrom ?? '—'} ~ ${row.bizDateTo ?? '—'}`
                    : '—',
              },
              {
                title: '状态',
                dataIndex: 'status',
                render: (value?: string) => {
                  if (!value) {
                    return '—'
                  }
                  const meta = STATUS_META[value]
                  return <Tag color={meta?.color ?? 'default'}>{meta?.label ?? value}</Tag>
                },
              },
              {
                title: '生成人',
                dataIndex: 'generatorId',
                render: (value?: string) => value || '—',
              },
              {
                title: '生成时间',
                dataIndex: 'generatedAt',
                render: (value?: string) => value || '—',
              },
              {
                title: '文件地址',
                dataIndex: 'fileUrl',
                render: (value?: string) =>
                  value ? (
                    <Tooltip title="服务端返回的文件地址字符串，平台未提供可解析的下载服务，此处仅原文展示、不做成链接">
                      <Typography.Text type="secondary">{value}</Typography.Text>
                    </Tooltip>
                  ) : (
                    <Typography.Text type="secondary">尚未生成</Typography.Text>
                  ),
              },
            ]}
          />
        )}
      </Card>

      <Divider orientation="left" plain>
        <Space size={8}>
          <Typography.Text strong>以下为示例统计，后端无对应数据源</Typography.Text>
          <Tag color="purple" style={{ marginInlineEnd: 0 }}>
            演示示例
          </Tag>
        </Space>
      </Divider>

      <Card
        title={
          <Space size={8}>
            <span>{`质量月报 · ${monthText}`}</span>
            <Tag color="purple" style={{ marginInlineEnd: 0 }}>
              示例
            </Tag>
          </Space>
        }
        extra={
          <Space>
            <Typography.Text type="secondary">
              {regionLabel} / {cropLabel} / {labLabel}
            </Typography.Text>
            <Button icon={<FilePdfOutlined />} onClick={handleDownloadPdf}>
              下载PDF
            </Button>
            <Button type="primary" icon={<DownloadOutlined />} onClick={handleExportExcel}>
              导出Excel
            </Button>
          </Space>
        }
      >
        <Row gutter={16}>
          <Col span={6}>
            <Statistic
              title="检测合格率"
              value={report.passRate}
              suffix="%"
              valueStyle={{ color: '#13a05a' }}
            />
          </Col>
          <Col span={6}>
            <Statistic title="本月检测次数" value={report.checkBatch} suffix="批次" />
          </Col>
          <Col span={6}>
            <Statistic
              title="不合格批次"
              value={report.failCount}
              valueStyle={{ color: '#cf1322' }}
            />
          </Col>
          <Col span={6}>
            <Statistic title="整改完成率" value={report.rectifyDoneRate} suffix="%" />
          </Col>
        </Row>
      </Card>

      <Row gutter={16}>
        <Col span={14}>
          <Card
            title={
              <Space size={8}>
                <span>检测合格率趋势(近6月)</span>
                <Tag color="purple" style={{ marginInlineEnd: 0 }}>
                  示例
                </Tag>
              </Space>
            }
          >
            <ReactECharts option={trendChart} style={{ height: 300 }} />
          </Card>
        </Col>
        <Col span={10}>
          <Card
            title={
              <Space size={8}>
                <span>不合格原因分布</span>
                <Tag color="purple" style={{ marginInlineEnd: 0 }}>
                  示例
                </Tag>
              </Space>
            }
          >
            <ReactECharts option={reasonChart} style={{ height: 300 }} />
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <Space size={8}>
            <span>质量检测结果明细</span>
            <Tag color="purple" style={{ marginInlineEnd: 0 }}>
              示例
            </Tag>
          </Space>
        }
      >
        <Table
          size="small"
          pagination={false}
          rowKey="key"
          dataSource={report.rows}
          columns={[
            { title: '月份', dataIndex: 'month' },
            { title: '检测批次', dataIndex: 'checkBatch' },
            { title: '合格数', dataIndex: 'passCount' },
            { title: '不合格数', dataIndex: 'failCount' },
            { title: '合格率', dataIndex: 'passRate', render: (v: number) => `${v}%` },
            { title: '整改数', dataIndex: 'rectifyCount' },
            { title: '整改完成', dataIndex: 'rectifyDone' },
          ]}
        />
      </Card>
    </Space>
  )
}
