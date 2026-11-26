/**
 * Vue 3 列显隐持久化组合式函数（零 Element Plus 依赖）。
 * 同一套逻辑可同时驱动主数据管理平台原生表与 Element Plus 业务表。
 */

import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import {
  filterVisibleVueColumns,
  loadStoredHiddenKeys,
  normalizeVueColumns,
  saveStoredHiddenKeys,
  type NormalizedVueColumn,
  type StorageLike,
  type VueListColumn,
} from './vueListUtils'

export interface UseVueListColumnsOptions {
  storageKey?: string | false | (() => string | false | undefined)
  lockedKeys?: string[]
  storage?: StorageLike | null
}

export interface UseVueListColumnsReturn {
  normalizedColumns: ComputedRef<NormalizedVueColumn[]>
  visibleColumns: ComputedRef<NormalizedVueColumn[]>
  lockedKeys: ComputedRef<string[]>
  hiddenKeys: Ref<string[]>
  isColumnVisible: (key: string) => boolean
  toggleColumn: (key: string, visible?: boolean) => void
  resetColumns: () => void
}

function getDefaultStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null
  } catch {
    return null
  }
}

export function useVueListColumns(
  columnsSource: Ref<readonly VueListColumn[]> | ComputedRef<readonly VueListColumn[]> | (() => readonly VueListColumn[]),
  options: UseVueListColumnsOptions = {},
): UseVueListColumnsReturn {
  const storage = options.storage !== undefined ? options.storage : getDefaultStorage()

  const meta = computed(() => {
    const raw = typeof columnsSource === 'function' ? columnsSource() : columnsSource.value
    return normalizeVueColumns(raw, options.lockedKeys ?? [])
  })

  const normalizedColumns = computed(() => meta.value.columns)
  const lockedKeys = computed(() => meta.value.lockedKeys)

  const resolvedStorageKey = computed<string | false | undefined>(() =>
    typeof options.storageKey === 'function' ? options.storageKey() : options.storageKey,
  )

  const hiddenKeys = ref<string[]>(
    loadStoredHiddenKeys(storage, resolvedStorageKey.value, meta.value.lockedKeys, meta.value.defaultHiddenKeys),
  )

  watch(
    () => [resolvedStorageKey.value, meta.value.lockedKeys.join('|')] as const,
    () => {
      hiddenKeys.value = loadStoredHiddenKeys(
        storage,
        resolvedStorageKey.value,
        meta.value.lockedKeys,
        meta.value.defaultHiddenKeys,
      )
    },
  )

  const visibleColumns = computed(() =>
    filterVisibleVueColumns(normalizedColumns.value, hiddenKeys.value, lockedKeys.value),
  )

  const isColumnVisible = (key: string): boolean => !hiddenKeys.value.includes(key)

  const toggleColumn = (key: string, visible?: boolean): void => {
    if (lockedKeys.value.includes(key)) return
    const currentlyHidden = hiddenKeys.value.includes(key)
    const nextVisible = visible !== undefined ? visible : currentlyHidden
    const next = nextVisible
      ? hiddenKeys.value.filter((item: string) => item !== key)
      : [...hiddenKeys.value, key]
    hiddenKeys.value = saveStoredHiddenKeys(storage, resolvedStorageKey.value, next, lockedKeys.value)
  }

  const resetColumns = (): void => {
    hiddenKeys.value = saveStoredHiddenKeys(
      storage,
      resolvedStorageKey.value,
      meta.value.defaultHiddenKeys,
      lockedKeys.value,
    )
  }

  return {
    normalizedColumns,
    visibleColumns,
    lockedKeys,
    hiddenKeys,
    isColumnVisible,
    toggleColumn,
    resetColumns,
  }
}
