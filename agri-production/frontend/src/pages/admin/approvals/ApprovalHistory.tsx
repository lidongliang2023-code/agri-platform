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
  Alert,
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
} from 'antd'
import { ProTable } from '@ant-design/pro-components'
import type { ProColumns } from '@ant-design/pro-components'
import { DownloadOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listApprovalHistory } from '@/api'
import type { Approval, PageResult } from '@/types'

/**
 * 审批业务类型。
 *
 * 后端 `prod_approval.biz_type` 是**字符串枚举**（CERT / RECALL / QUOTA），
 * 并非前端原先假设的数字 1~4；按数字口径取值会得到 undefined。
 */
type AdminApprovalType = string

/** 前端展示编码：通过 */
const STATUS_APPROVED = 2
/** 前端展示编码：驳回 */
const STATUS_REJECTED = 3

/**
 * 后端状态字符串 → 前端展示编码。
 *
 * `prod_approval.status` 实际取值为 `APPROVED` / `PENDING` / `REJECTED`。
 * 历史页原先用 `item.status === 2 || item.status === 3` 过滤，
 * 字符串与数字严格比较恒为 false，于是「接口返回 2 条、页面渲染 0 行」（D2 根因）。
 */
const STATUS_CODE_BY_SERVER: Record<string, 2 | 3> = {
  APPROVED: STATUS_APPROVED,
  REJECTED: STATUS_REJECTED,
}

/** 审批业务类型文案（兼容后端字符串枚举与旧数字口径） */
const BIZ_TYPE_LABEL: Record<string, string> = {
  CERT: '认证申请',
  QUOTA: '配额调整',
  RECALL: '召回申请',
  1: '主体注册',
  2: '配额调整',
  3: '农场停用',
  4: '数据导出',
}

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
  /** 所属主体 */
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

/** 业务类型下拉选项：取后端真实枚举值，避免出现永远匹配不上的选项 */
const BIZ_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'CERT', label: '认证申请' },
  { value: 'QUOTA', label: '配额调整' },
  { value: 'RECALL', label: '召回申请' },
]

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
  const [detailRow, setDetailRow] = useState<HistoryRow | undefined>(undefined)

  const listQuery = useQuery({
    queryKey: ['admin-approvals-history', filters],
    // 不再 try/catch 兜底到演示数据：请求失败时让 react-query 进入 isError，
    // 页面显式报错。后端挂了就显示 32 条编造的审批记录，比显示 0 条危险得多——
    // 那会让验收把假数据当成真实链路跑通。
    queryFn: async (): Promise<{ rows: HistoryRow[]; total: number }> => {
      const page: PageResult<Approval> = await listApprovalHistory({
          pageNum: 1,
          pageSize: 500,
          approvalType: filters.approvalType,
          status: filters.status,
          keyword: filters.approvalNo,
        })
        // 接口正常返回即采信真实数据：即使 list 为空也是真实结果，
        // 不再因为「0 条」就掉进演示数据分支（那会让页面拿编造的 32 行冒充真实数据）。
        if (page && Array.isArray(page.list)) {
          const serverRows = page.list
            .map<HistoryRow | null>((item) => {
              // 后端状态是字符串枚举，先归一化成前端展示编码
              const code = STATUS_CODE_BY_SERVER[String(item.status).toUpperCase()]
              if (!code) {
                return null
              }
              const submittedRaw = item.submitAt ?? item.submittedAt ?? ''
              const approvedRaw = item.approveAt ?? item.approvedAt ?? submittedRaw
              return {
                approvalId: item.approvalId,
                // 后端没有 approvalNo 字段，用业务主键承担「审批编号」展示职责
                approvalNo: item.approvalNo ?? item.approvalId,
                approvalType: item.bizType ?? String(item.approvalType ?? ''),
                applicantName: item.applicantName ?? '—',
                tenantName: item.tenantName,
                bizSummary: item.title ?? item.bizSummary,
                status: code,
                approverName: item.approverName ?? item.currentApproverId ?? '—',
                approveRemark: item.approveOpinion ?? item.approveRemark,
                submittedAt: submittedRaw ? dayjs(submittedRaw).format('YYYY-MM-DD HH:mm') : '—',
                approvedAt: approvedRaw ? dayjs(approvedRaw).format('YYYY-MM-DD HH:mm') : '—',
                durationHours: Number(
                  ((dayjs(approvedRaw).valueOf() - dayjs(submittedRaw).valueOf()) / 3600000).toFixed(1),
                ),
              }
            })
            .filter((row): row is HistoryRow => row !== null)
            // 后端 `history()` 只绑定 page / size，approvalType / status / keyword
            // 传过去会被静默忽略。为使筛选器真的生效、不出现「点了筛选没反应」，
            // 这里在前端按真实字段再过滤一遍。
            .filter((row) => {
              if (filters.approvalType && row.approvalType !== filters.approvalType) {
                return false
              }
              if (filters.status && row.status !== filters.status) {
                return false
              }
              if (filters.approverName && row.approverName !== filters.approverName) {
                return false
              }
              if (filters.approvalNo && !row.approvalNo.includes(filters.approvalNo)) {
                return false
              }
              return true
            })
          return { rows: serverRows, total: serverRows.length }
        }
        return { rows: [], total: 0 }
      },
    retry: false,
  })

  useEffect(() => {
    if (listQuery.data) {
      setRows(listQuery.data.rows)
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
    const header = ['审批编号', '类型', '申请人', '所属主体', '审批结果', '审批人', '审批时间', '耗时(小时)', '审批意见']
    const body = rows.map((row) => [
      row.approvalNo,
      BIZ_TYPE_LABEL[row.approvalType] ?? row.approvalType,
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
      render: (_, row) => (
        <Tag color="geekblue">{BIZ_TYPE_LABEL[row.approvalType] ?? row.approvalType}</Tag>
      ),
    },
    { title: '申请人', dataIndex: 'applicantName', width: 100 },
    {
      title: '所属主体',
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
      {listQuery.isError ? (
        <Alert
          type="error"
          showIcon
          message="审批历史接口请求失败"
          description="后端 /admin/approvals/history 未返回数据，请检查后端服务后重试。页面不会用示例数据填充。"
          action={
            <Button size="small" icon={<ReloadOutlined />} onClick={() => void listQuery.refetch()}>
              重试
            </Button>
          }
        />
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
              options={BIZ_TYPE_OPTIONS}
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
          locale={{
            emptyText: listQuery.isError
              ? '审批历史接口请求失败，暂无可展示数据'
              : '后端暂无审批历史数据（当前筛选条件下无记录）',
          }}
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
              {BIZ_TYPE_LABEL[detailRow.approvalType] ?? detailRow.approvalType}
            </Descriptions.Item>
            <Descriptions.Item label="申请人">{detailRow.applicantName}</Descriptions.Item>
            <Descriptions.Item label="所属主体">{detailRow.tenantName ?? '—'}</Descriptions.Item>
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
