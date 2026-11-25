import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Tag, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { ListRowActions } from '@agri/shared'
import { createCompensation, executeCompensation, getAdminCompensationPage, getAdminDisputePage, reviewCompensation } from '@/api/admin'
import { getOrderList } from '@/api/order'
import { TradeFilters, TradeList } from '@/components/TradeList'

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

const COMPENSATION_TYPE: Record<string, string> = {
  delay: '交付延误',
  quality: '质量不符',
  quantity: '数量短缺',
  price: '价格争议',
  dispute: '纠纷裁定',
  other: '其他'
}

/**
 * 赔付执行（运营端）。
 */
export default function AdminCompensation() {
  const [rows, setRows] = useState<CompensationRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [pageNum, setPageNum] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [status, setStatus] = useState('pending')
  const [keyword, setKeyword] = useState('')
  const [draftStatus, setDraftStatus] = useState('pending')
  const [draftKeyword, setDraftKeyword] = useState('')
  const [current, setCurrent] = useState<CompensationRow | null>(null)
  const [form] = Form.useForm()
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [createForm] = Form.useForm()
  const [disputes, setDisputes] = useState<Array<{ id: number; disputeNo: string; claimAmount?: number; complainantName?: string }>>([])
  const [orders, setOrders] = useState<Array<{ id: number; orderNo?: string; productName?: string; totalAmount?: number }>>([])

  const openCreate = async () => {
    createForm.resetFields()
    setCreating(true)
    try {
      const res = await getAdminDisputePage({ pageNum: 1, pageSize: 50, disputeStatus: 'open' })
      if (res?.code === 200) setDisputes(res.data?.records ?? [])
    } catch {
      setDisputes([])
    }
    try {
      const res = await getOrderList({ pageNum: 1, pageSize: 100 })
      if (res?.code === 200) setOrders(res.data?.records ?? [])
    } catch {
      setOrders([])
    }
  }

  const submitCreate = async () => {
    const values = await createForm.validateFields()
    if (!values.disputeId && !values.orderId) {
      message.warning('请至少关联一场纠纷或一张订单')
      return
    }
    setSaving(true)
    try {
      const res = await createCompensation(values)
      if (res?.code === 200) {
        message.success('已建单，等核准')
        setCreating(false)
        createForm.resetFields()
        load()
      } else {
        message.error(res?.message ?? '建单失败')
      }
    } catch {
      message.error('建单失败（请检查后端是否在运行）')
    } finally {
      setSaving(false)
    }
  }

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

  const review = async (row: CompensationRow, approved: boolean, remark?: string) => {
    const res = await reviewCompensation(row.id, approved ? 'approved' : 'rejected', remark)
    if (res?.code === 200) {
      message.success(approved ? '已核准，待打款' : '已驳回')
      setCurrent(null)
      form.resetFields()
      load()
    } else {
      message.error(res?.message ?? '审核失败')
    }
  }

  const execute = async (row: CompensationRow) => {
    const res = await executeCompensation(row.id)
    if (res?.code === 200) {
      message.success('已打款')
      load()
    } else {
      message.error(res?.message ?? '打款失败')
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <TradeList<CompensationRow>
        listId="admin-compensation"
        rowKey="id"
        loading={loading}
        dataSource={rows}
        onRefresh={load}
        toolbarLeft={(
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新建赔付单
          </Button>
        )}
        filterSlot={(
          <TradeFilters
            loading={loading}
            onQuery={handleQuery}
            onReset={handleReset}
            fields={[
              {
                label: '赔付状态',
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
                      { value: 'approved', label: '已核准待打款' },
                      { value: 'paid', label: '已打款' },
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
                    placeholder="赔付单号 / 订单号 / 收款方"
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
          { title: '赔付单号', dataIndex: 'compensationNo', width: 160, ellipsis: true },
          { title: '关联订单', dataIndex: 'orderNo', width: 160, ellipsis: true },
          { title: '申请人', dataIndex: 'applicantName', width: 150, ellipsis: true },
          { title: '收款方', dataIndex: 'recipientName', width: 150, ellipsis: true },
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
            key: 'auditPay',
            width: 260,
            ellipsis: true,
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
            key: 'action',
            width: 140,
            render: (_: unknown, row: CompensationRow) => {
              if (row.compensationStatus === 'pending') {
                return (
                  <ListRowActions>
                    <Popconfirm title="核准后进入「待打款」，确认？" onConfirm={() => review(row, true, '审核通过')}>
                      <Button type="link" size="small">核准</Button>
                    </Popconfirm>
                    <Button type="link" size="small" danger onClick={() => setCurrent(row)}>驳回</Button>
                  </ListRowActions>
                )
              }
              if (row.compensationStatus === 'approved') {
                return (
                  <ListRowActions>
                    <Popconfirm
                      title={`确认打款 ¥${row.compensationAmount} 给「${row.recipientName}」？`}
                      onConfirm={() => execute(row)}
                    >
                      <Button type="link" size="small">打款</Button>
                    </Popconfirm>
                  </ListRowActions>
                )
              }
              return <span style={{ color: '#a0aec0' }}>已完结</span>
            }
          }
        ]}
      />

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

      <Modal
        title="新建赔付单"
        open={creating}
        onCancel={() => setCreating(false)}
        onOk={submitCreate}
        confirmLoading={saving}
        destroyOnClose
        width={640}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="仲裁判「支持申请人/部分支持」时，系统会自动落一张待审核的赔付单"
          description="这里用于手工补单（例如没有走纠纷的平台补偿）。挂了纠纷就以纠纷为准：同一场纠纷只能赔一次，订单与收款方由系统按纠纷推导；不挂纠纷时至少要挂一张订单，否则这笔钱进不了资金流水。"
        />
        <Form form={createForm} layout="vertical">
          <Form.Item
            name="disputeId"
            label="关联纠纷（可选）"
            extra="只列出未结纠纷；选了之后订单、收款方、申请人都按这单纠纷推导"
          >
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="不挂纠纷也可以，直接填下面的类型与金额"
              options={disputes.map((d) => ({
                value: d.id,
                label: `${d.disputeNo}　${d.complainantName ?? ''}　索赔 ¥${d.claimAmount ?? '—'}`
              }))}
            />
          </Form.Item>
          <Form.Item
            name="orderId"
            label="关联订单（可选）"
            extra="挂了纠纷时可以留空 —— 订单由纠纷自动带出"
          >
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="选择订单"
              options={orders.map((o) => ({
                value: o.id,
                label: `${o.orderNo ?? o.id}　${o.productName ?? ''}　¥${o.totalAmount ?? '—'}`
              }))}
            />
          </Form.Item>
          <Form.Item name="compensationType" label="赔付类型" rules={[{ required: true, message: '请选择类型' }]}>
            <Select
              placeholder="请选择"
              options={Object.entries(COMPENSATION_TYPE).map(([value, label]) => ({ value, label }))}
            />
          </Form.Item>
          <Form.Item name="amount" label="赔付金额（元）" rules={[{ required: true, message: '请填写金额' }]}>
            <InputNumber style={{ width: '100%' }} min={0.01} precision={2} placeholder="必须大于 0" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
