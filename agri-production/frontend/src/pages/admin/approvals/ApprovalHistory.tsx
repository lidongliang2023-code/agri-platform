/**
 * 页面名称：审批历史
 * 路由路径：/admin/production/approvals/history
 * 所属模块：审批管理
 * PRD 序号：PRD 6.2 #21
 * 原型页码：P23 approval-history
 *
 * 交互说明：
 * - 已办审批归档查询，支持审批编号 / 类型 / 结果 / 审批人筛选与重置；
 * - 顶部提供通过率与平均审批时长统计；
 * - 支持导出 CSV 报告；行「查看」打开审批详情抽屉（含审批意见）。
 */
import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import {
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Form,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd'
import { ProTable } from '@ant-design/pro-components'
import type { ProColumns } from '@ant-design/pro-components'
import { DownloadOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listApprovalHistory } from '@/api'
import type { Approval, PageResult } from '@/types'

/** 运营端审批类型：1 租户注册 2 配额调整 3 农场停用 4 数据导出 */
type AdminApprovalType = 1 | 2 | 3 | 4

/** 历史审批行模型 */
interface HistoryRow {
  /** 审批单 ID */
  approvalId: string
  /** 审批编号 */
  approvalNo: string
  /** 审批类型 */
  approvalType: AdminApprovalType
  /** 申请人 */
  applicantName: string
  /** 所属租户 */
  tenantName?: string
  /** 申请对象 */
  targetName?: string
  /** 业务摘要 */
  bizSummary?: string
  /** 审批结果：2 通过 3 驳回 */
  status: 2 | 3
  /** 审批人 */
  approverName: string
  /** 审批意见 */
  approveRemark?: string
  /** 提交时间 */
  submittedAt: string
  /** 审批时间 */
  approvedAt: string
  /** 审批耗时（小时） */
  durationHours: number
}

/** 审批类型文案 */
const APPROVAL_TYPE_MAP: Record<AdminApprovalType, string> = {
  1: '租户注册',
  2: '配额调整',
  3: '农场停用',
  4: '数据导出',
}

/** 原型 P23 明确列出的 5 条已办记录 */
const PROTOTYPE_ROWS: HistoryRow[] = [
  {
    approvalId: 'APR-H-001',
    approvalNo: 'APR20250713001',
    approvalType: 1,
    applicantName: '周八',
    tenantName: '绿源农业',
    targetName: '周八家庭农场',
    bizSummary: '新租户注册，资质核验通过',
    status: 2,
    approverName: '管理员A',
    approveRemark: '营业执照与法人信息核验一致，予以通过。',
    submittedAt: '2025-07-13 10:20',
    approvedAt: '2025-07-13 16:30',
    durationHours: 6.2,
  },
  {
    approvalId: 'APR-H-002',
    approvalNo: 'APR20250713002',
    approvalType: 2,
    applicantName: '吴九',
    tenantName: '丰达农场',
    targetName: '溯源码配额',
    bizSummary: '溯源码月度配额上调至 150,000',
    status: 2,
    approverName: '管理员A',
    approveRemark: '配额使用连续两月超 90%，同意上调。',
    submittedAt: '2025-07-13 09:00',
    approvedAt: '2025-07-13 15:20',
    durationHours: 6.3,
  },
  {
    approvalId: 'APR-H-003',
    approvalNo: 'APR20250713003',
    approvalType: 3,
    applicantName: '郑十',
    tenantName: '李四果园',
    targetName: '李四果园',
    bizSummary: '农场停用申请，地块尚未完成收获结算',
    status: 3,
    approverName: '管理员B',
    approveRemark: '仍有 3 个地块未完成采收结算，暂不批准停用。',
    submittedAt: '2025-07-13 08:30',
    approvedAt: '2025-07-13 14:10',
    durationHours: 5.7,
  },
  {
    approvalId: 'APR-H-004',
    approvalNo: 'APR20250712001',
    approvalType: 4,
    applicantName: '陈一',
    tenantName: '丰收集团',
    targetName: '投入品台账导出',
    bizSummary: '申请导出上季度投入品使用台账',
    status: 2,
    approverName: '管理员A',
    approveRemark: '脱敏后导出，已核对数据用途。',
    submittedAt: '2025-07-12 09:10',
    approvedAt: '2025-07-12 11:30',
    durationHours: 2.3,
  },
  {
    approvalId: 'APR-H-005',
    approvalNo: 'APR20250712002',
    approvalType: 1,
    applicantName: '林二',
    tenantName: '大地种业',
    targetName: '大地种业',
    bizSummary: '新租户注册并完成实名认证',
    status: 2,
    approverName: '管理员B',
    approveRemark: '实名认证与银行卡信息一致，予以通过。',
    submittedAt: '2025-07-12 08:00',
    approvedAt: '2025-07-12 10:15',
    durationHours: 2.2,
  },
]

/** 演示数据补充用申请人池 */
const EXTRA_APPLICANTS: string[] = [
  '张三',
  '李四',
  '王五',
  '赵六',
  '孙七',
  '周八',
  '吴九',
  '郑十',
  '冯十一',
  '陈十二',
]

/** 演示数据补充用租户池 */
const EXTRA_TENANTS: string[] = [
  '绿源农业',
  '丰达农场',
  '大地种业',
  '丰收集团',
  '田园生态',
  '惠民种植',
  '鑫农科技',
]

/**
 * 构建演示审批历史数据
 * @returns 32 条已办记录
 */
function buildMockHistory(): HistoryRow[] {
  const rows: HistoryRow[] = [...PROTOTYPE_ROWS]
  for (let i = 0; i < 27; i += 1) {
    const day = 11 - (i % 10)
    const monthDay = String(day).padStart(2, '0')
    const status: 2 | 3 = i % 5 === 0 ? 3 : 2
    const approvalType = ((i % 4) + 1) as AdminApprovalType
    rows.push({
      approvalId: `APR-H-MOCK-${i + 1}`,
      approvalNo: `APR202507${monthDay}0${String((i % 9) + 1)}`,
      approvalType,
      applicantName: EXTRA_APPLICANTS[i % EXTRA_APPLICANTS.length],
      tenantName: EXTRA_TENANTS[i % EXTRA_TENANTS.length],
      targetName: `${EXTRA_TENANTS[i % EXTRA_TENANTS.length]} · ${APPROVAL_TYPE_MAP[approvalType]}`,
      bizSummary: `${EXTRA_TENANTS[i % EXTRA_TENANTS.length]} 提交的${APPROVAL_TYPE_MAP[approvalType]}申请`,
      status,
      approverName: i % 2 === 0 ? '管理员A' : '管理员B',
      approveRemark: status === 2 ? '材料齐全，予以通过。' : '材料不完整，请补充后重新提交。',
      submittedAt: `2025-07-${monthDay} 0${(i % 8) + 1}:15`,
      approvedAt: `2025-07-${monthDay} ${String(((i % 8) + 3) % 24).padStart(2, '0')}:40`,
      durationHours: Number((((i % 9) + 1) * 0.8 + 1).toFixed(1)),
    })
  }
  return rows
}

/** 本地演示数据源 */
const MOCK_HISTORY: HistoryRow[] = buildMockHistory()

/** 原型口径的历史总量 */
const MOCK_TOTAL = 3250

/** 查询条件 */
interface FilterState {
  approvalNo?: string
  approvalType?: AdminApprovalType
  status?: 2 | 3
  approverName?: string
}

/**
 * 审批历史页面
 * @returns 页面内容
 */
export default function ApprovalHistory(): JSX.Element {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [form] = Form.useForm<FilterState>()
  const [filters, setFilters] = useState<FilterState>({})
  const [rows, setRows] = useState<HistoryRow[]>([])
  const [demoMode, setDemoMode] = useState<boolean>(false)
  const [detailRow, setDetailRow] = useState<HistoryRow | undefined>(undefined)

  const listQuery = useQuery({
    queryKey: ['admin-approvals-history', filters],
    queryFn: async (): Promise<{ rows: HistoryRow[]; total: number; demo: boolean }> => {
      try {
        const page: PageResult<Approval> = await listApprovalHistory({
          pageNum: 1,
          pageSize: 500,
          approvalType: filters.approvalType,
          status: filters.status,
          keyword: filters.approvalNo,
        })
        if (page && Array.isArray(page.list) && page.list.length > 0) {
          const serverRows = page.list
            .filter((item) => item.status === 2 || item.status === 3)
            .map<HistoryRow>((item) => ({
              approvalId: item.approvalId,
              approvalNo: item.approvalNo,
              approvalType: (item.approvalType as AdminApprovalType) ?? 1,
              applicantName: item.applicantName,
              tenantName: item.tenantName,
              bizSummary: item.bizSummary,
              status: item.status as 2 | 3,
              approverName: item.approverName ?? '管理员A',
              approveRemark: item.approveRemark,
              submittedAt: item.submittedAt,
              approvedAt: item.approvedAt ?? item.submittedAt,
              durationHours: Number(
                (
                  (dayjs(item.approvedAt ?? item.submittedAt).valueOf() -
                    dayjs(item.submittedAt).valueOf()) /
                  3600000
                ).toFixed(1),
              ),
            }))
          return { rows: serverRows, total: page.total, demo: false }
        }
      } catch {
        /* 后端不可用时降级为演示数据 */
      }
      const filtered = MOCK_HISTORY.filter((row) => {
        if (filters.approvalNo && !row.approvalNo.includes(filters.approvalNo)) {
          return false
        }
        if (filters.approvalType && row.approvalType !== filters.approvalType) {
          return false
        }
        if (filters.status && row.status !== filters.status) {
          return false
        }
        if (filters.approverName && row.approverName !== filters.approverName) {
          return false
        }
        return true
      })
      return { rows: filtered, total: MOCK_TOTAL, demo: true }
    },
  })

  useEffect(() => {
    if (listQuery.data) {
      setRows(listQuery.data.rows)
      setDemoMode(listQuery.data.demo)
    }
  }, [listQuery.data])

  /** 统计：通过率、平均审批时长、驳回数 */
  const stats = useMemo(() => {
    const total = rows.length
    const approved = rows.filter((row) => row.status === 2).length
    const rejected = total - approved
    const avgHours =
      total === 0 ? 0 : Number((rows.reduce((sum, row) => sum + row.durationHours, 0) / total).toFixed(1))
    const passRate = total === 0 ? 0 : Number(((approved / total) * 100).toFixed(1))
    return { total, approved, rejected, avgHours, passRate }
  }, [rows])

  /** 导出 CSV 报告 */
  const handleExport = (): void => {
    const header = ['审批编号', '类型', '申请人', '所属租户', '审批结果', '审批人', '审批时间', '耗时(小时)', '审批意见']
    const body = rows.map((row) => [
      row.approvalNo,
      APPROVAL_TYPE_MAP[row.approvalType],
      row.applicantName,
      row.tenantName ?? '—',
      row.status === 2 ? '通过' : '驳回',
      row.approverName,
      row.approvedAt,
      String(row.durationHours),
      (row.approveRemark ?? '').replace(/"/g, '""'),
    ])
    const csv = [header, ...body]
      .map((line) => line.map((cell) => `"${cell}"`).join(','))
      .join('\r\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `审批历史_${dayjs().format('YYYYMMDDHHmm')}.csv`
    link.click()
    URL.revokeObjectURL(url)
    message.success(`已导出 ${rows.length} 条审批历史`)
  }

  const columns: ProColumns<HistoryRow>[] = [
    { title: '审批编号', dataIndex: 'approvalNo', width: 170 },
    {
      title: '类型',
      dataIndex: 'approvalType',
      width: 110,
      render: (_, row) => <Tag color="geekblue">{APPROVAL_TYPE_MAP[row.approvalType]}</Tag>,
    },
    { title: '申请人', dataIndex: 'applicantName', width: 100 },
    {
      title: '所属租户',
      dataIndex: 'tenantName',
      width: 140,
      render: (_, row) => row.tenantName ?? '—',
    },
    {
      title: '结果',
      dataIndex: 'status',
      width: 100,
      render: (_, row) =>
        row.status === 2 ? <Tag color="success">通过</Tag> : <Tag color="error">驳回</Tag>,
    },
    { title: '审批人', dataIndex: 'approverName', width: 110 },
    { title: '审批时间', dataIndex: 'approvedAt', width: 150 },
    {
      title: '耗时',
      dataIndex: 'durationHours',
      width: 100,
      render: (_, row) => `${row.durationHours} h`,
    },
    {
      title: '操作',
      key: 'action',
      width: 90,
      fixed: 'right',
      render: (_, row) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setDetailRow(row)}>
          查看
        </Button>
      ),
    },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {demoMode ? (
        <Card styles={{ body: { padding: 12 } }}>
          <Typography.Text type="secondary">
            当前为原型示例数据（后端接口暂未返回数据），查询 / 导出等功能可正常使用。
          </Typography.Text>
        </Card>
      ) : null}

      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic title="当前筛选结果" value={stats.total} suffix="条" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="通过率"
              value={stats.passRate}
              suffix="%"
              valueStyle={{ color: '#13a05a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="平均审批时长" value={stats.avgHours} suffix="小时" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="驳回数量"
              value={stats.rejected}
              valueStyle={{ color: stats.rejected > 0 ? '#cf1322' : undefined }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Form<FilterState>
          form={form}
          layout="inline"
          style={{ rowGap: 12, marginBottom: 16 }}
          onFinish={(values) => setFilters(values)}
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
          <Form.Item name="status" label="结果">
            <Select
              allowClear
              placeholder="全部"
              style={{ width: 130 }}
              options={[
                { value: 2, label: '通过' },
                { value: 3, label: '驳回' },
              ]}
            />
          </Form.Item>
          <Form.Item name="approverName" label="审批人">
            <Select
              allowClear
              placeholder="全部"
              style={{ width: 150 }}
              options={[
                { value: '管理员A', label: '管理员A' },
                { value: '管理员B', label: '管理员B' },
              ]}
            />
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
                  void queryClient.invalidateQueries({ queryKey: ['admin-approvals-history'] })
                }
              >
                刷新
              </Button>
            </Space>
          </Form.Item>
        </Form>

        <ProTable<HistoryRow>
          rowKey="approvalId"
          columns={columns}
          dataSource={rows}
          loading={listQuery.isLoading}
          search={false}
          options={false}
          dateFormatter="string"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${listQuery.data?.total ?? total} 条`,
          }}
          toolBarRender={() => [
            <Button
              key="export"
              type="primary"
              icon={<DownloadOutlined />}
              disabled={rows.length === 0}
              onClick={handleExport}
            >
              导出报告
            </Button>,
          ]}
        />
      </Card>

      <Drawer
        title="审批详情"
        width={620}
        open={Boolean(detailRow)}
        onClose={() => setDetailRow(undefined)}
      >
        {detailRow ? (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="审批编号">{detailRow.approvalNo}</Descriptions.Item>
            <Descriptions.Item label="审批类型">
              {APPROVAL_TYPE_MAP[detailRow.approvalType]}
            </Descriptions.Item>
            <Descriptions.Item label="申请人">{detailRow.applicantName}</Descriptions.Item>
            <Descriptions.Item label="所属租户">{detailRow.tenantName ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="业务摘要">{detailRow.bizSummary ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="提交时间">{detailRow.submittedAt}</Descriptions.Item>
            <Descriptions.Item label="审批结果">
              {detailRow.status === 2 ? <Tag color="success">通过</Tag> : <Tag color="error">驳回</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="审批人">{detailRow.approverName}</Descriptions.Item>
            <Descriptions.Item label="审批时间">{detailRow.approvedAt}</Descriptions.Item>
            <Descriptions.Item label="审批耗时">{detailRow.durationHours} 小时</Descriptions.Item>
            <Descriptions.Item label="审批意见">{detailRow.approveRemark ?? '—'}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Drawer>
    </Space>
  )
}
