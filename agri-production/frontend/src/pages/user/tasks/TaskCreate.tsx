/**
 * 页面名称：创建任务（分步表单）
 * 路由路径：/production/tasks/create
 * 所属模块：智能种养
 * PRD 序号：PRD 6.1 #16
 * 原型来源：用户端原型 P8 task-create（三步向导）
 *
 * 还原要点：
 * - 步骤条：1 基本信息 → 2 执行设置 → 3 确认提交
 * - 步骤一：任务名称 / 任务类型（施肥·灌溉·病虫害防治·采收·整枝·其他…）/ 优先级（紧急·重要·普通）
 *          / 所属农场 / 执行地块
 * - 步骤二：计划开始（datetime）/ 计划结束（datetime）/ 执行人 / 关联模板
 * - 步骤三：任务描述 + 信息确认，提交后跳转任务详情
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { PageContainer, ProForm, ProFormDateTimePicker, ProFormRadio, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components'
import { Button, Card, Descriptions, Space, Steps, Tag, Typography, message } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import useFarmStore from '@/store/farm'
import { createTask, fetchTaskTemplatesPage } from '@/api/tasks'
import { listMembers } from '@/api/members'
import { listPlots } from '@/api/plots'
import type { Member, Plot, Task, TaskPriority, TaskTemplate } from '@/types'
import { TASK_PRIORITY_LABEL_MAP, TASK_TYPE_LABEL_MAP, TASK_TYPE_OPTIONS } from '@/types'

/** 新建任务表单值 */
interface TaskFormValues {
  /** 任务名称 */
  taskName?: string
  /** 任务类型 */
  taskType?: string
  /** 优先级：4 紧急 / 3 重要 / 2 普通 / 1 低 */
  priority?: TaskPriority
  /** 所属农场 */
  farmId?: string
  /** 执行地块 */
  plotId?: string
  /** 计划开始时间 */
  planStartDate?: Dayjs
  /** 计划结束时间 */
  planEndDate?: Dayjs
  /** 执行人 */
  assigneeId?: string
  /** 关联模板 */
  templateId?: string
  /** 任务描述 */
  description?: string
}

/** 优先级选项（原型：⚡紧急 / 🔶重要 / 普通） */
const PRIORITY_RADIO_OPTIONS = [
  { value: 4, label: '⚡ 紧急' },
  { value: 3, label: '🔶 重要' },
  { value: 2, label: '普通' },
  { value: 1, label: '低' },
]

/** 各步骤需要校验的字段名 */
const STEP_FIELDS: string[][] = [
  ['taskName', 'taskType', 'priority', 'farmId', 'plotId'],
  ['planStartDate', 'planEndDate', 'assigneeId'],
  ['description'],
]

/**
 * 新建任务页
 *
 * 业务职责：三步向导创建农事任务，逐步校验后调用新增接口并跳转详情。
 *
 * @returns 页面内容
 */
export default function TaskCreate(): JSX.Element {
  const navigate = useNavigate()
  const currentFarm = useFarmStore((state) => state.currentFarm)
  const [currentStep, setCurrentStep] = useState<number>(0)
  const [form] = ProForm.useForm<TaskFormValues>()

  const farmId = currentFarm?.farmId

  /** 地块下拉（跟随农场变化） */
  const plotQuery = useQuery({
    queryKey: ['plot-options', farmId],
    enabled: Boolean(farmId),
    queryFn: () => listPlots({ farmId, pageNum: 1, pageSize: 100 }),
  })

  /** 执行人下拉（原型：张三 / 李四 / 王五） */
  const memberQuery = useQuery({
    queryKey: ['member-options', farmId],
    enabled: Boolean(farmId),
    queryFn: () => listMembers({ farmId, pageNum: 1, pageSize: 100 }),
  })

  /** 任务模板下拉 */
  const templateQuery = useQuery({
    queryKey: ['task-template-options'],
    queryFn: () => fetchTaskTemplatesPage({ pageNum: 1, pageSize: 100 }),
  })

  const plotOptions = useMemo(
    () =>
      (plotQuery.data?.list ?? []).map((plot: Plot) => ({
        value: plot.plotId,
        label: `${plot.plotName}${plot.cropVariety ? `(${plot.cropVariety})` : ''}`,
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

  const templateOptions = useMemo(
    () =>
      (templateQuery.data?.list ?? []).map((template: TaskTemplate) => ({
        value: template.templateId,
        label: template.templateName,
      })),
    [templateQuery.data],
  )

  /** 新增任务 */
  const createMutation = useMutation({
    mutationFn: (payload: Partial<Task>) => createTask(payload),
    onSuccess: (result) => {
      // 后端 create 返回新任务 ID 字符串，兼容返回实体的情况
      const raw = result as unknown as Task | string | null
      const taskId = typeof raw === 'string' ? raw : raw?.taskId
      message.success('任务创建成功')
      if (taskId) {
        navigate(`/production/tasks/${taskId}`)
        return
      }
      navigate('/production/tasks')
    },
  })

  /** 下一步：仅校验当前步骤字段 */
  const handleNext = async (): Promise<void> => {
    try {
      await form.validateFields(STEP_FIELDS[currentStep])
      setCurrentStep((prev) => Math.min(prev + 1, STEP_FIELDS.length - 1))
    } catch {
      message.warning('请先完整填写本步骤的必填项')
    }
  }

  /** 上一步 */
  const handlePrev = (): void => {
    setCurrentStep((prev) => Math.max(prev - 1, 0))
  }

  /** 提交：交给 ProForm 的 onFinish 统一处理 */
  const handleSubmit = (): void => {
    form.submit()
  }

  /** 提交表单 */
  const handleFinish = async (values: TaskFormValues): Promise<void> => {
    const payload: Partial<Task> = {
      taskName: values.taskName,
      taskType: values.taskType,
      priority: values.priority ?? 3,
      plotId: values.plotId,
      assigneeId: values.assigneeId,
      templateId: values.templateId,
      description: values.description,
      farmId: values.farmId,
      status: 'pending',
      // 后端计划起止为 LocalDate，提交日期部分（原型为 datetime-local，界面保留时分选择）
      planStartDate: values.planStartDate ? dayjs(values.planStartDate).format('YYYY-MM-DD') : undefined,
      planEndDate: values.planEndDate ? dayjs(values.planEndDate).format('YYYY-MM-DD') : undefined,
    }
    createMutation.mutate(payload)
  }

  /** 第三步确认信息 */
  const renderConfirm = (): JSX.Element => {
    const values = form.getFieldsValue(true) as TaskFormValues
    const plotLabel = plotOptions.find((item) => item.value === values.plotId)?.label ?? '-'
    const memberLabel = memberOptions.find((item) => item.value === values.assigneeId)?.label ?? '-'
    const templateLabel =
      templateOptions.find((item) => item.value === values.templateId)?.label ?? '不关联模板'
    return (
      <Descriptions bordered column={2} size="small">
        <Descriptions.Item label="任务名称">{values.taskName ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="任务类型">
          <Tag color="geekblue">
            {TASK_TYPE_LABEL_MAP[values.taskType ?? ''] ?? values.taskType ?? '-'}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="优先级">
          {TASK_PRIORITY_LABEL_MAP[values.priority ?? 3] ?? '重要'}
        </Descriptions.Item>
        <Descriptions.Item label="执行地块">{plotLabel}</Descriptions.Item>
        <Descriptions.Item label="计划开始">
          {values.planStartDate ? dayjs(values.planStartDate).format('YYYY-MM-DD HH:mm') : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="计划结束">
          {values.planEndDate ? dayjs(values.planEndDate).format('YYYY-MM-DD HH:mm') : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="执行人">{memberLabel}</Descriptions.Item>
        <Descriptions.Item label="关联模板">{templateLabel}</Descriptions.Item>
      </Descriptions>
    )
  }

  return (
    <PageContainer
      title="新建农事任务"
      extra={[
        <Button
          key="back"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/production/tasks')}
        >
          返回任务列表
        </Button>,
      ]}
    >
      <Card style={{ marginBottom: 16 }}>
        <Steps
          current={currentStep}
          items={[
            { title: '基本信息' },
            { title: '执行设置' },
            { title: '确认提交' },
          ]}
        />
      </Card>

      <Card title={`第 ${currentStep + 1} 步 / 共 3 步`}>
        <ProForm<TaskFormValues>
          form={form}
          layout="vertical"
          submitter={false}
          onFinish={handleFinish}
          initialValues={{
            priority: 3,
            farmId,
            taskType: 'fertilizing',
          }}
        >
          {currentStep === 0 && (
            <>
              <ProFormText
                name="taskName"
                label="任务名称"
                placeholder="请输入任务名称"
                rules={[{ required: true, message: '请输入任务名称' }]}
              />
              <ProFormSelect
                name="taskType"
                label="任务类型"
                placeholder="请选择任务类型"
                options={TASK_TYPE_OPTIONS}
                rules={[{ required: true, message: '请选择任务类型' }]}
              />
              <ProFormRadio.Group
                name="priority"
                label="优先级"
                options={PRIORITY_RADIO_OPTIONS}
                rules={[{ required: true, message: '请选择优先级' }]}
              />
              <ProFormSelect
                name="farmId"
                label="所属农场"
                placeholder="请选择所属农场"
                options={
                  currentFarm
                    ? [{ value: currentFarm.farmId, label: currentFarm.farmName }]
                    : []
                }
                rules={[{ required: true, message: '请选择所属农场' }]}
                fieldProps={{
                  onChange: () => {
                    // 切换农场后清空地块，避免跨农场选择
                    form.setFieldValue('plotId', undefined)
                  },
                }}
              />
              <ProFormSelect
                name="plotId"
                label="执行地块"
                placeholder="请选择执行地块"
                options={plotOptions}
                rules={[{ required: true, message: '请选择执行地块' }]}
              />
            </>
          )}

          {currentStep === 1 && (
            <>
              <ProFormDateTimePicker
                name="planStartDate"
                label="计划开始"
                placeholder="请选择计划开始时间"
                rules={[{ required: true, message: '请选择计划开始时间' }]}
                fieldProps={{ style: { width: '100%' }, showTime: { format: 'HH:mm' } }}
              />
              <ProFormDateTimePicker
                name="planEndDate"
                label="计划结束"
                placeholder="请选择计划结束时间"
                rules={[
                  { required: true, message: '请选择计划结束时间' },
                  {
                    validator: (_rule, value) => {
                      const start = form.getFieldValue('planStartDate') as Dayjs | undefined
                      if (value && start && dayjs(value).isBefore(dayjs(start))) {
                        return Promise.reject(new Error('计划结束时间不能早于开始时间'))
                      }
                      return Promise.resolve()
                    },
                  },
                ]}
                fieldProps={{ style: { width: '100%' }, showTime: { format: 'HH:mm' } }}
              />
              <ProFormSelect
                name="assigneeId"
                label="执行人"
                placeholder="请选择执行人"
                options={memberOptions}
                rules={[{ required: true, message: '请选择执行人' }]}
              />
              <ProFormSelect
                name="templateId"
                label="关联任务模板（可选）"
                placeholder="可基于 SOP 模板填充作业内容"
                options={templateOptions}
                fieldProps={{
                  onChange: (value: string) => {
                    const template = (templateQuery.data?.list ?? []).find(
                      (item: TaskTemplate) => item.templateId === value,
                    )
                    if (template) {
                      form.setFieldValue('description', template.content ?? template.workContent)
                      if (!form.getFieldValue('taskType')) {
                        form.setFieldValue('taskType', template.taskType)
                      }
                    }
                  },
                }}
              />
            </>
          )}

          {currentStep === 2 && (
            <>
              <ProFormTextArea
                name="description"
                label="任务描述"
                placeholder="请描述作业要求、用量标准与注意事项"
                fieldProps={{ rows: 4, maxLength: 500, showCount: true }}
              />
              <Typography.Title level={5}>信息确认</Typography.Title>
              {renderConfirm()}
            </>
          )}
        </ProForm>

        <Space style={{ marginTop: 16 }}>
          {currentStep > 0 && <Button onClick={handlePrev}>上一步</Button>}
          {currentStep < STEP_FIELDS.length - 1 && (
            <Button type="primary" onClick={() => void handleNext()}>
              下一步
            </Button>
          )}
          {currentStep === STEP_FIELDS.length - 1 && (
            <Button
              type="primary"
              loading={createMutation.isPending}
              onClick={handleSubmit}
            >
              提交
            </Button>
          )}
          <Button onClick={() => navigate('/production/tasks')}>取消</Button>
        </Space>
      </Card>
    </PageContainer>
  )
}
