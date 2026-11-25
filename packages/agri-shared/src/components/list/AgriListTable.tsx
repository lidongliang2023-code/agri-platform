import { useEffect, useMemo, useState } from 'react'
import type { Key, MouseEventHandler, ReactNode } from 'react'
import { Grid, Table } from 'antd'
import type { TableColumnsType, TableProps } from 'antd'
import MemberListToolbar from '../MemberListToolbar'
import { memberListPagination } from '../memberListPagination'
import ResizableTableHeader from './ResizableTableHeader'
import { useListColumnSettings } from './useListColumnSettings'
import {
  DEFAULT_SELECTION_COLUMN_WIDTH,
  MIN_RESIZABLE_COLUMN_WIDTH,
  clampColumnWidth,
  deriveColumnWidthStorageKey,
  isActionColumnMeta,
  isNumericColumnMeta,
  isStatusColumnMeta,
  parseConfiguredWidth,
  parseStoredWidths,
  resolveColumnKey,
  type ColumnWidths,
} from './listColumnUtils'
import './AgriList.css'

export interface AgriListTableProps<T extends object> extends TableProps<T> {
  /** 可选筛选区插槽，提供时按「筛选区 → 工具栏 → 表格 → 分页」四段式包裹输出。 */
  filterSlot?: ReactNode
  /** 工具栏左侧主操作 / 批量操作区（如「+ 新建」「批量导出」）。 */
  toolbarLeft?: ReactNode
  /** 是否显示右侧「列设置 / 刷新」工具栏，默认 true。 */
  showToolbar?: boolean
  /** 点击「刷新」回调；未传时不显示刷新按钮。 */
  onRefresh?: MouseEventHandler<HTMLButtonElement>
  refreshing?: boolean
  /** 列显隐偏好持久化键；传 false 关闭列设置持久保存。 */
  columnSettingsStorageKey?: string | false
  /** 不允许隐藏的列 key 列表，默认锁定操作列。 */
  lockedColumnKeys?: string[]
  /** 列宽拖拽持久化键；省略时若已传 columnSettingsStorageKey 则自动派生；传 false 关闭列宽持久化。 */
  columnWidthStorageKey?: string | false
  /** 是否启用表头拖拽调整列宽，默认 true。 */
  resizable?: boolean
  /** 外层容器 className。 */
  wrapperClassName?: string
}

/**
 * 跨子系统通用 React 标准列表组件（仅依赖 antd，不强绑 ProTable / react-query）：
 * - 四段式结构：筛选区 → 工具栏（左操作 / 右列设置与刷新）→ 固定列宽表格 → 20 条/页联动分页
 * - 自动规范：数字列右对齐、状态列圆点胶囊居中、操作列右对齐固定右侧、复选框列宽 48px 防省略号、选中行 #e8f5e9
 */
export default function AgriListTable<T extends object>({
  filterSlot,
  toolbarLeft,
  showToolbar = true,
  onRefresh,
  refreshing,
  columnSettingsStorageKey = false,
  lockedColumnKeys,
  columnWidthStorageKey,
  resizable = true,
  wrapperClassName = '',
  className = '',
  columns = [],
  components,
  rowSelection,
  pagination,
  scroll,
  tableLayout,
  ...tableProps
}: AgriListTableProps<T>): JSX.Element {
  const screens = Grid.useBreakpoint()
  const mobile = screens.md === false
  const [uncontrolledSelectedCount, setUncontrolledSelectedCount] = useState(0)

  const widthKey = deriveColumnWidthStorageKey(columnWidthStorageKey, columnSettingsStorageKey)
  const restoredWidths = useMemo(() => {
    if (!widthKey) return {}
    try {
      return parseStoredWidths(localStorage.getItem(widthKey))
    } catch {
      return {}
    }
  }, [widthKey])

  const [widthState, setWidthState] = useState<{ key: string | null; values: ColumnWidths }>(() => ({
    key: widthKey,
    values: restoredWidths,
  }))
  const widths = widthState.key === widthKey ? widthState.values : restoredWidths

  const resetAllWidths = () => {
    setWidthState({ key: widthKey, values: {} })
    if (widthKey) {
      try {
        localStorage.removeItem(widthKey)
      } catch {
        // 存储受限时忽略
      }
    }
  }

  const resolvedLockedKeys = useMemo(
    () => lockedColumnKeys ?? ['actions', 'action', 'option'],
    [lockedColumnKeys],
  )
  const { visibleColumns, columnSettings } = useListColumnSettings(
    columnSettingsStorageKey,
    columns,
    resolvedLockedKeys,
    { onReset: resetAllWidths },
  )

  useEffect(() => {
    if (!widthKey || widthState.key !== widthKey) return
    const persist = () => {
      try {
        if (Object.keys(widthState.values).length === 0) {
          localStorage.removeItem(widthKey)
        } else {
          localStorage.setItem(widthKey, JSON.stringify(widthState.values))
        }
      } catch {
        // 存储受限时忽略
      }
    }
    const timer = window.setTimeout(persist, 150)
    return () => {
      window.clearTimeout(timer)
      persist()
    }
  }, [widthKey, widthState])

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
          widths[key] ?? configured ?? (isAction ? 160 : isNumeric ? 120 : isStatus ? 104 : 160)
        totalWidth += width
        return {
          ...column,
          className: [column.className, isStatus && 'agri-status-cell'].filter(Boolean).join(' '),
          align: column.align ?? (isAction || isNumeric ? 'right' : isStatus ? 'center' : undefined),
          fixed: mobile ? undefined : column.fixed ?? (isAction ? 'right' : undefined),
          width,
          ...(resizable
            ? {
                onHeaderCell: (current) => ({
                  ...column.onHeaderCell?.(current),
                  resizeWidth: width,
                  onColumnResize: (next: number) =>
                    setWidthState((previous) => ({
                      key: widthKey,
                      values: {
                        ...(previous.key === widthKey ? previous.values : restoredWidths),
                        [key]: clampColumnWidth(next, MIN_RESIZABLE_COLUMN_WIDTH),
                      },
                    })),
                  onColumnReset: () =>
                    setWidthState((previous) => {
                      const currentWidths = previous.key === widthKey ? previous.values : restoredWidths
                      if (!(key in currentWidths)) return previous
                      const next = { ...currentWidths }
                      delete next[key]
                      return { key: widthKey, values: next }
                    }),
                }),
              }
            : {}),
        }
      })
    return { columns: walk(visibleColumns), totalWidth }
  }, [visibleColumns, widths, widthKey, restoredWidths, mobile, resizable])

  const controlledSelectedKeys =
    rowSelection && Array.isArray(rowSelection.selectedRowKeys) ? rowSelection.selectedRowKeys : undefined
  const selectedCount = controlledSelectedKeys ? controlledSelectedKeys.length : uncontrolledSelectedCount

  const mergedRowSelection = rowSelection
    ? {
        columnWidth: DEFAULT_SELECTION_COLUMN_WIDTH,
        ...rowSelection,
        onChange: (keys: Key[], rows: T[], info: any) => {
          setUncontrolledSelectedCount(keys.length)
          rowSelection.onChange?.(keys, rows, info)
        },
      }
    : undefined

  const selectionWidth = mergedRowSelection
    ? typeof mergedRowSelection.columnWidth === 'number'
      ? mergedRowSelection.columnWidth
      : DEFAULT_SELECTION_COLUMN_WIDTH
    : 0
  const minScrollX = enhanced.totalWidth > 0 ? enhanced.totalWidth + selectionWidth : enhanced.totalWidth

  const headerComponents = typeof components?.header === 'object' ? components.header : {}
  const mergedComponents = resizable
    ? { ...components, header: { ...headerComponents, cell: ResizableTableHeader } }
    : components

  const tableContent = (
    <>
      {showToolbar && (toolbarLeft || onRefresh || columns.length > 0) && (
        <div className="agri-list-toolbar">
          <div className="agri-list-toolbar-left">{toolbarLeft}</div>
          <div className="agri-list-toolbar-right">
            <MemberListToolbar
              columnSettings={columnSettings}
              onRefresh={onRefresh}
              refreshing={refreshing ?? Boolean(tableProps.loading)}
            />
          </div>
        </div>
      )}
      <Table<T>
        {...tableProps}
        className={`agri-list-table ${className}`.trim()}
        columns={enhanced.columns}
        components={mergedComponents}
        rowSelection={mergedRowSelection}
        tableLayout={tableLayout ?? 'fixed'}
        scroll={{
          ...scroll,
          x:
            typeof scroll?.x === 'number'
              ? Math.max(scroll.x, minScrollX)
              : !scroll?.x || scroll.x === 'max-content'
                ? minScrollX
                : scroll.x,
        }}
        pagination={memberListPagination(pagination, selectedCount)}
      />
    </>
  )

  if (filterSlot) {
    return (
      <div className={`agri-list-page ${wrapperClassName}`.trim()}>
        <div className="agri-list-filter-card">{filterSlot}</div>
        <div className="agri-list-table-card">{tableContent}</div>
      </div>
    )
  }

  return <div className={`agri-list-page ${wrapperClassName}`.trim()}>{tableContent}</div>
}
