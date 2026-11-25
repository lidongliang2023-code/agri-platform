<template>
  <div v-if="!items.length" class="chart-empty">暂无统计分布数据</div>
  <div v-else class="stack">
    <div v-for="item in items" :key="item.label" class="bar-cell">
      <div class="row" style="justify-content: space-between">
        <span class="small">{{ item.label }}</span>
        <b class="small">{{ item.value }}</b>
      </div>
      <div class="bar-track">
        <div :class="`bar-fill ${item.tone ?? ''}`" :style="{ width: `${Math.max((item.value / peak) * 100, item.value > 0 ? 3 : 0)}%` }" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ items: Array<{ label: string; value: number; tone?: string }>; max?: number }>()
const peak = computed(() => props.max ?? Math.max(...props.items.map((item) => item.value), 1))
</script>
