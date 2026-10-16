<template>
  <view class="page">
    <view v-if="error" class="error-box">{{ error }}</view>

    <view class="card">
      <view class="card-title"><text>🍅 基本信息</text></view>
      <view class="field"><text class="field-label">地块名称</text><text class="field-value">{{ plot.plotName || '—' }}</text></view>
      <view class="field"><text class="field-label">地块编号</text><text class="field-value">{{ plot.plotCode || '—' }}</text></view>
      <view class="field"><text class="field-label">面积</text><text class="field-value">{{ fmtNumber(plot.area, '亩') }}</text></view>
      <view class="field"><text class="field-label">土壤类型</text><text class="field-value">{{ plot.soilType || '—' }}</text></view>
      <view class="field"><text class="field-label">灌溉方式</text><text class="field-value">{{ plot.irrigationType || '—' }}</text></view>
      <view class="field"><text class="field-label">当前作物</text><text class="field-value">{{ plot.currentCrop || '—' }}</text></view>
      <view class="field"><text class="field-label">作物品种</text><text class="field-value">{{ plot.cropVariety || '—' }}</text></view>
      <view class="field"><text class="field-label">种植日期</text><text class="field-value">{{ fmtDate(plot.plantingDate) }}</text></view>
      <view class="field" style="border-bottom: none">
        <text class="field-label">预计采收</text><text class="field-value">{{ fmtDate(plot.expectedHarvestDate) }}</text>
      </view>
    </view>

    <view class="card">
      <view class="card-title"><text>🌡️ 最近土壤记录</text></view>
      <view v-if="!soil" class="muted">该地块暂无土壤检测记录（接口未返回则显示为空，不补默认值）</view>
      <view v-else class="grid">
        <view class="grid-cell"><text class="strong">{{ fmtNumber(soil.soilPh) }}</text><text class="muted">pH</text></view>
        <view class="grid-cell"><text class="strong">{{ fmtNumber(soil.organicMatter) }}</text><text class="muted">有机质</text></view>
        <view class="grid-cell"><text class="strong">{{ fmtNumber(soil.moisture) }}</text><text class="muted">水分%</text></view>
      </view>
    </view>

    <view class="card">
      <view class="card-title">
        <text>📋 最近农事记录（{{ tasks.length }}）</text>
        <text class="link" @click="goTasks">查看全部 →</text>
      </view>
      <view v-if="tasks.length === 0" class="muted">该地块暂无农事任务</view>
      <view v-for="task in tasks.slice(0, 5)" :key="task.taskId" class="field">
        <text class="field-label">{{ fmtDate(task.planStartDate) }}</text>
        <text class="field-value">{{ task.taskName }} · {{ taskStatusLabel(task.status) }}</text>
      </view>
    </view>

    <view class="card">
      <view class="card-title"><text>💊 本季投入品使用（按真实记录汇总）</text></view>
      <view v-if="usageStats.length === 0" class="muted">该地块暂无投入品使用记录</view>
      <view v-for="item in usageStats" :key="item.name" class="field">
        <text class="field-label">{{ item.name }}</text>
        <text class="field-value">{{ fmtNumber(item.qty, item.unit) }} · {{ item.count }} 次</text>
      </view>
      <view class="muted" style="margin-top: 12rpx">投入成本后端未提供该口径的汇总接口，故不展示金额。</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getPlot, latestSoil, listInputUsages, listTasks } from '@/api/production'
import { fmtDate, fmtNumber, TASK_STATUS_LABEL } from '@/utils/format'

const plotId = ref('')
const plot = ref<Record<string, any>>({})
const soil = ref<any | null>(null)
const tasks = ref<any[]>([])
const usages = ref<any[]>([])
const error = ref('')

const taskStatusLabel = (status: any): string => TASK_STATUS_LABEL[String(status)] ?? String(status ?? '—')

/** 投入品使用按投入品名聚合（地块详情要的是"本季用了多少"，聚合在前端做） */
const usageStats = computed(() => {
  const map = new Map<string, { name: string; qty: number; unit: string; count: number }>()
  usages.value.forEach((usage) => {
    const name = usage.inputName ?? '未命名投入品'
    const current = map.get(name) ?? { name, qty: 0, unit: usage.unit ?? '', count: 0 }
    current.qty += Number(usage.dosage ?? 0)
    current.count += 1
    if (!current.unit && usage.unit) current.unit = usage.unit
    map.set(name, current)
  })
  return [...map.values()]
})

async function load(): Promise<void> {
  error.value = ''
  try {
    const [plotDetail, soilRecord, taskPage, usagePage] = await Promise.all([
      getPlot(plotId.value),
      latestSoil(plotId.value),
      listTasks({ plotId: plotId.value, pageSize: 20 }),
      listInputUsages({ plotId: plotId.value, pageSize: 50 }),
    ])
    plot.value = plotDetail ?? {}
    soil.value = soilRecord
    tasks.value = taskPage.list
    usages.value = usagePage.list
  } catch (err: any) {
    error.value = err?.message ?? '地块详情加载失败'
  }
}

function goTasks(): void {
  uni.switchTab({ url: '/pages/tasks/tasks' })
}

onLoad((options) => {
  plotId.value = String(options?.id ?? '')
  void load()
})
</script>
