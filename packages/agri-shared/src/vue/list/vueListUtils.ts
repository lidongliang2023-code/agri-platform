/**
 * Vue 端共享列表纯逻辑工具（零 Vue / Element Plus 运行时依赖，便于全量单元测试）：
 * - 复用跨端 listColumnUtils 的列角色判定与持久化校验
 * - 提供页码窗口计算（含省略号）、默认 20 条/页分页模型、操作列收拢拆分及筛选区默认折叠判断
 */

import {
  DEFAULT_SELECTION_COLUMN_WIDTH,
  MIN_RESIZABLE_COLUMN_WIDTH,
  isActionColumnMeta,
  isNumericColumnMeta,
  isStatusColumnMeta,
  parseConfiguredWidth,
  parseHiddenColumnKeys,
  parseStoredWidths,
  resolveColumnKey,
  sanitizeHiddenColumnKeys,
  type ColumnWidths,
} from '../../components/list/listColumnUtils'

export {
  DEFAULT_SELECTION_COLUMN_WIDTH,
  MIN_RESIZABLE_COLUMN_WIDTH,
  isActionColumnMeta,
  isNumericColumnMeta,
  isStatusColumnMeta,
  parseConfiguredWidth,
  parseHiddenColumnKeys,
  parseStoredWidths,
  resolveColumnKey,
  sanitizeHiddenColumnKeys,
  type ColumnWidths,
}

export const DEFAULT_VUE_PAGE_SIZE = 20
export const DEFAULT_VUE_PAGE_SIZES = [10, 20, 50, 100] as const
export const DEFAULT_COLLAPSE_THRESHOLD = 5

export interface VueListColumn {
  /** 稳定列键（缺省时退回 prop / 索引）。 */
  key?: string
  /** 对应行数据字段名（支持 a.b 路径）。 */
  prop?: string
  /** 列标题。 */
  label: string
  /** 固定列宽（像素或数字）。 */
  width?: number | string
  /** 最小列宽。 */
  minWidth?: number | string
  /** 显式对齐方式（缺省时数值列自动 right、状态列 center、操作列 right）。 */
  align?: 'left' | 'center' | 'right'
  /** 固定方向（操作列默认 right）。 */
  fixed?: boolean | 'left' | 'right'
  /** 列语义类型，缺省按标题自动识别。 */
  kind?: 'default' | 'number' | 'status' | 'code' | 'action'
  /** 单行溢出省略（默认普通列 true，操作/状态列 false）。 */
  ellipsis?: boolean
  /** 禁止在「列设置」中隐藏。 */
  locked?: boolean
  /** 默认隐藏。 */
  defaultHidden?: boolean
  /** 透传额外单元格类名。 */
  className?: string
  /** 支持排序（Element Plus 透传）。 */
  sortable?: boolean | 'custom'
  /** 格式化函数。 */
  formatter?: (row: Record<string, unknown>, value: unknown, index: number) => string
}

export interface NormalizedVueColumn extends VueListColumn {
  resolvedKey: string
  resolvedAlign: 'left' | 'center' | 'right'
  resolvedKind: 'default' | 'number' | 'status' | 'code' | 'action'
  resolvedFixed: boolean | 'left' | 'right' | undefined
  resolvedLocked: boolean
  resolvedEllipsis: boolean
  resolvedWidth: number | undefined
  resolvedMinWidth: number | undefined
}

export interface VueRowActionItem {
  key: string
  label: string
  danger?: boolean
  disabled?: boolean
  hidden?: boolean
  /** 确认文案（传入时点击会先走确认回调或内置确认）。 */
  confirm?: string
  onClick?: () => void
}

export type PageToken = number | 'ellipsis-left' | 'ellipsis-right'

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** 标准化单列定义：自动识别操作/数值/状态列，并统一对齐、锁定与宽度。 */
export function normalizeVueColumn(column: VueListColumn, index: number): NormalizedVueColumn {
  const resolvedKey = resolveColumnKey({ key: column.key, dataIndex: column.prop }, index)
  const inferredAction = column.kind === 'action' || isActionColumnMeta(column.label, column.key ?? column.prop)
  const inferredNumber = !inferredAction && (column.kind === 'number' || isNumericColumnMeta(column.label))
  const inferredStatus = !inferredAction && !inferredNumber && (column.kind === 'status' || isStatusColumnMeta(column.label))

  const resolvedKind: NormalizedVueColumn['resolvedKind'] =
    column.kind ?? (inferredAction ? 'action' : inferredNumber ? 'number' : inferredStatus ? 'status' : 'default')

  const resolvedAlign: 'left' | 'center' | 'right' =
    column.align ??
    (resolvedKind === 'action' || resolvedKind === 'number'
      ? 'right'
      : resolvedKind === 'status'
        ? 'center'
        : 'left')

  const resolvedFixed = column.fixed !== undefined ? column.fixed : resolvedKind === 'action' ? 'right' : undefined
  const resolvedLocked = column.locked ?? resolvedKind === 'action'
  const resolvedEllipsis = column.ellipsis ?? (resolvedKind !== 'action' && resolvedKind !== 'status')

  return {
    ...column,
    resolvedKey,
    resolvedAlign,
    resolvedKind,
    resolvedFixed,
    resolvedLocked,
    resolvedEllipsis,
    resolvedWidth: parseConfiguredWidth(column.width),
    resolvedMinWidth: parseConfiguredWidth(column.minWidth),
  }
}

/** 批量标准化列定义并汇总锁定列键。 */
export function normalizeVueColumns(
  columns: readonly VueListColumn[],
  extraLockedKeys: readonly string[] = [],
): { columns: NormalizedVueColumn[]; lockedKeys: string[]; defaultHiddenKeys: string[] } {
  const normalized = columns.map((col, idx) => normalizeVueColumn(col, idx))
  const locked = new Set<string>(extraLockedKeys)
  const defaultHidden: string[] = []
  for (const col of normalized) {
    if (col.resolvedLocked) locked.add(col.resolvedKey)
    if (col.defaultHidden && !locked.has(col.resolvedKey)) {
      defaultHidden.push(col.resolvedKey)
    }
  }
  return {
    columns: normalized,
    lockedKeys: [...locked],
    defaultHiddenKeys: defaultHidden,
  }
}

/** 过滤当前应展示的列（自动剔除隐藏列，同时确保锁定列永远可见）。 */
export function filterVisibleVueColumns(
  columns: readonly NormalizedVueColumn[],
  hiddenKeys: readonly string[],
  lockedKeys: readonly string[] = [],
): NormalizedVueColumn[] {
  const safeHidden = new Set(sanitizeHiddenColumnKeys([...hiddenKeys], [...lockedKeys]))
  return columns.filter((col) => !safeHidden.has(col.resolvedKey))
}

/** 读取安全存储的隐藏列键（存储异常时回退默认隐藏列）。 */
export function loadStoredHiddenKeys(
  storage: StorageLike | null | undefined,
  storageKey: string | false | undefined,
  lockedKeys: readonly string[],
  defaultHiddenKeys: readonly string[] = [],
): string[] {
  if (!storage || !storageKey) {
    return sanitizeHiddenColumnKeys([...defaultHiddenKeys], [...lockedKeys])
  }
  try {
    const raw = storage.getItem(storageKey)
    if (raw === null) {
      return sanitizeHiddenColumnKeys([...defaultHiddenKeys], [...lockedKeys])
    }
    return sanitizeHiddenColumnKeys(parseHiddenColumnKeys(raw), [...lockedKeys])
  } catch {
    return sanitizeHiddenColumnKeys([...defaultHiddenKeys], [...lockedKeys])
  }
}

/** 写入隐藏列键到本地存储（安全吞掉受限环境异常）。 */
export function saveStoredHiddenKeys(
  storage: StorageLike | null | undefined,
  storageKey: string | false | undefined,
  hiddenKeys: readonly string[],
  lockedKeys: readonly string[],
): string[] {
  const sanitized = sanitizeHiddenColumnKeys([...hiddenKeys], [...lockedKeys])
  if (storage && storageKey) {
    try {
      storage.setItem(storageKey, JSON.stringify(sanitized))
    } catch {
      // 隐私模式或存储配额受限时忽略
    }
  }
  return sanitized
}

/** 根据「操作列最多平铺 2 个文字链接，超出收进更多」拆分操作项。 */
export function partitionRowActions<T extends { hidden?: boolean }>(
  actions: readonly T[],
  maxVisible = 2,
): { visible: T[]; overflow: T[] } {
  const active = actions.filter((item) => !item.hidden)
  const limit = Math.max(1, Math.floor(maxVisible))
  if (active.length <= limit) {
    return { visible: active, overflow: [] }
  }
  return {
    visible: active.slice(0, limit - 1),
    overflow: active.slice(limit - 1),
  }
}

/** 是否应启用 5+ 条件默认折叠逻辑。 */
export function shouldCollapseFilters(fieldCount: number, threshold = DEFAULT_COLLAPSE_THRESHOLD): boolean {
  return Number.isFinite(fieldCount) && fieldCount >= Math.max(2, Math.floor(threshold))
}

/** 计算总页数（最小为 1）。 */
export function computeTotalPages(total: number, pageSize: number): number {
  const safeTotal = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0
  const safeSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : DEFAULT_VUE_PAGE_SIZE
  return Math.max(1, Math.ceil(safeTotal / safeSize))
}

/** 将页码夹紧到有效区间 [1, totalPages]。 */
export function clampPage(page: number, total: number, pageSize: number): number {
  const totalPages = computeTotalPages(total, pageSize)
  if (!Number.isFinite(page) || page < 1) return 1
  return Math.min(Math.floor(page), totalPages)
}

/**
 * 生成带省略号的页码序列，贴合设计规范：`< 1 2 3 4 ... 15 >`。
 * 总页数 ≤ 7 时全部展开；超过 7 页时展示首尾页与当前页邻域。
 */
export function buildPageTokens(currentPage: number, totalPages: number): PageToken[] {
  const total = Math.max(1, Math.floor(totalPages))
  const current = Math.min(Math.max(1, Math.floor(currentPage)), total)
  if (total <= 7) {
    return Array.from({ length: total }, (_, idx) => idx + 1)
  }
  const tokens: PageToken[] = [1]
  let start = Math.max(2, current - 1)
  let end = Math.min(total - 1, current + 1)

  if (current <= 3) {
    start = 2
    end = 4
  } else if (current >= total - 2) {
    start = total - 3
    end = total - 1
  }

  if (start > 2) tokens.push('ellipsis-left')
  for (let p = start; p <= end; p += 1) tokens.push(p)
  if (end < total - 1) tokens.push('ellipsis-right')
  tokens.push(total)
  return tokens
}

/** 按路径读取单元格值（支持 `a.b.c`）。 */
export function readCellValue(row: Record<string, unknown>, prop?: string): unknown {
  if (!prop) return undefined
  if (!prop.includes('.')) return row[prop]
  let current: unknown = row
  for (const part of prop.split('.')) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

/** 格式化页脚统计文案：「已选 2 项 · 共 286 条」或「共 286 条」。 */
export function formatSelectionSummary(total: number, selectedCount = 0, unit = '条'): string {
  const safeTotal = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0
  const safeSelected = Number.isFinite(selectedCount) && selectedCount > 0 ? Math.floor(selectedCount) : 0
  return safeSelected > 0 ? `已选 ${safeSelected} 项 · 共 ${safeTotal} ${unit}` : `共 ${safeTotal} ${unit}`
}
