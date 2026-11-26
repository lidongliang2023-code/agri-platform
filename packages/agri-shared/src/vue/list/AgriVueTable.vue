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
          <slot name="toolbar-left" :selected-keys="selectedKeyList" :selected-rows="selectedRows" />
        </template>
        <template #right-extra>
          <slot name="toolbar-right" />
        </template>
      </AgriVueToolbar>

      <div class="agri-vue-table-scroll">
        <table class="agri-vue-table" :style="tableStyle">
          <colgroup>
            <col v-if="selectable" :style="{ width: `${selectionWidth}px` }" />
            <col
              v-for="col in visibleColumns"
              :key="`col-${col.resolvedKey}`"
              :style="colStyle(col)"
            />
          </colgroup>
          <thead>
            <tr>
              <th v-if="selectable" class="is-selection">
                <input
                  type="checkbox"
                  aria-label="全选当前页"
                  :checked="isAllPageSelected"
                  :indeterminate.prop="isSomePageSelected"
                  :disabled="!displayData.length"
                  @change="toggleAllCurrentPage"
                />
              </th>
              <th
                v-for="col in visibleColumns"
                :key="`th-${col.resolvedKey}`"
                :class="headerCellClass(col)"
                :title="col.label"
              >
                <span class="agri-vue-th-label">{{ col.label }}</span>
                <span
                  v-if="isColumnResizable(col)"
                  class="agri-vue-col-resize-handle"
                  :class="{ 'is-dragging': draggingKey === col.resolvedKey }"
                  role="separator"
                  aria-orientation="vertical"
                  :aria-label="`调整「${col.label}」列宽`"
                  :aria-valuenow="Math.round(getColumnWidth(col))"
                  :aria-valuemin="MIN_RESIZABLE_COLUMN_WIDTH"
                  tabindex="0"
                  title="拖动调整列宽，双击恢复默认宽度"
                  @click.stop.prevent
                  @dblclick.stop.prevent="handleResetSingleWidth(col)"
                  @pointerdown="handleResizePointerDown($event, col)"
                  @pointermove="handleResizePointerMove"
                  @pointerup="handleResizePointerEnd"
                  @pointercancel="handleResizePointerEnd"
                  @lostpointercapture="handleResizeLostCapture"
                  @keydown="handleResizeKeydown($event, col)"
                />
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td :colspan="totalColSpan" class="agri-vue-table-empty">
                {{ loadingText }}
              </td>
            </tr>
            <tr v-else-if="!displayData.length">
              <td :colspan="totalColSpan" class="agri-vue-table-empty">
                <slot name="empty">{{ emptyText }}</slot>
              </td>
            </tr>
            <tr
              v-for="(row, rowIndex) in displayData"
              v-else
              :key="resolveRowKey(row, rowIndex)"
              :class="{ 'is-selected': isRowSelected(row, rowIndex) }"
            >
              <td v-if="selectable" class="is-selection">
                <input
                  type="checkbox"
                  :aria-label="`选择第 ${rowIndex + 1} 行`"
                  :checked="isRowSelected(row, rowIndex)"
                  @change="toggleRow(row, rowIndex)"
                />
              </td>
              <td
                v-for="col in visibleColumns"
                :key="`td-${col.resolvedKey}`"
                :class="bodyCellClass(col)"
                :title="col.resolvedEllipsis ? formatPlainText(row, col, rowIndex) : undefined"
              >
                <slot
                  :name="`cell-${col.resolvedKey}`"
                  :row="row"
                  :column="col"
                  :value="readCellValue(row, col.prop)"
                  :index="rowIndex"
                >
                  {{ formatPlainText(row, col, rowIndex) }}
                </slot>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <AgriVuePagination
        v-if="showPagination"
        :page="activePage"
        :page-size="activePageSize"
        :total="resolvedTotal"
        :selected-count="selectedKeyList.length"
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
import AgriVueToolbar from './AgriVueToolbar.vue'
import AgriVuePagination from './AgriVuePagination.vue'
import { useVueListColumns } from './useVueListColumns'
import { useVueColumnWidths } from './useVueColumnWidths'
import {
  DEFAULT_SELECTION_COLUMN_WIDTH,
  DEFAULT_VUE_PAGE_SIZE,
  DEFAULT_VUE_PAGE_SIZES,
  MIN_RESIZABLE_COLUMN_WIDTH,
  clampPage,
  readCellValue,
  type NormalizedVueColumn,
  type VueListColumn,
} from './vueListUtils'
import './AgriVueList.css'

type RowRecord = Record<string, any>

const props = withDefaults(
  defineProps<{
    columns: readonly VueListColumn[]
    data: readonly RowRecord[]
    rowKey?: string | ((row: RowRecord, index: number) => string)
    loading?: boolean
    loadingText?: string
    emptyText?: string
    selectable?: boolean
    selectionWidth?: number
    selectedKeys?: readonly string[]
    showToolbar?: boolean
    showColumnSettings?: boolean
    showRefresh?: boolean
    columnSettingsStorageKey?: string | false
    /** 列宽拖拽持久化键；省略时若已传 columnSettingsStorageKey 则自动派生；传 false 关闭列宽持久化。 */
    columnWidthStorageKey?: string | false
    /** 是否启用表头拖拽调整列宽，默认 true。 */
    resizable?: boolean
    lockedColumnKeys?: string[]
    minTableWidth?: number | string
    showPagination?: boolean
    /** 开启客户端自动分页切片（适合接口一次返回全量数据的台账）。 */
    clientPagination?: boolean
    page?: number
    pageSize?: number
    total?: number
    totalUnit?: string
    pageSizeOptions?: readonly number[]
  }>(),
  {
    rowKey: 'id',
    loading: false,
    loadingText: '正在加载数据…',
    emptyText: '暂无符合条件的记录，请调整筛选条件或稍后再试',
    selectable: true,
    selectionWidth: DEFAULT_SELECTION_COLUMN_WIDTH,
    selectedKeys: undefined,
    showToolbar: true,
    showColumnSettings: true,
    showRefresh: true,
    columnSettingsStorageKey: false,
    columnWidthStorageKey: undefined,
    resizable: true,
    lockedColumnKeys: undefined,
    minTableWidth: undefined,
    showPagination: true,
    clientPagination: false,
    page: undefined,
    pageSize: undefined,
    total: undefined,
    totalUnit: '条',
    pageSizeOptions: () => [...DEFAULT_VUE_PAGE_SIZES],
  },
)

const emit = defineEmits<{
  refresh: []
  'update:selectedKeys': [keys: string[]]
  'selection-change': [keys: string[], rows: RowRecord[]]
  'update:page': [page: number]
  'update:pageSize': [size: number]
  'page-change': [page: number, pageSize: number]
  'column-resize': [key: string, width: number]
}>()

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
  getColumnWidth,
  setColumnWidth,
  resetColumnWidth,
  resetAllWidths,
} = useVueColumnWidths({
  storageKey: () => props.columnWidthStorageKey,
  fallbackSettingsKey: () => props.columnSettingsStorageKey,
})

const draggingKey = ref<string | null>(null)
let activeDrag: { key: string; startX: number; startWidth: number } | null = null

function isColumnResizable(col: NormalizedVueColumn): boolean {
  return props.resizable && col.resizable !== false
}

function handleResizePointerDown(event: PointerEvent, col: NormalizedVueColumn) {
  if (event.button !== 0) return
  event.preventDefault()
  event.stopPropagation()
  const handle = event.currentTarget as HTMLElement | null
  const thRectWidth = handle?.parentElement?.getBoundingClientRect().width
  const startWidth = thRectWidth && thRectWidth > 0 ? thRectWidth : getColumnWidth(col)
  activeDrag = { key: col.resolvedKey, startX: event.clientX, startWidth }
  draggingKey.value = col.resolvedKey
  handle?.setPointerCapture?.(event.pointerId)
}

function handleResizePointerMove(event: PointerEvent) {
  if (!activeDrag) return
  event.preventDefault()
  event.stopPropagation()
  const nextWidth = Math.round(activeDrag.startWidth + event.clientX - activeDrag.startX)
  setColumnWidth(activeDrag.key, nextWidth, MIN_RESIZABLE_COLUMN_WIDTH)
  emit('column-resize', activeDrag.key, customColumnWidths.value[activeDrag.key] ?? nextWidth)
}

function handleResizePointerEnd(event: PointerEvent) {
  event.stopPropagation()
  activeDrag = null
  draggingKey.value = null
}

function handleResizeLostCapture() {
  activeDrag = null
  draggingKey.value = null
}

function handleResizeKeydown(event: KeyboardEvent, col: NormalizedVueColumn) {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  event.preventDefault()
  event.stopPropagation()
  const nextWidth = getColumnWidth(col) + (event.key === 'ArrowRight' ? 16 : -16)
  setColumnWidth(col.resolvedKey, nextWidth, MIN_RESIZABLE_COLUMN_WIDTH)
  emit('column-resize', col.resolvedKey, customColumnWidths.value[col.resolvedKey] ?? nextWidth)
}

function handleResetSingleWidth(col: NormalizedVueColumn) {
  resetColumnWidth(col.resolvedKey)
  emit('column-resize', col.resolvedKey, getColumnWidth(col))
}

function handleResetColumns() {
  resetColumns()
  resetAllWidths()
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

const displayData = computed(() => {
  if (!props.clientPagination || !props.showPagination) return props.data
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

const internalSelected = ref<string[]>([])
const selectedKeyList = computed<string[]>(() =>
  props.selectedKeys !== undefined ? [...props.selectedKeys] : internalSelected.value,
)
const selectedKeySet = computed(() => new Set(selectedKeyList.value))

watch(
  () => props.selectedKeys,
  (next) => {
    if (next !== undefined) internalSelected.value = [...next]
  },
)

function resolveRowKey(row: RowRecord, index: number): string {
  if (typeof props.rowKey === 'function') return props.rowKey(row, index)
  const raw = readCellValue(row, props.rowKey)
  return raw != null && raw !== '' ? String(raw) : String(index)
}

const currentPageKeys = computed(() => displayData.value.map((row, idx) => resolveRowKey(row, idx)))

const isAllPageSelected = computed(
  () => currentPageKeys.value.length > 0 && currentPageKeys.value.every((k) => selectedKeySet.value.has(k)),
)
const isSomePageSelected = computed(
  () =>
    !isAllPageSelected.value &&
    currentPageKeys.value.some((k) => selectedKeySet.value.has(k)),
)

const selectedRows = computed(() =>
  props.data.filter((row, idx) => selectedKeySet.value.has(resolveRowKey(row, idx))),
)

function updateSelection(nextKeys: string[]) {
  const unique = [...new Set(nextKeys)]
  if (props.selectedKeys === undefined) {
    internalSelected.value = unique
  }
  emit('update:selectedKeys', unique)
  const nextSet = new Set(unique)
  const rows = props.data.filter((row, idx) => nextSet.has(resolveRowKey(row, idx)))
  emit('selection-change', unique, rows)
}

function isRowSelected(row: RowRecord, index: number): boolean {
  return selectedKeySet.value.has(resolveRowKey(row, index))
}

function toggleRow(row: RowRecord, index: number) {
  const key = resolveRowKey(row, index)
  const next = selectedKeySet.value.has(key)
    ? selectedKeyList.value.filter((item) => item !== key)
    : [...selectedKeyList.value, key]
  updateSelection(next)
}

function toggleAllCurrentPage() {
  if (isAllPageSelected.value) {
    const pageSet = new Set(currentPageKeys.value)
    updateSelection(selectedKeyList.value.filter((k) => !pageSet.has(k)))
  } else {
    updateSelection([...selectedKeyList.value, ...currentPageKeys.value])
  }
}

const totalColSpan = computed(() => visibleColumns.value.length + (props.selectable ? 1 : 0))

const computedMinWidth = computed(() => {
  const sum = visibleColumns.value.reduce(
    (acc, col) => acc + getColumnWidth(col),
    props.selectable ? props.selectionWidth : 0,
  )
  if (props.minTableWidth != null) {
    if (typeof props.minTableWidth === 'number') {
      return `${Math.max(props.minTableWidth, sum)}px`
    }
    return Object.keys(customColumnWidths.value).length > 0 && sum > 0 ? `${sum}px` : props.minTableWidth
  }
  return sum > 0 ? `${sum}px` : undefined
})

const tableStyle = computed(() => {
  if (!computedMinWidth.value) return undefined
  return { minWidth: computedMinWidth.value }
})

function colStyle(col: NormalizedVueColumn) {
  const custom = customColumnWidths.value[col.resolvedKey]
  if (custom !== undefined) return { width: `${custom}px` }
  if (col.resolvedWidth) return { width: `${col.resolvedWidth}px` }
  if (col.resolvedMinWidth) return { width: `${col.resolvedMinWidth}px` }
  return { width: `${getColumnWidth(col)}px` }
}

function headerCellClass(col: NormalizedVueColumn) {
  return [
    col.resolvedAlign === 'right' ? 'is-align-right' : col.resolvedAlign === 'center' ? 'is-align-center' : '',
    col.resolvedKind === 'action' ? 'is-kind-action' : '',
    col.className ?? '',
  ]
}

function bodyCellClass(col: NormalizedVueColumn) {
  return [
    col.resolvedAlign === 'right' ? 'is-align-right' : col.resolvedAlign === 'center' ? 'is-align-center' : '',
    col.resolvedEllipsis ? 'is-ellipsis' : '',
    col.resolvedKind === 'code' ? 'is-kind-code' : '',
    col.resolvedKind === 'action' ? 'is-kind-action' : '',
    col.className ?? '',
  ]
}

function formatPlainText(row: RowRecord, col: NormalizedVueColumn, index: number): string {
  const value = readCellValue(row, col.prop)
  if (col.formatter) return col.formatter(row, value, index)
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

function clearSelection() {
  updateSelection([])
}

defineExpose({
  clearSelection,
  resetColumns: handleResetColumns,
  resetColumnWidths: resetAllWidths,
})
</script>
