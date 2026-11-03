<template>
  <div class="mds-stat-grid">
    <div v-for="item in items" :key="item.label" class="mds-stat" :class="item.tone ? `mds-stat--${item.tone}` : ''">
      <div class="mds-stat-label">{{ item.label }}</div>
      <div class="mds-stat-value">{{ item.value }}</div>
      <div v-if="item.hint" class="mds-stat-foot">{{ item.hint }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface StatItem {
  label: string
  value: string | number
  hint?: string
  tone?: 'brand' | 'success' | 'warning' | 'danger'
}

defineProps<{ items: StatItem[] }>()
</script>
