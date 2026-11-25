import { describe, expect, it } from 'vitest'
import { antdvTheme, BRAND_COLOR } from '../src/vue/antdv/theme'
import { extractApiErrorMessage } from '../src/vue/http/createAgriHttp'

describe('antdvTheme & createAgriHttp 工具', () => {
  it('antdvTheme 主色与全局品牌设计令牌保持一致', () => {
    expect(antdvTheme.token.colorPrimary).toBe(BRAND_COLOR)
    expect(antdvTheme.components.Layout.siderBg).toBe('#001529')
  })

  it('extractApiErrorMessage 正确提取普通错误与兜底文案', () => {
    expect(extractApiErrorMessage(new Error('服务不可用'))).toBe('服务不可用')
    expect(extractApiErrorMessage(null, '默认错误')).toBe('默认错误')
  })
})
