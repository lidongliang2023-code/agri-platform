<template>
  <div v-if="!labels.length || !series.length" class="chart-empty">暂无趋势数据</div>
  <template v-else>
    <svg class="trend-chart" :viewBox="`0 0 ${width} ${height}`" role="img" aria-label="趋势图">
      <line
        v-for="ratio in [0, 0.25, 0.5, 0.75, 1]"
        :key="ratio"
        :x1="padding.left"
        :x2="width - padding.right"
        :y1="padding.top + plotHeight * ratio"
        :y2="padding.top + plotHeight * ratio"
        class="chart-grid"
      />
      <path v-for="item in series" :key="item.name" :d="pathOf(item.values)" fill="none" :stroke="item.color" stroke-width="2" />
      <template v-for="(label, index) in labels" :key="label">
        <text
          v-if="(index % labelStep === 0 && index < labels.length - 1 - Math.max(1, Math.floor(labelStep / 2))) || index === labels.length - 1"
          :x="padding.left + stepX * index"
          :y="height - 8"
          text-anchor="middle"
          class="chart-axis"
        >
          {{ label.slice(5) }}
        </text>
      </template>
    </svg>
    <div class="chart-legend">
      <span v-for="item in series" :key="item.name"><i :style="{ background: item.color }" />{{ item.name }}</span>
    </div>
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Series } from './ui-constants'

const props = withDefaults(defineProps<{ labels: string[]; series: Series[]; height?: number }>(), { height: 220 })
const width = 760
const padding = { top: 18, right: 18, bottom: 28, left: 44 }
const plotWidth = width - padding.left - padding.right
const plotHeight = computed(() => props.height - padding.top - padding.bottom)
const max = computed(() => Math.max(...props.series.flatMap((item) => item.values), 1))
const stepX = computed(() => plotWidth / Math.max(props.labels.length - 1, 1))
const labelStep = computed(() => Math.max(Math.ceil(props.labels.length / 8), 1))

function pathOf(values: number[]): string {
  return values
    .map((value, index) => {
      const x = padding.left + stepX.value * index
      const y = padding.top + plotHeight.value - (value / max.value) * plotHeight.value
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}
</script>
