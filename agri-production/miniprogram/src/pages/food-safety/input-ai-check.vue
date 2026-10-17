<template>
  <view class="page">
    <view class="card">
      <view class="card-title"><text>💊 投入品 AI 合规校验</text></view>
      <view class="row">
        <input v-model="keyword" class="input" style="text-align: left" placeholder="输入投入品名称 / 登记证号检索" @confirm="search" />
        <text class="btn-ghost btn-sm" @click="search">搜索</text>
      </view>
      <view class="muted" style="margin-top: 12rpx">
        这是"查一次合不合规"的检查页；真正登记使用请走「投入品录入」。
      </view>
      <view style="margin-top: 12rpx">
        <text class="link" @click="goScan">去登记一次使用 →</text>
      </view>
    </view>

    <view v-if="error" class="error-box">{{ error }}</view>
    <view v-if="searched && candidates.length === 0" class="empty">没有匹配的投入品</view>

    <view v-for="item in candidates" :key="item.inputId" class="card" @click="pick(item)">
      <view class="row">
        <text class="strong">{{ item.inputName }}</text>
        <text class="tag" style="color: #13a05a">{{ categoryLabel(item.inputType) }}</text>
      </view>
      <view class="muted" style="margin-top: 8rpx">
        库存 {{ fmtNumber(item.stockQty, item.unit) }} · 安全间隔期 {{ item.safetyInterval ?? '—' }} 天
      </view>
    </view>

    <template v-if="selected">
      <view class="card">
        <view class="card-title"><text>🧾 校验条件（{{ selected.inputName }}）</text></view>
        <picker mode="selector" :range="plotNames" @change="onPlotChange">
          <view class="field">
            <text class="field-label">使用地块</text>
            <text class="field-value">{{ plotLabel || '不指定（仅按投入品校验）' }}</text>
          </view>
        </picker>
        <view class="field" style="border-bottom: none">
          <text class="field-label">本次用量</text>
          <input v-model="dosage" class="input" type="digit" :placeholder="selected.unit || '如 2'" @blur="refresh" />
        </view>
      </view>

      <view class="card">
        <view class="card-title"><text>✅ 校验结果</text></view>
        <view v-if="loading" class="muted">正在校验…</view>
        <view v-else-if="checkError" class="error-box" style="margin: 0">{{ checkError }}</view>
        <template v-else-if="result">
          <view class="field">
            <text class="field-label">整体结论</text>
            <text class="field-value" :style="{ color: resultMeta(result.overall).color }">{{ resultMeta(result.overall).label }}</text>
          </view>
          <view v-for="item in items" :key="item.label" class="field">
            <text class="field-label">{{ item.label }}</text>
            <view class="field-value" style="text-align: right">
              <text :style="{ color: item.color }">{{ item.result }}</text>
              <view class="muted" style="margin-top: 4rpx">{{ item.detail }}</view>
            </view>
          </view>
          <view v-if="result.overall === 'BLOCK'" class="error-box" style="margin: 12rpx 0 0">
            已拦截。替代方案推荐：本部署没有可替代品主数据，未生成推荐（不编造替代用药）。
          </view>
        </template>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { complianceCheck, listInputs, listPlots } from '@/api/production'
import { currentFarm } from '@/utils/auth-helper'
import { fmtNumber } from '@/utils/format'

const CATEGORY_LABEL: Record<string, string> = {
  FERTILIZER: '肥料',
  PESTICIDE: '农药',
  SEED: '种苗',
  FEED: '饲料',
  VET: '兽药',
  OTHER: '其他',
}

const RESULT_META: Record<string, { label: string; color: string }> = {
  PASS: { label: '✅ 通过', color: '#13a05a' },
  WARNING: { label: '⚠️ 预警', color: '#fa8c16' },
  BLOCK: { label: '❌ 拦截', color: '#cf1322' },
  UNKNOWN: { label: '⬜ 未校验', color: '#8c8c8c' },
}

const keyword = ref('')
const searched = ref(false)
const candidates = ref<any[]>([])
const plots = ref<any[]>([])
const selected = ref<any | null>(null)
const plotId = ref('')
const dosage = ref('')
const result = ref<any | null>(null)
const loading = ref(false)
const error = ref('')
const checkError = ref('')

const plotNames = computed(() => plots.value.map((plot) => plot.plotName))
const plotLabel = computed(
  () => plots.value.find((plot) => String(plot.plotId) === String(plotId.value))?.plotName ?? '',
)
const resultMeta = (value: any) => RESULT_META[String(value)] ?? RESULT_META.UNKNOWN
const categoryLabel = (type: string): string => CATEGORY_LABEL[type] ?? type ?? '其他'

const items = computed(() => {
  const row = result.value
  if (!row) return [] as { label: string; result: string; detail: string; color: string }[]
  return [
    { key: 'compliance', label: '禁用清单' },
    { key: 'interaction', label: '复配交互' },
    { key: 'timing', label: '用药时机 / 休药期' },
    { key: 'cost', label: '成本替代' },
    { key: 'stock', label: '库存' },
  ].map(({ key, label }) => {
    const item = row[key] ?? {}
    const meta = resultMeta(item.result)
    return { label, result: meta.label, detail: String(item.detail ?? ''), color: meta.color }
  })
})

async function search(): Promise<void> {
  error.value = ''
  searched.value = true
  try {
    const page = await listInputs({ keyword: keyword.value || undefined, pageSize: 20 })
    candidates.value = page.list.map((row: any) => ({
      ...row,
      inputId: String(row.inputId ?? row.id ?? ''),
    }))
  } catch (err: any) {
    error.value = err?.message ?? '投入品查询失败'
  }
}

/** 选中投入品 → 立刻按当前条件校验一次 */
async function pick(item: any): Promise<void> {
  selected.value = item
  dosage.value = ''
  await refresh()
}

async function refresh(): Promise<void> {
  if (!selected.value) return
  loading.value = true
  checkError.value = ''
  try {
    result.value = await complianceCheck({
      inputId: selected.value.inputId,
      plotId: plotId.value || undefined,
      dosage: dosage.value ? Number(dosage.value) : undefined,
      unit: selected.value.unit,
    })
  } catch (err: any) {
    result.value = null
    checkError.value = err?.message ?? '校验失败'
  } finally {
    loading.value = false
  }
}

function onPlotChange(event: any): void {
  const plot = plots.value[Number(event.detail.value)]
  plotId.value = String(plot?.plotId ?? '')
  void refresh()
}

const goScan = (): void => {
  uni.navigateTo({ url: '/pages/inputs/scan' })
}

onMounted(async () => {
  const farm = currentFarm()
  try {
    if (farm) {
      const page = await listPlots({ farmId: farm.farmId, pageSize: 100 })
      plots.value = page.list.map((plot: any) => ({
        ...plot,
        plotId: String(plot.plotId ?? plot.id ?? ''),
      }))
    }
    await search()
  } catch {
    /* 地块拿不到不影响"不带地块"的校验 */
  }
})
</script>
