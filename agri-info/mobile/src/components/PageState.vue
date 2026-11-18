<script setup lang="ts">
defineProps<{loading: boolean; error?: string; empty?: boolean; emptyText?: string}>()
defineEmits<{(event: 'retry'): void}>()
</script>
<template>
 <view v-if="loading" class="native-state"><text>正在加载…</text></view>
 <view v-else-if="error" class="native-state"><text>{{ error }}</text><button class="btn btn-ghost" @tap="$emit('retry')">重新加载</button></view>
 <view v-else-if="empty" class="native-state"><text>{{ emptyText || '暂无记录' }}</text></view>
</template>
