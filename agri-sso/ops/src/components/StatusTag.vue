<template>
  <a-tag :class="`soft-tag tone-${hit.tone}`">{{ hit.label }}</a-tag>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { STATUS_MAP } from './ui-constants'

const props = defineProps<{ status?: string | null }>()
const hit = computed(() => {
  const key = props.status ?? 'none'
  return STATUS_MAP[key] ?? { label: key || '—', tone: 'default' }
})
</script>
