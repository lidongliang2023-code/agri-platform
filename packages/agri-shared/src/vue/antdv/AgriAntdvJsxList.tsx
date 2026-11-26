import { computed, defineComponent, h, isVNode, watch, type PropType, type VNodeChild } from 'vue'
import type { TablePaginationConfig } from 'ant-design-vue/es/table/interface'
import AgriAntdvListTable from './AgriAntdvListTable.vue'
import type { VueListColumn } from '../list/vueListUtils'

function extractTextFromVNode(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractTextFromVNode).join('').trim()
  if (isVNode(node)) {
    const ch = node.children
    if (typeof ch === 'string' || typeof ch === 'number') return String(ch).trim()
    if (Array.isArray(ch)) return ch.map(extractTextFromVNode).join('').trim()
    if (ch && typeof ch === 'object' && typeof (ch as Record<string, unknown>).default === 'function') {
      try {
        return extractTextFromVNode((ch as { default: () => unknown }).default())
      } catch {
        return ''
      }
    }
  }
  return ''
}

export type ListRecord = Record<string, unknown>
export interface JsxListColumn {
  key?: string | number
  dataIndex?: string | number | readonly (string | number)[]
  title?: VNodeChild | ((...args: any[]) => VNodeChild)
  width?: number | string
  align?: 'left' | 'center' | 'right'
  fixed?: boolean | 'left' | 'right'
  ellipsis?: boolean | object
  className?: string
  sorter?: boolean | ((a: any, b: any) => number) | { compare?: (a: any, b: any) => number; multiple?: number }
  render?: (value: any, record: any, index: number) => VNodeChild
}
export interface JsxListSelection {
  selectedRowKeys?: (string | number)[]
  onChange?: (keys: (string | number)[], rows: any[]) => void
  getCheckboxProps?: (record: any) => Record<string, unknown>
  preserveSelectedRowKeys?: boolean
}

export const agriAntdvJsxListProps = {
    columns: { type: Array as PropType<readonly JsxListColumn[]>, default: () => [] },
    dataSource: { type: Array as PropType<readonly object[]>, default: () => [] },
    rowKey: { type: [String, Function] as PropType<string | ((row: any) => string | number)>, default: 'id' },
    loading: Boolean,
    size: String as PropType<'small' | 'middle' | 'large'>,
    showToolbar: {type:Boolean,default:true},
    rowClassName: Function as PropType<(record:any,index:number)=>string>,
    selectable: { type: Boolean, default: true },
    pagination: { type: [Object, Boolean] as PropType<TablePaginationConfig | false>, default: () => ({}) },
    rowSelection: Object as PropType<JsxListSelection>,
    filterSlot: null as unknown as PropType<VNodeChild>,
    toolbarLeft: null as unknown as PropType<VNodeChild>,
    toolbarRight: null as unknown as PropType<VNodeChild>,
    columnSettingsStorageKey: [String, Boolean] as PropType<string | false>,
    columnWidthStorageKey: [String, Boolean] as PropType<string | false>,
    wrapperClassName: String,
    locale: Object as PropType<{ emptyText?: VNodeChild }>,
    scroll: Object as PropType<{ x?: number | 'max-content'; y?: number | string }>,
    expandable: Object as PropType<{ expandedRowRender?: (row: any, index: number) => VNodeChild; rowExpandable?: (row: any) => boolean }>,
    onRow: Function as PropType<(record: any, index?: number) => Record<string, unknown>>,
    onRefresh: Function as PropType<() => void>,
    onChange: Function as PropType<(...args: any[]) => void>,
  }

/** Vue TSX 业务页面的薄适配，实际布局和交互由 AgriAntdvListTable 统一维护。 */
export const AgriAntdvJsxList = defineComponent({
  name: 'AgriAntdvJsxList',
  inheritAttrs: false,
  props: agriAntdvJsxListProps,
  setup(props, { attrs, slots }) {
    const normalized = computed<VueListColumn[]>(() => props.columns.map((column, index) => ({
      key: String(column.key ?? (Array.isArray(column.dataIndex) ? column.dataIndex.join('.') : column.dataIndex) ?? index),
      prop: Array.isArray(column.dataIndex) ? column.dataIndex.join('.') : column.dataIndex == null ? undefined : String(column.dataIndex),
      label: typeof column.title === 'string' || typeof column.title === 'number'
        ? String(column.title)
        : (extractTextFromVNode(typeof column.title === 'function' ? column.title({}) : column.title) || String(column.key ?? column.dataIndex ?? '')),
      width: column.width,
      align: column.align,
      fixed: column.fixed,
      ellipsis: column.ellipsis === undefined ? undefined : Boolean(column.ellipsis),
      className: column.className,
      sorter: typeof column.sorter === 'object' ? column.sorter.compare ?? true : column.sorter,
    })))
    const rowKey = (row: any) => String(typeof props.rowKey === 'function' ? props.rowKey(row) : (row as ListRecord)[props.rowKey])
    const originalKeys = new Map<string, string | number>()
    watch(() => props.dataSource, rows => {
      for (const row of rows) {
        const raw = typeof props.rowKey === 'function' ? props.rowKey(row) : (row as ListRecord)[props.rowKey]
        if (typeof raw === 'string' || typeof raw === 'number') originalKeys.set(rowKey(row), raw)
      }
    }, { immediate: true })
    const pageChange = (page: number, size: number) => {
      if (props.pagination !== false) props.pagination.onChange?.(page, size)
      props.onChange?.({ ...(props.pagination || {}), current: page, pageSize: size }, {}, {})
    }
    return () => {
      const pagination = props.pagination || {}
      const cellSlots: Record<string, (...args: any[]) => VNodeChild> = {}
      for (const [name, slot] of Object.entries(slots)) if (slot) cellSlots[name] = slot
      props.columns.forEach((column, index) => {
        const key = normalized.value[index].key
        if (column.render) cellSlots[`cell-${key}`] = ({ value, record, index: rowIndex }) => column.render!(value, record, rowIndex)
        if (column.title != null && typeof column.title !== 'string' && typeof column.title !== 'number') {
          cellSlots[`header-${key}`] = () => (typeof column.title === 'function' ? column.title({}) : column.title)
        }
      })
      if (props.filterSlot !== undefined) cellSlots.filter = () => props.filterSlot
      if (props.toolbarLeft !== undefined) cellSlots['toolbar-left'] = () => props.toolbarLeft
      if (props.toolbarRight !== undefined) cellSlots['toolbar-right'] = () => props.toolbarRight
      return h(AgriAntdvListTable, {
        ...attrs,
        class: [props.wrapperClassName, attrs.class],
        columns: normalized.value,
        data: props.dataSource as readonly ListRecord[],
        rowKey,
        loading: props.loading,
        size: props.size,
        expandedRowRender: props.expandable?.expandedRowRender,
        rowExpandable: props.expandable?.rowExpandable,
        pageSizeOptions: pagination.pageSizeOptions?.map(Number),
        showToolbar:props.showToolbar,
        rowClassName:props.rowClassName,
        selectable: props.selectable,
        selectedRowKeys: props.rowSelection?.selectedRowKeys,
        getCheckboxProps: props.rowSelection?.getCheckboxProps,
        customRow: props.onRow,
        page: pagination.current ?? 1,
        pageSize: pagination.pageSize ?? pagination.defaultPageSize ?? 20,
        total: pagination.total,
        clientPagination: pagination.total === undefined,
        showPagination: props.pagination !== false,
        columnSettingsStorageKey: props.columnSettingsStorageKey,
        columnWidthStorageKey: props.columnWidthStorageKey,
        emptyText: typeof props.locale?.emptyText === 'string' ? props.locale.emptyText : undefined,
        scrollX: props.scroll?.x,
        scrollY: props.scroll?.y,
        onRefresh: props.onRefresh,
        onChange: props.onChange,
        onPageChange: pageChange,
        onSelectionChange: (rows: ListRecord[], keys: string[]) => {
          props.rowSelection?.onChange?.(keys.map(key => originalKeys.get(key) ?? key), rows)
        },
      }, cellSlots)
    }
  },
})
