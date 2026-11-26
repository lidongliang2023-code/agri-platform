/** 按北京时间自然日判断效期；有效期当天仍有效，次日过期。 */
export function inventoryExpiryState(expireDate?: string | null, referenceDay?: string): 'expired' | 'expiring' | 'normal' | undefined {
  if (!expireDate) return undefined
  const day = String(expireDate).slice(0, 10)
  const today = referenceDay ?? new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN
    const stamp = Date.parse(value + 'T00:00:00Z')
    return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === value ? stamp : NaN
  }
  const days = (parse(day) - parse(today)) / 86400000
  if (!Number.isFinite(days)) return undefined
  return days < 0 ? 'expired' : days <= 30 ? 'expiring' : 'normal'
}
