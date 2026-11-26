import { computed, defineComponent, h, onBeforeUnmount, reactive, ref, watch, type PropType, type VNodeChild } from 'vue'
import { Input, Select, DatePicker, message, Tag } from 'ant-design-vue'
import { useRoute } from 'vue-router'
import { AgriAntdvJsxList, agriAntdvJsxListProps, type JsxListColumn } from '@agri/shared/vue/antdv/AgriAntdvJsxList'
import ProductionListFilters from './business/components/ProductionListFilters'
import ListRowActions from './business/components/ListRowActions'
import { isActionColumnMeta } from '@agri/shared/vue/list/vueListUtils'

export interface ProductionColumn<T = any> extends Omit<JsxListColumn, 'render' | 'title' | 'sorter'> {
  title?: VNodeChild | ((...args: any[]) => VNodeChild)
  hideInTable?: boolean
  hideInSearch?: boolean
  hideInSetting?: boolean
  sorter?: boolean | ((a: T, b: T) => number) | { compare?: (a: T, b: T) => number; multiple?: number }
  search?: false | { transform?: (value: any) => Record<string, unknown> }
  valueType?: string
  valueEnum?: Record<string, string | { text: string; status?: string; color?: string }>
  initialValue?: unknown
  fieldProps?: Record<string, any>
  render?(value: any, record: T, index: number, action?: ProductionTableAction): VNodeChild
  renderFormItem?: (column: ProductionColumn<T>, config: Record<string, any>, form: { getFieldsValue: () => Record<string, unknown> }) => VNodeChild
  [key: string]: any
}
export interface ProductionTableAction {
  reload: (resetPageIndex?: boolean) => Promise<void>
  reloadAndRest: () => Promise<void>
  reset: () => Promise<void>
  clearSelected: () => void
}
export interface ProductionPageResult<T extends object = object> { data: T[]; total?: number; success?: boolean }

/** 生产端请求型列表：保持原分页/筛选接口，渲染与列宽由 Vue 共享表格维护。 */
export default defineComponent({
  name: 'ProductionRequestTable',
  inheritAttrs: false,
  props: {
    ...agriAntdvJsxListProps,
    columns: { type: Array as PropType<ProductionColumn<any>[]>, default: () => [] },
    memberListToolbar: Boolean,
    tableAlertRender: [Boolean, Function],
    tableAlertOptionRender: [Boolean, Function],
    dateFormatter: [String, Boolean, Function],
    beforeSearchSubmit: Function as PropType<(values: Record<string, any>) => Record<string, any>>,
    size: String as PropType<'small' | 'middle' | 'large'>,
    onSizeChange:Function as PropType<(size:'small'|'middle'|'large')=>void>,
    cardProps: [Object, Boolean],
    columnsState: Object as PropType<{ persistenceKey?: string; persistenceType?: string }>,
    toolbar: Object as PropType<{ title?: VNodeChild; actions?: VNodeChild[]; [key: string]: any }>,
    request: Function as PropType<(params: Record<string, any>, sorter: Record<string, string>, filters: Record<string, unknown>) => Promise<ProductionPageResult>>,
    params: Object as PropType<Record<string, unknown>>,
    search: { type: [Boolean, Object] as PropType<boolean | Record<string, any>>, default: true },
    actionRef: Object as PropType<{ value?: ProductionTableAction | null; current?: ProductionTableAction | null }>,
    formRef: Object as PropType<{ value?: unknown; current?: unknown }>,
    toolBarRender: [Function, Boolean] as PropType<false | ((action: ProductionTableAction, context: Record<string, unknown>) => VNodeChild)>,
    headerTitle: null as unknown as PropType<VNodeChild>,
    options: [Object, Boolean] as PropType<false | { reload?: boolean | (() => unknown); setting?: boolean; density?: boolean; fullScreen?: boolean }>,
    onSubmit: Function as PropType<(values: Record<string, unknown>) => void>,
    onReset: Function as PropType<() => void>,
    onLoad: Function as PropType<(rows: object[]) => void>,
    onRequestError: Function as PropType<(error: Error) => void>,
    rowSelection: agriAntdvJsxListProps.rowSelection,
    manualRequest: Boolean,
  },
  setup(props, { attrs, slots, expose }) {
    const route = useRoute()
    const pagePath = route?.path ?? window.location.pathname
    const defaultColumnKey = computed(() => `production:vue:${pagePath}:${props.columns.map(c => c.key ?? c.dataIndex ?? c.title).join('|')}:columns`)
    const page = ref(props.pagination === false ? 1 : props.pagination.current ?? props.pagination.defaultCurrent ?? 1)
    const size = ref(props.pagination === false ? 20 : props.pagination.pageSize ?? props.pagination.defaultPageSize ?? 20)
    const data = ref<object[]>([])
    const total = ref(0)
    const loading = ref(false)
    const draft = reactive<Record<string, any>>({})
    const submitted = ref<Record<string, unknown>>({})
    const selected = ref<(string | number)[]>([])
    const sorter = ref<Record<string, string>>({})
    const filters = ref<Record<string, unknown>>({})
    let revision = 0
    let disposed = false
    const fields = computed(() => props.columns.filter(c => c.search !== false && !c.hideInSearch && c.valueType !== 'option' && c.dataIndex != null))
    for (const column of fields.value) if (column.initialValue !== undefined) draft[String(column.dataIndex)] = column.initialValue
    function queryValues() {
      const values: Record<string, unknown> = {}
      for (const c of fields.value) {
        const key = String(c.dataIndex), value = draft[key]
        if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) continue
        if (c.search && typeof c.search === 'object' && c.search.transform) Object.assign(values, c.search.transform(value))
        else values[key] = value
      }
      return values
    }
    submitted.value = queryValues()
    async function load(reset = false) {
      if (reset) page.value = 1
      if (!props.request) { props.onRefresh?.(); return }
      const id = ++revision
      loading.value = true
      try {
        const result = await props.request({ ...submitted.value, ...props.params, current: page.value, pageSize: size.value }, sorter.value, filters.value)
        if (disposed || id !== revision) return
        if (result.success === false) throw new Error('列表查询失败')
        data.value = result.data || []
        total.value = result.total ?? data.value.length
        props.onLoad?.(data.value)
      } catch (error) {
        if (disposed || id !== revision) return
        const err = error instanceof Error ? error : new Error(String(error))
        if (props.onRequestError) props.onRequestError(err)
        else message.error(err.message)
      } finally { if (!disposed && id === revision) loading.value = false }
    }
    async function submit() { submitted.value = props.beforeSearchSubmit?.(queryValues()) ?? queryValues(); props.onSubmit?.(submitted.value); await load(true) }
    async function reset() {
      Object.keys(draft).forEach(key => delete draft[key])
      for (const c of fields.value) if (c.initialValue !== undefined) draft[String(c.dataIndex)] = c.initialValue
      submitted.value = queryValues(); props.onReset?.(); await load(true)
    }
    const action: ProductionTableAction = { reload: load, reloadAndRest: async () => { selected.value = []; await load(true) }, reset, clearSelected: () => { selected.value = []; props.rowSelection?.onChange?.([], []) } }
    watch(() => props.actionRef, target => { if (target) { target.value = action; target.current = action } }, { immediate: true })
    const form = { getFieldsValue: () => ({ ...draft }), setFieldsValue: (values: Record<string, unknown>) => Object.assign(draft, values), resetFields: reset, submit }
    watch(() => props.formRef, target => { if (target) { target.value = form; target.current = form } }, { immediate: true })
    // 静态数据列表由父页面加载；挂载时调用 onRefresh 会导致父页面卸载/重挂列表并无限刷新。
    // 按参数值监听，父页面重渲染时新建的等值对象不应再次发请求。
    watch(() => JSON.stringify(props.params ?? {}), () => { if (props.request && !props.manualRequest) void load(true) }, { immediate: true })
    watch(() => props.pagination, value => {
      if (!value) return
      if (value.current !== undefined) page.value = value.current
      if (value.pageSize !== undefined) size.value = value.pageSize
    }, { deep: true })
    onBeforeUnmount(() => { disposed = true; revision++; if (props.actionRef) { props.actionRef.value = null; props.actionRef.current = null } })
    expose(action)
    function input(c: ProductionColumn) {
      const key = String(c.dataIndex), fieldProps = c.fieldProps || {}
      const onChange = (v: any) => { draft[key] = v?.target ? v.target.value : v; fieldProps.onChange?.(v) }
      if (c.renderFormItem) return c.renderFormItem(c, { ...fieldProps, value: draft[key], onChange }, form)
      if (c.valueEnum) return h(Select, { allowClear: true, placeholder: '全部', ...fieldProps, value: draft[key], onChange, options: Object.entries(c.valueEnum).map(([value, label]) => ({ value, label: typeof label === 'string' ? label : label.text })) })
      if (c.valueType?.includes('date')) {
        const dateProps = { ...fieldProps, value: draft[key], onChange, style: { width: '100%' } }
        return c.valueType.toLowerCase().includes('range') ? h(DatePicker.RangePicker, dateProps) : h(DatePicker, dateProps)
      }
      // 回车由外层筛选表单统一提交，避免 pressEnter 与原生 submit 重复请求。
      return h(Input, { allowClear: true, ...fieldProps, value: draft[key], onChange })
    }
    const columns = computed<JsxListColumn[]>(() => props.columns.filter(c => !c.hideInTable).map(c => ({ ...c, title: typeof c.title === 'function' ? c.title({}) : c.title, sorter: typeof c.sorter === 'object' ? (c.sorter.compare ?? true) : c.sorter, render: c.render ? (value, row, index) => {
      const content = c.render!(value, row, index, action)
      return !route.path.startsWith('/admin') && isActionColumnMeta(typeof c.title === 'string' ? c.title : '', c.key ?? (c.dataIndex == null ? undefined : String(c.dataIndex)))
        ? h(ListRowActions, {}, { default: () => content }) : content
    } : c.valueEnum ? value => {
      const meta = c.valueEnum?.[String(value)]
      return typeof meta === 'string' ? meta : meta ? h(Tag, { color: meta.color || ({ Success: 'success', Error: 'error', Warning: 'warning', Processing: 'processing' } as Record<string, string>)[meta.status || ''] }, () => meta.text) : String(value ?? '—')
    } : undefined })))
    return () => h(AgriAntdvJsxList, {
      ...attrs, ...props, columns: columns.value,
      wrapperClassName: ['production-unified-list', props.wrapperClassName].filter(Boolean).join(' '),
      loading: props.loading || loading.value,
      dataSource: props.request ? data.value : props.dataSource,
      selectable: props.rowSelection !== undefined,
      rowSelection: props.rowSelection ? { ...props.rowSelection, selectedRowKeys: props.rowSelection.selectedRowKeys ?? selected.value, onChange: (keys: (string | number)[], rows: any[]) => { selected.value = keys; props.rowSelection?.onChange?.(keys, rows) } } : undefined,
      pagination: props.pagination === false ? false : { ...props.pagination, current: page.value, pageSize: size.value, ...(props.request ? { total: total.value } : {}), onChange: (p: number, s: number) => { page.value = p; size.value = s; if (props.pagination) props.pagination.onChange?.(p, s); if (props.request) void load() } },
      onRefresh: () => { const reload = props.options && props.options.reload; if (typeof reload === 'function') reload(); else void load() },
      columnSettingsStorageKey: props.columnSettingsStorageKey ?? props.columnsState?.persistenceKey ?? defaultColumnKey.value,
      toolbarLeft: props.toolbarLeft ?? (slots['toolbar-left'] ? undefined : [props.headerTitle ?? props.toolbar?.title, ...(props.toolbar?.actions ?? []), typeof props.toolBarRender === 'function' ? props.toolBarRender(action, { selectedRowKeys: selected.value }) : null]),
      onChange: (pagination: any, nextFilters: any, nextSorter: any) => { if (nextSorter?.field) { sorter.value = { [nextSorter.field]: nextSorter.order }; filters.value = nextFilters || {}; void load() } props.onChange?.(pagination, nextFilters, nextSorter) },
      filterSlot: props.filterSlot ?? (props.search !== false && fields.value.length ? h(ProductionListFilters, {
        embedded: false,
        fieldCount: fields.value.length,
        loading: props.loading || loading.value,
        defaultCollapsed: typeof props.search === 'object' ? props.search.defaultCollapsed : undefined,
        onSearch: submit,
        onReset: reset,
      }, { default: () => fields.value.map(c => h('div', { class: 'agri-vue-filter-field', key: String(c.dataIndex) }, [h('label', c.title as any), input(c)])) }) : undefined),
    }, slots)
  },
})
