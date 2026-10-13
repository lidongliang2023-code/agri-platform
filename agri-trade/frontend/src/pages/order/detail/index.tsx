import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Button, Card, Descriptions, Empty, Form, Input, InputNumber, Modal, Popconfirm, Rate, Select, Space, Spin, Table, Tag, Typography, message
} from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { applyOrderRefund, getOrderById, getOrderItems, payOrder, updateOrderStatus } from '@/api/order'
import { createEvaluation } from '@/api/evaluation'

interface Order {
  id: number
  orderNo: string
  buyerId: number
  buyerName: string
  buyerPhone: string
  sellerId: number
  sellerName: string
  sellerPhone: string
  categoryName: string
  goodsAmount: number
  freightAmount: number
  discountAmount: number
  totalAmount: number
  paidAmount: number
  paymentStatus: string
  paymentMethod: string
  orderStatus: string
  deliveryProvince: string
  deliveryCity: string
  deliveryAddress: string
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
  /** 实体是 specLevel（表里没有 spec_size，货源上的 specSize 存不进订单明细） */
  specLevel: string
  unit: string
  quantity: number
  unitPrice: number
  /** 实体字段是 totalPrice（表里另有 amount 列，但实体没映射，读它恒空） */
  totalPrice: number
  traceCode: string
}

/** 订单状态机：与后端 updateOrderStatus 认的取值一一对应 */
const STEPS = [
  { status: 'pending_confirm', label: '待确认' },
  { status: 'paid', label: '已付款' },
  { status: 'shipped', label: '已发货' },
  { status: 'received', label: '已收货' },
  { status: 'completed', label: '已完成' }
]

const ORDER_STATUS: Record<string, { text: string; color: string }> = {
  pending_confirm: { text: '待确认', color: 'warning' },
  pending: { text: '待付款', color: 'warning' },
  paid: { text: '已付款', color: 'processing' },
  shipped: { text: '已发货', color: 'blue' },
  received: { text: '已收货', color: 'cyan' },
  completed: { text: '已完成', color: 'success' },
  cancelled: { text: '已取消', color: 'default' },
  refunded: { text: '已退款', color: 'default' }
}

/**
 * 订单详情（原型"订单管理 → 订单详情"）。
 *
 * <p>把订单状态机搬到页面上：待确认 → 已付款 → 已发货 → 已收货 → 已完成。
 * 每一步都调后端真实接口 POST /order/{id}/status（它顺带置已付金额、物流已揽收、
 * 买家已确认、已结算），不是前端自己改个标签了事。</p>
 *
 * <p>已收货/已完成的订单可以评价，走 POST /api/trade/evaluation。</p>
 */
export default function OrderDetail() {
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

  const load = useCallback(() => {
    if (!id) return
    setLoading(true)
    getOrderById(Number(id))
      .then((res: { code: number; data?: Order; message?: string }) => {
        if (res?.code === 200) setOrder(res.data ?? null)
        else message.error(res?.message ?? '订单不存在')
      })
      .catch(() => message.error('加载订单失败'))
      .finally(() => setLoading(false))
    getOrderItems(id)
      .then((res: { code: number; data?: OrderItemRow[] }) => {
        if (res?.code === 200) setItems(res.data ?? [])
      })
      .catch(() => undefined)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const advance = async (status: string, label: string) => {
    if (!id) return
    setActing(true)
    try {
      const res = await updateOrderStatus(Number(id), status)
      if (res?.code === 200) {
        message.success(`已${label}`)
        load()
      } else {
        message.error(res?.message ?? '操作失败')
      }
    } finally {
      setActing(false)
    }
  }

  const handlePay = async () => {
    if (!id) return
    setActing(true)
    try {
      // 金额由订单总额决定，不由前端传 —— 让前端传金额等于把"付多少钱"交给浏览器。
      const res = await payOrder(id, { paymentMethod: order?.paymentMethod ?? 'transfer' })
      if (res?.code === 200) {
        await updateOrderStatus(id, 'paid')
        message.success('支付成功')
        load()
      } else {
        message.error(res?.message ?? '支付失败')
      }
    } finally {
      setActing(false)
    }
  }

  const submitEvaluation = async (values: { ratingOverall: number; evaluationContent: string }) => {
    if (!order) return
    const res = await createEvaluation({
      orderId: order.id,
      evaluatorId: order.buyerId,
      evaluatorName: order.buyerName,
      evaluateeId: order.sellerId,
      evaluateeName: order.sellerName,
      ratingOverall: values.ratingOverall,
      evaluationContent: values.evaluationContent,
      evaluationStatus: 'published'
    })
    if (res?.code === 200) {
      message.success('评价已提交')
      setEvalOpen(false)
      evalForm.resetFields()
    } else {
      message.error(res?.message ?? '评价提交失败')
    }
  }

  /**
   * 申请退款。
   *
   * <p>后端会把订单状态置为 refunding 并生成一条 pending 的退款单；
   * 审核与打款属运营端（/order/refund/{id}/audit），用户端只负责发起。
   * 金额默认带出订单已付金额，可改为部分退款。</p>
   */
  const submitRefund = async (values: { refundType: string; refundAmount: number; refundReason: string }) => {
    if (!order) return
    const res = await applyOrderRefund(order.id, {
      refundType: values.refundType,
      refundAmount: values.refundAmount,
      refundReason: values.refundReason,
      applicantType: 'buyer'
    })
    if (res?.code === 200) {
      message.success('退款申请已提交，等待平台审核')
      setRefundOpen(false)
      refundForm.resetFields()
      load()
    } else {
      message.error(res?.message ?? '退款申请失败')
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 80, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }
  if (!order) {
    return <Empty description="没有找到这笔订单" style={{ padding: 80 }} />
  }

  const status = ORDER_STATUS[order.orderStatus] ?? { text: order.orderStatus, color: 'default' }
  const currentIndex = STEPS.findIndex((s) => s.status === order.orderStatus)
  const nextStep = currentIndex >= 0 && currentIndex < STEPS.length - 1 ? STEPS[currentIndex + 1] : null
  const canPay = order.orderStatus === 'pending_confirm' || order.orderStatus === 'pending'

  return (
    <div style={{ padding: 20 }}>
      <Space style={{ marginBottom: 16 }} wrap>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/order')}>
          返回订单列表
        </Button>
        {canPay && (
          <Button type="primary" loading={acting} onClick={handlePay}>
            立即支付 ¥{order.totalAmount}
          </Button>
        )}
        {!canPay && nextStep && (
          <Popconfirm title={`确认推进到「${nextStep.label}」？`} onConfirm={() => advance(nextStep.status, nextStep.label)}>
            <Button loading={acting}>推进到「{nextStep.label}」</Button>
          </Popconfirm>
        )}
        {(order.orderStatus === 'received' || order.orderStatus === 'completed') && (
          <Button onClick={() => setEvalOpen(true)}>评价这笔交易</Button>
        )}
        {(order.orderStatus === 'paid' || order.orderStatus === 'shipped' || order.orderStatus === 'received') && (
          <Button
            danger
            onClick={() => {
              refundForm.setFieldsValue({
                refundType: 'full',
                refundAmount: order.paidAmount ?? order.totalAmount
              })
              setRefundOpen(true)
            }}
          >
            申请退款
          </Button>
        )}
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Space align="center" wrap>
          <Typography.Title level={4} style={{ margin: 0 }}>
            订单 {order.orderNo}
          </Typography.Title>
          <Tag color={status.color}>{status.text}</Tag>
        </Space>

        <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small" style={{ marginTop: 16 }} bordered>
          <Descriptions.Item label="采购方">{order.buyerName ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="供货方">{order.sellerName ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="品类">{order.categoryName ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="货款">¥{order.goodsAmount ?? 0}</Descriptions.Item>
          <Descriptions.Item label="运费">¥{order.freightAmount ?? 0}</Descriptions.Item>
          <Descriptions.Item label="优惠">¥{order.discountAmount ?? 0}</Descriptions.Item>
          <Descriptions.Item label="订单总额">
            <span style={{ color: '#1565C0', fontWeight: 600 }}>¥{order.totalAmount}</span>
          </Descriptions.Item>
          <Descriptions.Item label="已付金额">{order.paidAmount ? `¥${order.paidAmount}` : '—'}</Descriptions.Item>
          <Descriptions.Item label="支付方式">{order.paymentMethod ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="收货地址" span={2}>
            {[order.deliveryProvince, order.deliveryCity, order.deliveryAddress].filter(Boolean).join(' ') || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="期望交货">{order.deliveryDeadline ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="物流单号">{order.logisticsNo ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="物流状态">{order.logisticsStatus ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="买家已确认">{order.buyerConfirmed === 1 ? '是' : '否'}</Descriptions.Item>
          <Descriptions.Item label="结算状态">{order.settleStatus ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="下单时间">{order.createTime ?? '—'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title={`订单明细（${items.length}）`}>
        {items.length === 0 ? (
          <Empty description="这笔订单没有明细行" />
        ) : (
          <Table
            rowKey="id"
            dataSource={items}
            pagination={false}
            columns={[
              { title: '商品', dataIndex: 'productName' },
              { title: '等级', dataIndex: 'specLevel', render: (val: string) => val || '—' },
              {
                title: '数量',
                dataIndex: 'quantity',
                render: (val: number, row: OrderItemRow) => `${val} ${row.unit ?? ''}`
              },
              { title: '单价', dataIndex: 'unitPrice', render: (val: number) => `¥${val}` },
              { title: '金额', dataIndex: 'totalPrice', render: (val: number) => `¥${val}` },
              { title: '溯源码', dataIndex: 'traceCode', render: (val: string) => val || '—' }
            ]}
          />
        )}
      </Card>

      <Modal
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
            <Input.TextArea rows={3} placeholder="说说这次交易的质量、服务、物流情况" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={refundOpen}
        title="申请退款"
        onCancel={() => setRefundOpen(false)}
        onOk={() => refundForm.submit()}
        okText="提交申请"
      >
        <Form form={refundForm} layout="vertical" onFinish={submitRefund}>
          <Form.Item label="退款类型" name="refundType" rules={[{ required: true, message: '请选择退款类型' }]}>
            <Select
              options={[
                { value: 'full', label: '全额退款' },
                { value: 'partial', label: '部分退款' }
              ]}
            />
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
