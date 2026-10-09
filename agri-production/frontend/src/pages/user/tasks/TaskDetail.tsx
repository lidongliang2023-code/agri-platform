/**
 * 页面名称：任务详情
 * 路由路径：/production/tasks/:taskId
 * 所属模块：农事任务管理
 * PRD 序号：PRD 6.1 #15
 * 原型来源：用户端原型 P9 task-detail
 *
 * 还原要点：
 * - 头部「< 返回 任务名」+ 开始执行 / 编辑 / 转派 按钮
 * - 卡片「📋 任务信息」：任务编号 / 状态 / 优先级 / 类型 / 农场 / 地块 / 执行人 /
 *   计划时间 / 任务描述
 * - 卡片「📋 执行记录」：时间轴（打卡时间 / 类型 / 照片 / GPS），空态提示
 * - 关联地块与投入品卡片
 * - 底部操作：开始执行 / 提交成果 / 验收通过 / 驳回 / 转派 / 编辑 / 删除
 */
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  PageContainer,
  ModalForm,
  ProFormDigit,
  ProFormRadio,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components'
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Empty,
  Image,
  Popconfirm,
  Row,
  Skeleton,
  Space,
  Tag,
  Timeline,
  Typography,
  message,
} from 'antd'
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  createTaskRecord,
  deleteTask,
  dispatchTask,
  executeTask,
  fetchTaskRecords,
  getTask,
  reviewTask,
  submitTaskResult,
  updateTask,
} from '@/api/tasks'
import { getPlot } from '@/api/plots'
import { listMembers } from '@/api/members'
import type { Member, Task, TaskRecord } from '@/types'
import {
  ACCEPT_STATUS_META,
  TASK_PRIORITY_COLOR_MAP,
  TASK_PRIORITY_LABEL_MAP,
  TASK_RECORD_TYPE_OPTIONS,
  TASK_STATUS_COLOR_MAP,
  TASK_STATUS_LABEL_MAP,
  TASK_TYPE_LABEL_MAP,
} from '@/types'

/** 执行记录类型文本 */
const RECORD_TYPE_TEXT: Record<number, string> = {
  1: '开始执行',
  2: '过程记录',
  3: '完成打卡',
}

/** 执行记录时间轴颜色 */
const RECORD_TYPE_COLOR: Record<number, string> = {
  1: 'blue',
  2: 'gray',
  3: 'green',
}

/** 解析照片字段（后端为 JSON 数组字符串或逗号分隔） */
function parsePhotoList(record: TaskRecord): string[] {
  if (record.photoList && record.photoList.length > 0) return record.photoList
  if (!record.photos) return []
  try {
    const parsed: unknown = JSON.parse(record.photos)
    if (Array.isArray(parsed)) return parsed.map((item) => String(item))
  } catch {
    // 非 JSON 时按逗号分隔处理
  }
  return record.photos
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

/** 解析关联投入品使用记录 ID */
function parseUsageIds(raw?: string): string[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map((item) => String(item))
  } catch {
    // 非 JSON 时按逗号分隔处理
  }
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

/** 打卡表单值 */
interface CheckInFormValues {
  /** 记录类型 */
  executeType: 1 | 2 | 3
  /** 照片地址 */
  photoList?: string[]
  /** 纬度 */
  gpsLat?: number
  /** 经度 */
  gpsLng?: number
  /** 距地块中心距离（米） */
  gpsDistance?: number
  /** 异常说明 */
  abnormalDesc?: string
}

/** 验收表单值 */
interface ReviewFormValues {
  /** true 通过 / false 驳回 */
  pass: boolean
  /** 验收意见 / 驳回原因 */
  remark?: string
}

/**
 * 任务详情页
 *
 * 业务职责：展示任务档案与执行流水，支持开始执行、打卡、提交、验收、转派、编辑与删除。
 *
 * @returns 页面内容
 */
export default function TaskDetail(): JSX.Element {
  const { taskId = '' } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [assignOpen, setAssignOpen] = useState<boolean>(false)
  const [checkInOpen, setCheckInOpen] = useState<boolean>(false)
  const [editOpen, setEditOpen] = useState<boolean>(false)
  const [reviewOpen, setReviewOpen] = useState<boolean>(false)
  const [reviewPass, setReviewPass] = useState<boolean>(true)

  /** 任务详情 */
  const taskQuery = useQuery({
    queryKey: ['production-task', taskId],
    enabled: Boolean(taskId),
    queryFn: () => getTask(taskId),
  })

  const task = taskQuery.data

  /** 执行记录 */
  const recordQuery = useQuery({
    queryKey: ['production-task-records', taskId],
    enabled: Boolean(taskId),
    queryFn: () => fetchTaskRecords(taskId, 1, 50),
  })

  /** 关联地块 */
  const plotQuery = useQuery({
    queryKey: ['production-task-plot', task?.plotId],
    enabled: Boolean(task?.plotId),
    queryFn: () => getPlot(task?.plotId ?? ''),
  })

  /** 执行人下拉（转派 / 编辑使用，与列表页共用缓存键） */
  const memberQuery = useQuery({
    queryKey: ['member-options', task?.farmId],
    queryFn: () => listMembers({ farmId: task?.farmId, pageNum: 1, pageSize: 100 }),
  })

  const memberOptions = useMemo(
    () =>
      (memberQuery.data?.list ?? []).map((member: Member) => ({
        value: member.memberId,
        label: member.realName,
      })),
    [memberQuery.data],
  )

  /** 刷新任务与记录 */
  const refreshTask = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: ['production-task', taskId] })
      .then(() => queryClient.invalidateQueries({ queryKey: ['production-task-records', taskId] }))
      .then(() => queryClient.invalidateQueries({ queryKey: ['production-tasks'] }))
      .then(() => undefined)

  /** 开始执行 */
  const startMutation = useMutation({
    mutationFn: () => executeTask(taskId),
    onSuccess: () => {
      message.success('任务已开始执行')
      void refreshTask()
    },
  })

  /** 提交成果 */
  const submitMutation = useMutation({
    mutationFn: () => submitTaskResult(taskId),
    onSuccess: () => {
      message.success('成果已提交，等待验收')
      void refreshTask()
    },
  })

  /** 验收（通过 / 驳回） */
  const reviewMutation = useMutation({
    mutationFn: (values: ReviewFormValues) => reviewTask(taskId, values.pass, values.remark),
    onSuccess: (_data, variables) => {
      message.success(variables.pass ? '验收已通过' : '已驳回，等待重新执行')
      setReviewOpen(false)
      void refreshTask()
    },
  })

  /** 转派 */
  const dispatchMutation = useMutation({
    mutationFn: (assigneeId: string) => dispatchTask(taskId, assigneeId),
    onSuccess: () => {
      message.success('任务已转派')
      setAssignOpen(false)
      void refreshTask()
    },
  })

  /** 编辑任务 */
  const updateMutation = useMutation({
    mutationFn: (payload: Partial<Task>) => updateTask(taskId, payload),
    onSuccess: () => {
      message.success('任务已更新')
      setEditOpen(false)
      void refreshTask()
    },
  })

  /** 删除任务 */
  const deleteMutation = useMutation({
    mutationFn: () => deleteTask(taskId),
    onSuccess: () => {
      message.success('任务已删除')
      void queryClient.invalidateQueries({ queryKey: ['production-tasks'] })
      navigate('/production/tasks')
    },
  })

  /** 新增执行记录（打卡） */
  const checkInMutation = useMutation({
    mutationFn: (values: CheckInFormValues) =>
      createTaskRecord(taskId, {
        taskId,
        executeType: values.executeType,
        executeTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        photos: JSON.stringify(values.photoList ?? []),
        gpsLat: values.gpsLat,
        gpsLng: values.gpsLng,
        gpsDistance: values.gpsDistance,
        abnormalDesc: values.abnormalDesc,
      }),
    onSuccess: () => {
      message.success('执行记录已上报')
      setCheckInOpen(false)
      void refreshTask()
    },
  })

  /** 任务信息描述项 */
  const baseItems = useMemo(() => {
    if (!task) return []
    return [
      { key: 'taskNo', label: '任务编号', children: task.taskNo ?? '-' },
      {
        key: 'status',
        label: '状态',
        children: (
          <Tag color={TASK_STATUS_COLOR_MAP[task.status] ?? 'default'}>
            {TASK_STATUS_LABEL_MAP[task.status] ?? task.status}
          </Tag>
        ),
      },
      {
        key: 'priority',
        label: '优先级',
        children: (
          <Tag color={TASK_PRIORITY_COLOR_MAP[task.priority] ?? 'default'}>
            {TASK_PRIORITY_LABEL_MAP[task.priority] ?? '普通'}
          </Tag>
        ),
      },
      {
        key: 'taskType',
        label: '任务类型',
        children: <Tag color="geekblue">{TASK_TYPE_LABEL_MAP[task.taskType] ?? task.taskType}</Tag>,
      },
      { key: 'farm', label: '所属农场', children: task.farmName ?? '-' },
      {
        key: 'plot',
        label: '地块',
        children: task.plotName ?? task.plotId ?? '-',
      },
      { key: 'assignee', label: '执行人', children: task.assigneeName ?? '未派发' },
      { key: 'assigner', label: '派发人', children: task.assignerName ?? '-' },
      {
        key: 'plan',
        label: '计划时间',
        span: 2,
        children: `${task.planStartDate ?? '-'} ~ ${task.planEndDate ?? '-'}`,
      },
      {
        key: 'actual',
        label: '实际执行',
        span: 2,
        children: `${task.actualStartDate ?? '-'} ~ ${task.actualEndDate ?? task.completedAt ?? '-'}`,
      },
      {
        key: 'accept',
        label: '验收状态',
        children: (
          <Space>
            <Tag color={ACCEPT_STATUS_META[task.acceptStatus]?.color ?? 'gold'}>
              {ACCEPT_STATUS_META[task.acceptStatus]?.label ?? '待验收'}
            </Tag>
            {task.rejectCount > 0 && <Tag color="volcano">驳回 {task.rejectCount} 次</Tag>}
          </Space>
        ),
      },
      { key: 'rejectCount', label: '驳回次数', children: `${task.rejectCount ?? 0} 次` },
      {
        key: 'description',
        label: '任务描述',
        span: 3,
        children: task.description ?? '暂无描述',
      },
    ]
  }, [task])

  /** 执行记录时间轴 */
  const timelineItems = useMemo(() => {
    const records = recordQuery.data?.list ?? []
    const items: { color: string; children: ReactNode }[] = []
    if (task?.createdAt) {
      items.push({
        color: 'gray',
        children: (
          <div>
            <Typography.Text strong>{task.createdAt}</Typography.Text>
            <div>
              <Typography.Text>任务已创建，待执行</Typography.Text>
            </div>
            <Typography.Text type="secondary">系统</Typography.Text>
          </div>
        ),
      })
    }
    records.forEach((record: TaskRecord) => {
      const photos = parsePhotoList(record)
      items.push({
        color: RECORD_TYPE_COLOR[record.executeType] ?? 'blue',
        children: (
          <div>
            <Space size={8} wrap>
              <Typography.Text strong>{record.executeTime ?? '-'}</Typography.Text>
              <Tag color={RECORD_TYPE_COLOR[record.executeType] === 'green' ? 'green' : 'blue'}>
                {RECORD_TYPE_TEXT[record.executeType] ?? '执行记录'}
              </Tag>
              {record.offlineFlag === 1 && <Tag color="orange">离线补传</Tag>}
            </Space>
            <div>
              <Typography.Text type="secondary">
                执行人：{record.executorName ?? record.executorId ?? '-'}
                {record.gpsLat && record.gpsLng
                  ? ` ｜ GPS：${record.gpsLat}, ${record.gpsLng}`
                  : ''}
                {record.gpsDistance ? ` ｜ 距地块中心 ${record.gpsDistance} 米` : ''}
              </Typography.Text>
            </div>
            {record.abnormalDesc && (
              <div>
                <Typography.Text type="warning">异常：{record.abnormalDesc}</Typography.Text>
              </div>
            )}
            {photos.length > 0 && (
              <Image.PreviewGroup>
                <Space size={8} wrap style={{ marginTop: 8 }}>
                  {photos.map((url) => (
                    <Image key={url} src={url} width={72} height={72} style={{ objectFit: 'cover' }} />
                  ))}
                </Space>
              </Image.PreviewGroup>
            )}
          </div>
        ),
      })
    })
    return items
  }, [recordQuery.data, task])

  /** 关联投入品 */
  const usageIds = useMemo(() => parseUsageIds(task?.relatedUsageIds), [task])

  if (taskQuery.isLoading) {
    return (
      <PageContainer title="任务详情">
        <Card>
          <Skeleton active paragraph={{ rows: 6 }} />
        </Card>
      </PageContainer>
    )
  }

  if (taskQuery.isError || !task) {
    return (
      <PageContainer title="任务详情">
        <Card>
          <Empty
            description={
              <Space direction="vertical">
                <Typography.Text type="danger">任务不存在或加载失败</Typography.Text>
                <Button onClick={() => navigate('/production/tasks')}>返回任务列表</Button>
              </Space>
            }
          />
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer
      title={`任务详情：${task.taskName}`}
      extra={[
        <Button
          key="back"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/production/tasks')}
        >
          返回
        </Button>,
        <Button
          key="start"
          type="primary"
          icon={<PlayCircleOutlined />}
          disabled={task.status === 'executing' || task.status === 'accepted'}
          loading={startMutation.isPending}
          onClick={() => startMutation.mutate()}
        >
          开始执行
        </Button>,
        <Button key="edit" onClick={() => setEditOpen(true)}>
          编辑
        </Button>,
        <Button key="assign" onClick={() => setAssignOpen(true)}>
          转派
        </Button>,
      ]}
    >
      <Card title="📋 任务信息" style={{ marginBottom: 16 }}>
        <Descriptions bordered column={3} size="small" items={baseItems} />
        {task.acceptStatus === 2 && task.acceptRemark && (
          <Alert
            style={{ marginTop: 12 }}
            type="error"
            showIcon
            message="验收驳回意见"
            description={task.acceptRemark}
          />
        )}
      </Card>

      <Row gutter={16}>
        <Col xs={24} lg={14}>
          <Card
            title="📋 执行记录"
            extra={
              <Button type="link" onClick={() => setCheckInOpen(true)}>
                + 添加执行记录
              </Button>
            }
          >
            {timelineItems.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <Typography.Text type="secondary">
                    📝 暂无执行记录，点击"开始执行"后记录
                  </Typography.Text>
                }
              />
            ) : (
              <Timeline items={timelineItems} />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title="🌾 关联地块" style={{ marginBottom: 16 }}>
            {plotQuery.data ? (
              <Descriptions column={1} size="small">
                <Descriptions.Item label="地块名称">
                  {plotQuery.data.plotName}
                </Descriptions.Item>
                <Descriptions.Item label="地块编码">
                  {plotQuery.data.plotCode}
                </Descriptions.Item>
                <Descriptions.Item label="面积（亩）">
                  {plotQuery.data.area}
                </Descriptions.Item>
                <Descriptions.Item label="当前作物">
                  {plotQuery.data.cropVariety ?? '-'}
                </Descriptions.Item>
                <Descriptions.Item label="灌溉方式">
                  {plotQuery.data.irrigationType ?? '-'}
                </Descriptions.Item>
              </Descriptions>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<Typography.Text type="secondary">未关联地块</Typography.Text>}
              />
            )}
          </Card>

          <Card title="💊 关联投入品">
            {usageIds.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<Typography.Text type="secondary">暂无关联投入品记录</Typography.Text>}
              />
            ) : (
              <Space size={[8, 8]} wrap>
                {usageIds.map((usageId) => (
                  <Tag key={usageId} color="green">
                    投入品记录 {usageId}
                  </Tag>
                ))}
              </Space>
            )}
          </Card>
        </Col>
      </Row>

      <Divider />

      <Card title="⚙️ 任务操作">
        <Space wrap>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            disabled={task.status === 'executing' || task.status === 'accepted'}
            loading={startMutation.isPending}
            onClick={() => startMutation.mutate()}
          >
            开始执行
          </Button>
          <Button
            disabled={task.status !== 'executing'}
            loading={submitMutation.isPending}
            onClick={() => submitMutation.mutate()}
          >
            提交成果
          </Button>
          <Button onClick={() => navigate(`/production/tasks/${taskId}/acceptance`)}>
            前往验收
          </Button>
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            disabled={task.status !== 'submitted'}
            onClick={() => {
              setReviewPass(true)
              setReviewOpen(true)
            }}
          >
            验收通过
          </Button>
          <Button
            danger
            icon={<CloseCircleOutlined />}
            disabled={task.status !== 'submitted'}
            onClick={() => {
              setReviewPass(false)
              setReviewOpen(true)
            }}
          >
            驳回
          </Button>
          <Button onClick={() => setAssignOpen(true)}>转派</Button>
          <Button onClick={() => setEditOpen(true)}>编辑</Button>
          <Popconfirm
            title="确认删除该任务？"
            description="删除后不可恢复，请谨慎操作。"
            okText="确认删除"
            cancelText="取消"
            onConfirm={() => deleteMutation.mutate()}
          >
            <Button danger loading={deleteMutation.isPending}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      </Card>

      {/* 转派弹窗 */}
      <ModalForm<{ assigneeId: string }>
        title="转派任务"
        open={assignOpen}
        onOpenChange={setAssignOpen}
        width={480}
        modalProps={{ destroyOnClose: true }}
        onFinish={async (values) => {
          dispatchMutation.mutate(values.assigneeId)
          return true
        }}
      >
        <ProFormSelect
          name="assigneeId"
          label="执行人"
          placeholder="请选择执行人"
          options={memberOptions}
          rules={[{ required: true, message: '请选择执行人' }]}
        />
      </ModalForm>

      {/* 执行记录打卡弹窗 */}
      <ModalForm<CheckInFormValues>
        title="添加执行记录"
        open={checkInOpen}
        onOpenChange={setCheckInOpen}
        width={520}
        modalProps={{ destroyOnClose: true }}
        initialValues={{ executeType: 2 }}
        onFinish={async (values) => {
          checkInMutation.mutate(values)
          return true
        }}
      >
        <ProFormRadio.Group
          name="executeType"
          label="记录类型"
          options={TASK_RECORD_TYPE_OPTIONS}
          rules={[{ required: true, message: '请选择记录类型' }]}
        />
        <ProFormSelect
          name="photoList"
          label="现场照片地址"
          mode="tags"
          placeholder="输入图片地址后回车，可添加多张"
          tooltip="移动端为拍照上传（单任务上限 20 张）"
        />
        <ProFormDigit name="gpsLat" label="打卡纬度" fieldProps={{ precision: 6 }} />
        <ProFormDigit name="gpsLng" label="打卡经度" fieldProps={{ precision: 6 }} />
        <ProFormDigit
          name="gpsDistance"
          label="距地块中心（米）"
          fieldProps={{ precision: 2 }}
        />
        <ProFormTextArea name="abnormalDesc" label="异常说明" placeholder="选填" />
      </ModalForm>

      {/* 编辑任务弹窗 */}
      <ModalForm<Partial<Task>>
        title="编辑任务"
        open={editOpen}
        onOpenChange={setEditOpen}
        width={560}
        modalProps={{ destroyOnClose: true }}
        initialValues={{
          taskName: task.taskName,
          taskType: task.taskType,
          priority: task.priority ?? 3,
          assigneeId: task.assigneeId,
          planStartDate: task.planStartDate,
          planEndDate: task.planEndDate,
          description: task.description,
        }}
        onFinish={async (values) => {
          updateMutation.mutate(values)
          return true
        }}
      >
        <ProFormText
          name="taskName"
          label="任务名称"
          rules={[{ required: true, message: '请输入任务名称' }]}
        />
        <ProFormSelect name="assigneeId" label="执行人" options={memberOptions} />
        <ProFormText name="planStartDate" label="计划开始（YYYY-MM-DD）" />
        <ProFormText name="planEndDate" label="计划结束（YYYY-MM-DD）" />
        <ProFormTextArea name="description" label="任务描述" />
      </ModalForm>

      {/* 验收弹窗 */}
      <ModalForm<ReviewFormValues>
        title={reviewPass ? '验收通过' : '驳回任务'}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        width={520}
        modalProps={{ destroyOnClose: true }}
        initialValues={{ pass: reviewPass }}
        onFinish={async (values) => {
          if (!values.pass && !values.remark) {
            message.warning('驳回时必须填写原因')
            return false
          }
          reviewMutation.mutate(values)
          return true
        }}
      >
        <ProFormRadio.Group
          name="pass"
          label="验收结论"
          rules={[{ required: true, message: '请选择验收结论' }]}
          options={[
            { value: true, label: '验收通过' },
            { value: false, label: '驳回重做' },
          ]}
        />
        <ProFormTextArea
          name="remark"
          label="验收意见 / 驳回原因"
          placeholder={reviewPass ? '选填，可填写验收评价' : '必填，请说明驳回原因与整改要求'}
          fieldProps={{ rows: 3, maxLength: 300, showCount: true }}
        />
      </ModalForm>
    </PageContainer>
  )
}
