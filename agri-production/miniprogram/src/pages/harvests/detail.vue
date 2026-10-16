<template>
  <view class="page">
    <view v-if="error" class="error-box">{{ error }}</view>

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

    <view style="margin: 24rpx; display: flex; gap: 20rpx">
      <view
        v-if="Number(batch.inboundStatus ?? 0) === 0"
        class="btn-primary"
        style="flex: 1"
        @click="confirmInbound"
      >
        确认入库
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
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { generateHarvestBatch, getHarvest, inboundHarvest } from '@/api/production'
import { fmtDate, fmtDateTime, fmtNumber, INBOUND_STATUS_COLOR, INBOUND_STATUS_LABEL } from '@/utils/format'

const batchId = ref('')
const batch = ref<Record<string, any>>({})
const error = ref('')

const inboundLabel = (status: any): string => INBOUND_STATUS_LABEL[Number(status ?? 0)] ?? '—'
const inboundColor = (status: any): string => INBOUND_STATUS_COLOR[Number(status ?? 0)] ?? '#8c8c8c'

async function load(): Promise<void> {
  error.value = ''
  try {
    batch.value = (await getHarvest(batchId.value)) ?? {}
  } catch (err: any) {
    error.value = err?.message ?? '采收详情加载失败'
  }
}

function confirmInbound(): void {
  uni.showModal({
    title: '确认入库',
    content: `将 ${fmtNumber(batch.value.quantity, batch.value.unit)} 入库到主仓库？`,
    success: async (res) => {
      if (!res.confirm) return
      try {
        await inboundHarvest(batchId.value, {
          quantity: Number(batch.value.quantity ?? 0),
          unit: batch.value.unit,
          warehouseName: batch.value.warehouseName || '主仓库',
        })
        uni.showToast({ title: '已入库', icon: 'success' })
        void load()
      } catch (err: any) {
        uni.showToast({ title: err?.message ?? '入库失败', icon: 'none' })
      }
    },
  })
}

async function genTrace(): Promise<void> {
  try {
    await generateHarvestBatch(batchId.value, {})
    uni.showToast({ title: '溯源码已生成', icon: 'success' })
    void load()
  } catch (err: any) {
    uni.showToast({ title: err?.message ?? '生成失败', icon: 'none' })
  }
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
