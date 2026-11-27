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
  PENDING_RECEIVE: { label: '待收货', tone: 'green' },
  COMPLETED: { label: '已完成', tone: 'gray' },
  CANCELLED: { label: '已取消', tone: 'gray' },
  REFUNDING: { label: '退款中', tone: 'orange' },
  REFUNDED: { label: '已退款', tone: 'red' },
  // 售后单状态
  PENDING: { label: '待审核', tone: 'orange' },
  APPROVED: { label: '已同意退款', tone: 'green' },
  RETURNING: { label: '待寄回', tone: 'blue' },
  REJECTED: { label: '已驳回', tone: 'red' },
  SETTLED: { label: '已结算', tone: 'green' },
}

/** 已付款、可以申请售后的订单状态（与后端 OrderStatus.AFTER_SALE_ALLOWED 一致） */
export const AFTER_SALE_ALLOWED = ['PENDING_SHIP', 'SHIPPED', 'PENDING_RECEIVE', 'COMPLETED', 'REFUNDING']

export const AFTER_SALE_TYPES = [
  { value: 'REFUND', label: '仅退款', desc: '未收到货或商品无需退回' },
  { value: 'RETURN', label: '退货退款', desc: '商家同意后寄回商品，确认收货再退款' },
]

export function afterSaleTypeLabel(type: string) {
  return AFTER_SALE_TYPES.find((item) => item.value === type)?.label || type || '售后'
}

export function formatTime(value?: string | null) {
  return value ? String(value).replace('T', ' ').slice(0, 16) : ''
}

/** RETURNING 同时包含待寄回和已寄回，按寄回时间区分展示。 */
export function statusMeta(status: string, returnShippedAt?: string | null): { label: string; tone: string } {
  if (status === 'RETURNING' && returnShippedAt) {
    return { label: '待商家确认收货', tone: 'blue' }
  }
  return STATUS_META[status] || { label: status, tone: 'gray' }
}

export function toast(title: string, icon: 'none' | 'success' | 'error' = 'none') {
  uni.showToast({ title, icon, duration: 1800 })
}
