import { useState, useEffect, useCallback } from 'react'
import { Alert, Card, Table, Button, Space, Tag, Modal, Form, Input, InputNumber, Select, DatePicker, message, Popconfirm, Typography } from 'antd'
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, CheckOutlined } from '@ant-design/icons'
import { getQuoteList, createQuote, updateQuote, deleteQuote, acceptQuote, convertQuoteToOrder, QuoteVO, QuoteQuery } from '@/api/quote'
import { getMyMerchants } from '@/api/identity'
import { getReceivedInquiries, quoteInquiry, type InquiryVO } from '@/api/inquiry'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'

const statusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'warning', text: '待审核' },
  approved: { color: 'success', text: '已通过' },
  rejected: { color: 'error', text: '已拒绝' },
  accepted: { color: 'processing', text: '已接受' },
  expired: { color: 'default', text: '已过期' },
}

/**
 * 质量等级入库时以中文标签存进 quality_description（表里没有独立的质量等级列）。
 * 编辑回填要把标签转回下拉框的取值 —— 否则下拉框匹配不上、显示为空，
 * 用户一保存就把原来的等级抹掉了。
 */
function qualityCode(label?: string): string | undefined {
  const map: Record<string, string> = { 特级: 'premium', 一级: 'level1', 二级: 'level2', 三级: 'level3' }
  return label ? map[label] ?? label : undefined
}

export default function QuoteList() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<QuoteVO[]>([])
  const [total, setTotal] = useState(0)
  const [queryParams, setQueryParams] = useState<QuoteQuery>({ pageNum: 1, pageSize: 10 })
  const [formVisible, setFormVisible] = useState(false)
  const [currentItem, setCurrentItem] = useState<QuoteVO | null>(null)
  const [form] = Form.useForm()
  // 我的经营主体：受理/生成订单是**采购方**的动作，服务端会校验；
  // 前端据此决定这两个按钮显不显示 —— 否则会出现"按钮点得动、点了被拒"的别扭状态。
  const [myMerchantIds, setMyMerchantIds] = useState<string[]>([])

  useEffect(() => {
    getMyMerchants()
      .then((res) => {
        if (res?.code === 200) {
          setMyMerchantIds((res.data ?? []).map((m) => String(m.merchantId)))
        }
      })
      .catch(() => setMyMerchantIds([]))
  }, [])

  const isMyQuoteAsBuyer = (record: QuoteVO) =>
    record.buyerId != null && myMerchantIds.includes(String(record.buyerId))

  // 收到的询价：采购方向我发起、等我报价的。没有这块，供应商在页面上看不到谁来问过价，
  // 整条"询价 → 报价 → 受理 → 订单"会在供应商响应这一步断掉。
  const [received, setReceived] = useState<InquiryVO[]>([])
  const [quoteOpen, setQuoteOpen] = useState<InquiryVO | null>(null)
  const [quoting, setQuoting] = useState(false)
  const [quoteForm] = Form.useForm()

  const loadReceived = useCallback(() => {
    getReceivedInquiries()
      .then((res: { code: number; data?: InquiryVO[] }) => {
        if (res?.code === 200) setReceived(res.data ?? [])
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    loadReceived()
  }, [loadReceived])

  const submitInquiryQuote = async () => {
    if (!quoteOpen) return
    const values = await quoteForm.validateFields()
    setQuoting(true)
    try {
      const res = await quoteInquiry({
        inquiryId: quoteOpen.id,
        unitPrice: values.unitPrice,
        quantity: values.quantity ?? quoteOpen.quantity,
        freightAmount: values.freightAmount,
        remark: values.remark
      })
      if (res?.code === 200) {
        message.success('已报价，采购方会在「报价管理」里看到并受理')
        setQuoteOpen(null)
        quoteForm.resetFields()
        loadData()
        loadReceived()
      } else {
        message.error(res?.message ?? '报价失败')
      }
    } catch {
      message.error('报价失败')
    } finally {
      setQuoting(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [queryParams])

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await getQuoteList(queryParams)
      if (res.code === 200) {
        setData(res.data?.records || [])
        setTotal(res.data?.total || 0)
      }
    } catch (error) {
      message.error('加载数据失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setQueryParams({ ...queryParams, pageNum: 1 })
  }

  const handleReset = () => {
    setQueryParams({ pageNum: 1, pageSize: 10 })
  }

  const handleAdd = () => {
    setCurrentItem(null)
    form.resetFields()
    setFormVisible(true)
  }

  const handleEdit = (record: QuoteVO) => {
    setCurrentItem(record)
    form.setFieldsValue({
      ...record,
      deliveryTime: record.deliveryTime ? dayjs(record.deliveryTime) : null,
      // 表单收的是"有效期(天)"，库里存的是绝对时间点 —— 编辑时把剩余天数反算回来。
      // 不反算的话，字段名对不上会被 antd 静默忽略，表单里永远显示空。
      validDays: record.validUntil
        ? Math.max(1, Math.ceil(dayjs(record.validUntil).diff(dayjs(), 'day', true)))
        : 7,
      // 质量等级入库时转成了中文标签，这里再转回下拉框的取值
      qualityLevel: qualityCode(record.qualityDescription),
    })
    setFormVisible(true)
  }

  const handleDelete = async (id: number) => {
    try {
      const res = await deleteQuote(id)
      if (res.code === 200) {
        message.success('删除成功')
        loadData()
      } else {
        message.error(res.message || '删除失败')
      }
    } catch (error) {
      message.error('删除失败')
    }
  }

  const handleAccept = async (id: number) => {
    try {
      const res = await acceptQuote(id)
      if (res.code === 200) {
        message.success('接受报价成功')
        loadData()
      } else {
        message.error(res.message || '接受报价失败')
      }
    } catch (error) {
      message.error('接受报价失败')
    }
  }

  /**
   * 报价转订单。
   *
   * <p>接受报价之后必须再走这一步才有订单 —— 后端的 acceptQuote 只改报价状态，
   * 生成订单是 convertToOrder 的职责（服务端算金额、落订单明细、回写 orderId 做幂等）。
   * 转完直接把人送到「确认订单」页，那里能改收货信息并确认。</p>
   */
  const handleConvert = async (id: number) => {
    try {
      const res = await convertQuoteToOrder(id)
      if (res.code === 200 && res.data) {
        message.success('已生成订单，请确认收货信息')
        navigate(`/order/confirm?orderId=${res.data.id}`)
      } else {
        message.error(res.message || '生成订单失败')
      }
    } catch {
      message.error('生成订单失败')
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const data = {
        ...values,
        deliveryTime: values.deliveryTime?.format('YYYY-MM-DD'),
      }
      let res
      if (currentItem) {
        res = await updateQuote(currentItem.id, data)
      } else {
        res = await createQuote(data)
      }
      if (res.code === 200) {
        message.success(currentItem ? '修改成功' : '创建成功')
        setFormVisible(false)
        loadData()
      } else {
        message.error(res.message || '操作失败')
      }
    } catch (error) {
      message.error('操作失败')
    }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '报价编号', dataIndex: 'quoteNo', key: 'quoteNo', width: 150 },
    { title: '产品名称', dataIndex: 'productName', key: 'productName' },
    { title: '单价', dataIndex: 'unitPrice', key: 'unitPrice', render: (v: number) => `¥${v}` },
    { title: '数量', dataIndex: 'quantity', key: 'quantity' },
    { title: '单位', dataIndex: 'unit', key: 'unit', width: 60 },
    { title: '总价', dataIndex: 'totalAmount', key: 'totalAmount', render: (v: number) => `¥${v}` },
    { title: '供应商', dataIndex: 'sellerName', key: 'sellerName' },
    {
      title: '有效期至',
      dataIndex: 'validUntil',
      key: 'validUntil',
      width: 170,
      render: (v: string) => {
        // 之前这一列读的是 validDays —— 表里没有这个字段，整列永远显示 "undefined天"。
        if (!v) return '—'
        const expired = dayjs(v).isBefore(dayjs())
        return (
          <span style={{ color: expired ? '#999' : undefined }}>
            {v}
            {expired ? '（已过期）' : ''}
          </span>
        )
      }
    },
    {
      title: '状态',
      dataIndex: 'quoteStatus',
      key: 'quoteStatus',
      width: 100,
      render: (status: string) => {
        const { color, text } = statusMap[status] || { color: 'default', text: status }
        return <Tag color={color}>{text}</Tag>
      },
    },
    { title: '创建时间', dataIndex: 'createTime', key: 'createTime', width: 180 },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: QuoteVO) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除吗？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
          {/* 后端写的状态是 pending / accepted / rejected —— 这里原先判断 'approved'，
              那个值后端从来不产生，于是"接受"按钮一次都没出现过。 */}
          {record.quoteStatus === 'pending' && isMyQuoteAsBuyer(record) && (
            <Popconfirm title="确定接受此报价吗？" onConfirm={() => handleAccept(record.id)}>
              <Button type="link" size="small" icon={<CheckOutlined />}>
                接受
              </Button>
            </Popconfirm>
          )}
          {record.quoteStatus === 'accepted' && isMyQuoteAsBuyer(record) && (
            <Popconfirm title="按此报价生成订单？" onConfirm={() => handleConvert(record.id)}>
              <Button type="link" size="small">
                生成订单
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card title={`收到的询价（${received.length}）`} style={{ marginBottom: 16 }}>
        {received.length === 0 ? (
          <Typography.Text type="secondary">暂时没有采购方向你询价</Typography.Text>
        ) : (
          <Table
            rowKey="id"
            size="small"
            dataSource={received}
            pagination={false}
            columns={[
              { title: '询价单号', dataIndex: 'inquiryNo', width: 170 },
              { title: '采购方', dataIndex: 'buyerName', width: 170, render: (v: string) => v ?? '—' },
              { title: '货源', dataIndex: 'productName', width: 190, render: (v: string) => v ?? '—' },
              { title: '数量', dataIndex: 'quantity', width: 100,
                render: (v: number, row: InquiryVO) => (v == null ? '—' : `${v}${row.unit ?? ''}`) },
              { title: '期望价', dataIndex: 'priceMin', width: 150,
                render: (_: unknown, row: InquiryVO) =>
                  row.priceMin == null ? '—' : `¥${row.priceMin}${row.priceMax == null ? '' : ' ~ ¥' + row.priceMax}` },
              { title: '已报价', dataIndex: 'replyCount', width: 90, render: (v: number) => `${v ?? 0} 条` },
              { title: '状态', dataIndex: 'inquiryStatus', width: 100,
                render: (v: string) => (v === 'quoted'
                  ? <Tag color="processing">已报价</Tag>
                  : <Tag color="warning">待报价</Tag>) },
              { title: '报价截止', dataIndex: 'replyDeadline', width: 170, render: (v: string) => v ?? '—' },
              {
                title: '操作',
                width: 100,
                render: (_: unknown, row: InquiryVO) => (
                  <Button type="link" onClick={() => { setQuoteOpen(row); quoteForm.resetFields() }}>报价</Button>
                )
              }
            ]}
          />
        )}
      </Card>

      <Card title="报价管理" style={{ marginBottom: 16 }}>
        <Space style={{ marginBottom: 16 }}>
          <Input
            placeholder="报价编号"
            value={queryParams.quoteNo}
            onChange={(e) => setQueryParams({ ...queryParams, quoteNo: e.target.value })}
            style={{ width: 150 }}
          />
          <Input
            placeholder="产品名称"
            value={queryParams.productName}
            onChange={(e) => setQueryParams({ ...queryParams, productName: e.target.value })}
            style={{ width: 150 }}
          />
          <Select
            placeholder="报价状态"
            value={queryParams.quoteStatus}
            onChange={(v) => setQueryParams({ ...queryParams, quoteStatus: v })}
            style={{ width: 120 }}
            allowClear
            options={[
              { value: 'pending', label: '待审核' },
              { value: 'approved', label: '已通过' },
              { value: 'rejected', label: '已拒绝' },
              { value: 'accepted', label: '已接受' },
            ]}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            查询
          </Button>
          <Button onClick={handleReset}>重置</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增报价
          </Button>
        </Space>

        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{
            current: queryParams.pageNum,
            pageSize: queryParams.pageSize,
            total,
            onChange: (page, pageSize) => setQueryParams({ ...queryParams, pageNum: page, pageSize }),
          }}
        />
      </Card>

      <Modal
        title={currentItem ? '编辑报价' : '新增报价'}
        open={formVisible}
        onOk={handleSubmit}
        onCancel={() => setFormVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="productName" label="产品名称" rules={[{ required: true, message: '请输入产品名称' }]}>
            <Input placeholder="请输入产品名称" />
          </Form.Item>
          <Form.Item name="unitPrice" label="单价" rules={[{ required: true, message: '请输入单价' }]}>
            <InputNumber placeholder="请输入单价" style={{ width: '100%' }} min={0} precision={2} />
          </Form.Item>
          <Form.Item name="quantity" label="数量" rules={[{ required: true, message: '请输入数量' }]}>
            <InputNumber placeholder="请输入数量" style={{ width: '100%' }} min={1} />
          </Form.Item>
          <Form.Item name="unit" label="单位" rules={[{ required: true, message: '请选择单位' }]}>
            <Select
              placeholder="请选择单位"
              options={[
                { value: '吨', label: '吨' },
                { value: '千克', label: '千克' },
                { value: '斤', label: '斤' },
                { value: '件', label: '件' },
                { value: '箱', label: '箱' },
              ]}
            />
          </Form.Item>
          {/*
            供应商不再是自由文本：报价的卖方由服务端按登录用户绑定的经营主体推导
            （见 PlatformIdentityService）。原先这里让用户手填供应商名称，
            后端根本不接收这个字段 —— 填了等于没填，还会让人以为报价挂到了别家名下。
          */}
          <Form.Item name="validDays" label="有效期(天)" rules={[{ required: true, message: '请输入有效期' }]}>
            <InputNumber placeholder="请输入有效期天数" style={{ width: '100%' }} min={1} max={365} />
          </Form.Item>
          <Form.Item name="qualityLevel" label="质量等级">
            <Select
              placeholder="请选择质量等级"
              options={[
                { value: 'premium', label: '特级' },
                { value: 'level1', label: '一级' },
                { value: 'level2', label: '二级' },
                { value: 'level3', label: '三级' },
              ]}
            />
          </Form.Item>
          <Form.Item name="deliveryTime" label="交货时间">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="deliveryAddress" label="交货地址">
            <Input.TextArea placeholder="请输入交货地址" rows={2} />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea placeholder="请输入备注" rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`对该询价报价${quoteOpen ? ' · ' + quoteOpen.inquiryNo : ''}`}
        open={!!quoteOpen}
        onCancel={() => setQuoteOpen(null)}
        onOk={submitInquiryQuote}
        confirmLoading={quoting}
        destroyOnClose
      >
        {quoteOpen && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message={`采购方：${quoteOpen.buyerName ?? '—'}；货源：${quoteOpen.productName ?? '—'}`}
            description={
              '数量默认沿用询价单里的；总价由服务端按「单价 × 数量 + 运费」计算。' +
              '报价后采购方会在「报价管理」里看到，受理即生成订单。'
            }
          />
        )}
        <Form form={quoteForm} layout="vertical">
          <Form.Item name="unitPrice" label="单价" rules={[{ required: true, message: '请输入单价' }]}>
            <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="你的报价单价" />
          </Form.Item>
          <Form.Item name="quantity" label="数量" extra={`留空则沿用询价单数量（${quoteOpen?.quantity ?? '—'}${quoteOpen?.unit ?? ''}）`}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="freightAmount" label="运费">
            <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="可留空，默认 0" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="例如：含包装、7 天内可发货" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
