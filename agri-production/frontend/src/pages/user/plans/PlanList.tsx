import '@/components/ProductionDetailCompact.css'
import ProTable from '@/components/ProductionTable'
/**
 * 页面名称：农事计划
 * 路由路径：/production/plans
 * 所属模块：农事生产
 * PRD 序号：PRD 6.1 #11（对应 PRD 8.2 农事生产）
 *
 * 页面用途（PRD）：计划列表、状态跟踪、地块关联。
 * 表格使用 ProTable；支持按计划名称 / 状态 / 作物检索，
 * 新增、编辑页面跳转、启动 / 终止、删除，并可跳转到详情页与农事日历。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { App as AntdApp, Button, Popconfirm, Progress, Space, Tag, Typography } from 'antd'
import PageContainer from '@/components/ProductionPageContainer'
import type { ActionType, ProColumns } from '@ant-design/pro-components'
import type { TableProps } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalendarOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SendOutlined,
  StopOutlined,
} from '@ant-design/icons'
import './plans.css'
import useAuthStore from '@/store/auth'
import useFarmStore from '@/store/farm'
import {
  approvePlan,
  fetchPlanApprovalPermission,
  fetchPlans,
  removePlan,
  submitPlanApproval,
  terminatePlan,
} from '@/api/production-view'
import {
  PLAN_STATUS_OPTIONS,
  calcPlanProgress,
  formatAreaNumber,
  formatNumber,
  planStatusMeta,
} from '@/utils/production-adapter'
import type { Plan } from '@/types'

/**
 * 农事计划
 * @returns 页面内容
 */
export default function PlanList(): JSX.Element {
  const navigate = useNavigate()
  const { message } = AntdApp.useApp()
  const queryClient = useQueryClient()
  const currentFarm = useFarmStore((state) => state.currentFarm)
  const farmId = currentFarm?.farmId
  const currentUser = useAuthStore((state) => state.userInfo)

  /** 当前用户是否有农事计划审批权限（主体经营者或有审批权限的团队角色） */
  const approvalPermissionQuery = useQuery({
    queryKey: ['plan-approval-permission'],
    queryFn: fetchPlanApprovalPermission,
    staleTime: 60_000,
  })
  const canApprovePlan = approvalPermissionQuery.data === true
  const actionRef = useRef<ActionType>(null)
  const [tableSize, setTableSize] = useState<TableProps<Plan>['size']>('small')
  const [searchParams] = useSearchParams()
  /** 已消费过 URL 上的自动新建标记（防止重复弹窗） */
  const autoCreateConsumed = useRef<boolean>(false)

  /** URL 携带的新建标记：/production/plans?create=1 */
  const autoCreate = searchParams.get('create') === '1'
  /** URL 携带的上下文，用于新建表单预填（如从农场详情 / 地块详情跳转而来） */
  const presetFarmId = searchParams.get('farmId') ?? undefined
  /** 列表归属农场：URL 指定优先，否则取全局当前农场 */
  const effectiveFarmId = presetFarmId || farmId

  useEffect(() => {
    if (!autoCreate || autoCreateConsumed.current) return
    autoCreateConsumed.current = true
    const next = new URLSearchParams(searchParams)
    next.delete('create')
    navigate(`/production/plans/create?${next.toString()}`, { replace: true })
  }, [autoCreate, searchParams, navigate])

  /**
   * 重载列表
   * @returns void
   */
  async function reload(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: ['plan-list'] })
    actionRef.current?.reload()
  }

  const submitApprovalMutation = useMutation({
    mutationFn: (planId: string) => submitPlanApproval(planId),
    onSuccess: () => {
      message.success('计划已提交审批，等待本主体审批')
      void reload()
    },
    onError: (error: Error) => message.error(error.message || '提交审批失败'),
  })

  const approveMutation = useMutation({
    mutationFn: (plan: Plan) =>
      approvePlan(plan.planId, currentUser?.realName || currentUser?.username || '本主体审批人', '审批通过'),
    onSuccess: () => {
      message.success('计划审批已通过，已进入进行中')
      void reload()
    },
    onError: (error: Error) => message.error(error.message || '审批失败'),
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
        title: '计划面积(亩)',
        dataIndex: 'planArea',
        width: 120,
        hideInSearch: true,
        align: 'right',
        // 没填就显示 '-' —— 不拿地块面积顶替（地块面积是地块的属性，不是计划的打算种养面积）
        // 用 formatAreaNumber 而不是 formatNumber：后者固定 0 位小数，会把 88.5 显示成 89
        render: (_dom, entity) => (entity.planArea > 0 ? formatAreaNumber(entity.planArea) : '-'),
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
            onClick={() => navigate(`/production/plans/${entity.planId}/edit`)}
          >
            编辑
          </Button>,
          <Button
            key="copy"
            type="link"
            size="small"
            icon={<CopyOutlined />}
            onClick={() => {
              navigate(`/production/plans/create?copyFrom=${entity.planId}&farmId=${effectiveFarmId ?? ''}`)
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
              key="submit-approval"
              title="提交审批"
              description={`确认提交「${entity.planName}」给本主体审批人审批？`}
              onConfirm={() => submitApprovalMutation.mutate(entity.planId)}
            >
              <Button type="link" size="small" icon={<SendOutlined />}>
                提交审批
              </Button>
            </Popconfirm>
          ) : entity.status === 5 ? (
            canApprovePlan ? (
              <Popconfirm
                key="approve-plan"
                title="审批通过"
                description={`确认审批通过「${entity.planName}」？通过后计划将进入进行中。`}
                onConfirm={() => approveMutation.mutate(entity)}
              >
                <Button type="link" size="small" icon={<CheckCircleOutlined />}>
                  审批通过
                </Button>
              </Popconfirm>
            ) : (
              <Typography.Text key="approve-waiting" type="secondary" style={{ fontSize: 12 }}>
                待审批
              </Typography.Text>
            )
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
    [approveMutation, canApprovePlan, navigate, removeMutation, statusEnum, submitApprovalMutation, terminateMutation],
  )

  return (
    <PageContainer className="production-plans-page" title="📋 农事计划" subTitle={currentFarm?.farmName}>

      <ProTable<Plan>
        actionRef={actionRef}
        rowKey="planId"
        headerTitle={
          <Space>
            <CalendarOutlined style={{ color: '#13a05a' }} />
            <span>农事计划</span>
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
              navigate(`/production/plans/create?farmId=${effectiveFarmId ?? ''}`)
            }}
          >
            新增农事计划
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
            message.error((error as Error).message || '农事计划加载失败')
            return { data: [], success: false, total: 0 }
          }
        }}
        pagination={{ defaultPageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条计划` }}
        dateFormatter="string"
        scroll={{ x: 'max-content' }}
        size={tableSize}
        onSizeChange={setTableSize}
      />


    </PageContainer>
  )
}
