import { useContext, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { SectionToolbarContext } from './SectionToolbarContext'
import { useLocation } from 'react-router-dom'
import { ProTable } from '@ant-design/pro-components'
import type { ProColumns, ProTableProps } from '@ant-design/pro-components'
import type { TableProps } from 'antd'
import { useQueryClient } from '@tanstack/react-query'
import ResizableTableHeader from './ResizableTableHeader'
import './ProductionTable.css'

type ColumnWidths = Record<string, number>
type ProductionTableProps<T extends Record<string, any>, P extends Record<string, any>> = ProTableProps<T, P> & {
  /** 同一页面存在字段完全一致的多个列表时，指定不同标识。false 关闭持久保存。 */
  columnWidthStorageKey?: string | false
}

function readWidths(key: string | null): ColumnWidths {
  if (!key) return {}
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(Object.entries(parsed).filter(([, value]) => typeof value === 'number' && Number.isFinite(value) && value >= 80))
  } catch { return {} }
}

/** 生产记录统一列表：刷新、密度、列设置、列宽拖拽及浏览器持久保存。 */
export default function ProductionTable<T extends Record<string, any>, P extends Record<string, any> = Record<string, any>>({ size, onSizeChange, options, className = '', columns, components, scroll, tableLayout, columnWidthStorageKey, ...props }: ProductionTableProps<T, P>): JSX.Element {
  const queryClient = useQueryClient()
  const toolbarHost = useContext(SectionToolbarContext)
  const mergeToolbar = toolbarHost && !props.headerTitle && !props.toolbar?.title && !props.toolbar?.menu && !props.tableRender
  const [density, setDensity] = useState<TableProps<T>['size']>(size ?? 'small')
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
      const key = `${parent}/${String(column.key ?? (Array.isArray(column.dataIndex) ? column.dataIndex.join('.') : column.dataIndex) ?? index)}`
      if (column.children?.length) return { ...column, children: walk(column.children, key) }
      const configured = typeof column.width === 'number' ? column.width : typeof column.width === 'string' && /^\d+(px)?$/.test(column.width) ? Number.parseFloat(column.width) : undefined
      const width = widths[key] ?? configured ?? (column.valueType === 'option' ? 180 : 160)
      if (!column.hideInTable) totalWidth += width
      return {
        ...column,
        width,
        onHeaderCell: (current) => ({
          ...column.onHeaderCell?.(current),
          resizeWidth: width,
          onColumnResize: (next: number) => setWidthState((previous) => ({ key: storageKey, values: { ...(previous.key === storageKey ? previous.values : restored), [key]: Math.max(80, next) } })),
        }),
      }
    })
    return { columns: columns ? walk(columns) : undefined, totalWidth }
  }, [columns, widths, storageKey, restored])
  const headerComponents = typeof components?.header === 'object' ? components.header : {}
  return <ProTable<T, P>
    {...props}
    tableRender={mergeToolbar ? (_tableProps, _defaultDom, dom) => <>
      {dom.toolbar && createPortal(dom.toolbar, toolbarHost)}
      {dom.alert}
      {dom.table}
    </> : props.tableRender}
    columns={resizable.columns}
    components={{ ...components, header: { ...headerComponents, cell: ResizableTableHeader } }}
    tableLayout={tableLayout ?? 'fixed'}
    scroll={{ ...scroll, x: typeof scroll?.x === 'number' ? Math.max(scroll.x, resizable.totalWidth) : !scroll?.x || scroll.x === 'max-content' ? resizable.totalWidth : scroll.x }}
    className={`production-record-table ${className}`.trim()}
    toolBarRender={props.toolBarRender === false ? () => [] : props.toolBarRender}
    size={density}
    onSizeChange={(next) => { setDensity(next); onSizeChange?.(next) }}
    options={{
      ...supplied,
      reload: supplied.reload ?? (props.request ? true : () => { void queryClient.invalidateQueries({ refetchType: 'active' }) }),
      density: true,
      setting: true,
      fullScreen: false,
    }}
  />
}
