<template>
  <div class="mds-pager">
    <span>共 {{ total }} 条</span>
    <select :value="pageSize" @change="onSizeChange">
      <option v-for="size in pageSizeOptions" :key="size" :value="size">{{ size }} 条/页</option>
    </select>
    <button class="mds-pager__btn" :disabled="page <= 1" @click="emit('change', page - 1)">上一页</button>
    <span>第 {{ page }} / {{ totalPages }} 页</span>
    <button class="mds-pager__btn" :disabled="page >= totalPages" @click="emit('change', page + 1)">下一页</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    page: number
    pageSize: number
    total: number
    pageSizeOptions?: number[]
  }>(),
  { pageSizeOptions: () => [10, 20, 50] },
)

const emit = defineEmits<{
  change: [page: number]
  'update:pageSize': [size: number]
}>()

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))

function onSizeChange(event: Event) {
  const size = Number((event.target as HTMLSelectElement).value)
  emit('update:pageSize', size)
  emit('change', 1)
}
</script>
