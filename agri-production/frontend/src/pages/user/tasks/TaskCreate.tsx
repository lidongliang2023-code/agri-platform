import '@/components/ProductionDetailCompact.css'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ProForm, ProFormDateTimePicker, ProFormRadio, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components'
import PageContainer from '@/components/ProductionPageContainer'
import { Alert, Button, Space, message } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import Card from '@/components/SectionCard'
import DetailInfoGrid from '@/components/DetailInfoGrid'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import useFarmStore from '@/store/farm'
import { createTask, listAvailableTaskTemplates } from '@/api/tasks'
import { listMembers } from '@/api/members'
import { listPlans, listPlanStages } from '@/api/plans'
import { listPlots } from '@/api/plots'
import type { Member, Plan, PlanStage, Plot, Task, TaskPriority, TaskTemplate } from '@/types'
import { TASK_TYPE_OPTIONS } from '@/types'

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
  /** 所属农事计划 */
  planId?: string
  /** 所属计划阶段 */
  stageId?: string
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
  cropName?: string
  inputItems?: string[]
  qualityRequirement?: string
  remark?: string
}

/** 优先级选项（原型：⚡紧急 / 🔶重要 / 普通） */
const PRIORITY_RADIO_OPTIONS = [
  { value: 4, label: '⚡ 紧急' },
  { value: 3, label: '🔶 重要' },
  { value: 2, label: '普通' },
  { value: 1, label: '低' },
]

export default function TaskCreate(): JSX.Element {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const currentFarm = useFarmStore((state) => state.currentFarm)
  const [searchParams] = useSearchParams()
  /** 从地块详情进入时预选执行地块 */
  const presetPlotId = searchParams.get('plotId') ?? undefined
  /** 从计划 / 阶段进入时预选关联计划与阶段 */
  const presetPlanId = searchParams.get('planId') ?? undefined
  const presetStageId = searchParams.get('stageId') ?? undefined
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | undefined>()
  const [selectedPlanId, setSelectedPlanId] = useState<string | undefined>(presetPlanId)
  const [form] = ProForm.useForm<TaskFormValues>()

  const farmId = currentFarm?.farmId

  /** 地块下拉（跟随农场变化） */
  const plotQuery = useQuery({
    queryKey: ['plot-options', farmId],
    enabled: Boolean(farmId),
    queryFn: () => listPlots({ farmId, pageNum: 1, pageSize: 100 }),
  })

  /** 农事计划下拉（任务必须能回挂到计划） */
  const planQuery = useQuery({
    queryKey: ['task-plan-options', farmId],
    enabled: Boolean(farmId),
    queryFn: () => listPlans({ farmId, pageNum: 1, pageSize: 100 }),
  })

  /** 计划阶段下拉（选择计划后才可加载） */
  const stageQuery = useQuery({
    queryKey: ['task-stage-options', selectedPlanId],
    enabled: Boolean(selectedPlanId),
    queryFn: () => (selectedPlanId ? listPlanStages(selectedPlanId) : Promise.resolve([] as PlanStage[])),
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
    queryFn: listAvailableTaskTemplates,
    staleTime: 0,
    refetchOnMount: 'always',
  })

  const plotOptions = useMemo(
    () =>
      (plotQuery.data?.list ?? []).map((plot: Plot) => ({
        value: plot.plotId,
        label: `${plot.plotName}${plot.cropVariety ? `(${plot.cropVariety})` : ''}`,
      })),
    [plotQuery.data],
  )

  const planOptions = useMemo(
    () =>
      (planQuery.data?.list ?? []).map((plan: Plan) => ({
        value: plan.planId,
        label: `${plan.planName}${plan.cropName ? `（${plan.cropName}）` : ''}`,
      })),
    [planQuery.data],
  )

  const stageOptions = useMemo(
    () =>
      (stageQuery.data ?? []).map((stage: PlanStage) => ({
        value: stage.stageId,
        label: stage.stageName,
      })),
    [stageQuery.data],
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
      (templateQuery.data ?? []).map((template: TaskTemplate) => ({
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
      void queryClient.invalidateQueries({ queryKey: ['production-tasks'] })
      if (taskId) {
        navigate(`/production/tasks/${taskId}`)
        return
      }
      navigate('/production/tasks')
    },
    onError: (error: Error) => {
      message.error(error.message || '任务创建失败')
    },
  })

  /** 提交表单 */
  const handleFinish = async (values: TaskFormValues): Promise<void> => {
    const payload: Partial<Task> = {
      taskName: values.taskName,
      taskType: values.taskType,
      priority: values.priority ?? 3,
      plotId: values.plotId,
      planId: values.planId,
      stageId: values.stageId,
      assigneeId: values.assigneeId,
      templateId: values.templateId,
      description: values.description,
      cropName: values.cropName,
      inputMaterials: (values.inputItems ?? []).join(","),
      inputMaterialsJson: JSON.stringify(values.inputItems ?? []),
      qualityRequirement: values.qualityRequirement,
      remark: values.remark,
      farmId: values.farmId,
      // status 由后端统一置为 pending，前端不再传（传了也会被忽略，容易让人误以为可指定初始状态）
      planStartDate: values.planStartDate ? dayjs(values.planStartDate).format('YYYY-MM-DD HH:mm:ss') : undefined,
      planEndDate: values.planEndDate ? dayjs(values.planEndDate).format('YYYY-MM-DD HH:mm:ss') : undefined,
    }
    createMutation.mutate(payload)
  }

  return (
    <PageContainer mobileForm
      title="新建农事任务"
      className="production-detail-compact"
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
      <Card title="任务信息">
        <ProForm<TaskFormValues>
          scrollToFirstError
          form={form}
          layout="horizontal"
          grid
          colProps={{ xs: 24, md: 12 }}
          rowProps={{ gutter: 24 }}
          labelCol={{ flex: "112px" }}
          wrapperCol={{ flex: 1 }}
          submitter={false}
          onFinish={handleFinish}
          initialValues={{
            priority: 3,
            farmId,
            plotId: presetPlotId,
            planId: presetPlanId,
            stageId: presetStageId,
            taskType: 'fertilizing',
          }}
        >
          <ProFormSelect name="templateId" label="关联任务模板" placeholder="选择运营端发布的启用模板，自动带出作业属性"
            colProps={{ span: 24 }} options={templateOptions} fieldProps={{ allowClear: true, showSearch: true, optionFilterProp: 'label', loading: templateQuery.isFetching,
              onChange: (value?: string) => {
                const template = (templateQuery.data ?? []).find(t => String(t.templateId) === String(value))
                setSelectedTemplate(template)
                if (!template) return
                form.setFieldsValue({ taskName: template.templateName, taskType: template.taskType,
                  cropName: template.cropName, description: template.content || template.workContent || template.description,
                  inputItems: template.inputItems ?? [], remark: template.remark })
              } }} />
          {templateQuery.isError && <Alert type="error" message="任务模板加载失败，请刷新后重试" />}
          {selectedTemplate && <div style={{ width: '100%', padding: '0 12px 16px' }}>
            <DetailInfoGrid columns={3} items={[
              { label: '模板编码', value: selectedTemplate.templateCode || '-' },
              { label: '标准工时', value: selectedTemplate.standardHours != null ? `${selectedTemplate.standardHours} 小时` : '-' },
              { label: '生长阶段', value: selectedTemplate.growthStage || '-' },
              { label: '模板说明', value: selectedTemplate.description || '-' },
            ]} />
          </div>}
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
              <ProFormSelect
                name="planId"
                label="关联农事计划（可选）"
                placeholder="选择后任务将计入计划进度"
                options={planOptions}
                fieldProps={{
                  allowClear: true,
                  showSearch: true,
                  onChange: (value?: string) => {
                    setSelectedPlanId(value)
                    form.setFieldValue('stageId', undefined)
                    // 计划自带地块时自动带出执行地块（用户仍可改选）
                    if (value) {
                      const plan = (planQuery.data?.list ?? []).find(
                        (item: Plan) => item.planId === value,
                      )
                      if (plan?.plotId && !form.getFieldValue('plotId')) {
                        form.setFieldValue('plotId', plan.plotId)
                      }
                    }
                  },
                }}
              />
              <ProFormSelect
                name="stageId"
                label="关联计划阶段（可选）"
                placeholder="请先选择农事计划"
                options={stageOptions}
                disabled={!selectedPlanId}
                fieldProps={{ allowClear: true }}
              />

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
              <ProFormText name="cropName" label="适用作物" placeholder="选择模板自动带出，也可手工填写" />
              <ProFormSelect name="inputItems" label="所需投入品" mode="tags" placeholder="输入物料名称后回车，可多选" />
              <ProFormTextArea name="qualityRequirement" label="质量要求" colProps={{ span: 24 }} fieldProps={{ rows: 2, maxLength: 500 }} />
              <ProFormTextArea name="remark" label="备注" colProps={{ span: 24 }} fieldProps={{ rows: 2, maxLength: 500 }} />
              <ProFormTextArea
                colProps={{ span: 24 }}
                name="description"
                label="任务描述"
                placeholder="请描述作业要求、用量标准与注意事项"
                fieldProps={{ rows: 4, maxLength: 500, showCount: true }}
              />
        </ProForm>

        <Space className="production-form-actions" style={{ marginTop: 16 }}>
          <Button type="primary" loading={createMutation.isPending} onClick={() => form.submit()}>创建任务</Button>
          <Button onClick={() => navigate('/production/tasks')}>取消</Button>
        </Space>
      </Card>
    </PageContainer>
  )
}
