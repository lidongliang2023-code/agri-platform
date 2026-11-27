<template>
  <view class="page business-page">
    <view class="business-top">
      <view class="search-bar"><text class="search-icon">🔍</text><input v-model="query" placeholder="搜索采收、计划、质检、报表…" confirm-type="search" /><text v-if="query" class="link" @tap="query = ''">清除</text></view>
      <view v-if="ops" class="mode-hint">当前为运营端，仅显示运营管理业务；如需经营主体功能，请到「我的」切换到用户端。</view>
    </view>
    <view class="muted business-hint">{{ query.trim() ? '匹配 ' : '共 ' }}{{ total }} 项业务，按当前工作模式展示</view>
    <view v-for="group in groups" :key="group.key" class="card group-card">
      <view class="group-head"><text class="group-icon">{{ groupIcon(group.key) }}</text><text class="group-name">{{ group.label }}</text><text class="muted">{{ group.children.length }}</text></view>
      <view class="business-grid">
        <view v-for="item in group.children" :key="item.key" class="business-item" @tap="openWorkspace(item.key)">
          <view class="business-copy"><text class="business-label">{{ item.label }}</text><text class="business-kind">{{ nativeUserPages[item.key] ? '移动端办理' : '运营业务' }}</text></view><text class="field-arrow">›</text>
        </view>
      </view>
    </view>
    <view v-if="!groups.length" class="empty">未找到匹配的业务，换个关键词试试</view>
    <view class="connection-link" @tap="connection"><text class="muted">服务连接与发布配置 ›</text></view>
  </view>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import menus from '../../../../../packages/agri-shared/src/production/menus.json'
import { isProductionOps, openWorkspace, ensureWorkspaceSession, nativeUserPages } from '@/utils/workspace'
const query = ref(''); const ops = ref(false)
const ICONS: Record<string, string> = {
  dashboard: '🏠', farm: '🏞️', 'smart-farming': '🌱', input: '🧴', growth: '📡', harvest: '🧺', quality: '🧪', p2t: '🤝', analytics: '📈', settings: '⚙️',
  'ops-dashboard': '📊', 'farm-supervision': '🛡️', 'base-data': '🗂️', monitor: '🛰️', trace: '🔎', 'ai-center': '🤖', report: '📑',
}
const groupIcon = (key: string): string => ICONS[key] || '📁'
const groups = computed(() => (ops.value ? menus.admin : menus.user).map(group => ({ ...group, children: group.children.filter(item => (group.label + item.label).includes(query.value.trim())) })).filter(group => group.children.length))
const total = computed(() => groups.value.reduce((sum, group) => sum + group.children.length, 0))
onShow(async () => {
  if (!await ensureWorkspaceSession()) return
  ops.value = isProductionOps()
})
function connection(): void { uni.navigateTo({ url: '/pages/connection/connection' }) }
</script>
<style scoped>
.business-top { position: sticky; top: var(--window-top, 0px); z-index: 10; background: #f5f6fa; padding-bottom: 12rpx; }
.mode-hint { margin: 16rpx 24rpx 0; padding: 14rpx 18rpx; border-radius: 12rpx; background: #fff7e6; color: #704000; font-size: 24rpx; line-height: 1.5; }
.business-hint { display: block; margin: 8rpx 32rpx 0; }
.group-head { display: flex; align-items: center; gap: 12rpx; margin-bottom: 20rpx; }
.group-icon { font-size: 34rpx; }
.group-name { flex: 1; font-size: 30rpx; font-weight: 600; color: #16462e; }
.business-grid { display: flex; flex-wrap: wrap; gap: 16rpx; }
.business-item { box-sizing: border-box; width: calc(50% - 8rpx); min-height: 96rpx; padding: 18rpx 20rpx; display: flex; align-items: center; justify-content: space-between; gap: 8rpx; background: #f5f9f6; border-radius: 14rpx; }
.business-item:active { background: #e8f6ee; }
.business-label { font-size: 26rpx; color: #244c37; line-height: 1.45; }
.connection-link { text-align: center; padding: 24rpx 0 8rpx; }
.business-copy { min-width: 0; }
.business-kind { display: block; font-size: 24rpx; color: #666666; margin-top: 6rpx; }
</style>
