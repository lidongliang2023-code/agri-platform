import ProTable from '@/components/ProductionTable'
/**
 * 页面名称：任务列表（看板）
 * 路由路径：/production/tasks
 * 所属模块：农事生产
 * PRD 序号：PRD 6.1 #14
 * 原型来源：用户端原型 P7 tasks（看板视图）
 *
 * 还原要点：
 * - 标题「📋 农事任务管理」+ 新建任务 / 今日任务看板 / 导出 按钮
 * - 状态 Tab（全部 / 待执行 / 执行中 / 待验收 / 已完成 / 已逾期）带数量
 * - 看板直接平铺任务卡片，卡片内展示任务类型与状态标签
 * - 卡片字段：任务名 / 地块 | 执行人 / 计划时间 / 优先级标签 + 类型标签
 * - 额外提供「列表 / 看板」视图切换与关键字、状态、类型、优先级、执行人、地块筛选
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import PageContainer from '@/components/ProductionPageContainer'
import type { ProColumns } from '@ant-design/pro-components'
import {
  Button,
  Col,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Segmented,
  Select,
  Space,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  CheckCircleOutlined,
  DeleteOutlined,
  ExportOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons'
import Card from '@/components/SectionCard'
import dayjs from 'dayjs'
import useFarmStore from '@/store/farm'
import {
  deleteTask,
  dispatchTask,
  executeTask,
  fetchTaskPage,
  submitTaskResult,
} from '@/api/tasks'
import { listMembers } from '@/api/members'
import { listPlots } from '@/api/plots'
import type { Member, Plot, Task } from '@/types'
import {
  isTaskDone,
  isTaskExecuting,
  isTaskOverdue,
  TASK_ACCEPT_PENDING,
  TASK_STATUS_COMPLETED,
  TASK_STATUS_EXECUTING,
} from '@/types/task'
import {
  ACCEPT_STATUS_META,
  TASK_PRIORITY_COLOR_MAP,
  TASK_PRIORITY_LABEL_MAP,
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_COLOR_MAP,
  TASK_STATUS_LABEL_MAP,
  TASK_STATUS_OPTIONS,
  TASK_TYPE_LABEL_MAP,
  TASK_TYPE_OPTIONS,
} from '@/types'

/** 视图模式：列表 / 看板 */
type ViewMode = 'table' | 'kanban'

/**
 * 状态 Tab 键值。
 *
 * `doing` / `done` 仅作为稳定的 UI 内部 key，不直接等同服务端 status。迁移窗口内，执行中同时
 * 匹配 `executing / doing`，已完成同时匹配 `completed / done`；下压查询时使用 PRD 标准值。
 * `overdue` 不是后端状态，走本地推导。
 *
 * `acceptPending`（待验收）也不是 status 取值，而由「完成态 + acceptStatus === 0」表达。
 */
type TabKey = 'all' | 'pending' | 'doing' | 'acceptPending' | 'done' | 'rejected' | 'overdue'

/**
 * 无法用后端 `GET /tasks` 的 `status` 入参表达的 Tab，只能客户端筛选。
 *
 * 依据（`core-platform` `TaskController.pageQuery`，仅接受 page/size/keyword/status）：
 * - `pending` 含 `pending` + `assigned` 两个值，而 status 只接受单值；
 * - `overdue` 后端不存储，是本地按 planEndDate 推导的派生口径；
 * - `acceptPending` 在 acceptStatus 维度，后端不提供该入参。
 *
 * 这三个 Tab 在列表视图下必须改用本地筛选结果分页；否则会出现
 * 「Tab 写着 N 条、表格却列出全部」的口径不一致（旧代码三者全都有这个毛病）。
 */
const CLIENT_ONLY_TABS: readonly TabKey[] = ['pending', 'overdue', 'acceptPending']

/** 列表筛选条件 */
interface TaskFilters {
  /** 关键字（任务名称 / 编号） */
  keyword?: string
  /** 状态 */
  status?: string
  /** 任务类型 */
  taskType?: string
  /** 优先级 */
  priority?: number
  /** 执行人 */
  assigneeId?: string
  /** 地块 */
  plotId?: string
}

/**
 * 已逾期判定：统一走 {@link isTaskOverdue}（本地按 planEndDate 推导，非后端状态）。
 *
 * @param task 任务
 * @returns 是否逾期
 */
function isOverdue(task: Task): boolean {
  return isTaskOverdue(task)
}

/** 今日任务判定：今天落在计划起止区间内 */
function isTodayTask(task: Task): boolean {
  const today = dayjs().startOf('day')
  const start = task.planStartDate ? dayjs(task.planStartDate).startOf('day') : today
  const end = task.planEndDate ? dayjs(task.planEndDate).endOf('day') : today
  return !today.isBefore(start) && !today.isAfter(end)
}

/** Tab 过滤：全部 / 待执行 / 执行中 / 待验收 / 已完成 / 已驳回 / 已逾期 */
function matchTab(task: Task, tab: TabKey): boolean {
  switch (tab) {
    case 'all':
      return true
    case 'pending':
      return task.status === 'pending' || task.status === 'assigned'
    case 'doing':
      return isTaskExecuting(task.status)
    case 'done':
      return isTaskDone(task.status)
    case 'rejected':
      return task.status === 'rejected'
    case 'overdue':
      return isOverdue(task)
    case 'acceptPending':
      return isTaskDone(task.status) && task.acceptStatus === TASK_ACCEPT_PENDING
  }
}

/**
 * Tab 对应的后端 status 查询值。
 * 待执行（pending + assigned）与已逾期为复合条件，交由前端过滤，故不传 status。
 */
function toServerStatus(tab: TabKey): string | undefined {
  // 后端服务层写入的是 executing / completed（并在查询时兼容旧词 doing / done），
  // 查询下压必须用新词；此前传 doing/done 会把执行中 / 已完成列表筛成 0 条。
  if (tab === 'doing') return TASK_STATUS_EXECUTING
  if (tab === 'done') return TASK_STATUS_COMPLETED
  if (tab === 'rejected') return 'rejected'
  // pending（两值合并）、overdue（派生）、acceptPending（另一维度）都不行，
  // 统一返回 undefined，由 {@link CLIENT_ONLY_TABS} 标记改用本地筛选。
  return undefined
}

/** CSV 单元格转义 */
function escapeCsv(value: string): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

/**
 * 任务列表页
 *
 * 业务职责：农事任务台账，支持看板 / 列表双视图、状态 Tab、条件筛选、派发、验收与删除。
 *
 * @returns 页面内容
 */
export default function TaskList(): JSX.Element {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const currentFarm = useFarmStore((state) => state.currentFarm)
  const farmId = currentFarm?.farmId

  const [view, setView] = useState<ViewMode>('table')
  const [tab, setTab] = useState<TabKey>('all')
  const [pageNum, setPageNum] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(20)
  const [filters, setFilters] = useState<TaskFilters>({})
  const [todayOnly, setTodayOnly] = useState<boolean>(false)
  const [filterForm] = Form.useForm<TaskFilters>()

  const [assignTarget, setAssignTarget] = useState<Task | null>(null)
  const [assigneeId, setAssigneeId] = useState<string | undefined>(undefined)

  /** 看板 / 统计数据源：一次性取较大页，客户端分组与计数 */
  const boardQuery = useQuery({
    queryKey: ['production-tasks', 'board', farmId, filters],
    enabled: Boolean(farmId),
    queryFn: () => fetchTaskPage({ farmId, ...filters, pageNum: 1, pageSize: 200 }),
  })

  /** 当前 Tab 能否下压到后端 status 参数；不能的走本地筛选（见 CLIENT_ONLY_TABS） */
  const clientOnlyTab = CLIENT_ONLY_TABS.includes(tab)

  /** 列表视图数据源：服务端分页（仅当后端能表达当前 Tab 时才发请求） */
  const tableQuery = useQuery({
    queryKey: ['production-tasks', 'table', farmId, filters, tab, pageNum, pageSize],
    enabled: Boolean(farmId) && view === 'table' && !clientOnlyTab,
    queryFn: () =>
      fetchTaskPage({
        farmId,
        ...filters,
        status: toServerStatus(tab) ?? filters.status,
        pageNum,
        pageSize,
      }),
  })

  /** 地块下拉（按当前农场） */
  const plotQuery = useQuery({
    queryKey: ['plot-options', farmId],
    enabled: Boolean(farmId),
    queryFn: () => listPlots({ farmId, pageNum: 1, pageSize: 100 }),
  })

  /** 执行人下拉（按当前农场） */
  const memberQuery = useQuery({
    queryKey: ['member-options', farmId],
    enabled: Boolean(farmId),
    queryFn: () => listMembers({ farmId, pageNum: 1, pageSize: 100 }),
  })

  const plotOptions = useMemo(
    () =>
      (plotQuery.data?.list ?? []).map((plot: Plot) => ({
        value: plot.plotId,
        label: plot.plotName,
      })),
    [plotQuery.data],
  )

  const memberOptions = useMemo(
    () =>
      (memberQuery.data?.list ?? []).map((member: Member) => ({
        value: member.memberId,
        label: member.realName,
      })),
    [memberQuery.data],
  )

  /** 全部任务（不含 Tab 过滤），用于状态计数 */
  const allTasks = useMemo<Task[]>(() => boardQuery.data?.list ?? [], [boardQuery.data])

  /** 按 Tab + 今日任务过滤后的任务集合 */
  const filteredTasks = useMemo<Task[]>(
    () => allTasks.filter((task) => matchTab(task, tab) && (!todayOnly || isTodayTask(task))),
    [allTasks, tab, todayOnly],
  )

  /** 状态 Tab 计数 */
  const tabCounts = useMemo<Record<TabKey, number>>(() => {
    const counts: Record<TabKey, number> = {
      all: allTasks.length,
      pending: 0,
      doing: 0,
      acceptPending: 0,
      done: 0,
      rejected: 0,
      overdue: 0,
    }
    allTasks.forEach((task) => {
      if (task.status === 'pending' || task.status === 'assigned') counts.pending += 1
      if (isTaskExecuting(task.status)) counts.doing += 1
      if (isTaskDone(task.status)) {
        counts.done += 1
        // 待验收是「已完成」里还没验收的那一批（验收维度，非 status 维度）
        if (task.acceptStatus === TASK_ACCEPT_PENDING) counts.acceptPending += 1
      }
      if (task.status === 'rejected') counts.rejected += 1
      if (isOverdue(task)) counts.overdue += 1
    })
    return counts
  }, [allTasks])

  /**
   * 列表视图的行与总数。
   *
   * 后端能表达当前 Tab 时走服务端分页；不能表达（待执行 / 已逾期 / 待验收）时用
   * 本地筛选结果做本地分页 —— 否则 Tab 计数与表格内容会对不上。
   */
  const tableRows = useMemo<Task[]>(() => {
    if (!clientOnlyTab) {
      return tableQuery.data?.list ?? []
    }
    const start = (pageNum - 1) * pageSize
    return filteredTasks.slice(start, start + pageSize)
  }, [clientOnlyTab, tableQuery.data, filteredTasks, pageNum, pageSize])

  /** 列表视图总数（与 {@link tableRows} 同源） */
  const tableTotal = clientOnlyTab ? filteredTasks.length : (tableQuery.data?.total ?? 0)

  /** 列表视图加载态（本地筛选时看板查询即为数据源） */
  const tableLoading = clientOnlyTab ? boardQuery.isFetching : tableQuery.isFetching

  /** 统一失效刷新 */
  const invalidateTasks = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: ['production-tasks'] })

  /** 派发任务 */
  const assignMutation = useMutation({
    mutationFn: (params: { taskId: string; assigneeId: string }) =>
      dispatchTask(params.taskId, params.assigneeId),
    onSuccess: () => {
      message.success('任务已派发')
      setAssignTarget(null)
      setAssigneeId(undefined)
      void invalidateTasks()
    },
    onError: (error: Error) => message.error(error.message || '派发失败'),
  })

  /** 列表内快捷开始执行 */
  const startMutation = useMutation({
    mutationFn: (taskId: string) => executeTask(taskId),
    onSuccess: () => {
      message.success('任务已开始执行')
      void invalidateTasks()
    },
    onError: (error: Error) => message.error(error.message || '开始执行失败'),
  })

  /** 列表内快捷提交成果（执行中 → 待验收） */
  const submitMutation = useMutation({
    mutationFn: (taskId: string) => submitTaskResult(taskId),
    onSuccess: () => {
      message.success('成果已提交，等待验收')
      void invalidateTasks()
    },
    onError: (error: Error) => message.error(error.message || '提交成果失败'),
  })

  /** 删除任务 */
  const deleteMutation = useMutation({
    mutationFn: (taskId: string) => deleteTask(taskId),
    onSuccess: () => {
      message.success('任务已删除')
      void invalidateTasks()
    },
    onError: (error: Error) => message.error(error.message || '删除失败'),
  })

  /** 打开派发弹窗 */
  const openAssign = (task: Task): void => {
    setAssignTarget(task)
    setAssigneeId(task.assigneeId)
  }

  /** 确认派发 */
  const confirmAssign = (): void => {
    if (!assignTarget) return
    if (!assigneeId) {
      message.warning('请选择执行人')
      return
    }
    assignMutation.mutate({ taskId: assignTarget.taskId, assigneeId })
  }

  /** 查询按钮 */
  const handleSearch = (): void => {
    const values = filterForm.getFieldsValue()
    setPageNum(1)
    setFilters(values)
  }

  /** 重置按钮 */
  const handleReset = (): void => {
    filterForm.resetFields()
    setPageNum(1)
    setFilters({})
  }

  /** 导出当前筛选结果为 CSV */
  const handleExport = (): void => {
    const rows = view === 'table' ? (clientOnlyTab ? filteredTasks : (tableQuery.data?.list ?? [])) : filteredTasks
    if (rows.length === 0) {
      message.warning('暂无可导出的数据')
      return
    }
    const header = [
      '任务编号',
      '任务名称',
      '类型',
      '地块',
      '执行人',
      '计划开始',
      '计划结束',
      '优先级',
      '状态',
      '验收状态',
    ]
    const body = rows.map((task) =>
      [
        task.taskNo,
        task.taskName,
        TASK_TYPE_LABEL_MAP[task.taskType] ?? task.taskType,
        task.plotName ?? task.plotId ?? '-',
        task.assigneeName ?? '未派发',
        task.planStartDate ?? '-',
        task.planEndDate ?? '-',
        TASK_PRIORITY_LABEL_MAP[task.priority] ?? '普通',
        TASK_STATUS_LABEL_MAP[task.status] ?? task.status,
        ACCEPT_STATUS_META[task.acceptStatus]?.label ?? '待验收',
      ]
        .map(escapeCsv)
        .join(','),
    )
    const csv = `\uFEFF${[header.join(','), ...body].join('\n')}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `农事任务_${dayjs().format('YYYYMMDDHHmm')}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    message.success(`已导出 ${rows.length} 条任务`)
  }

  /** 任务可执行的动作（按状态 + 验收维度判定，避免对已完成任务还显示「开始执行」） */
  const canStart = (task: Task): boolean =>
    task.status === 'pending' || task.status === 'assigned' || task.status === 'rejected'
  const canAssign = (task: Task): boolean =>
    task.status === 'pending' || task.status === 'assigned' || task.status === 'rejected'
  const canSubmit = (task: Task): boolean => isTaskExecuting(task.status)
  const canAccept = (task: Task): boolean =>
    isTaskDone(task.status) && task.acceptStatus === TASK_ACCEPT_PENDING
  const canDelete = (task: Task): boolean => !isTaskExecuting(task.status)

  /** 列表视图列定义 */
  const columns: ProColumns<Task>[] = [
    { title: '任务编号', dataIndex: 'taskNo', width: 180 },
    { title: '任务名称', dataIndex: 'taskName', width: 220, ellipsis: true },
    {
      title: '类型',
      dataIndex: 'taskType',
      width: 110,
      render: (_, record) => (
        <Tag color="geekblue">{TASK_TYPE_LABEL_MAP[record.taskType] ?? record.taskType}</Tag>
      ),
    },
    {
      title: '地块',
      dataIndex: 'plotName',
      width: 120,
      render: (_, record) => record.plotName ?? record.plotId ?? '-',
    },
    {
      title: '执行人',
      dataIndex: 'assigneeName',
      width: 110,
      render: (_, record) =>
        record.assigneeName ?? <Typography.Text type="secondary">未派发</Typography.Text>,
    },
    {
      title: '计划时间',
      key: 'planRange',
      width: 200,
      render: (_, record) => (
        <span>
          {record.planStartDate ?? '-'} ~ {record.planEndDate ?? '-'}
        </span>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 90,
      render: (_, record) => (
        <Tag color={TASK_PRIORITY_COLOR_MAP[record.priority] ?? 'default'}>
          {TASK_PRIORITY_LABEL_MAP[record.priority] ?? '普通'}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (_, record) => (
        <Space size={4}>
          <Tag color={TASK_STATUS_COLOR_MAP[record.status] ?? 'default'}>
            {TASK_STATUS_LABEL_MAP[record.status] ?? record.status}
          </Tag>
          {isOverdue(record) && <Tag color="red">已逾期</Tag>}
        </Space>
      ),
    },
    {
      title: '验收',
      dataIndex: 'acceptStatus',
      width: 100,
      render: (_, record) => {
        const meta = ACCEPT_STATUS_META[record.acceptStatus] ?? ACCEPT_STATUS_META[0]
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: '操作',
      fixed: 'right',
      key: 'option',
      width: 280,
      valueType: 'option',
      render: (_, record) => {
        const actions: JSX.Element[] = [
          <Typography.Link
            key="detail"
            onClick={() => navigate(`/production/tasks/${record.taskId}`)}
          >
            详情
          </Typography.Link>,
        ]
        if (canStart(record)) {
          actions.push(
            <Typography.Link
              key="start"
              onClick={() => startMutation.mutate(record.taskId)}
            >
              开始
            </Typography.Link>,
          )
        }
        if (canAssign(record)) {
          actions.push(
            <Typography.Link key="assign" onClick={() => openAssign(record)}>
              派发
            </Typography.Link>,
          )
        }
        if (canSubmit(record)) {
          actions.push(
            <Popconfirm
              key="submit"
              title="确认提交任务成果？"
              description="提交后任务进入待验收，验收通过前不能再次修改。"
              okText="提交"
              cancelText="取消"
              onConfirm={() => submitMutation.mutate(record.taskId)}
            >
              <Typography.Link>提交成果</Typography.Link>
            </Popconfirm>,
          )
        }
        if (canAccept(record)) {
          actions.push(
            <Typography.Link
              key="accept"
              onClick={() => navigate(`/production/tasks/${record.taskId}/acceptance`)}
            >
              验收
            </Typography.Link>,
          )
        }
        if (canDelete(record)) {
          actions.push(
            <Popconfirm
              key="delete"
              title="确认删除该任务？"
              description="删除后不可恢复，请谨慎操作。"
              okText="确认删除"
              cancelText="取消"
              onConfirm={() => deleteMutation.mutate(record.taskId)}
            >
              <Typography.Link type="danger">删除</Typography.Link>
            </Popconfirm>,
          )
        }
        return actions
      },
    },
  ]

  /** 渲染单张任务卡片 */
  const renderTaskCard = (task: Task): JSX.Element => (
    <Card
      size="small"
      hoverable
      style={{ height: '100%' }}
      onClick={() => navigate(`/production/tasks/${task.taskId}`)}
      title={
        <Space size={4}>
          <span>{task.taskName}</span>
          {isOverdue(task) && <Tag color="red">逾期</Tag>}
        </Space>
      }
      extra={
        <Space size={4} wrap>
          <Tag color={isTaskDone(task.status) && task.acceptStatus === TASK_ACCEPT_PENDING ? 'gold' : TASK_STATUS_COLOR_MAP[task.status] ?? 'default'}>
            状态：{isTaskDone(task.status) && task.acceptStatus === TASK_ACCEPT_PENDING ? '待验收' : TASK_STATUS_LABEL_MAP[task.status] ?? task.status ?? '未知'}
          </Tag>
          <Tag color={TASK_PRIORITY_COLOR_MAP[task.priority] ?? 'default'}>
            {TASK_PRIORITY_LABEL_MAP[task.priority] ?? '普通'}
          </Tag>
        </Space>
      }
    >
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Typography.Text type="secondary">
          {task.plotName ?? task.plotId ?? '未指定地块'} | {task.assigneeName ?? '未派发'}
        </Typography.Text>
        <Typography.Text type="secondary">
          {task.planStartDate ?? '-'} ~ {task.planEndDate ?? '-'}
        </Typography.Text>
        <Space size={4} wrap>
          <Tag color="geekblue">{TASK_TYPE_LABEL_MAP[task.taskType] ?? task.taskType}</Tag>
          {task.rejectCount > 0 && <Tag color="volcano">驳回 {task.rejectCount} 次</Tag>}
        </Space>
        <Space size={8} wrap onClick={(event) => event.stopPropagation()}>
          <Typography.Link onClick={() => navigate(`/production/tasks/${task.taskId}`)}>
            详情
          </Typography.Link>
          {canStart(task) && (
            <Typography.Link onClick={() => startMutation.mutate(task.taskId)}>
              <PlayCircleOutlined /> 开始
            </Typography.Link>
          )}
          {canAssign(task) && (
            <Typography.Link onClick={() => openAssign(task)}>
              <UserSwitchOutlined /> 派发
            </Typography.Link>
          )}
          {canSubmit(task) && (
            <Typography.Link onClick={() => submitMutation.mutate(task.taskId)}>
              提交成果
            </Typography.Link>
          )}
          {canAccept(task) && (
            <Typography.Link
              onClick={() => navigate(`/production/tasks/${task.taskId}/acceptance`)}
            >
              <CheckCircleOutlined /> 验收
            </Typography.Link>
          )}
          {canDelete(task) && (
            <Popconfirm
              title="确认删除该任务？"
              okText="确认删除"
              cancelText="取消"
              onConfirm={() => deleteMutation.mutate(task.taskId)}
            >
              <Typography.Link type="danger">
                <DeleteOutlined /> 删除
              </Typography.Link>
            </Popconfirm>
          )}
        </Space>
      </Space>
    </Card>
  )

  /** 看板直接展示任务卡片，不再按状态嵌套分栏。 */
  const renderBoard = (): JSX.Element => (
    <Card loading={boardQuery.isLoading} bordered={false} styles={{ body: { padding: 0 } }} style={{ boxShadow: 'none', background: 'transparent' }}>
      {filteredTasks.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无任务" />
      ) : (
        <Row gutter={[16, 16]}>
          {filteredTasks.map((task) => (
            <Col key={task.taskId} xs={24} md={12} xl={8} xxl={6}>
              {renderTaskCard(task)}
            </Col>
          ))}
        </Row>
      )}
    </Card>
  )

  /** 列表与看板共用状态筛选。 */
  const renderStatusTabs = (): JSX.Element => (
        <Tabs
          activeKey={tab}
          onChange={(key) => {
            setTab(key as TabKey)
            setPageNum(1)
          }}
          items={[
            { key: 'all', label: `全部(${tabCounts.all})` },
            { key: 'pending', label: `待执行(${tabCounts.pending})` },
            { key: 'doing', label: `执行中(${tabCounts.doing})` },
            {
              key: 'acceptPending',
              label: `待验收(${tabCounts.acceptPending})`,
            },
            { key: 'done', label: `已完成(${tabCounts.done})` },
            { key: 'rejected', label: `已驳回(${tabCounts.rejected})` },
            { key: 'overdue', label: `已逾期(${tabCounts.overdue})` },
          ]}
        />
  )

  /** 渲染列表 */
  const renderTable = (): JSX.Element => (
    <ProTable<Task>
      headerTitle={false}
      toolbar={{
        title: renderStatusTabs(),
        style: { padding: 0 },
      }}
      toolBarRender={() => []}
      cardProps={{ bordered: false, bodyStyle: { padding: '0 20px 16px' }, style: { boxShadow: 'none' } }}
      rowKey="taskId"
      columns={columns}
      dataSource={tableRows}
      loading={tableLoading}
      search={false}
      // 为编号与名称预留列宽，窄屏时在容器内横向滚动
      scroll={{ x: 1600 }}
      options={{ reload: () => void invalidateTasks(), density: true, setting: true, fullScreen: false }}
      pagination={{
        current: pageNum,
        pageSize,
        total: tableTotal,
        showSizeChanger: true,
        onChange: (nextPage, nextSize) => {
          setPageNum(nextPage)
          setPageSize(nextSize)
        },
      }}
    />
  )

  return (
    <PageContainer
      title="📋 农事任务管理"
      subTitle={currentFarm ? currentFarm.farmName : undefined}
      extra={[
        <Segmented
          key="view"
          value={view}
          onChange={(value) => setView(value as ViewMode)}
          options={[
            { label: '列表', value: 'table' },
            { label: '看板', value: 'kanban' },
          ]}
        />,
        <Button
          key="create"
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/production/tasks/create')}
        >
          新建任务
        </Button>,
        <Button
          key="today"
          onClick={() => {
            setView('kanban')
            setTodayOnly((prev) => !prev)
          }}
        >
          📊 今日任务看板
        </Button>,
        <Button key="export" icon={<ExportOutlined />} onClick={handleExport}>
          导出
        </Button>,
        // 「任务模板库」按钮已撤（2026-10-16）：该页搬到运营端由平台运营维护。
        // 用户端仍在「新建任务」的模板下拉里**使用**模板，只是不再有维护入口 ——
        // 留着这个按钮会跳到用户端已不存在的路由（404）。
      ]}
    >
      <Card style={{ marginBottom: 16 }}>
        <Form form={filterForm} layout="inline" style={{ rowGap: 12 }}>
          <Form.Item name="keyword" label="关键字">
            <Input allowClear placeholder="任务名称 / 编号" style={{ width: 180 }} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select
              allowClear
              placeholder="全部状态"
              options={TASK_STATUS_OPTIONS}
              style={{ width: 130 }}
            />
          </Form.Item>
          <Form.Item name="taskType" label="类型">
            <Select
              allowClear
              placeholder="全部类型"
              options={TASK_TYPE_OPTIONS}
              style={{ width: 130 }}
            />
          </Form.Item>
          <Form.Item name="priority" label="优先级">
            <Select
              allowClear
              placeholder="全部优先级"
              options={TASK_PRIORITY_OPTIONS}
              style={{ width: 120 }}
            />
          </Form.Item>
          <Form.Item name="assigneeId" label="执行人">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="全部执行人"
              options={memberOptions}
              style={{ width: 140 }}
            />
          </Form.Item>
          <Form.Item name="plotId" label="地块">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="全部地块"
              options={plotOptions}
              style={{ width: 140 }}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" onClick={handleSearch}>
                查询
              </Button>
              <Button onClick={handleReset}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
        {todayOnly && (
          <Tag
            closable
            color="blue"
            style={{ marginTop: 8 }}
            onClose={() => {
              setTodayOnly(false)
            }}
          >
            仅看今日任务
          </Tag>
        )}
      </Card>

      <Card>
        {view === 'kanban' && renderStatusTabs()}
        {!farmId ? (
          <Empty description="请先在顶部切换农场" />
        ) : view === 'kanban' && boardQuery.isError ? (
          <Empty
            description={
              <Space direction="vertical">
                <Typography.Text type="danger">任务数据加载失败，请稍后重试</Typography.Text>
                <Button onClick={() => void invalidateTasks()}>重新加载</Button>
              </Space>
            }
          />
        ) : view === 'table' && (clientOnlyTab ? boardQuery.isError : tableQuery.isError) ? (
          <Empty
            description={
              <Space direction="vertical">
                <Typography.Text type="danger">任务数据加载失败，请稍后重试</Typography.Text>
                <Button onClick={() => void invalidateTasks()}>重新加载</Button>
              </Space>
            }
          />
        ) : view === 'kanban' ? (
          renderBoard()
        ) : (
          renderTable()
        )}
      </Card>

      <Modal
        title={`派发任务：${assignTarget?.taskName ?? ''}`}
        open={Boolean(assignTarget)}
        okText="确认派发"
        cancelText="取消"
        confirmLoading={assignMutation.isPending}
        onOk={confirmAssign}
        onCancel={() => {
          setAssignTarget(null)
          setAssigneeId(undefined)
        }}
        destroyOnClose
      >
        <Form layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="执行人" required>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="请选择执行人"
              options={memberOptions}
              value={assigneeId}
              onChange={setAssigneeId}
            />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  )
}
