import type { Product } from './api'

export function money(value: number | string | undefined): string {
  return `¥${Number(value || 0).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function firstImage(images: string[] | undefined): string {
  return Array.isArray(images) && images.length ? images[0] : ''
}

export function certificationsText(value: string | undefined): string {
  if (!value) return ''
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.join(' · ') : value
  } catch {
    return value.replace(/[\[\]"']/g, '')
  }
}

export function openProduct(product: Pick<Product, 'id'>) {
  uni.navigateTo({ url: `/pages/product/detail?id=${product.id}` })
}

export const STATUS_META: Record<string, { label: string; tone: string }> = {
  PENDING_PAY: { label: '待付款', tone: 'orange' },
  PENDING_SHIP: { label: '待发货', tone: 'blue' },
  SHIPPED: { label: '已发货', tone: 'green' },
  COMPLETED: { label: '已完成', tone: 'gray' },
  REFUNDED: { label: '已退款', tone: 'red' },
  PENDING: { label: '待审核', tone: 'orange' },
  APPROVED: { label: '已通过', tone: 'green' },
  REJECTED: { label: '已驳回', tone: 'red' },
  SETTLED: { label: '已结算', tone: 'green' },
}

export function statusMeta(status: string): { label: string; tone: string } {
  return STATUS_META[status] || { label: status, tone: 'gray' }
}

export function toast(title: string, icon: 'none' | 'success' | 'error' = 'none') {
  uni.showToast({ title, icon, duration: 1800 })
}
