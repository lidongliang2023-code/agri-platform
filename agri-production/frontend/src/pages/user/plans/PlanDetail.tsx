/**
 * 页面名称：种养计划详情
 * 路由路径：/production/plans/:planId
 * 所属模块：智能种养
 * PRD 序号：PRD 6.1 #12（对应 PRD 8.2 PLAN-02 生育期编排 / PLAN-05 进度追踪）
 *
 * 页面用途（PRD）：计划详情、生育期安排、进度追踪。
 * 结构：头部（返回 / 状态 / 操作）→ 基本信息 Descriptions + 进度卡 →
 * 生育期安排时间线 + 关联农事任务列表。
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  App as AntdApp,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  List,
  Popconfirm,
  Progress,
  Result,
  Row,
  Skeleton,
  Space,
  Statistic,
  Steps,
  Table,
  Tag,
  Timeline,
  Tooltip,
  Typography,
} from 'antd'
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  DeleteOutlined,
  EditOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
} from '@ant-design/icons'
import {
  ModalForm,
  ProFormDatePicker,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components'
import {
  createPlanStage,
  fetchPlanDetail,
  fetchPlanStages,
  fetchPlanTasks,
  removePlanStage,
  startPlan,
  terminatePlan,
  updatePlanStage,
} from '@/api/production-view'
import type { PlanStagePayload } from '@/api/production-view'
import {
  TASK_TYPE_META,
  calcPlanProgress,
  formatAreaNumber,
  formatNumber,
  planStatusMeta,
  priorityMeta,
  taskStatusMeta,
  taskTypeLabel,
} from '@/utils/production-adapter'
import type { PlanStageView } from '@/api/production-view'
import type { PlanStage, Task } from '@/types'
import { isTaskDone } from '@/types/task'

/** 阶段「默认任务类型」下拉选项 */
const taskTypeOptions = Object.entries(TASK_TYPE_META).map(([value, label]) => ({
  value,
  label,
}))

/**
 * 种养计划详情
 * @returns 页面内容
 */
export default function PlanDetail(): JSX.Element {
  const { planId = '' } = useParams<{ planId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { message } = AntdApp.useApp()
  const queryClient = useQueryClient()

  /**
   * 路由表中并不存在 /production/plans/create（PRD 6.1 仅有列表 / 详情 / 日历三条）。
   * 该路径会被 `plans/:planId` 动态段捕获，从而把 "create" 当成计划主键去查详情并落到 404 空态。
   * 这里把 create / new 这类「新建」别名重定向到列表页并自动打开新建弹窗，
   * 保证任何指向 /production/plans/create 的入口都能正常工作。
   */
  const isCreateAlias = planId === 'create' || planId === 'new'

  useEffect(() => {
    if (!isCreateAlias) return
    const next = new URLSearchParams()
    next.set('create', '1')
    // 透传来源上下文（农场 / 地块 / 作物），使新建表单可预填
    const carryKeys = ['farmId', 'plotId', 'cropId', 'cropVariety']
    carryKeys.forEach((key) => {
      const value = searchParams.get(key)
      if (value) next.set(key, value)
    })
    navigate(`/production/plans?${next.toString()}`, { replace: true })
  }, [isCreateAlias, navigate, searchParams])

  const isQueryEnabled = planId !== '' && !isCreateAlias

  const planQuery = useQuery({
    queryKey: ['plan-detail', planId],
    queryFn: () => fetchPlanDetail(planId),
    enabled: isQueryEnabled,
    retry: false,
  })

  const stagesQuery = useQuery({
    queryKey: ['plan-stages', planId],
    queryFn: () => fetchPlanStages(planId),
    enabled: isQueryEnabled,
  })

  const tasksQuery = useQuery({
    queryKey: ['plan-tasks', planId],
    queryFn: () => fetchPlanTasks(planId, 50),
    enabled: isQueryEnabled,
  })

  /**
   * 刷新全部区块
   * @returns void
   */
  async function refreshAll(): Promise<void> {
    await Promise.all([planQuery.refetch(), stagesQuery.refetch(), tasksQuery.refetch()])
  }

  const startMutation = useMutation({
    mutationFn: () => startPlan(planId),
    onSuccess: () => {
      message.success('计划已启动')
      void queryClient.invalidateQueries({ queryKey: ['plan-detail', planId] })
    },
    onError: (error: Error) => message.error(error.message || '启动失败'),
  })

  const terminateMutation = useMutation({
    mutationFn: () => terminatePlan(planId),
    onSuccess: () => {
      message.success('计划已终止')
      void queryClient.invalidateQueries({ queryKey: ['plan-detail', planId] })
    },
    onError: (error: Error) => message.error(error.message || '终止失败'),
  })

  /* ==================== PLAN-02 生育期阶段编排 ==================== */

  /** 阶段表单开关 */
  const [stageFormOpen, setStageFormOpen] = useState<boolean>(false)
  /** 正在编辑的阶段，null 表示新增 */
  const [editingStage, setEditingStage] = useState<PlanStageView | null>(null)

  /** 刷新计划的全部区块 */
  async function reloadStages(): Promise<void> {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['plan-stages', planId] }),
      stagesQuery.refetch(),
    ])
  }

  const createStageMutation = useMutation({
    mutationFn: (payload: PlanStagePayload) => createPlanStage(planId, payload),
    onSuccess: () => {
      message.success('生育期阶段已添加')
      setStageFormOpen(false)
      setEditingStage(null)
      void reloadStages()
    },
    onError: (error: Error) => message.error(error.message || '新增阶段失败'),
  })

  const updateStageMutation = useMutation({
    mutationFn: (vars: { stageId: string; payload: Partial<PlanStagePayload> }) =>
      updatePlanStage(planId, vars.stageId, vars.payload),
    onSuccess: () => {
      message.success('阶段已更新')
      setStageFormOpen(false)
      setEditingStage(null)
      void reloadStages()
    },
    onError: (error: Error) => message.error(error.message || '更新阶段失败'),
  })

  const removeStageMutation = useMutation({
    mutationFn: (stageId: string) => removePlanStage(planId, stageId),
    onSuccess: () => {
      message.success('阶段已删除')
      void reloadStages()
    },
    onError: (error: Error) => message.error(error.message || '删除阶段失败'),
  })

  const plan = planQuery.data
  const stages = stagesQuery.data ?? []
  const tasks = tasksQuery.data ?? []

  /** 计划时间进度 */
  const progress = useMemo(() => (plan ? calcPlanProgress(plan) : 0), [plan])

  /**
   * 阶段统计（PLAN-05 进度追踪与偏差分析的**唯一数据源**）
   *
   * 口径说明：
   * - `prod_plan_stage` 表未提供实际日期列，阶段完成以 `status === 3` 判定；
   * - 延误天数 = 未完成阶段中，「今天」超出其计划结束日期的最大天数（全按期则为 0）；
   * - PLAN-02 顺延 / 新增阶段后，页面所有区块均由此重算，不会算出两套天数。
   */
  const stageStats = useMemo(() => {
    const today = dayjs().startOf('day')
    let done = 0
    let delayDays = 0
    let delayedStageName = ''
    for (const stage of stages) {
      const isDone = stage.status === 3 || Boolean(stage.actualEndDate)
      if (isDone) {
        done += 1
        continue
      }
      if (!stage.planEndDate) continue
      const end = dayjs(stage.planEndDate)
      if (!end.isValid() || !today.isAfter(end)) continue
      const days = today.diff(end, 'day')
      if (days > delayDays) {
        delayDays = days
        delayedStageName = stage.stageName
      }
    }
    return { done, total: stages.length, delayDays, delayedStageName }
  }, [stages])

  /** 任务完成度 */
  const taskStats = useMemo(() => {
    // 「已完成」同时认 PRD 标准值 completed 与迁移前旧值 done（isTaskDone）
    const done = tasks.filter((task) => isTaskDone(task.status)).length
    return { done, total: tasks.length, rate: tasks.length ? Math.round((done / tasks.length) * 100) : 0 }
  }, [tasks])

  /**
   * 阶段状态标签（后端 status：0取消 1未开始 2进行中 3已完成）
   * @param status 阶段状态值
   * @returns 标签节点
   */
  function stageStatusTag(status: number): JSX.Element {
    if (status === 3) return <Tag color="green">已完成</Tag>
    if (status === 2) return <Tag color="blue">进行中</Tag>
    if (status === 0) return <Tag>已取消</Tag>
    return <Tag>未开始</Tag>
  }

  /**
   * 生育期时间线颜色（已完成绿 / 进行中蓝 / 未开始灰）
   * @param stage 阶段
   * @returns antd Timeline.Item color
   */
  function stageColor(stage: PlanStage): string {
    if (stage.status === 3) return 'green'
    if (stage.status === 2 || stage.actualStartDate) return 'blue'
    return 'gray'
  }

  /** 关联任务表格列 */
  const taskColumns = [
    {
      title: '任务名称',
      dataIndex: 'taskName',
      render: (value: string, row: Task) => (
        <Typography.Link onClick={() => navigate(`/production/tasks/${row.taskId}`)}>
          {value}
        </Typography.Link>
      ),
    },
    {
      title: '类型',
      dataIndex: 'taskType',
      width: 130,
      render: (value: string) => <Tag>{taskTypeLabel(value)}</Tag>,
    },
    {
      title: '地块',
      dataIndex: 'plotName',
      width: 120,
      render: (value: string) => value || '-',
    },
    {
      title: '计划周期',
      key: 'range',
      width: 200,
      render: (_value: unknown, row: Task) =>
        `${row.planStartDate || '-'} ~ ${row.planEndDate || '-'}`,
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 100,
      render: (value: number) => {
        const meta = priorityMeta(value)
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (value: string) => {
        const meta = taskStatusMeta(value)
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: '执行人',
      dataIndex: 'assigneeName',
      width: 110,
      render: (value: string) => value || '未指派',
    },
  ]

  // 新建别名：等待重定向生效，避免闪现详情 404 空态
  if (isCreateAlias) {
    return (
      <Card>
        <Skeleton active paragraph={{ rows: 8 }} />
      </Card>
    )
  }

  if (planQuery.isLoading) {
    return (
      <Card>
        <Skeleton active paragraph={{ rows: 8 }} />
      </Card>
    )
  }

  if (planQuery.isError || !plan) {
    return (
      <Card>
        <Result
          status="404"
          title="未找到该种养计划"
          subTitle="计划可能已被删除，或当前账号无访问权限。"
          extra={
            <Button type="primary" onClick={() => navigate('/production/plans')}>
              返回计划列表
            </Button>
          }
        />
      </Card>
    )
  }

  const statusMeta = planStatusMeta(plan.status)

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card
        title={
          <Space wrap>
            <CalendarOutlined style={{ color: '#13a05a' }} />
            <span>{plan.planName}</span>
            <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              编号：{plan.planNo}
            </Typography.Text>
          </Space>
        }
        extra={
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/production/plans')}>
              返回列表
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => void refreshAll()}>
              刷新
            </Button>
            {plan.status === 1 ? (
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                loading={startMutation.isPending}
                onClick={() => startMutation.mutate()}
              >
                启动计划
              </Button>
            ) : null}
            {plan.status === 2 ? (
              <Button
                danger
                icon={<StopOutlined />}
                loading={terminateMutation.isPending}
                onClick={() => terminateMutation.mutate()}
              >
                终止计划
              </Button>
            ) : null}
          </Space>
        }
      >
        <Row gutter={16}>
          <Col xs={12} md={8}>
            <Statistic title="时间进度" value={progress} suffix="%" valueStyle={{ color: '#13a05a' }} />
          </Col>
          <Col xs={12} md={8}>
            <Statistic
              title="阶段完成"
              value={stageStats.done}
              suffix={`/ ${stages.length}`}
            />
          </Col>
          <Col xs={12} md={8}>
            <Tooltip
              title={
                stageStats.delayDays > 0 && stageStats.delayedStageName
                  ? `最大延误来自未完成阶段「${stageStats.delayedStageName}」`
                  : '全部阶段均在计划结束日期前'
              }
            >
              <Statistic
                title="延误天数（PLAN-05）"
                value={stageStats.delayDays}
                suffix="天"
                valueStyle={{
                  color: stageStats.delayDays > 0 ? '#cf1322' : '#52c41a',
                }}
              />
            </Tooltip>
          </Col>
          <Col xs={12} md={8}>
            <Statistic title="任务完成率" value={taskStats.rate} suffix="%" valueStyle={{ color: '#1677ff' }} />
          </Col>
          <Col xs={12} md={8}>
            <Statistic
              title="预计产量"
              value={plan.expectedYield}
              suffix="kg"
              formatter={(value) => formatNumber(Number(value))}
            />
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title="基本信息">
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="计划编号">{plan.planNo}</Descriptions.Item>
              <Descriptions.Item label="计划名称">{plan.planName}</Descriptions.Item>
              <Descriptions.Item label="所属农场">{plan.farmName || '-'}</Descriptions.Item>
              <Descriptions.Item label="关联地块">{plan.plotName || plan.plotId || '-'}</Descriptions.Item>
              <Descriptions.Item label="作物">{plan.cropName || '-'}</Descriptions.Item>
              <Descriptions.Item label="品种">{plan.cropVariety || '-'}</Descriptions.Item>
              <Descriptions.Item label="计划周期">
                {plan.startDate ? `${plan.startDate} ~ ${plan.endDate}` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="计划状态">
                <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="负责人">{plan.managerName || plan.managerId || '-'}</Descriptions.Item>
              <Descriptions.Item label="预计产量">
                {formatNumber(plan.expectedYield)} kg
              </Descriptions.Item>
              <Descriptions.Item label="计划面积">
                {/* 面积保留最多 2 位小数：用 formatNumber（固定 0 位）会把 88.5 显示成 89 */}
                {plan.planArea > 0 ? `${formatAreaNumber(plan.planArea)} 亩` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">{plan.updatedAt || '-'}</Descriptions.Item>
              <Descriptions.Item label="备注" span={2}>
                {plan.remark || '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title="进度追踪">
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <div>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Typography.Text>计划时间进度</Typography.Text>
                  <Typography.Text strong>{progress}%</Typography.Text>
                </Space>
                <Progress percent={progress} strokeColor="#13a05a" />
              </div>
              <div>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Typography.Text>生育期阶段完成度</Typography.Text>
                  <Typography.Text strong>
                    {stageStats.done}/{stages.length}
                  </Typography.Text>
                </Space>
                <Progress
                  percent={stages.length ? Math.round((stageStats.done / stages.length) * 100) : 0}
                  strokeColor="#1677ff"
                />
              </div>
              <div>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Typography.Text>关联任务完成率</Typography.Text>
                  <Typography.Text strong>
                    {taskStats.done}/{taskStats.total}
                  </Typography.Text>
                </Space>
                <Progress percent={taskStats.rate} strokeColor="#fa8c16" />
              </div>
              <Steps
                size="small"
                direction="horizontal"
                current={plan.status === 3 ? 3 : plan.status === 2 ? 2 : plan.status === 4 ? 3 : 0}
                status={plan.status === 4 ? 'error' : 'process'}
                items={[
                  { title: '编制中' },
                  { title: '进行中' },
                  { title: '已完结' },
                ]}
              />
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            title="生育期安排"
            extra={
              <Space>
                <Button
                  type="primary"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setEditingStage(null)
                    setStageFormOpen(true)
                  }}
                >
                  新增阶段
                </Button>
                <Button
                  type="link"
                  onClick={() => navigate('/production/plans/calendar')}
                >
                  查看农事日历 →
                </Button>
              </Space>
            }
          >
            {stagesQuery.isLoading ? (
              <Skeleton active paragraph={{ rows: 6 }} />
            ) : stages.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该计划暂无生育期阶段" />
            ) : (
              <Timeline
                items={stages.map((stage) => ({
                  color: stageColor(stage),
                  children: (
                    <Space direction="vertical" size={2}>
                      <Space wrap>
                        <Typography.Text strong>
                          {stage.stageNo ? `第 ${stage.stageNo} 阶段 · ` : ''}
                          {stage.stageName}
                        </Typography.Text>
                        {stageStatusTag(stage.status)}
                      </Space>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        计划：{stage.planStartDate || '-'} ~ {stage.planEndDate || '-'}
                      </Typography.Text>
                      {stage.actualStartDate ? (
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          实际：{stage.actualStartDate || '-'} ~ {stage.actualEndDate || '进行中'}
                        </Typography.Text>
                      ) : null}
                      {stage.description ? (
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {stage.description}
                        </Typography.Text>
                      ) : null}
                    </Space>
                  ),
                }))}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title="阶段清单"
            extra={<Typography.Text type="secondary">共 {stages.length} 个阶段</Typography.Text>}
          >
            {stages.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无阶段数据" />
            ) : (
              <List
                size="small"
                dataSource={stages}
                rowKey="stageId"
                pagination={stages.length > 6 ? { pageSize: 6, size: 'small' } : false}
                renderItem={(stage) => (
                  <List.Item
                    actions={[
                      <Button
                        key="edit"
                        type="link"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => {
                          setEditingStage(stage)
                          setStageFormOpen(true)
                        }}
                      >
                        编辑
                      </Button>,
                      <Popconfirm
                        key="remove"
                        title="删除阶段"
                        description={`确认删除阶段「${stage.stageName}」？`}
                        okButtonProps={{ danger: true }}
                        onConfirm={() => removeStageMutation.mutate(stage.stageId)}
                      >
                        <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                          删除
                        </Button>
                      </Popconfirm>,
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space wrap>
                          <Tag color="green">{stage.stageNo || '-'}</Tag>
                          <span>{stage.stageName}</span>
                          {stageStatusTag(stage.status)}
                          {stage.taskCount ? (
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                              {stage.taskCount} 个任务
                            </Typography.Text>
                          ) : null}
                        </Space>
                      }
                      description={`${stage.planStartDate || '-'} ~ ${stage.planEndDate || '-'}`}
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Card
        title="关联农事任务"
        extra={
          <Button type="link" onClick={() => navigate('/production/tasks')}>
            前往任务列表 →
          </Button>
        }
      >
        {tasksQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 5 }} />
        ) : tasks.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该计划暂未生成农事任务" />
        ) : (
          <Table<Task>
            rowKey="taskId"
            size="small"
            dataSource={tasks}
            columns={taskColumns}
            pagination={tasks.length > 8 ? { pageSize: 8, size: 'small' } : false}
            scroll={{ x: 900 }}
          />
        )}
      </Card>

      <ModalForm<PlanStagePayload>
        key={`plan-stage-${editingStage?.stageId ?? 'new'}`}
        title={
          <Space>
            <CalendarOutlined style={{ color: '#1677ff' }} />
            <span>{editingStage ? '编辑生育期阶段' : '新增生育期阶段'}</span>
          </Space>
        }
        open={stageFormOpen}
        width={520}
        modalProps={{
          destroyOnHidden: true,
          confirmLoading:
            createStageMutation.isPending || updateStageMutation.isPending,
        }}
        initialValues={
          editingStage
            ? {
                stageName: editingStage.stageName,
                stageSeq: editingStage.stageNo,
                planStartDate: editingStage.planStartDate,
                planEndDate: editingStage.planEndDate,
                taskType: editingStage.taskType || undefined,
                description: editingStage.description || undefined,
                status: editingStage.status,
              }
            : {
                stageSeq: stages.length + 1,
                planStartDate: plan?.startDate || undefined,
                planEndDate: plan?.endDate || undefined,
                status: 1,
              }
        }
        onOpenChange={(visible) => {
          setStageFormOpen(visible)
          if (!visible) setEditingStage(null)
        }}
        onFinish={async (value) => {
          if (editingStage) {
            await updateStageMutation.mutateAsync({
              stageId: editingStage.stageId,
              payload: value,
            })
          } else {
            await createStageMutation.mutateAsync(value)
          }
          return true
        }}
      >
        <ProFormText
          name="stageName"
          label="阶段名称"
          placeholder="如：育秧期 / 分蘖期 / 抽穗期"
          rules={[
            { required: true, message: '请输入阶段名称' },
            { max: 50, message: '阶段名称不超过 50 个字符' },
          ]}
        />
        <ProFormDigit
          name="stageSeq"
          label="阶段序号"
          min={1}
          fieldProps={{ precision: 0 }}
          rules={[{ required: true, message: '请输入阶段序号' }]}
        />
        <ProFormDatePicker
          name="planStartDate"
          label="计划开始日期"
          rules={[{ required: true, message: '请选择计划开始日期' }]}
        />
        <ProFormDatePicker
          name="planEndDate"
          label="计划结束日期"
          rules={[{ required: true, message: '请选择计划结束日期' }]}
        />
        <ProFormSelect
          name="taskType"
          label="默认任务类型"
          options={taskTypeOptions}
          placeholder="可选，用于任务链自动生成（PLAN-03）时继承"
        />
        <ProFormSelect
          name="status"
          label="阶段状态"
          options={[
            { value: 1, label: '未开始' },
            { value: 2, label: '进行中' },
            { value: 3, label: '已完成' },
            { value: 0, label: '已取消' },
          ]}
        />
        <ProFormTextArea
          name="description"
          label="阶段说明"
          placeholder="补充说明，500 字以内"
          fieldProps={{ rows: 3, maxLength: 500 }}
        />
      </ModalForm>
    </Space>
  )
}
