<script setup lang="ts">
import { computed } from 'vue'

/**
 * 轻量趋势图：不引入图表库，用 flex 柱形渲染，H5 / 微信小程序 / App 三端表现一致。
 * 涨跌配色遵循国内农产品行情惯例：涨红、跌绿、平灰。
 */
const props = withDefaults(
  defineProps<{
    points: Array<{ label: string; value: number }>
    height?: number
    unit?: string
    digits?: number
    /** 指定基准色：'auto' 按相邻点涨跌着色；'up'/'down' 统一着色。 */
    mode?: 'auto' | 'up' | 'down' | 'neutral'
  }>(),
  { height: 260, unit: '', digits: 2, mode: 'auto' },
)

const values = computed(() => props.points.map((point) => Number(point.value || 0)))
const max = computed(() => Math.max(...values.value, 0.0001))
const min = computed(() => Math.min(...values.value, 0))
const span = computed(() => (max.value - min.value) || 1)
const labels = computed(() => props.points.map((point) => point.label))

function barHeight(value: number): string {
  const ratio = (Number(value) - min.value) / span.value
  // 留 12% 底部余量，避免最低点看不见。
  return `${Math.max(8, Math.round(ratio * 88 + 12))}%`
}

function barClass(index: number): string {
  if (props.mode === 'up') return 'up'
  if (props.mode === 'down') return 'down'
  if (props.mode === 'neutral') return 'neutral'
  if (index === 0) return 'neutral'
  return values.value[index] >= values.value[index - 1] ? 'up' : 'down'
}

const axisLabels = computed(() => {
  const total = labels.value.length
  if (!total) return []
  if (total <= 3) return labels.value.map((label, index) => ({ label, index }))
  return [
    { label: labels.value[0], index: 0 },
    { label: labels.value[Math.floor(total / 2)], index: Math.floor(total / 2) },
    { label: labels.value[total - 1], index: total - 1 },
  ]
})
</script>

<template>
  <view class="trend">
    <view class="trend-canvas" :style="{ height: `${height}rpx` }">
      <view
        v-for="(point, index) in points"
        :key="`${point.label}-${index}`"
        class="trend-col"
      >
        <view class="trend-bar" :class="barClass(index)" :style="{ height: barHeight(point.value) }" />
      </view>
    </view>
    <view class="trend-axis">
      <text v-for="item in axisLabels" :key="`axis-${item.index}`" class="tiny">{{ item.label }}</text>
    </view>
    <view class="trend-range">
      <text class="tiny">最低 {{ min.toFixed(digits) }}{{ unit }}</text>
      <text class="tiny">最高 {{ max.toFixed(digits) }}{{ unit }}</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.trend {
  width: 100%;
}

.trend-canvas {
  display: flex;
  align-items: flex-end;
  gap: 6rpx;
  padding-top: 8rpx;
}

.trend-col {
  display: flex;
  height: 100%;
  flex: 1;
  align-items: flex-end;
}

.trend-bar {
  width: 100%;
  border-radius: 6rpx 6rpx 2rpx 2rpx;
  background: #cfdcd4;
  transition: height 0.25s ease;
}

.trend-bar.up {
  background: linear-gradient(180deg, #e05a5a, #c62828);
}

.trend-bar.down {
  background: linear-gradient(180deg, #57a06a, #2e7d32);
}

.trend-bar.neutral {
  background: linear-gradient(180deg, #b9c9c0, #8fa197);
}

.trend-axis {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10rpx;
}

.trend-range {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 6rpx;
}
</style>
