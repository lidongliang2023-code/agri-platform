import '@/pages/order/detail/order-detail.css'
import { defineComponent, onMounted, shallowRef, watch } from 'vue'
import { useNavigate, useParams } from '@/vue/router'
import { Alert, Button, Empty, Skeleton, Table, Tag } from '@/vue/ui'
import { PrinterOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import { getAdminOrderDetail } from '@/api/admin'
import {
  TradeDetailInfoGrid,
  TradeDetailLayout,
  TradeDetailRelatedDocs,
  TradeDetailSection,
  TradeDetailTimeline,
  type DetailTabEntry,
} from '@/components/TradeDetailLayout'
import {
  LOGISTICS_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
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
} from '@/pages/order/detail/orderDetailHelper'

/**
 * 运营端订单监管详情页（/admin/trade/order/:id）。
 * 严格遵循平台统一详情页设计规范：吸顶页头 + 内嵌页签 + 左侧双列信息/子表 + 右侧 340px 进度与关联单据。
 */
const AdminOrderDetail = defineComponent({
  name: 'AdminOrderDetail',
  setup() {
    const routeParams = useParams<{ id: string }>()
    const navigate = useNavigate()

    const order = shallowRef<TradeOrderDetailRecord | null>(null)
    const items = shallowRef<TradeOrderItemRecord[]>([])
    const loading = shallowRef(true)
    const loadError = shallowRef('')
    const activeTab = shallowRef('overview')

    const load = () => {
      const idStr = routeParams.id ? String(routeParams.id) : ''
      if (!idStr) return
      loading.value = true
      loadError.value = ''
      getAdminOrderDetail(idStr)
        .then((res: { code: number; data?: { order?: TradeOrderDetailRecord; items?: TradeOrderItemRecord[] }; message?: string }) => {
          if (res?.code === 200 && res.data?.order) {
            order.value = res.data.order
            items.value = res.data.items ?? []
          } else {
            order.value = null
            items.value = []
            loadError.value = res?.message ?? '未找到该笔订单'
          }
        })
        .catch(() => {
          order.value = null
          items.value = []
          loadError.value = '加载订单监管详情失败，请检查后端服务状态'
        })
        .finally(() => {
          loading.value = false
        })
    }

    onMounted(() => {
      watch(
        () => routeParams.id,
        () => {
          activeTab.value = 'overview'
          load()
        },
        { immediate: true },
      )
    })

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
          [val, row.unit ? `按${row.unit}计价` : ''].filter(Boolean).join(' · ') || '—',
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
      if (loading.value) {
        return (
          <div class="trade-admin-order-detail-wrap">
            <TradeDetailLayout
              title="订单监管详情"
              hasAside={false}
              backLabel="返回订单监管"
              onBack={() => navigate('/admin/trade/order')}
            >
              <TradeDetailSection>
                <Skeleton active paragraph={{ rows: 9 }} />
              </TradeDetailSection>
            </TradeDetailLayout>
          </div>
        )
      }

      const current = order.value
      if (!current) {
        return (
          <div class="trade-admin-order-detail-wrap">
            <TradeDetailLayout
              title="订单监管详情"
              hasAside={false}
              backLabel="返回订单监管"
              onBack={() => navigate('/admin/trade/order')}
            >
              <TradeDetailSection>
                {loadError.value ? (
                  <Alert
                    type="error"
                    showIcon
                    message="订单监管详情加载失败"
                    description={loadError.value}
                    action={<Button size="small" onClick={load}>重试</Button>}
                  />
                ) : (
                  <Empty description="未找到该笔订单" />
                )}
              </TradeDetailSection>
            </TradeDetailLayout>
          </div>
        )
      }

      const statusBadge = resolveOrderStatusBadge(current.orderStatus, 'admin')
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
        { key: 'logistics', label: '物流信息' },
        { key: 'logs', label: '操作日志' },
      ]

      const progressSteps = resolveOrderProgressSteps(current)
      const operationLogs = buildOrderOperationLogs(current)
      const relatedDocs = buildOrderRelatedDocs({
        order: current,
        onOpenLogistics: () => {
          activeTab.value = 'logistics'
        },
        onOpenRefunds: () => navigate('/admin/trade/refund'),
        onOpenP2t: () => navigate('/admin/trade/p2t/orders'),
      })

      const deliveryAddress =
        [current.deliveryProvince, current.deliveryCity, current.deliveryDistrict, current.deliveryAddress]
          .filter(Boolean)
          .join(' ') || '—'

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
        <div class="trade-admin-order-detail-wrap">
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
            backLabel="返回订单监管"
            onBack={() => navigate('/admin/trade/order')}
            onTabChange={key => {
              activeTab.value = key
            }}
            actions={
              <>
                <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
                  打印
                </Button>
                <Button icon={<ReloadOutlined />} loading={loading.value} onClick={load}>
                  刷新
                </Button>
                {current.orderStatus === 'refunding' && (
                  <Button type="primary" onClick={() => navigate('/admin/trade/refund')}>
                    前往退款审核
                  </Button>
                )}
                {current.orderStatus !== 'refunding' && current.sourceOfferNo && (
                  <Button type="primary" onClick={() => navigate('/admin/trade/p2t/orders')}>
                    产销回写台账
                  </Button>
                )}
                {current.orderStatus !== 'refunding' && !current.sourceOfferNo && (
                  <Button type="primary" onClick={() => navigate('/admin/trade/settlement')}>
                    结算与分账
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
                      { key: 'category', label: '商品品类', value: current.categoryName || current.productName },
                      {
                        key: 'paid',
                        label: '已付金额',
                        value: formatMoney(current.paidAmount),
                        mono: true,
                      },
                      {
                        key: 'total',
                        label: '订单总额',
                        value: formatMoney(current.totalAmount),
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
                      { key: 'remark', label: '履约备注', value: current.adminRemark || current.buyerRemark || current.sellerRemark || '无特殊要求' },
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
              </>
            )}

            {activeTab.value === 'items' && (
              <TradeDetailSection title={`全部商品明细（${items.value.length} 项）`} flush footer={itemsSummaryFooter}>
                {renderItemsTable()}
              </TradeDetailSection>
            )}

            {activeTab.value === 'logistics' && (
              <TradeDetailSection title="发运与物流档案">
                <TradeDetailInfoGrid
                  columns={2}
                  items={[
                    { key: 'no', label: '物流单号', value: current.logisticsNo || '尚未生成', mono: Boolean(current.logisticsNo) },
                    {
                      key: 'status',
                      label: '物流状态',
                      value: LOGISTICS_STATUS_LABEL[current.logisticsStatus || ''] || current.logisticsStatus || '待发货',
                    },
                    { key: 'contact', label: '收货人', value: current.deliveryContact },
                    { key: 'phone', label: '联系电话', value: current.deliveryPhone, mono: true },
                    { key: 'signTime', label: '签收时间', value: formatDateTime(current.signTime || current.buyerConfirmTime), mono: Boolean(current.signTime || current.buyerConfirmTime) },
                    { key: 'settleTime', label: '结算时间', value: formatDateTime(current.settleTime), mono: Boolean(current.settleTime) },
                    { key: 'address', label: '收货地址', value: deliveryAddress, fullWidth: true },
                  ]}
                />
              </TradeDetailSection>
            )}

            {activeTab.value === 'logs' && (
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
            )}
          </TradeDetailLayout>
        </div>
      )
    }
  },
})

export default AdminOrderDetail
