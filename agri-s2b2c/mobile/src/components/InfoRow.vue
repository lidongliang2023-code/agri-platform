<template><view class="info-row"><text class="info-label">{{label}}</text><text class="info-value">{{value || '—'}}</text></view></template>
<script setup lang="ts">
defineProps<{label?:string;value?:string}>()
</script>
<style scoped>.info-row{display:flex;justify-content:space-between;gap:24rpx;padding:16rpx 0}.info-label{color:#666666;flex-shrink:0}.info-value{text-align:right;word-break:break-all}</style>