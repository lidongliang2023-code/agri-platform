<template>
  <view class="page">
    <!-- 本月概览：全部由当月真实记录聚合，缺数据就显示「—」不补 0 -->
    <view class="card">
      <view class="card-title"><text>📊 本月概览（{{ monthLabel }}）</text></view>
      <view class="grid">
        <view class="grid-cell"><text class="strong">{{ monthStats.count }}</text><text class="muted">采收次数</text></view>
        <view class="grid-cell"><text class="strong">{{ monthStats.qty }}</text><text class="muted">总产量(kg)</text></view>
        <view class="grid-cell"><text class="strong">{{ monthStats.pending }}</text><text class="muted">待入库</text></view>
      </view>
    </view>

    <view class="tabs">
      <view
        v-for="tab in tabs"
        :key="tab.key"
        class="tab-item"
        :class="{ active: activeTab === tab.key }"
        @click="switchTab(tab.key)"
      >
        {{ tab.label }}
      </view>
    </view>

    <view v-if="error" class="error-box">{{ error }}</view>
    <view v-if="!error && harvests.length === 0" class="empty">暂无采收批次</view>

    <view v-for="item in harvests" :key="item.batchId" class="card">
      <view class="row" @click="goDetail(item.batchId)">
        <text class="strong">{{ item.cropName || '未填作物' }}（{{ item.grade || '—' }}）</text>
        <text class="tag" :style="{ color: inboundColor(item.inboundStatus) }">
          {{ inboundLabel(item.inboundStatus) }}
        </text>
      </view>
      <view class="muted" style="margin-top: 8rpx" @click="goDetail(item.batchId)">
        {{ item.plotName || item.plotId || '—' }} · {{ fmtDate(item.harvestDate) }} ·
        {{ fmtNumber(item.quantity, item.unit) }}
      </view>
      <view class="row" style="margin-top: 16rpx">
        <text class="muted">{{ item.batchNo || '' }} · {{ item.warehouseName || '未入库' }}</text>
        <text
          v-if="Number(item.inboundStatus ?? 0) === 0"
          class="btn-primary btn-sm"
          @click="confirmInbound(item)"
        >
          确认入库
        </text>
      </view>
    </view>

    <view style="margin: 24rpx">
      <view class="btn-primary" @click="goCreate">＋ 新建采收</view>
    </view>
    <view style="margin: 0 24rpx 40rpx">
      <view style="display: flex; gap: 20rpx">
        <view class="btn-ghost" style="flex: 1" @click="goBlockCheck">休药期对比</view>
        <view class="btn-ghost" style="flex: 1" @click="goInventory">库存概览</view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { inboundHarvest, listHarvests } from '@/api/production'
import { currentFarm, ensureLogin } from '@/utils/auth-helper'
import { fmtDate, fmtNumber, INBOUND_STATUS_COLOR, INBOUND_STATUS_LABEL } from '@/utils/format'

/** 入库状态 Tab：全部 / 待入库 / 已入库 / 已出库 */
const tabs = [
  { key: 'all', label: '全部', status: undefined as number | undefined },
  { key: 'pending', label: '待入库', status: 0 },
  { key: 'in', label: '已入库', status: 1 },
  { key: 'out', label: '已出库', status: 2 },
]

const activeTab = ref('all')
const harvests = ref<any[]>([])
/** 不做筛选的全量批次，用于本月概览（与 Tab 无关） */
const allBatches = ref<any[]>([])
const error = ref('')

const inboundLabel = (status: any): string => INBOUND_STATUS_LABEL[Number(status ?? 0)] ?? '—'
const inboundColor = (status: any): string => INBOUND_STATUS_COLOR[Number(status ?? 0)] ?? '#8c8c8c'

const monthLabel = computed(() => new Date().toISOString().slice(0, 7))

/** 本月概览：只统计 harvestDate 落在当月的记录 */
const monthStats = computed(() => {
  const month = monthLabel.value
  const rows = allBatches.value.filter((item) => String(item.harvestDate ?? '').startsWith(month))
  const qty = rows.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0)
  return {
    count: rows.length,
    qty: rows.length > 0 ? fmtNumber(qty) : '—',
    pending: rows.filter((item) => Number(item.inboundStatus ?? 0) === 0).length,
  }
})

async function load(): Promise<void> {
  error.value = ''
  const farm = currentFarm()
  if (!farm) {
    error.value = '当前账号未关联农场，请到「我的」页选择农场'
    return
  }
  try {
    const tab = tabs.find((item) => item.key === activeTab.value)
    const [filtered, all] = await Promise.all([
      listHarvests({ farmId: farm.farmId, inboundStatus: tab?.status, pageSize: 50 }),
      activeTab.value === 'all'
        ? Promise.resolve(null)
        : listHarvests({ farmId: farm.farmId, pageSize: 50 }),
    ])
    harvests.value = filtered.list
    allBatches.value = activeTab.value === 'all' ? filtered.list : (all?.list ?? [])
  } catch (err: any) {
    error.value = err?.message ?? '采收列表加载失败'
  }
}

function switchTab(key: string): void {
  activeTab.value = key
  void load()
}

/** 确认入库：数量默认取批次数量，仓库默认「主仓库」（后端默认值，此处显式给出便于日后允许改） */
function confirmInbound(item: any): void {
  uni.showModal({
    title: '确认入库',
    content: `将 ${fmtNumber(item.quantity, item.unit)} 的「${item.cropName ?? item.batchNo}」入库到主仓库？`,
    success: async (res) => {
      if (!res.confirm) return
      try {
        await inboundHarvest(String(item.batchId), {
          quantity: Number(item.quantity ?? 0),
          unit: item.unit,
          warehouseName: item.warehouseName || '主仓库',
        })
        uni.showToast({ title: '已入库', icon: 'success' })
        void load()
      } catch (err: any) {
        uni.showToast({ title: err?.message ?? '入库失败', icon: 'none' })
      }
    },
  })
}

const goDetail = (batchId: string): void => {
  uni.navigateTo({ url: `/pages/harvests/detail?id=${batchId}` })
}
const goCreate = (): void => {
  uni.navigateTo({ url: '/pages/harvests/create' })
}
const goInventory = (): void => {
  uni.navigateTo({ url: '/pages/inventory/inventory' })
}

/** PRD §10.3：多地块休药期状态对比（服务端一次查多块地） */
const goBlockCheck = (): void => {
  uni.navigateTo({ url: '/pages/food-safety/harvest-block' })
}

onShow(() => {
  if (!ensureLogin()) return
  void load()
})
</script>
