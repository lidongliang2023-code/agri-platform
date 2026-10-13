import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Col, Form, Input, Modal, Popconfirm, Row, Select, Space, Table, Tag, message } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { auditRefund, getAdminRefundPage } from '@/api/admin'
import { getCurrentUser } from '@/utils/session'

interface RefundRow {
  id: number
  refundNo: string
  orderId: number
  orderNo: string
  refundType: string
  refundAmount: number
  refundReason: string
  applicantName: string
  refundStatus: string
  reviewer: string
  reviewTime: string
  reviewRemark: string
  createTime: string
}

const STATUS: Record<string, { text: string; color: string }> = {
  pending: { text: '待审核', color: 'warning' },
  approved: { text: '已通过', color: 'success' },
  rejected: { text: '已驳回', color: 'error' },
  cancelled: { text: '已撤销', color: 'default' }
}

/**
 * 退款审核（运营端）。
 *
 * <p>退款记录此前只有"申请"与"审核"两个写接口、**没有任何列表入口** ——
 * 运营端看不到有哪些退款等着审。本页补上列表，并把结果讲清楚：
 * 通过 → 订单置为 refunded 并累加已退金额；驳回 → 只改退款单，不动订单。</p>
 */
export default function AdminRefund() {
  const [rows, setRows] = useState<RefundRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [pageNum, setPageNum] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [status, setStatus] = useState('pending')
  const [keyword, setKeyword] = useState('')
  const [current, setCurrent] = useState<RefundRow | null>(null)
  const [form] = Form.useForm()

  const load = useCallback(() => {
    setLoading(true)
    getAdminRefundPage({ pageNum, pageSize, refundStatus: status || undefined, keyword: keyword || undefined })
      .then((res: { code: number; data?: { records?: RefundRow[]; total?: number }; message?: string }) => {
        if (res?.code === 200) {
          setRows(res.data?.records ?? [])
          setTotal(res.data?.total ?? 0)
        } else {
          message.error(res?.message ?? '加载退款单失败')
        }
      })
      .catch(() => message.error('加载退款单失败（检查后端是否在运行）'))
      .finally(() => setLoading(false))
  }, [pageNum, pageSize, status, keyword])

  useEffect(() => {
    load()
  }, [load])

  const doAudit = async (row: RefundRow, approved: boolean, remark?: string) => {
    const reviewer = getCurrentUser()?.nickname ?? getCurrentUser()?.username ?? '运营'
    const res = await auditRefund(row.id, approved ? 'approved' : 'rejected', reviewer, remark)
    if (res?.code === 200) {
      message.success(approved ? '已通过，订单将置为已退款' : '已驳回')
      setCurrent(null)
      form.resetFields()
      load()
    } else {
      message.error(res?.message ?? '审核失败')
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col flex="180px">
            <Select
              value={status}
              style={{ width: '100%' }}
              onChange={(value) => {
                setPageNum(1)
                setStatus(value)
              }}
              options={[
                { value: 'pending', label: '待审核' },
                { value: 'approved', label: '已通过' },
                { value: 'rejected', label: '已驳回' },
                { value: '', label: '全部状态' }
              ]}
            />
          </Col>
          <Col flex="280px">
            <Input.Search
              allowClear
              placeholder="退款单号 / 订单号 / 申请人"
              onSearch={(value) => {
                setPageNum(1)
                setKeyword(value)
              }}
            />
          </Col>
          <Col flex="auto">
            <Button icon={<ReloadOutlined />} onClick={load}>
              刷新
            </Button>
          </Col>
        </Row>
      </Card>

      <Card title={`退款单 ${total} 条`}>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={rows}
          scroll={{ x: 1200 }}
          pagination={{
            current: pageNum,
            pageSize,
            total,
            showSizeChanger: true,
            onChange: (page, size) => {
              setPageNum(page)
              setPageSize(size)
            }
          }}
          columns={[
            { title: '退款单号', dataIndex: 'refundNo', width: 160 },
            { title: '关联订单', dataIndex: 'orderNo', width: 170 },
            { title: '申请人', dataIndex: 'applicantName', width: 140 },
            {
              title: '退款类型',
              dataIndex: 'refundType',
              width: 100,
              render: (val: string) => (val === 'full' ? '全额' : val === 'partial' ? '部分' : val ?? '—')
            },
            { title: '退款金额', dataIndex: 'refundAmount', width: 120, render: (val: number) => `¥${val}` },
            {
              title: '退款原因',
              dataIndex: 'refundReason',
              width: 240,
              ellipsis: true,
              render: (val: string) => val || '—'
            },
            {
              title: '状态',
              dataIndex: 'refundStatus',
              width: 100,
              render: (val: string) => {
                const tag = STATUS[val] ?? { text: val, color: 'default' }
                return <Tag color={tag.color}>{tag.text}</Tag>
              }
            },
            {
              title: '审核记录',
              width: 220,
              render: (_: unknown, row: RefundRow) =>
                row.reviewer
                  ? `${row.reviewer} / ${row.reviewTime ?? ''}${row.reviewRemark ? ' / ' + row.reviewRemark : ''}`
                  : '—'
            },
            { title: '申请时间', dataIndex: 'createTime', width: 170 },
            {
              title: '操作',
              width: 150,
              fixed: 'right',
              render: (_: unknown, row: RefundRow) =>
                row.refundStatus === 'pending' ? (
                  <Space size="small">
                    <Popconfirm
                      title="通过后订单将置为已退款并累加已退金额，确认？"
                      onConfirm={() => doAudit(row, true, '审核通过')}
                    >
                      <Button type="link" size="small">
                        通过
                      </Button>
                    </Popconfirm>
                    <Button type="link" size="small" danger onClick={() => setCurrent(row)}>
                      驳回
                    </Button>
                  </Space>
                ) : (
                  <span style={{ color: '#a0aec0' }}>已处理</span>
                )
            }
          ]}
        />
      </Card>

      <Modal
        open={Boolean(current)}
        title={`驳回退款：${current?.refundNo ?? ''}`}
        onCancel={() => setCurrent(null)}
        onOk={() => form.submit()}
        okText="确认驳回"
        okButtonProps={{ danger: true }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values: { remark: string }) => current && doAudit(current, false, values.remark)}
        >
          <Form.Item
            label="驳回原因（会作为审核备注留痕）"
            name="remark"
            rules={[{ required: true, message: '请填写驳回原因' }]}
          >
            <Input.TextArea rows={3} placeholder="例如：商品已签收且无质量证据，不符合退款条件" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
