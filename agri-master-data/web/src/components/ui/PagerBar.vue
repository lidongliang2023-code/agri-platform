<template>
  <AgriVuePagination
    :page="page"
    :page-size="pageSize"
    :total="total"
    :selected-count="selectedCount"
    :unit="unit"
    :page-size-options="pageSizeOptions"
    @update:page="emit('change', $event)"
    @update:page-size="onSizeChange"
  />
</template>

<script setup lang="ts">
import { AgriVuePagination } from '@agri/shared/vue/list'

withDefaults(
  defineProps<{
    page: number
    pageSize: number
    total: number
    selectedCount?: number
    unit?: string
    pageSizeOptions?: number[]
  }>(),
  {
    selectedCount: 0,
    unit: '条',
    pageSizeOptions: () => [10, 20, 50, 100],
  },
)

const emit = defineEmits<{
  change: [page: number]
  'update:pageSize': [size: number]
}>()

function onSizeChange(size: number) {
  emit('update:pageSize', size)
  emit('change', 1)
}
</script>
