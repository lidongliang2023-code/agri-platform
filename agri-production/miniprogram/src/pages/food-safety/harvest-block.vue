<template>
  <view class="page">
    <!-- 日期可调：换一天重新校验，这是"调整日期"那条交互 -->
    <view class="card">
      <picker mode="date" :value="plannedDate" @change="onDateChange">
        <view class="field" style="border-bottom: none">
          <text class="field-label">计划采收日期</text>
          <text class="field-value">{{ plannedDate }} ▾</text>
        </view>
      </picker>
      <view class="row" style="margin-top: 8rpx">
        <text class="muted">共 {{ results.length }} 块地 · ✅ {{ counts.pass }} / ⏳ {{ counts.block }} / ？ {{ counts.unknown }}</text>
        <text class="link" @click="onlyPass = !onlyPass">{{ onlyPass ? '显示全部' : '仅看合格' }}</text>
      </view>
    </view>

    <view v-if="error" class="error-box">{{ error }}</view>
    <view v-else-if="loading" class="empty">正在向服务端校验…</view>
    <view v-else-if="visibleResults.length === 0" class="empty">
      {{ onlyPass ? '没有可采收的地块（调整日期看看）' : '该农场暂无可校验的地块' }}
    </view>

    <view v-for="row in visibleResults" :key="row.plotId" class="card">
      <view class="row">
        <text class="strong">{{ row.plotName }}</text>
        <text class="tag" :style="{ color: statusMeta(row).color }">{{ statusMeta(row).label }}</text>
      </view>
      <view class="muted" style="margin-top: 8rpx">
        <text v-if="row.dataComplete">最早可采收 {{ row.earliestHarvestDate }}{{ row.daysRemaining > 0 ? '（还需 ' + row.daysRemaining + ' 天）' : '（已过休药期）' }}</text>
        <text v-else>{{ row.note || '没有带安全间隔期的用药记录' }}</text>
      </view>
      <view v-if="row.lastApplication" class="muted" style="margin-top: 4rpx">
        依据：{{ row.lastApplication.applicationDate }} 使用「{{ row.lastApplication.productName }}」，安全间隔期 {{ row.lastApplication.preHarvestIntervalDays }} 天
      </view>
      <view class="row" style="margin-top: 16rpx">
        <text class="muted">{{ row.plotId }}</text>
        <text v-if="row.checkResult !== 'block'" class="btn-primary btn-sm" @click="goHarvest(row)">为这块地登记采收</text>
      </view>
    </view>

    <view class="muted" style="text-align: center; padding: 0 40rpx 24rpx">
      判定来自服务端（GET /food-safety/pre-harvest-check?plotIds=…），与新建采收页、PC 端同一份规则。
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { listPlots, preHarvestCheck } from '@/api/production'
import { currentFarm, ensureLogin } from '@/utils/auth-helper'
import { today } from '@/utils/format'

const plannedDate = ref(today())
const results = ref<any[]>([])
const loading = ref(false)
const error = ref('')
/** 只看合格（PRD §10.3 的「仅采收合格地块」） */
const onlyPass = ref(false)

const visibleResults = computed(() =>
  onlyPass.value ? results.value.filter((row) => row.checkResult !== 'block') : results.value,
)

const counts = computed(() => ({
  pass: results.value.filter((row) => row.checkResult !== 'block' && row.dataComplete !== false).length,
  block: results.value.filter((row) => row.checkResult === 'block').length,
  unknown: results.value.filter((row) => row.dataComplete === false).length,
}))

const STATUS_META: Record<string, { label: string; color: string }> = {
  pass: { label: '✅ 可采收', color: '#13a05a' },
  block: { label: '❌ 休药期内', color: '#cf1322' },
  unknown: { label: '⚠️ 无用药记录', color: '#8c8c8c' },
}

function statusMeta(row: any): { label: string; color: string } {
  if (row.checkResult === 'block') return STATUS_META.block
  if (row.dataComplete === false) return STATUS_META.unknown
  return STATUS_META.pass
}

/** 拉本农场地块 → 一次查多块地的休药期（服务端支持 plotIds） */
async function load(): Promise<void> {
  error.value = ''
  const farm = currentFarm()
  if (!farm) {
    error.value = '当前账号未关联农场，请到「我的」页选择农场'
    return
  }
  loading.value = true
  try {
    const page = await listPlots({ farmId: farm.farmId, pageSize: 100 })
    const plots = page.list.map((plot: any) => ({
      plotId: String(plot.plotId ?? plot.id ?? ''),
      plotName: plot.plotName,
    }))
    if (plots.length === 0) {
      results.value = []
      return
    }
    const data = await preHarvestCheck({
      plotIds: plots.map((plot) => plot.plotId).join(','),
      plannedHarvestDate: plannedDate.value,
    })
    const nameOf = new Map(plots.map((plot) => [plot.plotId, plot.plotName]))
    results.value = (data?.plots ?? []).map((row: any) => ({
      ...row,
      plotName: nameOf.get(String(row.plotId)) ?? String(row.plotId),
    }))
  } catch (err: any) {
    error.value = err?.message ?? '休药期校验失败'
  } finally {
    loading.value = false
  }
}

function onDateChange(event: any): void {
  plannedDate.value = String(event.detail.value)
  void load()
}

/** 带着地块去新建采收（那边会预选并再校验一次） */
function goHarvest(row: any): void {
  uni.navigateTo({ url: '/pages/harvests/create?plotId=' + row.plotId })
}

onShow(() => {
  if (!ensureLogin()) return
  void load()
})
</script>
