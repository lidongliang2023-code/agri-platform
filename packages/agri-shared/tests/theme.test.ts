import { describe, expect, it } from 'vitest'
import { BRAND_COLOR, LAYOUT_SIZE, antdTheme } from '../src/styles/theme'

/**
 * 主题 token 的契约测试。
 *
 * <p>「运营端与用户端共用同一套视觉」这条要求，最终落在两个事实上：主色只有一处定义、
 * 布局尺寸是常量而不是各页面各写一个魔法数字。这两点都靠断言钉住。</p>
 */
describe('品牌主题 token', () => {
  it('主色是农业绿，且为合法 6 位十六进制色值', () => {
    expect(BRAND_COLOR).toBe('#13a05a')
    expect(BRAND_COLOR).toMatch(/^#[0-9a-fA-F]{6}$/)
  })

  it('antd 主题主色直接引用 BRAND_COLOR（禁止两端各自写死颜色）', () => {
    expect(antdTheme.token?.colorPrimary).toBe(BRAND_COLOR)
  })

  it('布局尺寸由 LAYOUT_SIZE 提供，antd Layout 引用同一常量', () => {
    expect(LAYOUT_SIZE.siderWidth).toBe(220)
    expect(LAYOUT_SIZE.siderCollapsedWidth).toBe(72)
    expect(LAYOUT_SIZE.headerHeight).toBe(56)
    expect(LAYOUT_SIZE.contentPadding).toBe(16)

    const components = antdTheme.components as unknown as
      | Record<string, Record<string, unknown>>
      | undefined
    expect(components?.Layout?.headerHeight).toBe(LAYOUT_SIZE.headerHeight)
  })

  it('折叠态窄于展开态，且窄态仍容得下图标', () => {
    expect(LAYOUT_SIZE.siderCollapsedWidth).toBeLessThan(LAYOUT_SIZE.siderWidth)
    expect(LAYOUT_SIZE.siderCollapsedWidth).toBeGreaterThanOrEqual(48)
  })

  it('内容区底色与布局底色一致（页面之间不出现色差接缝）', () => {
    const components = antdTheme.components as unknown as
      | Record<string, Record<string, unknown>>
      | undefined
    expect(components?.Layout?.bodyBg).toBe(antdTheme.token?.colorBgLayout)
  })
})
