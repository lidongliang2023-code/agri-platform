<template>
  <view class="list-state" aria-live="polite">
    <view v-if="error" class="state-error"><text>{{ error }}</text><button class="btn-ghost" :disabled="loading" @click="$emit('retry')">重新加载</button></view>
    <view v-else-if="loading" class="state-loading">正在加载，请稍候…</view>
    <view v-else-if="!count" class="state-empty"><text>{{ emptyText }}</text><text class="muted">可以调整筛选条件，或下拉刷新</text></view>
    <button v-else-if="hasMore" class="btn-ghost" @click="$emit('more')">加载更多 · 已显示 {{ count }} / {{ total }} 条</button>
    <text v-else class="muted">已显示全部 {{ count }} 条</text>
  </view>
</template>
<script setup lang="ts">
defineProps<{ loading: boolean; error: string; count: number; total: number; hasMore: boolean; emptyText?: string }>()
defineEmits<{ (event: 'retry'): void; (event: 'more'): void }>()
</script>
<style scoped>
.list-state { margin: 24rpx; padding: 16rpx 0 32rpx; text-align: center; font-size: 26rpx; color: #607067; }
.state-error { display: flex; flex-direction: column; gap: 18rpx; padding: 24rpx; background: #fff4f0; color: #b33524; border-radius: 18rpx; }
.state-empty { display: flex; flex-direction: column; gap: 12rpx; padding: 56rpx 12rpx; }
.state-loading { padding: 28rpx; }
</style>
