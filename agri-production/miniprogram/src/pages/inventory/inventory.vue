<template>
  <view class="page">
    <view class="card">
      <input v-model="keyword" class="input" style="text-align: left" placeholder="搜索品名 / 批次号" @confirm="load" />
    </view>

    <view v-if="error" class="error-box">{{ error }}</view>
    <view v-if="!error && rows.length === 0" class="empty">暂无库存记录</view>

    <view v-for="row in rows" :key="row.inventoryId ?? row.id" class="card">
      <view class="row">
        <text class="strong">{{ row.productName || row.category || '未命名' }}</text>
        <text class="tag" :style="{ color: healthColor(row) }">{{ healthLabel(row) }}</text>
      </view>
      <view class="muted" style="margin-top: 8rpx">
        批次 {{ row.batchNo || '—' }} · 仓库 {{ row.warehouseName || '—' }}
      </view>
      <view class="muted" style="margin-top: 4rpx">
        当前库存 {{ fmtNumber(row.currentQty, row.unit) }}
        <text v-if="row.safeQty !== null && row.safeQty !== undefined"> · 安全库存 {{ fmtNumber(row.safeQty, row.unit) }}</text>
        · 有效期至 {{ fmtDate(row.expireDate) }}
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { listInventory } from '@/api/production'
import { ensureLogin } from '@/utils/auth-helper'
import { daysBetween, fmtDate, fmtNumber, today } from '@/utils/format'

const rows = ref<any[]>([])
const keyword = ref('')
const error = ref('')

/**
 * 健康状态：优先用后端返回的 healthStatus；没有就用"安全库存 / 有效期"这两个**真实字段**判，
 * 两个都缺时显示「—」而不是编一个"正常"。
 */
function healthLabel(row: any): string {
  const backend = row.healthStatus
  if (backend === 'normal') return '正常'
  if (backend === 'low') return '库存不足'
  if (backend === 'expiring') return '临期'
  if (backend === 'expired') return '已过期'
  const safe = Number(row.safeQty ?? NaN)
  const current = Number(row.currentQty ?? NaN)
  if (Number.isFinite(safe) && Number.isFinite(current) && current < safe) return '低于安全库存'
  const remain = row.expireDate ? daysBetween(today(), String(row.expireDate)) : null
  if (remain !== null && remain < 0) return '已过期'
  if (remain !== null && remain <= 30) return '临期'
  return '—'
}

function healthColor(row: any): string {
  const label = healthLabel(row)
  if (label === '正常') return '#13a05a'
  if (label === '—') return '#8c8c8c'
  return label === '临期' ? '#fa8c16' : '#cf1322'
}

async function load(): Promise<void> {
  error.value = ''
  try {
    const page = await listInventory({ keyword: keyword.value || undefined, pageSize: 50 })
    rows.value = page.list
  } catch (err: any) {
    error.value = err?.message ?? '库存加载失败'
  }
}

onShow(() => {
  if (!ensureLogin()) return
  void load()
})
</script>
