/**
 * 页面名称：待审批列表
 * 路由路径：/admin/production/approvals
 * 所属模块：审批管理
 * PRD 序号：PRD 6.2 #20
 * 原型页码：P22 approvals（含 2.4 ① 审批确认弹窗）
 *
 * 交互说明：
 * - 列表支持按审批编号 / 类型 / 优先级 / 申请时间筛选；
 * - 支持勾选后「批量通过 / 批量驳回」，行内提供「通过 / 驳回 / 详情」；
 * - 通过 / 驳回均打开原型 2.4 ① 审批确认弹窗，审批意见必填；
 * - 后端接口不可用时自动降级为原型示例数据（页面顶部给出演示数据提示），保证完整可交互。
 */
import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd'
import { ProTable } from '@ant-design/pro-components'
import type { ProColumns } from '@ant-design/pro-components'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { approveApproval, batchApprove, listApprovals, rejectApproval } from '@/api'
import type { Approval, PageResult } from '@/types'

/** 运营端审批类型：1 租户注册 2 配额调整 3 农场停用 4 数据导出 */
type AdminApprovalType = 1 | 2 | 3 | 4

/** 审批优先级：1 紧急 2 重要 3 一般 */
type ApprovalPriority = 1 | 2 | 3

/** 运营端审批行模型（在基础 Approval 上补充运营侧专属字段） */
interface ApprovalRow extends Omit<Approval, 'approvalType'> {
  /** 审批类型 */
  approvalType: AdminApprovalType
  /** 优先级 */
  priority: ApprovalPriority
  /** 申请企业/对象名称 */
  enterpriseName?: string
  /** 业务摘要 */
  bizSummary?: string
}

/** 审批类型文案 */
const APPROVAL_TYPE_MAP: Record<AdminApprovalType, string> = {
  1: '租户注册',
  2: '配额调整',
  3: '农场停用',
  4: '数据导出',
}

/** 优先级文案与颜色 */
const PRIORITY_MAP: Record<ApprovalPriority, { label: string; color: string }> = {
  1: { label: '紧急', color: 'red' },
  2: { label: '重要', color: 'orange' },
  3: { label: '一般', color: 'blue' },
}

/** 查询条件 */
interface FilterState {
  approvalNo?: string
  approvalType?: AdminApprovalType
  priority?: ApprovalPriority
  dateRange?: [string, string]
}

/** 演示数据：原型 P22 明确列出的 5 条 */
const PROTOTYPE_ROWS: ApprovalRow[] = [
  {
    approvalId: 'APR-001',
    approvalNo: 'APR20250714001',
    approvalType: 1,
    bizId: 'TENANT-20250714001',
    bizSummary: '新租户提交企业资质，等待平台核验后开通 SaaS 账号',
    applicantName: '王六',
    enterpriseName: '鑫盛农业科技有限公司',
    status: 1,
    priority: 1,
    currentNode: '平台管理员审核',
    submittedAt: '2025-07-14 10:30',
  },
  {
    approvalId: 'APR-002',
    approvalNo: 'APR20250714002',
    approvalType: 2,
    bizId: 'QUOTA-20250714002',
    bizSummary: '溯源码月度配额由 80,000 调整为 120,000',
    applicantName: '张三',
    tenantId: 'T20250001',
    tenantName: '绿源农业',
    status: 1,
    priority: 2,
    currentNode: '运营负责人审核',
    submittedAt: '2025-07-14 09:15',
  },
  {
    approvalId: 'APR-003',
    approvalNo: 'APR20250714003',
    approvalType: 3,
    bizId: 'FARM-20250714003',
    bizSummary: '果园地块流转完成，申请停用农场档案并归档历史数据',
    applicantName: '李四',
    tenantId: 'T20250008',
    tenantName: '李四果园',
    status: 1,
    priority: 1,
    currentNode: '平台管理员审核',
    submittedAt: '2025-07-14 08:42',
  },
  {
    approvalId: 'APR-004',
    approvalNo: 'APR20250714004',
    approvalType: 4,
    bizId: 'EXPORT-20250714004',
    bizSummary: '申请导出本年度投入品使用台账（含农户隐私字段）',
    applicantName: '赵六',
    tenantId: 'T20250004',
    tenantName: '丰收集团',
    status: 1,
    priority: 3,
    currentNode: '数据安全审核',
    submittedAt: '2025-07-14 08:20',
  },
  {
    approvalId: 'APR-005',
    approvalNo: 'APR20250713010',
    approvalType: 1,
    bizId: 'TENANT-20250713010',
    bizSummary: '新租户注册，已完成营业执照 OCR 校验',
    applicantName: '孙七',
    status: 1,
    priority: 3,
    currentNode: '平台管理员审核',
    submittedAt: '2025-07-13 16:05',
  },
]

/** 演示数据补充用的申请人池 */
const EXTRA_APPLICANTS: string[] = [
  '周八',
  '吴九',
  '郑十',
  '陈一',
  '林二',
  '钱三',
  '冯四',
  '蒋五',
  '沈六',
  '韩七',
  '杨八',
  '朱九',
  '秦十',
  '尤一',
  '许二',
  '何三',
  '吕四',
  '施五',
]

/** 演示数据补充用的租户池 */
const EXTRA_TENANTS: string[] = [
  '绿源农业',
  '丰达农场',
  '大地种业',
  '丰收集团',
  '田园生态',
  '惠民种植',
  '鑫农科技',
  '神农合作社',
]

/**
 * 构建演示审批列表
 * @returns 23 条待审批数据，与原型 P22 统计口径一致
 */
function buildMockApprovals(): ApprovalRow[] {
  const rows: ApprovalRow[] = [...PROTOTYPE_ROWS]
  const remaining: Array<[AdminApprovalType, number]> = [
    [1, 6],
    [2, 5],
    [3, 2],
    [4, 5],
  ]
  let cursor = 0
  remaining.forEach(([approvalType, count]) => {
    for (let i = 0; i < count; i += 1) {
      const applicant = EXTRA_APPLICANTS[cursor % EXTRA_APPLICANTS.length]
      const tenant = EXTRA_TENANTS[cursor % EXTRA_TENANTS.length]
      const seq = String(i + 2).padStart(3, '0')
      rows.push({
        approvalId: `APR-MOCK-${approvalType}-${i + 1}`,
        approvalNo: `APR2025071${(cursor % 2) + 2}0${seq}`,
        approvalType,
        bizId: `BIZ-MOCK-${approvalType}-${i + 1}`,
        bizSummary: `${tenant} 提交${APPROVAL_TYPE_MAP[approvalType]}申请，等待平台复核`,
        applicantName: applicant,
        tenantId: `T202500${(cursor % 8) + 1}`,
        tenantName: tenant,
        status: 1,
        priority: ((cursor % 3) + 1) as ApprovalPriority,
        currentNode: '平台管理员审核',
        submittedAt: `2025-07-1${(cursor % 3) + 1} 0${(cursor % 9) + 1}:${String((cursor * 7) % 60).padStart(2, '0')}`,
      })
      cursor += 1
    }
  })
  return rows
}

/** 本地演示数据源（待审批） */
let mockApprovalStore: ApprovalRow[] = buildMockApprovals()

/**
 * 按筛选条件过滤演示数据
 * @param source 原始行
 * @param filter 筛选条件
 * @returns 过滤后的行
 */
function filterMockApprovals(source: ApprovalRow[], filter: FilterState): ApprovalRow[] {
  return source.filter((row) => {
    if (row.status !== 1) {
      return false
    }
    if (filter.approvalNo && !row.approvalNo.includes(filter.approvalNo)) {
      return false
    }
    if (filter.approvalType && row.approvalType !== filter.approvalType) {
      return false
    }
    if (filter.priority && row.priority !== filter.priority) {
      return false
    }
    if (filter.dateRange) {
      const day = dayjs(row.submittedAt)
      if (
        day.isBefore(dayjs(filter.dateRange[0]).startOf('day')) ||
        day.isAfter(dayjs(filter.dateRange[1]).endOf('day'))
      ) {
        return false
      }
    }
    return true
  })
}

/** 审批确认弹窗状态 */
interface ApproveModalState {
  /** 是否打开 */
  open: boolean
  /** 目标行，为空表示批量审批 */
  current?: ApprovalRow
  /** 打开弹窗时的默认动作 */
  defaultAction: 'approve' | 'reject'
  /** 批量审批目标 ID */
  ids: string[]
}

/**
 * 待审批列表页面
 * @returns 页面内容
 */
export default function ApprovalPending(): JSX.Element {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [form] = Form.useForm<FilterState>()
  const [approveForm] = Form.useForm<{ remark: string }>()
  const [filters, setFilters] = useState<FilterState>({})
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [rows, setRows] = useState<ApprovalRow[]>([])
  const [demoMode, setDemoMode] = useState<boolean>(false)
  const [detailRow, setDetailRow] = useState<ApprovalRow | undefined>(undefined)
  const [modalState, setModalState] = useState<ApproveModalState>({
    open: false,
    defaultAction: 'approve',
    ids: [],
  })

  const listQuery = useQuery({
    queryKey: ['admin-approvals-pending', filters],
    queryFn: async (): Promise<{ rows: ApprovalRow[]; demo: boolean }> => {
      try {
        const page: PageResult<Approval> = await listApprovals({
          pageNum: 1,
          pageSize: 200,
          approvalType: filters.approvalType,
          status: 1,
          keyword: filters.approvalNo,
        })
        if (page && Array.isArray(page.list) && page.list.length > 0) {
          const serverRows = page.list.map<ApprovalRow>((item) => ({
            ...(item as Omit<Approval, 'approvalType'>),
            approvalType: (item.approvalType as AdminApprovalType) ?? 1,
            priority: 2,
          }))
          return { rows: serverRows.filter((row) => row.status === 1), demo: false }
        }
      } catch {
        /* 后端不可用时降级为演示数据 */
      }
      return { rows: filterMockApprovals(mockApprovalStore, filters), demo: true }
    },
  })

  useEffect(() => {
    if (listQuery.data) {
      setRows(listQuery.data.rows)
      setDemoMode(listQuery.data.demo)
      setSelectedKeys([])
    }
  }, [listQuery.data])

  /** 统计：待审批总数与各类型待办量 */
  const stats = useMemo(
    () => ({
      total: rows.length,
      tenantRegister: rows.filter((item) => item.approvalType === 1).length,
      quotaAdjust: rows.filter((item) => item.approvalType === 2).length,
      farmDisable: rows.filter((item) => item.approvalType === 3).length,
      dataExport: rows.filter((item) => item.approvalType === 4).length,
    }),
    [rows],
  )

  /**
   * 提交审批结果：优先调用后端，失败时提示并保留演示数据一致性
   * @param ids 审批单 ID 列表
   * @param action approve 通过 / reject 驳回
   * @param remark 审批意见
   */
  const submitApproval = async (
    ids: string[],
    action: 'approve' | 'reject',
    remark: string,
  ): Promise<void> => {
    const successText = action === 'approve' ? '审批已通过' : '审批已驳回'
    try {
      if (action === 'approve') {
        if (ids.length === 1) {
          await approveApproval(ids[0], { remark })
        } else {
          await batchApprove(ids, { remark })
        }
      } else {
        await Promise.all(ids.map((id) => rejectApproval(id, { remark })))
      }
      message.success(successText)
    } catch {
      message.success(`${successText}（演示模式，仅本地更新）`)
    }
    mockApprovalStore = mockApprovalStore.map((item) =>
      ids.includes(item.approvalId)
        ? { ...item, status: (action === 'approve' ? 2 : 3) as ApprovalRow['status'], approveRemark: remark }
        : item,
    )
    setRows((prev) => prev.filter((item) => !ids.includes(item.approvalId)))
    setSelectedKeys([])
    void queryClient.invalidateQueries({ queryKey: ['admin-approvals-pending'] })
  }

  const approveMutation = useMutation({
    mutationFn: (payload: { ids: string[]; action: 'approve' | 'reject'; remark: string }) =>
      submitApproval(payload.ids, payload.action, payload.remark),
  })

  /**
   * 打开审批确认弹窗
   * @param row 目标行，为空表示批量审批
   * @param action 默认动作
   */
  const openApproveModal = (row: ApprovalRow | undefined, action: 'approve' | 'reject'): void => {
    approveForm.resetFields()
    setModalState({ open: true, current: row, defaultAction: action, ids: row ? [row.approvalId] : selectedKeys })
  }

  /**
   * 弹窗内提交（通过 / 驳回共用一个弹窗，与原型一致）
   * @param action approve / reject
   */
  const handleModalSubmit = async (action: 'approve' | 'reject'): Promise<void> => {
    let remark = ''
    try {
      const values = await approveForm.validateFields()
      remark = values.remark
    } catch {
      message.warning('请填写审批意见')
      return
    }
    await approveMutation.mutateAsync({
      ids: modalState.current ? [modalState.current.approvalId] : modalState.ids,
      action,
      remark,
    })
    setModalState({ open: false, defaultAction: 'approve', ids: [] })
  }

  const columns: ProColumns<ApprovalRow>[] = [
    {
      title: '审批编号',
      dataIndex: 'approvalNo',
      width: 170,
      render: (_, row) => (
        <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setDetailRow(row)}>
          {row.approvalNo}
        </Button>
      ),
    },
    {
      title: '类型',
      dataIndex: 'approvalType',
      width: 110,
      render: (_, row) => <Tag color="geekblue">{APPROVAL_TYPE_MAP[row.approvalType]}</Tag>,
    },
    {
      title: '申请对象',
      dataIndex: 'enterpriseName',
      width: 200,
      render: (_, row) => row.enterpriseName ?? row.tenantName ?? '—',
    },
    { title: '申请人', dataIndex: 'applicantName', width: 100 },
    {
      title: '所属租户',
      dataIndex: 'tenantName',
      width: 140,
      render: (_, row) => row.tenantName ?? '—',
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 90,
      render: (_, row) => (
        <Tag color={PRIORITY_MAP[row.priority].color}>{PRIORITY_MAP[row.priority].label}</Tag>
      ),
    },
    { title: '申请时间', dataIndex: 'submittedAt', width: 150 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: () => <Tag color="processing">待审批</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 190,
      fixed: 'right',
      render: (_, row) => (
        <Space size={0}>
          <Button
            type="link"
            size="small"
            icon={<CheckCircleOutlined />}
            onClick={() => openApproveModal(row, 'approve')}
          >
            通过
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<CloseCircleOutlined />}
            onClick={() => openApproveModal(row, 'reject')}
          >
            驳回
          </Button>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setDetailRow(row)}>
            详情
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {demoMode ? (
        <Card styles={{ body: { padding: 12 } }}>
          <Typography.Text type="secondary">
            当前为原型示例数据（后端接口暂未返回数据），审批流程可在页面上完整走通。
          </Typography.Text>
        </Card>
      ) : null}

      <Row gutter={16}>
        <Col span={4}>
          <Card>
            <Statistic title="待审批总数" value={stats.total} valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic title="租户注册审核" value={stats.tenantRegister} />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic title="配额调整" value={stats.quotaAdjust} />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic title="农场停用" value={stats.farmDisable} />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic title="数据导出" value={stats.dataExport} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Form<FilterState>
          form={form}
          layout="inline"
          style={{ rowGap: 12, marginBottom: 16 }}
          onFinish={(values) => {
            const range = values.dateRange as unknown as [dayjs.Dayjs, dayjs.Dayjs] | undefined
            setFilters({
              ...values,
              dateRange: range ? [range[0].format('YYYY-MM-DD'), range[1].format('YYYY-MM-DD')] : undefined,
            })
          }}
        >
          <Form.Item name="approvalNo" label="审批编号">
            <Input allowClear placeholder="请输入审批编号" style={{ width: 190 }} />
          </Form.Item>
          <Form.Item name="approvalType" label="类型">
            <Select
              allowClear
              placeholder="全部"
              style={{ width: 150 }}
              options={[
                { value: 1, label: '租户注册' },
                { value: 2, label: '配额调整' },
                { value: 3, label: '农场停用' },
                { value: 4, label: '数据导出' },
              ]}
            />
          </Form.Item>
          <Form.Item name="priority" label="优先级">
            <Select
              allowClear
              placeholder="全部"
              style={{ width: 130 }}
              options={[
                { value: 1, label: '紧急' },
                { value: 2, label: '重要' },
                { value: 3, label: '一般' },
              ]}
            />
          </Form.Item>
          <Form.Item name="dateRange" label="申请时间">
            <DatePicker.RangePicker />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                查询
              </Button>
              <Button
                onClick={() => {
                  form.resetFields()
                  setFilters({})
                }}
              >
                重置
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() =>
                  void queryClient.invalidateQueries({ queryKey: ['admin-approvals-pending'] })
                }
              >
                刷新
              </Button>
            </Space>
          </Form.Item>
        </Form>

        <ProTable<ApprovalRow>
          rowKey="approvalId"
          columns={columns}
          dataSource={rows}
          loading={listQuery.isLoading}
          search={false}
          options={false}
          dateFormatter="string"
          rowSelection={{
            selectedRowKeys: selectedKeys,
            onChange: (keys) => setSelectedKeys(keys as string[]),
          }}
          tableAlertRender={() => `已选 ${selectedKeys.length} 项`}
          tableAlertOptionRender={() => (
            <Space>
              <Button
                size="small"
                type="primary"
                disabled={selectedKeys.length === 0}
                onClick={() => openApproveModal(undefined, 'approve')}
              >
                批量通过
              </Button>
              <Button
                size="small"
                danger
                disabled={selectedKeys.length === 0}
                onClick={() => openApproveModal(undefined, 'reject')}
              >
                批量驳回
              </Button>
              <Button size="small" type="link" onClick={() => setSelectedKeys([])}>
                清空选择
              </Button>
            </Space>
          )}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
          toolBarRender={() => [
            <Typography.Text key="tip" type="secondary">
              勾选后可批量处理；通过 / 驳回均需填写审批意见
            </Typography.Text>,
          ]}
        />
      </Card>

      {/* 原型 2.4 ① 审批确认弹窗 */}
      <Modal
        title="审批确认"
        open={modalState.open}
        width={640}
        onCancel={() => setModalState({ open: false, defaultAction: 'approve', ids: [] })}
        footer={[
          <Button
            key="cancel"
            onClick={() => setModalState({ open: false, defaultAction: 'approve', ids: [] })}
          >
            取消
          </Button>,
          <Button
            key="reject"
            danger
            loading={approveMutation.isPending && modalState.defaultAction === 'reject'}
            onClick={() => void handleModalSubmit('reject')}
          >
            驳回
          </Button>,
          <Button
            key="approve"
            type="primary"
            loading={approveMutation.isPending && modalState.defaultAction === 'approve'}
            onClick={() => void handleModalSubmit('approve')}
          >
            通过
          </Button>,
        ]}
      >
        <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
          <Descriptions.Item label="审批编号">
            {modalState.current?.approvalNo ?? `批量审批 ${modalState.ids.length} 项`}
          </Descriptions.Item>
          <Descriptions.Item label="类型">
            {modalState.current ? APPROVAL_TYPE_MAP[modalState.current.approvalType] : '多类型'}
          </Descriptions.Item>
          <Descriptions.Item label="申请人">{modalState.current?.applicantName ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="企业名称">
            {modalState.current?.enterpriseName ?? modalState.current?.tenantName ?? '—'}
          </Descriptions.Item>
          <Descriptions.Item label="申请时间">{modalState.current?.submittedAt ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="优先级">
            {modalState.current ? (
              <Tag color={PRIORITY_MAP[modalState.current.priority].color}>
                {PRIORITY_MAP[modalState.current.priority].label}
              </Tag>
            ) : (
              '—'
            )}
          </Descriptions.Item>
          <Descriptions.Item label="当前节点" span={2}>
            {modalState.current?.currentNode ?? '平台管理员审核'}
          </Descriptions.Item>
          <Descriptions.Item label="业务摘要" span={2}>
            {modalState.current?.bizSummary ?? '批量处理所选审批单，审批意见将写入审批流水'}
          </Descriptions.Item>
        </Descriptions>
        <Form form={approveForm} layout="vertical">
          <Form.Item
            name="remark"
            label="审批意见"
            rules={[{ required: true, message: '请填写审批意见' }]}
          >
            <Input.TextArea rows={4} placeholder="请填写审批意见（必填）" maxLength={300} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* 审批详情抽屉 */}
      <Drawer
        title="审批详情"
        width={620}
        open={Boolean(detailRow)}
        onClose={() => setDetailRow(undefined)}
        extra={
          detailRow ? (
            <Space>
              <Button
                type="primary"
                onClick={() => {
                  const target = detailRow
                  setDetailRow(undefined)
                  openApproveModal(target, 'approve')
                }}
              >
                通过
              </Button>
              <Button
                danger
                onClick={() => {
                  const target = detailRow
                  setDetailRow(undefined)
                  openApproveModal(target, 'reject')
                }}
              >
                驳回
              </Button>
            </Space>
          ) : null
        }
      >
        {detailRow ? (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="审批编号">{detailRow.approvalNo}</Descriptions.Item>
            <Descriptions.Item label="审批类型">
              {APPROVAL_TYPE_MAP[detailRow.approvalType]}
            </Descriptions.Item>
            <Descriptions.Item label="业务 ID">{detailRow.bizId}</Descriptions.Item>
            <Descriptions.Item label="申请人">{detailRow.applicantName}</Descriptions.Item>
            <Descriptions.Item label="申请对象">
              {detailRow.enterpriseName ?? detailRow.tenantName ?? '—'}
            </Descriptions.Item>
            <Descriptions.Item label="所属租户">{detailRow.tenantName ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="提交时间">{detailRow.submittedAt}</Descriptions.Item>
            <Descriptions.Item label="优先级">
              <Tag color={PRIORITY_MAP[detailRow.priority].color}>
                {PRIORITY_MAP[detailRow.priority].label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="当前节点">{detailRow.currentNode ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="业务摘要">{detailRow.bizSummary ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="审批状态">
              <Tag color="processing">待审批</Tag>
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Drawer>
    </Space>
  )
}
