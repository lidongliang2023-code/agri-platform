import './order-detail.css'
import { computed, defineComponent, onMounted, shallowRef, watch } from 'vue'
import { useNavigate, useParams } from '@/vue/router'
import { Alert, Button, Empty, Form, Input, InputNumber, Modal, Rate, Select, Skeleton, Table, Tag, message } from '@/vue/ui'
import {
  CarOutlined,
  CheckCircleOutlined,
  CreditCardOutlined,
  PrinterOutlined,
  ReloadOutlined,
  RollbackOutlined,
  StarOutlined,
} from '@ant-design/icons-vue'
import {
  applyOrderRefund,
  confirmReceipt,
  getMyRefunds,
  getOrderById,
  getOrderItems,
  payOrder,
  shipOrder,
  type RefundRow,
} from '@/api/order'
import { createEvaluation, getEvaluationList, type EvaluationVO } from '@/api/evaluation'
import { getContractById, getContractList, type ContractVO } from '@/api/contract'
import { getLogisticsList, getLogisticsTraces, type LogisticsTraceVO, type LogisticsVO } from '@/api/logistics'
import { getMyMerchants } from '@/api/identity'
import {
  TradeDetailInfoGrid,
  TradeDetailLayout,
  TradeDetailRelatedDocs,
  TradeDetailSection,
  TradeDetailTimeline,
  type DetailTabEntry,
} from '@/components/TradeDetailLayout'
import { OrderMemberWorkspaceShell } from './OrderMemberWorkspaceShell'
import {
  LOGISTICS_STATUS_LABEL,
  LOGISTICS_TYPE_LABEL,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  REFUND_STATUS_LABEL,
  SETTLE_STATUS_LABEL,
  buildOrderOperationLogs,
  buildOrderRelatedDocs,
  formatDateTime,
  formatMoney,
  resolveOrderProgressSteps,
  resolveOrderStatusBadge,
  resolveOrderTypeLabel,
  type TradeOrderDetailRecord,
  type TradeOrderItemRecord,
} from './orderDetailHelper'

const OrderDetail = defineComponent({
  name: 'OrderDetail',
  setup() {
    const routeParams = useParams<{ id: string }>()
    const navigate = useNavigate()

    const order = shallowRef<TradeOrderDetailRecord | null>(null)
    const items = shallowRef<TradeOrderItemRecord[]>([])
    const evaluations = shallowRef<EvaluationVO[]>([])
    const contract = shallowRef<ContractVO | null>(null)
    const logistics = shallowRef<LogisticsVO | null>(null)
    const traces = shallowRef<LogisticsTraceVO[]>([])
    const refunds = shallowRef<RefundRow[]>([])
    const myMerchants = shallowRef<Array<{ merchantId: string; merchantName: string }>>([])

    const loading = shallowRef(true)
    const loadError = shallowRef<string>('')
    const acting = shallowRef(false)
    const activeTab = shallowRef<string>('overview')

    const evalOpen = shallowRef(false)
    const evalForm = Form.useForm<{ ratingOverall: number; evaluationContent: string }>()
    const refundOpen = shallowRef(false)
    const refundForm = Form.useForm<{ refundType: string; refundAmount: number; refundReason: string }>()

    const myMerchantIds = computed(() => myMerchants.value.map(item => item.merchantId))

    const loadMyMerchants = () => {
      getMyMerchants()
        .then(response => {
          if (response?.code === 200) {
            myMerchants.value = (response.data ?? []).map(item => ({
              merchantId: String(item.merchantId),
              merchantName: item.merchantName || '',
            }))
          }
        })
        .catch(() => {
          myMerchants.value = []
        })
    }

    const loadEvaluations = (id: string) => {
      getEvaluationList({ pageNum: 1, pageSize: 20, orderId: id })
        .then((response: { code: number; data?: { records?: EvaluationVO[] } }) => {
          if (response?.code === 200) evaluations.value = response.data?.records ?? []
          else evaluations.value = []
        })
        .catch(() => {
          evaluations.value = []
        })
    }

    const loadRelatedData = (current: TradeOrderDetailRecord) => {
      contract.value = null
      logistics.value = null
      traces.value = []
      refunds.value = []

      if (current.contractId) {
        getContractById(Number(current.contractId))
          .then((res: { code: number; data?: ContractVO }) => {
            if (res?.code === 200 && res.data) contract.value = res.data
          })
          .catch(() => {})
      } else {
        getContractList({ pageNum: 1, pageSize: 20 })
          .then((res: { code: number; data?: { records?: ContractVO[] } }) => {
            if (res?.code === 200) {
              const matched = (res.data?.records ?? []).find(
                row => Number(row.orderId) === Number(current.id) || (row.orderNo && row.orderNo === current.orderNo),
              )
              if (matched) contract.value = matched
            }
          })
          .catch(() => {})
      }

      getLogisticsList({ pageNum: 1, pageSize: 10, orderId: String(current.id) })
        .then((res: { code: number; data?: { records?: LogisticsVO[] } }) => {
          if (res?.code === 200) {
            const matched = (res.data?.records ?? []).find(row => Number(row.orderId) === Number(current.id)) || res.data?.records?.[0] || null
            logistics.value = matched
            if (matched?.id) {
              getLogisticsTraces(matched.id)
                .then((tRes: { code: number; data?: LogisticsTraceVO[] }) => {
                  if (tRes?.code === 200) traces.value = tRes.data ?? []
                })
                .catch(() => {
                  traces.value = []
                })
            }
          }
        })
        .catch(() => {
          logistics.value = null
          traces.value = []
        })

      getMyRefunds()
        .then((res: { code: number; data?: RefundRow[] }) => {
          if (res?.code === 200) {
            refunds.value = (res.data ?? []).filter(
              row => Number(row.orderId) === Number(current.id) || row.orderNo === current.orderNo,
            )
          }
        })
        .catch(() => {
          refunds.value = []
        })
    }

    const load = () => {
      const idStr = routeParams.id ? String(routeParams.id) : ''
      if (!idStr) return
      loading.value = true
      loadError.value = ''
      getOrderById(Number(idStr))
        .then((response: { code: number; data?: TradeOrderDetailRecord; message?: string }) => {
          if (response?.code === 200 && response.data) {
            order.value = response.data
            loadRelatedData(response.data)
          } else {
            order.value = null
            loadError.value = response?.message ?? '未找到该笔订单'
          }
        })
        .catch(() => {
          order.value = null
          loadError.value = '加载订单详情失败，请稍后重试'
        })
        .finally(() => {
          loading.value = false
        })

      getOrderItems(idStr)
        .then((response: { code: number; data?: TradeOrderItemRecord[] }) => {
          if (response?.code === 200) items.value = response.data ?? []
          else items.value = []
        })
        .catch(() => {
          items.value = []
        })

      loadEvaluations(idStr)
    }

    onMounted(() => {
      loadMyMerchants()
      watch(
        () => routeParams.id,
        () => {
          activeTab.value = 'overview'
          load()
        },
        { immediate: true },
      )
    })

    const handlePay = () => {
      const current = order.value
      if (!routeParams.id || !current) return
      Modal.confirm({
        title: '确认支付该笔订单？',
        content: `订单号 ${current.orderNo}，应付金额 ${formatMoney(current.totalAmount)}。`,
        okText: '确认支付',
        cancelText: '取消',
        onOk: async () => {
          acting.value = true
          try {
            const response = await payOrder(routeParams.id, {
              paymentMethod: current.paymentMethod ?? 'transfer',
            })
            if (response?.code === 200) {
              message.success('支付成功')
              load()
            } else {
              message.error(response?.message ?? '支付失败')
            }
          } finally {
            acting.value = false
          }
        },
      })
    }

    const handleShip = () => {
      const current = order.value
      if (!routeParams.id || !current) return
      Modal.confirm({
        title: '确认发货并生成物流单？',
        content: `订单号 ${current.orderNo}，确认后物流单将自动进入运输中状态。`,
        okText: '确认发货',
        cancelText: '取消',
        onOk: async () => {
          acting.value = true
          try {
            const response = await shipOrder(routeParams.id, {
              carrierName: '平台物流',
              carrierNo: current.orderNo,
              logisticsType: 'road',
            })
            if (response?.code === 200) {
              message.success('已发货并生成物流单')
              load()
            } else {
              message.error(response?.message ?? '发货失败')
            }
          } finally {
            acting.value = false
          }
        },
      })
    }

    const handleConfirmReceipt = () => {
      const current = order.value
      if (!routeParams.id || !current) return
      Modal.confirm({
        title: '确认已经收到货物？',
        content: `订单号 ${current.orderNo}，确认收货后物流单将同步签收。`,
        okText: '确认收货',
        cancelText: '取消',
        onOk: async () => {
          acting.value = true
          try {
            const response = await confirmReceipt(routeParams.id, {
              signReceiver: current.deliveryContact || current.buyerName,
            })
            if (response?.code === 200) {
              message.success('已确认收货，物流已签收')
              load()
            } else {
              message.error(response?.message ?? '确认收货失败')
            }
          } finally {
            acting.value = false
          }
        },
      })
    }

    const submitEvaluation = async (values: { ratingOverall: number; evaluationContent: string }) => {
      if (!order.value) return
      const response = await createEvaluation({
        orderId: order.value.id,
        ratingOverall: values.ratingOverall,
        evaluationContent: values.evaluationContent,
      })
      if (response?.code === 200) {
        message.success('评价已提交')
        evalOpen.value = false
        evalForm.resetFields()
        if (routeParams.id) loadEvaluations(String(routeParams.id))
      } else {
        message.error(response?.message ?? '评价提交失败')
      }
    }

    const submitRefund = async (values: { refundType: string; refundAmount: number; refundReason: string }) => {
      if (!order.value) return
      const response = await applyOrderRefund(order.value.id, {
        ...values,
        applicantType: 'buyer',
      })
      if (response?.code === 200) {
        message.success('退款申请已提交，等待平台审核')
        refundOpen.value = false
        refundForm.resetFields()
        load()
      } else {
        message.error(response?.message ?? '退款申请失败')
      }
    }

    const itemColumns = [
      {
        title: '商品名称',
        dataIndex: 'productName',
        key: 'productName',
        render: (val: string, row: TradeOrderItemRecord) => (
          <div class="trade-order-product-cell">
            <strong>{val || '—'}</strong>
            {row.traceCode && <small>溯源码 {row.traceCode}</small>}
          </div>
        ),
      },
      {
        title: '规格',
        dataIndex: 'specLevel',
        key: 'specLevel',
        width: 150,
        render: (val: string, row: TradeOrderItemRecord) =>
          [val, row.unit ? `按${row.unit}计价` : ''].filter(Boolean).join(' · ') || '以订单约定为准',
      },
      {
        title: '数量',
        dataIndex: 'quantity',
        key: 'quantity',
        width: 120,
        align: 'right' as const,
        render: (val: number, row: TradeOrderItemRecord) => (
          <span class="trade-order-money">
            {Number(val ?? 0).toLocaleString('zh-CN')} {row.unit || ''}
          </span>
        ),
      },
      {
        title: '单价',
        dataIndex: 'unitPrice',
        key: 'unitPrice',
        width: 130,
        align: 'right' as const,
        render: (val: number) => <span class="trade-order-money">{formatMoney(val)}</span>,
      },
      {
        title: '小计',
        dataIndex: 'totalPrice',
        key: 'totalPrice',
        width: 140,
        align: 'right' as const,
        render: (val: number) => <span class="trade-order-money is-strong">{formatMoney(val)}</span>,
      },
    ]

    const logColumns = [
      {
        title: '时间',
        dataIndex: 'time',
        key: 'time',
        width: 180,
        render: (val: string) => <span class="detail-info-mono">{val}</span>,
      },
      {
        title: '节点动作',
        dataIndex: 'action',
        key: 'action',
        width: 130,
        render: (val: string) => <Tag color="green">{val}</Tag>,
      },
      {
        title: '操作主体 / 角色',
        dataIndex: 'operator',
        key: 'operator',
        width: 180,
      },
      {
        title: '详情说明',
        dataIndex: 'detail',
        key: 'detail',
      },
    ]

    return () => {
      const current = order.value
      const isBuyer = Boolean(current && myMerchantIds.value.includes(String(current.buyerId)))
      const isSeller = Boolean(current && myMerchantIds.value.includes(String(current.sellerId)))
      const shellRole: 'buyer' | 'seller' = isSeller && !isBuyer ? 'seller' : 'buyer'
      const matchedMerchant =
        myMerchants.value.find(
          m => current && (m.merchantId === String(current.buyerId) || m.merchantId === String(current.sellerId)),
        )?.merchantName || myMerchants.value[0]?.merchantName || ''
      const returnPath = shellRole === 'seller' ? '/member/seller?tab=sales' : '/member/buyer?tab=purchase'

      if (loading.value) {
        return (
          <OrderMemberWorkspaceShell role={shellRole} merchantName={matchedMerchant} orderNo={routeParams.id ? `#${routeParams.id}` : ''}>
            <TradeDetailLayout
              title="订单详情"
              hasAside={false}
              backLabel={shellRole === 'seller' ? '返回销售订单' : '返回采购订单'}
              onBack={() => navigate(returnPath)}
            >
              <TradeDetailSection>
                <Skeleton active paragraph={{ rows: 9 }} />
              </TradeDetailSection>
            </TradeDetailLayout>
          </OrderMemberWorkspaceShell>
        )
      }

      if (!current) {
        return (
          <OrderMemberWorkspaceShell role={shellRole} merchantName={matchedMerchant}>
            <TradeDetailLayout
              title="订单详情"
              hasAside={false}
              backLabel={shellRole === 'seller' ? '返回销售订单' : '返回采购订单'}
              onBack={() => navigate(returnPath)}
            >
              <TradeDetailSection>
                {loadError.value ? (
                  <Alert
                    type="error"
                    showIcon
                    message="订单详情加载失败"
                    description={loadError.value}
                    action={<Button size="small" onClick={load}>重试</Button>}
                  />
                ) : (
                  <Empty description="没有找到这笔订单" />
                )}
              </TradeDetailSection>
            </TradeDetailLayout>
          </OrderMemberWorkspaceShell>
        )
      }

      const canPay = isBuyer && ['pending_confirm', 'pending'].includes(current.orderStatus)
      const canShip = isSeller && current.orderStatus === 'paid'
      const canConfirm = isBuyer && current.orderStatus === 'shipped'
      const canRefund = isBuyer && ['paid', 'shipped', 'received', 'completed'].includes(current.orderStatus)
      const canEvaluate =
        ['received', 'completed'].includes(current.orderStatus) &&
        !evaluations.value.some(item => myMerchantIds.value.includes(String(item.evaluatorId)))

      const statusBadge = resolveOrderStatusBadge(current.orderStatus, shellRole)
      const extraStatuses = [
        ...(current.paymentStatus
          ? [
              {
                label: PAYMENT_STATUS_LABEL[current.paymentStatus] || current.paymentStatus,
                tone: current.paymentStatus === 'paid' ? 'green' : current.paymentStatus === 'refunded' ? 'gray' : 'orange',
              },
            ]
          : []),
        ...(current.sourceOfferNo ? [{ label: '产销直供', tone: 'blue' }] : []),
      ]

      const tabs: DetailTabEntry[] = [
        { key: 'overview', label: '订单详情' },
        { key: 'items', label: '商品明细', count: items.value.length },
        { key: 'logistics', label: '物流信息', count: traces.value.length > 0 ? traces.value.length : undefined },
        { key: 'logs', label: '操作日志' },
      ]

      const progressSteps = resolveOrderProgressSteps(current, logistics.value)
      const operationLogs = buildOrderOperationLogs(current, logistics.value, contract.value, refunds.value)
      const relatedDocs = buildOrderRelatedDocs({
        order: current,
        contract: contract.value,
        logistics: logistics.value,
        refunds: refunds.value,
        onOpenContract: () => navigate(shellRole === 'seller' ? '/member/seller?tab=contract' : '/member/buyer?tab=contract'),
        onOpenLogistics: () => {
          activeTab.value = 'logistics'
        },
        onOpenRefunds: () => navigate(shellRole === 'seller' ? '/member/seller?tab=after' : '/member/buyer?tab=after'),
        onOpenDemand: () => current.demandId && navigate(`/demand/detail/${current.demandId}`),
      })

      const deliveryAddress =
        [current.deliveryProvince, current.deliveryCity, current.deliveryDistrict, current.deliveryAddress]
          .filter(Boolean)
          .join(' ') || '—'
      const buyerEvaluation = evaluations.value.find(item => String(item.evaluatorId) === String(current.buyerId))
      const sellerEvaluation = evaluations.value.find(item => String(item.evaluatorId) === String(current.sellerId))

      const itemsSummaryFooter = (
        <div class="trade-order-total-bar">
          <div class="trade-order-total-breakdown">
            <span>
              货款 <strong>{formatMoney(current.goodsAmount)}</strong>
            </span>
            <span>
              运费 <strong>{formatMoney(current.freightAmount)}</strong>
            </span>
            {Number(current.discountAmount ?? 0) > 0 && (
              <span>
                优惠 <strong>-{formatMoney(current.discountAmount)}</strong>
              </span>
            )}
            <span>
              已付 <strong>{formatMoney(current.paidAmount)}</strong>
            </span>
            {Number(current.refundAmount ?? 0) > 0 && (
              <span>
                已退 <strong class="trade-order-money is-danger">{formatMoney(current.refundAmount)}</strong>
              </span>
            )}
          </div>
          <div class="trade-order-total-main">
            <span>订单总额</span>
            <strong>{formatMoney(current.totalAmount)}</strong>
          </div>
        </div>
      )

      const renderItemsTable = (limit?: number) => {
        const rows = typeof limit === 'number' ? items.value.slice(0, limit) : items.value
        if (rows.length === 0) {
          return (
            <div style={{ padding: '24px 16px' }}>
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该订单暂无商品明细" />
            </div>
          )
        }
        return (
          <Table
            class="trade-order-items-table"
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={rows}
            columns={itemColumns}
          />
        )
      }

      return (
        <OrderMemberWorkspaceShell role={shellRole} merchantName={matchedMerchant} orderNo={current.orderNo}>
          <TradeDetailLayout
            code={current.orderNo}
            status={statusBadge}
            extraStatuses={extraStatuses}
            meta={[
              { label: '采购商', value: current.buyerName || '—' },
              { label: '供货方', value: current.sellerName || '—' },
              { label: '下单时间', value: formatDateTime(current.createTime) },
            ]}
            tabs={tabs}
            activeTab={activeTab.value}
            backLabel={shellRole === 'seller' ? '返回销售订单' : '返回采购订单'}
            onBack={() => navigate(returnPath)}
            onTabChange={key => {
              activeTab.value = key
            }}
            actions={
              <>
                {/* 次要操作 */}
                <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
                  打印
                </Button>
                <Button icon={<ReloadOutlined />} loading={loading.value} onClick={load}>
                  刷新
                </Button>
                {canEvaluate && (
                  <Button icon={<StarOutlined />} onClick={() => { evalOpen.value = true }}>
                    评价交易
                  </Button>
                )}
                {/* 危险操作 */}
                {canRefund && (
                  <Button
                    danger
                    icon={<RollbackOutlined />}
                    disabled={acting.value}
                    onClick={() => {
                      refundForm.setFieldsValue({
                        refundType: 'return_refund',
                        refundAmount: Number(current.paidAmount ?? current.totalAmount ?? 0),
                      })
                      refundOpen.value = true
                    }}
                  >
                    申请退款
                  </Button>
                )}
                {/* 主要操作 */}
                {canPay && (
                  <Button type="primary" icon={<CreditCardOutlined />} loading={acting.value} onClick={handlePay}>
                    立即支付 {formatMoney(current.totalAmount)}
                  </Button>
                )}
                {canShip && (
                  <Button type="primary" icon={<CarOutlined />} loading={acting.value} onClick={handleShip}>
                    确认发货
                  </Button>
                )}
                {canConfirm && (
                  <Button type="primary" icon={<CheckCircleOutlined />} loading={acting.value} onClick={handleConfirmReceipt}>
                    确认收货
                  </Button>
                )}
              </>
            }
            aside={
              <>
                <TradeDetailSection title="订单进度">
                  <TradeDetailTimeline items={progressSteps} />
                </TradeDetailSection>
                <TradeDetailSection title="关联单据">
                  <TradeDetailRelatedDocs items={relatedDocs} />
                </TradeDetailSection>
              </>
            }
          >
            {activeTab.value === 'overview' && (
              <>
                <TradeDetailSection title="基本信息">
                  <TradeDetailInfoGrid
                    columns={2}
                    items={[
                      { key: 'orderNo', label: '订单号', value: current.orderNo, mono: true },
                      { key: 'type', label: '订单类型', value: resolveOrderTypeLabel(current) },
                      { key: 'buyer', label: '采购商', value: current.buyerName },
                      { key: 'seller', label: '供应商', value: current.sellerName },
                      {
                        key: 'pay',
                        label: '结算方式',
                        value: [
                          PAYMENT_METHOD_LABEL[current.paymentMethod || ''] || current.paymentMethod || '平台结算',
                          SETTLE_STATUS_LABEL[current.settleStatus || ''] || undefined,
                        ]
                          .filter(Boolean)
                          .join(' · '),
                      },
                      {
                        key: 'transport',
                        label: '运输方式',
                        value: logistics.value?.logisticsType
                          ? LOGISTICS_TYPE_LABEL[logistics.value.logisticsType] || logistics.value.logisticsType
                          : current.logisticsNo
                            ? '平台物流'
                            : '待安排发运',
                      },
                      { key: 'category', label: '商品品类', value: current.categoryName || current.productName },
                      {
                        key: 'qty',
                        label: '采购总量',
                        value:
                          current.totalQuantity != null
                            ? Number(current.totalQuantity).toLocaleString('zh-CN')
                            : items.value.length > 0
                              ? `${items.value.reduce((s, r) => s + Number(r.quantity || 0), 0).toLocaleString('zh-CN')}`
                              : '—',
                        mono: true,
                      },
                    ]}
                  />
                </TradeDetailSection>

                <TradeDetailSection title="收货信息">
                  <TradeDetailInfoGrid
                    columns={2}
                    items={[
                      { key: 'contact', label: '收货人', value: current.deliveryContact },
                      { key: 'phone', label: '联系电话', value: current.deliveryPhone, mono: true },
                      { key: 'address', label: '收货地址', value: deliveryAddress, fullWidth: true },
                      {
                        key: 'deadline',
                        label: '要求到货',
                        value: current.deliveryDeadline ? formatDateTime(current.deliveryDeadline) : '以双方约定为准',
                        mono: Boolean(current.deliveryDeadline),
                      },
                      { key: 'remark', label: '履约备注', value: current.buyerRemark || current.sellerRemark || '无特殊要求' },
                    ]}
                  />
                </TradeDetailSection>

                <TradeDetailSection
                  title="商品明细"
                  flush
                  extra={
                    items.value.length > 0 ? (
                      <button
                        type="button"
                        class="trade-detail-section-link"
                        onClick={() => {
                          activeTab.value = 'items'
                        }}
                      >
                        查看全部 {items.value.length} 项
                      </button>
                    ) : undefined
                  }
                  footer={itemsSummaryFooter}
                >
                  {renderItemsTable(5)}
                </TradeDetailSection>

                <TradeDetailSection title={`交易评价（${evaluations.value.length}）`}>
                  {evaluations.value.length === 0 ? (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={canEvaluate ? '订单已收货，点击页头“评价交易”即可完成双方互评' : '订单收货后可查看并提交双方交易评价'}
                    />
                  ) : (
                    <div class="trade-order-reviews-grid">
                      {[
                        { key: 'buyer', label: '采购方评价', row: buyerEvaluation },
                        { key: 'seller', label: '供货方评价', row: sellerEvaluation },
                      ].map(({ key, label, row }) => (
                        <div key={key} class="trade-order-review-card">
                          <div class="trade-order-review-head">
                            <strong>{label}</strong>
                            {row && <Rate disabled value={row.ratingOverall} />}
                          </div>
                          {row ? (
                            <>
                              <p>{row.evaluationContent || '未填写文字评价'}</p>
                              <small>
                                {row.evaluatorName} → {row.evaluateeName} · {formatDateTime(row.createTime)}
                              </small>
                              {row.replyContent && <em class="trade-order-review-reply">回复：{row.replyContent}</em>}
                            </>
                          ) : (
                            <small>尚未提交评价</small>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </TradeDetailSection>
              </>
            )}

            {activeTab.value === 'items' && (
              <TradeDetailSection title={`全部商品明细（${items.value.length} 项）`} flush footer={itemsSummaryFooter}>
                {renderItemsTable()}
              </TradeDetailSection>
            )}

            {activeTab.value === 'logistics' && (
              <>
                <TradeDetailSection title="发运与物流档案">
                  <TradeDetailInfoGrid
                    columns={2}
                    items={[
                      { key: 'no', label: '物流单号', value: current.logisticsNo || logistics.value?.logisticsNo || '尚未生成', mono: Boolean(current.logisticsNo || logistics.value?.logisticsNo) },
                      {
                        key: 'status',
                        label: '物流状态',
                        value: LOGISTICS_STATUS_LABEL[current.logisticsStatus || logistics.value?.logisticsStatus || ''] || current.logisticsStatus || '待发货',
                      },
                      { key: 'carrier', label: '承运商', value: logistics.value?.carrierName || (current.logisticsNo ? '平台物流' : '—') },
                      {
                        key: 'type',
                        label: '运输方式',
                        value: logistics.value?.logisticsType ? LOGISTICS_TYPE_LABEL[logistics.value.logisticsType] || logistics.value.logisticsType : '—',
                      },
                      { key: 'loc', label: '当前位置', value: logistics.value?.currentLocation || '—' },
                      { key: 'sign', label: '签收时间', value: formatDateTime(logistics.value?.signTime || current.signTime), mono: Boolean(logistics.value?.signTime || current.signTime) },
                      { key: 'sender', label: '发货地址', value: logistics.value?.senderAddress || '—', fullWidth: true },
                      { key: 'receiver', label: '收货地址', value: logistics.value?.receiverAddress || deliveryAddress, fullWidth: true },
                    ]}
                  />
                </TradeDetailSection>

                <TradeDetailSection title={`物流轨迹（${traces.value.length}）`}>
                  {traces.value.length === 0 ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={current.logisticsNo ? '暂未同步到物流轨迹节点' : '供货方发货后将在此展示全程物流轨迹'} />
                  ) : (
                    <div class="trade-order-trace-list">
                      {traces.value.map(item => (
                        <div key={item.id} class="trade-order-trace-item">
                          <span class="trade-order-trace-time">{formatDateTime(item.traceTime)}</span>
                          <div class="trade-order-trace-body">
                            <strong>{item.traceLocation || LOGISTICS_STATUS_LABEL[item.traceStatus] || item.traceStatus || '物流节点'}</strong>
                            <span>{item.traceDescription || '已更新运输状态'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TradeDetailSection>
              </>
            )}

            {activeTab.value === 'logs' && (
              <>
                <TradeDetailSection title={`订单流转记录（${operationLogs.length}）`} flush>
                  <Table
                    class="trade-order-log-table"
                    rowKey="key"
                    size="small"
                    pagination={false}
                    dataSource={operationLogs}
                    columns={logColumns}
                  />
                </TradeDetailSection>

                {refunds.value.length > 0 && (
                  <TradeDetailSection title={`关联售后退款记录（${refunds.value.length}）`} flush>
                    <Table
                      class="trade-order-log-table"
                      rowKey="id"
                      size="small"
                      pagination={false}
                      dataSource={refunds.value}
                      columns={[
                        { title: '退款单号', dataIndex: 'refundNo', width: 180, render: (v: string) => <span class="detail-info-mono">{v}</span> },
                        { title: '退款类型', dataIndex: 'refundType', width: 110, render: (v: string) => (v === 'refund_only' ? '仅退款' : '退货退款') },
                        { title: '退款金额', dataIndex: 'refundAmount', width: 130, align: 'right' as const, render: (v: number) => <span class="trade-order-money">{formatMoney(v)}</span> },
                        {
                          title: '审核状态',
                          dataIndex: 'refundStatus',
                          width: 100,
                          render: (v: string) => {
                            const meta = REFUND_STATUS_LABEL[v]
                            return <Tag color={meta?.tone === 'green' ? 'success' : meta?.tone === 'red' ? 'error' : 'warning'}>{meta?.label || v}</Tag>
                          },
                        },
                        { title: '申请原因', dataIndex: 'refundReason' },
                        { title: '申请时间', dataIndex: 'createTime', width: 170, render: (v: string) => <span class="detail-info-mono">{formatDateTime(v)}</span> },
                      ]}
                    />
                  </TradeDetailSection>
                )}
              </>
            )}
          </TradeDetailLayout>

          <Modal
            class="trade-order-detail-modal"
            open={evalOpen.value}
            title="评价这笔交易"
            onCancel={() => { evalOpen.value = false }}
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
            class="trade-order-detail-modal"
            open={refundOpen.value}
            title="申请退款"
            onCancel={() => { refundOpen.value = false }}
            onOk={() => refundForm.submit()}
            okText="提交申请"
          >
            <Form form={refundForm} layout="vertical" onFinish={submitRefund}>
              <Form.Item label="退款类型" name="refundType" rules={[{ required: true, message: '请选择退款类型' }]}>
                <Select
                  options={[
                    { value: 'return_refund', label: '退货退款' },
                    { value: 'refund_only', label: '仅退款（无需退货）' },
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
        </OrderMemberWorkspaceShell>
      )
    }
  },
})

export default OrderDetail
