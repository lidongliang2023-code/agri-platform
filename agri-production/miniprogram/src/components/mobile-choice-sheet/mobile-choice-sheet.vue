<template>
  <view v-if="open" class="choice-mask" @click.self="close">
    <view class="choice-sheet" role="dialog" :aria-label="title">
      <view class="choice-head"><text>{{ title }}</text><button class="choice-close" :disabled="busy" @click="close">关闭</button></view>
      <view class="search-bar"><input :disabled="busy" v-model="keyword" :placeholder="'搜索' + title" confirm-type="search" /><button v-if="keyword" :disabled="busy" class="choice-close" @click="keyword = ''">清除</button></view>
      <scroll-view scroll-y class="choice-list" @touchmove.stop>
        <view v-if="!filtered.length" class="empty">未找到匹配结果</view>
        <button v-for="item in filtered" :key="item.value" class="choice-row" :class="{ selected: item.value === value }" :disabled="busy" @click="$emit('select', item.value)"><text>{{ item.label }}</text><text class="choice-mark">{{ item.value === value ? '当前 ✓' : '选择' }}</text></button>
      </scroll-view>
    </view>
  </view>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
const props = defineProps<{ open: boolean; title: string; value: string; options: { value: string; label: string }[]; busy?: boolean }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'select', value: string): void }>()
function close(): void { if (!props.busy) emit('close') }
const keyword = ref('')
watch(() => props.open, () => { keyword.value = '' })
const filtered = computed(() => props.options.filter(item => item.label.toLowerCase().includes(keyword.value.trim().toLowerCase())))
</script>
<style scoped>
.choice-mask { position: fixed; inset: 0; z-index: 999; background: rgba(12, 33, 21, .45); display: flex; flex-direction: column; justify-content: flex-end; }
.choice-sheet { background: #fff; border-radius: 32rpx 32rpx 0 0; padding: 16rpx 24rpx calc(24rpx + env(safe-area-inset-bottom)); }
.choice-head { display: flex; align-items: center; justify-content: space-between; font-size: 32rpx; font-weight: 600; padding: 8rpx 12rpx; }
.choice-close { background: transparent; color: #1e6b38; min-height: 88rpx; font-size: 26rpx; display: flex; align-items: center; }
.search-bar { margin: 8rpx 0 20rpx; }
.choice-list { height: 48vh; }
.choice-row { min-height: 100rpx; padding: 22rpx 16rpx; display: flex; justify-content: space-between; align-items: center; gap: 18rpx; background: #fff; border-bottom: 1rpx solid #e7eee9; border-radius: 0; text-align: left; line-height: 1.5; font-size: 28rpx; }
.choice-row > text:first-child { min-width: 0; overflow-wrap: anywhere; }
.choice-row.selected { background: #e6f5ed; color: #0f7a45; }
.choice-mark { flex: none; font-size: 24rpx; color: #1e6b38; }
</style>
