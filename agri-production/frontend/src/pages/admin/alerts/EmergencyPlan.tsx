/**
 * 页面名称：应急预案
 * 路由路径：/admin/production/alerts/emergency
 * 所属模块：异常告警处理
 * PRD 序号：PRD 6.2 #24
 * 原型页码：P25 emergency（含 2.4 ③ 应急预案详情弹窗）
 *
 * 交互说明：
 * - 预案库台账：预案编号 / 预案名称 / 灾害类型 / 适用区域 / 等级 / 状态 / 演练日期 / 更新时间 / 操作；
 * - 「查看流程」打开原型 2.4 ③ 弹窗：预案概况 + 5 步处置流程时间线 + 联系方式 + 立即启动预案；
 * - 支持新建 / 编辑预案（含处置步骤编排）、启用停用、启动预案。
 */
import { useEffect, useMemo, useState } from 'react'
import {
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Timeline,
  Typography,
} from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createEmergencyPlan,
  deleteEmergencyPlan,
  listEmergencyPlans,
  updateEmergencyPlan,
} from '@/api'
import { DemoDataAlert } from '@/components'
import type { EmergencyPlan as EmergencyPlanBase, PageResult } from '@/types'

/** 响应级别：1 一级 2 二级 3 三级 */
type ResponseLevel = 1 | 2 | 3

/** 预案状态：1 启用 0 停用 */
type PlanStatus = 0 | 1

/** 处置步骤 */
interface EmergencyStep {
  /** 步骤名称 */
  name: string
  /** 步骤描述 */
  description: string
  /** 执行方式 */
  executeMode: string
  /** 目标 / 时限 */
  target: string
}

/** 预案行模型（在基础 EmergencyPlan 上补充运营侧展示字段） */
interface EmergencyPlanRow extends EmergencyPlanBase {
  /** 响应级别 */
  responseLevel: ResponseLevel
  /** 状态 */
  status: PlanStatus
  /** 预案编号 */
  planNo: string
  /** 灾害类型文案 */
  disasterType: string
  /** 适用区域 */
  region: string
  /** 最近演练日期 */
  drillDate: string
  /** 创建人 */
  creatorName: string
  /** 处置步骤 */
  steps: EmergencyStep[]
}

/** 响应级别文案与颜色 */
const LEVEL_MAP: Record<ResponseLevel, { label: string; color: string }> = {
  1: { label: '一级', color: 'red' },
  2: { label: '二级', color: 'orange' },
  3: { label: '三级', color: 'blue' },
}

/** 灾害类型选项 */
const DISASTER_OPTIONS: { value: string; label: string }[] = [
  { value: '冷链断链', label: '冷链断链' },
  { value: '食品安全事件', label: '食品安全事件' },
  { value: '设备大面积故障', label: '设备大面积故障' },
  { value: '极端天气', label: '极端天气' },
  { value: '病虫害爆发', label: '病虫害爆发' },
]

/** 原型 P25：冷链断链应急预案的 5 步处置流程 */
const COLD_CHAIN_STEPS: EmergencyStep[] = [
  {
    name: '自动告警触发',
    description: 'IoT传感器检测到温度异常 → 系统自动触发告警 → 通知值班人员',
    executeMode: '自动化执行',
    target: '响应时间: <1分钟',
  },
  {
    name: '值班人员确认',
    description: '值班人员在5分钟内确认告警 → 评估影响范围 → 启动应急预案',
    executeMode: '人工操作',
    target: '目标: 5分钟内',
  },
  {
    name: '通知相关方',
    description: '通知货主、司机、仓储管理员 → 协调备用冷链资源 → 安排货物转运',
    executeMode: '人工操作',
    target: '目标: 15分钟内',
  },
  {
    name: '启动备用方案',
    description: '调用最近可用冷链车 → 安排货物转运 → 持续监控温度变化',
    executeMode: '执行中',
    target: '持续监控至温度恢复',
  },
  {
    name: '事件记录与复盘',
    description: '记录处置全过程 → 生成事件报告 → 分析根因 → 优化预案',
    executeMode: '待执行',
    target: '处置完成后 24 小时内',
  },
]

/** 演示预案数据 */
const MOCK_PLANS: EmergencyPlanRow[] = [
  {
    planId: 'EP001',
    planNo: 'EP001',
    planName: '冷链断链应急预案',
    alertType: '冷链断链',
    disasterType: '冷链断链',
    responseLevel: 1,
    process: COLD_CHAIN_STEPS.map((step) => `${step.name}：${step.description}`).join('\n'),
    steps: COLD_CHAIN_STEPS,
    ownerName: '管理员A',
    ownerPhone: '138-0000-0001',
    status: 1,
    updatedAt: '2025-07-05 10:20',
    drillDate: '2025-06-15',
    creatorName: '管理员A',
    region: '全国冷链线路',
  },
  {
    planId: 'EP002',
    planNo: 'EP002',
    planName: '食品安全事件应急预案',
    alertType: '食品安全',
    disasterType: '食品安全事件',
    responseLevel: 1,
    process: [
      '事件上报：发现农残/重金属超标后立即上报并冻结批次',
      '批次封存：冻结问题批次，禁止销售与出库',
      '抽样复检：委托第三方检测机构复检并出具报告',
      '召回处置：启动召回流程并同步监管部门',
      '复盘优化：完成根因分析并更新投入品管控策略',
    ].join('\n'),
    steps: [
      {
        name: '事件上报',
        description: '发现农残/重金属超标后立即上报质量管理员并冻结批次',
        executeMode: '人工操作',
        target: '目标: 10分钟内',
      },
      {
        name: '批次封存',
        description: '冻结问题批次，禁止销售与出库，同步交易模块下架',
        executeMode: '系统自动',
        target: '响应时间: <5分钟',
      },
      {
        name: '抽样复检',
        description: '委托第三方检测机构复检并出具正式检测报告',
        executeMode: '人工操作',
        target: '目标: 48小时内',
      },
      {
        name: '召回处置',
        description: '启动召回流程，通知渠道与消费者，同步监管部门',
        executeMode: '人工操作',
        target: '目标: 24小时内',
      },
      {
        name: '复盘优化',
        description: '完成根因分析并更新投入品管控策略',
        executeMode: '人工操作',
        target: '处置完成后 7 日内',
      },
    ],
    ownerName: '质量管理员B',
    ownerPhone: '138-0000-0002',
    status: 1,
    updatedAt: '2025-07-08 14:36',
    drillDate: '2025-06-20',
    creatorName: '管理员A',
    region: '全国',
  },
  {
    planId: 'EP003',
    planNo: 'EP003',
    planName: '大面积设备故障预案',
    alertType: '设备故障',
    disasterType: '设备大面积故障',
    responseLevel: 2,
    process: [
      '故障确认：确认离线设备清单与影响农场范围',
      '远程复位：批量下发远程重启指令并观察恢复情况',
      '现场维修：派遣区域运维人员到场处理',
      '数据补录：设备恢复后补录缺失时序数据',
      '报告归档：生成运维报告并归档',
    ].join('\n'),
    steps: [
      {
        name: '故障确认',
        description: '确认离线设备清单与受影响农场范围',
        executeMode: '系统自动',
        target: '响应时间: <5分钟',
      },
      {
        name: '远程复位',
        description: '批量下发远程重启指令并观察设备恢复情况',
        executeMode: '自动化执行',
        target: '目标: 15分钟内',
      },
      {
        name: '现场维修',
        description: '派遣区域运维人员到场更换故障部件',
        executeMode: '人工操作',
        target: '目标: 4小时内',
      },
      {
        name: '数据补录',
        description: '设备恢复后补录缺失时序数据并校验完整性',
        executeMode: '系统自动',
        target: '恢复后 1 小时内',
      },
      {
        name: '报告归档',
        description: '生成运维报告并完成事件归档',
        executeMode: '人工操作',
        target: '处置完成后 24 小时内',
      },
    ],
    ownerName: '运维负责人C',
    ownerPhone: '138-0000-0003',
    status: 1,
    updatedAt: '2025-07-10 09:12',
    drillDate: '2025-07-01',
    creatorName: '管理员B',
    region: '华中大区',
  },
  {
    planId: 'EP004',
    planNo: 'EP004',
    planName: '极端天气应对预案',
    alertType: '气象灾害',
    disasterType: '极端天气',
    responseLevel: 2,
    process: [
      '气象预警：接入气象局预警信息并推送至相关农场',
      '棚室加固：组织农户加固大棚与排涝沟渠',
      '抢收调度：协调农机与人力抢收成熟度达标作物',
      '灾情核查：灾后核查受灾面积与损失',
      '保险理赔：协助农户提交保险理赔材料',
    ].join('\n'),
    steps: [
      {
        name: '气象预警',
        description: '接入气象局预警信息并按区域推送至相关农场',
        executeMode: '自动化执行',
        target: '预警发布后 5 分钟内',
      },
      {
        name: '棚室加固',
        description: '组织农户加固大棚、疏通排涝沟渠',
        executeMode: '人工操作',
        target: '灾害到达前 12 小时',
      },
      {
        name: '抢收调度',
        description: '协调农机与人力抢收成熟度达标作物',
        executeMode: '人工操作',
        target: '灾害窗口期内',
      },
      {
        name: '灾情核查',
        description: '灾后核查受灾面积、减产比例并录入系统',
        executeMode: '人工操作',
        target: '灾后 48 小时内',
      },
      {
        name: '保险理赔',
        description: '协助农户提交保险理赔材料并跟踪赔付进度',
        executeMode: '人工操作',
        target: '灾后 15 日内',
      },
    ],
    ownerName: '农服经理D',
    ownerPhone: '138-0000-0004',
    status: 0,
    updatedAt: '2025-06-30 16:05',
    drillDate: '2025-05-10',
    creatorName: '管理员B',
    region: '黄淮海区域',
  },
]

/** 本地演示数据源 */
let mockPlanStore: EmergencyPlanRow[] = [...MOCK_PLANS]

/** 示例数据覆盖范围（提示条文案） */
const DEMO_SCOPE = '上方应急预案库台账与下方首条预案的处置流程时间线'

/** 示例数据写操作提示 */
const DEMO_WRITE_NOTE =
  '新建 / 编辑 / 启用停用 / 删除预案等操作只会修改浏览器本地内存中的示例数据，未写入服务端，刷新页面后即失效；「启动预案」未接入后端，不会真实下发调度指令或通知责任人。'

/** 新建/编辑表单模型 */
interface PlanFormValues {
  planName: string
  disasterType: string
  region: string
  responseLevel: ResponseLevel
  status: PlanStatus
  ownerName: string
  ownerPhone: string
  steps: EmergencyStep[]
}

/**
 * 应急预案页面
 * @returns 页面内容
 */
export default function EmergencyPlan(): JSX.Element {
  const { message, modal } = App.useApp()
  const queryClient = useQueryClient()
  const [form] = Form.useForm<PlanFormValues>()
  const [rows, setRows] = useState<EmergencyPlanRow[]>([])
  const [detailRow, setDetailRow] = useState<EmergencyPlanRow | undefined>(undefined)
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false)
  const [editingId, setEditingId] = useState<string | undefined>(undefined)
  /** 是否处于示例数据（演示）模式：由数据层返回的 demo 标志驱动 */
  const [demoMode, setDemoMode] = useState<boolean>(false)

  const listQuery = useQuery({
    queryKey: ['admin-emergency-plans'],
    queryFn: async (): Promise<{ rows: EmergencyPlanRow[]; demo: boolean }> => {
      try {
        const page: PageResult<EmergencyPlanBase> = await listEmergencyPlans({
          pageNum: 1,
          pageSize: 100,
        })
        if (page && Array.isArray(page.list) && page.list.length > 0) {
          return {
            rows: page.list.map<EmergencyPlanRow>((item) => ({
              ...item,
              responseLevel: (item.responseLevel as ResponseLevel) ?? 2,
              status: (item.status as PlanStatus) ?? 1,
              planNo: item.planId,
              disasterType: item.alertType,
              region: '全域',
              drillDate: item.updatedAt.slice(0, 10),
              creatorName: '管理员A',
              steps: [],
            })),
            demo: false,
          }
        }
      } catch {
        /* 后端不可用时降级为演示数据 */
      }
      return { rows: mockPlanStore, demo: true }
    },
  })

  useEffect(() => {
    if (listQuery.data) {
      setRows(listQuery.data.rows)
      setDemoMode(listQuery.data.demo)
    }
  }, [listQuery.data])

  /** 保存预案 */
  const saveMutation = useMutation({
    mutationFn: async (values: PlanFormValues) => {
      const process = (values.steps ?? [])
        .map((step) => `${step.name}：${step.description}`)
        .join('\n')
      const payload: Partial<EmergencyPlanBase> = {
        planName: values.planName,
        alertType: values.disasterType,
        responseLevel: values.responseLevel,
        ownerName: values.ownerName,
        ownerPhone: values.ownerPhone,
        status: values.status,
        process,
      }
      try {
        if (editingId) {
          await updateEmergencyPlan(editingId, payload)
        } else {
          await createEmergencyPlan(payload)
        }
        message.success('预案已保存')
      } catch {
        message.warning('预案已保存到本地示例数据（演示模式，未写入服务端，刷新后失效）')
      }
      const nextId = editingId ?? `EP${String(mockPlanStore.length + 1).padStart(3, '0')}`
      const nextRow: EmergencyPlanRow = {
        planId: nextId,
        planNo: nextId,
        planName: values.planName,
        alertType: values.disasterType,
        disasterType: values.disasterType,
        responseLevel: values.responseLevel,
        process,
        steps: values.steps ?? [],
        ownerName: values.ownerName,
        ownerPhone: values.ownerPhone,
        status: values.status,
        updatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
        drillDate: '—',
        creatorName: '当前运营人员',
        region: values.region,
      }
      mockPlanStore = editingId
        ? mockPlanStore.map((item) => (item.planId === editingId ? nextRow : item))
        : [nextRow, ...mockPlanStore]
      return nextRow
    },
    onSuccess: () => {
      setDrawerOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['admin-emergency-plans'] })
    },
  })

  /** 切换启用状态 */
  const toggleMutation = useMutation({
    mutationFn: async (row: EmergencyPlanRow) => {
      const nextStatus: PlanStatus = row.status === 1 ? 0 : 1
      try {
        await updateEmergencyPlan(row.planId, { status: nextStatus })
        message.success(nextStatus === 1 ? '预案已启用' : '预案已停用')
      } catch {
        message.warning(
          `${nextStatus === 1 ? '预案已启用' : '预案已停用'}（演示模式，仅本地更新，未写入服务端）`,
        )
      }
      mockPlanStore = mockPlanStore.map((item) =>
        item.planId === row.planId ? { ...item, status: nextStatus } : item,
      )
      return nextStatus
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin-emergency-plans'] }),
  })

  /** 删除预案 */
  const removeMutation = useMutation({
    mutationFn: async (row: EmergencyPlanRow) => {
      try {
        await deleteEmergencyPlan(row.planId)
        message.success('预案已删除')
      } catch {
        message.warning('预案已从本地示例数据移除（演示模式，未写入服务端，刷新后失效）')
      }
      mockPlanStore = mockPlanStore.filter((item) => item.planId !== row.planId)
      return row.planId
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin-emergency-plans'] }),
  })

  /**
   * 打开新建 / 编辑抽屉
   * @param row 目标预案，为空表示新建
   */
  const openDrawer = (row?: EmergencyPlanRow): void => {
    setEditingId(row?.planId)
    form.setFieldsValue(
      row
        ? {
            planName: row.planName,
            disasterType: row.disasterType,
            region: row.region,
            responseLevel: row.responseLevel,
            status: row.status,
            ownerName: row.ownerName,
            ownerPhone: row.ownerPhone,
            steps: row.steps,
          }
        : {
            disasterType: '冷链断链',
            region: '全国',
            responseLevel: 2,
            status: 1,
            steps: [
              { name: '自动告警触发', description: '', executeMode: '自动化执行', target: '' },
              { name: '值班人员确认', description: '', executeMode: '人工操作', target: '' },
              { name: '通知相关方', description: '', executeMode: '人工操作', target: '' },
              { name: '启动备用方案', description: '', executeMode: '人工操作', target: '' },
              { name: '事件记录与复盘', description: '', executeMode: '人工操作', target: '' },
            ],
          },
    )
    setDrawerOpen(true)
  }

  /**
   * 启动预案
   *
   * 说明：后端虽提供 POST /api/v1/production/alerts/plans/{id}/execute，但该接口
   * 必须携带告警单 ID（alertId）才能执行，本页没有告警上下文，不能凭空构造 ID，
   * 因此此处不发起真实调用，只给出明确提示，避免把「没执行」弹成「已启动」。
   * @param row 目标预案
   */
  const startPlan = (row: EmergencyPlanRow): void => {
    message.warning(
      `「${row.planName}」未真实启动：后端预案执行接口需关联具体告警单（alertId），本页暂无告警上下文，未下发调度指令、未通知责任人 ${row.ownerName}（${row.ownerPhone}）`,
    )
    setDetailRow(undefined)
  }

  /** 预案台账列 */
  const columns = useMemo(
    () => [
      { title: '预案编号', dataIndex: 'planNo', width: 110 },
      {
        title: '预案名称',
        dataIndex: 'planName',
        width: 200,
        render: (text: string) => <Typography.Text strong>{text}</Typography.Text>,
      },
      {
        title: '灾害类型',
        dataIndex: 'disasterType',
        width: 140,
        render: (text: string) => <Tag color="geekblue">{text}</Tag>,
      },
      { title: '适用区域', dataIndex: 'region', width: 140 },
      {
        title: '等级',
        dataIndex: 'responseLevel',
        width: 90,
        render: (level: ResponseLevel) => (
          <Tag color={LEVEL_MAP[level].color}>{LEVEL_MAP[level].label}</Tag>
        ),
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 90,
        render: (status: PlanStatus) =>
          status === 1 ? <Tag color="success">启用</Tag> : <Tag color="default">停用</Tag>,
      },
      { title: '演练日期', dataIndex: 'drillDate', width: 120 },
      { title: '更新时间', dataIndex: 'updatedAt', width: 150 },
      {
        title: '操作',
        key: 'action',
        width: 260,
        render: (_: unknown, row: EmergencyPlanRow) => (
          <Space size={0}>
            <Button type="link" size="small" onClick={() => setDetailRow(row)}>
              查看流程
            </Button>
            <Button
              type="link"
              size="small"
              disabled={row.status !== 1}
              icon={<ThunderboltOutlined />}
              onClick={() => startPlan(row)}
            >
              启动
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
              icon={<EditOutlined />}
              onClick={() => openDrawer(row)}
            >
              编辑
            </Button>
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() =>
                modal.confirm({
                  title: `确认删除预案「${row.planName}」？`,
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

      <Card
        title="应急预案库"
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => void queryClient.invalidateQueries({ queryKey: ['admin-emergency-plans'] })}
            >
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openDrawer()}>
              新建预案
            </Button>
          </Space>
        }
      >
        <Table<EmergencyPlanRow>
          rowKey="planId"
          columns={columns}
          dataSource={rows}
          loading={listQuery.isLoading}
          pagination={false}
          scroll={{ x: 1400 }}
          locale={{ emptyText: <Empty description="暂无应急预案" /> }}
        />
      </Card>

      {/* 原型 P25：当前首条预案的处置流程总览 */}
      <Card
        title={`${rows[0]?.planName ?? '冷链断链应急预案'} - 处置流程`}
        extra={
          rows[0] ? (
            <Button type="primary" onClick={() => setDetailRow(rows[0])}>
              查看详情
            </Button>
          ) : null
        }
      >
        {rows[0] && rows[0].steps.length > 0 ? (
          <Timeline
            items={rows[0].steps.map((step, index) => ({
              color: index === 0 ? 'green' : index < 3 ? 'blue' : 'gray',
              children: (
                <Space direction="vertical" size={2}>
                  <Typography.Text strong>
                    Step {index + 1} · {step.name}
                  </Typography.Text>
                  <Typography.Text>{step.description}</Typography.Text>
                  <Typography.Text type="secondary">
                    {step.executeMode} | {step.target}
                  </Typography.Text>
                </Space>
              ),
            }))}
          />
        ) : (
          <Empty description="该预案暂未编排处置步骤" />
        )}
      </Card>

      {/* 原型 2.4 ③ 应急预案详情弹窗 */}
      <Modal
        title={`应急预案详情 - ${detailRow?.planName ?? ''}`}
        open={Boolean(detailRow)}
        width={760}
        onCancel={() => setDetailRow(undefined)}
        footer={[
          <Button key="close" onClick={() => setDetailRow(undefined)}>
            关闭
          </Button>,
          <Button
            key="start"
            type="primary"
            disabled={detailRow?.status !== 1}
            onClick={() => detailRow && startPlan(detailRow)}
          >
            立即启动预案
          </Button>,
        ]}
      >
        {detailRow ? (
          <>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="预案编号">{detailRow.planNo}</Descriptions.Item>
              <Descriptions.Item label="预案等级">
                <Tag color={LEVEL_MAP[detailRow.responseLevel].color}>
                  {LEVEL_MAP[detailRow.responseLevel].label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="灾害类型">{detailRow.disasterType}</Descriptions.Item>
              <Descriptions.Item label="适用区域">{detailRow.region}</Descriptions.Item>
              <Descriptions.Item label="创建人">{detailRow.creatorName}</Descriptions.Item>
              <Descriptions.Item label="最近演练">{detailRow.drillDate}</Descriptions.Item>
              <Descriptions.Item label="状态">
                {detailRow.status === 1 ? <Tag color="success">启用</Tag> : <Tag>停用</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">{detailRow.updatedAt}</Descriptions.Item>
            </Descriptions>
            <Typography.Text strong>处置步骤</Typography.Text>
            <Timeline
              style={{ marginTop: 12 }}
              items={detailRow.steps.map((step, index) => ({
                color: index === 0 ? 'green' : index < 3 ? 'blue' : 'gray',
                children: (
                  <Space direction="vertical" size={2}>
                    <Typography.Text strong>
                      Step {index + 1} · {step.name}
                    </Typography.Text>
                    <Typography.Text>{step.description}</Typography.Text>
                    <Typography.Text type="secondary">
                      {step.executeMode} | {step.target}
                    </Typography.Text>
                  </Space>
                ),
              }))}
            />
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="责任人">{detailRow.ownerName}</Descriptions.Item>
              <Descriptions.Item label="联系电话">{detailRow.ownerPhone}</Descriptions.Item>
            </Descriptions>
          </>
        ) : null}
      </Modal>

      {/* 新建 / 编辑预案抽屉 */}
      <Drawer
        title={editingId ? '编辑应急预案' : '新建应急预案'}
        width={720}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        destroyOnHidden
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>取消</Button>
            <Button type="primary" loading={saveMutation.isPending} onClick={() => form.submit()}>
              保存
            </Button>
          </Space>
        }
      >
        <Form<PlanFormValues>
          form={form}
          layout="vertical"
          onFinish={(values) => saveMutation.mutate(values)}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="planName"
                label="预案名称"
                rules={[{ required: true, message: '请输入预案名称' }]}
              >
                <Input placeholder="如：冷链断链应急预案" maxLength={50} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="disasterType"
                label="灾害类型"
                rules={[{ required: true, message: '请选择灾害类型' }]}
              >
                <Select options={DISASTER_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="responseLevel"
                label="响应等级"
                rules={[{ required: true, message: '请选择响应等级' }]}
              >
                <Select
                  options={[
                    { value: 1, label: '一级' },
                    { value: 2, label: '二级' },
                    { value: 3, label: '三级' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="region"
                label="适用区域"
                rules={[{ required: true, message: '请输入适用区域' }]}
              >
                <Input placeholder="如：全国冷链线路" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="ownerName"
                label="责任人"
                rules={[{ required: true, message: '请输入责任人' }]}
              >
                <Input placeholder="如：管理员A" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="ownerPhone"
                label="联系电话"
                rules={[{ required: true, message: '请输入联系电话' }]}
              >
                <Input placeholder="如：138-0000-0001" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="status"
                label="启用状态"
                getValueProps={(value: PlanStatus) => ({ checked: value === 1 })}
                normalize={(value: boolean) => (value ? 1 : 0)}
              >
                <Switch checkedChildren="启用" unCheckedChildren="停用" />
              </Form.Item>
            </Col>
          </Row>
          <Typography.Text strong>处置步骤</Typography.Text>
          <Form.List name="steps">
            {(fields, { add, remove }) => (
              <Space direction="vertical" size={12} style={{ width: '100%', marginTop: 12 }}>
                {fields.map((field) => (
                  <Card
                    key={field.key}
                    size="small"
                    styles={{ body: { padding: 12 } }}
                    title={`Step ${field.name + 1}`}
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
                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                      <Form.Item
                        {...field}
                        name={[field.name, 'name']}
                        label="步骤名称"
                        rules={[{ required: true, message: '请输入步骤名称' }]}
                        style={{ marginBottom: 0 }}
                      >
                        <Input placeholder="如：自动告警触发" />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, 'description']}
                        label="步骤描述"
                        rules={[{ required: true, message: '请输入步骤描述' }]}
                        style={{ marginBottom: 0 }}
                      >
                        <Input.TextArea rows={2} placeholder="描述该步骤要做什么" />
                      </Form.Item>
                      <Space wrap size={8}>
                        <Form.Item
                          {...field}
                          name={[field.name, 'executeMode']}
                          label="执行方式"
                          style={{ marginBottom: 0 }}
                        >
                          <Select
                            style={{ width: 150 }}
                            options={[
                              { value: '自动化执行', label: '自动化执行' },
                              { value: '系统自动', label: '系统自动' },
                              { value: '人工操作', label: '人工操作' },
                              { value: '执行中', label: '执行中' },
                              { value: '待执行', label: '待执行' },
                            ]}
                          />
                        </Form.Item>
                        <Form.Item
                          {...field}
                          name={[field.name, 'target']}
                          label="执行目标/时限"
                          style={{ marginBottom: 0 }}
                        >
                          <Input style={{ width: 220 }} placeholder="如：响应时间 <1分钟" />
                        </Form.Item>
                      </Space>
                    </Space>
                  </Card>
                ))}
                <Button
                  type="dashed"
                  block
                  icon={<PlusOutlined />}
                  onClick={() =>
                    add({ name: '', description: '', executeMode: '人工操作', target: '' })
                  }
                >
                  添加处置步骤
                </Button>
              </Space>
            )}
          </Form.List>
        </Form>
      </Drawer>
    </Space>
  )
}
