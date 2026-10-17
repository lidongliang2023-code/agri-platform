<template>
  <view class="page">
    <!-- 扫码区：小程序端调原生扫码，H5 只能手动输入（如实区分，不假装能扫） -->
    <view class="card">
      <view class="card-title"><text>📷 录入投入品</text></view>
      <!-- #ifdef MP-WEIXIN -->
      <view class="btn-primary" @click="scan">扫码识别条码 / 溯源码</view>
      <view class="muted" style="margin-top: 12rpx">扫码结果会作为关键字检索投入品档案；查不到则改为手动搜索。</view>
      <!-- #endif -->
      <!-- #ifndef MP-WEIXIN -->
      <view class="muted">当前环境（H5）不支持调用相机扫码，请用手动搜索录入；小程序端可扫码。</view>
      <!-- #endif -->
      <view class="divider" />
      <view class="row">
        <input v-model="keyword" class="input" style="text-align: left" placeholder="输入投入品名称 / 条码 / 登记证号" @confirm="search" />
        <text class="btn-ghost btn-sm" @click="search">搜索</text>
      </view>
    </view>

    <view v-if="error" class="error-box">{{ error }}</view>
    <view v-if="searched && candidates.length === 0" class="empty">没有匹配的投入品档案</view>

    <view v-for="item in candidates" :key="item.inputId" class="card" @click="pick(item)">
      <view class="row">
        <text class="strong">{{ item.inputName }}</text>
        <text class="tag" style="color: #13a05a">{{ categoryLabel(item.inputType) }}</text>
      </view>
      <view class="muted" style="margin-top: 8rpx">
        库存 {{ fmtNumber(item.stockQty, item.unit) }} · 安全间隔期 {{ item.safetyInterval ?? '—' }} 天 ·
        登记证号 {{ item.registrationNo || '—' }}
      </view>
    </view>

    <!-- 选中后：使用信息填写 + 合规校验 -->
    <template v-if="selected">
      <view class="card">
        <view class="card-title"><text>🧾 使用信息（{{ selected.inputName }}）</text></view>
        <picker mode="selector" :range="plotNames" @change="onPlotChange">
          <view class="field">
            <text class="field-label">使用地块</text>
            <text class="field-value">{{ plotLabel || '请选择' }}</text>
          </view>
        </picker>
        <picker mode="date" :value="form.usedAt" @change="onDateChange">
          <view class="field">
            <text class="field-label">使用日期</text>
            <text class="field-value">{{ form.usedAt }}</text>
          </view>
        </picker>
        <view class="field">
          <text class="field-label">用量</text>
          <input v-model="form.dosage" class="input" type="digit" placeholder="如 1.5" />
        </view>
        <view class="field">
          <text class="field-label">单位</text>
          <input v-model="form.unit" class="input" :placeholder="selected.unit || 'kg'" />
        </view>
        <view class="field" style="border-bottom: none">
          <text class="field-label">施用方式</text>
          <input v-model="form.method" class="input" placeholder="如：叶面喷施" />
        </view>
      </view>

      <view class="card">
        <view class="card-title"><text>✅ 合规校验（服务端）</text></view>
        <view v-if="complianceLoading" class="muted">正在向服务端校验…</view>
        <view v-else-if="complianceError" class="error-box" style="margin: 0">{{ complianceError }}</view>
        <view v-else-if="!compliance" class="muted">选中投入品后由服务端校验（改动地块或用量会重新校验）</view>
        <template v-else>
          <view class="field">
            <text class="field-label">整体结论</text>
            <text class="field-value" :style="{ color: resultMeta(compliance.overall).color }">
              {{ resultMeta(compliance.overall).label }}
            </text>
          </view>
          <view v-for="item in complianceItems" :key="item.label" class="field">
            <text class="field-label">{{ item.label }}</text>
            <view class="field-value" style="text-align: right">
              <text :style="{ color: item.color }">{{ item.result }}</text>
              <view class="muted" style="margin-top: 4rpx">{{ item.detail }}</view>
            </view>
          </view>
          <view class="muted" style="margin-top: 12rpx">{{ compliance.note || '' }}</view>
        </template>
      </view>

      <view style="margin: 24rpx">
        <view class="btn-primary" @click="submit">{{ submitting ? '提交中…' : '登记使用记录' }}</view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { complianceCheck, createInputUsage, listInputs, listPlots } from '@/api/production'
import { currentFarm, currentUser } from '@/utils/auth-helper'
import { fmtNumber, today } from '@/utils/format'

/** 投入品分类字典（与 PC 端 INPUT_CATEGORIES 同值域） */
const CATEGORY_LABEL: Record<string, string> = {
  FERTILIZER: '肥料',
  PESTICIDE: '农药',
  SEED: '种苗',
  FEED: '饲料',
  VET: '兽药',
  OTHER: '其他',
}

const keyword = ref('')
const searched = ref(false)
const candidates = ref<any[]>([])
const plots = ref<any[]>([])
const selected = ref<any | null>(null)
/** 服务端四重校验结果（合规 / 交互 / 时机 / 成本 + 库存） */
const compliance = ref<any | null>(null)
const complianceLoading = ref(false)
const complianceError = ref('')
/** 输入里的用量会连着触发校验，做个简单防抖，避免每敲一个数字发一次请求 */
let complianceTimer: ReturnType<typeof setTimeout> | null = null
const error = ref('')
const submitting = ref(false)

const form = ref({
  plotId: '',
  usedAt: today(),
  dosage: '',
  unit: '',
  method: '',
})

/**
 * 深链预选地块（`?plotId=`）。
 *
 * <p>PRD 的地块详情/休药期对比都会"带着地块去登记"，有它就少一次滚轮选择；
 * 同时这也是联调脚本能稳定复现的前提（滚轮交互受机器负载影响太大）。</p>
 */
const presetPlotId = ref('')

onLoad((options) => {
  presetPlotId.value = String(options?.plotId ?? '')
})

const plotNames = computed(() => plots.value.map((plot) => plot.plotName))
const plotLabel = computed(
  () => plots.value.find((plot) => String(plot.plotId) === String(form.value.plotId))?.plotName ?? '',
)

/** 结论 → 文案与颜色（UNKNOWN 必须显式画出来，不能当成通过） */
const RESULT_META: Record<string, { label: string; color: string }> = {
  PASS: { label: '✅ 通过', color: '#13a05a' },
  WARNING: { label: '⚠️ 预警', color: '#fa8c16' },
  BLOCK: { label: '❌ 拦截', color: '#cf1322' },
  UNKNOWN: { label: '⬜ 未校验', color: '#8c8c8c' },
}

const resultMeta = (result: any) => RESULT_META[String(result)] ?? RESULT_META.UNKNOWN

/** 把服务端返回的四项 + 库存摊成列表（顺序按 PRD §10.2：合规 / 交互 / 时机 / 成本） */
const complianceItems = computed(() => {
  const row = compliance.value
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

/**
 * 向服务端要一次四重校验结论。
 *
 * <p>服务端只对有主数据支撑的项给结论（时机、库存），其余三项返回 UNKNOWN 并写明原因；
 * 这里原样展示，不在前端补一个"通过"。</p>
 */
async function refreshCompliance(): Promise<void> {
  const item = selected.value
  if (!item) {
    compliance.value = null
    return
  }
  complianceLoading.value = true
  complianceError.value = ''
  try {
    compliance.value = await complianceCheck({
      inputId: item.inputId,
      plotId: form.value.plotId || undefined,
      dosage: form.value.dosage ? Number(form.value.dosage) : undefined,
      unit: form.value.unit || item.unit || undefined,
      usageDate: form.value.usedAt,
    })
  } catch (err: any) {
    compliance.value = null
    complianceError.value = err?.message ?? '合规校验失败'
  } finally {
    complianceLoading.value = false
  }
}

/** 改动地块 / 用量后重算（防抖 400ms） */
function scheduleCompliance(): void {
  if (complianceTimer) clearTimeout(complianceTimer)
  complianceTimer = setTimeout(() => {
    void refreshCompliance()
  }, 400)
}

// 用量是手输的：每敲一个数字都发请求太吵，防抖后再校验
watch(
  () => form.value.dosage,
  () => {
    if (selected.value) scheduleCompliance()
  },
)

const categoryLabel = (type: string): string => CATEGORY_LABEL[type] ?? type ?? '其他'

/** 搜索投入品档案 */
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

/** 小程序扫码：把结果当关键字检索 */
function scan(): void {
  uni.scanCode({
    success: (res) => {
      keyword.value = res.result
      void search()
    },
    fail: () => {
      uni.showToast({ title: '未获取到扫码结果', icon: 'none' })
    },
  })
}

/** 选中投入品：带出上次使用的单位，并按地块拉最近用药记录做休药期校验 */
async function pick(item: any): Promise<void> {
  selected.value = item
  form.value.unit = item.unit ?? ''
  await refreshCompliance()
}

function onPlotChange(event: any): void {
  const plot = plots.value[Number(event.detail.value)]
  form.value.plotId = String(plot?.plotId ?? '')
  void refreshCompliance()
}

function onDateChange(event: any): void {
  form.value.usedAt = String(event.detail.value)
  void refreshCompliance()
}

/** 提交使用记录 */
async function submit(): Promise<void> {
  error.value = ''
  const item = selected.value
  if (!item) return
  if (!form.value.plotId) {
    error.value = '请选择使用地块'
    return
  }
  if (!form.value.dosage || Number(form.value.dosage) <= 0) {
    error.value = '请填写大于 0 的用量'
    return
  }
  // 服务端判定 BLOCK 时直接拦下；有未校验项时提示后再继续（不把"没校验"当成"通过"）
  const overall = compliance.value?.overall
  if (overall === 'BLOCK') {
    error.value = '服务端校验拦截：' + String(compliance.value?.timing?.detail ?? '本次使用不合规')
    return
  }
  if (overall === 'WARNING' || overall === 'UNKNOWN' || !compliance.value) {
    const unknown = complianceItems.value
      .filter((item) => item.result.indexOf('未校验') >= 0)
      .map((item) => item.label)
      .join('、')
    const confirmed = await new Promise<boolean>((resolve) => {
      uni.showModal({
        title: '仍要登记吗',
        content: unknown
          ? '整体结论：' + String(overall ?? '未校验') + '。未校验项：' + unknown + '。确认继续登记？'
          : '整体结论：' + String(overall ?? '未校验') + '。确认继续登记？',
        success: (res) => resolve(Boolean(res.confirm)),
        fail: () => resolve(false),
      })
    })
    if (!confirmed) return
  }
  submitting.value = true
  try {
    await createInputUsage({
      inputId: item.inputId,
      inputName: item.inputName,
      plotId: form.value.plotId,
      farmId: currentFarm()?.farmId,
      dosage: Number(form.value.dosage),
      unit: form.value.unit || item.unit || 'kg',
      method: form.value.method || undefined,
      usedAt: form.value.usedAt,
      operatorId: currentUser().userId,
      operatorName: currentUser().realName,
      safetyIntervalDays: item.safetyInterval,
    })
    uni.showToast({ title: '使用记录已登记', icon: 'success' })
    setTimeout(() => {
      uni.navigateBack()
    }, 600)
  } catch (err: any) {
    error.value = err?.message ?? '登记失败，请稍后重试'
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  const farm = currentFarm()
  if (!farm) {
    error.value = '当前账号未关联农场，请到「我的」页选择农场'
    return
  }
  try {
    const plotPage = await listPlots({ farmId: farm.farmId, pageSize: 100 })
    plots.value = plotPage.list.map((plot: any) => ({
      ...plot,
      plotId: String(plot.plotId ?? plot.id ?? ''),
    }))
    if (presetPlotId.value && plots.value.some((plot) => String(plot.plotId) === presetPlotId.value)) {
      form.value.plotId = presetPlotId.value
    }
    await search()
  } catch (err: any) {
    error.value = err?.message ?? '地块加载失败'
  }
})
</script>
