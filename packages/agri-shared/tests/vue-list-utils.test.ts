import { describe, expect, it } from 'vitest'
import {
  DEFAULT_COLLAPSE_THRESHOLD,
  DEFAULT_VUE_PAGE_SIZE,
  buildPageTokens,
  clampPage,
  computeTotalPages,
  filterVisibleVueColumns,
  formatSelectionSummary,
  loadStoredHiddenKeys,
  normalizeVueColumn,
  normalizeVueColumns,
  partitionRowActions,
  readCellValue,
  saveStoredHiddenKeys,
  shouldCollapseFilters,
  type StorageLike,
} from '../src/vue/list/vueListUtils'

function createMemoryStorage(initial: Record<string, string> = {}): StorageLike & { dump: () => Record<string, string> } {
  const map = new Map<string, string>(Object.entries(initial))
  return {
    getItem(key) {
      return map.has(key) ? map.get(key)! : null
    },
    setItem(key, value) {
      map.set(key, value)
    },
    dump() {
      return Object.fromEntries(map.entries())
    },
  }
}

describe('vueListUtils：Vue 端共享列表纯逻辑工具', () => {
  it('自动标准化列语义、对齐、固定方向、锁定和列宽', () => {
    const { columns, lockedKeys, defaultHiddenKeys } = normalizeVueColumns(
      [
        { prop: 'orderNo', label: '订单号', width: '160px', kind: 'code' },
        { prop: 'amount', label: '申请金额', minWidth: 120 },
        { prop: 'status', label: '授信状态', width: 100 },
        { prop: 'remark', label: '备注', defaultHidden: true },
        { key: 'actions', label: '操作', width: 150 },
      ],
      ['orderNo'],
    )

    expect(columns[0].resolvedKind).toBe('code')
    expect(columns[0].resolvedAlign).toBe('left')
    expect(columns[0].resolvedWidth).toBe(160)
    expect(columns[0].resolvedEllipsis).toBe(true)

    expect(columns[1].resolvedKind).toBe('number')
    expect(columns[1].resolvedAlign).toBe('right')
    expect(columns[1].resolvedMinWidth).toBe(120)

    expect(columns[2].resolvedKind).toBe('status')
    expect(columns[2].resolvedAlign).toBe('center')
    expect(columns[2].resolvedEllipsis).toBe(false)

    expect(columns[4].resolvedKind).toBe('action')
    expect(columns[4].resolvedAlign).toBe('right')
    expect(columns[4].resolvedFixed).toBe('right')
    expect(columns[4].resolvedLocked).toBe(true)
    expect(columns[4].resolvedEllipsis).toBe(false)

    expect(lockedKeys).toEqual(['orderNo', 'actions'])
    expect(defaultHiddenKeys).toEqual(['remark'])

    // 显式覆写字段配置优先于自动推断
    const custom = normalizeVueColumn(
      { prop: 'score', label: '金额', align: 'center', fixed: 'left', locked: true, ellipsis: false },
      0,
    )
    expect(custom.resolvedAlign).toBe('center')
    expect(custom.resolvedFixed).toBe('left')
    expect(custom.resolvedLocked).toBe(true)
    expect(custom.resolvedEllipsis).toBe(false)
  })

  it('过滤可见列并安全读写本地隐藏列偏好', () => {
    const { columns, lockedKeys, defaultHiddenKeys } = normalizeVueColumns([
      { prop: 'code', label: '编码', locked: true },
      { prop: 'name', label: '名称' },
      { prop: 'remark', label: '备注', defaultHidden: true },
      { key: 'actions', label: '操作' },
    ])

    const mem = createMemoryStorage()
    // 首次无缓存时使用默认隐藏列
    expect(loadStoredHiddenKeys(mem, 'mds-test-cols', lockedKeys, defaultHiddenKeys)).toEqual(['remark'])
    // 关闭持久化时同样回退默认隐藏列
    expect(loadStoredHiddenKeys(mem, false, lockedKeys, defaultHiddenKeys)).toEqual(['remark'])

    // 写入时自动剔除锁定列并去重
    const saved = saveStoredHiddenKeys(mem, 'mds-test-cols', ['name', 'code', 'actions', 'name'], lockedKeys)
    expect(saved).toEqual(['name'])
    expect(loadStoredHiddenKeys(mem, 'mds-test-cols', lockedKeys, defaultHiddenKeys)).toEqual(['name'])

    // 过滤可见列：锁定列永远不会被隐藏
    const visible = filterVisibleVueColumns(columns, ['name', 'code', 'actions'], lockedKeys)
    expect(visible.map((c) => c.resolvedKey)).toEqual(['code', 'remark', 'actions'])

    // 存储抛错时降级不崩溃
    const brokenStorage: StorageLike = {
      getItem() {
        throw new Error('denied')
      },
      setItem() {
        throw new Error('quota')
      },
    }
    expect(loadStoredHiddenKeys(brokenStorage, 'k', lockedKeys, defaultHiddenKeys)).toEqual(['remark'])
    expect(saveStoredHiddenKeys(brokenStorage, 'k', ['name'], lockedKeys)).toEqual(['name'])
  })

  it('按规范拆分操作列（最多平铺 2 项，超出收进更多）并判断筛选折叠阈值', () => {
    const two = partitionRowActions([
      { key: 'detail', label: '详情' },
      { key: 'edit', label: '编辑' },
      { key: 'hidden', label: '隐藏项', hidden: true },
    ])
    expect(two.visible.map((a) => a.key)).toEqual(['detail', 'edit'])
    expect(two.overflow).toEqual([])

    const four = partitionRowActions([
      { key: 'detail', label: '详情' },
      { key: 'edit', label: '编辑' },
      { key: 'disable', label: '禁用' },
      { key: 'delete', label: '删除' },
    ])
    expect(four.visible.map((a) => a.key)).toEqual(['detail'])
    expect(four.overflow.map((a) => a.key)).toEqual(['edit', 'disable', 'delete'])

    expect(shouldCollapseFilters(4)).toBe(false)
    expect(shouldCollapseFilters(DEFAULT_COLLAPSE_THRESHOLD)).toBe(true)
    expect(shouldCollapseFilters(6, 5)).toBe(true)
    expect(shouldCollapseFilters(Number.NaN)).toBe(false)
  })

  it('计算分页总数、页码夹紧、页码窗口（含省略号）、深层取值与页脚摘要', () => {
    expect(computeTotalPages(286, DEFAULT_VUE_PAGE_SIZE)).toBe(15)
    expect(computeTotalPages(0, 20)).toBe(1)
    expect(computeTotalPages(50, 0)).toBe(3)

    expect(clampPage(0, 100, 20)).toBe(1)
    expect(clampPage(99, 100, 20)).toBe(5)
    expect(clampPage(Number.NaN, 100, 20)).toBe(1)

    expect(buildPageTokens(1, 5)).toEqual([1, 2, 3, 4, 5])
    expect(buildPageTokens(1, 15)).toEqual([1, 2, 3, 4, 'ellipsis-right', 15])
    expect(buildPageTokens(8, 15)).toEqual([1, 'ellipsis-left', 7, 8, 9, 'ellipsis-right', 15])
    expect(buildPageTokens(14, 15)).toEqual([1, 'ellipsis-left', 12, 13, 14, 15])

    expect(readCellValue({ a: { b: { c: 'ok' } }, simple: 42 }, 'simple')).toBe(42)
    expect(readCellValue({ a: { b: { c: 'ok' } } }, 'a.b.c')).toBe('ok')
    expect(readCellValue({ a: null }, 'a.b')).toBeUndefined()
    expect(readCellValue({ a: 1 }, undefined)).toBeUndefined()

    expect(formatSelectionSummary(286, 2)).toBe('已选 2 项 · 共 286 条')
    expect(formatSelectionSummary(286, 0)).toBe('共 286 条')
    expect(formatSelectionSummary(-5, -1, '单')).toBe('共 0 单')
  })
})
