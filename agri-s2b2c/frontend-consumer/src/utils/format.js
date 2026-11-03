/** 展示层格式化：金额、日期、状态字典。所有金额后端给的是 number/null，缺值一律显示「—」。 */

export function money(value) {
  const num = Number(value)
  if (value === null || value === undefined || value === '' || Number.isNaN(num)) return '—'
  return num.toFixed(2)
}

export function moneyOrZero(value) {
  const num = Number(value)
  return Number.isNaN(num) ? '0.00' : num.toFixed(2)
}

export function dateTime(value) {
  if (!value) return '—'
  const text = String(value).replace('T', ' ')
  return text.length >= 16 ? text.slice(0, 16) : text
}

export function dateOnly(value) {
  if (!value) return '—'
  return String(value).replace('T', ' ').slice(0, 10)
}

export const ORDER_STATUS = {
  PENDING_PAY: { text: '待付款', type: 'warning' },
  PENDING_SHIP: { text: '待发货', type: 'primary' },
  SHIPPED: { text: '已发货', type: 'info' },
  PENDING_RECEIVE: { text: '待收货', type: 'info' },
  COMPLETED: { text: '已完成', type: 'success' },
  CANCELLED: { text: '已取消', type: 'info' },
  REFUNDING: { text: '退款中', type: 'danger' },
  REFUNDED: { text: '已退款', type: 'danger' },
}

export function orderStatusText(status, fallback) {
  return ORDER_STATUS[status]?.text || fallback || status || '—'
}

export const AFTER_SALE_STATUS = {
  PENDING: { text: '待处理', type: 'warning' },
  APPROVED: { text: '已同意', type: 'success' },
  REJECTED: { text: '已驳回', type: 'danger' },
  RETURNING: { text: '退货中', type: 'info' },
  COMPLETED: { text: '已完成', type: 'success' },
  CANCELLED: { text: '已撤销', type: 'info' },
}

export const AFTER_SALE_TYPES = {
  REFUND: '仅退款',
  RETURN: '退货退款',
  EXCHANGE: '换货',
}

export const MEMBER_LEVELS = {
  NORMAL: '普通会员',
  SILVER: '白银会员',
  GOLD: '黄金会员',
  PLATINUM: '铂金会员',
  DIAMOND: '钻石会员',
}

export function memberLevelText(level) {
  return MEMBER_LEVELS[level] || level || '普通会员'
}

/** 优惠券面额展示：满减券给「¥20」，折扣券给「8.5 折」。 */
export function couponValue(coupon) {
  if (!coupon) return '—'
  if (coupon.discountRate != null && Number(coupon.discountRate) > 0) {
    return `${Number(Number(coupon.discountRate).toFixed(1))} 折`
  }
  return `¥${money(coupon.amount)}`
}

export function couponCondition(coupon) {
  const min = Number(coupon?.minAmount || 0)
  return min > 0 ? `满 ${money(min)} 元可用` : '无门槛'
}

/** 商品主图：后端 images 是数组，可能为空或指向不可达的外链。 */
export function firstImage(product) {
  const list = product?.images
  if (Array.isArray(list) && list.length) return list[0]
  if (typeof list === 'string' && list.trim()) return list.split(',')[0].trim()
  return ''
}

/**
 * 演示种子数据的商品图指向临时文生图接口，返回的是「The image is generating」占位图。
 * 直接渲染会让整个商城像坏图，这里统一按「无主图」处理，交给品牌渐变占位。
 * 换成真实图片地址后本函数自动放行，不需要改页面。
 */
const PLACEHOLDER_IMAGE_HOSTS = new Set(['trae-api-cn.mchost.guru'])

export function usableImage(url) {
  if (!url) return ''
  try {
    const host = new URL(url, typeof window === 'undefined' ? 'http://localhost' : window.location.origin).host
    return PLACEHOLDER_IMAGE_HOSTS.has(host) ? '' : url
  } catch {
    return ''
  }
}

/** 页面统一入口：取第一张可用主图，不可用返回空串。 */
export function productImage(product) {
  return usableImage(firstImage(product))
}

/** 秒杀进度：后端只给总库存与剩余库存，进度按「已抢」计算。 */
export function soldPercent(item) {
  const total = Number(item?.totalStock || 0)
  const remain = Number(item?.remainStock || 0)
  if (!total) return 0
  return Math.min(100, Math.max(0, Math.round(((total - remain) / total) * 100)))
}
