<template>
  <view class="page">
    <view class="page-hero">
      <text class="hero-title">{{ title }}</text>
      <text class="hero-sub">{{ subtitle }}</text>
    </view>
    <view class="card ops-list-card">
      <view class="card-title"><text>运营快捷入口</text><text class="muted">{{ entries.length }} 项</text></view>
      <view v-for="entry in entries" :key="entry.path" class="ops-entry" @tap="openWorkspace(entry.path)">
        <text class="ops-icon">{{ entry.icon }}</text>
        <view class="ops-body">
          <text class="ops-label">{{ entry.label }}</text>
          <text class="ops-desc">{{ entry.desc }}</text>
        </view>
        <text class="field-arrow">›</text>
      </view>
    </view>
    <view class="notice">当前为运营端，只展示平台运营与监管能力。需要录入具体农场数据时，请在“我的”切换到用户端。</view>
    <view class="card is-tappable" @tap="openBusiness">
      <view class="row"><text class="list-title">全部运营与经营业务</text><text class="field-arrow">›</text></view>
      <view class="list-meta">与电脑端运营菜单一致</view>
    </view>
  </view>
</template>
<script setup lang="ts">
import { openWorkspace } from '@/utils/workspace'

interface OpsEntry { icon: string; label: string; desc: string; path: string }
defineProps<{ title: string; subtitle: string; entries: OpsEntry[] }>()
function openBusiness(): void { uni.switchTab({ url: '/pages/business/business' }) }
</script>
<style scoped>
.ops-list-card { padding-top: 20rpx; }
.ops-entry { display: flex; align-items: center; gap: 18rpx; min-height: 104rpx; padding: 18rpx 0; border-bottom: 1rpx solid #edf1ee; }
.ops-entry:last-child { border-bottom: 0; }
.ops-entry:active { opacity: 0.68; background: #fbfdfb; }
.ops-icon { flex: none; width: 76rpx; height: 76rpx; border-radius: 20rpx; background: #e8f6ee; font-size: 36rpx; display: flex; align-items: center; justify-content: center; }
.ops-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4rpx; }
.ops-label { font-size: 29rpx; font-weight: 600; color: #1f2a24; }
.ops-desc { font-size: 24rpx; line-height: 1.45; color: #5b6b62; }
</style>
