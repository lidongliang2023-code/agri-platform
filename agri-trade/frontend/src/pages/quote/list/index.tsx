import { useState, useEffect } from 'react'
import { Card, Table, Button, Space, Tag, Modal, Form, Input, InputNumber, Select, DatePicker, message, Popconfirm } from 'antd'
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, CheckOutlined } from '@ant-design/icons'
import { getQuoteList, createQuote, updateQuote, deleteQuote, acceptQuote, QuoteVO, QuoteQuery } from '@/api/quote'
import dayjs from 'dayjs'

const statusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'warning', text: '待审核' },
  approved: { color: 'success', text: '已通过' },
  rejected: { color: 'error', text: '已拒绝' },
  accepted: { color: 'processing', text: '已接受' },
  expired: { color: 'default', text: '已过期' },
}

export default function QuoteList() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<QuoteVO[]>([])
  const [total, setTotal] = useState(0)
  const [queryParams, setQueryParams] = useState<QuoteQuery>({ pageNum: 1, pageSize: 10 })
  const [formVisible, setFormVisible] = useState(false)
  const [currentItem, setCurrentItem] = useState<QuoteVO | null>(null)
  const [form] = Form.useForm()

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
    { title: '有效期', dataIndex: 'validDays', key: 'validDays', render: (v: number) => `${v}天` },
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
          {record.quoteStatus === 'approved' && (
            <Popconfirm title="确定接受此报价吗？" onConfirm={() => handleAccept(record.id)}>
              <Button type="link" size="small" icon={<CheckOutlined />}>
                接受
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
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
          <Form.Item name="sellerName" label="供应商名称" rules={[{ required: true, message: '请输入供应商名称' }]}>
            <Input placeholder="请输入供应商名称" />
          </Form.Item>
          <Form.Item name="validDays" label="有效期(天)" rules={[{ required: true, message: '请输入有效期' }]}>
            <InputNumber placeholder="请输入有效期天数" style={{ width: '100%' }} min={1} />
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
    </div>
  )
}