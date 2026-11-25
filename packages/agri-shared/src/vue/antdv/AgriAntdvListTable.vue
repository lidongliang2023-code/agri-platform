<template>
  <div class="agri-vue-list-page agri-antdv-list-page">
    <slot name="filter" />

    <div class="agri-vue-table-card">
      <AgriVueToolbar
        v-if="showToolbar"
        :columns="normalizedColumns"
        :hidden-keys="hiddenKeys"
        :locked-keys="lockedKeys"
        :show-column-settings="showColumnSettings"
        :show-refresh="showRefresh"
        :refreshing="loading"
        @toggle-column="toggleColumn"
        @reset-columns="handleResetColumns"
        @refresh="emit('refresh')"
      >
        <template #left>
          <slot name="toolbar-left" :selected-rows="selectedRows" :selected-count="selectedKeys.length" />
        </template>
        <template #right-extra>
          <slot name="toolbar-right" />
        </template>
      </AgriVueToolbar>

      <a-table
        :columns="antdvColumns"
        :data-source="pagedRows"
        :row-key="resolvedRowKey"
        :loading="loading"
        :pagination="false"
        :row-selection="rowSelectionConfig"
        :row-class-name="resolveRowClassName"
        :scroll="resolvedScroll"
        :locale="{ emptyText }"
        size="middle"
        table-layout="fixed"
        @resize-column="handleResizeColumn"
        @change="handleTableChange"
      >
        <template #bodyCell="slotProps">
          <slot
            :name="`cell-${String(slotProps.column.key || slotProps.column.dataIndex || '')}`"
            :row="slotProps.record"
            :record="slotProps.record"
            :column="slotProps.column"
            :value="slotProps.text"
            :index="slotProps.index"
          >
            <slot name="bodyCell" v-bind="slotProps">
              {{ formatCellText(slotProps.record, slotProps.column, slotProps.index) }}
            </slot>
          </slot>
        </template>
      </a-table>

      <AgriVuePagination
        v-if="showPagination"
        :page="currentPage"
        :page-size="currentPageSize"
        :total="resolvedTotal"
        :selected-count="selectedKeys.length"
        :unit="totalUnit"
        :page-size-options="pageSizeOptions"
        @update:page="handlePageUpdate"
        @update:page-size="handlePageSizeUpdate"
        @change="handlePageChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AgriVueToolbar from '../list/AgriVueToolbar.vue'
import AgriVuePagination from '../list/AgriVuePagination.vue'
import { useVueListColumns } from '../list/useVueListColumns'
import { useVueColumnWidths } from '../list/useVueColumnWidths'
import {
  DEFAULT_SELECTION_COLUMN_WIDTH,
  DEFAULT_VUE_PAGE_SIZE,
  DEFAULT_VUE_PAGE_SIZES,
  MIN_RESIZABLE_COLUMN_WIDTH,
  readCellValue,
  type NormalizedVueColumn,
  type VueListColumn,
} from '../list/vueListUtils'
import '../list/AgriVueList.css'
import './AgriAntdvList.css'

type RowRecord = Record<string, unknown>

const props = withDefaults(
  defineProps<{
    columns: readonly VueListColumn[]
    data: readonly RowRecord[]
    rowKey?: string | ((row: RowRecord) => string)
    loading?: boolean
    emptyText?: string
    selectable?: boolean
    selectionWidth?: number
    showToolbar?: boolean
    showColumnSettings?: boolean
    showRefresh?: boolean
    columnSettingsStorageKey?: string | false
    columnWidthStorageKey?: string | false
    resizable?: boolean
    lockedColumnKeys?: string[]
    showPagination?: boolean
    clientPagination?: boolean
    page?: number
    pageSize?: number
    total?: number
    totalUnit?: string
    pageSizeOptions?: readonly number[]
    scrollX?: number | 'max-content'
    scrollY?: number | string
    rowClassName?: (record: RowRecord, index: number) => string
  }>(),
  {
    rowKey: 'id',
    loading: false,
    emptyText: '暂无符合条件的记录，请调整筛选条件或稍后再试',
    selectable: true,
    selectionWidth: DEFAULT_SELECTION_COLUMN_WIDTH,
    showToolbar: true,
    showColumnSettings: true,
    showRefresh: true,
    columnSettingsStorageKey: false,
    columnWidthStorageKey: undefined,
    resizable: true,
    lockedColumnKeys: undefined,
    showPagination: true,
    clientPagination: false,
    page: 1,
    pageSize: DEFAULT_VUE_PAGE_SIZE,
    total: undefined,
    totalUnit: '条',
    pageSizeOptions: () => [...DEFAULT_VUE_PAGE_SIZES],
    scrollX: undefined,
    scrollY: undefined,
    rowClassName: undefined,
  },
)

const emit = defineEmits<{
  refresh: []
  'selection-change': [rows: RowRecord[], keys: string[]]
  'update:page': [page: number]
  'update:pageSize': [size: number]
  'page-change': [page: number, pageSize: number]
  'column-resize': [key: string, width: number]
  change: [pagination: unknown, filters: unknown, sorter: unknown]
}>()

const internalPage = ref(props.page)
const internalPageSize = ref(props.pageSize)
watch(() => props.page, (v) => { internalPage.value = v })
watch(() => props.pageSize, (v) => { internalPageSize.value = v })

const currentPage = computed(() => (props.clientPagination ? internalPage.value : props.page))
const currentPageSize = computed(() => (props.clientPagination ? internalPageSize.value : props.pageSize))

const {
  normalizedColumns,
  visibleColumns,
  lockedKeys,
  hiddenKeys,
  toggleColumn,
  resetColumns,
} = useVueListColumns(() => props.columns, {
  storageKey: props.columnSettingsStorageKey,
  lockedKeys: props.lockedColumnKeys,
})

const {
  widths: customColumnWidths,
  setColumnWidth,
  resetAllWidths,
} = useVueColumnWidths({
  storageKey: () => props.columnWidthStorageKey,
  fallbackSettingsKey: () => props.columnSettingsStorageKey,
})

const selectedKeys = ref<string[]>([])
const selectedRowMap = ref<Record<string, RowRecord>>({})

function extractRowKey(row: RowRecord): string {
  if (typeof props.rowKey === 'function') return props.rowKey(row)
  const raw = readCellValue(row, props.rowKey)
  return raw != null ? String(raw) : ''
}

const resolvedRowKey = computed(() => (row: RowRecord) => extractRowKey(row))

const selectedRows = computed<RowRecord[]>(() =>
  selectedKeys.value
    .map((k) => selectedRowMap.value[k])
    .filter((item): item is RowRecord => Boolean(item)),
)

const resolvedTotal = computed(() => (props.total !== undefined ? props.total : props.data.length))

const pagedRows = computed<RowRecord[]>(() => {
  const list = [...props.data]
  if (!props.clientPagination) return list
  const maxPage = Math.max(1, Math.ceil(list.length / Math.max(1, currentPageSize.value)))
  const safePage = Math.min(Math.max(1, currentPage.value), maxPage)
  const start = (safePage - 1) * currentPageSize.value
  return list.slice(start, start + currentPageSize.value)
})

const columnByKey = computed(() => {
  const map = new Map<string, NormalizedVueColumn>()
  for (const col of normalizedColumns.value) {
    map.set(col.resolvedKey, col)
  }
  return map
})

const antdvColumns = computed(() =>
  visibleColumns.value.map((col) => {
    const customW = customColumnWidths.value[col.resolvedKey]
    const width = customW ?? col.resolvedWidth ?? col.resolvedMinWidth ?? 140
    const classes: string[] = []
    if (col.resolvedKind === 'number') classes.push('pc-cell-number')
    if (col.resolvedKind === 'status') classes.push('pc-cell-status', 'agri-vue-status-cell')
    if (col.resolvedKind === 'code') classes.push('pc-cell-code')
    if (col.resolvedKind === 'action') classes.push('pc-cell-actions')
    if (col.className) classes.push(col.className)
    return {
      key: col.resolvedKey,
      dataIndex: col.prop,
      title: col.label,
      width,
      minWidth: col.resolvedMinWidth ?? MIN_RESIZABLE_COLUMN_WIDTH,
      maxWidth: 1200,
      resizable: props.resizable && col.resizable !== false,
      align: col.resolvedAlign,
      fixed: col.resolvedFixed,
      ellipsis: col.resolvedEllipsis,
      className: classes.join(' ') || undefined,
    }
  }),
)

const resolvedScroll = computed(() => {
  const totalWidth =
    (props.selectable ? props.selectionWidth : 0) +
    antdvColumns.value.reduce((acc, col) => acc + (typeof col.width === 'number' ? col.width : 140), 0)
  return {
    x: props.scrollX ?? Math.max(totalWidth, 720),
    ...(props.scrollY !== undefined ? { y: props.scrollY } : {}),
  }
})

const rowSelectionConfig = computed(() => {
  if (!props.selectable) return undefined
  return {
    selectedRowKeys: selectedKeys.value,
    preserveSelectedRowKeys: true,
    columnWidth: props.selectionWidth,
    onChange: (keys: (string | number)[], rows: RowRecord[]) => {
      const nextKeys = keys.map(String)
      const nextMap: Record<string, RowRecord> = {}
      for (const row of rows) {
        if (!row) continue
        const k = extractRowKey(row)
        if (k) nextMap[k] = row
      }
      for (const k of nextKeys) {
        if (!nextMap[k] && selectedRowMap.value[k]) {
          nextMap[k] = selectedRowMap.value[k]
        }
      }
      selectedKeys.value = nextKeys
      selectedRowMap.value = nextMap
      emit('selection-change', selectedRows.value, nextKeys)
    },
  }
})

function resolveRowClassName(record: RowRecord, index: number): string {
  const classes: string[] = []
  const key = extractRowKey(record)
  if (key && selectedKeys.value.includes(key)) {
    classes.push('agri-vue-row-selected')
  }
  const extra = props.rowClassName?.(record, index)
  if (extra) classes.push(extra)
  return classes.join(' ')
}

function handleResizeColumn(width: number, col: { key?: string; dataIndex?: string }) {
  const key = String(col.key || col.dataIndex || '')
  if (!key) return
  setColumnWidth(key, width, MIN_RESIZABLE_COLUMN_WIDTH)
  emit('column-resize', key, customColumnWidths.value[key] ?? width)
}

function handleTableChange(pagination: unknown, filters: unknown, sorter: unknown) {
  emit('change', pagination, filters, sorter)
}

function handleResetColumns() {
  resetColumns()
  resetAllWidths()
}

function handlePageUpdate(p: number) {
  internalPage.value = p
  emit('update:page', p)
}

function handlePageSizeUpdate(size: number) {
  internalPageSize.value = size
  emit('update:pageSize', size)
}

function handlePageChange(p: number, size: number) {
  internalPage.value = p
  internalPageSize.value = size
  emit('page-change', p, size)
}

function formatCellText(row: RowRecord, col: { key?: string; dataIndex?: string }, index: number): string {
  const key = String(col.key || col.dataIndex || '')
  const meta = columnByKey.value.get(key)
  const value = readCellValue(row, meta?.prop || (typeof col.dataIndex === 'string' ? col.dataIndex : undefined))
  if (meta?.formatter) return meta.formatter(row, value, index)
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

function clearSelection() {
  selectedKeys.value = []
  selectedRowMap.value = {}
  emit('selection-change', [], [])
}

defineExpose({
  clearSelection,
  resetColumns: handleResetColumns,
  resetColumnWidths: resetAllWidths,
})
</script>
