export function money(value: number | string | null | undefined) {
  return `¥${Number(value || 0).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function firstImage(images: string | string[] | undefined) {
  return parseImages(images)[0] || ''
}

export function parseImages(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value
  if (!value) return []
  try {
    const result = JSON.parse(value)
    return Array.isArray(result) ? result : []
  } catch {
    return value.startsWith('http') ? [value] : []
  }
}

export const STATUS: Record<string, { label: string; tone: string }> = {
  PENDING_PAY: { label: '待付款', tone: 'orange' },
  PENDING_SHIP: { label: '待发货', tone: 'blue' },
  SHIPPED: { label: '已发货', tone: 'green' },
  COMPLETED: { label: '已完成', tone: 'gray' },
  PENDING: { label: '待审核', tone: 'orange' },
  APPROVED: { label: '已通过', tone: 'green' },
  REJECTED: { label: '已拒绝', tone: 'red' },
}

export function statusMeta(status: string) {
  return STATUS[status] || { label: status || '-', tone: 'gray' }
}

export function toast(title: string, icon: 'none' | 'success' | 'error' = 'none') {
  uni.showToast({ title, icon, duration: 1800 })
}
