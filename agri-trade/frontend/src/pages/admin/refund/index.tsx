import { useCallback, useEffect, useState } from 'react'
import { Button, Form, Input, Modal, Popconfirm, Select, Tag, message } from 'antd'
import { ListRowActions } from '@agri/shared'
import { auditRefund, getAdminRefundPage } from '@/api/admin'
import { TradeFilters, TradeList } from '@/components/TradeList'

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
 * <p>通过 → 订单置为 refunded 并累加已退金额；驳回 → 只改退款单，不动订单。</p>
 */
export default function AdminRefund() {
  const [rows, setRows] = useState<RefundRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [pageNum, setPageNum] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [status, setStatus] = useState('pending')
  const [keyword, setKeyword] = useState('')
  const [draftStatus, setDraftStatus] = useState('pending')
  const [draftKeyword, setDraftKeyword] = useState('')
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

  const handleQuery = () => {
    setPageNum(1)
    setStatus(draftStatus)
    setKeyword(draftKeyword.trim())
  }

  const handleReset = () => {
    setDraftStatus('pending')
    setDraftKeyword('')
    setPageNum(1)
    setStatus('pending')
    setKeyword('')
  }

  const doAudit = async (row: RefundRow, approved: boolean, remark?: string) => {
    const res = await auditRefund(row.id, approved ? 'approved' : 'rejected', remark)
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
      <TradeList<RefundRow>
        listId="admin-refund"
        rowKey="id"
        loading={loading}
        dataSource={rows}
        onRefresh={load}
        toolbarLeft={<span style={{ fontWeight: 600 }}>退款单（共 {total} 条）</span>}
        filterSlot={(
          <TradeFilters
            loading={loading}
            onQuery={handleQuery}
            onReset={handleReset}
            fields={[
              {
                label: '退款状态',
                control: (
                  <Select
                    value={draftStatus}
                    onChange={(value) => {
                      setDraftStatus(value)
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
                ),
              },
              {
                label: '关键字',
                control: (
                  <Input
                    allowClear
                    value={draftKeyword}
                    placeholder="退款单号 / 订单号 / 申请人"
                    onChange={(e) => setDraftKeyword(e.target.value)}
                    onPressEnter={handleQuery}
                  />
                ),
              },
            ]}
          />
        )}
        pagination={{
          current: pageNum,
          pageSize,
          total,
          onChange: (page, size) => {
            setPageNum(page)
            setPageSize(size)
          },
        }}
        columns={[
          { title: '退款单号', dataIndex: 'refundNo', width: 160, ellipsis: true },
          { title: '关联订单', dataIndex: 'orderNo', width: 170, ellipsis: true },
          { title: '申请人', dataIndex: 'applicantName', width: 140, ellipsis: true },
          {
            title: '退款类型',
            dataIndex: 'refundType',
            width: 100,
            render: (val: string) => ({
              full: '全额退款',
              partial: '部分退款',
              refund_only: '仅退款',
              return_refund: '退货退款',
            } as Record<string, string>)[val] ?? val ?? '—'
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
            width: 104,
            render: (val: string) => {
              const tag = STATUS[val] ?? { text: val, color: 'default' }
              return <Tag color={tag.color}>{tag.text}</Tag>
            }
          },
          {
            title: '审核记录',
            key: 'reviewRecord',
            width: 220,
            ellipsis: true,
            render: (_: unknown, row: RefundRow) =>
              row.reviewer
                ? `${row.reviewer} / ${row.reviewTime ?? ''}${row.reviewRemark ? ' / ' + row.reviewRemark : ''}`
                : '—'
          },
          { title: '申请时间', dataIndex: 'createTime', width: 170 },
          {
            title: '操作',
            key: 'action',
            width: 140,
            render: (_: unknown, row: RefundRow) =>
              row.refundStatus === 'pending' ? (
                <ListRowActions>
                  <Popconfirm
                    title="通过后订单将置为已退款并累加已退金额，确认？"
                    onConfirm={() => doAudit(row, true, '审核通过')}
                  >
                    <Button type="link" size="small">通过</Button>
                  </Popconfirm>
                  <Button type="link" size="small" danger onClick={() => setCurrent(row)}>驳回</Button>
                </ListRowActions>
              ) : (
                <span style={{ color: '#a0aec0' }}>已处理</span>
              )
          }
        ]}
      />

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
