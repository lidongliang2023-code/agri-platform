import type { DetailRelatedDocItem, DetailStatusBadge, DetailTimelineStep } from '@/components/TradeDetailLayout'
import type { ContractVO } from '@/api/contract'
import type { LogisticsVO } from '@/api/logistics'
import type { RefundRow } from '@/api/order'

export interface TradeOrderDetailRecord {
  id: number
  orderNo: string
  demandId?: number | null
  contractId?: number | null
  buyerId: number | string
  buyerName: string
  buyerPhone?: string | null
  sellerId: number | string
  sellerName: string
  sellerPhone?: string | null
  categoryName?: string | null
  productName?: string | null
  totalQuantity?: number | null
  goodsAmount?: number | null
  freightAmount?: number | null
  discountAmount?: number | null
  totalAmount?: number | null
  paidAmount?: number | null
  refundAmount?: number | null
  paymentStatus?: string | null
  paymentMethod?: string | null
  orderStatus: string
  deliveryProvince?: string | null
  deliveryCity?: string | null
  deliveryDistrict?: string | null
  deliveryAddress?: string | null
  deliveryContact?: string | null
  deliveryPhone?: string | null
  deliveryDeadline?: string | null
  logisticsId?: number | null
  logisticsNo?: string | null
  logisticsStatus?: string | null
  signTime?: string | null
  paymentDeadline?: string | null
  shipDeadline?: string | null
  confirmDeadline?: string | null
  buyerConfirmed?: number | null
  buyerConfirmTime?: string | null
  buyerRemark?: string | null
  sellerRemark?: string | null
  adminRemark?: string | null
  source?: string | null
  sourceOfferNo?: string | null
  p2tWritebackStatus?: string | null
  p2tWritebackMessage?: string | null
  p2tWritebackTime?: string | null
  disputeId?: number | null
  compensationAmount?: number | null
  settleStatus?: string | null
  settleTime?: string | null
  createBy?: string | null
  createTime?: string | null
  updateTime?: string | null
}

export interface TradeOrderItemRecord {
  id: number
  productId?: number
  productName: string
  specLevel?: string | null
  unit?: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
  traceCode?: string | null
}

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  transfer: '平台转账',
  wechat: '微信支付',
  alipay: '支付宝',
  bank: '银行转账',
  online: '线上担保支付',
  offline: '线下对公转账',
}

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  unpaid: '未支付',
  paid: '已支付',
  partial: '部分支付',
  refunded: '已退款',
}

export const LOGISTICS_STATUS_LABEL: Record<string, string> = {
  pending: '待揽收',
  picked: '已揽收',
  in_transit: '运输中',
  delivering: '派送中',
  delivered: '已签收',
  exception: '物流异常',
}

export const LOGISTICS_TYPE_LABEL: Record<string, string> = {
  road: '公路货运',
  cold_chain: '冷链直发',
  express: '快递配送',
  rail: '铁路专线',
  self_pickup: '产地自提',
}

export const SETTLE_STATUS_LABEL: Record<string, string> = {
  unsettled: '待结算',
  pending: '待结算',
  settling: '结算中',
  settled: '已结算',
}

export const ORDER_SOURCE_LABEL: Record<string, string> = {
  quote: '报价转单',
  product: '产地直采',
  demand: '需求撮合',
  p2t: '产销直供',
}

export const REFUND_STATUS_LABEL: Record<string, { label: string; tone: 'orange' | 'green' | 'red' | 'gray' }> = {
  pending: { label: '待审核', tone: 'orange' },
  approved: { label: '已退款', tone: 'green' },
  rejected: { label: '已驳回', tone: 'red' },
}

export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return `¥${Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  return String(value).replace('T', ' ').slice(0, 19)
}

export function formatShortTime(value: string | null | undefined): string {
  if (!value) return ''
  const s = String(value).replace('T', ' ')
  return s.length >= 16 ? s.slice(5, 16) : s
}

export function resolveOrderStatusBadge(
  status: string,
  role?: 'buyer' | 'seller' | 'admin',
): DetailStatusBadge {
  const key = (status || '').toLowerCase()
  switch (key) {
    case 'pending_confirm':
      return { label: '待确认', tone: 'orange' }
    case 'pending':
      return { label: '待付款', tone: 'orange' }
    case 'paid':
      return { label: role === 'admin' ? '已付款' : '待发货', tone: 'blue' }
    case 'shipped':
      return { label: role === 'admin' ? '已发货' : '运输中', tone: 'blue' }
    case 'received':
      return { label: '已收货', tone: 'green' }
    case 'completed':
      return { label: '已完成', tone: 'green' }
    case 'refunding':
      return { label: '退款中', tone: 'red' }
    case 'refunded':
      return { label: '已退款', tone: 'gray' }
    case 'cancelled':
      return { label: '已取消', tone: 'gray' }
    default:
      return { label: status || '未知状态', tone: 'gray' }
  }
}

export function resolveOrderTypeLabel(order: TradeOrderDetailRecord): string {
  if (order.sourceOfferNo) return '产销直供'
  if (order.source && ORDER_SOURCE_LABEL[order.source]) return ORDER_SOURCE_LABEL[order.source]
  if (order.demandId) return '需求撮合'
  return '产地直采'
}

export function resolveOrderProgressSteps(
  order: TradeOrderDetailRecord,
  logistics?: LogisticsVO | null,
): DetailTimelineStep[] {
  const st = (order.orderStatus || '').toLowerCase()
  const isCancelled = st === 'cancelled'
  const isRefunding = st === 'refunding'
  const isRefunded = st === 'refunded'

  const paidDone = ['paid', 'shipped', 'received', 'completed', 'refunding', 'refunded'].includes(st) ||
    order.paymentStatus === 'paid' ||
    order.paymentStatus === 'refunded'
  const shippedDone = ['shipped', 'received', 'completed', 'refunding', 'refunded'].includes(st) ||
    Boolean(order.logisticsNo)
  const receivedDone = ['received', 'completed'].includes(st) || Boolean(order.buyerConfirmed)

  const steps: DetailTimelineStep[] = [
    {
      key: 'created',
      title: '订单已创建',
      time: formatShortTime(order.createTime),
      description: `${order.buyerName || '采购方'}下单 · ${resolveOrderTypeLabel(order)}`,
      state: 'done',
    },
    {
      key: 'payment',
      title: isCancelled ? '订单已取消' : paidDone ? '已完成付款' : st === 'pending_confirm' ? '等待确认付款' : '等待买家付款',
      time: paidDone ? formatShortTime(order.updateTime) : undefined,
      description: isCancelled
        ? '交易终止，未完成资金支付'
        : paidDone
          ? `${PAYMENT_METHOD_LABEL[order.paymentMethod || ''] || '平台支付'} · 已付 ${formatMoney(order.paidAmount ?? order.totalAmount)}`
          : order.paymentDeadline
            ? `支付截止 ${formatShortTime(order.paymentDeadline)}`
            : '待采购方完成订单支付',
      state: isCancelled ? 'error' : paidDone ? 'done' : 'current',
    },
    {
      key: 'ship',
      title: shippedDone ? '供货方已发货' : '确认发货',
      time: formatShortTime(logistics?.pickupTime || logistics?.createTime),
      description: shippedDone
        ? order.logisticsNo
          ? `物流单 ${order.logisticsNo} · ${LOGISTICS_STATUS_LABEL[order.logisticsStatus || ''] || '运输中'}`
          : '已安排发货出库'
        : paidDone && !isCancelled
          ? '当前节点 · 等待供货方发货并录入物流'
          : '待处理',
      state: shippedDone ? 'done' : paidDone && !isCancelled ? 'current' : 'pending',
    },
    {
      key: 'receipt',
      title: isRefunding
        ? '售后退款处理中'
        : isRefunded
          ? '订单已退款关闭'
          : receivedDone
            ? st === 'completed'
              ? '完成收货并结单'
              : '完成收货'
            : '完成收货',
      time: formatShortTime(order.buyerConfirmTime || order.signTime || order.settleTime),
      description: isRefunding
        ? '已提交退款申请，等待平台审核'
        : isRefunded
          ? `累计退款 ${formatMoney(order.refundAmount ?? order.paidAmount)}`
          : receivedDone
            ? order.settleStatus === 'settled'
              ? '资金已结算入账'
              : '买家已确认签收，可进行交易评价'
            : shippedDone && !isCancelled
              ? '当前节点 · 等待采购方验收签收'
              : '待处理',
      state: isRefunding || isRefunded ? 'error' : receivedDone ? 'done' : shippedDone && !isCancelled ? 'current' : 'pending',
    },
  ]

  return steps
}

export interface OrderOperationLogEntry {
  key: string
  time: string
  action: string
  operator: string
  detail: string
}

export function buildOrderOperationLogs(
  order: TradeOrderDetailRecord,
  logistics?: LogisticsVO | null,
  contract?: ContractVO | null,
  refunds: RefundRow[] = [],
): OrderOperationLogEntry[] {
  const logs: OrderOperationLogEntry[] = []

  logs.push({
    key: 'create',
    time: formatDateTime(order.createTime),
    action: '创建订单',
    operator: order.createBy || order.buyerName || '采购方',
    detail: `创建${resolveOrderTypeLabel(order)}订单 ${order.orderNo}，订单总额 ${formatMoney(order.totalAmount)}`,
  })

  if (contract?.contractNo) {
    logs.push({
      key: 'contract',
      time: formatDateTime(contract.signDate || contract.createTime),
      action: '关联合同',
      operator: contract.buyerName || order.buyerName || '交易双方',
      detail: `关联合同 ${contract.contractNo}（${contract.contractName || '采购合同'}）`,
    })
  }

  if (order.paymentStatus === 'paid' || order.paymentStatus === 'refunded' || Number(order.paidAmount ?? 0) > 0) {
    logs.push({
      key: 'pay',
      time: formatDateTime(order.updateTime),
      action: '支付货款',
      operator: order.buyerName || '采购方',
      detail: `通过${PAYMENT_METHOD_LABEL[order.paymentMethod || ''] || '平台通道'}实付 ${formatMoney(order.paidAmount ?? order.totalAmount)}`,
    })
  }

  if (order.logisticsNo || logistics?.logisticsNo) {
    logs.push({
      key: 'ship',
      time: formatDateTime(logistics?.pickupTime || logistics?.createTime || order.updateTime),
      action: '供货发货',
      operator: logistics?.carrierName || order.sellerName || '供货方',
      detail: `生成物流单 ${order.logisticsNo || logistics?.logisticsNo}，当前状态：${LOGISTICS_STATUS_LABEL[order.logisticsStatus || logistics?.logisticsStatus || ''] || '已发货'}`,
    })
  }

  if (order.buyerConfirmed || order.buyerConfirmTime || order.signTime || ['received', 'completed'].includes(order.orderStatus)) {
    logs.push({
      key: 'receipt',
      time: formatDateTime(order.buyerConfirmTime || order.signTime || order.updateTime),
      action: '确认收货',
      operator: order.deliveryContact || order.buyerName || '采购方',
      detail: '采购方已确认收货签收',
    })
  }

  if (order.settleStatus === 'settled' || order.settleTime) {
    logs.push({
      key: 'settle',
      time: formatDateTime(order.settleTime || order.updateTime),
      action: '平台结算',
      operator: '交易结算系统',
      detail: '货款已结算至供货方账户',
    })
  }

  for (const r of refunds) {
    logs.push({
      key: `refund-${r.id}`,
      time: formatDateTime(r.createTime),
      action: '申请退款',
      operator: r.applicantName || order.buyerName || '采购方',
      detail: `退款单 ${r.refundNo} · 金额 ${formatMoney(r.refundAmount)} · ${r.refundReason || '申请售后退款'}`,
    })
    if (r.reviewTime || r.reviewer) {
      logs.push({
        key: `refund-review-${r.id}`,
        time: formatDateTime(r.reviewTime || r.refundTime),
        action: r.refundStatus === 'approved' ? '退款审核通过' : '退款审核驳回',
        operator: r.reviewer || '平台运营',
        detail: r.reviewRemark || `退款单 ${r.refundNo} 状态更新为 ${REFUND_STATUS_LABEL[r.refundStatus]?.label || r.refundStatus}`,
      })
    }
  }

  if (order.sourceOfferNo && order.p2tWritebackStatus) {
    logs.push({
      key: 'p2t-wb',
      time: formatDateTime(order.p2tWritebackTime || order.updateTime),
      action: '产销回写',
      operator: '产销对接服务',
      detail: `来源供给单 ${order.sourceOfferNo} · 回写状态 ${order.p2tWritebackStatus}${order.p2tWritebackMessage ? `（${order.p2tWritebackMessage}）` : ''}`,
    })
  }

  return logs
}

export function buildOrderRelatedDocs(options: {
  order: TradeOrderDetailRecord
  contract?: ContractVO | null
  logistics?: LogisticsVO | null
  refunds?: RefundRow[]
  onOpenContract?: () => void
  onOpenLogistics?: () => void
  onOpenRefunds?: () => void
  onOpenDemand?: () => void
  onOpenP2t?: () => void
}): DetailRelatedDocItem[] {
  const { order, contract, logistics, refunds = [] } = options
  const docs: DetailRelatedDocItem[] = [
    {
      key: 'contract',
      label: '采购合同',
      code: contract?.contractNo || (order.contractId ? `CT-${order.contractId}` : undefined),
      emptyText: '待签署生成',
      badge: contract?.contractStatus === 'signed' ? '已签署' : contract ? '待签署' : undefined,
      badgeTone: contract?.contractStatus === 'signed' ? 'green' : 'orange',
      onClick: contract || order.contractId ? options.onOpenContract : undefined,
    },
    {
      key: 'payment',
      label: '支付凭证',
      text:
        order.paymentStatus === 'paid' || Number(order.paidAmount ?? 0) > 0
          ? `${PAYMENT_METHOD_LABEL[order.paymentMethod || ''] || '线上支付'} · ${formatMoney(order.paidAmount ?? order.totalAmount)}`
          : undefined,
      emptyText: '未支付',
      mono: false,
      badge: PAYMENT_STATUS_LABEL[order.paymentStatus || ''] || undefined,
      badgeTone: order.paymentStatus === 'paid' ? 'green' : order.paymentStatus === 'refunded' ? 'gray' : 'orange',
    },
    {
      key: 'logistics',
      label: '发货物流单',
      code: order.logisticsNo || logistics?.logisticsNo || undefined,
      emptyText: '待生成',
      badge: order.logisticsStatus ? LOGISTICS_STATUS_LABEL[order.logisticsStatus] || order.logisticsStatus : undefined,
      badgeTone: order.logisticsStatus === 'delivered' ? 'green' : order.logisticsStatus ? 'blue' : 'gray',
      onClick: order.logisticsNo || logistics ? options.onOpenLogistics : undefined,
    },
  ]

  if (order.demandId) {
    docs.push({
      key: 'demand',
      label: '关联采购需求',
      code: `DM-${order.demandId}`,
      onClick: options.onOpenDemand,
    })
  }

  if (order.sourceOfferNo) {
    docs.push({
      key: 'p2t',
      label: '产销供给单',
      code: order.sourceOfferNo,
      badge: order.p2tWritebackStatus === 'SUCCESS' ? '已回写' : order.p2tWritebackStatus || undefined,
      badgeTone: order.p2tWritebackStatus === 'SUCCESS' ? 'green' : order.p2tWritebackStatus === 'FAILED' ? 'red' : 'orange',
      onClick: options.onOpenP2t,
    })
  }

  if (refunds.length > 0 || Number(order.refundAmount ?? 0) > 0 || ['refunding', 'refunded'].includes(order.orderStatus)) {
    const latest = refunds[0]
    docs.push({
      key: 'refund',
      label: '售后退款单',
      code: latest?.refundNo,
      text: !latest ? `已退 ${formatMoney(order.refundAmount)}` : undefined,
      emptyText: '处理中',
      badge: latest ? REFUND_STATUS_LABEL[latest.refundStatus]?.label : order.orderStatus === 'refunded' ? '已退款' : '退款中',
      badgeTone: latest ? REFUND_STATUS_LABEL[latest.refundStatus]?.tone : 'orange',
      onClick: options.onOpenRefunds,
    })
  }

  return docs
}
