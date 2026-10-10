/**
 * 页面名称：审批流程配置
 * 路由路径：/admin/production/approvals/config
 * 所属模块：审批管理
 * PRD 序号：PRD 6.2 #22（PRD 独有页面，原型未绘制）
 *
 * 设计决策（依据 PRD「审批流定义、条件路由、超时升级」）：
 * - 左侧为流程台账（适用审批类型 / 节点数 / 状态），支持新增、编辑、启用停用、删除；
 * - 编辑抽屉按三个 Tab 组织：① 流程节点定义（可增删节点、指定审批角色与审批方式、超时时长）
 *   ② 条件路由（按申请金额 / 审批类型分支到不同节点）③ 超时升级规则（超时小时数 + 升级对象）；
 * - 条件路由与超时升级为基础 ApprovalFlowConfig 的本地扩展字段，通过 approvals API 的
 *   create / update 接口一并提交，不改动既有类型定义。
 */
import { useEffect, useMemo, useState } from 'react'
import {
  App,
  Button,
  Card,
  Col,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  HolderOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createApprovalFlow,
  deleteApprovalFlow,
  listApprovalFlows,
  updateApprovalFlow,
} from '@/api'
import { DemoDataAlert } from '@/components'
import { hasNonEmptyTextFields } from '@/utils/shape-guard'
import type { ApprovalFlowConfig, ApprovalNodeConfig } from '@/types'

/** 运营端审批类型：1 租户注册 2 配额调整 3 农场停用 4 数据导出 */
type AdminApprovalType = 1 | 2 | 3 | 4

/** 审批类型文案 */
const APPROVAL_TYPE_MAP: Record<AdminApprovalType, string> = {
  1: '租户注册',
  2: '配额调整',
  3: '农场停用',
  4: '数据导出',
}

/** 审批角色选项 */
const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'PLATFORM_ADMIN', label: '平台管理员' },
  { value: 'OPS_MANAGER', label: '运营负责人' },
  { value: 'DATA_SECURITY', label: '数据安全审核员' },
  { value: 'AGRONOMIST', label: '农艺专家' },
  { value: 'FINANCE', label: '财务审核员' },
]

/** 升级对象选项 */
const ESCALATION_TARGETS: { value: string; label: string }[] = [
  { value: 'OPS_MANAGER', label: '运营负责人' },
  { value: 'PLATFORM_ADMIN', label: '平台管理员' },
  { value: 'PLATFORM_SUPERVISOR', label: '平台总负责人' },
]

/** 条件字段选项（按金额 / 类型分支） */
const CONDITION_FIELDS: { value: string; label: string }[] = [
  { value: 'amount', label: '申请金额（元）' },
  { value: 'approvalType', label: '审批类型' },
  { value: 'quotaUsageRate', label: '配额使用率（%）' },
  { value: 'farmScale', label: '农场规模（亩）' },
]

/** 比较运算符选项 */
const OPERATORS: { value: string; label: string }[] = [
  { value: 'gt', label: '大于' },
  { value: 'gte', label: '大于等于' },
  { value: 'lt', label: '小于' },
  { value: 'lte', label: '小于等于' },
  { value: 'eq', label: '等于' },
]

/** 条件路由：命中条件后跳转到指定节点 */
interface ConditionRoute {
  /** 条件字段 */
  field: string
  /** 比较运算符 */
  operator: string
  /** 阈值 */
  threshold: string
  /** 满足条件时跳转节点序号 */
  targetNodeOrder: number
}

/** 超时升级规则 */
interface TimeoutEscalation {
  /** 超时小时数 */
  timeoutHours: number
  /** 升级对象 */
  escalateTo: string
  /** 是否短信通知 */
  notifyBySms: boolean
}

/**
 * 流程配置扩展模型
 *
 * `approvalType` 用 `Omit` 摘掉后重新声明为**可选**：后端一旦没给审批类型，
 * 页面必须显示「未指定」，不能靠 `?? 1` 硬塞成「租户注册」——那是凭空造标签。
 */
interface FlowRow extends Omit<ApprovalFlowConfig, 'approvalType'> {
  /** 审批类型；后端未返回有效值时为 undefined，页面显示「未指定」 */
  approvalType?: AdminApprovalType
  /** 条件路由列表 */
  conditionRoutes: ConditionRoute[]
  /** 超时升级规则列表 */
  escalations: TimeoutEscalation[]
}

/** 演示流程配置数据 */
const MOCK_FLOWS: FlowRow[] = [
  {
    flowId: 'FLOW-001',
    flowName: '租户注册审核流程',
    approvalType: 1,
    status: 1,
    updatedAt: '2025-07-10 10:12',
    nodes: [
      {
        nodeId: 'N-1-1',
        flowId: 'FLOW-001',
        nodeOrder: 1,
        nodeName: '资质初审',
        approveRoleCode: 'PLATFORM_ADMIN',
        approveMode: 1,
        timeoutHours: 24,
      },
      {
        nodeId: 'N-1-2',
        flowId: 'FLOW-001',
        nodeOrder: 2,
        nodeName: '运营复核',
        approveRoleCode: 'OPS_MANAGER',
        approveMode: 1,
        timeoutHours: 12,
      },
    ],
    conditionRoutes: [
      { field: 'amount', operator: 'gte', threshold: '100000', targetNodeOrder: 2 },
      { field: 'approvalType', operator: 'eq', threshold: '3', targetNodeOrder: 2 },
    ],
    escalations: [{ timeoutHours: 24, escalateTo: 'OPS_MANAGER', notifyBySms: true }],
  },
  {
    flowId: 'FLOW-002',
    flowName: '配额调整审批流程',
    approvalType: 2,
    status: 1,
    updatedAt: '2025-07-08 16:40',
    nodes: [
      {
        nodeId: 'N-2-1',
        flowId: 'FLOW-002',
        nodeOrder: 1,
        nodeName: '运营审核',
        approveRoleCode: 'OPS_MANAGER',
        approveMode: 1,
        timeoutHours: 8,
      },
    ],
    conditionRoutes: [
      { field: 'quotaUsageRate', operator: 'gte', threshold: '90', targetNodeOrder: 1 },
    ],
    escalations: [{ timeoutHours: 8, escalateTo: 'PLATFORM_ADMIN', notifyBySms: false }],
  },
  {
    flowId: 'FLOW-003',
    flowName: '农场停用审批流程',
    approvalType: 3,
    status: 1,
    updatedAt: '2025-06-28 09:25',
    nodes: [
      {
        nodeId: 'N-3-1',
        flowId: 'FLOW-003',
        nodeOrder: 1,
        nodeName: '业务验收',
        approveRoleCode: 'AGRONOMIST',
        approveMode: 2,
        timeoutHours: 48,
      },
      {
        nodeId: 'N-3-2',
        flowId: 'FLOW-003',
        nodeOrder: 2,
        nodeName: '平台确认',
        approveRoleCode: 'PLATFORM_ADMIN',
        approveMode: 1,
        timeoutHours: 24,
      },
    ],
    conditionRoutes: [
      { field: 'farmScale', operator: 'gte', threshold: '500', targetNodeOrder: 2 },
    ],
    escalations: [{ timeoutHours: 48, escalateTo: 'OPS_MANAGER', notifyBySms: true }],
  },
  {
    flowId: 'FLOW-004',
    flowName: '数据导出审批流程',
    approvalType: 4,
    status: 0,
    updatedAt: '2025-06-15 14:02',
    nodes: [
      {
        nodeId: 'N-4-1',
        flowId: 'FLOW-004',
        nodeOrder: 1,
        nodeName: '数据安全审核',
        approveRoleCode: 'DATA_SECURITY',
        approveMode: 1,
        timeoutHours: 12,
      },
    ],
    conditionRoutes: [],
    escalations: [{ timeoutHours: 12, escalateTo: 'PLATFORM_SUPERVISOR', notifyBySms: true }],
  },
]

/** 本地演示数据源 */
let mockFlowStore: FlowRow[] = [...MOCK_FLOWS]

/** 示例数据覆盖范围（提示条文案） */
const DEMO_SCOPE = '下方审批流程台账（流程名称 / 适用类型 / 节点数 / 条件路由 / 状态 / 更新时间）'

/** 示例数据写操作提示 */
const DEMO_WRITE_NOTE =
  '新建 / 编辑 / 启用停用 / 删除流程等操作只会修改浏览器本地内存中的示例数据，未写入服务端，刷新页面后即失效。'

/**
 * 创建空白节点
 * @param order 节点序号
 * @returns 节点配置
 */
function createEmptyNode(order: number): ApprovalNodeConfig {
  return {
    nodeId: `N-NEW-${order}`,
    flowId: '',
    nodeOrder: order,
    nodeName: `审批节点${order}`,
    approveRoleCode: 'PLATFORM_ADMIN',
    approveMode: 1,
    timeoutHours: 24,
  }
}

/**
 * 审批流程配置页面
 * @returns 页面内容
 */
export default function ApprovalConfig(): JSX.Element {
  const { message, modal } = App.useApp()
  const queryClient = useQueryClient()
  const [form] = Form.useForm<FlowRow>()
  const [flows, setFlows] = useState<FlowRow[]>([])
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false)
  const [editingId, setEditingId] = useState<string | undefined>(undefined)
  const [activeTab, setActiveTab] = useState<string>('nodes')
  /** 是否处于示例数据（演示）模式：由数据层返回的 demo 标志驱动 */
  const [demoMode, setDemoMode] = useState<boolean>(false)

  const listQuery = useQuery({
    queryKey: ['admin-approval-flow-config'],
    queryFn: async (): Promise<{ flows: FlowRow[]; demo: boolean }> => {
      try {
        const { list } = await listApprovalFlows({ pageNum: 1, pageSize: 100 })
        if (Array.isArray(list)) {
          // 形状校验（实测依据见 @/utils/shape-guard）：
          // `GET /admin/approvals/config` 当前返回的是 `{ bizType, approveLevel }`
          // 骨架（ApprovalService#config() 硬编码的 CERT / RECALL / QUOTA 三条），
          // 既没有 flowId 也没有 flowName，更没有 nodes —— 是「审批类型级别」的
          // 骨架，不是流程台账要的 ApprovalFlowConfig。
          //
          // 是否走真数据由「数据形状」决定，不是由「接口通不通」决定：
          // 接口通了但只给骨架，仍然算没有真数据，保持 demo: true，
          // 让 DemoDataAlert 横幅继续提示「非服务端真实数据」。
          // 否则横幅消失、三条骨架被标成凭空的「租户注册」，比降级更骗人。
          const realFlows = list.filter((item) =>
            hasNonEmptyTextFields(item, ['flowId', 'flowName']),
          )
          if (realFlows.length > 0) {
            return {
              flows: realFlows.map<FlowRow>((item) => ({
                ...item,
                // 不认识的审批类型保持 undefined，由列渲染显示「未指定」，
                // 绝不兜底成 1（那会把 CERT/RECALL/QUOTA 一律标成「租户注册」）
                approvalType: item.approvalType as AdminApprovalType | undefined,
                conditionRoutes: [],
                escalations: [],
              })),
              demo: false,
            }
          }
        }
      } catch {
        /* 后端不可用时降级为演示数据 */
      }
      return { flows: mockFlowStore, demo: true }
    },
  })

  useEffect(() => {
    if (listQuery.data) {
      setFlows(listQuery.data.flows)
      setDemoMode(listQuery.data.demo)
    }
  }, [listQuery.data])

  /** 保存流程配置 */
  const saveMutation = useMutation({
    mutationFn: async (values: FlowRow) => {
      const payload: Partial<ApprovalFlowConfig> & {
        conditionRoutes?: ConditionRoute[]
        escalations?: TimeoutEscalation[]
      } = {
        flowName: values.flowName,
        approvalType: values.approvalType,
        status: values.status,
        nodes: (values.nodes ?? []).map((node, index) => ({
          ...node,
          flowId: editingId ?? '',
          nodeOrder: index + 1,
        })),
        conditionRoutes: values.conditionRoutes ?? [],
        escalations: values.escalations ?? [],
      }
      try {
        if (editingId) {
          await updateApprovalFlow(editingId, payload)
        } else {
          await createApprovalFlow(payload)
        }
        message.success('流程配置已保存')
      } catch {
        message.warning('流程配置已保存（演示模式，仅本地更新，未写入服务端，刷新后失效）')
      }
      const nextId = editingId ?? `FLOW-${Date.now()}`
      const nextRow: FlowRow = {
        ...values,
        flowId: nextId,
        nodes: payload.nodes ?? [],
        conditionRoutes: payload.conditionRoutes ?? [],
        escalations: payload.escalations ?? [],
        updatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      }
      mockFlowStore = editingId
        ? mockFlowStore.map((item) => (item.flowId === editingId ? nextRow : item))
        : [nextRow, ...mockFlowStore]
      return nextRow
    },
    onSuccess: () => {
      setDrawerOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['admin-approval-flow-config'] })
    },
  })

  /** 切换流程启用状态 */
  const toggleMutation = useMutation({
    mutationFn: async (row: FlowRow) => {
      const nextStatus: 0 | 1 = row.status === 1 ? 0 : 1
      try {
        await updateApprovalFlow(row.flowId, { status: nextStatus })
        message.success(nextStatus === 1 ? '流程已启用' : '流程已停用')
      } catch {
        message.warning(
          `${nextStatus === 1 ? '流程已启用' : '流程已停用'}（演示模式，仅本地更新，未写入服务端）`,
        )
      }
      mockFlowStore = mockFlowStore.map((item) =>
        item.flowId === row.flowId ? { ...item, status: nextStatus } : item,
      )
      return nextStatus
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['admin-approval-flow-config'] }),
  })

  /** 删除流程 */
  const removeMutation = useMutation({
    mutationFn: async (row: FlowRow) => {
      try {
        await deleteApprovalFlow(row.flowId)
        message.success('流程已删除')
      } catch {
        message.warning('流程已删除（演示模式，仅本地更新，未写入服务端，刷新后失效）')
      }
      mockFlowStore = mockFlowStore.filter((item) => item.flowId !== row.flowId)
      return row.flowId
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['admin-approval-flow-config'] }),
  })

  /**
   * 打开编辑抽屉
   * @param row 目标流程，为空表示新建
   */
  const openDrawer = (row?: FlowRow): void => {
    setEditingId(row?.flowId)
    setActiveTab('nodes')
    form.setFieldsValue(
      row ?? {
        flowName: '',
        approvalType: 1,
        status: 1,
        nodes: [createEmptyNode(1)],
        conditionRoutes: [],
        escalations: [{ timeoutHours: 24, escalateTo: 'OPS_MANAGER', notifyBySms: true }],
      },
    )
    setDrawerOpen(true)
  }

  /** 流程台账列 */
  const columns = useMemo(
    () => [
      {
        title: '流程名称',
        dataIndex: 'flowName',
        width: 200,
        render: (text: string) => <Typography.Text strong>{text}</Typography.Text>,
      },
      {
        title: '适用审批类型',
        dataIndex: 'approvalType',
        width: 140,
        // 后端没给审批类型时显示「未指定」，不臆造默认值
        render: (value?: AdminApprovalType) =>
          value ? (
            <Tag color="geekblue">{APPROVAL_TYPE_MAP[value]}</Tag>
          ) : (
            <Tag>未指定</Tag>
          ),
      },
      {
        title: '节点数',
        dataIndex: 'nodes',
        width: 90,
        render: (nodes: ApprovalNodeConfig[]) => nodes?.length ?? 0,
      },
      {
        title: '条件路由',
        dataIndex: 'conditionRoutes',
        width: 100,
        render: (routes: ConditionRoute[]) => routes?.length ?? 0,
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 100,
        render: (status: 0 | 1) =>
          status === 1 ? <Tag color="success">启用</Tag> : <Tag color="default">停用</Tag>,
      },
      { title: '更新时间', dataIndex: 'updatedAt', width: 160 },
      {
        title: '操作',
        key: 'action',
        width: 220,
        render: (_: unknown, row: FlowRow) => (
          <Space size={0}>
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openDrawer(row)}>
              编辑
            </Button>
            <Button
              type="link"
              size="small"
              disabled={row.status !== 1}
              onClick={() => toggleMutation.mutate(row)}
            >
              停用
            </Button>
            <Button
              type="link"
              size="small"
              disabled={row.status === 1}
              onClick={() => toggleMutation.mutate(row)}
            >
              启用
            </Button>
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() =>
                modal.confirm({
                  title: `确认删除流程「${row.flowName}」？`,
                  content: '删除后该审批类型将回退到默认流程。',
                  okText: '确认删除',
                  cancelText: '取消',
                  okButtonProps: { danger: true },
                  onOk: () => removeMutation.mutateAsync(row),
                })
              }
            >
              删除
            </Button>
          </Space>
        ),
      },
    ],
    [modal, removeMutation, toggleMutation],
  )

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {demoMode ? <DemoDataAlert scope={DEMO_SCOPE} writeNote={DEMO_WRITE_NOTE} /> : null}

      <Row gutter={16}>
        <Col span={24}>
          <Card styles={{ body: { padding: 12 } }}>
            <Space>
              <Typography.Text type="secondary">
                配置各审批类型的节点、条件路由与超时升级策略；停用的流程将回退到系统默认审批流。
              </Typography.Text>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card
        title="审批流程台账"
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() =>
                void queryClient.invalidateQueries({ queryKey: ['admin-approval-flow-config'] })
              }
            >
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openDrawer()}>
              新建流程
            </Button>
          </Space>
        }
      >
        <Table<FlowRow>
          // 兜底到下标：万一某行没有 flowId（后端形状漂移）也不会撞成重复 key
          rowKey={(record, index) => record.flowId || `flow-row-${index ?? 0}`}
          columns={columns}
          dataSource={flows}
          loading={listQuery.isLoading}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无流程配置" /> }}
        />
      </Card>

      <Drawer
        title={editingId ? '编辑审批流程' : '新建审批流程'}
        width={760}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        destroyOnHidden
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>取消</Button>
            <Button
              type="primary"
              loading={saveMutation.isPending}
              onClick={() => form.submit()}
            >
              保存
            </Button>
          </Space>
        }
      >
        <Form<FlowRow>
          form={form}
          layout="vertical"
          onFinish={(values) => saveMutation.mutate(values)}
          initialValues={{ status: 1, approvalType: 1 }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="flowName"
                label="流程名称"
                rules={[{ required: true, message: '请输入流程名称' }]}
              >
                <Input placeholder="如：租户注册审核流程" maxLength={50} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="approvalType"
                label="适用审批类型"
                rules={[{ required: true, message: '请选择适用审批类型' }]}
              >
                <Select
                  options={[
                    { value: 1, label: '租户注册' },
                    { value: 2, label: '配额调整' },
                    { value: 3, label: '农场停用' },
                    { value: 4, label: '数据导出' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="status"
                label="启用状态"
                getValueProps={(value: 0 | 1) => ({ checked: value === 1 })}
                normalize={(value: boolean) => (value ? 1 : 0)}
              >
                <Switch checkedChildren="启用" unCheckedChildren="停用" />
              </Form.Item>
            </Col>
          </Row>

          <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'nodes',
              label: '① 流程节点定义',
              children: (
                <div>
                  <Form.List name="nodes">
                    {(fields, { add, remove }) => (
                      <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        {fields.length === 0 ? (
                          <Empty description="暂未配置节点，请点击下方按钮添加" />
                        ) : null}
                        {fields.map((field) => (
                          <Card
                            key={field.key}
                            size="small"
                            styles={{ body: { padding: 12 } }}
                            extra={
                              <Button
                                type="text"
                                danger
                                size="small"
                                icon={<DeleteOutlined />}
                                onClick={() => remove(field.name)}
                              >
                                删除
                              </Button>
                            }
                          >
                            <Space align="baseline" wrap size={8}>
                              <Typography.Text type="secondary">
                                <HolderOutlined /> 节点 {field.name + 1}
                              </Typography.Text>
                              <Form.Item
                                {...field}
                                name={[field.name, 'nodeName']}
                                label="节点名称"
                                rules={[{ required: true, message: '请输入节点名称' }]}
                                style={{ marginBottom: 0 }}
                              >
                                <Input placeholder="如：资质初审" style={{ width: 160 }} />
                              </Form.Item>
                              <Form.Item
                                {...field}
                                name={[field.name, 'approveRoleCode']}
                                label="审批角色"
                                rules={[{ required: true, message: '请选择审批角色' }]}
                                style={{ marginBottom: 0 }}
                              >
                                <Select options={ROLE_OPTIONS} style={{ width: 160 }} />
                              </Form.Item>
                              <Form.Item
                                {...field}
                                name={[field.name, 'approveMode']}
                                label="审批方式"
                                style={{ marginBottom: 0 }}
                              >
                                <Select
                                  style={{ width: 120 }}
                                  options={[
                                    { value: 1, label: '或签' },
                                    { value: 2, label: '会签' },
                                  ]}
                                />
                              </Form.Item>
                              <Form.Item
                                {...field}
                                name={[field.name, 'timeoutHours']}
                                label="超时时长"
                                tooltip="超过该时长未处理将触发超时升级规则"
                                style={{ marginBottom: 0 }}
                              >
                                <InputNumber min={1} max={720} addonAfter="小时" style={{ width: 140 }} />
                              </Form.Item>
                            </Space>
                          </Card>
                        ))}
                        <Button
                          type="dashed"
                          block
                          icon={<PlusOutlined />}
                          onClick={() => add(createEmptyNode(fields.length + 1))}
                        >
                          添加审批节点
                        </Button>
                      </Space>
                    )}
                  </Form.List>
                </div>
              ),
            },
            {
              key: 'routes',
              label: '② 条件路由',
              children: (
                <div>
                  <Typography.Paragraph type="secondary">
                    命中条件的申请单将跳转到对应节点；多条路由按顺序匹配，未命中则按节点顺序流转。
                  </Typography.Paragraph>
                  <Form.List name="conditionRoutes">
                    {(fields, { add, remove }) => (
                      <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        {fields.length === 0 ? (
                          <Empty description="暂未配置条件路由" />
                        ) : null}
                        {fields.map((field) => (
                          <Space key={field.key} align="baseline" wrap size={8}>
                            <Form.Item
                              {...field}
                              name={[field.name, 'field']}
                              label="条件字段"
                              rules={[{ required: true, message: '请选择条件字段' }]}
                              style={{ marginBottom: 0 }}
                            >
                              <Select options={CONDITION_FIELDS} style={{ width: 170 }} />
                            </Form.Item>
                            <Form.Item
                              {...field}
                              name={[field.name, 'operator']}
                              label="比较符"
                              rules={[{ required: true, message: '请选择比较符' }]}
                              style={{ marginBottom: 0 }}
                            >
                              <Select options={OPERATORS} style={{ width: 120 }} />
                            </Form.Item>
                            <Form.Item
                              {...field}
                              name={[field.name, 'threshold']}
                              label="阈值"
                              rules={[{ required: true, message: '请输入阈值' }]}
                              style={{ marginBottom: 0 }}
                            >
                              <Input placeholder="如：100000" style={{ width: 140 }} />
                            </Form.Item>
                            <Form.Item
                              {...field}
                              name={[field.name, 'targetNodeOrder']}
                              label="跳转节点"
                              rules={[{ required: true, message: '请选择跳转节点' }]}
                              style={{ marginBottom: 0 }}
                            >
                              <InputNumber min={1} max={20} style={{ width: 110 }} addonBefore="第" addonAfter="节点" />
                            </Form.Item>
                            <Button
                              type="text"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() => remove(field.name)}
                            />
                          </Space>
                        ))}
                        <Button
                          type="dashed"
                          block
                          icon={<PlusOutlined />}
                          onClick={() =>
                            add({ field: 'amount', operator: 'gte', threshold: '', targetNodeOrder: 1 })
                          }
                        >
                          添加条件路由
                        </Button>
                      </Space>
                    )}
                  </Form.List>
                </div>
              ),
            },
            {
              key: 'escalation',
              label: '③ 超时升级规则',
              children: (
                <div>
                  <Typography.Paragraph type="secondary">
                    节点超过设定时长仍未处理时，自动将审批单升级给指定对象并发送提醒。
                  </Typography.Paragraph>
                  <Form.List name="escalations">
                    {(fields, { add, remove }) => (
                      <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        {fields.length === 0 ? <Empty description="暂未配置超时升级规则" /> : null}
                        {fields.map((field) => (
                          <Space key={field.key} align="baseline" wrap size={8}>
                            <Form.Item
                              {...field}
                              name={[field.name, 'timeoutHours']}
                              label="超时小时数"
                              rules={[{ required: true, message: '请输入超时小时数' }]}
                              style={{ marginBottom: 0 }}
                            >
                              <InputNumber min={1} max={720} addonAfter="小时" style={{ width: 150 }} />
                            </Form.Item>
                            <Form.Item
                              {...field}
                              name={[field.name, 'escalateTo']}
                              label="升级对象"
                              rules={[{ required: true, message: '请选择升级对象' }]}
                              style={{ marginBottom: 0 }}
                            >
                              <Select options={ESCALATION_TARGETS} style={{ width: 180 }} />
                            </Form.Item>
                            <Form.Item
                              {...field}
                              name={[field.name, 'notifyBySms']}
                              label="短信通知"
                              valuePropName="checked"
                              style={{ marginBottom: 0 }}
                            >
                              <Switch checkedChildren="开" unCheckedChildren="关" />
                            </Form.Item>
                            <Button
                              type="text"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() => remove(field.name)}
                            />
                          </Space>
                        ))}
                        <Button
                          type="dashed"
                          block
                          icon={<PlusOutlined />}
                          onClick={() =>
                            add({ timeoutHours: 24, escalateTo: 'OPS_MANAGER', notifyBySms: true })
                          }
                        >
                          添加超时升级规则
                        </Button>
                      </Space>
                    )}
                  </Form.List>
                </div>
              ),
            },
          ]}
        />
        </Form>
      </Drawer>
    </Space>
  )
}
