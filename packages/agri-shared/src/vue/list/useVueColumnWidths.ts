/**
 * Vue 3 列表列宽拖拽与本地持久化组合式函数（零 Element Plus 依赖）。
 * 同时驱动纯 Vue 原生表格（AgriVueTable）与 Element Plus 封装表格（AgriElementListTable）。
 */

import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import {
  MIN_RESIZABLE_COLUMN_WIDTH,
  deriveColumnWidthStorageKey,
  loadStoredColumnWidths,
  removeColumnWidthEntry,
  resolveEffectiveVueColumnWidth,
  saveStoredColumnWidths,
  setColumnWidthEntry,
  type ColumnWidths,
  type NormalizedVueColumn,
  type StorageLike,
} from './vueListUtils'

export interface UseVueColumnWidthsOptions {
  storageKey?: string | false | (() => string | false | undefined)
  fallbackSettingsKey?: string | false | (() => string | false | undefined)
  storage?: StorageLike | null
}

export interface UseVueColumnWidthsReturn {
  widths: Ref<ColumnWidths>
  resolvedStorageKey: Ref<string | null>
  getColumnWidth: (col: NormalizedVueColumn) => number
  setColumnWidth: (key: string, width: number, minWidth?: number) => void
  resetColumnWidth: (key: string) => void
  resetAllWidths: () => void
}

function getDefaultStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null
  } catch {
    return null
  }
}

function resolveMaybeGetter(
  source: string | false | (() => string | false | undefined) | undefined,
): string | false | undefined {
  return typeof source === 'function' ? source() : source
}

export function useVueColumnWidths(options: UseVueColumnWidthsOptions = {}): UseVueColumnWidthsReturn {
  const storage = options.storage !== undefined ? options.storage : getDefaultStorage()

  const resolvedStorageKey = computed(() =>
    deriveColumnWidthStorageKey(
      resolveMaybeGetter(options.storageKey),
      resolveMaybeGetter(options.fallbackSettingsKey),
    ),
  )

  const widths = ref<ColumnWidths>(loadStoredColumnWidths(storage, resolvedStorageKey.value))
  let persistTimer: ReturnType<typeof setTimeout> | null = null

  function flushPersist(key = resolvedStorageKey.value, next = widths.value) {
    if (persistTimer !== null) {
      clearTimeout(persistTimer)
      persistTimer = null
    }
    if (key) {
      saveStoredColumnWidths(storage, key, next)
    }
  }

  function schedulePersist() {
    const key = resolvedStorageKey.value
    if (!key) return
    if (persistTimer !== null) clearTimeout(persistTimer)
    persistTimer = setTimeout(() => {
      persistTimer = null
      saveStoredColumnWidths(storage, key, widths.value)
    }, 150)
  }

  watch(resolvedStorageKey, (nextKey, prevKey) => {
    if (prevKey && persistTimer !== null) {
      flushPersist(prevKey, widths.value)
    }
    widths.value = loadStoredColumnWidths(storage, nextKey)
  })

  onBeforeUnmount(() => {
    if (persistTimer !== null) {
      flushPersist()
    }
  })

  const getColumnWidth = (col: NormalizedVueColumn): number =>
    resolveEffectiveVueColumnWidth(col, widths.value)

  const setColumnWidth = (key: string, width: number, minWidth = MIN_RESIZABLE_COLUMN_WIDTH): void => {
    widths.value = setColumnWidthEntry(widths.value, key, width, minWidth)
    schedulePersist()
  }

  const resetColumnWidth = (key: string): void => {
    const next = removeColumnWidthEntry(widths.value, key)
    if (next === widths.value) return
    widths.value = next
    flushPersist(resolvedStorageKey.value, next)
  }

  const resetAllWidths = (): void => {
    widths.value = {}
    flushPersist(resolvedStorageKey.value, {})
  }

  return {
    widths,
    resolvedStorageKey,
    getColumnWidth,
    setColumnWidth,
    resetColumnWidth,
    resetAllWidths,
  }
}
