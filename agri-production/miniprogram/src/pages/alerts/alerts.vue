<template>
  <view class="page">
    <view v-if="error" class="error-box">{{ error }}</view>
    <view v-if="!error && alerts.length === 0" class="empty">当前农场暂无告警</view>

    <view v-for="alert in alerts" :key="alert.alertId ?? alert.id" class="card" @click="showDetail(alert)">
      <view class="row">
        <text class="strong">{{ alert.alertTitle ?? alert.title ?? alert.alertType ?? '告警' }}</text>
        <text class="tag" :style="{ color: alertLevelColor(alert.severity ?? alert.level) }">
          {{ alertLevelLabel(alert.severity ?? alert.level) }}
        </text>
      </view>
      <view class="muted" style="margin-top: 8rpx">
        {{ alert.plotName ?? alert.farmName ?? '—' }} · {{ fmtDateTime(alert.alertTime ?? alert.createdAt) }}
      </view>
      <view style="margin-top: 8rpx">{{ alert.alertContent ?? alert.content ?? alert.message ?? '—' }}</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getAlert, listAlerts } from '@/api/production'
import { currentFarm, ensureLogin } from '@/utils/auth-helper'
import { alertLevelColor, alertLevelLabel, fmtDateTime } from '@/utils/format'

const alerts = ref<any[]>([])
const error = ref('')

async function load(): Promise<void> {
  error.value = ''
  const farm = currentFarm()
  if (!farm) {
    error.value = '当前账号未关联农场，请到「我的」页选择农场'
    return
  }
  try {
    const page = await listAlerts({ farmId: farm.farmId, pageSize: 50 })
    alerts.value = page.list
  } catch (err: any) {
    error.value = err?.message ?? '告警加载失败'
  }
}

// 点开看详情：优先拉详情接口，失败则回落到列表里已有的字段（不编内容）
async function showDetail(alert: any): Promise<void> {
  const alertId = String(alert.alertId ?? alert.id ?? '')
  let detail = alert
  if (alertId) {
    try {
      detail = await getAlert(alertId)
    } catch {
      detail = alert
    }
  }
  uni.showModal({
    title: detail.alertTitle ?? detail.title ?? '告警详情',
    content: `${detail.alertContent ?? detail.content ?? '—'}\n\n处理建议：${detail.suggestion ?? detail.handleAdvice ?? '—'}`,
    showCancel: false,
  })
}

onShow(() => {
  if (!ensureLogin()) return
  void load()
})
</script>
