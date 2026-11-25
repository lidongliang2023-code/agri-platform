<template>
  <EmptyState icon="🛠️" title="数据暂时未加载" :description="message">
    <template #action>
      <a-button type="primary" @click="handleRetry">重新加载</a-button>
    </template>
  </EmptyState>
</template>

<script setup lang="ts">
import EmptyState from './EmptyState.vue'

defineProps<{ message: string; hasRetry?: boolean }>()
const emit = defineEmits<{ retry: [] }>()

function handleRetry() {
  emit('retry')
}
</script>
