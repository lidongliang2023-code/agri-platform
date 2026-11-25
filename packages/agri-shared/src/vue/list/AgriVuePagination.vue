<template>
  <div class="agri-vue-pagination">
    <div class="agri-vue-pagination-summary">
      <template v-if="selectedCount > 0">
        <span class="agri-vue-pagination-selected">已选 {{ selectedCount }} 项</span>
        <span aria-hidden="true">·</span>
      </template>
      <span>共 {{ safeTotal }} {{ unit }}</span>
    </div>

    <div class="agri-vue-pagination-controls">
      <button
        type="button"
        class="agri-vue-page-btn"
        aria-label="上一页"
        :disabled="currentPage <= 1"
        @click="goPage(currentPage - 1)"
      >
        &lt;
      </button>

      <template v-for="(token, idx) in pageTokens" :key="`${token}-${idx}`">
        <span v-if="typeof token !== 'number'" class="agri-vue-page-ellipsis">…</span>
        <button
          v-else
          type="button"
          class="agri-vue-page-btn"
          :class="{ 'is-active': token === currentPage }"
          :aria-current="token === currentPage ? 'page' : undefined"
          @click="goPage(token)"
        >
          {{ token }}
        </button>
      </template>

      <button
        type="button"
        class="agri-vue-page-btn"
        aria-label="下一页"
        :disabled="currentPage >= totalPages"
        @click="goPage(currentPage + 1)"
      >
        &gt;
      </button>

      <select
        v-if="showSizeChanger"
        class="agri-vue-page-size"
        aria-label="每页条数"
        :value="pageSize"
        @change="onSizeChange"
      >
        <option v-for="size in pageSizeOptions" :key="size" :value="size">
          {{ size }} 条/页
        </option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  DEFAULT_VUE_PAGE_SIZE,
  DEFAULT_VUE_PAGE_SIZES,
  buildPageTokens,
  clampPage,
  computeTotalPages,
} from './vueListUtils'
import './AgriVueList.css'

const props = withDefaults(
  defineProps<{
    page?: number
    pageSize?: number
    total?: number
    selectedCount?: number
    unit?: string
    pageSizeOptions?: readonly number[]
    showSizeChanger?: boolean
  }>(),
  {
    page: 1,
    pageSize: DEFAULT_VUE_PAGE_SIZE,
    total: 0,
    selectedCount: 0,
    unit: '条',
    pageSizeOptions: () => [...DEFAULT_VUE_PAGE_SIZES],
    showSizeChanger: true,
  },
)

const emit = defineEmits<{
  'update:page': [page: number]
  'update:pageSize': [size: number]
  change: [page: number, pageSize: number]
}>()

const safeTotal = computed(() => (Number.isFinite(props.total) && props.total > 0 ? Math.floor(props.total) : 0))
const totalPages = computed(() => computeTotalPages(safeTotal.value, props.pageSize))
const currentPage = computed(() => clampPage(props.page, safeTotal.value, props.pageSize))
const pageTokens = computed(() => buildPageTokens(currentPage.value, totalPages.value))

function goPage(nextPage: number) {
  const clamped = clampPage(nextPage, safeTotal.value, props.pageSize)
  if (clamped === currentPage.value) return
  emit('update:page', clamped)
  emit('change', clamped, props.pageSize)
}

function onSizeChange(event: Event) {
  const nextSize = Number((event.target as HTMLSelectElement).value)
  if (!Number.isFinite(nextSize) || nextSize <= 0) return
  emit('update:pageSize', nextSize)
  emit('update:page', 1)
  emit('change', 1, nextSize)
}
</script>
