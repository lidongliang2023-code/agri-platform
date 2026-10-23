import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Empty, Form, Input, InputNumber, Modal, Rate, Select, Spin, message } from 'antd'
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CreditCardOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  SafetyCertificateOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  TruckOutlined,
  UserOutlined,
} from '@ant-design/icons'
import {
  applyOrderRefund,
  confirmReceipt,
  getOrderById,
  getOrderItems,
  payOrder,
  shipOrder,
} from '@/api/order'
import { createEvaluation, getEvaluationList, type EvaluationVO } from '@/api/evaluation'
import { getMyMerchants } from '@/api/identity'
import { BrandMark } from '@/components/BrandMark'
import { Panel, StatusTag, money, shortDate } from '../../member-center/shared'
import './order-detail.css'

interface Order {
  id: number
  orderNo: string
  buyerId: number | string
  buyerName: string
  buyerPhone: string
  sellerId: number | string
  sellerName: string
  sellerPhone: string
  categoryName: string
  productName?: string
  totalQuantity?: number
  goodsAmount: number
  freightAmount: number
  discountAmount: number
  totalAmount: number
  paidAmount: number
  refundAmount?: number
  paymentStatus: string
  paymentMethod: string
  orderStatus: string
  deliveryProvince: string
  deliveryCity: string
  deliveryAddress: string
  deliveryContact: string
  deliveryPhone: string
  deliveryDeadline: string
  logisticsNo: string
  logisticsStatus: string
  buyerConfirmed: number
  settleStatus: string
  createTime: string
}

interface OrderItemRow {
  id: number
  productId: number
  productName: string
  specLevel: string
  unit: string
  quantity: number
  unitPrice: number
  totalPrice: number
  traceCode: string
}

const PAYMENT_METHOD: Record<string, string> = {
  transfer: '平台转账',
  wechat: '微信支付',
  alipay: '支付宝',
  bank: '银行转账',
}

const PAYMENT_STATUS: Record<string, string> = {
  unpaid: '未支付',
  paid: '已支付',
  refunded: '已退款',
}

const LOGISTICS_STATUS: Record<string, string> = {
  pending: '待揽收',
  picked: '已揽收',
  in_transit: '运输中',
  delivering: '派送中',
  delivered: '已签收',
  exception: '物流异常',
}

/**
 * 采购订单详情工作台。
 *
 * 金额、订单明细和履约状态全部来自交易接口；支付、发货、收货和退款
 * 继续使用各自的服务端状态机接口，不在页面上直接改状态。
 */
export default function OrderDetail(): JSX.Element {
  const { id } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<OrderItemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [evalOpen, setEvalOpen] = useState(false)
  const [evalForm] = Form.useForm()
  const [refundOpen, setRefundOpen] = useState(false)
  const [refundForm] = Form.useForm()
  const [evaluations, setEvaluations] = useState<EvaluationVO[]>([])
  const [myMerchantIds, setMyMerchantIds] = useState<string[]>([])

  const loadEvaluations = useCallback(() => {
    if (!id) return
    getEvaluationList({ pageNum: 1, pageSize: 10, orderId: String(id) })
      .then((response: { code: number; data?: { records?: EvaluationVO[] } }) => {
        if (response?.code === 200) setEvaluations(response.data?.records ?? [])
      })
      .catch(() => setEvaluations([]))
  }, [id])

  useEffect(() => {
    getMyMerchants()
      .then((response) => {
        if (response?.code === 200) {
          setMyMerchantIds((response.data ?? []).map((item) => String(item.merchantId)))
        }
      })
      .catch(() => setMyMerchantIds([]))
  }, [])

  const load = useCallback(() => {
    if (!id) return
    setLoading(true)
    getOrderById(Number(id))
      .then((response: { code: number; data?: Order; message?: string }) => {
        if (response?.code === 200) setOrder(response.data ?? null)
        else message.error(response?.message ?? '订单不存在')
      })
      .catch(() => message.error('加载订单失败'))
      .finally(() => setLoading(false))
    getOrderItems(id)
      .then((response: { code: number; data?: OrderItemRow[] }) => {
        if (response?.code === 200) setItems(response.data ?? [])
      })
      .catch(() => setItems([]))
    loadEvaluations()
  }, [id, loadEvaluations])

  useEffect(() => {
    load()
  }, [load])

  const handlePay = async (): Promise<void> => {
    if (!id || !order) return
    if (!window.confirm(`确认支付订单 ${order.orderNo}，金额 ${money(order.totalAmount)}？`)) return
    setActing(true)
    try {
      const response = await payOrder(id, { paymentMethod: order.paymentMethod ?? 'transfer' })
      if (response?.code === 200) {
        message.success('支付成功')
        load()
      } else {
        message.error(response?.message ?? '支付失败')
      }
    } finally {
      setActing(false)
    }
  }

  const handleShip = async (): Promise<void> => {
    if (!id || !order) return
    if (!window.confirm('确认发货并生成物流单？')) return
    setActing(true)
    try {
      const response = await shipOrder(id, {
        carrierName: '平台物流',
        carrierNo: order.orderNo,
        logisticsType: 'road',
      })
      if (response?.code === 200) {
        message.success('已发货并生成物流单')
        load()
      } else {
        message.error(response?.message ?? '发货失败')
      }
    } finally {
      setActing(false)
    }
  }

  const handleConfirmReceipt = async (): Promise<void> => {
    if (!id || !order) return
    if (!window.confirm('确认已经收到货物？')) return
    setActing(true)
    try {
      const response = await confirmReceipt(id, { signReceiver: order.deliveryContact })
      if (response?.code === 200) {
        message.success('已确认收货，物流已签收')
        load()
      } else {
        message.error(response?.message ?? '确认收货失败')
      }
    } finally {
      setActing(false)
    }
  }

  const submitEvaluation = async (values: { ratingOverall: number; evaluationContent: string }): Promise<void> => {
    if (!order) return
    const response = await createEvaluation({
      orderId: order.id,
      ratingOverall: values.ratingOverall,
      evaluationContent: values.evaluationContent,
    })
    if (response?.code === 200) {
      message.success('评价已提交')
      setEvalOpen(false)
      evalForm.resetFields()
      loadEvaluations()
    } else {
      message.error(response?.message ?? '评价提交失败')
    }
  }

  const submitRefund = async (values: {
    refundType: string
    refundAmount: number
    refundReason: string
  }): Promise<void> => {
    if (!order) return
    const response = await applyOrderRefund(order.id, {
      ...values,
      applicantType: 'buyer',
    })
    if (response?.code === 200) {
      message.success('退款申请已提交，等待平台审核')
      setRefundOpen(false)
      refundForm.resetFields()
      load()
    } else {
      message.error(response?.message ?? '退款申请失败')
    }
  }

  if (loading) {
    return (
      <div className="order-detail-page order-detail-center">
        <Spin size="large" /><span>正在读取订单详情…</span>
      </div>
    )
  }
  if (!order) {
    return (
      <div className="order-detail-page order-detail-center">
        <Empty description="没有找到这笔订单" />
        <button type="button" className="mc-btn" onClick={() => navigate('/member/buyer?tab=purchase')}>
          返回采购订单
        </button>
      </div>
    )
  }

  const isBuyer = myMerchantIds.includes(String(order.buyerId))
  const isSeller = myMerchantIds.includes(String(order.sellerId))
  const canPay = isBuyer && ['pending_confirm', 'pending'].includes(order.orderStatus)
  const canRefund = isBuyer && ['received', 'completed'].includes(order.orderStatus)
  const canEvaluate = ['received', 'completed'].includes(order.orderStatus) && !evaluations.some(
    (item) => myMerchantIds.includes(String(item.evaluatorId)),
  )
  const returnPath = isSeller ? '/member/seller?tab=sales' : '/member/buyer?tab=purchase'
  const flowIndex = order.orderStatus === 'pending_confirm' || order.orderStatus === 'pending'
    ? 0 : order.orderStatus === 'paid' ? 1 : order.orderStatus === 'shipped' ? 2
      : ['received', 'completed', 'refunding', 'refunded'].includes(order.orderStatus) ? 3 : 0
  const buyerEvaluation = evaluations.find((item) => String(item.evaluatorId) === String(order.buyerId))
  const sellerEvaluation = evaluations.find((item) => String(item.evaluatorId) === String(order.sellerId))

  return (
    <div className="order-detail-page">
      <header className="order-detail-topbar">
        <a className="order-detail-brand" href="/">
          <span><BrandMark size={32} /></span>
          <strong>丰链云<small>FENGCHAIN · AGRI</small></strong>
        </a>
        <nav>
          <a href={isSeller ? '/member/seller' : '/member/buyer'}>{isSeller ? '卖家中心' : '买家中心'}</a>
          <span>/</span>
          <strong>订单详情</strong>
        </nav>
        <a className="order-detail-back" href={returnPath}><ArrowLeftOutlined /> 返回订单列表</a>
      </header>

      <main className="order-detail-main">
        <section className="order-detail-hero">
          <span className="order-detail-hero-icon"><ShoppingCartOutlined /></span>
          <div className="order-detail-hero-title">
            <small>PURCHASE ORDER · {order.orderNo}</small>
            <h1>{order.productName || order.categoryName || '采购订单'}</h1>
            <p>下单时间 {shortDate(order.createTime)} · {isBuyer ? '采购方' : isSeller ? '供货方' : '交易参与方'}视图</p>
          </div>
          <StatusTag status={order.orderStatus} side={isSeller ? 'seller' : 'buyer'} />
          <div className="order-detail-actions">
            {canPay && (
              <button type="button" className="mc-btn" disabled={acting} onClick={() => void handlePay()}>
                <CreditCardOutlined /> 立即支付 {money(order.totalAmount)}
              </button>
            )}
            {isSeller && order.orderStatus === 'paid' && (
              <button type="button" className="mc-btn" disabled={acting} onClick={() => void handleShip()}>
                <TruckOutlined /> 确认发货
              </button>
            )}
            {isBuyer && order.orderStatus === 'shipped' && (
              <button type="button" className="mc-btn" disabled={acting} onClick={() => void handleConfirmReceipt()}>
                <CheckCircleOutlined /> 确认收货
              </button>
            )}
            {canEvaluate && (
              <button type="button" className="mc-btn ghost" onClick={() => setEvalOpen(true)}>评价交易</button>
            )}
            {canRefund && (
              <button type="button" className="mc-btn ghost order-detail-danger" onClick={() => {
                refundForm.setFieldsValue({
                  refundType: 'return_refund',
                  refundAmount: order.paidAmount ?? order.totalAmount,
                })
                setRefundOpen(true)
              }}>
                申请退货退款
              </button>
            )}
          </div>
        </section>

        <div className="order-detail-layout">
          <div className="order-detail-content">
            <Panel title={`商品明细（${items.length}）`} extra={<span className="order-detail-muted">订单金额由服务端核算</span>}>
              {items.length === 0 ? (
                <Empty description="这笔订单没有商品明细" />
              ) : (
                <div className="order-detail-products">
                  {items.map((item) => (
                    <div className="order-detail-product" key={item.id}>
                      <span className="order-detail-product-icon"><ShopOutlined /></span>
                      <div>
                        <strong>{item.productName}</strong>
                        <small>{[item.specLevel, item.traceCode ? `溯源码 ${item.traceCode}` : ''].filter(Boolean).join(' · ') || '规格以订单约定为准'}</small>
                      </div>
                      <span>{item.quantity} {item.unit}</span>
                      <span>{money(item.unitPrice)} / {item.unit}</span>
                      <strong className="order-detail-price">{money(item.totalPrice)}</strong>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="交付信息">
              <div className="order-detail-info-grid">
                <div><span><EnvironmentOutlined /> 收货地址</span><strong>{[order.deliveryProvince, order.deliveryCity, order.deliveryAddress].filter(Boolean).join(' ') || '—'}</strong></div>
                <div><span><UserOutlined /> 收货人</span><strong>{order.deliveryContact || '—'}</strong></div>
                <div><span><PhoneOutlined /> 联系电话</span><strong>{order.deliveryPhone || '—'}</strong></div>
                <div><span><ClockCircleOutlined /> 期望交货</span><strong>{shortDate(order.deliveryDeadline)}</strong></div>
              </div>
            </Panel>

            <Panel title={`交易评价（${evaluations.length}）`}>
              {evaluations.length === 0 ? (
                <Empty description={canEvaluate ? '这笔订单还没有评价，可在订单收货后评价' : '订单进入已收货状态后可进行评价'} />
              ) : (
                <div className="order-detail-reviews">
                  {[
                    { key: 'buyer', label: '采购方评价', row: buyerEvaluation },
                    { key: 'seller', label: '供货方评价', row: sellerEvaluation },
                  ].map(({ key, label, row }) => (
                    <div className="order-review-card" key={key}>
                      <div><strong>{label}</strong>{row && <Rate disabled value={row.ratingOverall} />}</div>
                      {row ? (
                        <>
                          <p>{row.evaluationContent || '未填写文字评价'}</p>
                          <small>{row.evaluatorName} → {row.evaluateeName} · {shortDate(row.createTime)}</small>
                          {row.replyContent && <em>回复：{row.replyContent}</em>}
                        </>
                      ) : <span className="order-detail-muted">尚未评价</span>}
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <aside className="order-detail-aside">
            <Panel title="订单金额">
              <div className="order-amount-list">
                <div><span>货款</span><strong>{money(order.goodsAmount)}</strong></div>
                <div><span>运费</span><strong>{money(order.freightAmount)}</strong></div>
                <div><span>优惠</span><strong>-{money(order.discountAmount)}</strong></div>
                <div className="total"><span>订单总额</span><strong>{money(order.totalAmount)}</strong></div>
                <div><span>已付金额</span><strong>{money(order.paidAmount)}</strong></div>
                {Number(order.refundAmount ?? 0) > 0 && <div><span>已退金额</span><strong>{money(order.refundAmount)}</strong></div>}
              </div>
            </Panel>

            <Panel title="履约进度">
              <div className="order-flow">
                {['订单创建', '支付完成', '供应方发货', '买家收货'].map((label, index) => (
                  <div className={index <= flowIndex ? 'on' : ''} key={label}>
                    <span>{index <= flowIndex ? <CheckCircleOutlined /> : index + 1}</span>
                    <strong>{label}</strong>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="交易双方">
              <div className="order-parties">
                <div><span className="buyer">采</span><div><small>采购方</small><strong>{order.buyerName || '—'}</strong></div></div>
                <div><span className="seller">供</span><div><small>供货方</small><strong>{order.sellerName || '—'}</strong></div></div>
              </div>
            </Panel>

            <Panel title="物流与支付">
              <div className="order-side-info">
                <div><span>物流单号</span><strong className="mc-mono">{order.logisticsNo || '尚未生成'}</strong></div>
                <div><span>物流状态</span><strong>{LOGISTICS_STATUS[order.logisticsStatus] ?? order.logisticsStatus ?? '—'}</strong></div>
                <div><span>支付方式</span><strong>{PAYMENT_METHOD[order.paymentMethod] ?? order.paymentMethod ?? '—'}</strong></div>
                <div><span>支付状态</span><strong>{PAYMENT_STATUS[order.paymentStatus] ?? order.paymentStatus ?? '—'}</strong></div>
              </div>
            </Panel>

            <div className="order-detail-trust">
              <SafetyCertificateOutlined />
              <div><strong>交易数据已留痕</strong><span>订单、支付、物流与售后均可在会员中心追溯。</span></div>
            </div>
          </aside>
        </div>
      </main>

      <Modal
        className="order-detail-modal"
        open={evalOpen}
        title="评价这笔交易"
        onCancel={() => setEvalOpen(false)}
        onOk={() => evalForm.submit()}
        okText="提交评价"
      >
        <Form form={evalForm} layout="vertical" onFinish={submitEvaluation}>
          <Form.Item label="综合评分" name="ratingOverall" rules={[{ required: true, message: '请打分' }]}>
            <Rate />
          </Form.Item>
          <Form.Item label="评价内容" name="evaluationContent">
            <Input.TextArea rows={4} placeholder="说说商品质量、供应服务和物流情况" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        className="order-detail-modal"
        open={refundOpen}
        title="申请退款"
        onCancel={() => setRefundOpen(false)}
        onOk={() => refundForm.submit()}
        okText="提交申请"
      >
        <Form form={refundForm} layout="vertical" onFinish={submitRefund}>
          <Form.Item label="退款类型" name="refundType" rules={[{ required: true, message: '请选择退款类型' }]}>
            <Select options={[
              { value: 'return_refund', label: '退货退款' },
              { value: 'refund_only', label: '仅退款（无需退货）' },
            ]} />
          </Form.Item>
          <Form.Item label="退款金额（元）" name="refundAmount" rules={[{ required: true, message: '请填写退款金额' }]}>
            <InputNumber min={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="退款原因" name="refundReason" rules={[{ required: true, message: '请填写退款原因' }]}>
            <Input.TextArea rows={3} placeholder="例如：到货品质与约定不符" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
