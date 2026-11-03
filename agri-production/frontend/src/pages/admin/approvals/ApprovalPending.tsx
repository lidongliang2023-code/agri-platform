/**
 * 页面名称：待审批列表
 * 路由路径：/admin/production/approvals
 * 所属模块：审批管理
 *
 * 交互说明：
 * - 列表读取运营审批台账，支持审批编号、业务类型、申请时间筛选；
 * - 支持勾选后批量通过 / 批量驳回，行内提供通过 / 驳回 / 详情；
 * - 审批意见必填，结果由后端写回审批单及关联业务；
 * - 后端不可用时明确报错，不降级为演示数据。
 */
import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import {
  Alert,
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

/** 审批业务类型（与后端 biz_type 同一词表） */
type ApprovalBizType = 'PLAN' | 'CERT' | 'QUOTA' | 'RECALL' | string

/** 运营端审批行模型 */
interface ApprovalRow extends Omit<Approval, 'approvalType'> {
  /** 后端业务类型 */
  bizType: ApprovalBizType
  /** 申请对象/业务摘要 */
  targetName?: string
}

/** 审批类型文案 */
const BIZ_TYPE_MAP: Record<string, string> = {
  PLAN: '种养计划',
  CERT: '认证申请',
  QUOTA: '配额调整',
  RECALL: '召回申请',
}

/** 查询条件 */
interface FilterState {
  approvalNo?: string
  bizType?: ApprovalBizType
  dateRange?: [string, string]
}

/** 后端状态可能是数字或字符串，统一成页面数字口径 */
function normalizeApprovalStatus(value: unknown): number {
  const text = String(value ?? '').toUpperCase()
  if (text === 'APPROVED' || text === '2') return 2
  if (text === 'REJECTED' || text === '3') return 3
  if (text === 'WITHDRAWN' || text === '4') return 4
  return 1
}

/** 把后端审批实体转换成页面行，不在这里补任何演示值 */
function toApprovalRow(item: Approval): ApprovalRow {
  const record = item as Approval & Record<string, unknown>
  const bizType = String(record.bizType ?? '')
  return {
    ...item,
    approvalNo: String(record.approvalNo ?? record.approvalId ?? ''),
    bizType,
    targetName: String(record.title ?? record.bizSummary ?? bizType ?? '—'),
    applicantName: String(record.applicantName ?? '—'),
    status: normalizeApprovalStatus(record.status) as Approval['status'],
    submittedAt: String(record.submitAt ?? record.submittedAt ?? record.createdAt ?? ''),
  }
}

/** 审批确认弹窗状态 */
interface ApproveModalState {
  open: boolean
  current?: ApprovalRow
  defaultAction: 'approve' | 'reject'
  ids: string[]
}

export default function ApprovalPending(): JSX.Element {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [form] = Form.useForm<FilterState>()
  const [approveForm] = Form.useForm<{ remark: string }>()
  const [filters, setFilters] = useState<FilterState>({})
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [rows, setRows] = useState<ApprovalRow[]>([])
  const [detailRow, setDetailRow] = useState<ApprovalRow | undefined>(undefined)
  const [modalState, setModalState] = useState<ApproveModalState>({
    open: false,
    defaultAction: 'approve',
    ids: [],
  })

  const listQuery = useQuery({
    queryKey: ['admin-approvals-pending', filters],
    queryFn: async (): Promise<ApprovalRow[]> => {
      const page: PageResult<Approval> = await listApprovals({
        pageNum: 1,
        pageSize: 200,
        approvalType: filters.bizType,
        status: 1,
        keyword: filters.approvalNo,
      })
      const serverRows = (page.list ?? []).map(toApprovalRow).filter((row) => row.status === 1)
      if (!filters.dateRange) return serverRows
      const [from, to] = filters.dateRange
      return serverRows.filter((row) => {
        const day = dayjs(row.submittedAt)
        return day.isValid()
          && !day.isBefore(dayjs(from).startOf('day'))
          && !day.isAfter(dayjs(to).endOf('day'))
      })
    },
    retry: 1,
  })

  useEffect(() => {
    setRows(listQuery.data ?? [])
    setSelectedKeys([])
  }, [listQuery.data])

  const stats = useMemo(() => ({
    total: rows.length,
    plan: rows.filter((item) => item.bizType === 'PLAN').length,
    cert: rows.filter((item) => item.bizType === 'CERT').length,
    quota: rows.filter((item) => item.bizType === 'QUOTA').length,
    recall: rows.filter((item) => item.bizType === 'RECALL').length,
  }), [rows])

  const approveMutation = useMutation({
    mutationFn: async (payload: { ids: string[]; action: 'approve' | 'reject'; remark: string }) => {
      if (payload.action === 'approve') {
        if (payload.ids.length === 1) await approveApproval(payload.ids[0], { remark: payload.remark })
        else await batchApprove(payload.ids, { remark: payload.remark })
      } else {
        await Promise.all(payload.ids.map((id) => rejectApproval(id, { remark: payload.remark })))
      }
    },
    onSuccess: (_data, payload) => {
      message.success(payload.action === 'approve' ? '审批已通过，关联业务已回写' : '审批已驳回，关联业务已回写')
      setModalState({ open: false, defaultAction: 'approve', ids: [] })
      void queryClient.invalidateQueries({ queryKey: ['admin-approvals-pending'] })
    },
    onError: (error: Error) => {
      message.error(error.message || '审批处理失败，请稍后重试')
    },
  })

  const openApproveModal = (row: ApprovalRow | undefined, action: 'approve' | 'reject'): void => {
    approveForm.resetFields()
    setModalState({ open: true, current: row, defaultAction: action, ids: row ? [row.approvalId] : selectedKeys })
  }

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
  }

  const columns: ProColumns<ApprovalRow>[] = [
    {
      title: '审批编号',
      dataIndex: 'approvalNo',
      width: 190,
      render: (_, row) => (
        <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setDetailRow(row)}>
          {row.approvalNo}
        </Button>
      ),
    },
    {
      title: '类型',
      dataIndex: 'bizType',
      width: 120,
      render: (_, row) => <Tag color="geekblue">{BIZ_TYPE_MAP[row.bizType] ?? row.bizType ?? '未指定'}</Tag>,
    },
    {
      title: '申请对象',
      dataIndex: 'targetName',
      width: 260,
      render: (_, row) => row.targetName ?? row.tenantName ?? '—',
    },
    { title: '申请人', dataIndex: 'applicantName', width: 110 },
    { title: '业务 ID', dataIndex: 'bizId', width: 160 },
    { title: '申请时间', dataIndex: 'submittedAt', width: 170 },
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
          <Button type="link" size="small" icon={<CheckCircleOutlined />} onClick={() => openApproveModal(row, 'approve')}>
            通过
          </Button>
          <Button type="link" size="small" danger icon={<CloseCircleOutlined />} onClick={() => openApproveModal(row, 'reject')}>
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
      {listQuery.isError ? (
        <Alert
          type="error"
          showIcon
          message="审批台账加载失败"
          description={(listQuery.error as Error)?.message ?? '后端审批接口不可用，请检查 agri-production 服务。'}
        />
      ) : null}

      <Row gutter={16}>
        <Col span={4}><Card><Statistic title="待审批总数" value={stats.total} valueStyle={{ color: '#1677ff' }} /></Card></Col>
        <Col span={5}><Card><Statistic title="种养计划" value={stats.plan} /></Card></Col>
        <Col span={5}><Card><Statistic title="认证申请" value={stats.cert} /></Card></Col>
        <Col span={5}><Card><Statistic title="配额调整" value={stats.quota} /></Card></Col>
        <Col span={5}><Card><Statistic title="召回申请" value={stats.recall} /></Card></Col>
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
          <Form.Item name="bizType" label="类型">
            <Select
              allowClear
              placeholder="全部"
              style={{ width: 150 }}
              options={[
                { value: 'PLAN', label: '种养计划' },
                { value: 'CERT', label: '认证申请' },
                { value: 'QUOTA', label: '配额调整' },
                { value: 'RECALL', label: '召回申请' },
              ]}
            />
          </Form.Item>
          <Form.Item name="dateRange" label="申请时间">
            <DatePicker.RangePicker />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">查询</Button>
              <Button onClick={() => { form.resetFields(); setFilters({}) }}>重置</Button>
              <Button icon={<ReloadOutlined />} onClick={() => void queryClient.invalidateQueries({ queryKey: ['admin-approvals-pending'] })}>
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
              <Button size="small" type="primary" disabled={selectedKeys.length === 0} onClick={() => openApproveModal(undefined, 'approve')}>
                批量通过
              </Button>
              <Button size="small" danger disabled={selectedKeys.length === 0} onClick={() => openApproveModal(undefined, 'reject')}>
                批量驳回
              </Button>
              <Button size="small" type="link" onClick={() => setSelectedKeys([])}>清空选择</Button>
            </Space>
          )}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
          toolBarRender={() => [
            <Typography.Text key="tip" type="secondary">
              审批结果会写回审批单及关联业务；驳回必须填写原因
            </Typography.Text>,
          ]}
        />
      </Card>

      <Modal
        title="审批确认"
        open={modalState.open}
        width={640}
        onCancel={() => setModalState({ open: false, defaultAction: 'approve', ids: [] })}
        footer={[
          <Button key="cancel" onClick={() => setModalState({ open: false, defaultAction: 'approve', ids: [] })}>取消</Button>,
          <Button key="reject" danger loading={approveMutation.isPending && modalState.defaultAction === 'reject'} onClick={() => void handleModalSubmit('reject')}>
            驳回
          </Button>,
          <Button key="approve" type="primary" loading={approveMutation.isPending && modalState.defaultAction === 'approve'} onClick={() => void handleModalSubmit('approve')}>
            通过
          </Button>,
        ]}
      >
        <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
          <Descriptions.Item label="审批编号">{modalState.current?.approvalNo ?? `批量审批 ${modalState.ids.length} 项`}</Descriptions.Item>
          <Descriptions.Item label="类型">{modalState.current ? BIZ_TYPE_MAP[modalState.current.bizType] ?? modalState.current.bizType : '多类型'}</Descriptions.Item>
          <Descriptions.Item label="申请人">{modalState.current?.applicantName ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="申请对象">{modalState.current?.targetName ?? modalState.current?.tenantName ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="申请时间">{modalState.current?.submittedAt ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="业务 ID">{modalState.current?.bizId ?? '—'}</Descriptions.Item>
        </Descriptions>
        <Form form={approveForm} layout="vertical">
          <Form.Item name="remark" label="审批意见" rules={[{ required: true, message: '请填写审批意见' }]}>
            <Input.TextArea rows={4} placeholder="请填写审批意见（必填）" maxLength={300} showCount />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="审批详情"
        width={620}
        open={Boolean(detailRow)}
        onClose={() => setDetailRow(undefined)}
        extra={detailRow ? (
          <Space>
            <Button type="primary" onClick={() => { const target = detailRow; setDetailRow(undefined); openApproveModal(target, 'approve') }}>
              通过
            </Button>
            <Button danger onClick={() => { const target = detailRow; setDetailRow(undefined); openApproveModal(target, 'reject') }}>
              驳回
            </Button>
          </Space>
        ) : null}
      >
        {detailRow ? (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="审批编号">{detailRow.approvalNo}</Descriptions.Item>
            <Descriptions.Item label="审批类型">{BIZ_TYPE_MAP[detailRow.bizType] ?? detailRow.bizType ?? '未指定'}</Descriptions.Item>
            <Descriptions.Item label="业务 ID">{detailRow.bizId}</Descriptions.Item>
            <Descriptions.Item label="申请人">{detailRow.applicantName}</Descriptions.Item>
            <Descriptions.Item label="申请对象">{detailRow.targetName ?? detailRow.tenantName ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="提交时间">{detailRow.submittedAt}</Descriptions.Item>
            <Descriptions.Item label="审批状态"><Tag color="processing">待审批</Tag></Descriptions.Item>
          </Descriptions>
        ) : null}
      </Drawer>
    </Space>
  )
}
