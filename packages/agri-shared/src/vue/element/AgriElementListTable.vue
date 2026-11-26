<template>
  <div class="agri-vue-list-page">
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
          <slot name="toolbar-left" :selected-rows="selectedRows" :selected-count="selectedRows.length" />
        </template>
        <template #right-extra>
          <slot name="toolbar-right" />
        </template>
      </AgriVueToolbar>

      <el-table
        ref="tableRef"
        v-loading="loading"
        :data="tableData"
        :row-key="rowKey"
        :border="border || resizable"
        :class="{ 'is-borderless-resize': resizable && !border }"
        :row-class-name="resolveRowClassName"
        :empty-text="emptyText"
        style="width: 100%"
        @selection-change="handleSelectionChange"
        @sort-change="emit('sort-change', $event)"
        @header-dragend="handleHeaderDragend"
      >
        <el-table-column
          v-if="selectable"
          type="selection"
          :width="selectionWidth"
          :resizable="false"
          align="center"
          :reserve-selection="reserveSelection"
        />

        <el-table-column
          v-for="col in visibleColumns"
          :key="col.resolvedKey"
          :column-key="col.resolvedKey"
          :prop="col.prop"
          :label="col.label"
          :width="resolveColumnWidth(col)"
          :min-width="col.resolvedMinWidth"
          :resizable="resizable && col.resizable !== false"
          :align="col.resolvedAlign"
          :fixed="col.resolvedFixed"
          :sortable="col.sortable"
          :show-overflow-tooltip="col.resolvedEllipsis"
          :class-name="columnCellClass(col)"
        >
          <template #default="scope">
            <slot
              :name="`cell-${col.resolvedKey}`"
              :row="scope.row"
              :column="col"
              :value="readCellValue(scope.row, col.prop)"
              :index="scope.$index"
            >
              {{ formatPlainText(scope.row, col, scope.$index) }}
            </slot>
          </template>
        </el-table-column>

        <template v-if="$slots.empty" #empty>
          <slot name="empty" />
        </template>
      </el-table>

      <AgriVuePagination
        v-if="showPagination"
        :page="activePage"
        :page-size="activePageSize"
        :total="resolvedTotal"
        :selected-count="selectedRows.length"
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
import { computed, nextTick, ref, watch } from 'vue'
import AgriVueToolbar from '../list/AgriVueToolbar.vue'
import AgriVuePagination from '../list/AgriVuePagination.vue'
import { useVueListColumns } from '../list/useVueListColumns'
import { useVueColumnWidths } from '../list/useVueColumnWidths'
import {
  DEFAULT_SELECTION_COLUMN_WIDTH,
  DEFAULT_VUE_PAGE_SIZE,
  DEFAULT_VUE_PAGE_SIZES,
  MIN_RESIZABLE_COLUMN_WIDTH,
  clampPage,
  readCellValue,
  type NormalizedVueColumn,
  type VueListColumn,
} from '../list/vueListUtils'
import '../list/AgriVueList.css'

type RowRecord = Record<string, unknown>

const props = withDefaults(
  defineProps<{
    columns: readonly VueListColumn[]
    data: readonly RowRecord[]
    rowKey?: string | ((row: RowRecord) => string)
    loading?: boolean
    border?: boolean
    emptyText?: string
    selectable?: boolean
    selectionWidth?: number
    /** 翻页时保留勾选项，默认 true（对应「已选 N 项」跨页保留规范）。 */
    reserveSelection?: boolean
    showToolbar?: boolean
    showColumnSettings?: boolean
    showRefresh?: boolean
    columnSettingsStorageKey?: string | false
    /** 列宽拖拽持久化键；省略时若已传 columnSettingsStorageKey 则自动派生；传 false 关闭列宽持久化。 */
    columnWidthStorageKey?: string | false
    /** 是否启用表头拖拽调整列宽，默认 true。 */
    resizable?: boolean
    lockedColumnKeys?: string[]
    showPagination?: boolean
    /** 开启客户端自动分页切片（适合接口一次返回全量数据的台账）。 */
    clientPagination?: boolean
    page?: number
    pageSize?: number
    total?: number
    totalUnit?: string
    pageSizeOptions?: readonly number[]
    rowClassName?: string | ((payload: { row: RowRecord; rowIndex: number }) => string)
  }>(),
  {
    rowKey: 'id',
    loading: false,
    border: false,
    emptyText: '暂无符合条件的记录，请调整筛选条件或稍后再试',
    selectable: true,
    selectionWidth: DEFAULT_SELECTION_COLUMN_WIDTH,
    reserveSelection: true,
    showToolbar: true,
    showColumnSettings: true,
    showRefresh: true,
    columnSettingsStorageKey: false,
    columnWidthStorageKey: undefined,
    resizable: true,
    lockedColumnKeys: undefined,
    showPagination: true,
    clientPagination: false,
    page: undefined,
    pageSize: undefined,
    total: undefined,
    totalUnit: '条',
    pageSizeOptions: () => [...DEFAULT_VUE_PAGE_SIZES],
    rowClassName: undefined,
  },
)

const emit = defineEmits<{
  refresh: []
  'selection-change': [rows: RowRecord[]]
  'sort-change': [payload: unknown]
  'update:page': [page: number]
  'update:pageSize': [size: number]
  'page-change': [page: number, pageSize: number]
  'column-resize': [key: string, width: number]
}>()

const tableRef = ref<{ clearSelection?: () => void; doLayout?: () => void } | null>(null)
const selectedRows = ref<RowRecord[]>([])

const {
  normalizedColumns,
  visibleColumns,
  lockedKeys,
  hiddenKeys,
  toggleColumn,
  resetColumns,
} = useVueListColumns(() => props.columns, {
  storageKey: () => props.columnSettingsStorageKey,
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

function resolveColumnWidth(col: NormalizedVueColumn): number | undefined {
  const custom = customColumnWidths.value[col.resolvedKey]
  if (custom !== undefined) return custom
  return col.resolvedWidth
}

function handleHeaderDragend(
  newWidth: number,
  _oldWidth: number,
  column: { columnKey?: string; property?: string },
) {
  if (!props.resizable) return
  const key = column?.columnKey || column?.property
  if (!key) return
  setColumnWidth(key, newWidth, MIN_RESIZABLE_COLUMN_WIDTH)
  emit('column-resize', key, customColumnWidths.value[key] ?? newWidth)
}

function handleResetColumns() {
  resetColumns()
  resetAllWidths()
  void nextTick(() => {
    tableRef.value?.doLayout?.()
  })
}

const internalPage = ref<number>(props.page ?? 1)
const internalPageSize = ref<number>(props.pageSize ?? DEFAULT_VUE_PAGE_SIZE)

watch(
  () => props.page,
  (val) => {
    if (val !== undefined) internalPage.value = val
  },
)
watch(
  () => props.pageSize,
  (val) => {
    if (val !== undefined) internalPageSize.value = val
  },
)

const resolvedTotal = computed(() => (props.total !== undefined ? props.total : props.data.length))
const activePageSize = computed(() => props.pageSize ?? internalPageSize.value)
const activePage = computed(() => {
  const raw = props.page ?? internalPage.value
  return props.clientPagination ? clampPage(raw, resolvedTotal.value, activePageSize.value) : raw
})

watch(
  () => props.data.length,
  (len) => {
    if (!props.clientPagination) return
    const clamped = clampPage(internalPage.value, len, activePageSize.value)
    if (clamped !== internalPage.value) {
      internalPage.value = clamped
      emit('update:page', clamped)
    }
  },
)

const tableData = computed(() => {
  if (!props.clientPagination || !props.showPagination) return [...props.data]
  const start = (activePage.value - 1) * activePageSize.value
  return props.data.slice(start, start + activePageSize.value)
})

function handlePageUpdate(nextPage: number) {
  internalPage.value = nextPage
  emit('update:page', nextPage)
}

function handlePageSizeUpdate(nextSize: number) {
  internalPageSize.value = nextSize
  internalPage.value = 1
  emit('update:pageSize', nextSize)
}

function handlePageChange(nextPage: number, nextSize: number) {
  internalPage.value = nextPage
  internalPageSize.value = nextSize
  emit('page-change', nextPage, nextSize)
}

function extractRowKey(row: RowRecord): string {
  if (typeof props.rowKey === 'function') return props.rowKey(row)
  const raw = readCellValue(row, props.rowKey)
  return raw != null ? String(raw) : ''
}

const selectedKeySet = computed(() => new Set(selectedRows.value.map(extractRowKey).filter(Boolean)))

function handleSelectionChange(rows: RowRecord[]) {
  selectedRows.value = rows
  emit('selection-change', rows)
}

function resolveRowClassName(payload: { row: RowRecord; rowIndex: number }): string {
  const classes: string[] = []
  const key = extractRowKey(payload.row)
  if ((key && selectedKeySet.value.has(key)) || selectedRows.value.includes(payload.row)) {
    classes.push('agri-vue-row-selected')
  }
  if (typeof props.rowClassName === 'function') {
    const custom = props.rowClassName(payload)
    if (custom) classes.push(custom)
  } else if (props.rowClassName) {
    classes.push(props.rowClassName)
  }
  return classes.join(' ')
}

function columnCellClass(col: NormalizedVueColumn): string {
  const classes: string[] = []
  if (col.resolvedKind === 'number') classes.push('pc-cell-number')
  if (col.resolvedKind === 'status') classes.push('pc-cell-status', 'agri-vue-status-cell')
  if (col.resolvedKind === 'code') classes.push('pc-cell-code')
  if (col.resolvedKind === 'action') classes.push('pc-cell-actions')
  if (col.className) classes.push(col.className)
  return classes.join(' ')
}

function formatPlainText(row: RowRecord, col: NormalizedVueColumn, index: number): string {
  const value = readCellValue(row, col.prop)
  if (col.formatter) return col.formatter(row, value, index)
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

function clearSelection() {
  tableRef.value?.clearSelection?.()
  selectedRows.value = []
}

defineExpose({
  tableRef,
  clearSelection,
  resetColumns: handleResetColumns,
  resetColumnWidths: resetAllWidths,
})
</script>
