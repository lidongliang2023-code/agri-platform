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
        @reset-columns="resetColumns"
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
                  :disabled="!data.length"
                  @change="toggleAllCurrentPage"
                />
              </th>
              <th
                v-for="col in visibleColumns"
                :key="`th-${col.resolvedKey}`"
                :class="headerCellClass(col)"
                :title="col.label"
              >
                {{ col.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td :colspan="totalColSpan" class="agri-vue-table-empty">
                {{ loadingText }}
              </td>
            </tr>
            <tr v-else-if="!data.length">
              <td :colspan="totalColSpan" class="agri-vue-table-empty">
                <slot name="empty">{{ emptyText }}</slot>
              </td>
            </tr>
            <tr
              v-for="(row, rowIndex) in data"
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
        :page="page"
        :page-size="pageSize"
        :total="resolvedTotal"
        :selected-count="selectedKeyList.length"
        :unit="totalUnit"
        :page-size-options="pageSizeOptions"
        @update:page="emit('update:page', $event)"
        @update:page-size="emit('update:pageSize', $event)"
        @change="(p, s) => emit('page-change', p, s)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AgriVueToolbar from './AgriVueToolbar.vue'
import AgriVuePagination from './AgriVuePagination.vue'
import { useVueListColumns } from './useVueListColumns'
import {
  DEFAULT_SELECTION_COLUMN_WIDTH,
  DEFAULT_VUE_PAGE_SIZE,
  DEFAULT_VUE_PAGE_SIZES,
  readCellValue,
  type NormalizedVueColumn,
  type VueListColumn,
} from './vueListUtils'
import './AgriVueList.css'

type RowRecord = Record<string, unknown>

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
    lockedColumnKeys?: string[]
    minTableWidth?: number | string
    showPagination?: boolean
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
    lockedColumnKeys: undefined,
    minTableWidth: undefined,
    showPagination: true,
    page: 1,
    pageSize: DEFAULT_VUE_PAGE_SIZE,
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
}>()

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

const currentPageKeys = computed(() => props.data.map((row, idx) => resolveRowKey(row, idx)))

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
const resolvedTotal = computed(() => (props.total !== undefined ? props.total : props.data.length))

const tableStyle = computed(() => {
  if (props.minTableWidth == null) return undefined
  const width = typeof props.minTableWidth === 'number' ? `${props.minTableWidth}px` : props.minTableWidth
  return { minWidth: width }
})

function colStyle(col: NormalizedVueColumn) {
  if (col.resolvedWidth) return { width: `${col.resolvedWidth}px` }
  if (col.resolvedMinWidth) return { width: `${col.resolvedMinWidth}px` }
  return undefined
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
</script>
