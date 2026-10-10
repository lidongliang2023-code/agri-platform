/**
 * 页面名称：任务执行监控
 * 路由路径：/admin/production/monitor/tasks
 * 所属模块：生产监控
 * PRD 序号：PRD 6.2 #13
 * 原型来源：P8 tasks — 任务执行监控（含甘特图）
 */
import { useMemo, useState } from 'react'
import {
  Alert as AntAlert,
  App,
  Breadcrumb,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
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
import { DownloadOutlined, HomeOutlined, ReloadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import ReactECharts from 'echarts-for-react'
import type {
  CustomSeriesRenderItemAPI,
  CustomSeriesRenderItemParams,
  CustomSeriesRenderItemReturn,
  EChartsOption,
} from 'echarts'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { urgeTask } from '@/api/admin/monitor'
import { listTasks } from '@/api/tasks'
import { TASK_TYPE_LABEL_MAP } from '@/types'
import type { Task } from '@/types'
import {
  isTaskDone,
  isTaskOverdue,
  OVERDUE_DERIVED_NOTICE,
  TASK_STATUS_DOING,
  TASK_STATUS_DONE,
} from '@/types/task'

const { Text, Title } = Typography

/** 甘特图 X 轴起始小时（原型 P8 横轴 06 ~ 17） */
const GANTT_START_HOUR = 6
/** 甘特图 X 轴结束小时 */
const GANTT_END_HOUR = 18

/**
 * 说明：本页**已移除「租户」筛选**。
 *
 * 后端 TaskInfoEntity 没有 farmId / farmName / tenantId 字段（/tasks 只返回
 * taskId / taskNo / plotId / taskType / taskName / 计划时间 / assigneeId / status 等），
 * 原先「租户 → 农场名称关键字」的客户端过滤读的是后端根本不返回的 item.farmName，
 * 结果必然筛出 0 行——列表空了，页面却把空态归因成「后端未返回数据」，属于静默空白 + 归因说谎。
 * 按「后端没有 → 不展示 / 显示未接入」的纪律，整个租户筛选链路（选项、状态、下拉、过滤）一并移除。
 */

/** 任务类型下拉选项（原型：全部/施肥/灌溉/巡田/喷药） */
const TASK_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'fertilizing', label: '施肥' },
  { value: 'irrigating', label: '灌溉' },
  { value: 'patrol', label: '巡田' },
  { value: 'pest_control', label: '喷药' },
  { value: 'harvesting', label: '收割' },
  { value: 'sowing', label: '播种' },
]

/**
 * 状态下拉选项。
 *
 * 取值必须是后端真值：后端任务状态只有 `pending / assigned / doing / done / rejected`
 * （实测 `GET /tasks` 14 条，`TaskInfoService.java:103/122` 写入 `assigned` / `done` / `rejected`）。
 * 旧版的 `accepted` / `executing` 后端不存在，传过去恒返回 0 条。
 * `overdue` 后端不存储，只能本地按 `planEndDate` 推导，**不能作为 status 传给后端**。
 */
const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: '全部' },
  { value: TASK_STATUS_DONE, label: '已完成' },
  { value: TASK_STATUS_DOING, label: '进行中' },
  { value: 'overdue', label: '超时（本地推导，非后端状态）' },
]

/** 可作为参数传给后端 `status` 的状态（overdue 不在其中） */
const SERVER_STATUS_VALUES: readonly string[] = ['all', TASK_STATUS_DONE, TASK_STATUS_DOING]

/** 任务执行状态（甘特图图例口径） */
type GanttStatus = 'done' | 'doing' | 'overdue' | 'waiting'

/** 甘特图状态 → 颜色（原型：█ 完成 / █ 进行中 / █ 超时 / █ 等待） */
const GANTT_STATUS_COLOR: Record<GanttStatus, string> = {
  done: '#52c41a',
  doing: '#1677ff',
  overdue: '#ff4d4f',
  waiting: '#bfbfbf',
}

/** 甘特图状态 → 文案 */
const GANTT_STATUS_TEXT: Record<GanttStatus, string> = {
  done: '完成',
  doing: '进行中',
  overdue: '超时',
  waiting: '等待',
}

/** 甘特图任务条目 */
interface GanttTask {
  /** 行标识（农场 / 地块 / 执行人） */
  row: string
  /** 任务名称 */
  name: string
  /** 计划开始时间（毫秒） */
  planStart: number
  /** 计划结束时间（毫秒） */
  planEnd: number
  /** 实际开始时间（毫秒） */
  actualStart: number
  /** 实际结束时间（毫秒） */
  actualEnd: number
  /** 执行状态 */
  status: GanttStatus
}

/** 超时任务行（原型 P8 超时任务列表） */
interface OverdueRow {
  /** 任务 ID */
  id: string
  /** 任务名称 */
  task: string
  /** 农场 */
  farm: string
  /** 计划完成时间 HH:mm */
  plan: string
  /** 超时时长文案 */
  overdue: string
  /** 负责人 */
  owner: string
}

/** 已应用的筛选条件（无租户维度：后端任务表不含 farmId / farmName / tenantId） */
interface AppliedFilter {
  /** 日期 yyyy-MM-dd */
  date: string
  /** 任务类型 */
  taskType: string
  /** 状态 */
  status: string
}

/**
 * 将毫秒时间格式化为 HH:mm。
 *
 * @param value 毫秒时间戳
 * @returns HH:mm 文案
 */
function formatHm(value: number): string {
  return dayjs(value).format('HH:mm')
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
 * 构造甘特图条形渲染函数。
 *
 * 说明：使用 ECharts custom 系列自绘甘特条，不引入第三方甘特库。
 * offset 控制同一行内「计划条」与「实际条」的上下偏移。
 *
 * @param offset 垂直偏移方向：-1 上半区（计划） / 1 下半区（实际）
 * @returns custom 系列 renderItem
 */
function makeRenderItem(offset: number) {
  return (
    params: CustomSeriesRenderItemParams,
    api: CustomSeriesRenderItemAPI,
  ): CustomSeriesRenderItemReturn => {
    const rowIndex = Number(api.value(0))
    const startMs = Number(api.value(1))
    const endMs = Number(api.value(2))
    const startCoord = api.coord([startMs, rowIndex])
    const endCoord = api.coord([endMs, rowIndex])
    const rawSize = api.size?.([endMs - startMs, 1])
    const bandHeight = Array.isArray(rawSize) && Number(rawSize[1]) > 0 ? Number(rawSize[1]) : 24
    const coordSys = params.coordSys as unknown as {
      x: number
      y: number
      width: number
      height: number
    }
    const barHeight = Math.max(bandHeight * 0.26, 8)
    const y = startCoord[1] + offset * (bandHeight * 0.2) - barHeight / 2
    const x1 = Math.max(startCoord[0], coordSys.x)
    const x2 = Math.min(endCoord[0], coordSys.x + coordSys.width)
    if (x2 - x1 < 1) {
      return undefined
    }
    return {
      type: 'rect',
      shape: { x: x1, y, width: x2 - x1, height: barHeight, r: 3 },
      style: api.style(),
    }
  }
}

/** 计划条渲染函数（上半区） */
const renderPlanItem = makeRenderItem(-1)
/** 实际条渲染函数（下半区） */
const renderActualItem = makeRenderItem(1)

/**
 * 任务执行监控
 *
 * 业务职责：按日期 / 租户 / 任务类型 / 状态监控全平台农事任务执行情况，
 * 以甘特图呈现计划 vs 实际的执行条，并输出超时任务与任务类型分布。
 * 数据优先取 /tasks 分页接口，接口无数据时降级到原型 P8 示例口径。
 *
 * @returns 页面内容
 */
export default function TaskMonitor(): JSX.Element {
  const { message } = App.useApp()
  const queryClient = useQueryClient()

  /** 筛选草稿：日期 */
  const [draftDate, setDraftDate] = useState<Dayjs>(dayjs())
  /** 筛选草稿：任务类型 */
  const [draftType, setDraftType] = useState<string>('all')
  /** 筛选草稿：状态 */
  const [draftStatus, setDraftStatus] = useState<string>('all')
  /** 已应用的筛选条件（无租户维度：后端任务表不含 farmId / farmName / tenantId） */
  const [applied, setApplied] = useState<AppliedFilter>({
    date: dayjs().format('YYYY-MM-DD'),
    taskType: 'all',
    status: 'all',
  })

  /** 任务列表查询 */
  const tasksQuery = useQuery({
    queryKey: ['admin', 'monitor', 'tasks', applied],
    queryFn: () =>
      listTasks({
        pageNum: 1,
        pageSize: 100,
        startDate: applied.date,
        endDate: applied.date,
        taskType: applied.taskType === 'all' ? undefined : applied.taskType,
        // 只有后端真值才能当 status 传；overdue 是本地推导，传过去恒 0 条
        status: SERVER_STATUS_VALUES.includes(applied.status) && applied.status !== 'all'
          ? applied.status
          : undefined,
      }),
    retry: false,
  })

  /** 催办任务 */
  const urgeMutation = useMutation({
    mutationFn: (taskId: string) => urgeTask(taskId),
    onSuccess: () => {
      message.success('催办通知已发送')
      void queryClient.invalidateQueries({ queryKey: ['admin', 'monitor', 'tasks'] })
    },
    onError: (error) => {
      // 失败就是失败：不能把「没催办成功」说成「已登记」
      message.error(`催办失败：${(error as Error | null)?.message ?? '未知错误'}`)
    },
  })

  /** 任务列表：只用后端真实返回，不做任何客户端归属过滤（后端任务表无农场 / 租户维度） */
  const tasks: Task[] = useMemo(() => tasksQuery.data?.list ?? [], [tasksQuery.data])

  /** 指标卡数据：只按真实任务计算；无数据时各项为 null（卡片展示「—」） */
  const metrics = useMemo(() => {
    if (tasks.length === 0) {
      return {
        total: null,
        doneRate: null,
        avgHours: null,
        overdueRate: null,
        hasRealData: false,
      }
    }
    const total = tasks.length
    // 后端「已完成」的真值是 done；旧代码判 accepted（后端无此值）导致 doneCount 恒为 0、完成率恒 0%
    const doneCount = tasks.filter((item) => isTaskDone(item.status)).length
    const overdueCount = tasks.filter((item) => isTaskOverdue(item)).length
    const durationSum = tasks.reduce((sum, item) => {
      const start = dayjs(item.actualStartDate || item.planStartDate).valueOf()
      const end = dayjs(item.actualEndDate || item.planEndDate).valueOf()
      return sum + Math.max((end - start) / 3600000, 0)
    }, 0)
    return {
      total: tasksQuery.data?.total ?? total,
      doneRate: Number(((doneCount / Math.max(total, 1)) * 100).toFixed(1)),
      avgHours: Number((durationSum / Math.max(total, 1)).toFixed(1)),
      overdueRate: Number(((overdueCount / Math.max(total, 1)) * 100).toFixed(1)),
      hasRealData: true,
    }
  }, [tasks, tasksQuery.data?.total])

  /** 甘特图数据：只用真实任务，无任务时为空（图表区渲染空态） */
  const ganttTasks: GanttTask[] = useMemo(() => {
    if (tasks.length === 0) {
      return []
    }
    return tasks.slice(0, 24).map((item) => {
      const planStart = dayjs(item.planStartDate).valueOf()
      const planEnd = dayjs(item.planEndDate).valueOf()
      const isDone = isTaskDone(item.status)
      const isDoing = item.status === TASK_STATUS_DOING || item.status === 'assigned'
      const isOverdue = isTaskOverdue(item)
      const status: GanttStatus = isDone ? 'done' : isDoing ? (isOverdue ? 'overdue' : 'doing') : isOverdue ? 'overdue' : 'waiting'
      return {
        row: item.farmName || item.plotName || item.plotId || '未分配',
        name: item.taskName || TASK_TYPE_LABEL_MAP[item.taskType] || item.taskType,
        planStart,
        planEnd,
        actualStart: item.actualStartDate ? dayjs(item.actualStartDate).valueOf() : planStart,
        actualEnd: item.actualEndDate
          ? dayjs(item.actualEndDate).valueOf()
          : status === 'doing'
            ? Math.min(Date.now(), planEnd)
            : planEnd,
        status,
      }
    })
  }, [tasks, applied.date])

  /** 甘特图行（按农场 / 地块 / 执行人聚合） */
  const ganttRows: string[] = useMemo(
    () => Array.from(new Set(ganttTasks.map((item) => item.row))),
    [ganttTasks],
  )

  /** 甘特图配置：计划条（浅灰）+ 实际条（按状态着色） */
  const ganttOption: EChartsOption = useMemo(() => {
    const base = dayjs(applied.date)
    const axisMin = base.hour(GANTT_START_HOUR).minute(0).second(0).valueOf()
    const axisMax = base.hour(GANTT_END_HOUR).minute(0).second(0).valueOf()
    const planData = ganttTasks.map((item) => ({
      name: `${item.row} · ${item.name}（计划 ${formatHm(item.planStart)}-${formatHm(item.planEnd)}）`,
      value: [ganttRows.indexOf(item.row), item.planStart, item.planEnd],
      itemStyle: { color: '#d9d9d9' },
    }))
    const actualData = ganttTasks.map((item) => ({
      name: `${item.row} · ${item.name}（实际 ${formatHm(item.actualStart)}-${formatHm(item.actualEnd)} · ${GANTT_STATUS_TEXT[item.status]}）`,
      value: [ganttRows.indexOf(item.row), item.actualStart, item.actualEnd],
      itemStyle: { color: GANTT_STATUS_COLOR[item.status] },
    }))
    return {
      tooltip: {
        trigger: 'item',
        formatter: (raw: unknown) => {
          const item = raw as { name?: string; seriesName?: string }
          return `${item.seriesName ?? ''}<br/>${item.name ?? ''}`
        },
      },
      legend: { data: ['计划', '实际'], top: 0, right: 8 },
      grid: { left: 8, right: 24, top: 36, bottom: 8, containLabel: true },
      xAxis: {
        type: 'time',
        min: axisMin,
        max: axisMax,
        axisLabel: { formatter: '{HH}:{mm}' },
        splitLine: { show: true, lineStyle: { type: 'dashed' } },
      },
      yAxis: {
        type: 'category',
        data: ganttRows,
        axisTick: { show: false },
        splitLine: { show: true, lineStyle: { type: 'dashed' } },
      },
      series: [
        {
          type: 'custom',
          name: '计划',
          renderItem: renderPlanItem,
          encode: { x: [1, 2], y: 0 },
          data: planData,
        },
        {
          type: 'custom',
          name: '实际',
          renderItem: renderActualItem,
          encode: { x: [1, 2], y: 0 },
          data: actualData,
        },
      ],
    }
  }, [ganttTasks, ganttRows, applied.date])

  /** 超时任务列表 */
  const overdueRows: OverdueRow[] = useMemo(() => {
    const remote = tasks.filter((item) => isTaskOverdue(item))
    if (remote.length > 0) {
      return remote.map((item) => {
        const diffHours = Math.max(
          Math.round((Date.now() - dayjs(item.planEndDate).valueOf()) / 3600000),
          1,
        )
        return {
          id: item.taskId,
          task: item.taskName || TASK_TYPE_LABEL_MAP[item.taskType] || item.taskType,
          // 后端无 farmName / plotName / assigneeName，退到真实存在的 plotId / assigneeId
          farm: item.farmName || item.plotName || item.plotId || '—',
          plan: dayjs(item.planEndDate).format('HH:mm'),
          overdue: `>${diffHours}h`,
          owner: item.assigneeName || item.assigneeId || '—',
        }
      })
    }
    return []
  }, [tasks])

  /** 任务类型分布：按真实任务统计，无任务时为空 */
  const typeDist = useMemo(() => {
    if (tasks.length === 0) {
      return []
    }
    const counter = new Map<string, number>()
    tasks.forEach((item) => {
      const label = TASK_TYPE_LABEL_MAP[item.taskType] || item.taskType || '其他'
      counter.set(label, (counter.get(label) ?? 0) + 1)
    })
    const total = tasks.length
    return Array.from(counter.entries()).map(([name, value]) => ({
      name,
      value: Number(((value / Math.max(total, 1)) * 100).toFixed(1)),
    }))
  }, [tasks])

  /** 任务类型分布饼图 */
  const typeChartOption: EChartsOption = useMemo(
    () => ({
      tooltip: { trigger: 'item', formatter: '{b}: {c}%' },
      legend: { bottom: 0, type: 'scroll' },
      series: [
        {
          type: 'pie',
          name: '任务类型分布',
          radius: ['40%', '68%'],
          center: ['50%', '44%'],
          avoidLabelOverlap: true,
          label: { formatter: '{b}\n{c}%' },
          data: typeDist,
        },
      ],
    }),
    [typeDist],
  )

  /** 超时任务表格列（原型 P8：任务 | 农场 | 计划 | 超时 | 负责人） */
  const overdueColumns: ColumnsType<OverdueRow> = [
    { title: '任务', dataIndex: 'task', key: 'task', width: 100 },
    { title: '农场', dataIndex: 'farm', key: 'farm', width: 120 },
    { title: '计划', dataIndex: 'plan', key: 'plan', width: 90 },
    {
      title: '超时',
      dataIndex: 'overdue',
      key: 'overdue',
      width: 90,
      render: (value: string) => <Tag color="red">{value}</Tag>,
    },
    { title: '负责人', dataIndex: 'owner', key: 'owner', width: 100 },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_value: unknown, row: OverdueRow) => (
        <Space size={0}>
          <Button
            type="link"
            size="small"
            loading={urgeMutation.isPending}
            onClick={() => urgeMutation.mutate(row.id)}
          >
            催办
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => message.info(`查看「${row.farm}」${row.task}任务详情`)}
          >
            详情
          </Button>
        </Space>
      ),
    },
  ]

  /** 查询：将草稿条件应用到查询 */
  const handleSearch = (): void => {
    setApplied({
      date: draftDate.format('YYYY-MM-DD'),
      taskType: draftType,
      status: draftStatus,
    })
  }

  /** 重置筛选条件 */
  const handleReset = (): void => {
    const today = dayjs()
    setDraftDate(today)
    setDraftType('all')
    setDraftStatus('all')
    setApplied({
      date: today.format('YYYY-MM-DD'),
      taskType: 'all',
      status: 'all',
    })
  }

  /** 导出报告（CSV） */
  const handleExport = (): void => {
    const rows =
      overdueRows.length > 0
        ? overdueRows.map((row) => [row.task, row.farm, row.plan, row.overdue, row.owner])
        : []
    if (rows.length === 0) {
      message.warning('当前无超时任务，无可导出数据')
      return
    }
    exportCsv(`超时任务报告_${applied.date}.csv`, ['任务', '农场', '计划', '超时', '负责人'], rows)
    message.success('报告已导出')
  }

  return (
    <div>
      {/* 面包屑 + 标题 + 导出报告（原型 P8 顶部栏） */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
        <Col>
          <Breadcrumb
            style={{ marginBottom: 4 }}
            items={[
              { href: '/admin/production/dashboard', title: <HomeOutlined /> },
              { title: '生产管理' },
              { title: '生产监控' },
              { title: '任务执行监控' },
            ]}
          />
          <Title level={4} style={{ margin: 0 }}>
            任务执行监控
          </Title>
          <Text type="secondary">全平台农事任务执行进度、甘特排布与超时分析</Text>
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => void queryClient.invalidateQueries({ queryKey: ['admin', 'monitor', 'tasks'] })}>
              刷新
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              导出报告
            </Button>
          </Space>
        </Col>
      </Row>

      {/* 筛选器（原型 P8：日期 / 租户 / 任务类型 / 状态） */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap size={12}>
          <Space size={6}>
            <Text>日期：</Text>
            <DatePicker
              value={draftDate}
              onChange={(value) => setDraftDate(value ?? dayjs())}
              allowClear={false}
            />
          </Space>
          <Space size={6}>
            <Text>任务类型：</Text>
            <Select
              style={{ width: 140 }}
              value={draftType}
              onChange={(value) => setDraftType(value)}
              options={TASK_TYPE_OPTIONS}
            />
          </Space>
          <Space size={6}>
            <Text>状态：</Text>
            <Select
              style={{ width: 120 }}
              value={draftStatus}
              onChange={(value) => setDraftStatus(value)}
              options={STATUS_OPTIONS}
            />
          </Space>
          <Button type="primary" onClick={handleSearch}>
            查询
          </Button>
          <Button onClick={handleReset}>重置</Button>
        </Space>
      </Card>

      {/* 指标卡：全部按真实任务实时计算；无数据时显示「—」。
          原「较昨日 ↑3.1% / ↑1.8% / ↓0.3h / ↓0.8%」后端无同比数据源，已删除。 */}
      <Row gutter={[12, 12]}>
        <Col xs={12} xl={6}>
          <Card size="small" styles={{ body: { padding: 16 } }}>
            {tasksQuery.isLoading ? (
              <Skeleton active title={false} paragraph={{ rows: 2 }} />
            ) : (
              <Statistic title="今日任务" value={metrics.total ?? '—'} />
            )}
          </Card>
        </Col>
        <Col xs={12} xl={6}>
          <Card size="small" styles={{ body: { padding: 16 } }}>
            <Statistic
              title="完成率"
              value={metrics.doneRate ?? '—'}
              precision={1}
              suffix="%"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} xl={6}>
          <Card size="small" styles={{ body: { padding: 16 } }}>
            <Statistic title="平均耗时" value={metrics.avgHours ?? '—'} precision={1} suffix="h" />
          </Card>
        </Col>
        <Col xs={12} xl={6}>
          <Card size="small" styles={{ body: { padding: 16 } }}>
            <Statistic
              title="超时率"
              value={metrics.overdueRate ?? '—'}
              precision={1}
              suffix="%"
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>
      {/* 分子分母口径与「逾期」来源必须明示：逾期不是后端字段，是本地按 planEndDate 推导 */}
      <Typography.Paragraph type="secondary" style={{ fontSize: 12, margin: '8px 0 0' }}>
        完成率 / 平均耗时 / 超时率由本次查询返回的前 {tasks.length} 条任务计算（后端总数{' '}
        {tasksQuery.data?.total ?? '—'} 条）；{OVERDUE_DERIVED_NOTICE}。
      </Typography.Paragraph>

      {/* 任务执行甘特图（原型 P8 Gantt Chart） */}
      <Card
        size="small"
        title="任务执行甘特图"
        style={{ marginTop: 12 }}
        extra={
          <Space size={4}>
            <Tag color="success">完成</Tag>
            <Tag color="processing">进行中</Tag>
            <Tag color="error">超时</Tag>
            <Tag>等待</Tag>
          </Space>
        }
      >
        {tasksQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : ganttRows.length === 0 ? (
          <Empty description="当前筛选条件下暂无任务" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <ReactECharts
            option={ganttOption}
            style={{ height: Math.max(ganttRows.length * 52 + 80, 260) }}
            notMerge
          />
        )}
      </Card>

      {/* 超时任务列表 + 任务类型分布 */}
      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col xs={24} lg={14}>
          <Card
            size="small"
            title="超时任务列表"
            extra={
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {OVERDUE_DERIVED_NOTICE}
              </Typography.Text>
            }
          >
            <Table<OverdueRow>
              rowKey="id"
              size="small"
              columns={overdueColumns}
              dataSource={overdueRows}
              pagination={false}
              locale={{ emptyText: <Empty description="暂无超时任务" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card
            size="small"
            title="任务类型分布"
            extra={
              <Text type="secondary">
                总计 {metrics.total === null ? '—' : metrics.total.toLocaleString('zh-CN')}
              </Text>
            }
          >
            {typeDist.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  tasksQuery.isError
                    ? `任务接口加载失败：${(tasksQuery.error as Error | null)?.message ?? '未知错误'}`
                    : '后端暂无任务数据'
                }
              />
            ) : (
              <ReactECharts option={typeChartOption} style={{ height: 300 }} notMerge />
            )}
          </Card>
        </Col>
      </Row>

      {/* 数据口径提示：只说明真实口径，不再出现「示例口径」话术 */}
      <AntAlert
        style={{ marginTop: 12 }}
        type={tasksQuery.isError ? 'error' : metrics.hasRealData ? 'success' : 'info'}
        showIcon
        message={
          tasksQuery.isError
            ? `任务接口加载失败：${(tasksQuery.error as Error | null)?.message ?? '未知错误'}`
            : metrics.hasRealData
              ? `已加载 ${tasks.length} 条真实任务数据（日期：${applied.date}）`
              : '后端未返回任务数据，甘特图、超时列表与类型分布均为空，指标卡显示「—」。任务表无 farmId / farmName / tenantId，故「租户」筛选已移除，农场 / 负责人列退到 plotId / assigneeId 展示。'
        }
      />
    </div>
  )
}
