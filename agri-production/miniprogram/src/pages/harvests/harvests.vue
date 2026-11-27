<template>
  <ops-scope-panel v-if="ops" :title="opsTitle" :subtitle="opsSubtitle" :entries="opsEntries" />
  <view v-else class="page has-fab"><view class="toolbar"><button class="btn-ghost btn-sm" @click="goExport">导出筛选结果</button></view>
    <view class="page-intro">记录采收批次、入库状态和溯源码，排程与休药期校验可从下方快捷入口进入。</view>
    <!-- 本月概览：全部由当月真实记录聚合，缺数据就显示「—」不补 0 -->
    <view class="stat-card">
      <view class="stat"><text class="stat-value">{{ monthStats.count }}</text><text class="stat-label">{{ monthLabelText }}采收次数</text></view>
      <view class="stat"><text class="stat-value">{{ monthStats.qty }}</text><text class="stat-label">{{ monthLabelText }}产量(kg)</text></view>
      <view class="stat"><text :class="['stat-value', monthStats.pending ? 'is-warn' : '']">{{ monthStats.pending }}</text><text class="stat-label">{{ monthLabelText }}待入库</text></view>
    </view>
    <view class="stat-scope">统计范围：当前筛选下已加载的批次，数量仅合计 kg 记录；继续加载后更新，不代表全场总产量</view>
    <view class="shortcut-row">
      <view class="shortcut" @click="goWindow"><text class="shortcut-icon">🗓️</text><text>采收排程</text></view>
      <view class="shortcut" @click="goBlockCheck"><text class="shortcut-icon">⏳</text><text>休药期对比</text></view>
      <view class="shortcut" @click="goInventory"><text class="shortcut-icon">📦</text><text>库存概览</text></view>
    </view>

    <view class="section-title harvest-section-title"><text>采收批次</text><text class="muted">{{ harvests.length }} 条</text></view>
    <view class="tabs">
      <view v-for="tab in tabs" :key="tab.key" class="tab-item" :class="{ active: activeTab === tab.key }" @click="switchTab(tab.key)">{{ tab.label }}</view>
    </view>



    <view v-for="item in harvests" :key="item.batchId" class="card">
      <view @click="goDetail(item.batchId)">
        <view class="row">
          <text class="list-title">{{ item.cropName || '未填作物' }}<text class="muted">（{{ item.grade || '—' }}）</text></text>
          <text class="tag" :style="{ color: inboundColor(item.inboundStatus) }">{{ inboundLabel(item.inboundStatus) }}</text>
        </view>
        <view class="harvest-qty">{{ fmtNumber(item.quantity, item.unit) }}</view>
        <view class="list-meta">📍 {{ item.plotName || item.plotId || '—' }} · {{ fmtDate(item.harvestDate) }}</view>
      </view>
      <view class="harvest-foot">
        <text class="muted">{{ item.batchNo || '—' }} · {{ item.warehouseName || '未入库' }}</text>
        <button class="btn-primary btn-sm" @click="goDetail(item.batchId)">查看 / 入库</button>
      </view>
    </view>

    <view class="fab" @click="goCreate">＋ 新建采收</view>
    <mobile-list-state :loading="loading" :error="error" :count="harvests.length" :total="total" :has-more="hasMore" empty-text="该筛选条件下暂无采收记录" @retry="retry" @more="more" />
    <view class="more-management"><button class="btn-ghost" @click="openWorkspace('/production/harvests', true)">更多管理功能 ›</button><text class="muted">打开完整业务，可处理更多管理操作</text></view>
  </view>
</template>

<script setup lang="ts">
const goExport=()=>uni.navigateTo({url:'/pages/native/exports?kind=harvests'})
const goImport=()=>uni.navigateTo({url:'/pages/native/import?kind=plots'})
import MobileListState from '@/components/mobile-list-state/mobile-list-state.vue'
import { useMobileList } from '@/composables/use-mobile-list'

import { isProductionOps, ensureWorkspaceSession, openWorkspace, workspaceMode } from '@/utils/workspace'
import { computed, ref } from 'vue'
import OpsScopePanel from '@/components/ops-scope-panel/ops-scope-panel.vue'
/** 平台管理员不归属具体农场：本 Tab 改为运营端对应入口（与电脑端运营菜单同名） */
const ops = ref(isProductionOps())
const opsTitle = '采收与质量监管'
const opsSubtitle = '按全平台口径查看产出、质量与溯源'
const opsEntries = [
  { icon: '📊', label: '生产总览', desc: '各农场生产与产出概况', path: '/admin/production/dashboard/overview' },
  { icon: '🧪', label: '质量安全总览', desc: '检测、溯源与质量风险', path: '/admin/production/trace' },
  { icon: '🏷️', label: '单品溯源码管理', desc: '批次溯源码发放与核查', path: '/admin/production/trace/codes' },
  { icon: '📄', label: '检测报告管理', desc: '各批次检测报告台账', path: '/admin/production/quality/inspections' },
  { icon: '📑', label: '生产与质量报表', desc: '产量、质量统计报表', path: '/admin/production/reports' },
]
import { onShow } from '@dcloudio/uni-app'
import { listHarvests } from '@/api/production'
import { ensureLogin, resolveCurrentFarm } from '@/utils/auth-helper'
import { fmtDate, fmtNumber, INBOUND_STATUS_COLOR, INBOUND_STATUS_LABEL } from '@/utils/format'

/** 入库状态 Tab：全部 / 待入库 / 已入库 / 已出库 */
const tabs = [
  { key: 'all', label: '全部', status: undefined as number | undefined },
  { key: 'pending', label: '待入库', status: 0 },
  { key: 'in', label: '已入库', status: 1 },
  { key: 'out', label: '已出库', status: 2 },
]

const activeTab = ref('all')

const { rows: harvests, loading, error, total, hasMore, reload: load, more, retry, cancel } = useMobileList(async (pageNum, pageSize) => {
  if (!await ensureWorkspaceSession() || workspaceMode() === 'ops') throw new Error('请切换到用户端查看采收记录')
  const farm = await resolveCurrentFarm()
  if (!farm) throw new Error('请在「我的」选择农场')
  return listHarvests({ farmId: farm.farmId, inboundStatus: tabs.find(t => t.key === activeTab.value)?.status, pageNum, pageSize })
}, row => String(row.batchId ?? row.id))

const inboundLabel = (status: any): string => INBOUND_STATUS_LABEL[Number(status ?? 0)] ?? '—'
const inboundColor = (status: any): string => INBOUND_STATUS_COLOR[Number(status ?? 0)] ?? '#666666'

const monthLabelText = '已加载'
const monthStats = computed(() => ({ count: harvests.value.length, qty: harvests.value.filter(item => String(item.unit || '').toLowerCase() === 'kg').reduce((sum, item) => sum + Number(item.quantity || 0), 0), pending: harvests.value.filter(item => Number(item.inboundStatus) === 0).length }))

function switchTab(key: string): void {
  activeTab.value = key
  void load()
}

// 入库统一在详情页按累计入库流水计算剩余额度，支持其他端已部分入库的批次。

const goDetail = (batchId: string): void => {
  uni.navigateTo({ url: `/pages/harvests/detail?id=${batchId}` })
}
const goCreate = (): void => {
  uni.navigateTo({ url: '/pages/harvests/create' })
}
const goWindow = (): void => {
  openWorkspace('/production/harvests/window-decision')
}
const goInventory = (): void => {
  uni.navigateTo({ url: '/pages/inventory/inventory' })
}

/** PRD §10.3：多地块休药期状态对比（服务端一次查多块地） */
const goBlockCheck = (): void => {
  uni.navigateTo({ url: '/pages/food-safety/harvest-block' })
}

onShow(async () => {
  cancel(); harvests.value = []
  if (!await ensureWorkspaceSession()) return
  ops.value = workspaceMode() === 'ops'
  if (ops.value) return
  void load()
})
</script>

<style scoped>
.shortcut-row { display: flex; gap: 12rpx; margin: 0 24rpx 18rpx; }
.shortcut { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 6rpx; padding: 16rpx 4rpx; background: #fff; border: 1rpx solid #e7eee9; border-radius: 16rpx; font-size: 24rpx; color: #244c37; box-shadow: 0 4rpx 16rpx rgba(22, 70, 46, 0.035); }
.shortcut:active { background: #e8f6ee; }
.shortcut-icon { font-size: 34rpx; line-height: 1.1; }
.stat-scope { margin: -8rpx 32rpx 16rpx; color: #666666; font-size: 24rpx; line-height: 1.45; }
.harvest-section-title { margin-top: 24rpx; }
.harvest-qty { margin-top: 12rpx; font-size: 40rpx; font-weight: 700; color: #16462e; }
.harvest-foot { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; margin-top: 20rpx; padding-top: 20rpx; border-top: 1rpx solid #edf1ee; }

/* 2026-11-20：逐页实测控件的48px触控区。 */
.fab { min-height:48px; }
</style>
