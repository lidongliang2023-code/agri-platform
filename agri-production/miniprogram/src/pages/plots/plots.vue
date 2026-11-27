<template>
  <view class="page"><view class="toolbar"><button class="btn-ghost btn-sm" @click="goExport">导出筛选结果</button><button class="btn-ghost btn-sm" @click="goImport">导入地块 CSV</button></view>
    <!-- 农场切换 + 搜索 + 主操作：集中在一个移动工具栏内 -->
    <view class="card plot-toolbar">
      <picker mode="selector" :range="farmNames" @change="onFarmChange">
        <view class="farm-picker"><text class="strong">{{ farm ? farm.farmName : '请选择农场' }}</text><text class="field-arrow">⌄</text></view>
      </picker>
      <view class="search-inline"><text class="search-icon">⌕</text><input v-model="keyword" placeholder="搜索地块名称" confirm-type="search" @confirm="load" /><text v-if="keyword" class="link" @click="keyword = ''; load()">清除</text></view>
      <view class="toolbar-actions"><text class="muted">已加载 {{ plots.length }} / {{ total }} 个地块</text><view class="btn-primary btn-sm" @click="goCreate">＋ 新增地块</view></view>
    </view>



    <view
      v-for="plot in plots"
      :key="plot.plotId"
      class="card"
      @click="goDetail(plot.plotId)"
    >
      <view class="row">
        <text class="strong">{{ plot.plotName }}</text>
        <text class="tag" :style="{ color: plot.status === 1 ? '#1e6b38' : '#666666' }">
          {{ plot.status === 1 ? '种植中' : '停用 / 闲置' }}
        </text>
      </view>
      <view class="plot-meta">{{ plot.plotCode || '—' }} · {{ plot.area ?? '—' }} 亩 · 土壤 {{ plot.soilType || '—' }}</view>
      <view class="plot-meta secondary">作物 {{ plot.currentCrop || plot.cropName || '—' }}{{ plot.cropVariety ? `（${plot.cropVariety}）` : '' }} · 灌溉 {{ plot.irrigationType || '—' }}</view>
    </view>
    <mobile-list-state :loading="loading" :error="error" :count="plots.length" :total="total" :has-more="hasMore" empty-text="暂无匹配地块" @retry="retry" @more="more" />
    <view class="more-management"><button class="btn-ghost" @click="openWorkspace('/production/plots', true)">更多管理功能 ›</button><text class="muted">打开完整业务，可处理更多管理操作</text></view>
  </view>
</template>

<script setup lang="ts">
const goExport=()=>uni.navigateTo({url:'/pages/native/exports?kind=plots'})
const goImport=()=>uni.navigateTo({url:'/pages/native/import?kind=plots'})
import { openWorkspace, ensureWorkspaceSession, isProductionOps } from '@/utils/workspace'
import MobileListState from '@/components/mobile-list-state/mobile-list-state.vue'
import { useMobileList } from '@/composables/use-mobile-list'

import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { listPlots } from '@/api/production'
import { currentFarm, ensureLogin, listFarms, setCurrentFarm, resolveCurrentFarm } from '@/utils/auth-helper'
import type { FarmBrief } from '@/utils/auth'

const farms = ref<FarmBrief[]>([])
const farm = ref(currentFarm())

const keyword = ref('')
const { rows: plots, loading, error, total, hasMore, reload: load, more, retry, cancel } = useMobileList(async (pageNum, pageSize) => {
  if (!await ensureWorkspaceSession() || isProductionOps()) throw new Error('请切换到用户端查看地块')
  const current = await resolveCurrentFarm()
  if (!current) throw new Error('请在「我的」选择农场')
  farm.value = current
  const result = await listPlots({ farmId: current.farmId, plotName: keyword.value.trim() || undefined, pageNum, pageSize })
  return { ...result, list: result.list.map(normalizePlot) }
}, row => String(row.plotId ?? row.id))

const farmNames = computed(() => farms.value.map((item) => item.farmName))

/** 地块列表字段归一化：后端 id / plotId 两种键都出现过 */
function normalizePlot(row: any): any {
  return { ...row, plotId: String(row.plotId ?? row.id ?? '') }
}

/** 切换农场：写上下文并重查（地块是农场作用域） */
function onFarmChange(event: any): void {
  const index = Number(event.detail.value)
  const picked = farms.value[index]
  if (!picked) return
  farm.value = picked
  setCurrentFarm(picked)
  keyword.value = ''
  void load()
}

function goDetail(plotId: string): void {
  uni.navigateTo({ url: `/pages/plots/detail?id=${plotId}` })
}

function goCreate(): void {
  uni.navigateTo({ url: '/pages/plots/create' })
}

onShow(async () => {
  cancel(); plots.value = []; farms.value = []
  if (!await ensureWorkspaceSession() || isProductionOps()) return
  farm.value = currentFarm()
  void load()
  try { farms.value = await listFarms() } catch (e: any) { error.value = e?.message || '农场列表加载失败' }
})
</script>

<style scoped>
.plot-toolbar { padding: 22rpx; }
.farm-picker { display: flex; align-items: center; justify-content: space-between; min-height: 68rpx; padding: 0 4rpx 14rpx; border-bottom: 1rpx solid #e7eee9; }
.search-inline { display: flex; align-items: center; gap: 12rpx; min-height: 78rpx; border-bottom: 1rpx solid #e7eee9; }
.search-inline input { flex: 1; min-width: 0; font-size: 27rpx; }
.toolbar-actions { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; padding-top: 16rpx; }
.plot-meta { margin-top: 10rpx; font-size: 24rpx; color: #5b6b62; line-height: 1.45; }
.plot-meta.secondary { margin-top: 5rpx; color: #666666; }
</style>
