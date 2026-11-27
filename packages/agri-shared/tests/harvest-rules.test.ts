import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BATCH_STATUS_META,
  BATCH_STATUS_OPTIONS,
  GRADE_COLOR_MAP,
  GRADE_LABEL_MAP,
  GRADE_OPTIONS,
  INBOUND_STATUS_META,
  INBOUND_STATUS_OPTIONS,
  INVENTORY_HEALTH_META,
  INVENTORY_HEALTH_OPTIONS,
  MATURITY_LEVEL_META,
  inventoryExpiryState,
  resolveInventoryHealth,
  resolveMaturityLevel,
} from '../src/types/harvest'

/**
 * 采收/库存推导规则的契约测试。
 *
 * <p>`resolveMaturityLevel` 与 `resolveInventoryHealth` 是纯函数，却被列表、看板、
 * 盘点多个页面复用来决定「显示什么状态、什么颜色」。阈值一旦被改错，页面不会报错，
 * 只会静默显示错的状态——所以用边界值把阈值钉死。</p>
 */
describe('resolveMaturityLevel：评分 → 成熟度分级（阈值 60 / 80 / 95）', () => {
  it('按阈值分档，且取的是下界（>=）', () => {
    expect(resolveMaturityLevel(0)).toBe('未成熟')
    expect(resolveMaturityLevel(59.9)).toBe('未成熟')
    expect(resolveMaturityLevel(60)).toBe('初熟')
    expect(resolveMaturityLevel(79.9)).toBe('初熟')
    expect(resolveMaturityLevel(80)).toBe('适采')
    expect(resolveMaturityLevel(94.9)).toBe('适采')
    expect(resolveMaturityLevel(95)).toBe('过熟')
    expect(resolveMaturityLevel(100)).toBe('过熟')
  })

  it('越界输入也能落到某个分级上（UI 取色不会取空）', () => {
    for (const score of [-1, 0, 33, 60, 80, 95, 100, 1000]) {
      expect(MATURITY_LEVEL_META[resolveMaturityLevel(score)]).toBeDefined()
    }
  })
})

describe('resolveInventoryHealth：库存健康（优先级 已过期 > 不足 > 临期 > 正常，与后端 fillHealth 同源）', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // 固定“当前时间”，让按北京时间自然日计算的“距到期几天”成为确定值。
    vi.setSystemTime(new Date('2026-10-11T12:00:00+08:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('已过期：保质期早于今日（有效期当天仍有效，次日过期），且优先级压过不足', () => {
    expect(resolveInventoryHealth(1000, 100, '2026-10-10')).toBe('expired')
    expect(resolveInventoryHealth(10, 100, '2026-10-01')).toBe('expired')
    expect(resolveInventoryHealth(0, 0, '2026-10-01')).toBe('expired')
  })

  it('不足：已配置安全库存（>0）且当前库存 ≤ 安全库存', () => {
    expect(resolveInventoryHealth(10, 100)).toBe('shortage')
    expect(resolveInventoryHealth(50, 100)).toBe('shortage')
    expect(resolveInventoryHealth(51, 100)).toBe('shortage')
    expect(resolveInventoryHealth(100, 100)).toBe('shortage')
  })

  it('正常：高于安全库存且未临期/过期', () => {
    expect(resolveInventoryHealth(101, 100)).toBe('normal')
    expect(resolveInventoryHealth(1000, 100, '2026-12-31')).toBe('normal')
  })

  it('未配置安全库存（0 或非正数）时不误判为不足', () => {
    expect(resolveInventoryHealth(0, 0)).toBe('normal')
    expect(resolveInventoryHealth(50, 0)).toBe('normal')
    expect(resolveInventoryHealth(0, -10)).toBe('normal')
  })

  it('临期：有效期当天起至 30 天内到期（含边界 0 天与 30 天，31 天归正常）', () => {
    expect(resolveInventoryHealth(200, 100, '2026-10-11')).toBe('expiring')
    expect(resolveInventoryHealth(200, 100, '2026-10-12')).toBe('expiring')
    expect(resolveInventoryHealth(200, 100, '2026-11-10')).toBe('expiring')
    expect(resolveInventoryHealth(200, 100, '2026-11-11')).toBe('normal')
  })

  it('优先级：已过期 > 不足 > 临期 > 正常', () => {
    expect(resolveInventoryHealth(10, 100, '2026-10-10')).toBe('expired')
    expect(resolveInventoryHealth(10, 100, '2026-10-12')).toBe('shortage')
    expect(resolveInventoryHealth(100, 100, '2026-10-12')).toBe('shortage')
    expect(resolveInventoryHealth(101, 100, '2026-10-12')).toBe('expiring')
    expect(resolveInventoryHealth(101, 100, '2026-12-31')).toBe('normal')
  })

  it('非法或空日期时安全忽略效期判定', () => {
    expect(inventoryExpiryState(undefined)).toBeUndefined()
    expect(inventoryExpiryState(null)).toBeUndefined()
    expect(inventoryExpiryState('not-a-date')).toBeUndefined()
    expect(inventoryExpiryState('2026-02-31')).toBeUndefined()
    expect(inventoryExpiryState('2026-10-11', '2026-10-11')).toBe('expiring')
    expect(resolveInventoryHealth(200, 100, '2026-13-40')).toBe('normal')
  })

  it('返回值恒为 INVENTORY_HEALTH_META 的键（UI 取色不会取空）', () => {
    const samples: Array<[number, number, string?]> = [
      [10, 100],
      [51, 100],
      [101, 100],
      [0, 0],
      [200, 100, '2026-10-12'],
      [200, 100, '2026-10-01'],
      [1000, 100, '2026-12-31'],
    ]
    for (const [currentQty, safeQty, expireDate] of samples) {
      expect(INVENTORY_HEALTH_META[resolveInventoryHealth(currentQty, safeQty, expireDate)]).toBeDefined()
    }
  })
})

describe('选项与展示映射一致性（下拉有值、标签有色）', () => {
  it('质量等级：每个选项都能取到文案与颜色', () => {
    for (const o of GRADE_OPTIONS) {
      const key = String(o.value)
      expect(GRADE_LABEL_MAP[key]).toBeTruthy()
      expect(GRADE_COLOR_MAP[key]).toBeTruthy()
    }
  })

  it('状态元数据覆盖全部选项值', () => {
    for (const o of BATCH_STATUS_OPTIONS) expect(BATCH_STATUS_META[o.value]).toBeDefined()
    for (const o of INBOUND_STATUS_OPTIONS) expect(INBOUND_STATUS_META[o.value]).toBeDefined()
    for (const o of INVENTORY_HEALTH_OPTIONS) expect(INVENTORY_HEALTH_META[o.value]).toBeDefined()
  })

  it('下拉选项无重复值（同一状态不会出现两个选项）', () => {
    const groups: Array<Array<unknown>> = [
      GRADE_OPTIONS.map((o) => o.value),
      BATCH_STATUS_OPTIONS.map((o) => o.value),
      INBOUND_STATUS_OPTIONS.map((o) => o.value),
      INVENTORY_HEALTH_OPTIONS.map((o) => o.value),
    ]
    for (const values of groups) {
      expect(new Set(values).size).toBe(values.length)
    }
  })
})
