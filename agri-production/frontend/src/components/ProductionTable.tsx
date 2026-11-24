import { isValidElement, useContext, useEffect, useMemo, useState } from 'react'
import type { Key } from 'react'
import { createPortal } from 'react-dom'
import { SectionToolbarContext } from './SectionToolbarContext'
import { useLocation } from 'react-router-dom'
import { ProTable } from '@ant-design/pro-components'
import type { ProColumns, ProTableProps } from '@ant-design/pro-components'
import { Grid } from 'antd'
import MemberListToolbar, { columnSettingsTrigger } from '@agri/shared/components/MemberListToolbar'
import {
  DEFAULT_SELECTION_COLUMN_WIDTH,
  MIN_RESIZABLE_COLUMN_WIDTH,
  isActionColumnMeta,
  isNumericColumnMeta,
  isStatusColumnMeta,
  parseConfiguredWidth,
  parseStoredWidths,
  resolveColumnKey,
  type ColumnWidths,
} from '@agri/shared/components/list/listColumnUtils'
import type { TableProps } from 'antd'
import { useQueryClient } from '@tanstack/react-query'
import ResizableTableHeader from './ResizableTableHeader'
import './ProductionTable.css'
import { productionPagination } from './ProductionPagination'

type ProductionTableProps<T extends Record<string, any>, P extends Record<string, any>> = ProTableProps<T, P> & {
  /** 同一页面存在字段完全一致的多个列表时，指定不同标识。false 关闭持久保存。 */
  columnWidthStorageKey?: string | false
  memberListToolbar?: boolean
}

function readWidths(key: string | null): ColumnWidths {
  if (!key) return {}
  try {
    return parseStoredWidths(localStorage.getItem(key))
  } catch { return {} }
}

/** 生产记录统一列表：刷新、密度、列设置、列宽拖拽及浏览器持久保存。 */
export default function ProductionTable<T extends Record<string, any>, P extends Record<string, any> = Record<string, any>>({ size, onSizeChange, options, className = '', columns, components, scroll, tableLayout, columnWidthStorageKey, memberListToolbar, ...props }: ProductionTableProps<T, P>): JSX.Element {
  const screens = Grid.useBreakpoint()
  const mobile = screens.md === false
  const queryClient = useQueryClient()
  const toolbarHost = useContext(SectionToolbarContext)
  const mergeToolbar = toolbarHost && props.search === false && !props.headerTitle && !props.toolbar?.title && !props.toolbar?.menu && !props.tableRender
  const [density, setDensity] = useState<TableProps<T>['size']>(size ?? 'middle')
  const [uncontrolledSelectedCount, setUncontrolledSelectedCount] = useState<number>(0)
  const { pathname } = useLocation()
  const signature = (items: ProColumns<T>[]): unknown[] => items.map((column, index) => [
    column.key ?? column.dataIndex ?? index,
    typeof column.title === 'string' ? column.title : '',
    column.children ? signature(column.children) : null,
  ])
  const storageKey = columnWidthStorageKey === false ? null : `agri:production:column-widths:v1:${pathname}:${columnWidthStorageKey ?? JSON.stringify(signature(columns ?? []))}`
  const restored = useMemo(() => readWidths(storageKey), [storageKey])
  const [widthState, setWidthState] = useState<{ key: string | null; values: ColumnWidths }>(() => ({ key: storageKey, values: restored }))
  const widths = widthState.key === storageKey ? widthState.values : restored
  useEffect(() => {
    if (!storageKey || widthState.key !== storageKey) return
    const timer = window.setTimeout(() => {
      try { localStorage.setItem(storageKey, JSON.stringify(widthState.values)) } catch { /* 存储不可用不阻断列表操作。 */ }
    }, 150)
    return () => {
      window.clearTimeout(timer)
      // 切换页面或卸载时也保存最后一次拖动结果。
      try { localStorage.setItem(storageKey, JSON.stringify(widthState.values)) } catch { /* 同上。 */ }
    }
  }, [storageKey, widthState])
  const supplied = options && typeof options === 'object' ? options : {}
  const resizable = useMemo(() => {
    let totalWidth = 0
    const walk = (items: ProColumns<T>[], parent = ''): ProColumns<T>[] => items.map((column, index) => {
      const key = `/${resolveColumnKey(column, index, parent)}`
      if (column.children?.length) return { ...column, children: walk(column.children, key.slice(1)) }
      const configured = parseConfiguredWidth(column.width)
      const title = typeof column.title === 'string' ? column.title : ''
      const isAction = isActionColumnMeta(title, column.key as string | number | undefined, column.valueType)
      const isNumeric = isNumericColumnMeta(title, column.valueType)
      const isStatus = isStatusColumnMeta(title)
      const width = widths[key] ?? configured ?? (isAction ? 180 : isNumeric ? 120 : isStatus ? 100 : 160)
      if (!column.hideInTable) totalWidth += width
      return {
        ...column,
        className: [column.className, isStatus && 'production-status-cell'].filter(Boolean).join(' '),
        align: isAction || isNumeric ? 'right' : isStatus ? 'center' : column.align,
        fixed: mobile ? undefined : isAction ? 'right' : column.fixed,
        width,
        onHeaderCell: (current) => ({
          ...column.onHeaderCell?.(current),
          resizeWidth: width,
          onColumnResize: (next: number) => setWidthState((previous) => ({ key: storageKey, values: { ...(previous.key === storageKey ? previous.values : restored), [key]: Math.max(MIN_RESIZABLE_COLUMN_WIDTH, next) } })),
        }),
      }
    })
    return { columns: columns ? walk(columns) : undefined, totalWidth }
  }, [columns, widths, storageKey, restored, mobile])
  const headerComponents = typeof components?.header === 'object' ? components.header : {}
  const controlledSelectedKeys = props.rowSelection && typeof props.rowSelection === 'object' && Array.isArray(props.rowSelection.selectedRowKeys)
    ? props.rowSelection.selectedRowKeys
    : undefined
  const selectedCount = controlledSelectedKeys ? controlledSelectedKeys.length : uncontrolledSelectedCount
  const mergedRowSelection = props.rowSelection && typeof props.rowSelection === 'object'
    ? {
        columnWidth: DEFAULT_SELECTION_COLUMN_WIDTH,
        ...props.rowSelection,
        onChange: (keys: Key[], rows: T[], info: any) => {
          setUncontrolledSelectedCount(keys.length)
          props.rowSelection && typeof props.rowSelection === 'object' && props.rowSelection.onChange?.(keys, rows, info)
        },
      }
    : props.rowSelection
  const selectionColumnWidth = mergedRowSelection && typeof mergedRowSelection === 'object'
    ? (typeof mergedRowSelection.columnWidth === 'number' ? mergedRowSelection.columnWidth : DEFAULT_SELECTION_COLUMN_WIDTH)
    : 0
  const minScrollX = resizable.totalWidth > 0 ? resizable.totalWidth + selectionColumnWidth : resizable.totalWidth
  const searchableColumnCount = useMemo(() => {
    const countSearchable = (items?: ProColumns<T>[]): number => {
      if (!items?.length) return 0
      return items.reduce((sum, column) => {
        if (column.children?.length) return sum + countSearchable(column.children)
        if (column.search === false || column.hideInSearch || column.valueType === 'option') return sum
        return sum + 1
      }, 0)
    }
    return countSearchable(columns)
  }, [columns])
  const normalizedSearch = props.search === false
    ? false
    : props.search && typeof props.search === 'object'
      ? {
          span: { xs: 24, sm: 12, md: 12, lg: 6, xl: 6, xxl: 6 },
          searchGutter: 12,
          defaultCollapsed: searchableColumnCount >= 5,
          ...props.search,
        }
      : props.search
  return <ProTable<T, P>
    {...props}
    search={normalizedSearch}
    rowSelection={mergedRowSelection}
    tableAlertRender={props.tableAlertRender ?? (pathname.startsWith('/production/') && mergedRowSelection ? false : undefined)}
    pagination={productionPagination(props.pagination, selectedCount)}
    tableRender={mergeToolbar ? (_tableProps, _defaultDom, dom) => <>
      {dom.toolbar && createPortal(dom.toolbar, toolbarHost)}
      {dom.alert}
      {dom.table}
    </> : props.tableRender}
    columns={resizable.columns}
    columnsState={props.columnsState ?? (memberListToolbar ? {
      persistenceType: 'localStorage',
      persistenceKey: columnWidthStorageKey ? `agri:production:visible-columns:v1:${pathname}:${columnWidthStorageKey}` : `agri:production:visible-columns:v1:${pathname}`,
    } : undefined)}
    components={{ ...components, header: { ...headerComponents, cell: ResizableTableHeader } }}
    tableLayout={tableLayout ?? 'fixed'}
    scroll={{ ...scroll, x: typeof scroll?.x === 'number' ? Math.max(scroll.x, minScrollX) : !scroll?.x || scroll.x === 'max-content' ? minScrollX : scroll.x }}
    className={`production-record-table ${className}`.trim()}
    toolBarRender={props.toolBarRender === false ? () => [] : props.toolBarRender}
    size={density}
    onSizeChange={(next) => { setDensity(next); onSizeChange?.(next) }}
    optionsRender={memberListToolbar ? ({ action }, controls) => {
      const isSettings = (node: React.ReactNode) => isValidElement(node) && node.key === 'setting'
      const reload = supplied.reload
      return [
        ...controls.filter((node) => !isSettings(node)),
        <MemberListToolbar key="member-tools" columnSettings={controls.find(isSettings)}
          onRefresh={reload === false ? undefined : (event) => {
            if (typeof reload === 'function') reload(event, action.current)
            else if (props.request || reload === true) void action.current?.reload()
            else void queryClient.invalidateQueries({ refetchType: 'active' })
          }} />,
      ]
    } : props.optionsRender}
    options={{
      ...supplied,
      reload: memberListToolbar ? false : supplied.reload ?? (props.request ? true : () => { void queryClient.invalidateQueries({ refetchType: 'active' }) }),
      density: true,
      setting: memberListToolbar ? { settingIcon: columnSettingsTrigger() } : true,
      fullScreen: false,
    }}
  />
}
