export function money(value: number | string | undefined) {
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

export const STATUS: Record<string, { label: string; tone: string }> = {
  PENDING_PAY: { label: '待付款', tone: 'orange' },
  PENDING_SHIP: { label: '待发货', tone: 'blue' },
  SHIPPED: { label: '已发货', tone: 'green' },
  COMPLETED: { label: '已完成', tone: 'gray' },
  PENDING: { label: '待结算', tone: 'orange' },
  SETTLED: { label: '已结算', tone: 'green' },
  APPROVED: { label: '已通过', tone: 'green' },
  REJECTED: { label: '已驳回', tone: 'red' },
}

export function statusMeta(status: string) {
  return STATUS[status] || { label: status || '-', tone: 'gray' }
}

export function toast(title: string, icon: 'none' | 'success' | 'error' = 'none') {
  uni.showToast({ title, icon, duration: 1800 })
}
