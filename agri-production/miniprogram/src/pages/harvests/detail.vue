<template>
  <view class="page detail-page">
    <view v-if="loading" class="empty">正在加载详情…</view>
    <view v-else-if="error" class="error-box">{{ error }}<button class="btn-ghost" @click="load">重新加载</button></view>
    <template v-else-if="ready">

    <view class="card">
      <view class="row">
        <text class="strong" style="font-size: 32rpx">{{ batch.batchNo || '采收详情' }}</text>
        <text class="tag" :style="{ color: inboundColor(batch.inboundStatus) }">
          {{ inboundLabel(batch.inboundStatus) }}
        </text>
      </view>
      <view class="divider" />
      <view class="field" @click="goPlot">
        <text class="field-label">地块</text>
        <text class="field-value link">{{ batch.plotName || batch.plotId || '—' }}</text>
      </view>
      <view class="field"><text class="field-label">作物</text><text class="field-value">{{ batch.cropName || '—' }}{{ batch.cropVariety ? `（${batch.cropVariety}）` : '' }}</text></view>
      <view class="field"><text class="field-label">采收日期</text><text class="field-value">{{ fmtDate(batch.harvestDate) }}</text></view>
      <view class="field"><text class="field-label">采收数量</text><text class="field-value">{{ fmtNumber(batch.quantity, batch.unit) }}</text></view>
      <view class="field"><text class="field-label">质量等级</text><text class="field-value">{{ batch.grade || '—' }}</text></view>
      <view class="field"><text class="field-label">采收人</text><text class="field-value">{{ batch.operatorName || '—' }}</text></view>
      <view class="field" style="border-bottom: none">
        <text class="field-label">备注</text><text class="field-value">{{ batch.remark || '—' }}</text>
      </view>
    </view>

    <view class="card">
      <view class="card-title"><text>📦 入库信息</text></view>
      <view class="field"><text class="field-label">仓库</text><text class="field-value">{{ batch.warehouseName || '未入库' }}</text></view>
      <view class="field"><text class="field-label">入库状态</text><text class="field-value">{{ inboundLabel(batch.inboundStatus) }}</text></view>
      <view class="field"><text class="field-label">累计入库</text><text class="field-value">{{ fmtNumber(entered, batch.unit) }}</text></view>
      <view class="field"><text class="field-label">剩余可入库</text><text class="field-value">{{ fmtNumber(remaining, batch.unit) }}</text></view>
      <view class="field" style="border-bottom: none">
        <text class="field-label">更新时间</text><text class="field-value">{{ fmtDateTime(batch.updatedAt) }}</text>
      </view>
    </view>

    <view class="card">
      <view class="card-title"><text>🔗 溯源码</text></view>
      <view v-if="!batch.traceCode" class="muted">尚未生成溯源码</view>
      <view v-else class="row">
        <text class="strong">{{ batch.traceCode }}</text>
        <text class="link" @click="goTrace">查看链路 →</text>
      </view>
    </view>

    <view class="mobile-action-bar" :class="{ busy: acting }">
      <view
        v-if="remaining > 0"
        class="btn-primary"
        style="flex: 1"
        @click="confirmInbound"
      >
        {{ entered > 0 ? '继续入库' : '确认入库' }}
      </view>
      <view
        v-if="!batch.traceCode"
        class="btn-ghost"
        style="flex: 1"
        @click="genTrace"
      >
        生成溯源码
      </view>
    </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { generateHarvestBatch, getHarvest, inboundHarvest, harvestInboundProgress } from '@/api/production'
import { fmtDate, fmtDateTime, fmtNumber, INBOUND_STATUS_COLOR, INBOUND_STATUS_LABEL } from '@/utils/format'

const batchId = ref('')
const batch = ref<Record<string, any>>({})
const error = ref('')
const loading = ref(false)
const ready = ref(false)
const acting = ref(false)
const entered = ref(0)
const remaining = ref(0)

const inboundLabel = (status: any): string => INBOUND_STATUS_LABEL[Number(status ?? 0)] ?? '—'
const inboundColor = (status: any): string => INBOUND_STATUS_COLOR[Number(status ?? 0)] ?? '#666666'

async function load(): Promise<void> {
  if (!batchId.value) { error.value = '缺少记录编号，请返回列表重新打开'; return }
  loading.value = true; ready.value = false
  error.value = ''
  try {
    batch.value = (await getHarvest(batchId.value)) ?? {}
    const progress = await harvestInboundProgress(batch.value)
    entered.value = progress.entered
    remaining.value = progress.remaining
    ready.value = Boolean(batch.value.batchId || batch.value.id)
    if (!ready.value) throw new Error('采收记录不存在或无权访问')
  } catch (err: any) {
    error.value = err?.message ?? '采收详情加载失败'
  } finally { loading.value = false }
}

function confirmInbound(): void {
  if (acting.value || !ready.value || remaining.value <= 0) return
  acting.value = true
  uni.showModal({
    title: '确认入库',
    content: `将剩余 ${fmtNumber(remaining.value, batch.value.unit)} 入库到「${batch.value.warehouseName || '主仓库'}」？`,
    success: async (res) => {
      if (!res.confirm) { acting.value = false; return }
      try {
        await inboundHarvest(batchId.value, {
          quantity: remaining.value,
          unit: batch.value.unit,
          warehouseName: batch.value.warehouseName || '主仓库',
        })
        uni.showToast({ title: '已入库', icon: 'success' })
        await load()
      } catch (err: any) {
        uni.showToast({ title: err?.message ?? '入库失败', icon: 'none' })
      } finally { acting.value = false }
    },
    fail: () => { acting.value = false },
  })
}

async function genTrace(): Promise<void> {
  if (acting.value || !ready.value) return
  acting.value = true
  try {
    await generateHarvestBatch(batchId.value, {})
    uni.showToast({ title: '溯源码已生成', icon: 'success' })
    await load()
  } catch (err: any) {
    uni.showToast({ title: err?.message ?? '生成失败', icon: 'none' })
  } finally { acting.value = false }
}

function goPlot(): void {
  if (!batch.value.plotId) return
  uni.navigateTo({ url: `/pages/plots/detail?id=${batch.value.plotId}` })
}

function goTrace(): void {
  uni.navigateTo({ url: `/pages/trace/scan?code=${batch.value.traceCode}` })
}

onLoad((options) => {
  batchId.value = String(options?.id ?? '')
  void load()
})
</script>
