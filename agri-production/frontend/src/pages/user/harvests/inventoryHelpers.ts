import useAuthStore from '@/store/auth'
import { http } from '@/utils/request'
import type { InventoryRecord, PageResult } from '@/types'

/** Load every server page; never turn a partial result into a complete summary. */
export async function loadInventoryPages<T>(read: (pageNum: number) => Promise<PageResult<T>>): Promise<T[]> {
  const rows: T[] = []
  for (let page = 1; ; page += 1) {
    const result = await read(page)
    rows.push(...result.list)
    if (rows.length >= result.total) return rows
    if (!result.list.length) throw new Error('分页结果不完整，请刷新后重试')
  }
}

/** 提交前确认当前主体及所选分仓库存仍存在。 */
export async function requireInventorySource(record: InventoryRecord): Promise<void> {
  const subject = useAuthStore.getState().userInfo?.tenantId
  const rows = await http.get<InventoryRecord[]>(`/harvests/${record.batchId}/inventory`)
  if (subject !== useAuthStore.getState().userInfo?.tenantId) throw new Error('经营主体已切换，请重新操作')
  if (!rows.some((row) => String(row.inventoryId) === String(record.inventoryId))) {
    throw new Error('库存记录已变化，请刷新后重试')
  }
}

export function quantitySummary(rows: InventoryRecord[], field: 'currentQty' | 'frozenQty' | 'lossQty'): string {
  const totals = new Map<string, number>()
  for (const row of rows) {
    const value = row[field]
    if (typeof value !== 'number' || !Number.isFinite(value)) continue
    const unit = row.unit || '单位未标注'
    totals.set(unit, (totals.get(unit) ?? 0) + value)
  }
  return [...totals].map(([unit, value]) => `${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} ${unit}`).join(' / ') || '—'
}
