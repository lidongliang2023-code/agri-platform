/**
 * 页面名称：生产报表
 * 路由路径：/admin/production/reports/production
 * 所属模块：统计报表
 * PRD 序号：PRD 6.2 #29
 * 原型页码：P27 prod-reports
 *
 * 交互说明（对照原型 P27）：
 * - 顶部按钮：下载PDF / 导出Excel / 返回报表中心；标题「生产日报 · {统计日期}」；
 * - 多维筛选：统计日期、区域、作物、主体；
 * - 指标卡：总产量(吨)、任务完成率、活跃农场、设备在线率；
 * - 图表：各区域产量对比（柱状图）、任务执行分布（饼图）；
 * - 明细表：区域产量明细、任务执行明细，支持导出 Excel(CSV)。
 *
 * ⚠️ 诚实口径（按后端源码逐条核验，勿回退）：
 * 后端报表域只有「报表任务」，控制器为
 * `core-platform/mod-produce/.../internal/admin/AdminReportController.java`
 * （`/api/v1/production/admin/reports`），返回实体 `ReportTaskEntity` 的字段只有
 *   reportId / reportType / reportName / farmId / bizDateFrom / bizDateTo /
 *   generatorId / fileUrl / generatedAt / status
 * **不存在任何「报表内容统计」端点**——产量、种植面积、任务完成率、设备在线率
 * 后端一个都没有，无法「接真数据」。
 *
 * 因此本页拆成互不混淆的两段：
 *   ① 服务端报表任务表格 —— 真数据，来自 `GET /admin/reports/production`，
 *      有数据就渲染、空就渲染空态、失败就提示失败原因，**不编造行**；
 *   ② 示例统计区块 —— 沿用原型 P27 的样例常量（区域产量 / 任务分布），
 *      顶部常驻 Alert 明示其为演示示例、**不可用于决策**，且声明筛选只作用于
 *      示例数据、不影响服务端。
 *
 * 已清除的造假点（回归时请一并守住）：
 * - 删除 `doneRate: 82 + ((activeFarms % 7) + 1)`：用农场数取模伪造「完成率」；
 * - 删除 `deviceOnlineRate: 94.5` 字面常量，原第四张卡改为服务端真实任务数；
 * - 删除 `↑ 3.2% / ↑ 1.8% / ↓ 0.3%` 等同比环比箭头：后端无比对数据源，纯属虚构；
 * - 删除原先 `fileUrl` 的可点击链接渲染：服务端地址（种子数据为
 *   `https://demo.example.com/...`，服务端触发生成后为 `/report/{id}.xlsx`）
 *   均不可解析，只以纯文本展示。
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
import { createReportTask, listProductionReports } from '@/api'
import type { ReportTask } from '@/api'
import type { PageResult } from '@/types'

/** 本页查询的服务端报表类型（后端 listByType("GOV")） */
const TASK_REPORT_TYPE = 'GOV'

/** 报表任务列表 queryKey */
const TASK_QUERY_KEY = ['admin-report-tasks', TASK_REPORT_TYPE] as const

/** 示例数据声明：导出文件里也必须带，避免离开页面后失去上下文 */
const DEMO_EXPORT_BANNER =
  '# 示例数据：以下数值为前端演示示例常量，后端不提供报表内容统计，不可用于业务决策'

/**
 * 区域维度样例数据（原型 P27 各区域产量对比）
 *
 * ⚠️ 全部为演示示例常量，无后端数据源。
 */
const REGION_BASE: { region: string; output: number; area: number; activeFarms: number }[] = [
  { region: '河南', output: 520, area: 185000, activeFarms: 820 },
  { region: '山东', output: 480, area: 168000, activeFarms: 760 },
  { region: '黑龙江', output: 380, area: 226000, activeFarms: 610 },
  { region: '江苏', output: 320, area: 132000, activeFarms: 540 },
  { region: '四川', output: 280, area: 118000, activeFarms: 470 },
  { region: '广东', output: 250, area: 96000, activeFarms: 380 },
]

/**
 * 任务类型分布样例数据（原型 P27 任务执行分布）
 *
 * ⚠️ 全部为演示示例常量，无后端数据源。
 */
const TASK_BASE: { taskType: string; count: number; doneRate: number; avgHours: number }[] = [
  { taskType: '施肥', count: 3738, doneRate: 91.2, avgHours: 2.4 },
  { taskType: '灌溉', count: 3114, doneRate: 88.6, avgHours: 1.8 },
  { taskType: '巡田', count: 1869, doneRate: 86.4, avgHours: 2.1 },
  { taskType: '喷药', count: 1495, doneRate: 82.3, avgHours: 2.9 },
  { taskType: '收割', count: 1246, doneRate: 79.5, avgHours: 4.2 },
  { taskType: '其他', count: 996, doneRate: 84.7, avgHours: 2.6 },
]

/**
 * 作物选项。
 *
 * `factor` 仅用于**放大/缩小上面的示例常量**，让筛选看起来有反应；
 * 后端报表任务接口没有作物维度入参，factor 不会下发到服务端。
 */
const CROP_OPTIONS: { value: string; label: string; factor: number }[] = [
  { value: 'ALL', label: '全部作物', factor: 1 },
  { value: 'RICE', label: '水稻', factor: 0.42 },
  { value: 'WHEAT', label: '小麦', factor: 0.33 },
  { value: 'CORN', label: '玉米', factor: 0.38 },
  { value: 'FRUIT', label: '果蔬', factor: 0.21 },
]

/**
 * 主体选项（factor 作用同上，仅缩放示例常量）。
 *
 * ⚠️ 后端 `ReportTaskEntity` 没有 tenantId 字段，所选主体不会传给服务端，
 * 且这里的主体编号不是服务端真实主体数据。
 */
const TENANT_OPTIONS: { value: string; label: string; factor: number }[] = [
  { value: 'ALL', label: '全部主体', factor: 1 },
  { value: 'T20250001', label: '绿源农业', factor: 0.28 },
  { value: 'T20250002', label: '丰达农场', factor: 0.22 },
  { value: 'T20250003', label: '大地种业', factor: 0.31 },
  { value: 'T20250004', label: '丰收集团', factor: 0.19 },
]

/** 区域选项 */
const REGION_OPTIONS: { value: string; label: string }[] = [
  { value: 'ALL', label: '全部区域' },
  ...REGION_BASE.map((item) => ({ value: item.region, label: item.region })),
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
  date?: dayjs.Dayjs
  region: string
  crop: string
  tenant: string
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
 * 生产报表页面
 * @returns 页面内容
 */
export default function AdminProductionReport(): JSX.Element {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form] = Form.useForm<FilterState>()
  const [filters, setFilters] = useState<FilterState>({
    date: dayjs('2025-07-14'),
    region: 'ALL',
    crop: 'ALL',
    tenant: 'ALL',
  })
  const [creating, setCreating] = useState<boolean>(false)

  /**
   * 服务端报表任务（真数据）。
   *
   * queryFn 永不抛错：失败时把原因写进 `error` 字段交由 UI 明示，
   * 而不是静默回落到示例数据冒充服务端结果。
   */
  const tasksQuery = useQuery<TaskLoadState>({
    queryKey: TASK_QUERY_KEY,
    queryFn: async (): Promise<TaskLoadState> => {
      try {
        const page: PageResult<ReportTask> = await listProductionReports({ pageNum: 1, pageSize: 50 })
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
    const cropFactor = CROP_OPTIONS.find((item) => item.value === filters.crop)?.factor ?? 1
    const tenantFactor = TENANT_OPTIONS.find((item) => item.value === filters.tenant)?.factor ?? 1
    const factor = cropFactor * tenantFactor
    const regionRows = REGION_BASE.filter(
      (item) => filters.region === 'ALL' || item.region === filters.region,
    ).map((item) => ({
      key: item.region,
      region: item.region,
      area: Math.round(item.area * factor),
      output: Math.round(item.output * factor),
      share: 0,
      activeFarms: Math.round(item.activeFarms * factor),
    }))
    const totalOutput = regionRows.reduce((sum, item) => sum + item.output, 0)
    const regionRowsWithShare = regionRows.map((item) => ({
      ...item,
      share: totalOutput === 0 ? 0 : Number(((item.output / totalOutput) * 100).toFixed(1)),
    }))
    const taskRows = TASK_BASE.map((item) => {
      const count = Math.round(item.count * factor)
      return {
        key: item.taskType,
        taskType: item.taskType,
        count,
        share: 0,
        doneRate: item.doneRate,
        avgHours: item.avgHours,
      }
    })
    const totalTasks = taskRows.reduce((sum, item) => sum + item.count, 0)
    const taskRowsWithShare = taskRows.map((item) => ({
      ...item,
      share: totalTasks === 0 ? 0 : Number(((item.count / totalTasks) * 100).toFixed(1)),
    }))
    const areaSum = regionRows.reduce((sum, item) => sum + item.area, 0)
    const farmsSum = regionRows.reduce((sum, item) => sum + item.activeFarms, 0)
    const taskDoneRate =
      totalTasks === 0
        ? 0
        : Number(
            (
              taskRows.reduce((sum, item) => sum + item.count * (item.doneRate / 100), 0) /
              totalTasks *
              100
            ).toFixed(1),
          )
    return {
      totalOutput,
      taskDoneRate,
      activeFarms: farmsSum,
      totalTasks,
      area: areaSum,
      regionRows: regionRowsWithShare,
      taskRows: taskRowsWithShare,
    }
  }, [filters])

  /** 各区域产量对比图配置（示例数据） */
  const regionChart: EChartsOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 48, right: 24, top: 32, bottom: 40 },
    xAxis: {
      type: 'category',
      data: report.regionRows.map((item) => item.region),
      axisLabel: { color: '#666' },
    },
    yAxis: { type: 'value', name: '产量(吨)', splitLine: { lineStyle: { type: 'dashed' } } },
    series: [
      {
        type: 'bar',
        barWidth: '45%',
        data: report.regionRows.map((item) => item.output),
        itemStyle: { color: '#13a05a', borderRadius: [4, 4, 0, 0] },
      },
    ],
  }

  /** 任务执行分布图配置（示例数据） */
  const taskChart: EChartsOption = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, itemWidth: 10, itemHeight: 10 },
    series: [
      {
        type: 'pie',
        radius: ['40%', '65%'],
        data: report.taskRows.map((item) => ({ name: item.taskType, value: item.count })),
        label: { formatter: '{b}\n{d}%' },
      },
    ],
  }

  /** 统计日期文案 */
  const dateText = filters.date ? filters.date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')
  const tenantLabel = TENANT_OPTIONS.find((item) => item.value === filters.tenant)?.label ?? '全部主体'
  const cropLabel = CROP_OPTIONS.find((item) => item.value === filters.crop)?.label ?? '全部作物'
  const regionLabel = filters.region === 'ALL' ? '全部区域' : filters.region

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

  /** 导出 Excel（CSV 格式，Excel 可直接打开；首行为示例数据声明） */
  const handleExportExcel = (): void => {
    const header = ['区域', '种植面积(亩)', '总产量(吨)', '占比(%)', '活跃农场数']
    const rows = report.regionRows.map((item) => [
      item.region,
      String(item.area),
      String(item.output),
      String(item.share),
      String(item.activeFarms),
    ])
    const header2 = ['任务类型', '任务数', '占比(%)', '完成率(%)', '平均耗时(h)']
    const rows2 = report.taskRows.map((item) => [
      item.taskType,
      String(item.count),
      String(item.share),
      String(item.doneRate),
      String(item.avgHours),
    ])
    const csv = [header, ...rows, [], header2, ...rows2]
      .map((line) => line.map((cell) => `"${cell}"`).join(','))
      .join('\r\n')
    download(`${DEMO_EXPORT_BANNER}\r\n${csv}`, `生产报表_${dateText}.csv`)
  }

  /** 下载 PDF（摘要文本，占位 PDF 生成能力） */
  const handleDownloadPdf = (): void => {
    const content = [
      DEMO_EXPORT_BANNER,
      `生产日报 · ${dateText}`,
      `示例统计范围：${regionLabel} / ${cropLabel} / ${tenantLabel}`,
      `总产量(吨)：${report.totalOutput}`,
      `任务完成率(%)：${report.taskDoneRate}`,
      `活跃农场数：${report.activeFarms}`,
      `在田面积(亩)：${report.area.toLocaleString()}`,
      '',
      ...report.regionRows.map(
        (item) => `${item.region}：产量 ${item.output} 吨，占比 ${item.share}%，活跃农场 ${item.activeFarms}`,
      ),
    ].join('\n')
    download(content, `生产日报_${dateText}.txt`)
  }

  /**
   * 在服务端新建报表任务（真实写操作：POST /api/v1/production/admin/reports）。
   *
   * 只创建任务记录（落库后状态为 PENDING），**不调用** `/{reportId}/generate`：
   * 该端点在服务端只是把状态改成 DONE 并回填一个 `/report/{id}.xlsx` 字符串，
   * 并不产出真实报表文件，调用它等于谎称「已生成」。
   */
  const handleCreateTask = async (): Promise<void> => {
    setCreating(true)
    try {
      const reportId = await createReportTask({
        reportType: TASK_REPORT_TYPE,
        reportName: `生产监管报表 · ${dateText}`,
        bizDateFrom: dateText,
        bizDateTo: dateText,
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
        message="本页仅「服务端报表任务」为真实数据；产量 / 面积 / 完成率等统计后端不提供，下方数字为演示示例常量，不可用于决策"
        description={
          <Space direction="vertical" size={2}>
            <Typography.Text>
              后端报表域只有报表<b>任务</b>元数据，可用字段为{' '}
              <Typography.Text code>
                reportId / reportName / reportType / bizDateFrom / bizDateTo / generatorId / fileUrl / generatedAt /
                status
              </Typography.Text>
              ，<Typography.Text strong>「报表内容统计」（产量、种植面积、任务完成率、设备在线率等）后端一个都没有</Typography.Text>
              ，本页所有统计数字均为前端内置的<b>示例数据（演示示例常量）</b>，随筛选条件做等比缩放只是为了演示交互，
              <Typography.Text strong>不代表任何真实业务统计，也不可用于经营决策</Typography.Text>。
            </Typography.Text>
            <Typography.Text>
              页面顶部的日期 / 区域 / 作物 / 主体筛选<b>只作用于示例统计数据，不会下发到服务端</b>
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
          onFinish={(values) => setFilters({ ...values, date: values.date ?? dayjs() })}
        >
          <Form.Item name="date" label="统计日期">
            <DatePicker allowClear={false} />
          </Form.Item>
          <Form.Item name="region" label="区域">
            <Select style={{ width: 140 }} options={REGION_OPTIONS} />
          </Form.Item>
          <Form.Item
            name="crop"
            label="作物"
            tooltip="仅缩放下方示例统计数据，不会下发到服务端（报表任务接口无作物入参）"
          >
            <Select style={{ width: 140 }} options={CROP_OPTIONS} />
          </Form.Item>
          <Form.Item
            name="tenant"
            label="主体"
            tooltip="后端报表任务无主体字段，此处仅缩放示例统计数据，不会下发到服务端"
          >
            <Select style={{ width: 160 }} options={TENANT_OPTIONS} />
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
            <span>服务端报表任务</span>
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
            description={`接口 GET /api/v1/production/admin/reports/production 调用失败：${taskError}`}
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
        title={`生产日报 · ${dateText}`}
        extra={
          <Space>
            <Typography.Text type="secondary">
              {regionLabel} / {cropLabel} / {tenantLabel}
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
              title="总产量(吨)"
              value={report.totalOutput}
              precision={0}
              valueStyle={{ color: '#13a05a' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="任务完成率"
              value={report.taskDoneRate}
              suffix="%"
              valueStyle={{ color: '#13a05a' }}
            />
          </Col>
          <Col span={6}>
            <Statistic title="活跃农场" value={report.activeFarms} />
          </Col>
          <Col span={6}>
            <Statistic
              title="服务端报表任务"
              value={tasksQuery.data?.total ?? 0}
              suffix="份"
              loading={tasksQuery.isPending}
            />
          </Col>
        </Row>
      </Card>

      <Row gutter={16}>
        <Col span={12}>
          <Card
            title={
              <Space size={8}>
                <span>各区域产量对比</span>
                <Tag color="purple" style={{ marginInlineEnd: 0 }}>
                  示例
                </Tag>
              </Space>
            }
          >
            <ReactECharts option={regionChart} style={{ height: 300 }} />
          </Card>
        </Col>
        <Col span={12}>
          <Card
            title={
              <Space size={8}>
                <span>任务执行分布</span>
                <Tag color="purple" style={{ marginInlineEnd: 0 }}>
                  示例
                </Tag>
              </Space>
            }
          >
            <ReactECharts option={taskChart} style={{ height: 300 }} />
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <Space size={8}>
            <span>区域产量明细</span>
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
          dataSource={report.regionRows}
          columns={[
            { title: '区域', dataIndex: 'region' },
            { title: '种植面积(亩)', dataIndex: 'area', render: (v: number) => v.toLocaleString() },
            { title: '总产量(吨)', dataIndex: 'output' },
            { title: '占比', dataIndex: 'share', render: (v: number) => `${v}%` },
            { title: '活跃农场', dataIndex: 'activeFarms' },
          ]}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0}>合计</Table.Summary.Cell>
              <Table.Summary.Cell index={1}>
                {report.area.toLocaleString()}
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2}>{report.totalOutput}</Table.Summary.Cell>
              <Table.Summary.Cell index={3}>100%</Table.Summary.Cell>
              <Table.Summary.Cell index={4}>{report.activeFarms}</Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />
      </Card>

      <Card
        title={
          <Space size={8}>
            <span>任务执行明细</span>
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
          dataSource={report.taskRows}
          columns={[
            { title: '任务类型', dataIndex: 'taskType' },
            { title: '任务数', dataIndex: 'count' },
            { title: '占比', dataIndex: 'share', render: (v: number) => `${v}%` },
            { title: '完成率', dataIndex: 'doneRate', render: (v: number) => `${v}%` },
            { title: '平均耗时(小时)', dataIndex: 'avgHours' },
          ]}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0}>合计</Table.Summary.Cell>
              <Table.Summary.Cell index={1}>{report.totalTasks}</Table.Summary.Cell>
              <Table.Summary.Cell index={2}>100%</Table.Summary.Cell>
              <Table.Summary.Cell index={3}>—</Table.Summary.Cell>
              <Table.Summary.Cell index={4}>—</Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />
      </Card>
    </Space>
  )
}
