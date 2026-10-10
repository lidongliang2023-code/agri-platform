/**
 * 页面名称：任务验收
 * 路由路径：/production/tasks/:taskId/acceptance
 * 所属模块：农事任务管理
 * PRD 序号：PRD 6.1 #18（TASK-06 任务验收）
 *
 * 原型无此页，按 PRD 设计：
 * - 展示任务执行成果：照片墙、GPS 打卡定位、投入品用量、执行时间轴
 * - 验收结论：通过 / 驳回；驳回必须填写原因（后端累加 rejectCount）
 * - 已验收任务展示历史结论，并支持重新验收
 */
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageContainer, ProForm, ProFormRadio, ProFormTextArea } from '@ant-design/pro-components'
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Empty,
  Image,
  Row,
  Skeleton,
  Space,
  Statistic,
  Tag,
  Timeline,
  Typography,
  message,
} from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { fetchTaskRecords, getTask, reviewTask } from '@/api/tasks'
import type { TaskRecord } from '@/types'
import {
  ACCEPT_STATUS_META,
  TASK_PRIORITY_COLOR_MAP,
  TASK_PRIORITY_LABEL_MAP,
  TASK_STATUS_COLOR_MAP,
  TASK_STATUS_LABEL_MAP,
  TASK_TYPE_LABEL_MAP,
} from '@/types'
import { TASK_STATUS_DOING } from '@/types/task'

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

/** 验收表单值 */
interface AcceptanceFormValues {
  /** true 通过 / false 驳回 */
  pass: boolean
  /** 验收意见 */
  remark?: string
  /** 驳回原因（驳回时必填） */
  reason?: string
}

/**
 * 任务验收页
 *
 * 业务职责：核查任务执行成果（照片 / GPS / 用量）并提交验收结论。
 *
 * @returns 页面内容
 */
export default function TaskAcceptance(): JSX.Element {
  const { taskId = '' } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [pass, setPass] = useState<boolean>(true)

  /** 任务详情 */
  const taskQuery = useQuery({
    queryKey: ['production-task', taskId],
    enabled: Boolean(taskId),
    queryFn: () => getTask(taskId),
  })

  /** 执行记录 */
  const recordQuery = useQuery({
    queryKey: ['production-task-records', taskId],
    enabled: Boolean(taskId),
    queryFn: () => fetchTaskRecords(taskId, 1, 50),
  })

  const task = taskQuery.data
  const records = recordQuery.data?.list ?? []

  /** 汇总照片墙 */
  const allPhotos = useMemo(
    () => records.flatMap((record: TaskRecord) => parsePhotoList(record)),
    [records],
  )

  /** 最近一次打卡坐标 */
  const latestRecord = useMemo<TaskRecord | undefined>(
    () => [...records].sort((a, b) => String(b.executeTime).localeCompare(String(a.executeTime)))[0],
    [records],
  )

  /** 关联投入品 */
  const usageIds = useMemo(() => parseUsageIds(task?.relatedUsageIds), [task])

  /** 验收提交 */
  const reviewMutation = useMutation({
    mutationFn: (values: AcceptanceFormValues) =>
      reviewTask(taskId, values.pass, values.pass ? values.remark : values.reason),
    onSuccess: (_data, variables) => {
      message.success(variables.pass ? '验收通过，任务已归档' : '已驳回，任务退回执行')
      void queryClient.invalidateQueries({ queryKey: ['production-task', taskId] })
      void queryClient.invalidateQueries({ queryKey: ['production-tasks'] })
      navigate(`/production/tasks/${taskId}`)
    },
  })

  /** 任务信息描述项 */
  const baseItems = useMemo(() => {
    if (!task) return []
    return [
      { key: 'taskNo', label: '任务编号', children: task.taskNo ?? '-' },
      { key: 'taskName', label: '任务名称', children: task.taskName },
      {
        key: 'status',
        label: '任务状态',
        children: (
          <Tag color={TASK_STATUS_COLOR_MAP[task.status] ?? 'default'}>
            {TASK_STATUS_LABEL_MAP[task.status] ?? task.status}
          </Tag>
        ),
      },
      {
        key: 'taskType',
        label: '任务类型',
        children: <Tag color="geekblue">{TASK_TYPE_LABEL_MAP[task.taskType] ?? task.taskType}</Tag>,
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
      { key: 'plot', label: '地块', children: task.plotName ?? task.plotId ?? '-' },
      { key: 'assignee', label: '执行人', children: task.assigneeName ?? '未派发' },
      {
        key: 'plan',
        label: '计划时间',
        children: `${task.planStartDate ?? '-'} ~ ${task.planEndDate ?? '-'}`,
      },
      {
        key: 'completedAt',
        label: '完成时间',
        children: task.completedAt ?? task.actualEndDate ?? '-',
      },
      { key: 'rejectCount', label: '历史驳回次数', children: `${task.rejectCount ?? 0} 次` },
    ]
  }, [task])

  /** 执行时间轴 */
  const timelineItems = useMemo(
    () =>
      records.map((record: TaskRecord) => ({
        color: RECORD_TYPE_COLOR[record.executeType] ?? 'blue',
        children: (
          <div>
            <Space size={8} wrap>
              <Typography.Text strong>{record.executeTime ?? '-'}</Typography.Text>
              <Tag>{RECORD_TYPE_TEXT[record.executeType] ?? '执行记录'}</Tag>
              {record.offlineFlag === 1 && <Tag color="orange">离线补传</Tag>}
            </Space>
            <div>
              <Typography.Text type="secondary">
                {record.executorName ?? record.executorId ?? '-'}
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
          </div>
        ),
      })),
    [records],
  )

  if (taskQuery.isLoading) {
    return (
      <PageContainer title="任务验收">
        <Card>
          <Skeleton active paragraph={{ rows: 6 }} />
        </Card>
      </PageContainer>
    )
  }

  if (taskQuery.isError || !task) {
    return (
      <PageContainer title="任务验收">
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

  // 后端「执行中」真值是 doing（旧代码的 executing 后端不存在）；
  // submitted 后端暂未提供该状态，已列入后端补齐清单，此处保留判定
  const canReview = task.status === 'submitted' || task.status === TASK_STATUS_DOING

  return (
    <PageContainer
      title={`任务验收：${task.taskName}`}
      extra={[
        <Button
          key="back"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(`/production/tasks/${taskId}`)}
        >
          返回任务详情
        </Button>,
      ]}
    >
      <Card title="📋 任务信息" style={{ marginBottom: 16 }}>
        <Descriptions bordered column={3} size="small" items={baseItems} />
        {task.acceptStatus !== 0 && (
          <Alert
            style={{ marginTop: 12 }}
            type={task.acceptStatus === 1 ? 'success' : 'error'}
            showIcon
            message={`当前验收结论：${ACCEPT_STATUS_META[task.acceptStatus]?.label ?? '待验收'}`}
            description={task.acceptRemark ?? '无验收意见'}
          />
        )}
        {!canReview && (
          <Alert
            style={{ marginTop: 12 }}
            type="warning"
            showIcon
            message={`任务当前状态为「${TASK_STATUS_LABEL_MAP[task.status] ?? task.status}」，执行人提交成果后可进行验收`}
          />
        )}
      </Card>

      <Row gutter={16}>
        <Col xs={24} lg={14}>
          <Card title="📷 执行照片" style={{ marginBottom: 16 }}>
            {allPhotos.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<Typography.Text type="secondary">暂无现场照片</Typography.Text>}
              />
            ) : (
              <Image.PreviewGroup>
                <Space size={[8, 8]} wrap>
                  {allPhotos.map((url) => (
                    <Image
                      key={url}
                      src={url}
                      width={104}
                      height={104}
                      style={{ objectFit: 'cover', borderRadius: 4 }}
                    />
                  ))}
                </Space>
              </Image.PreviewGroup>
            )}
          </Card>

          <Card title="📍 GPS 打卡与作业量" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={8}>
                <Statistic title="打卡记录" value={records.length} suffix="条" />
              </Col>
              <Col span={8}>
                <Statistic
                  title="距地块中心"
                  value={latestRecord?.gpsDistance ?? 0}
                  precision={2}
                  suffix="米"
                />
              </Col>
              <Col span={8}>
                <Statistic title="关联投入品" value={usageIds.length} suffix="项" />
              </Col>
            </Row>
            <Divider />
            <Descriptions column={2} size="small">
              <Descriptions.Item label="最近打卡时间">
                {latestRecord?.executeTime ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="打卡坐标">
                {latestRecord?.gpsLat && latestRecord?.gpsLng
                  ? `${latestRecord.gpsLat}, ${latestRecord.gpsLng}`
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="是否离线补传">
                {latestRecord?.offlineFlag === 1 ? <Tag color="orange">是</Tag> : '否'}
              </Descriptions.Item>
              <Descriptions.Item label="异常说明">
                {latestRecord?.abnormalDesc ?? '无'}
              </Descriptions.Item>
            </Descriptions>
            <Divider />
            <Typography.Text strong>投入品用量记录</Typography.Text>
            <div style={{ marginTop: 8 }}>
              {usageIds.length === 0 ? (
                <Typography.Text type="secondary">本次任务未登记投入品</Typography.Text>
              ) : (
                <Space size={[8, 8]} wrap>
                  {usageIds.map((usageId) => (
                    <Tag key={usageId} color="green">
                      投入品记录 {usageId}
                    </Tag>
                  ))}
                </Space>
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title="🕒 执行时间轴" style={{ marginBottom: 16 }}>
            {timelineItems.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<Typography.Text type="secondary">暂无执行记录</Typography.Text>}
              />
            ) : (
              <Timeline items={timelineItems} />
            )}
          </Card>
        </Col>
      </Row>

      <Card title="✅ 验收结论">
        <ProForm<AcceptanceFormValues>
          layout="vertical"
          submitter={{
            searchConfig: { submitText: '提交验收结论', resetText: '重置' },
            submitButtonProps: { disabled: !canReview, loading: reviewMutation.isPending },
            render: (_props, dom) => (
              <Space>
                {dom}
                <Button onClick={() => navigate(`/production/tasks/${taskId}`)}>取消</Button>
              </Space>
            ),
          }}
          initialValues={{ pass: true }}
          onFinish={async (values) => {
            if (!values.pass && !values.reason) {
              message.warning('驳回时必须填写驳回原因')
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
              { value: false, label: '驳回重做（退回执行人）' },
            ]}
            fieldProps={{
              onChange: (event) => setPass(Boolean(event.target.value)),
            }}
          />
          {pass ? (
            <ProFormTextArea
              name="remark"
              label="验收意见"
              placeholder="选填，可填写完成质量评价"
              fieldProps={{ rows: 3, maxLength: 300, showCount: true }}
            />
          ) : (
            <ProFormTextArea
              name="reason"
              label="驳回原因"
              placeholder="必填，请说明驳回原因与整改要求"
              rules={[{ required: true, message: '驳回时必须填写原因' }]}
              fieldProps={{ rows: 3, maxLength: 300, showCount: true }}
            />
          )}
        </ProForm>
      </Card>
    </PageContainer>
  )
}
