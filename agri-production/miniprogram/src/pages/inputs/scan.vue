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
        <view class="card-title"><text>✅ 合规校验</text></view>
        <view v-for="check in checks" :key="check.label" class="field">
          <text class="field-label">{{ check.label }}</text>
          <text class="field-value" :style="{ color: check.color }">{{ check.result }}</text>
        </view>
      </view>

      <view style="margin: 24rpx">
        <view class="btn-primary" @click="submit">{{ submitting ? '提交中…' : '登记使用记录' }}</view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onMounted } from 'vue'
import { createInputUsage, listInputs, listInputUsages, listPlots } from '@/api/production'
import { currentFarm, currentUser } from '@/utils/auth-helper'
import { addDays, daysBetween, fmtNumber, today } from '@/utils/format'

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
/** 该地块最近的农药使用记录（用于休药期校验） */
const plotUsages = ref<any[]>([])
const error = ref('')
const submitting = ref(false)

const form = ref({
  plotId: '',
  usedAt: today(),
  dosage: '',
  unit: '',
  method: '',
})

const plotNames = computed(() => plots.value.map((plot) => plot.plotName))
const plotLabel = computed(
  () => plots.value.find((plot) => String(plot.plotId) === String(form.value.plotId))?.plotName ?? '',
)

/**
 * 合规校验（只做**能用真实数据算出来**的项）。
 *
 * <p>禁用清单与用量上限需要后端的标准库接口（本部署未提供移动端可用的清单端点），
 * 因此这两项如实标注「未校验」，不谎报"通过"；库存与休药期用的是库里的真实数。</p>
 */
const checks = computed(() => {
  const item = selected.value
  if (!item) return [] as { label: string; result: string; color: string }[]
  const list: { label: string; result: string; color: string }[] = []

  const dosage = Number(form.value.dosage || 0)
  const stock = Number(item.stockQty ?? 0)
  if (dosage > 0 && stock > 0) {
    list.push(
      dosage <= stock
        ? { label: '库存校验', result: `通过（库存 ${fmtNumber(stock, item.unit)}）`, color: '#13a05a' }
        : { label: '库存校验', result: `预警：超库存（库存 ${fmtNumber(stock, item.unit)}）`, color: '#fa8c16' },
    )
  } else {
    list.push({ label: '库存校验', result: '未能校验（用量或库存缺失）', color: '#8c8c8c' })
  }

  if (item.inputType === 'PESTICIDE') {
    const interval = Number(item.safetyInterval ?? 0)
    list.push(
      interval > 0
        ? {
            label: '安全间隔期',
            result: `本次使用后 ${interval} 天内不可采收（最早 ${addDays(form.value.usedAt, interval)}）`,
            color: '#0958d9',
          }
        : { label: '安全间隔期', result: '该农药未登记安全间隔期，无法计算休药期', color: '#fa8c16' },
    )
    const conflict = plotUsages.value.find((usage) => {
      const gap = daysBetween(String(usage.usedAt), today())
      return gap !== null && gap >= 0 && gap < interval
    })
    list.push(
      conflict
        ? {
            label: '休药期冲突',
            result: `该地块 ${String(conflict.usedAt).slice(0, 10)} 使用过农药，仍在休药期内`,
            color: '#cf1322',
          }
        : { label: '休药期冲突', result: '未发现冲突', color: '#13a05a' },
    )
  }

  list.push({ label: '禁用清单校验', result: '未校验（本部署未提供清单接口）', color: '#8c8c8c' })
  list.push({ label: '用量标准校验', result: '未校验（本部署未提供用量标准接口）', color: '#8c8c8c' })
  return list
})

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
  if (form.value.plotId) {
    await loadPlotUsages(form.value.plotId)
  }
}

async function loadPlotUsages(plotId: string): Promise<void> {
  try {
    const page = await listInputUsages({ plotId, pageSize: 50 })
    plotUsages.value = page.list
  } catch {
    plotUsages.value = []
  }
}

function onPlotChange(event: any): void {
  const plot = plots.value[Number(event.detail.value)]
  form.value.plotId = String(plot?.plotId ?? '')
  void loadPlotUsages(form.value.plotId)
}

function onDateChange(event: any): void {
  form.value.usedAt = String(event.detail.value)
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
    await search()
  } catch (err: any) {
    error.value = err?.message ?? '地块加载失败'
  }
})
</script>
