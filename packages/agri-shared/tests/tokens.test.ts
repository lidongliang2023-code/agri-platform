import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  BORDER,
  BRAND_COLOR,
  CSS_VARIABLES,
  FONT,
  LAYOUT_SIZE,
  SEMANTIC_COLORS,
  SURFACE,
} from '../src/tokens'
import { antdTheme } from '../src/styles/theme'

const tokensCss = readFileSync(new URL('../src/tokens/tokens.css', import.meta.url), 'utf8')
const globalLess = readFileSync(new URL('../src/styles/global.less', import.meta.url), 'utf8')

/** 从 CSS 文本里抽出 `--agri-xxx: value;` 形式的变量声明 */
function declaredVariables(css: string): Record<string, string> {
  const found: Record<string, string> = {}
  for (const match of css.matchAll(/(--agri-[a-z-]+):\s*([^;]+);/g)) {
    found[match[1]] = match[2].trim()
  }
  return found
}

/**
 * 令牌的"一份定义、两份投影"必须有机器把关。
 *
 * 这套抽象的价值全在「只有一个真源」：TS 定义给 React 侧，CSS 变量给 Vue / 任意栈。
 * 一旦两边各改各的，Vue 侧看到的品牌色就会和 React 侧不一样 —— 那正好是当初要治的病。
 */
describe('设计令牌：CSS 变量投影与 TS 定义逐项一致', () => {
  const declared = declaredVariables(tokensCss)

  it('tokens.css 声明的变量集合与 CSS_VARIABLES 完全对应（多一个少一个都算漂移）', () => {
    expect(Object.keys(declared).sort()).toEqual(Object.keys(CSS_VARIABLES).sort())
  })

  it('每个变量的取值逐项一致', () => {
    for (const [name, value] of Object.entries(CSS_VARIABLES)) {
      expect(declared[name], `变量 ${name} 缺失或取值不一致`).toBe(value)
    }
  })

  it('global.less 只引用 tokens.css，不再重复定义令牌', () => {
    expect(globalLess).toContain('tokens/tokens.css')
    expect(declaredVariables(globalLess)).toEqual({})
  })

  /**
   * 可读下限要能被机器守住，否则下一次有人写 font-size: 11px 没人拦得住。
   *
   * micro=12px 是「可见文字不得小于 12px」这条口径的唯一落点；
   * 那条 small 规则看着多余（没人给 <small> 写过字号），但浏览器默认的 0.833em
   * 会让父级只要 ≤14px 就重新掉到 12px 以下 —— info-ops 行情页实测过 11.6667px。
   */
  it('字号下限：micro 是 12px，且给 <small> 的默认缩放也兜住同一下限', () => {
    expect(FONT.sizeMicro).toBe(12)
    expect(declared['--agri-font-size-micro']).toBe('12px')
    expect(tokensCss).toMatch(/small\s*\{\s*font-size:\s*max\(var\(--agri-font-size-micro\),\s*0\.833em\)/)
  })
})

describe('antd 主题由令牌派生', () => {
  it('主色与语义色取自令牌', () => {
    expect(antdTheme.token?.colorPrimary).toBe(BRAND_COLOR)
    expect(antdTheme.token?.colorSuccess).toBe(SEMANTIC_COLORS.success)
    expect(antdTheme.token?.colorWarning).toBe(SEMANTIC_COLORS.warning)
    expect(antdTheme.token?.colorError).toBe(SEMANTIC_COLORS.error)
    expect(antdTheme.token?.colorInfo).toBe(SEMANTIC_COLORS.info)
  })

  it('圆角 / 字号 / 内容区底色取自令牌', () => {
    expect(antdTheme.token?.borderRadius).toBe(BORDER.radius)
    expect(antdTheme.token?.fontSize).toBe(FONT.sizeBase)
    expect(antdTheme.token?.colorBgLayout).toBe(SURFACE.contentBg)
  })

  it('布局组件底色与高度与令牌一致（页面之间不留色差接缝）', () => {
    const components = antdTheme.components as unknown as
      | Record<string, Record<string, unknown>>
      | undefined
    expect(components?.Layout?.bodyBg).toBe(SURFACE.contentBg)
    expect(components?.Layout?.headerBg).toBe(SURFACE.containerBg)
    expect(components?.Layout?.siderBg).toBe(SURFACE.containerBg)
    expect(components?.Layout?.headerHeight).toBe(LAYOUT_SIZE.headerHeight)
  })
})
