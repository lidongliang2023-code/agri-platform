import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Col, Form, Input, Modal, Popconfirm, Row, Select, Space, Table, Tag, message } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { getAdminCompensationPage, reviewCompensation } from '@/api/admin'
import { getCurrentUser } from '@/utils/session'

interface CompensationRow {
  id: number
  compensationNo: string
  orderId: number
  orderNo: string
  compensationType: string
  compensationReason: string
  applicantName: string
  recipientName: string
  compensationAmount: number
  compensationStatus: string
  reviewer: string
  reviewResult: string
  payTime: string
  transactionId: string
  createTime: string
}

const STATUS: Record<string, { text: string; color: string }> = {
  pending: { text: '待审核', color: 'warning' },
  approved: { text: '已核准待打款', color: 'processing' },
  rejected: { text: '已驳回', color: 'error' },
  paid: { text: '已打款', color: 'success' }
}

/**
 * 赔付执行（运营端）。
 *
 * <p>页面只给一个"核准并打款"动作，这不是偷懒，而是照着后端实际行为做的：
 * `CompensationServiceImpl.reviewCompensation` 在审核结果为 approved 时，
 * 末尾会直接调用 `executeCompensation` —— 核准与打款在后端是同一次调用完成的，
 * 单据在核准返回时已经是 paid 并带了打款流水号。</p>
 *
 * <p>所以这里不能再放一个独立的"打款"按钮：点下去时单据已是 paid，
 * execute 的状态守卫会返回 false，界面报"执行失败"，而钱其实早就出去了 ——
 * 一个必然失败、且失败信息与事实相反的按钮，比没有按钮更糟。
 * "审批与付款应当分离"属财务口径的改进，涉及资金流程，已记在待办里而不是顺手改。</p>
 */
export default function AdminCompensation() {
  const [rows, setRows] = useState<CompensationRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [pageNum, setPageNum] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [status, setStatus] = useState('pending')
  const [keyword, setKeyword] = useState('')
  const [current, setCurrent] = useState<CompensationRow | null>(null)
  const [form] = Form.useForm()

  const load = useCallback(() => {
    setLoading(true)
    getAdminCompensationPage({
      pageNum,
      pageSize,
      compensationStatus: status || undefined,
      keyword: keyword || undefined
    })
      .then((res: { code: number; data?: { records?: CompensationRow[]; total?: number }; message?: string }) => {
        if (res?.code === 200) {
          setRows(res.data?.records ?? [])
          setTotal(res.data?.total ?? 0)
        } else {
          message.error(res?.message ?? '加载赔付单失败')
        }
      })
      .catch(() => message.error('加载赔付单失败（检查后端是否在运行）'))
      .finally(() => setLoading(false))
  }, [pageNum, pageSize, status, keyword])

  useEffect(() => {
    load()
  }, [load])

  const review = async (row: CompensationRow, approved: boolean, remark?: string) => {
    const reviewer = getCurrentUser()?.nickname ?? getCurrentUser()?.username ?? '运营'
    const res = await reviewCompensation(row.id, approved ? 'approved' : 'rejected', reviewer, remark)
    if (res?.code === 200) {
      message.success(approved ? '已核准，待打款' : '已驳回')
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
          <Col flex="200px">
            <Select
              value={status}
              style={{ width: '100%' }}
              onChange={(value) => {
                setPageNum(1)
                setStatus(value)
              }}
              options={[
                { value: 'pending', label: '待审核' },
                { value: 'approved', label: '已核准待打款' },
                { value: 'paid', label: '已打款' },
                { value: 'rejected', label: '已驳回' },
                { value: '', label: '全部状态' }
              ]}
            />
          </Col>
          <Col flex="280px">
            <Input.Search
              allowClear
              placeholder="赔付单号 / 订单号 / 收款方"
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

      <Card title={`赔付单 ${total} 条`}>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={rows}
          scroll={{ x: 1250 }}
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
            { title: '赔付单号', dataIndex: 'compensationNo', width: 160 },
            { title: '关联订单', dataIndex: 'orderNo', width: 160 },
            { title: '申请人', dataIndex: 'applicantName', width: 150 },
            { title: '收款方', dataIndex: 'recipientName', width: 150 },
            { title: '赔付金额', dataIndex: 'compensationAmount', width: 120, render: (val: number) => `¥${val}` },
            {
              title: '赔付事由',
              dataIndex: 'compensationReason',
              width: 220,
              ellipsis: true,
              render: (val: string) => val || '—'
            },
            {
              title: '状态',
              dataIndex: 'compensationStatus',
              width: 130,
              render: (val: string) => {
                const tag = STATUS[val] ?? { text: val, color: 'default' }
                return <Tag color={tag.color}>{tag.text}</Tag>
              }
            },
            {
              title: '审核 / 打款',
              width: 280,
              render: (_: unknown, row: CompensationRow) =>
                [
                  row.reviewer && `审核:${row.reviewer}/${row.reviewResult ?? ''}`,
                  row.payTime && `打款:${row.payTime}`,
                  row.transactionId && `流水:${row.transactionId}`
                ]
                  .filter(Boolean)
                  .join('　') || '—'
            },
            { title: '申请时间', dataIndex: 'createTime', width: 170 },
            {
              title: '操作',
              width: 170,
              fixed: 'right',
              render: (_: unknown, row: CompensationRow) => {
                if (row.compensationStatus === 'pending') {
                  return (
                    <Space size="small">
                      <Popconfirm
                        title={`核准后将立即打款 ¥${row.compensationAmount} 给「${row.recipientName}」，确认？`}
                        onConfirm={() => review(row, true, '审核通过')}
                      >
                        <Button type="link" size="small">
                          核准并打款
                        </Button>
                      </Popconfirm>
                      <Button type="link" size="small" danger onClick={() => setCurrent(row)}>
                        驳回
                      </Button>
                    </Space>
                  )
                }
                return <span style={{ color: '#a0aec0' }}>已完结</span>
              }
            }
          ]}
        />
      </Card>

      <Modal
        open={Boolean(current)}
        title={`驳回赔付：${current?.compensationNo ?? ''}`}
        onCancel={() => setCurrent(null)}
        onOk={() => form.submit()}
        okText="确认驳回"
        okButtonProps={{ danger: true }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values: { remark: string }) => current && review(current, false, values.remark)}
        >
          <Form.Item
            label="驳回原因（会作为审核备注留痕）"
            name="remark"
            rules={[{ required: true, message: '请填写驳回原因' }]}
          >
            <Input.TextArea rows={3} placeholder="例如：责任认定尚未完成，暂不予赔付" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
