import { describe, expect, it } from 'vitest'
import {
  MAX_RESIZABLE_COLUMN_WIDTH,
  MIN_RESIZABLE_COLUMN_WIDTH,
  clampColumnWidth,
  deriveColumnWidthStorageKey,
  isActionColumnMeta,
  isNumericColumnMeta,
  isStatusColumnMeta,
  parseConfiguredWidth,
  parseHiddenColumnKeys,
  parseStoredWidths,
  resolveColumnKey,
  sanitizeHiddenColumnKeys,
} from '../src/components/list/listColumnUtils'

describe('listColumnUtils：跨子系统列表列元信息与持久化校验', () => {
  it('识别操作列、数值列和状态列', () => {
    expect(isActionColumnMeta('操作')).toBe(true)
    expect(isActionColumnMeta('', 'actions')).toBe(true)
    expect(isActionColumnMeta('详情', 'detail', 'option')).toBe(true)
    expect(isActionColumnMeta('名称', 'name')).toBe(false)

    expect(isNumericColumnMeta('金额')).toBe(true)
    expect(isNumericColumnMeta('成交额')).toBe(true)
    expect(isNumericColumnMeta('自定义指标', 'money')).toBe(true)
    expect(isNumericColumnMeta('商品名称')).toBe(false)

    expect(isStatusColumnMeta('订单状态')).toBe(true)
    expect(isStatusColumnMeta('审批状态')).toBe(true)
    expect(isStatusColumnMeta('备注')).toBe(false)
  })

  it('解析列宽配置并过滤无效存储项', () => {
    expect(parseConfiguredWidth(120)).toBe(120)
    expect(parseConfiguredWidth('160px')).toBe(160)
    expect(parseConfiguredWidth('96.5')).toBe(96.5)
    expect(parseConfiguredWidth('auto')).toBeUndefined()
    expect(parseConfiguredWidth(-10)).toBeUndefined()

    expect(parseStoredWidths(null)).toEqual({})
    expect(parseStoredWidths('{bad json')).toEqual({})
    expect(parseStoredWidths('[]')).toEqual({})
    expect(
      parseStoredWidths(
        JSON.stringify({
          valid: MIN_RESIZABLE_COLUMN_WIDTH,
          wider: 240.4,
          tooNarrow: 40,
          tooWide: MAX_RESIZABLE_COLUMN_WIDTH + 100,
          notNum: '120',
        }),
      ),
    ).toEqual({ valid: 80, wider: 240 })

    expect(clampColumnWidth(50)).toBe(MIN_RESIZABLE_COLUMN_WIDTH)
    expect(clampColumnWidth(2000)).toBe(MAX_RESIZABLE_COLUMN_WIDTH)
    expect(clampColumnWidth(185.6)).toBe(186)
    expect(clampColumnWidth(Number.NaN, 100)).toBe(100)

    expect(deriveColumnWidthStorageKey('custom:widths', 'cols:key')).toBe('custom:widths')
    expect(deriveColumnWidthStorageKey(undefined, 'cols:key')).toBe('cols:key:widths')
    expect(deriveColumnWidthStorageKey(false, 'cols:key')).toBeNull()
    expect(deriveColumnWidthStorageKey(undefined, false)).toBeNull()
  })

  it('解析与清洗隐藏列键，并生成稳定的列键', () => {
    expect(parseHiddenColumnKeys(null)).toEqual([])
    expect(parseHiddenColumnKeys('not-json')).toEqual([])
    expect(parseHiddenColumnKeys('{}')).toEqual([])
    expect(parseHiddenColumnKeys(JSON.stringify(['a', 123, 'b']))).toEqual(['a', 'b'])

    expect(sanitizeHiddenColumnKeys(['a', 'actions', 'b', 'a'], ['actions'])).toEqual(['a', 'b'])

    expect(resolveColumnKey({ key: 'code' }, 0)).toBe('code')
    expect(resolveColumnKey({ dataIndex: ['farm', 'name'] }, 1, 'root')).toBe('root/farm.name')
    expect(resolveColumnKey({ dataIndex: 'title' }, 2)).toBe('title')
    expect(resolveColumnKey({}, 3, 'grp')).toBe('grp/3')
  })
})
