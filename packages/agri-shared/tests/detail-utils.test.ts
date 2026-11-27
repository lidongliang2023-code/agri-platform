import { describe, expect, it } from 'vitest'
import { normalizeTimelineState, resolveDetailStatusTone, sortDetailActions } from '../src/vue/detail/detailUtils'

describe('detailUtils', () => {
  it('按 次要 → 危险 → 主要 稳定排序页头操作按钮', () => {
    const result = sortDetailActions([
      { key: 'approve', kind: 'primary' },
      { key: 'cancel', kind: 'danger' },
      { key: 'print', kind: 'secondary' },
      { key: 'export' },
      { key: 'delete', kind: 'danger' },
      { key: 'submit', kind: 'primary' },
    ])
    expect(result.map(item => item.key)).toEqual(['print', 'export', 'cancel', 'delete', 'approve', 'submit'])
  })

  it('正确归一化状态胶囊语义色板', () => {
    expect(resolveDetailStatusTone('green')).toBe('green')
    expect(resolveDetailStatusTone('success')).toBe('green')
    expect(resolveDetailStatusTone('gold')).toBe('orange')
    expect(resolveDetailStatusTone('warning')).toBe('orange')
    expect(resolveDetailStatusTone('volcano')).toBe('red')
    expect(resolveDetailStatusTone('error')).toBe('red')
    expect(resolveDetailStatusTone('processing')).toBe('blue')
    expect(resolveDetailStatusTone('geekblue')).toBe('blue')
    expect(resolveDetailStatusTone('default')).toBe('gray')
    expect(resolveDetailStatusTone(undefined)).toBe('gray')
  })

  it('正确归一化时间线节点状态', () => {
    expect(normalizeTimelineState('done')).toBe('done')
    expect(normalizeTimelineState('finished')).toBe('done')
    expect(normalizeTimelineState('current')).toBe('current')
    expect(normalizeTimelineState('processing')).toBe('current')
    expect(normalizeTimelineState('rejected')).toBe('error')
    expect(normalizeTimelineState('pending')).toBe('pending')
    expect(normalizeTimelineState(undefined)).toBe('pending')
  })
})
