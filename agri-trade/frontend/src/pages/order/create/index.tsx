import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, Button, Card, Col, Form, Input, InputNumber, Row, Select, Space, Typography, message } from 'antd'
import { createOrderFromProduct } from '@/api/order'
import { getProductList } from '@/api/product'

interface ProductOption {
  id: number
  productName: string
  sellerName: string
  unit: string
  price: number
  priceMin: number
  stockQuantity: number
}

/**
 * 创建订单（原型"订单管理 → 创建订单"）。
 *
 * <p>不经报价、直接从货源下单。金额由**服务端**按"货源单价 × 数量 + 运费"计算 ——
 * 页面上的合计只是给买家看的预览，落库金额以后端返回的订单为准。</p>
 */
export default function OrderCreate() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [form] = Form.useForm()
  const [products, setProducts] = useState<ProductOption[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [preview, setPreview] = useState<{ unitPrice: number; quantity: number } | null>(null)

  useEffect(() => {
    getProductList({ pageNum: 1, pageSize: 200, publishStatus: 'published' })
      .then((res: { code: number; data?: { records?: ProductOption[] } }) => {
        if (res?.code === 200) setProducts(res.data?.records ?? [])
      })
      .catch(() => message.error('加载货源失败（检查后端是否在运行）'))
  }, [])

  // 从商品详情带 productId 进来时预选该货源
  useEffect(() => {
    const productId = params.get('productId')
    if (productId) {
      const quantity = Number(params.get('quantity'))
      form.setFieldsValue({
        productId: Number(productId),
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : undefined,
      })
    }
  }, [params, form])

  const refreshPreview = () => {
    const productId = Number(form.getFieldValue('productId'))
    const quantity = Number(form.getFieldValue('quantity') ?? 0)
    const product = products.find((item) => item.id === productId)
    if (product && quantity > 0) {
      setPreview({ unitPrice: product.price ?? product.priceMin, quantity })
    } else {
      setPreview(null)
    }
  }

  const onFinish = async (values: Record<string, unknown>) => {
    setSubmitting(true)
    try {
      const res = await createOrderFromProduct(values)
      if (res?.code === 200 && res.data) {
        message.success('订单已创建，请确认收货信息')
        navigate(`/order/confirm?orderId=${res.data.id}`)
      } else {
        message.error(res?.message ?? '创建订单失败')
      }
    } catch {
      message.error('创建订单失败（检查后端是否在运行）')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <Card
        title="创建订单（从货源直接下单）"
        extra={<Button type="link" onClick={() => navigate('/product')}>去商品市场选货</Button>}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 20 }}
          message="下单价格以货源当前价格为准"
          description="货款由服务端按「货源单价 × 数量」计算，页面上显示的合计只是预览。若已与卖家谈好价格，请走询价 → 报价 → 接受报价的路径下单。"
        />
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          onValuesChange={refreshPreview}
          initialValues={{ quantity: 1, freightAmount: 0 }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="选择货源" name="productId" rules={[{ required: true, message: '请选择货源' }]}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="按货源名称搜索"
                  options={products.map((item) => ({
                    value: item.id,
                    label: `${item.productName}（${item.sellerName}）¥${item.price}/${item.unit} 库存 ${item.stockQuantity}`
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="下单数量" name="quantity" rules={[{ required: true, message: '请填写数量' }]}>
                <InputNumber min={0.001} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="运费（元，可选）" name="freightAmount">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          {preview && (
            <Alert
              type="success"
              showIcon
              style={{ marginBottom: 16 }}
              message={`预览：¥${preview.unitPrice} × ${preview.quantity} = ¥${(preview.unitPrice * preview.quantity).toFixed(2)}（不含运费，最终以后端计算为准）`}
            />
          )}

          <Row gutter={16}>
            <Col span={6}>
              <Form.Item label="收货省份" name="deliveryProvince" rules={[{ required: true, message: '请填写收货省份' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="收货城市" name="deliveryCity" rules={[{ required: true, message: '请填写收货城市' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="收货人" name="deliveryContact" rules={[{ required: true, message: '请填写收货人' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="收货电话" name="deliveryPhone" rules={[{ required: true, message: '请填写收货电话' }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="详细地址" name="deliveryAddress" rules={[{ required: true, message: '请填写详细地址' }]}>
            <Input placeholder="例如：新发地农产品批发市场粮油区 3 号库" />
          </Form.Item>

          <Space>
            <Button type="primary" htmlType="submit" loading={submitting}>
              提交订单
            </Button>
            <Button onClick={() => navigate('/order')}>取消</Button>
          </Space>
          <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
            提交后进入「确认订单」页核对信息，再进订单详情支付。
          </Typography.Paragraph>
        </Form>
      </Card>
    </div>
  )
}
