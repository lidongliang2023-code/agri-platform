import './order-detail.css';
import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { useNavigate, useParams } from "@/vue/router";
import { Empty, Form, Input, InputNumber, Modal, Rate, Select, Spin, message } from "@/vue/ui";
import { ArrowLeftOutlined, CheckCircleOutlined, ClockCircleOutlined, CreditCardOutlined, EnvironmentOutlined, PhoneOutlined, SafetyCertificateOutlined, ShopOutlined, ShoppingCartOutlined, CarOutlined, UserOutlined } from "@ant-design/icons-vue";
import { applyOrderRefund, confirmReceipt, getOrderById, getOrderItems, payOrder, shipOrder } from '@/api/order';
import { createEvaluation, getEvaluationList, type EvaluationVO } from '@/api/evaluation';
import { getMyMerchants } from '@/api/identity';
import { BrandMark } from '@/components/BrandMark';
import { Panel, StatusTag, money, shortDate } from '../../member-center/shared';
interface Order {
  id: number;
  orderNo: string;
  buyerId: number | string;
  buyerName: string;
  buyerPhone: string;
  sellerId: number | string;
  sellerName: string;
  sellerPhone: string;
  categoryName: string;
  productName?: string;
  totalQuantity?: number;
  goodsAmount: number;
  freightAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  refundAmount?: number;
  paymentStatus: string;
  paymentMethod: string;
  orderStatus: string;
  deliveryProvince: string;
  deliveryCity: string;
  deliveryAddress: string;
  deliveryContact: string;
  deliveryPhone: string;
  deliveryDeadline: string;
  logisticsNo: string;
  logisticsStatus: string;
  buyerConfirmed: number;
  settleStatus: string;
  createTime: string;
}
interface OrderItemRow {
  id: number;
  productId: number;
  productName: string;
  specLevel: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  traceCode: string;
}
const PAYMENT_METHOD: Record<string, string> = {
  transfer: '平台转账',
  wechat: '微信支付',
  alipay: '支付宝',
  bank: '银行转账'
};
const PAYMENT_STATUS: Record<string, string> = {
  unpaid: '未支付',
  paid: '已支付',
  refunded: '已退款'
};
const LOGISTICS_STATUS: Record<string, string> = {
  pending: '待揽收',
  picked: '已揽收',
  in_transit: '运输中',
  delivering: '派送中',
  delivered: '已签收',
  exception: '物流异常'
};

/**
 * 采购订单详情工作台。
 *
 * 金额、订单明细和履约状态全部来自交易接口；支付、发货、收货和退款
 * 继续使用各自的服务端状态机接口，不在页面上直接改状态。
 */
const OrderDetail = defineComponent({
  name: "OrderDetail",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const _routeParams = useParams();
    const navigate = useNavigate();
    const order = shallowRef<Order | null>(null);
    const setOrder = (next: typeof order.value | ((previous: typeof order.value) => typeof order.value)) => {
      order.value = typeof next === 'function' ? (next as (previous: typeof order.value) => typeof order.value)(order.value) : next;
    };
    const items = shallowRef<OrderItemRow[]>([]);
    const setItems = (next: typeof items.value | ((previous: typeof items.value) => typeof items.value)) => {
      items.value = typeof next === 'function' ? (next as (previous: typeof items.value) => typeof items.value)(items.value) : next;
    };
    const loading = shallowRef(true);
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const acting = shallowRef(false);
    const setActing = (next: typeof acting.value | ((previous: typeof acting.value) => typeof acting.value)) => {
      acting.value = typeof next === 'function' ? (next as (previous: typeof acting.value) => typeof acting.value)(acting.value) : next;
    };
    const evalOpen = shallowRef(false);
    const setEvalOpen = (next: typeof evalOpen.value | ((previous: typeof evalOpen.value) => typeof evalOpen.value)) => {
      evalOpen.value = typeof next === 'function' ? (next as (previous: typeof evalOpen.value) => typeof evalOpen.value)(evalOpen.value) : next;
    };
    const evalForm = Form.useForm();
    const refundOpen = shallowRef(false);
    const setRefundOpen = (next: typeof refundOpen.value | ((previous: typeof refundOpen.value) => typeof refundOpen.value)) => {
      refundOpen.value = typeof next === 'function' ? (next as (previous: typeof refundOpen.value) => typeof refundOpen.value)(refundOpen.value) : next;
    };
    const refundForm = Form.useForm();
    const evaluations = shallowRef<EvaluationVO[]>([]);
    const setEvaluations = (next: typeof evaluations.value | ((previous: typeof evaluations.value) => typeof evaluations.value)) => {
      evaluations.value = typeof next === 'function' ? (next as (previous: typeof evaluations.value) => typeof evaluations.value)(evaluations.value) : next;
    };
    const myMerchantIds = shallowRef<string[]>([]);
    const setMyMerchantIds = (next: typeof myMerchantIds.value | ((previous: typeof myMerchantIds.value) => typeof myMerchantIds.value)) => {
      myMerchantIds.value = typeof next === 'function' ? (next as (previous: typeof myMerchantIds.value) => typeof myMerchantIds.value)(myMerchantIds.value) : next;
    };
    const loadEvaluations = () => {
      if (!_routeParams.id) return;
      getEvaluationList({
        pageNum: 1,
        pageSize: 10,
        orderId: String(_routeParams.id)
      }).then((response: {
        code: number;
        data?: {
          records?: EvaluationVO[];
        };
      }) => {
        if (response?.code === 200) setEvaluations(response.data?.records ?? []);
      }).catch(() => setEvaluations([]));
    };
    (() => {
      let dispose: void | (() => void);
      onMounted(() => {
        dispose = (() => {
          getMyMerchants().then(response => {
            if (response?.code === 200) {
              setMyMerchantIds((response.data ?? []).map(item => String(item.merchantId)));
            }
          }).catch(() => setMyMerchantIds([]));
        })();
      });
      onBeforeUnmount(() => {
        if (typeof dispose === 'function') dispose();
      });
    })();
    const load = () => {
      if (!_routeParams.id) return;
      setLoading(true);
      getOrderById(Number(_routeParams.id)).then((response: {
        code: number;
        data?: Order;
        message?: string;
      }) => {
        if (response?.code === 200) setOrder(response.data ?? null);else message.error(response?.message ?? '订单不存在');
      }).catch(() => message.error('加载订单失败')).finally(() => setLoading(false));
      getOrderItems(_routeParams.id).then((response: {
        code: number;
        data?: OrderItemRow[];
      }) => {
        if (response?.code === 200) setItems(response.data ?? []);
      }).catch(() => setItems([]));
      loadEvaluations();
    };
    onMounted(() => {
      watch(() => [_routeParams.id], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          load();
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const handlePay = async (): Promise<void> => {
      if (!_routeParams.id || !order.value) return;
      if (!window.confirm(`确认支付订单 ${order.value.orderNo}，金额 ${money(order.value.totalAmount)}？`)) return;
      setActing(true);
      try {
        const response = await payOrder(_routeParams.id, {
          paymentMethod: order.value.paymentMethod ?? 'transfer'
        });
        if (response?.code === 200) {
          message.success('支付成功');
          load();
        } else {
          message.error(response?.message ?? '支付失败');
        }
      } finally {
        setActing(false);
      }
    };
    const handleShip = async (): Promise<void> => {
      if (!_routeParams.id || !order.value) return;
      if (!window.confirm('确认发货并生成物流单？')) return;
      setActing(true);
      try {
        const response = await shipOrder(_routeParams.id, {
          carrierName: '平台物流',
          carrierNo: order.value.orderNo,
          logisticsType: 'road'
        });
        if (response?.code === 200) {
          message.success('已发货并生成物流单');
          load();
        } else {
          message.error(response?.message ?? '发货失败');
        }
      } finally {
        setActing(false);
      }
    };
    const handleConfirmReceipt = async (): Promise<void> => {
      if (!_routeParams.id || !order.value) return;
      if (!window.confirm('确认已经收到货物？')) return;
      setActing(true);
      try {
        const response = await confirmReceipt(_routeParams.id, {
          signReceiver: order.value.deliveryContact
        });
        if (response?.code === 200) {
          message.success('已确认收货，物流已签收');
          load();
        } else {
          message.error(response?.message ?? '确认收货失败');
        }
      } finally {
        setActing(false);
      }
    };
    const submitEvaluation = async (values: {
      ratingOverall: number;
      evaluationContent: string;
    }): Promise<void> => {
      if (!order.value) return;
      const response = await createEvaluation({
        orderId: order.value.id,
        ratingOverall: values.ratingOverall,
        evaluationContent: values.evaluationContent
      });
      if (response?.code === 200) {
        message.success('评价已提交');
        setEvalOpen(false);
        evalForm.resetFields();
        loadEvaluations();
      } else {
        message.error(response?.message ?? '评价提交失败');
      }
    };
    const submitRefund = async (values: {
      refundType: string;
      refundAmount: number;
      refundReason: string;
    }): Promise<void> => {
      if (!order.value) return;
      const response = await applyOrderRefund(order.value.id, {
        ...values,
        applicantType: 'buyer'
      });
      if (response?.code === 200) {
        message.success('退款申请已提交，等待平台审核');
        setRefundOpen(false);
        refundForm.resetFields();
        load();
      } else {
        message.error(response?.message ?? '退款申请失败');
      }
    };
    return () => {
      const view_order = order.value;
      if (loading.value) {
        return <div class="order-detail-page order-detail-center">
        <Spin size="large" /><span>正在读取订单详情…</span>
      </div>;
      }
      if (!view_order) {
        return <div class="order-detail-page order-detail-center">
        <Empty description="没有找到这笔订单" />
        <button type="button" class="mc-btn" onClick={() => navigate('/member/buyer?tab=purchase')}>
          返回采购订单
        </button>
      </div>;
      }
      const isBuyer = myMerchantIds.value.includes(String(view_order.buyerId));
      const isSeller = myMerchantIds.value.includes(String(view_order.sellerId));
      const canPay = isBuyer && ['pending_confirm', 'pending'].includes(view_order.orderStatus);
      const canRefund = isBuyer && ['received', 'completed'].includes(view_order.orderStatus);
      const canEvaluate = ['received', 'completed'].includes(view_order.orderStatus) && !evaluations.value.some(item => myMerchantIds.value.includes(String(item.evaluatorId)));
      const returnPath = isSeller ? '/member/seller?tab=sales' : '/member/buyer?tab=purchase';
      const flowIndex = view_order.orderStatus === 'pending_confirm' || view_order.orderStatus === 'pending' ? 0 : view_order.orderStatus === 'paid' ? 1 : view_order.orderStatus === 'shipped' ? 2 : ['received', 'completed', 'refunding', 'refunded'].includes(view_order.orderStatus) ? 3 : 0;
      const buyerEvaluation = evaluations.value.find(item => String(item.evaluatorId) === String(view_order.buyerId));
      const sellerEvaluation = evaluations.value.find(item => String(item.evaluatorId) === String(view_order.sellerId));
      return <div class="order-detail-page">
      <header class="order-detail-topbar">
        <a class="order-detail-brand" href="/">
          <span><BrandMark size={32} /></span>
          <strong>丰链云<small>FENGCHAIN · AGRI</small></strong>
        </a>
        <nav>
          <a href={isSeller ? '/member/seller' : '/member/buyer'}>{isSeller ? '卖家中心' : '买家中心'}</a>
          <span>/</span>
          <strong>订单详情</strong>
        </nav>
        <a class="order-detail-back" href={returnPath}><ArrowLeftOutlined /> 返回订单列表</a>
      </header>

      <main class="order-detail-main">
        <section class="order-detail-hero">
          <span class="order-detail-hero-icon"><ShoppingCartOutlined /></span>
          <div class="order-detail-hero-title">
            <small>PURCHASE ORDER · {view_order.orderNo}</small>
            <h1>{view_order.productName || view_order.categoryName || '采购订单'}</h1>
            <p>下单时间 {shortDate(view_order.createTime)} · {isBuyer ? '采购方' : isSeller ? '供货方' : '交易参与方'}视图</p>
          </div>
          <StatusTag status={view_order.orderStatus} side={isSeller ? 'seller' : 'buyer'} />
          <div class="order-detail-actions">
            {canPay && <button type="button" class="mc-btn" disabled={acting.value} onClick={() => void handlePay()}>
                <CreditCardOutlined /> 立即支付 {money(view_order.totalAmount)}
              </button>}
            {isSeller && view_order.orderStatus === 'paid' && <button type="button" class="mc-btn" disabled={acting.value} onClick={() => void handleShip()}>
                <CarOutlined /> 确认发货
              </button>}
            {isBuyer && view_order.orderStatus === 'shipped' && <button type="button" class="mc-btn" disabled={acting.value} onClick={() => void handleConfirmReceipt()}>
                <CheckCircleOutlined /> 确认收货
              </button>}
            {canEvaluate && <button type="button" class="mc-btn ghost" onClick={() => setEvalOpen(true)}>评价交易</button>}
            {canRefund && <button type="button" class="mc-btn ghost order-detail-danger" onClick={() => {
                refundForm.setFieldsValue({
                  refundType: 'return_refund',
                  refundAmount: view_order.paidAmount ?? view_order.totalAmount
                });
                setRefundOpen(true);
              }}>
                申请退货退款
              </button>}
          </div>
        </section>

        <div class="order-detail-layout">
          <div class="order-detail-content">
            <Panel title={`商品明细（${items.value.length}）`} extra={<span class="order-detail-muted">订单金额由服务端核算</span>}>
              {items.value.length === 0 ? <Empty description="这笔订单没有商品明细" /> : <div class="order-detail-products">
                  {items.value.map(item => <div class="order-detail-product" key={item.id}>
                      <span class="order-detail-product-icon"><ShopOutlined /></span>
                      <div>
                        <strong>{item.productName}</strong>
                        <small>{[item.specLevel, item.traceCode ? `溯源码 ${item.traceCode}` : ''].filter(Boolean).join(' · ') || '规格以订单约定为准'}</small>
                      </div>
                      <span>{item.quantity} {item.unit}</span>
                      <span>{money(item.unitPrice)} / {item.unit}</span>
                      <strong class="order-detail-price">{money(item.totalPrice)}</strong>
                    </div>)}
                </div>}
            </Panel>

            <Panel title="交付信息">
              <div class="order-detail-info-grid">
                <div><span><EnvironmentOutlined /> 收货地址</span><strong>{[view_order.deliveryProvince, view_order.deliveryCity, view_order.deliveryAddress].filter(Boolean).join(' ') || '—'}</strong></div>
                <div><span><UserOutlined /> 收货人</span><strong>{view_order.deliveryContact || '—'}</strong></div>
                <div><span><PhoneOutlined /> 联系电话</span><strong>{view_order.deliveryPhone || '—'}</strong></div>
                <div><span><ClockCircleOutlined /> 期望交货</span><strong>{shortDate(view_order.deliveryDeadline)}</strong></div>
              </div>
            </Panel>

            <Panel title={`交易评价（${evaluations.value.length}）`}>
              {evaluations.value.length === 0 ? <Empty description={canEvaluate ? '这笔订单还没有评价，可在订单收货后评价' : '订单进入已收货状态后可进行评价'} /> : <div class="order-detail-reviews">
                  {[{
                    key: 'buyer',
                    label: '采购方评价',
                    row: buyerEvaluation
                  }, {
                    key: 'seller',
                    label: '供货方评价',
                    row: sellerEvaluation
                  }].map(({
                    key,
                    label,
                    row
                  }) => <div class="order-review-card" key={key}>
                      <div><strong>{label}</strong>{row && <Rate disabled value={row.ratingOverall} />}</div>
                      {row ? <>
                          <p>{row.evaluationContent || '未填写文字评价'}</p>
                          <small>{row.evaluatorName} → {row.evaluateeName} · {shortDate(row.createTime)}</small>
                          {row.replyContent && <em>回复：{row.replyContent}</em>}
                        </> : <span class="order-detail-muted">尚未评价</span>}
                    </div>)}
                </div>}
            </Panel>
          </div>

          <aside class="order-detail-aside">
            <Panel title="订单金额">
              <div class="order-amount-list">
                <div><span>货款</span><strong>{money(view_order.goodsAmount)}</strong></div>
                <div><span>运费</span><strong>{money(view_order.freightAmount)}</strong></div>
                <div><span>优惠</span><strong>-{money(view_order.discountAmount)}</strong></div>
                <div class="total"><span>订单总额</span><strong>{money(view_order.totalAmount)}</strong></div>
                <div><span>已付金额</span><strong>{money(view_order.paidAmount)}</strong></div>
                {Number(view_order.refundAmount ?? 0) > 0 && <div><span>已退金额</span><strong>{money(view_order.refundAmount)}</strong></div>}
              </div>
            </Panel>

            <Panel title="履约进度">
              <div class="order-flow">
                {['订单创建', '支付完成', '供应方发货', '买家收货'].map((label, index) => <div class={index <= flowIndex ? 'on' : ''} key={label}>
                    <span>{index <= flowIndex ? <CheckCircleOutlined /> : index + 1}</span>
                    <strong>{label}</strong>
                  </div>)}
              </div>
            </Panel>

            <Panel title="交易双方">
              <div class="order-parties">
                <div><span class="buyer">采</span><div><small>采购方</small><strong>{view_order.buyerName || '—'}</strong></div></div>
                <div><span class="seller">供</span><div><small>供货方</small><strong>{view_order.sellerName || '—'}</strong></div></div>
              </div>
            </Panel>

            <Panel title="物流与支付">
              <div class="order-side-info">
                <div><span>物流单号</span><strong class="mc-mono">{view_order.logisticsNo || '尚未生成'}</strong></div>
                <div><span>物流状态</span><strong>{LOGISTICS_STATUS[view_order.logisticsStatus] ?? view_order.logisticsStatus ?? '—'}</strong></div>
                <div><span>支付方式</span><strong>{PAYMENT_METHOD[view_order.paymentMethod] ?? view_order.paymentMethod ?? '—'}</strong></div>
                <div><span>支付状态</span><strong>{PAYMENT_STATUS[view_order.paymentStatus] ?? view_order.paymentStatus ?? '—'}</strong></div>
              </div>
            </Panel>

            <div class="order-detail-trust">
              <SafetyCertificateOutlined />
              <div><strong>交易数据已留痕</strong><span>订单、支付、物流与售后均可在会员中心追溯。</span></div>
            </div>
          </aside>
        </div>
      </main>

      <Modal class="order-detail-modal" open={evalOpen.value} title="评价这笔交易" onCancel={() => setEvalOpen(false)} onOk={() => evalForm.submit()} okText="提交评价">
        <Form form={evalForm} layout="vertical" onFinish={submitEvaluation}>
          <Form.Item label="综合评分" name="ratingOverall" rules={[{
              required: true,
              message: '请打分'
            }]}>
            <Rate />
          </Form.Item>
          <Form.Item label="评价内容" name="evaluationContent">
            <Input.TextArea rows={4} placeholder="说说商品质量、供应服务和物流情况" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal class="order-detail-modal" open={refundOpen.value} title="申请退款" onCancel={() => setRefundOpen(false)} onOk={() => refundForm.submit()} okText="提交申请">
        <Form form={refundForm} layout="vertical" onFinish={submitRefund}>
          <Form.Item label="退款类型" name="refundType" rules={[{
              required: true,
              message: '请选择退款类型'
            }]}>
            <Select options={[{
                value: 'return_refund',
                label: '退货退款'
              }, {
                value: 'refund_only',
                label: '仅退款（无需退货）'
              }]} />
          </Form.Item>
          <Form.Item label="退款金额（元）" name="refundAmount" rules={[{
              required: true,
              message: '请填写退款金额'
            }]}>
            <InputNumber min={0.01} style={{
                width: '100%'
              }} />
          </Form.Item>
          <Form.Item label="退款原因" name="refundReason" rules={[{
              required: true,
              message: '请填写退款原因'
            }]}>
            <Input.TextArea rows={3} placeholder="例如：到货品质与约定不符" />
          </Form.Item>
        </Form>
      </Modal>
    </div>;
    };
  }
});
export default OrderDetail;
