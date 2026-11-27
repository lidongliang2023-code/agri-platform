import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { useVueListColumns } from '../src/vue/list/useVueListColumns'
import { useVueColumnWidths } from '../src/vue/list/useVueColumnWidths'
import {
  normalizeVueColumns,
  type StorageLike,
  type VueListColumn,
} from '../src/vue/list/vueListUtils'

function createMemoryStorage(): StorageLike & { store: Map<string, string> } {
  const store = new Map<string, string>()
  return {
    store,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
  }
}

describe('useVueListColumns：列显隐持久化组合式函数', () => {
  const columns: VueListColumn[] = [
    { key: 'code', label: '单号', locked: true },
    { key: 'name', label: '名称', width: 180 },
    { key: 'remark', label: '备注', defaultHidden: true },
    { key: 'actions', label: '操作' },
  ]

  it('支持默认隐藏、切换显隐、锁定列保护、恢复默认及动态切换 storageKey', async () => {
    const storage = createMemoryStorage()
    const storageKey = ref<string>('list-a')
    const colsRef = ref<VueListColumn[]>(columns)

    const api = useVueListColumns(colsRef, {
      storageKey: () => storageKey.value,
      lockedKeys: ['actions'],
      storage,
    })

    expect(api.lockedKeys.value).toContain('code')
    expect(api.lockedKeys.value).toContain('actions')
    expect(api.isColumnVisible('remark')).toBe(false)
    expect(api.visibleColumns.value.map((c) => c.key)).toEqual(['code', 'name', 'actions'])

    // 隐藏 name 并持久化
    api.toggleColumn('name')
    expect(api.isColumnVisible('name')).toBe(false)
    expect(storage.store.get('list-a')).toContain('name')

    // 锁定列无法隐藏
    api.toggleColumn('code', false)
    expect(api.isColumnVisible('code')).toBe(true)

    // 显式显示 remark
    api.toggleColumn('remark', true)
    expect(api.isColumnVisible('remark')).toBe(true)

    // 切换 storageKey 自动重载对应存储
    storageKey.value = 'list-b'
    await nextTick()
    expect(api.isColumnVisible('name')).toBe(true)
    expect(api.isColumnVisible('remark')).toBe(false)

    // 切回 list-a 恢复之前保存的状态，再点重置恢复默认
    storageKey.value = 'list-a'
    await nextTick()
    expect(api.isColumnVisible('name')).toBe(false)
    api.resetColumns()
    expect(api.isColumnVisible('name')).toBe(true)
    expect(api.isColumnVisible('remark')).toBe(false)
  })

  it('支持直接传函数列源与缺省 window.localStorage 兜底', () => {
    const api = useVueListColumns(() => columns, { storageKey: 'no-window-key' })
    expect(api.normalizedColumns.value).toHaveLength(4)
    api.toggleColumn('name', false)
    expect(api.isColumnVisible('name')).toBe(false)
  })
})

describe('useVueColumnWidths：列宽拖拽防抖持久化组合式函数', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const nameCol = normalizeVueColumns([{ key: 'name', label: '名称', width: 180, minWidth: 100 }]).columns[0]

  it('支持防抖写入、单列复位、全部复位、切换 key 时刷盘重载及无存储兜底', async () => {
    const storage = createMemoryStorage()
    const settingsKey = ref<string>('table-a')

    const api = useVueColumnWidths({
      fallbackSettingsKey: () => settingsKey.value,
      storage,
    })

    expect(api.resolvedStorageKey.value).toBe('table-a:widths')
    expect(api.getColumnWidth(nameCol)).toBe(180)

    api.setColumnWidth('name', 260)
    expect(api.getColumnWidth(nameCol)).toBe(260)
    expect(storage.store.has('table-a:widths')).toBe(false)

    // 切换 key 前若存在未刷盘定时器，会先刷盘到旧 key
    settingsKey.value = 'table-b'
    await nextTick()
    expect(storage.store.get('table-a:widths')).toContain('260')
    expect(api.getColumnWidth(nameCol)).toBe(180)

    // 在 table-b 上设置并等待防抖定时器完成
    api.setColumnWidth('name', 240)
    api.setColumnWidth('name', 300)
    vi.advanceTimersByTime(160)
    expect(storage.store.get('table-b:widths')).toContain('300')

    // 重置未改动的列直接返回，重置已改动的列立即刷盘
    api.resetColumnWidth('unknown')
    api.resetColumnWidth('name')
    expect(api.getColumnWidth(nameCol)).toBe(180)

    api.setColumnWidth('name', 280)
    api.resetAllWidths()
    expect(api.widths.value).toEqual({})

    // 禁用存储键时不写盘
    const disabled = useVueColumnWidths({ storageKey: false })
    disabled.setColumnWidth('name', 220)
    expect(disabled.resolvedStorageKey.value).toBeNull()

    // localStorage 抛错时安全降级为 null
    ;(globalThis as any).window = {
      get localStorage() {
        throw new Error('blocked')
      },
    }
    const blocked = useVueColumnWidths({ storageKey: 'blocked-key' })
    blocked.setColumnWidth('name', 210)
    expect(blocked.getColumnWidth(nameCol)).toBe(210)
    delete (globalThis as any).window
  })

  it('组件内使用时正常注册生命周期', async () => {
    const storage = createMemoryStorage()
    const Comp = defineComponent({
      setup() {
        const w = useVueColumnWidths({ storageKey: 'ssr-widths', storage })
        w.setColumnWidth('name', 250)
        return () => h('div', String(w.getColumnWidth(nameCol)))
      },
    })
    const html = await renderToString(createSSRApp(Comp))
    expect(html).toContain('250')
  })
})
