<template>
  <a-tag :class="`status-tag tone-${meta.tone}`">{{ meta.label }}</a-tag>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ORDER_STATUS } from './ui-constants'

const props = withDefaults(
  defineProps<{
    status: string
    labels?: Record<string, { label: string; tone: string }>
  }>(),
  { labels: () => ORDER_STATUS },
)

const meta = computed(() => props.labels[props.status] ?? { label: props.status, tone: 'gray' })
</script>
