/**
 * 页面名称：种养计划列表
 * 路由路径：/production/plans
 * 所属模块：智能种养计划
 * PRD 序号：PRD 6.1 #11（对应 PRD 8.2 智能种养计划）
 *
 * 页面用途（PRD）：计划列表、状态跟踪、地块关联。
 * 表格使用 ProTable；支持按计划名称 / 状态 / 作物检索，
 * 新增（ModalForm）、编辑、启动 / 终止、删除，并可跳转到详情页与农事日历。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { App as AntdApp, Button, Popconfirm, Progress, Space, Tag, Typography } from 'antd'
import {
  ModalForm,
  ProFormDatePicker,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components'
import type { ActionType, ProColumns } from '@ant-design/pro-components'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CalendarOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  StopOutlined,
} from '@ant-design/icons'
import useFarmStore from '@/store/farm'
import { listPlots } from '@/api/plots'
import {
  createPlanInfo,
  fetchPlans,
  removePlan,
  startPlan,
  terminatePlan,
  updatePlanInfo,
} from '@/api/production-view'
import {
  PLAN_STATUS_OPTIONS,
  calcPlanProgress,
  formatNumber,
  planStatusMeta,
} from '@/utils/production-adapter'
import type { Plan } from '@/types'

/** 计划表单值 */
interface PlanFormValue {
  /** 计划名称 */
  planName: string
  /** 计划编码 */
  planCode?: string
  /** 地块 ID */
  plotId?: string
  /** 作物 */
  cropId?: string
  /** 品种 */
  cropVariety?: string
  /** 开始日期 */
  planStartDate: string
  /** 结束日期 */
  planEndDate: string
  /** 预期产量 */
  expectedYield?: number
  /** 负责人 */
  ownerId?: string
  /** 状态 */
  status?: number
  /** 备注 */
  remark?: string
}

/**
 * 种养计划列表
 * @returns 页面内容
 */
export default function PlanList(): JSX.Element {
  const navigate = useNavigate()
  const { message } = AntdApp.useApp()
  const queryClient = useQueryClient()
  const currentFarm = useFarmStore((state) => state.currentFarm)
  const farmId = currentFarm?.farmId
  const actionRef = useRef<ActionType>(null)
  const [createOpen, setCreateOpen] = useState<boolean>(false)
  const [editing, setEditing] = useState<Plan | null>(null)
  const [duplicating, setDuplicating] = useState<Plan | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  /** 已消费过 URL 上的自动新建标记（防止重复弹窗） */
  const autoCreateConsumed = useRef<boolean>(false)

  /** URL 携带的新建标记：/production/plans?create=1 */
  const autoCreate = searchParams.get('create') === '1'
  /** URL 携带的上下文，用于新建表单预填（如从农场详情 / 地块详情跳转而来） */
  const presetFarmId = searchParams.get('farmId') ?? undefined
  const presetPlotId = searchParams.get('plotId') ?? undefined
  const presetCropId = searchParams.get('cropId') ?? undefined
  const presetCropVariety = searchParams.get('cropVariety') ?? undefined
  /** 列表归属农场：URL 指定优先，否则取全局当前农场 */
  const effectiveFarmId = presetFarmId || farmId

  useEffect(() => {
    if (!autoCreate || autoCreateConsumed.current) return
    autoCreateConsumed.current = true
    setDuplicating(null)
    setCreateOpen(true)
    // 消费后移除标记，避免刷新 / 后退时重复弹出
    const next = new URLSearchParams(searchParams)
    next.delete('create')
    setSearchParams(next, { replace: true })
  }, [autoCreate, searchParams, setSearchParams])

  /**
   * 新建表单初始值：
   * 1) 复用历史计划 → 预填副本字段；
   * 2) 由 URL 上下文进入（如 /production/plans?create=1&plotId=xx）→ 预填地块 / 作物；
   * 3) 其余情况 → 空表单。
   * @returns 表单初始值
   */
  const createInitialValues = useMemo<Partial<PlanFormValue> | undefined>(() => {
    if (duplicating) {
      return {
        planName: `${duplicating.planName}（副本）`,
        plotId: duplicating.plotId,
        cropId: duplicating.cropId,
        cropVariety: duplicating.cropVariety,
        planStartDate: duplicating.startDate,
        planEndDate: duplicating.endDate,
        expectedYield: duplicating.expectedYield,
        status: 1,
      }
    }
    if (presetPlotId || presetCropId || presetCropVariety) {
      return {
        plotId: presetPlotId,
        cropId: presetCropId,
        cropVariety: presetCropVariety,
        status: 1,
      }
    }
    return undefined
  }, [duplicating, presetPlotId, presetCropId, presetCropVariety])

  /**
   * 重载列表
   * @returns void
   */
  async function reload(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: ['plan-list'] })
    actionRef.current?.reload()
  }

  /**
   * 「关联地块」下拉选项：本农场地块台账。
   *
   * <p>为什么不再让用户手填 ID：原先这里是自由文本框「关联地块 ID」——用户既不知道地块主键，
   * 填对了也只落 {@code plot_id}、不落 {@code plot_name}，列表「地块」列照样显示 "-"
   * （2026-10-16 实测），看着就像没关联上。现在直接列出台账里的地块，选谁就是谁。</p>

   *
   * <p>拉不到就返回空列表：宁可让用户看到"没有可选地块"，也不塞假选项。</p>
   *
   * @returns 下拉选项（value = 地块 ID，label = 地块名 + 面积）
   */
  async function loadPlotOptions(): Promise<{ label: string; value: string }[]> {
    try {
      const page = await listPlots({ farmId: effectiveFarmId, pageNum: 1, pageSize: 200 })
      return (page.list ?? [])
        .filter((plot) => Boolean(plot.plotId))
        .map((plot) => ({
          label: plot.area ? `${plot.plotName}（${plot.area} 亩）` : plot.plotName,
          value: plot.plotId,
        }))
    } catch {
      return []
    }
  }

  const createMutation = useMutation({
    mutationFn: (payload: PlanFormValue) =>
      createPlanInfo({
        planCode: payload.planCode,
        planName: payload.planName,
        farmId: effectiveFarmId,
        plotId: payload.plotId,
        cropId: payload.cropId,
        cropVariety: payload.cropVariety,
        planStartDate: payload.planStartDate,
        planEndDate: payload.planEndDate,
        expectedYield: payload.expectedYield,
        ownerId: payload.ownerId,
        status: payload.status ?? 1,
      }),
    onSuccess: () => {
      message.success('种养计划已创建')
      setCreateOpen(false)
      setDuplicating(null)
      void reload()
    },
    onError: (error: Error) => message.error(error.message || '创建失败'),
  })

  const updateMutation = useMutation({
    mutationFn: (payload: { planId: string; value: PlanFormValue }) =>
      updatePlanInfo(payload.planId, {
        planName: payload.value.planName,
        plotId: payload.value.plotId,
        cropId: payload.value.cropId,
        cropVariety: payload.value.cropVariety,
        planStartDate: payload.value.planStartDate,
        planEndDate: payload.value.planEndDate,
        expectedYield: payload.value.expectedYield,
        ownerId: payload.value.ownerId,
        status: payload.value.status,
      }),
    onSuccess: () => {
      message.success('种养计划已更新')
      setEditing(null)
      void reload()
    },
    onError: (error: Error) => message.error(error.message || '更新失败'),
  })

  const startMutation = useMutation({
    mutationFn: (planId: string) => startPlan(planId),
    onSuccess: () => {
      message.success('计划已启动')
      void reload()
    },
    onError: (error: Error) => message.error(error.message || '启动失败'),
  })

  const terminateMutation = useMutation({
    mutationFn: (planId: string) => terminatePlan(planId),
    onSuccess: () => {
      message.success('计划已终止')
      void reload()
    },
    onError: (error: Error) => message.error(error.message || '终止失败'),
  })

  const removeMutation = useMutation({
    mutationFn: (planId: string) => removePlan(planId),
    onSuccess: () => {
      message.success('计划已删除')
      void reload()
    },
    onError: (error: Error) => message.error(error.message || '删除失败'),
  })

  /** 状态 valueEnum */
  const statusEnum = useMemo(
    () =>
      PLAN_STATUS_OPTIONS.reduce<Record<string, { text: string; status: string }>>((acc, item) => {
        acc[String(item.value)] = {
          text: item.label,
          status:
            item.value === 2
              ? 'Processing'
              : item.value === 3
                ? 'Success'
                : item.value === 4
                  ? 'Error'
                  : 'Default',
        }
        return acc
      }, {}),
    [],
  )

  /** 表格列定义 */
  const columns = useMemo<ProColumns<Plan>[]>(
    () => [
      {
        title: '计划编号',
        dataIndex: 'planNo',
        width: 150,
        copyable: true,
        render: (_dom, entity) => entity.planNo || '-',
      },
      {
        title: '计划名称',
        dataIndex: 'planName',
        width: 180,
        render: (_dom, entity) => (
          <Typography.Link onClick={() => navigate(`/production/plans/${entity.planId}`)}>
            {entity.planName}
          </Typography.Link>
        ),
      },
      {
        title: '地块',
        dataIndex: 'plotName',
        width: 130,
        hideInSearch: true,
        render: (_dom, entity) => entity.plotName || '-',
      },
      {
        title: '作物',
        dataIndex: 'cropId',
        width: 120,
        render: (_dom, entity) => (
          <Space size={4}>
            <span>{entity.cropName || '-'}</span>
            {entity.cropVariety ? (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {entity.cropVariety}
              </Typography.Text>
            ) : null}
          </Space>
        ),
      },
      {
        title: '计划周期',
        dataIndex: 'planStartDate',
        width: 200,
        hideInSearch: true,
        render: (_dom, entity) =>
          entity.startDate && entity.endDate
            ? `${entity.startDate} ~ ${entity.endDate}`
            : '-',
      },
      {
        title: '预计产量(kg)',
        dataIndex: 'expectedYield',
        width: 130,
        hideInSearch: true,
        align: 'right',
        render: (_dom, entity) => formatNumber(entity.expectedYield),
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 110,
        valueType: 'select',
        valueEnum: statusEnum,
        render: (_dom, entity) => {
          const meta = planStatusMeta(entity.status)
          return <Tag color={meta.color}>{meta.label}</Tag>
        },
      },
      {
        title: '进度',
        key: 'progress',
        width: 160,
        hideInSearch: true,
        render: (_dom, entity) => {
          const percent = calcPlanProgress(entity)
          return (
            <Progress
              percent={percent}
              size="small"
              strokeColor={percent >= 100 ? '#52c41a' : '#13a05a'}
            />
          )
        },
      },
      {
        title: '负责人',
        dataIndex: 'managerName',
        width: 110,
        hideInSearch: true,
        render: (_dom, entity) => entity.managerName || '-',
      },
      {
        title: '操作',
        key: 'option',
        width: 260,
        fixed: 'right',
        valueType: 'option',
        render: (_dom, entity) => [
          <Button
            key="detail"
            type="link"
            size="small"
            onClick={() => navigate(`/production/plans/${entity.planId}`)}
          >
            详情
          </Button>,
          <Button
            key="edit"
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => setEditing(entity)}
          >
            编辑
          </Button>,
          <Button
            key="copy"
            type="link"
            size="small"
            icon={<CopyOutlined />}
            onClick={() => {
              setDuplicating(entity)
              setCreateOpen(true)
            }}
          >
            复用
          </Button>,
          entity.status === 2 ? (
            <Popconfirm
              key="terminate"
              title="终止计划"
              description="终止后已生成未执行的任务将自动取消并通知执行人（R-PLAN-04），确认继续？"
              okButtonProps={{ danger: true }}
              onConfirm={() => terminateMutation.mutate(entity.planId)}
            >
              <Button type="link" size="small" danger icon={<StopOutlined />}>
                终止
              </Button>
            </Popconfirm>
          ) : entity.status === 1 ? (
            <Popconfirm
              key="start"
              title="启动计划"
              description={`确认启动「${entity.planName}」？`}
              onConfirm={() => startMutation.mutate(entity.planId)}
            >
              <Button type="link" size="small" icon={<PlayCircleOutlined />}>
                启动
              </Button>
            </Popconfirm>
          ) : null,
          <Popconfirm
            key="remove"
            title="删除计划"
            description={`确认删除「${entity.planName}」？`}
            okButtonProps={{ danger: true }}
            onConfirm={() => removeMutation.mutate(entity.planId)}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>,
        ],
      },
    ],
    [navigate, removeMutation, startMutation, statusEnum, terminateMutation],
  )

  return (
    <>
      <ProTable<Plan>
        actionRef={actionRef}
        rowKey="planId"
        headerTitle={
          <Space>
            <CalendarOutlined style={{ color: '#13a05a' }} />
            <span>种养计划列表</span>
          </Space>
        }
        columns={columns}
        search={{ labelWidth: 'auto' }}
        toolBarRender={() => [
          <Button
            key="calendar"
            icon={<CalendarOutlined />}
            onClick={() => navigate('/production/plans/calendar')}
          >
            农事日历
          </Button>,
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setDuplicating(null)
              setCreateOpen(true)
            }}
          >
            新增种养计划
          </Button>,
        ]}
        request={async (params) => {
          const pageNum = params.current ?? 1
          const pageSize = params.pageSize ?? 10
          try {
            const result = await fetchPlans({
              pageNum,
              pageSize,
              // 「计划名称」与「计划编号」两个搜索框共用 keyword：后端 keyword 同时匹配 名称 与 编码
              // （原先只转发 planName，「计划编号」框里输入的内容根本到不了后端 —— 搜了没反应）。
              keyword:
                (params.planName as string | undefined) || (params.planNo as string | undefined) || undefined,
              // 「作物」列：既能填作物名也能填作物 ID，后端按名称模糊 + ID 精确匹配（原先同样没转发）
              crop: params.cropId as string | undefined,
              status: params.status as number | undefined,
              farmId: effectiveFarmId,
            })
            return { data: result.list, success: true, total: result.total }
          } catch (error) {
            message.error((error as Error).message || '计划列表加载失败')
            return { data: [], success: true, total: 0 }
          }
        }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        dateFormatter="string"
        scroll={{ x: 1400 }}
      />

      <ModalForm<PlanFormValue>
        key={`create-plan-${duplicating?.planId ?? 'blank'}`}
        title={
          <Space>
            <PlusOutlined style={{ color: '#13a05a' }} />
            <span>{duplicating ? '复用历史计划' : '新增种养计划'}</span>
          </Space>
        }
        open={createOpen}
        width={560}
        modalProps={{ destroyOnHidden: true, confirmLoading: createMutation.isPending }}
        initialValues={createInitialValues}
        onOpenChange={(visible) => {
          setCreateOpen(visible)
          if (!visible) setDuplicating(null)
        }}
        onFinish={async (value) => {
          await createMutation.mutateAsync(value)
          return true
        }}
      >
        <ProFormText
          name="planName"
          label="计划名称"
          placeholder="如：2026 春季番茄种植计划"
          rules={[
            { required: true, message: '请输入计划名称' },
            { max: 50, message: '计划名称不超过 50 个字符' },
          ]}
        />
        <ProFormText name="planCode" label="计划编码" placeholder="留空由系统自动生成（同租户内唯一）" />
        <ProFormText name="cropId" label="作物" placeholder="如：tomato / 番茄" rules={[{ required: true, message: '请填写作物' }]} />
        <ProFormText name="cropVariety" label="作物品种" placeholder="如：中杂9号" />
        <ProFormSelect
          name="plotId"
          label="关联地块"
          placeholder="选择地块（可不选）"
          showSearch
          allowClear
          fieldProps={{ optionFilterProp: 'label' }}
          request={loadPlotOptions}
          extra="取自本农场地块台账；同一地块同一时期只允许一个在种计划"
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
        <ProFormDigit
          name="expectedYield"
          label="预计产量(kg)"
          min={0}
          fieldProps={{ precision: 0 }}
        />
        <ProFormText name="ownerId" label="负责人 ID" placeholder="关联团队成员" />
        <ProFormSelect name="status" label="计划状态" options={PLAN_STATUS_OPTIONS} initialValue={1} />
        <ProFormTextArea name="remark" label="备注" placeholder="补充说明，200 字以内" />
      </ModalForm>

      <ModalForm<PlanFormValue>
        key={`edit-plan-${editing?.planId ?? 'none'}`}
        title={
          <Space>
            <EditOutlined style={{ color: '#13a05a' }} />
            <span>编辑种养计划</span>
          </Space>
        }
        open={editing !== null}
        width={560}
        initialValues={
          editing
            ? {
                planName: editing.planName,
                plotId: editing.plotId,
                cropId: editing.cropId,
                cropVariety: editing.cropVariety,
                planStartDate: editing.startDate,
                planEndDate: editing.endDate,
                expectedYield: editing.expectedYield,
                ownerId: editing.managerId,
                status: editing.status,
              }
            : undefined
        }
        modalProps={{ destroyOnHidden: true, confirmLoading: updateMutation.isPending }}
        onOpenChange={(visible) => {
          if (!visible) setEditing(null)
        }}
        onFinish={async (value) => {
          if (!editing) return false
          await updateMutation.mutateAsync({ planId: editing.planId, value })
          return true
        }}
      >
        <ProFormText name="planName" label="计划名称" rules={[{ required: true, message: '请输入计划名称' }]} />
        <ProFormText name="cropId" label="作物" rules={[{ required: true, message: '请填写作物' }]} />
        <ProFormText name="cropVariety" label="作物品种" />
        <ProFormSelect
          name="plotId"
          label="关联地块"
          placeholder="选择地块（可不选）"
          showSearch
          allowClear
          fieldProps={{ optionFilterProp: 'label' }}
          request={loadPlotOptions}
          extra="取自本农场地块台账；同一地块同一时期只允许一个在种计划"
        />
        <ProFormDatePicker name="planStartDate" label="计划开始日期" rules={[{ required: true, message: '请选择开始日期' }]} />
        <ProFormDatePicker name="planEndDate" label="计划结束日期" rules={[{ required: true, message: '请选择结束日期' }]} />
        <ProFormDigit name="expectedYield" label="预计产量(kg)" min={0} fieldProps={{ precision: 0 }} />
        <ProFormText name="ownerId" label="负责人 ID" />
        <ProFormSelect name="status" label="计划状态" options={PLAN_STATUS_OPTIONS} />
      </ModalForm>
    </>
  )
}
