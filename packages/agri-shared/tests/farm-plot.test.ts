import { describe, expect, it } from 'vitest'
import { CROP_EMOJI_MAP, PLOT_STATUS_META } from '../src/types/farm'

/**
 * 地块状态与作物图标的契约测试。
 *
 * <p>这两张表原先在 FarmDetail / PlotDetail / PlotList 各存一份，B2 迁移把它们收敛成
 * 全局唯一一份。收敛最大的风险是「取得的值对不上原来的下标 / 文案」，页面不会报错，
 * 只会显示错的状态，所以逐项钉死。</p>
 */
describe('PLOT_STATUS_META（PlotStatus：0 已停用 / 1 空闲 / 2 在种 / 3 采收期 / 4 休耕）', () => {
  it('逐项取值与 PRD 对齐，防止收敛过程中串位', () => {
    expect(PLOT_STATUS_META[0]).toEqual({ label: '已停用', color: 'default' })
    expect(PLOT_STATUS_META[1]).toEqual({ label: '空闲', color: 'blue' })
    expect(PLOT_STATUS_META[2]).toEqual({ label: '在种', color: 'green' })
    expect(PLOT_STATUS_META[3]).toEqual({ label: '采收期', color: 'orange' })
    expect(PLOT_STATUS_META[4]).toEqual({ label: '休耕', color: 'gold' })
  })

  it('枚举内每个状态都有文案与颜色（列表渲染不落空）', () => {
    for (const code of [0, 1, 2, 3, 4]) {
      expect(PLOT_STATUS_META[code]?.label).toBeTruthy()
      expect(PLOT_STATUS_META[code]?.color).toBeTruthy()
    }
  })

  it('状态文案互不重复（下拉/标签不会出现两个同名项）', () => {
    const labels = [0, 1, 2, 3, 4].map((code) => PLOT_STATUS_META[code].label)
    expect(new Set(labels).size).toBe(labels.length)
  })
})

describe('CROP_EMOJI_MAP（原型 P2 地块卡 / P4 列表共用）', () => {
  it('已登记作物返回非空图标', () => {
    expect(CROP_EMOJI_MAP['番茄']).toBe('🍅')
    expect(CROP_EMOJI_MAP['水稻']).toBe('🌾')
    for (const [crop, emoji] of Object.entries(CROP_EMOJI_MAP)) {
      expect(crop.length, `作物名不应为空: ${crop}`).toBeGreaterThan(0)
      expect(emoji.length, `图标不应为空: ${crop}`).toBeGreaterThan(0)
    }
  })

  it('未登记作物走调用方兜底 🌱（映射本身不存兜底键，缺省即 undefined）', () => {
    const crop = '未登记的作物'
    expect(CROP_EMOJI_MAP[crop]).toBeUndefined()
    expect(CROP_EMOJI_MAP[crop] ?? '🌱').toBe('🌱')
  })
})
