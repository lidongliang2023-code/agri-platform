<template>
  <view class="page">
    <button class="btn-ghost" @click="openReview()">复盘与跟进清单</button>
    <view class="page-intro">当前农场的风险提醒会在这里集中展示，点击卡片查看处理建议。</view>


    <view v-for="alert in alerts" :key="alert.alertId ?? alert.id" class="card" @click="showDetail(alert)">
      <view class="row">
        <text class="strong">{{ alert.alertTitle ?? alert.title ?? alert.alertType ?? '告警' }}</text>
        <text class="tag" :style="{ color: alertLevelColor(alert.alertLevel ?? alert.severity ?? alert.level) }">
          {{ alertLevelLabel(alert.alertLevel ?? alert.severity ?? alert.level) }}
        </text>
      </view>
      <view class="muted" style="margin-top: 8rpx">
        {{ alert.plotName ?? alert.farmName ?? '—' }} · {{ fmtDateTime(alert.triggeredAt ?? alert.alertTime ?? alert.createdAt) }}
      </view>
      <view class="alert-content">{{ alert.alertContent ?? alert.content ?? alert.message ?? '—' }}</view>
      <view class="muted">{{ stateLabels[Number(alert.status)] || '未知状态' }}</view>
      <view class="alert-actions" @click.stop><button v-if="[3,4].includes(Number(alert.status))" class="btn-ghost btn-sm" @click="openReview(alert.alertId)">复盘记录</button><button v-if="Number(alert.status) === 1" :disabled="handling" class="btn-ghost btn-sm" @click="handle(alert, 2)">转处理中</button><button v-if="Number(alert.status) === 2" :disabled="handling" class="btn-primary btn-sm" @click="handle(alert, 3)">标记已处理</button><button v-if="Number(alert.status) === 1" :disabled="handling" class="btn-danger btn-sm" @click="handle(alert, 4)">忽略</button></view>
    </view>
    <mobile-list-state :loading="loading" :error="error" :count="alerts.length" :total="total" :has-more="hasMore" empty-text="当前农场暂无告警" @retry="retry" @more="more" />
  </view>
</template>

<script setup lang="ts">
import { ensureWorkspaceSession, isProductionOps } from '@/utils/workspace'
import { productionContextVersion } from '@/utils/request'
import MobileListState from '@/components/mobile-list-state/mobile-list-state.vue'
import { useMobileList } from '@/composables/use-mobile-list'

import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { handleAlert, listAlerts } from '@/api/production'
import { ensureLogin, resolveCurrentFarm } from '@/utils/auth-helper'
import { fmtDateTime } from '@/utils/format'


const { rows: alerts, loading, error, total, hasMore, reload: load, more, retry, cancel } = useMobileList(async (pageNum, pageSize) => {
  if (!await ensureWorkspaceSession() || isProductionOps()) throw new Error('请切换到用户端查看告警')
  const farm = await resolveCurrentFarm()
  if (!farm) throw new Error('请在「我的」选择农场')
  return listAlerts({ farmId: farm.farmId, pageNum, pageSize })
}, row => String(row.alertId ?? row.id))

function openReview(id?:string){uni.navigateTo({url:'/pages/alerts/review'+(id?'?alertId='+encodeURIComponent(id):'')})}
const handling = ref(false)
const stateLabels: Record<number, string> = { 1: '未处理', 2: '处理中', 3: '已处理', 4: '已忽略' }
function alertLevelLabel(value: unknown): string { return ({1:'提示',2:'一般',3:'严重',4:'紧急'} as Record<number,string>)[Number(value)] || '未知级别' }
function alertLevelColor(value: unknown): string { return ({1:'#14512a',2:'#8f4500',3:'#d4380d',4:'#cf1322'} as Record<number,string>)[Number(value)] || '#666666' }
async function handle(alert: any, status: number): Promise<void> {
  if (handling.value) return
  const previous = Number(alert.status)
  if (!(previous === 1 && [2,4].includes(status) || previous === 2 && status === 3)) return
  const id = String(alert.alertId ?? alert.id ?? '')
  if (!id) return
  const context = productionContextVersion()
  handling.value = true
  try {
    const title = status === 2 ? '转为处理中' : status === 3 ? '标记已处理' : '忽略告警'
    const result = await new Promise<{ confirm: boolean; content?: string }>((resolve) => uni.showModal({ title, editable: true, placeholderText: '请填写处理说明（必填）', success: resolve, fail: () => resolve({ confirm: false }) }))
    if (!result.confirm) return
    const remark = String(result.content || '').trim()
    if (!remark) throw new Error('请填写处理说明')
    if (context !== productionContextVersion() || isProductionOps()) throw new Error('经营主体已切换，请重新打开告警')
    await handleAlert(id, status, remark)
    if (context !== productionContextVersion()) return
    uni.showToast({ title: '已更新', icon: 'success' })
    await load()
  } catch (err: any) { uni.showToast({ title: err?.message ?? '处置失败', icon: 'none' }) }
  finally { handling.value = false }
}
function showDetail(alert: any): void {
  uni.showModal({
    title: alert.alertTitle ?? alert.title ?? '告警详情',
    content: `${alert.alertContent ?? alert.content ?? '—'}\n\n状态：${stateLabels[Number(alert.status)] || '未知'}\n处置时间：${fmtDateTime(alert.handledAt)}\n处理记录：${alert.handleRemark || '暂无处置记录'}`,
    showCancel: false,
  })
}

onShow(async () => {
  cancel(); alerts.value = []
  if (!await ensureWorkspaceSession() || isProductionOps()) return
  void load()
})
</script>

<style scoped>
.alert-content { margin-top: 10rpx; color: #26352c; line-height: 1.55; }
.alert-actions { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 18rpx; }
.btn-danger { color: #c0392b; border: 1rpx solid #efc3bd; background: #fff7f5; }
</style>
