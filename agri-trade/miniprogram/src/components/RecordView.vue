<script setup lang="ts">
import { computed } from 'vue'
import { labels, statusLabels } from '../business'

const props = defineProps<{ data: any; fields?: string[] }>()
const entries = computed(() => Object.entries(props.data || {}).filter(([key, value]) => value != null && value !== '' && (!props.fields || props.fields.includes(key))))

function display(value: any): string {
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return statusLabels[String(value)] || String(value)
}
</script>

<template>
  <view class="record">
    <view v-for="entry in entries" :key="entry[0]" class="entry">
      <text class="label">{{ labels[entry[0]] || entry[0] }}</text>
      <text selectable class="value">{{ display(entry[1]) }}</text>
    </view>
    <view v-if="!entries.length" class="none">暂无可展示的信息</view>
  </view>
</template>

<style scoped>
.record { width: 100%; }
.entry { display: flex; align-items: flex-start; gap: 20rpx; padding: 20rpx 0; border-bottom: 1rpx solid var(--c-line); font-size: 26rpx; line-height: 1.55; }
.entry:last-child { border-bottom: 0; }
.label { flex: 0 0 152rpx; color: var(--c-text-3); }
.value { min-width: 0; flex: 1; color: var(--c-text); text-align: left; white-space: pre-wrap; word-break: break-all; }
.none { padding: 24rpx 0; color: var(--c-text-3); font-size: 26rpx; text-align: center; }
</style>
