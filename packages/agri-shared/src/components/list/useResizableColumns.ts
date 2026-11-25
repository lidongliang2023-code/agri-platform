import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TableColumnsType } from 'antd'
import {
  MIN_RESIZABLE_COLUMN_WIDTH,
  clampColumnWidth,
  isActionColumnMeta,
  isNumericColumnMeta,
  isStatusColumnMeta,
  parseConfiguredWidth,
  parseStoredWidths,
  resolveColumnKey,
  type ColumnWidths,
} from './listColumnUtils'

export interface UseResizableColumnsOptions {
  /** 是否启用拖拽调整列宽，默认 true。 */
  enabled?: boolean
  /** 默认单列宽度兜底（当列未显式配置 width 时）。 */
  defaultWidth?: number
  /** 附加基础宽（如复选框列宽 48），用于计算 totalWidth。 */
  extraWidth?: number
}

export interface UseResizableColumnsResult<T> {
  columns: TableColumnsType<T>
  widths: ColumnWidths
  totalWidth: number
  resizeColumn: (key: string, nextWidth: number) => void
  resetColumnWidth: (key: string) => void
  resetWidths: () => void
}

function readStoredWidths(storageKey: string | null): ColumnWidths {
  if (!storageKey) return {}
  try {
    return parseStoredWidths(localStorage.getItem(storageKey))
  } catch {
    return {}
  }
}

function persistWidths(storageKey: string | null, values: ColumnWidths): void {
  if (!storageKey) return
  try {
    if (Object.keys(values).length === 0) {
      localStorage.removeItem(storageKey)
    } else {
      localStorage.setItem(storageKey, JSON.stringify(values))
    }
  } catch {
    // 隐私模式或存储受限时静默忽略
  }
}

/**
 * 标准 Ant Design Table 列宽拖拽与浏览器持久化 Hook。
 * 支持鼠标拖拽、键盘方向键微调、双击表头手柄还原单列宽，以及一键重置全部自定义列宽。
 */
export function useResizableColumns<T extends object>(
  storageKey: string | false | null,
  sourceColumns: TableColumnsType<T>,
  options: UseResizableColumnsOptions = {},
): UseResizableColumnsResult<T> {
  const { enabled = true, defaultWidth = 160, extraWidth = 0 } = options
  const resolvedStorageKey = typeof storageKey === 'string' && storageKey.trim() ? storageKey.trim() : null

  const restored = useMemo(() => readStoredWidths(resolvedStorageKey), [resolvedStorageKey])
  const [widthState, setWidthState] = useState<{ key: string | null; values: ColumnWidths }>(() => ({
    key: resolvedStorageKey,
    values: restored,
  }))
  const widths = widthState.key === resolvedStorageKey ? widthState.values : restored

  useEffect(() => {
    if (!resolvedStorageKey || widthState.key !== resolvedStorageKey) return
    const timer = window.setTimeout(() => {
      persistWidths(resolvedStorageKey, widthState.values)
    }, 150)
    return () => {
      window.clearTimeout(timer)
      persistWidths(resolvedStorageKey, widthState.values)
    }
  }, [resolvedStorageKey, widthState])

  const resizeColumn = useCallback(
    (key: string, nextWidth: number) => {
      const clamped = clampColumnWidth(nextWidth, MIN_RESIZABLE_COLUMN_WIDTH)
      setWidthState((previous) => ({
        key: resolvedStorageKey,
        values: {
          ...(previous.key === resolvedStorageKey ? previous.values : restored),
          [key]: clamped,
        },
      }))
    },
    [resolvedStorageKey, restored],
  )

  const resetColumnWidth = useCallback(
    (key: string) => {
      setWidthState((previous) => {
        const current = previous.key === resolvedStorageKey ? previous.values : restored
        if (!(key in current)) return previous
        const next = { ...current }
        delete next[key]
        return { key: resolvedStorageKey, values: next }
      })
    },
    [resolvedStorageKey, restored],
  )

  const resetWidths = useCallback(() => {
    setWidthState({ key: resolvedStorageKey, values: {} })
    persistWidths(resolvedStorageKey, {})
  }, [resolvedStorageKey])

  const enhanced = useMemo(() => {
    let totalWidth = 0
    const walk = (items: TableColumnsType<T>, parent = ''): TableColumnsType<T> =>
      items.map((column, index) => {
        const key = resolveColumnKey(column as { key?: unknown; dataIndex?: unknown }, index, parent)
        if ('children' in column && column.children?.length) {
          return { ...column, children: walk(column.children, key) }
        }
        const title = typeof column.title === 'string' ? column.title : ''
        const isAction = isActionColumnMeta(title, column.key as string | number | undefined)
        const isNumeric = isNumericColumnMeta(title)
        const isStatus = isStatusColumnMeta(title)
        const configured = parseConfiguredWidth(column.width)
        const width =
          widths[key] ?? configured ?? (isAction ? 160 : isNumeric ? 120 : isStatus ? 104 : defaultWidth)
        totalWidth += width
        if (!enabled) {
          return { ...column, width }
        }
        return {
          ...column,
          width,
          onHeaderCell: (current) => ({
            ...column.onHeaderCell?.(current),
            resizeWidth: width,
            onColumnResize: (next: number) => resizeColumn(key, next),
            onColumnReset: () => resetColumnWidth(key),
          }),
        }
      })

    const nextColumns = walk(sourceColumns)
    return {
      columns: nextColumns,
      totalWidth: totalWidth > 0 ? totalWidth + extraWidth : 0,
    }
  }, [sourceColumns, widths, defaultWidth, extraWidth, enabled, resizeColumn, resetColumnWidth])

  return {
    columns: enhanced.columns,
    widths,
    totalWidth: enhanced.totalWidth,
    resizeColumn,
    resetColumnWidth,
    resetWidths,
  }
}
