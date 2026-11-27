export function formatMoney(value) {
  const num = Number(value || 0)
  return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatDateTime(value) {
  if (!value) return '—'
  return String(value).replace('T', ' ').slice(0, 19)
}

export function formatShortTime(value) {
  if (!value) return ''
  const s = String(value).replace('T', ' ')
  return s.length >= 16 ? s.slice(5, 16) : s
}

export function maskPhone(phone) {
  const s = String(phone || '').trim()
  if (!s) return '—'
  if (/^1\d{10}$/.test(s)) return `${s.slice(0, 3)}****${s.slice(7)}`
  return s
}

export const ORDER_STATUS_META = {
  PENDING_PAY: { label: '待付款', tone: 'orange', elType: 'warning' },
  PENDING_SHIP: { label: '待发货', tone: 'orange', elType: 'warning' },
  SHIPPED: { label: '已发货', tone: 'blue', elType: 'primary' },
  PENDING_RECEIVE: { label: '待收货', tone: 'blue', elType: 'primary' },
  COMPLETED: { label: '已完成', tone: 'green', elType: 'success' },
  CANCELLED: { label: '已取消', tone: 'gray', elType: 'info' },
  REFUNDING: { label: '退款中', tone: 'red', elType: 'danger' },
  REFUNDED: { label: '已退款', tone: 'red', elType: 'danger' },
}

export function resolveOrderStatus(status) {
  const key = String(status || '').toUpperCase()
  return ORDER_STATUS_META[key] || { label: status || '未知状态', tone: 'gray', elType: 'info' }
}

export const SHIPMENT_STATUS_META = {
  PROPOSED: { label: '待对方确认', tone: 'orange', elType: 'warning' },
  CONFIRMED: { label: '已确认发货', tone: 'green', elType: 'success' },
  REJECTED: { label: '已驳回', tone: 'red', elType: 'danger' },
  CANCELLED: { label: '已撤回', tone: 'gray', elType: 'info' },
}

export function resolveShipmentStatus(status) {
  const key = String(status || '').toUpperCase()
  return SHIPMENT_STATUS_META[key] || { label: status || '未发起', tone: 'gray', elType: 'info' }
}

export const AFTER_SALE_TYPE_MAP = {
  REFUND_ONLY: '仅退款',
  REFUND: '仅退款',
  RETURN_REFUND: '退货退款',
  RETURN: '退货退款',
  EXCHANGE: '换货',
}

export function resolveAfterSaleType(type) {
  const key = String(type || '').toUpperCase()
  return AFTER_SALE_TYPE_MAP[key] || type || '售后申请'
}

export const AFTER_SALE_STATUS_META = {
  PENDING: { label: '待处理', tone: 'orange', elType: 'warning' },
  APPROVED: { label: '已同意', tone: 'green', elType: 'success' },
  WAIT_RETURN: { label: '待退货', tone: 'blue', elType: 'primary' },
  RETURNING: { label: '退货中', tone: 'blue', elType: 'primary' },
  COMPLETED: { label: '已完成', tone: 'green', elType: 'success' },
  REJECTED: { label: '已拒绝', tone: 'red', elType: 'danger' },
  CANCELLED: { label: '已取消', tone: 'gray', elType: 'info' },
}

export function resolveAfterSaleStatus(status) {
  const key = String(status || '').toUpperCase()
  return AFTER_SALE_STATUS_META[key] || { label: status || '未知', tone: 'gray', elType: 'info' }
}

export const COMMISSION_STATUS_META = {
  PENDING: { label: '待结算', tone: 'orange', elType: 'warning' },
  FROZEN: { label: '冻结中', tone: 'orange', elType: 'warning' },
  SETTLED: { label: '已结算', tone: 'green', elType: 'success' },
  REVERSED: { label: '已冲回', tone: 'red', elType: 'danger' },
  CANCELLED: { label: '已取消', tone: 'gray', elType: 'info' },
}

export function resolveCommissionStatus(status) {
  const key = String(status || '').toUpperCase()
  return COMMISSION_STATUS_META[key] || { label: status || '—', tone: 'gray', elType: 'info' }
}

export const AUDIT_STATUS_META = {
  PENDING: { label: '待审核', tone: 'orange', elType: 'warning' },
  APPROVED: { label: '已通过', tone: 'green', elType: 'success' },
  REJECTED: { label: '已驳回', tone: 'red', elType: 'danger' },
  OFF_SHELF: { label: '已下架', tone: 'gray', elType: 'info' },
}

export function resolveAuditStatus(status) {
  const key = String(status || '').toUpperCase()
  return AUDIT_STATUS_META[key] || { label: status || '未知', tone: 'gray', elType: 'info' }
}

export const MEMBER_LEVEL_META = {
  NORMAL: { label: '普通会员', tone: 'green', elType: 'success' },
  SILVER: { label: '白银会员', tone: 'blue', elType: 'primary' },
  GOLD: { label: '黄金会员', tone: 'orange', elType: 'warning' },
  PLATINUM: { label: '铂金会员', tone: 'blue', elType: 'primary' },
  DIAMOND: { label: '钻石会员', tone: 'blue', elType: 'primary' },
  VIP: { label: 'VIP 会员', tone: 'orange', elType: 'warning' },
}

export function resolveMemberLevel(level) {
  const raw = String(level || '').trim()
  if (!raw) return { label: '普通会员', tone: 'green', elType: 'success' }
  const key = raw.toUpperCase()
  if (MEMBER_LEVEL_META[key]) return MEMBER_LEVEL_META[key]
  const isHigh = /金|钻|VIP|黑金/i.test(raw)
  return { label: raw, tone: isHigh ? 'blue' : 'green', elType: isHigh ? 'primary' : 'success' }
}

export const HEALTH_META = {
  HEALTHY: { label: '优质', tone: 'green', elType: 'success' },
  NORMAL: { label: '正常', tone: 'blue', elType: 'primary' },
  RISK: { label: '售后风险', tone: 'red', elType: 'danger' },
  SLEEPING: { label: '沉默', tone: 'gray', elType: 'info' },
}

export function resolveHealthStatus(health) {
  const key = String(health || '').toUpperCase()
  return HEALTH_META[key] || { label: health || '—', tone: 'gray', elType: 'info' }
}

export function resolveGradeText(grade) {
  return { LEVEL_1: '铜牌 (LEVEL_1)', LEVEL_2: '银牌 (LEVEL_2)', LEVEL_3: '金牌 (LEVEL_3)' }[grade] || grade || '—'
}

export const COMMON_CERTIFICATIONS = [
  '有机认证',
  '绿色食品',
  '地理标志',
  '无公害农产品',
  'GAP 良好农业规范',
  'HACCP 认证',
  'ISO22000 认证',
  '可追溯认证',
]

const CERTIFICATION_LABEL_MAP = {
  ORGANIC: '有机认证',
  ORGANIC_FOOD: '有机认证',
  GREEN: '绿色食品',
  GREEN_FOOD: '绿色食品',
  GI: '地理标志',
  PGI: '地理标志',
  GEO_INDICATION: '地理标志',
  GEOGRAPHICAL_INDICATION: '地理标志',
  POLLUTION_FREE: '无公害农产品',
  HAZARD_FREE: '无公害农产品',
  GAP: 'GAP 良好农业规范',
  GLOBAL_GAP: 'GAP 良好农业规范',
  HACCP: 'HACCP 认证',
  ISO22000: 'ISO22000 认证',
  HALAL: '清真认证',
  TRACEABLE: '可追溯认证',
}

function normalizeCertificationLabel(item) {
  if (item == null) return ''
  const raw = typeof item === 'object' ? (item.label ?? item.name ?? item.value ?? '') : String(item)
  const text = String(raw).trim().replace(/^["'[\]]+|["'[\]]+$/g, '').trim()
  if (!text) return ''
  const upper = text.toUpperCase().replace(/[\s-]+/g, '_')
  return CERTIFICATION_LABEL_MAP[upper] || text
}

/** 解析商品认证资质字段（兼容 JSON 数组字符串、数组、顿号/逗号分隔文本与英文编码），输出去重后的中文标签数组 */
export function parseCertifications(raw) {
  if (raw == null || raw === '') return []
  let items = []
  if (Array.isArray(raw)) {
    items = raw
  } else {
    let text = String(raw).trim()
    if (!text) return []
    let parsed = null
    for (let i = 0; i < 2; i += 1) {
      if ((text.startsWith('[') && text.endsWith(']')) || (text.startsWith('"') && text.endsWith('"'))) {
        try {
          parsed = JSON.parse(text)
          if (typeof parsed === 'string') {
            text = parsed.trim()
            parsed = null
            continue
          }
          break
        } catch {
          break
        }
      }
      break
    }
    if (Array.isArray(parsed)) {
      items = parsed
    } else if (parsed && typeof parsed === 'object') {
      items = [parsed]
    } else {
      items = text.split(/[,，、;；|]/).map((s) => s.trim()).filter(Boolean)
    }
  }
  const seen = new Set()
  const result = []
  for (const entry of items) {
    const label = normalizeCertificationLabel(entry)
    if (label && !seen.has(label)) {
      seen.add(label)
      result.push(label)
    }
  }
  return result
}

export function serializeCertifications(list) {
  const normalized = parseCertifications(list)
  return normalized.length ? JSON.stringify(normalized) : ''
}

export function resolveProposerText(proposerType, selfSide = '') {
  const key = String(proposerType || '').toUpperCase()
  if (key === 'SUPPLIER') return selfSide === 'SUPPLIER' ? '供应商（我方）' : '供应商'
  if (key === 'CHANNEL') return selfSide === 'CHANNEL' ? '渠道商家（我方）' : '渠道商家'
  if (key === 'PLATFORM') return '平台运营'
  return proposerType || '—'
}

export function buildS2b2cOrderTimeline(order, shipment, afterSales = []) {
  const status = String(order?.status || '').toUpperCase()
  const isCancelled = status === 'CANCELLED'
  const isRefunding = status === 'REFUNDING'
  const isRefunded = status === 'REFUNDED'

  const paid = Boolean(order?.payTime) || ['PENDING_SHIP', 'SHIPPED', 'PENDING_RECEIVE', 'COMPLETED', 'REFUNDING', 'REFUNDED'].includes(status)
  const shipped = Boolean(order?.shipTime || order?.logisticsNo) || ['SHIPPED', 'PENDING_RECEIVE', 'COMPLETED'].includes(status)
  const completed = status === 'COMPLETED'

  const steps = [
    {
      key: 'created',
      title: '订单已创建',
      time: formatShortTime(order?.createTime) || '已提交',
      state: 'done',
    },
  ]

  if (isCancelled) {
    steps.push({
      key: 'cancelled',
      title: '订单已取消',
      time: formatShortTime(order?.updateTime) || '交易终止',
      description: '订单关闭，不进入履约与分润结算',
      state: 'error',
    })
    steps.push({ key: 'ship', title: '确认发货', time: '已中止', state: 'pending' })
    steps.push({ key: 'done', title: '完成收货', time: '已中止', state: 'pending' })
    return steps
  }

  steps.push({
    key: 'pay',
    title: paid ? '已完成支付' : '等待付款',
    time: paid ? (formatShortTime(order?.payTime) || '已支付') : '当前节点',
    description: paid ? `实付 ¥${formatMoney(order?.payAmount)}` : '等待买家完成付款',
    state: paid ? 'done' : 'current',
  })

  if (shipped) {
    steps.push({
      key: 'ship',
      title: '已确认发货',
      time: formatShortTime(order?.shipTime || shipment?.confirmTime || shipment?.createTime) || '已出库',
      description: [order?.logisticsCompany, order?.logisticsNo].filter(Boolean).join(' · ') || '物流已揽收',
      state: 'done',
    })
  } else if (paid) {
    const collabDesc = shipment?.status === 'PROPOSED'
      ? `发货协同待确认（${resolveProposerText(shipment.proposerType)}已提交）`
      : shipment?.status === 'REJECTED'
        ? '发货协同已驳回，待重新提交'
        : '等待回传物流单号并确认发货'
    steps.push({
      key: 'ship',
      title: '确认发货',
      time: '当前节点',
      description: collabDesc,
      state: isRefunding || isRefunded ? 'pending' : 'current',
    })
  } else {
    steps.push({
      key: 'ship',
      title: '确认发货',
      time: '待处理',
      state: 'pending',
    })
  }

  if (isRefunding || isRefunded) {
    steps.push({
      key: 'refund',
      title: isRefunded ? '已退款关闭' : '售后退款处理中',
      time: formatShortTime(afterSales?.[0]?.createTime || order?.updateTime) || '处理中',
      description: afterSales?.length ? `涉及 ${afterSales.length} 条售后单` : '进入退款流程',
      state: isRefunded ? 'error' : 'current',
    })
  } else if (completed) {
    steps.push({
      key: 'done',
      title: '完成收货',
      time: formatShortTime(order?.receiveTime || order?.completeTime || order?.updateTime) || '已完成',
      description: '买家已确认收货，进入分润结算',
      state: 'done',
    })
  } else if (shipped) {
    steps.push({
      key: 'done',
      title: '等待确认收货',
      time: '当前节点',
      description: '商品运输途中，待买家签收',
      state: 'current',
    })
  } else {
    steps.push({
      key: 'done',
      title: '完成收货',
      time: '待处理',
      state: 'pending',
    })
  }

  return steps
}

export function buildS2b2cOrderLogs(order, shipment, afterSales = [], commissions = []) {
  const logs = []
  if (order?.createTime) {
    logs.push({
      key: 'create',
      time: formatDateTime(order.createTime),
      actor: '消费者下单',
      action: '创建订单',
      detail: `订单号 ${order.orderNo || order.id}，商品总额 ¥${formatMoney(order.totalAmount)}`,
    })
  }
  if (order?.payTime) {
    logs.push({
      key: 'pay',
      time: formatDateTime(order.payTime),
      actor: '支付通道',
      action: '支付成功',
      detail: `${order.payMethod || '线上支付'} · 实付 ¥${formatMoney(order.payAmount)}`,
    })
  }
  if (shipment?.createTime) {
    logs.push({
      key: 'ship-propose',
      time: formatDateTime(shipment.createTime),
      actor: resolveProposerText(shipment.proposerType),
      action: `发货协同 · ${resolveShipmentStatus(shipment.status).label}`,
      detail: [shipment.logisticsCompany, shipment.logisticsNo, shipment.reason ? `原因：${shipment.reason}` : ''].filter(Boolean).join(' · ') || '—',
    })
  }
  if (order?.shipTime || order?.logisticsNo) {
    logs.push({
      key: 'shipped',
      time: formatDateTime(order.shipTime || shipment?.confirmTime || order.updateTime),
      actor: '履约系统',
      action: '订单已发货',
      detail: [order.logisticsCompany || '标准物流', order.logisticsNo || ''].filter(Boolean).join(' · '),
    })
  }
  for (const [idx, item] of (afterSales || []).entries()) {
    logs.push({
      key: `after-sale-${item.id || idx}`,
      time: formatDateTime(item.createTime),
      actor: '售后工单',
      action: `${resolveAfterSaleType(item.type)} · ${resolveAfterSaleStatus(item.status).label}`,
      detail: `金额 ¥${formatMoney(item.amount)}${item.reason ? ` · ${item.reason}` : ''}${item.handleOpinion ? ` · 意见：${item.handleOpinion}` : ''}`,
    })
  }
  for (const [idx, c] of (commissions || []).entries()) {
    if (!c) continue
    if (c.settleTime || c.status === 'SETTLED') {
      logs.push({
        key: `commission-${c.id || idx}`,
        time: formatDateTime(c.settleTime || order?.updateTime),
        actor: '结算引擎',
        action: `渠道佣金 · ${resolveCommissionStatus(c.status).label}`,
        detail: `佣金 ¥${formatMoney(c.amount)}（比例 ${Number(c.rate || 0)}%）${c.settleBatchNo ? ` · 批次 ${c.settleBatchNo}` : ''}`,
      })
    }
  }
  if (order?.status === 'COMPLETED') {
    logs.push({
      key: 'complete',
      time: formatDateTime(order.receiveTime || order.completeTime || order.updateTime),
      actor: '交易系统',
      action: '交易完成',
      detail: '买家确认收货，履约闭环',
    })
  } else if (order?.status === 'CANCELLED') {
    logs.push({
      key: 'cancel',
      time: formatDateTime(order.updateTime),
      actor: '交易系统',
      action: '订单取消',
      detail: '订单已关闭',
    })
  }
  return logs.sort((a, b) => String(b.time || '').localeCompare(String(a.time || '')))
}
