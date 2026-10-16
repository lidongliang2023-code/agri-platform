<template>
  <view class="page">
    <!-- 农场切换 + 搜索 -->
    <view class="card" style="margin-bottom: 0">
      <picker mode="selector" :range="farmNames" @change="onFarmChange">
        <view class="row">
          <text class="strong">{{ farm ? farm.farmName : '请选择农场' }}</text>
          <text class="muted">{{ plots.length }} 个地块 ▾</text>
        </view>
      </picker>
      <view class="divider" />
      <input v-model="keyword" class="input" style="text-align: left" placeholder="搜索地块名称 / 编号" @confirm="load" />
      <view class="divider" />
      <view class="btn-ghost" @click="goCreate">＋ 新增地块</view>
    </view>

    <view v-if="error" class="error-box">{{ error }}</view>
    <view v-if="!error && plots.length === 0" class="empty">该农场暂无地块</view>

    <view
      v-for="plot in plots"
      :key="plot.plotId"
      class="card"
      @click="goDetail(plot.plotId)"
    >
      <view class="row">
        <text class="strong">{{ plot.plotName }}</text>
        <text class="tag" :style="{ color: plot.status === 1 ? '#13a05a' : '#8c8c8c' }">
          {{ plot.status === 1 ? '种植中' : '停用 / 闲置' }}
        </text>
      </view>
      <view class="muted" style="margin-top: 8rpx">
        {{ plot.plotCode || '—' }} · {{ plot.area ?? '—' }} 亩 · 土壤 {{ plot.soilType || '—' }}
      </view>
      <view class="muted" style="margin-top: 4rpx">
        作物 {{ plot.currentCrop || plot.cropName || '—' }}{{ plot.cropVariety ? `（${plot.cropVariety}）` : '' }} ·
        灌溉 {{ plot.irrigationType || '—' }}
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { listPlots } from '@/api/production'
import { currentFarm, ensureLogin, listFarms, setCurrentFarm } from '@/utils/auth-helper'
import type { FarmBrief } from '@/utils/auth'

const farms = ref<FarmBrief[]>([])
const farm = ref(currentFarm())
const plots = ref<any[]>([])
const keyword = ref('')
const error = ref('')

const farmNames = computed(() => farms.value.map((item) => item.farmName))

/** 地块列表字段归一化：后端 id / plotId 两种键都出现过 */
function normalizePlot(row: any): any {
  return { ...row, plotId: String(row.plotId ?? row.id ?? '') }
}

/** 拉地块：没有当前农场时先补一个（登录后没选农场的兜底） */
async function load(): Promise<void> {
  error.value = ''
  try {
    if (farms.value.length === 0) {
      farms.value = await listFarms()
    }
    if (!farm.value && farms.value.length > 0) {
      farm.value = farms.value[0]
      setCurrentFarm(farm.value)
    }
    if (!farm.value) {
      error.value = '当前账号未关联农场'
      return
    }
    const page = await listPlots({
      farmId: farm.value.farmId,
      plotName: keyword.value || undefined,
      pageSize: 50,
    })
    plots.value = page.list.map(normalizePlot)
  } catch (err: any) {
    error.value = err?.message ?? '地块加载失败'
  }
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

onShow(() => {
  if (!ensureLogin()) return
  farm.value = currentFarm()
  void load()
})
</script>
