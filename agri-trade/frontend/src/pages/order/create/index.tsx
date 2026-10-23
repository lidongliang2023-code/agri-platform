import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, Button, Col, Empty, Form, Input, InputNumber, Row, Select, Spin, Typography, message } from 'antd'
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  PhoneOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { createOrderFromProduct } from '@/api/order'
import { getProductList } from '@/api/product'
import { BrandMark } from '@/components/BrandMark'
import ProvinceCityFields from '@/components/ProvinceCityFields'
import { redirectToSso } from '@/utils/sso'
import '../../hall/hall.css'
import '../../product/detail/product-detail.css'
import './order-create.css'

interface ProductOption {
  id: number
  productName: string
  sellerId?: number
  sellerName: string
  categoryName?: string
  variety?: string
  unit: string
  price: number
  priceMin: number
  minOrderQuantity?: number
  stockQuantity: number
}

const PORTAL = `${window.location.protocol}//${window.location.hostname}:8098/portal/`
const SSO_REGISTER = `${window.location.protocol}//${window.location.hostname}:8090/register`

const money = (value: number | null | undefined): string =>
  value == null ? '—' : `¥${Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * 从商品详情“立即下单”进入。
 *
 * <p>使用与商品详情相同的交易大厅导航、绿色视觉体系、圆角卡片和信息层级；
 * 金额仍只做前端预览，最终订单金额由服务端按商品价格计算。</p>
 */
export default function OrderCreate(): JSX.Element {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [form] = Form.useForm()
  const [products, setProducts] = useState<ProductOption[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')

  const productId = Form.useWatch('productId', form)
  const quantity = Number(Form.useWatch('quantity', form) ?? 0)
  const freightAmount = Number(Form.useWatch('freightAmount', form) ?? 0)
  const selectedProduct = products.find((item) => item.id === Number(productId))
  const unitPrice = Number(selectedProduct?.price ?? selectedProduct?.priceMin ?? 0)
  const goodsAmount = unitPrice * quantity
  const totalAmount = goodsAmount + freightAmount

  useEffect(() => {
    setLoadingProducts(true)
    getProductList({ pageNum: 1, pageSize: 200, publishStatus: 'published' })
      .then((res: { code: number; data?: { records?: ProductOption[] } }) => {
        if (res?.code === 200) setProducts(res.data?.records ?? [])
      })
      .catch(() => message.error('加载货源失败（检查后端是否在运行）'))
      .finally(() => setLoadingProducts(false))
  }, [])

  useEffect(() => {
    const productIdParam = params.get('productId')
    if (!productIdParam) return
    const quantityParam = Number(params.get('quantity'))
    form.setFieldsValue({
      productId: Number(productIdParam),
      quantity: Number.isFinite(quantityParam) && quantityParam > 0 ? quantityParam : undefined,
    })
  }, [params, form])

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

  const submitSearch = (event: FormEvent): void => {
    event.preventDefault()
    const value = search.trim()
    window.location.href = `${PORTAL}#/chains${value ? `?q=${encodeURIComponent(value)}` : ''}`
  }

  return (
    <div className="hall-root oc-page">
      <div className="topbar">
        <div className="hall-container">
          <span>您好，欢迎来到丰链云交易大厅！智能大宗交易 · 平台撮合 · 支持在线议价</span>
          <span className="topbar-actions">
            <a href="/member/buyer">我是买家</a><span className="sep">·</span>
            <a href="/member/seller">我是卖家</a><span className="sep">·</span>
            <a href="/member/buyer">会员中心</a><span className="sep">·</span>
            <a href="#login" onClick={(event) => {
              event.preventDefault()
              void redirectToSso(window.location.pathname + window.location.search)
            }}><UserOutlined />登录</a><span className="sep">·</span>
            <a href={SSO_REGISTER}>免费注册</a>
          </span>
        </div>
      </div>

      <header className="site-header">
        <div className="hall-container">
          <a className="hall-brand" href={PORTAL}>
            <span className="hall-logo"><BrandMark size={36} /></span>
            <span>丰链云<small>FENGCHAIN · AGRI</small></span>
          </a>
          <nav className="main-nav">
            <a href={PORTAL}>首页</a>
            <a href={`${PORTAL}#/chains`}>产业链</a>
            <a className="active" href="/hall">交易大厅</a>
            <a href={`${PORTAL}#/?scroll=price`}>价格指数</a>
            <a href={`${PORTAL}#/?scroll=news`}>产业资讯</a>
            <a href="/member/seller?tab=fund">供应链金融</a>
            <a href={`${PORTAL}#/logistics`}>物流服务</a>
          </nav>
          <form className="header-search" onSubmit={submitSearch}>
            <input value={search} onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索商品 / 供应商 / 需求" />
            <button type="submit"><SearchOutlined />搜索</button>
          </form>
        </div>
      </header>

      <main className="hall-container oc-main">
        <nav className="pd-crumb" aria-label="面包屑">
          <a href={PORTAL}>首页</a><span>/</span>
          <a href="/hall">交易大厅</a><span>/</span>
          <a href={selectedProduct ? `/product/detail/${selectedProduct.id}` : '/hall'}>商品详情</a><span>/</span>
          <strong>确认采购信息</strong>
        </nav>

        <section className="oc-heading">
          <div>
            <span className="oc-eyebrow"><ThunderboltOutlined /> 直接采购</span>
            <h1>创建采购订单</h1>
            <p>核对商品、数量和收货信息，提交后进入订单确认与支付环节。</p>
          </div>
          <button type="button" className="oc-back" onClick={() => {
            if (selectedProduct) navigate(`/product/detail/${selectedProduct.id}`)
            else navigate('/hall')
          }}>
            <ArrowLeftOutlined /> 返回商品详情
          </button>
        </section>

        <div className="oc-stepper" aria-label="下单流程">
          <div className="on"><span>01</span><strong>填写订单</strong><small>商品与收货信息</small></div>
          <i />
          <div><span>02</span><strong>确认订单</strong><small>核对金额与交付</small></div>
          <i />
          <div><span>03</span><strong>支付完成</strong><small>进入订单履约</small></div>
        </div>

        <div className="oc-layout">
          <section className="oc-form-card">
            <Alert
              type="info"
              showIcon
              className="oc-notice"
              message="成交价格由平台按商品当前价格计算"
              description="右侧金额仅用于下单前预览。若已与供应商谈定价格，请通过询价、报价流程成交。"
            />
            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
              initialValues={{ quantity: 1, freightAmount: 0 }}
              requiredMark={false}
            >
              <div className="oc-form-section">
                <div className="oc-section-title">
                  <span><ShoppingCartOutlined /></span>
                  <div><strong>采购商品</strong><small>确认货源、数量和运费</small></div>
                </div>
                <Row gutter={[18, 0]}>
                  <Col xs={24} lg={12}>
                    <Form.Item label="选择货源" name="productId" rules={[{ required: true, message: '请选择货源' }]}>
                      <Select
                        showSearch
                        loading={loadingProducts}
                        optionFilterProp="label"
                        placeholder="按货源名称搜索"
                        options={products.map((item) => ({
                          value: item.id,
                          label: `${item.productName}（${item.sellerName}）${money(item.price ?? item.priceMin)}/${item.unit}`,
                        }))}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={12} lg={6}>
                    <Form.Item label={`采购数量（${selectedProduct?.unit ?? '单位'}）`} name="quantity"
                      rules={[{ required: true, message: '请填写数量' }]}>
                      <InputNumber min={selectedProduct?.minOrderQuantity ?? 0.001} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={12} lg={6}>
                    <Form.Item label="运费（元）" name="freightAmount">
                      <InputNumber min={0} precision={2} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
              </div>

              <div className="oc-form-section">
                <div className="oc-section-title">
                  <span><EnvironmentOutlined /></span>
                  <div><strong>收货信息</strong><small>用于物流履约和签收确认</small></div>
                </div>
                <Row gutter={[18, 0]}>
                  <ProvinceCityFields
                    form={form}
                    required
                    provinceLabel="收货省份"
                    cityLabel="收货城市"
                    provinceColProps={{ xs: 24, md: 8 }}
                    cityColProps={{ xs: 24, md: 8 }}
                  />
                  <Col xs={24} md={8}>
                    <Form.Item label="收货人" name="deliveryContact"
                      rules={[{ required: true, message: '请填写收货人' }]}>
                      <Input prefix={<UserOutlined />} placeholder="请输入收货人姓名" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item label="联系电话" name="deliveryPhone"
                      rules={[{ required: true, message: '请填写联系电话' }]}>
                      <Input prefix={<PhoneOutlined />} placeholder="请输入手机号" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={16}>
                    <Form.Item label="详细地址" name="deliveryAddress"
                      rules={[{ required: true, message: '请填写详细地址' }]}>
                      <Input placeholder="例如：新发地农产品批发市场粮油区 3 号库" />
                    </Form.Item>
                  </Col>
                </Row>
              </div>

              <div className="oc-form-actions">
                <button type="submit" className="oc-submit" disabled={submitting}>
                  {submitting ? <><Spin size="small" /> 正在创建订单</> : <><ThunderboltOutlined /> 提交订单</>}
                </button>
                <Button className="oc-cancel" onClick={() => navigate('/member/buyer?tab=purchase')}>
                  取消并返回
                </Button>
                <span><SafetyCertificateOutlined /> 订单与支付数据由平台加密留痕</span>
              </div>
            </Form>
          </section>

          <aside className="oc-summary">
            <div className="oc-summary-head">
              <span>订单预览</span>
              <em>实时计价</em>
            </div>
            {loadingProducts ? (
              <div className="oc-summary-loading"><Spin /><span>正在读取货源信息…</span></div>
            ) : selectedProduct ? (
              <>
                <div className="oc-product">
                  <div className="oc-product-visual"><ShopOutlined /></div>
                  <div>
                    <span>{selectedProduct.categoryName || selectedProduct.variety || '平台在售商品'}</span>
                    <strong>{selectedProduct.productName}</strong>
                    <small><ShopOutlined /> {selectedProduct.sellerName}</small>
                  </div>
                </div>
                <div className="oc-summary-lines">
                  <div><span>商品单价</span><strong>{money(unitPrice)} / {selectedProduct.unit}</strong></div>
                  <div><span>采购数量</span><strong>{quantity || 0} {selectedProduct.unit}</strong></div>
                  <div><span>商品金额</span><strong>{money(goodsAmount)}</strong></div>
                  <div><span>运费</span><strong>{money(freightAmount)}</strong></div>
                </div>
                <div className="oc-total">
                  <span>预计订单总额</span>
                  <strong>{money(totalAmount)}</strong>
                  <small>最终金额以服务端创建订单结果为准</small>
                </div>
                <div className="oc-summary-trust">
                  <span><CheckCircleOutlined /> 商品价格平台校验</span>
                  <span><FileTextOutlined /> 订单明细自动留存</span>
                  <span><SafetyCertificateOutlined /> 交易过程全程留痕</span>
                </div>
              </>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="选择货源后生成订单预览" />
            )}
            <Typography.Paragraph className="oc-summary-note">
              提交后可继续修改收货信息；支付、发货、签收与售后均可在买家中心跟踪。
            </Typography.Paragraph>
          </aside>
        </div>
      </main>
    </div>
  )
}
