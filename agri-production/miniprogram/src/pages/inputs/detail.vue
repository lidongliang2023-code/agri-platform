<template>
  <view class="page">
    <view v-if="error" class="error-box">{{ error }}</view>

    <view class="card">
      <view class="card-title"><text>💊 {{ item.inputName || '投入品详情' }}</text></view>
      <view class="field"><text class="field-label">投入品类型</text><text class="field-value">{{ categoryLabel(item.inputType) }}</text></view>
      <view class="field"><text class="field-label">登记证号</text><text class="field-value">{{ item.registrationNo || '—' }}</text></view>
      <view class="field"><text class="field-label">生产厂家</text><text class="field-value">{{ item.manufacturer || '—' }}</text></view>
      <view class="field"><text class="field-label">规格 / 单位</text><text class="field-value">{{ item.spec || '—' }} / {{ item.unit || '—' }}</text></view>
      <view class="field"><text class="field-label">当前库存</text><text class="field-value">{{ fmtNumber(item.stockQty, item.unit) }}</text></view>
      <view class="field"><text class="field-label">安全间隔期</text><text class="field-value">{{ item.safetyInterval ?? '—' }} 天</text></view>
      <view class="field" style="border-bottom: none">
        <text class="field-label">状态</text>
        <text class="field-value">{{ item.status === 1 ? '启用' : '停用' }}</text>
      </view>
    </view>

    <view class="card">
      <view class="card-title"><text>⏳ 休药期状态（按最近一次使用推算）</text></view>
      <view v-if="!lastUsage" class="muted">该投入品暂无使用记录，无可推算的休药期</view>
      <template v-else>
        <view class="field"><text class="field-label">最近使用</text><text class="field-value">{{ fmtDate(lastUsage.usedAt) }} · {{ fmtNumber(lastUsage.dosage, lastUsage.unit) }}</text></view>
        <view class="field" style="border-bottom: none">
          <text class="field-label">最早可采收</text>
          <text class="field-value" :style="{ color: withdrawalColor }">{{ withdrawalText }}</text>
        </view>
      </template>
    </view>

    <view class="card">
      <view class="card-title"><text>📦 库存流水（{{ flows.length }}）</text></view>
      <view v-if="flows.length === 0" class="muted">暂无库存流水</view>
      <view v-for="flow in flows.slice(0, 10)" :key="flow.flowId ?? flow.id" class="field">
        <text class="field-label">{{ fmtDateTime(flow.createdAt ?? flow.flowTime) }}</text>
        <text class="field-value">{{ flowTypeLabel(flow.flowType) }} · {{ fmtNumber(flow.qty, flow.unit) }}</text>
      </view>
    </view>

    <view style="margin: 24rpx">
      <view class="btn-primary" @click="goScan">登记一次使用</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getInput, listInputStockFlows, listInputUsages } from '@/api/production'
import { addDays, daysBetween, fmtDate, fmtDateTime, fmtNumber, today } from '@/utils/format'

const CATEGORY_LABEL: Record<string, string> = {
  FERTILIZER: '肥料',
  PESTICIDE: '农药',
  SEED: '种苗',
  FEED: '饲料',
  VET: '兽药',
  OTHER: '其他',
}

const FLOW_TYPE_LABEL: Record<number, string> = {
  1: '入库',
  2: '领用',
  3: '退回',
  4: '盘盈',
  5: '盘亏',
  6: '报损',
}

const inputId = ref('')
const item = ref<Record<string, any>>({})
const usages = ref<any[]>([])
const flows = ref<any[]>([])
const error = ref('')

const categoryLabel = (type: string): string => CATEGORY_LABEL[type] ?? type ?? '其他'
const flowTypeLabel = (type: any): string => FLOW_TYPE_LABEL[Number(type)] ?? '—'

/** 最近一条使用记录（休药期推算基准） */
const lastUsage = computed(() =>
  usages.value
    .slice()
    .sort((a, b) => String(b.usedAt ?? '').localeCompare(String(a.usedAt ?? '')))[0] ?? null,
)

/** 最早可采收日 = 最近使用日 + 安全间隔期 */
const earliestHarvest = computed(() => {
  if (!lastUsage.value) return null
  const interval = Number(item.value.safetyInterval ?? lastUsage.value.safetyIntervalDays ?? 0)
  if (!interval) return null
  return addDays(String(lastUsage.value.usedAt), interval)
})

const withdrawalText = computed(() => {
  if (!earliestHarvest.value) return '该投入品未登记安全间隔期，无法推算（不猜）'
  const remain = daysBetween(today(), earliestHarvest.value)
  if (remain === null) return earliestHarvest.value
  if (remain > 0) return `${earliestHarvest.value}（还有 ${remain} 天）`
  return `${earliestHarvest.value}（已过休药期）`
})

const withdrawalColor = computed(() => {
  if (!earliestHarvest.value) return '#fa8c16'
  const remain = daysBetween(today(), earliestHarvest.value)
  return remain !== null && remain > 0 ? '#cf1322' : '#13a05a'
})

function goScan(): void {
  uni.navigateTo({ url: '/pages/inputs/scan' })
}

async function load(): Promise<void> {
  error.value = ''
  try {
    const [detail, usagePage, flowPage] = await Promise.all([
      getInput(inputId.value),
      listInputUsages({ pageSize: 100 }),
      listInputStockFlows(inputId.value, 20),
    ])
    item.value = detail ?? {}
    // 使用记录接口不支持按投入品过滤，这里按 inputId 在本页过滤（口径是"该投入品的记录"）
    usages.value = usagePage.list.filter(
      (usage: any) => String(usage.inputId) === String(inputId.value),
    )
    flows.value = flowPage.list
  } catch (err: any) {
    error.value = err?.message ?? '投入品详情加载失败'
  }
}

onLoad((options) => {
  inputId.value = String(options?.id ?? '')
  void load()
})
</script>
