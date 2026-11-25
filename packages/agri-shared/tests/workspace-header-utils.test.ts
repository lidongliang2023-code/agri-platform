import { describe, expect, it } from 'vitest'
import {
  normalizeBreadcrumbItems,
  readSidebarCollapsed,
  resolveSidebarToggleState,
  writeSidebarCollapsed,
} from '../src/components/workspace/workspaceHeaderUtils'

describe('workspaceHeaderUtils：统一顶部栏折叠状态与面包屑工具', () => {
  it('正确计算桌面端与移动端折叠按钮状态', () => {
    expect(resolveSidebarToggleState({ collapsed: false })).toEqual({
      icon: 'fold',
      label: '收起侧边栏',
      expanded: true,
    })
    expect(resolveSidebarToggleState({ collapsed: true })).toEqual({
      icon: 'unfold',
      label: '展开侧边栏',
      expanded: false,
    })
    expect(resolveSidebarToggleState({ mobile: true, mobileOpen: false })).toEqual({
      icon: 'unfold',
      label: '打开导航菜单',
      expanded: false,
    })
    expect(resolveSidebarToggleState({ mobile: true, mobileOpen: true })).toEqual({
      icon: 'fold',
      label: '关闭导航菜单',
      expanded: true,
    })
  })

  it('过滤空面包屑并保留点击与链接配置', () => {
    const onHome = () => {}
    expect(
      normalizeBreadcrumbItems([
        null,
        undefined,
        '  ',
        { label: ' 首页 ', onClick: onHome },
        { label: 'AI与知识中心', href: '/knowledge' },
        '生产SOP规程',
        { label: '   ' },
      ]),
    ).toEqual([
      { label: '首页', href: undefined, onClick: onHome },
      { label: 'AI与知识中心', href: '/knowledge', onClick: undefined },
      { label: '生产SOP规程' },
    ])
    expect(normalizeBreadcrumbItems(undefined)).toEqual([])
  })

  it('在存储不可用或正常时安全读写侧栏折叠状态', () => {
    const store = new Map<string, string>()
    const original = (globalThis as { window?: unknown }).window
    ;(globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => {
          store.set(k, v)
        },
      },
    }
    try {
      expect(readSidebarCollapsed('k1', true)).toBe(true)
      writeSidebarCollapsed('k1', false)
      expect(readSidebarCollapsed('k1', true)).toBe(false)
      writeSidebarCollapsed('k1', true)
      expect(readSidebarCollapsed('k1', false)).toBe(true)
      store.set('k2', 'invalid')
      expect(readSidebarCollapsed('k2', false)).toBe(false)
    } finally {
      ;(globalThis as { window?: unknown }).window = original
    }
    expect(readSidebarCollapsed('no-window', true)).toBe(true)
  })
})
