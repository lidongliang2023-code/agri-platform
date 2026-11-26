import { describe, expect, it } from 'vitest'
import {
  computeCloseResult,
  isFormWorkspaceTab,
  parseStoredWorkspaceTabs,
  reorderWorkspaceTabs,
  resolveCloseTargetKeys,
  upsertWorkspaceTab,
} from '../src/components/workspace/workspaceTabsUtils'

describe('workspaceTabsUtils', () => {
  const sample = [
    { key: 'overview', label: '首页概览' },
    { key: 'purchase', label: '采购订单' },
    { key: 'contract', label: '合同管理' },
    { key: 'publish', label: '发布采购需求', form: true },
  ]

  it('recognizes form tabs from label or route key', () => {
    expect(isFormWorkspaceTab('/production/farms/create', '农场详情')).toBe(true)
    expect(isFormWorkspaceTab('/member/buyer?tab=publish', '采购需求')).toBe(true)
    expect(isFormWorkspaceTab('/production/farms', '新增农场')).toBe(true)
    expect(isFormWorkspaceTab('/borrower/loan-apply', '融资申请')).toBe(true)
    expect(isFormWorkspaceTab('/supply/product-add', '新增供货商品')).toBe(true)
    expect(isFormWorkspaceTab('/activity-create', '营销活动')).toBe(true)
    expect(isFormWorkspaceTab('/admin/trade/order', '订单监管')).toBe(false)
  })

  it('reorders tabs cleanly without mutating the source array', () => {
    const movedLeft = reorderWorkspaceTabs(sample, 'contract', 'overview', 'left')
    expect(movedLeft.map(item => item.key)).toEqual(['contract', 'overview', 'purchase', 'publish'])

    const movedRight = reorderWorkspaceTabs(sample, 'overview', 'contract', 'right')
    expect(movedRight.map(item => item.key)).toEqual(['purchase', 'contract', 'overview', 'publish'])

    expect(reorderWorkspaceTabs(sample, 'overview', 'overview', 'left').map(item => item.key)).toEqual(
      sample.map(item => item.key),
    )
    expect(reorderWorkspaceTabs(sample, 'missing', 'overview', 'left').map(item => item.key)).toEqual(
      sample.map(item => item.key),
    )
  })

  it('resolves close targets for all menu actions', () => {
    expect(resolveCloseTargetKeys(sample, 'purchase', 'current')).toEqual(['purchase'])
    expect(resolveCloseTargetKeys(sample, 'purchase', 'others')).toEqual(['overview', 'contract', 'publish'])
    expect(resolveCloseTargetKeys(sample, 'purchase', 'left')).toEqual(['overview'])
    expect(resolveCloseTargetKeys(sample, 'purchase', 'right')).toEqual(['contract', 'publish'])
    expect(resolveCloseTargetKeys(sample, 'purchase', 'all')).toEqual(['overview', 'purchase', 'contract', 'publish'])
    expect(resolveCloseTargetKeys(sample, 'missing', 'others')).toEqual([])
  })

  it('computes remaining tabs and next active key on close', () => {
    expect(computeCloseResult(sample, 'purchase', ['contract'], 'overview')).toEqual({
      remaining: [sample[0], sample[1], sample[3]],
      nextActiveKey: null,
    })

    const closeActiveMiddle = computeCloseResult(sample, 'purchase', ['purchase'], 'overview')
    expect(closeActiveMiddle.remaining.map(item => item.key)).toEqual(['overview', 'contract', 'publish'])
    expect(closeActiveMiddle.nextActiveKey).toBe('contract')

    const closeActiveLast = computeCloseResult(sample, 'publish', ['publish'], 'overview')
    expect(closeActiveLast.remaining.map(item => item.key)).toEqual(['overview', 'purchase', 'contract'])
    expect(closeActiveLast.nextActiveKey).toBe('contract')

    const closeAll = computeCloseResult(sample, 'purchase', sample.map(item => item.key), 'overview')
    expect(closeAll.remaining).toEqual([])
    expect(closeAll.nextActiveKey).toBe('overview')
  })

  it('upserts route tabs in place and appends new ones', () => {
    const base = [
      { key: 'home', label: '首页', path: 'home' },
      { key: 'orders', label: '订单', path: 'orders' },
    ]
    const updated = upsertWorkspaceTab(base, { key: 'home', label: '服务首页', path: 'home?x=1' })
    expect(updated).toEqual([{ key: 'home', label: '服务首页', path: 'home?x=1' }, base[1]])
    expect(base[0].label).toBe('首页')

    const appended = upsertWorkspaceTab(base, { key: 'user-detail/1', label: '用户详情', path: 'user-detail/1' })
    expect(appended.map(item => item.key)).toEqual(['home', 'orders', 'user-detail/1'])
  })

  it('evicts the oldest unpinned tabs when over the limit', () => {
    const many = ['home', 'a', 'b', 'c'].map(key => ({ key, label: key }))
    const capped = upsertWorkspaceTab(many, { key: 'd', label: 'd' }, 3, ['home'])
    expect(capped.map(item => item.key)).toEqual(['home', 'c', 'd'])

    const allPinned = upsertWorkspaceTab([{ key: 'home', label: 'home' }], { key: 'x', label: 'x' }, 1, ['home'])
    expect(allPinned.map(item => item.key)).toEqual(['home', 'x'])

    expect(upsertWorkspaceTab(many, { key: 'e', label: 'e' }, 0).map(item => item.key)).toEqual(['e'])
  })

  it('parses stored route tabs defensively', () => {
    expect(parseStoredWorkspaceTabs(null)).toEqual([])
    expect(parseStoredWorkspaceTabs('not-json')).toEqual([])
    expect(parseStoredWorkspaceTabs('{"key":"a"}')).toEqual([])
    expect(
      parseStoredWorkspaceTabs(
        JSON.stringify([
          { key: 'home', label: '首页', path: 'home' },
          { key: 'home', label: '重复', path: 'home' },
          { key: 'orders', label: '订单' },
          { key: 'publish', label: '发布供需', path: 'sd-publish', form: true },
          null,
          { key: '', label: '空键' },
          { key: 'bad', label: 3 },
        ]),
      ),
    ).toEqual([
      { key: 'home', label: '首页', path: 'home' },
      { key: 'orders', label: '订单', path: 'orders' },
      { key: 'publish', label: '发布供需', path: 'sd-publish', form: true },
    ])
  })
})
