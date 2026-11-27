export function money(value: number | string | undefined | null) {
  return `¥${Number(value || 0).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function parseImages(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value
  if (!value) return []
  try {
    const result = JSON.parse(value)
    return Array.isArray(result) ? result : []
  } catch {
    return value.startsWith('http') ? [value] : []
  }
}

export function firstImage(value: string | string[] | undefined) {
  return parseImages(value)[0] || ''
}

export function formatTime(value?: string | null) {
  return value ? String(value).replace('T', ' ').slice(0, 16) : ''
}

export const ORDER_STATUS: Record<string, { label: string; tone: string }> = {
  PENDING_PAY: { label: '待付款', tone: 'orange' },
  PENDING_SHIP: { label: '待发货', tone: 'blue' },
  SHIPPED: { label: '已发货', tone: 'green' },
  PENDING_RECEIVE: { label: '待收货', tone: 'green' },
  COMPLETED: { label: '已完成', tone: 'gray' },
  CANCELLED: { label: '已取消', tone: 'gray' },
  REFUNDING: { label: '退款中', tone: 'orange' },
  REFUNDED: { label: '已退款', tone: 'red' },
}

export const COMMISSION_STATUS: Record<string, { label: string; tone: string }> = {
  PENDING: { label: '待结算', tone: 'orange' },
  SETTLED: { label: '已结算', tone: 'green' },
  CANCELLED: { label: '已作废', tone: 'gray' },
  REVERSED: { label: '已冲回', tone: 'red' },
}

export const AFTER_SALE_STATUS: Record<string, { label: string; tone: string }> = {
  PENDING: { label: '待处理', tone: 'orange' },
  APPROVED: { label: '已同意退款', tone: 'green' },
  RETURNING: { label: '待买家寄回', tone: 'blue' },
  COMPLETED: { label: '已退款', tone: 'gray' },
  REJECTED: { label: '已拒绝', tone: 'red' },
}

export const WITHDRAWAL_STATUS: Record<string, { label: string; tone: string }> = {
  PENDING: { label: '待审核', tone: 'orange' },
  APPROVED: { label: '已通过', tone: 'blue' },
  PAID: { label: '已打款', tone: 'green' },
  REJECTED: { label: '已驳回', tone: 'red' },
}

function meta(map: Record<string, { label: string; tone: string }>, status: string) {
  return map[status] || { label: status || '-', tone: 'gray' }
}

export const orderStatus = (status: string) => meta(ORDER_STATUS, status)
export const commissionStatus = (status: string) => meta(COMMISSION_STATUS, status)
/** RETURNING 同时包含待寄回和已寄回，列表和详情共用此映射。 */
export const afterSaleStatus = (status: string, returnShippedAt?: string | null) =>
  status === 'RETURNING' && returnShippedAt
    ? { label: '待确认收货', tone: 'blue' }
    : meta(AFTER_SALE_STATUS, status)
export const withdrawalStatus = (status: string) => meta(WITHDRAWAL_STATUS, status)

export const CHANNEL_GRADE: Record<string, string> = {
  LEVEL_1: '铜牌渠道',
  LEVEL_2: '银牌渠道',
  LEVEL_3: '金牌渠道',
}

export function channelGradeLabel(grade?: string | null, fallback = '待定级') {
  const raw = String(grade || '').trim()
  if (!raw) return fallback
  return CHANNEL_GRADE[raw.toUpperCase()] || raw
}

export const MEMBER_LEVEL: Record<string, string> = {
  NORMAL: '普通会员',
  SILVER: '白银会员',
  GOLD: '黄金会员',
  PLATINUM: '铂金会员',
  DIAMOND: '钻石会员',
  VIP: 'VIP 会员',
}

export function memberLevelLabel(level?: string | null, fallback = '普通会员') {
  const raw = String(level || '').trim()
  if (!raw) return fallback
  return MEMBER_LEVEL[raw.toUpperCase()] || raw
}

export function afterSaleTypeLabel(type: string) {
  return type === 'RETURN' ? '退货退款' : type === 'REFUND' ? '仅退款' : type || '售后'
}

export function toast(title: string, icon: 'none' | 'success' | 'error' = 'none') {
  uni.showToast({ title, icon, duration: 1800 })
}

export function confirmAction(title: string, content: string): Promise<boolean> {
  return new Promise((resolve) => {
    uni.showModal({ title, content, success: (result) => resolve(!!result.confirm), fail: () => resolve(false) })
  })
}

/** 弹出带输入框的确认框（App / 小程序 / H5 都支持 editable） */
export function promptText(title: string, placeholder: string): Promise<string | null> {
  return new Promise((resolve) => {
    uni.showModal({
      title,
      editable: true,
      placeholderText: placeholder,
      success: (result) => resolve(result.confirm ? String((result as { content?: string }).content || '').trim() : null),
      fail: () => resolve(null),
    })
  })
}
