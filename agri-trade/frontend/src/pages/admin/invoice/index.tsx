import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Col, Form, Input, Modal, Popconfirm, Row, Select, Space, Table, Tag, message } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { getAdminInvoices, reviewInvoice, type InvoiceRow } from '@/api/invoice'

const INVOICE_STATUS: Record<string, { text: string; color: string }> = {
  pending: { text: '待开票', color: 'warning' },
  issued: { text: '已开票', color: 'success' },
  rejected: { text: '已驳回', color: 'error' },
}

export default function AdminInvoice() {
  const [rows, setRows] = useState<InvoiceRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [pageNum, setPageNum] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [status, setStatus] = useState('pending')
  const [keyword, setKeyword] = useState('')
  const [rejecting, setRejecting] = useState<InvoiceRow | null>(null)
  const [form] = Form.useForm<{ remark: string }>()

  const load = useCallback(() => {
    setLoading(true)
    getAdminInvoices({
      pageNum,
      pageSize,
      invoiceStatus: status || undefined,
      keyword: keyword || undefined,
    })
      .then((body) => {
        if (body?.code === 200) {
          setRows(body.data?.records ?? [])
          setTotal(body.data?.total ?? 0)
        } else {
          message.error(body?.message ?? '加载发票申请失败')
        }
      })
      .catch(() => message.error('加载发票申请失败（请检查后端是否在运行）'))
      .finally(() => setLoading(false))
  }, [keyword, pageNum, pageSize, status])

  useEffect(() => {
    load()
  }, [load])

  const handleIssue = async (row: InvoiceRow) => {
    const body = await reviewInvoice(row.id, 'issued', '运营审核通过并完成开票')
    if (body?.code === 200) {
      message.success('已开票')
      load()
    } else {
      message.error(body?.message ?? '开票失败')
    }
  }

  const handleReject = async () => {
    if (!rejecting) return
    const values = await form.validateFields()
    const body = await reviewInvoice(rejecting.id, 'rejected', values.remark)
    if (body?.code === 200) {
      message.success('已驳回')
      setRejecting(null)
      form.resetFields()
      load()
    } else {
      message.error(body?.message ?? '驳回失败')
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
                { value: 'pending', label: '待开票' },
                { value: 'issued', label: '已开票' },
                { value: 'rejected', label: '已驳回' },
                { value: '', label: '全部状态' },
              ]}
            />
          </Col>
          <Col flex="300px">
            <Input.Search
              allowClear
              placeholder="申请单号 / 订单号 / 采购方 / 发票抬头"
              onSearch={(value) => {
                setPageNum(1)
                setKeyword(value)
              }}
            />
          </Col>
          <Col flex="auto">
            <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
          </Col>
        </Row>
      </Card>

      <Card title={`发票申请 ${total} 条`}>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={rows}
          scroll={{ x: 1350 }}
          pagination={{
            current: pageNum,
            pageSize,
            total,
            showSizeChanger: true,
            onChange: (page, size) => {
              setPageNum(page)
              setPageSize(size)
            },
          }}
          columns={[
            { title: '申请单号', dataIndex: 'invoiceNo', width: 170 },
            { title: '订单号', dataIndex: 'orderNo', width: 170 },
            { title: '采购方', dataIndex: 'buyerName', width: 190 },
            { title: '发票抬头', dataIndex: 'title', width: 190 },
            { title: '税号', dataIndex: 'taxNo', width: 180, render: (value: string) => value || '—' },
            { title: '发票类型', dataIndex: 'invoiceType', width: 150 },
            { title: '开票金额', dataIndex: 'amount', width: 120, render: (value: number) => `¥${value}` },
            {
              title: '状态',
              dataIndex: 'invoiceStatus',
              width: 100,
              render: (value: string) => {
                const item = INVOICE_STATUS[value] ?? { text: value, color: 'default' }
                return <Tag color={item.color}>{item.text}</Tag>
              },
            },
            { title: '申请时间', dataIndex: 'applyTime', width: 170 },
            { title: '开票时间', dataIndex: 'issueTime', width: 170, render: (value: string) => value || '—' },
            { title: '备注', dataIndex: 'remark', width: 220, ellipsis: true, render: (value: string) => value || '—' },
            {
              title: '操作',
              width: 150,
              fixed: 'right',
              render: (_: unknown, row: InvoiceRow) => row.invoiceStatus === 'pending' ? (
                <Space size="small">
                  <Popconfirm title="确认完成开票？" onConfirm={() => void handleIssue(row)}>
                    <Button type="link" size="small">开票</Button>
                  </Popconfirm>
                  <Button type="link" size="small" danger onClick={() => setRejecting(row)}>驳回</Button>
                </Space>
              ) : (
                <span style={{ color: '#a0aec0' }}>已处理</span>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={`驳回发票申请：${rejecting?.invoiceNo ?? ''}`}
        open={Boolean(rejecting)}
        onCancel={() => setRejecting(null)}
        onOk={() => form.submit()}
        okText="确认驳回"
        okButtonProps={{ danger: true }}
      >
        <Form form={form} layout="vertical" onFinish={handleReject}>
          <Form.Item
            label="驳回原因"
            name="remark"
            rules={[{ required: true, message: '请填写驳回原因' }]}
          >
            <Input.TextArea rows={3} placeholder="例如：发票抬头与认证主体名称不一致" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
