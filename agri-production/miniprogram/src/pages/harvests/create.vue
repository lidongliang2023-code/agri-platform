<template>
  <view class="page">
    <view v-if="error" class="error-box">{{ error }}</view>

    <view class="card">
      <view class="card-title"><text>🌾 Step1 · 选择地块</text></view>
      <picker mode="selector" :range="plotNames" @change="onPlotChange">
        <view class="field" style="border-bottom: none">
          <text class="field-label">采收地块</text>
          <text class="field-value">{{ plotLabel || '请选择' }}</text>
        </view>
      </picker>
    </view>

    <view class="card">
      <view class="card-title"><text>🧾 Step2 · 填写信息</text></view>
      <picker mode="date" :value="form.harvestDate" @change="onDateChange">
        <view class="field"><text class="field-label">采收日期</text><text class="field-value">{{ form.harvestDate }}</text></view>
      </picker>
      <view class="field">
        <text class="field-label">采收数量</text>
        <input v-model="form.quantity" class="input" type="digit" placeholder="如 500" />
      </view>
      <view class="field">
        <text class="field-label">单位</text>
        <input v-model="form.unit" class="input" placeholder="kg" />
      </view>
      <picker mode="selector" :range="grades" @change="onGradeChange">
        <view class="field"><text class="field-label">质量等级</text><text class="field-value">{{ form.grade }}</text></view>
      </picker>
      <picker mode="selector" :range="memberNames" @change="onMemberChange">
        <view class="field"><text class="field-label">采收人</text><text class="field-value">{{ memberLabel || '请选择' }}</text></view>
      </picker>
      <view class="field" style="border-bottom: none">
        <text class="field-label">备注</text>
        <input v-model="form.remark" class="input" placeholder="选填" />
      </view>
    </view>

    <!-- Step3 休药期校验：用该地块真实用药记录 + 安全间隔期推算 -->
    <view class="card">
      <view class="card-title"><text>⏳ Step3 · 休药期校验</text></view>
      <view v-if="!form.plotId" class="muted">先选择地块，系统按该地块最近用药记录推算</view>
      <view v-else-if="withdrawal.blocked" class="error-box" style="margin: 0">
        ❌ 休药期未过：{{ withdrawal.reason }}。最早可采收日 {{ withdrawal.earliest }}（还有 {{ withdrawal.remain }} 天）
      </view>
      <view v-else-if="withdrawal.unknown" class="notice" style="margin: 0">
        ⚠️ 无法判定：{{ withdrawal.reason }}
      </view>
      <view v-else class="notice" style="margin: 0">
        ✅ 休药期通过{{ withdrawal.earliest ? `（最近用药日出推算最早可采收 ${withdrawal.earliest}）` : '' }}
      </view>
    </view>

    <view style="margin: 24rpx">
      <view
        class="btn-primary"
        :style="withdrawal.blocked ? 'background-color:#d9d9d9' : ''"
        @click="submit"
      >
        {{ submitting ? '提交中…' : withdrawal.blocked ? '休药期未过，不可登记' : '提交采收登记' }}
      </view>
    </view>

    <view class="muted" style="text-align: center; padding: 0 48rpx">
      提交走 POST /api/v1/production/harvests；休药期未过时前端**硬拦截**（与 PRD 4.4.2 Step3 一致）。
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  createHarvest,
  generateHarvestBatch,
  listInputUsages,
  listMembers,
  listPlots,
} from '@/api/production'
import { currentFarm, currentUser } from '@/utils/auth-helper'
import { addDays, daysBetween, today } from '@/utils/format'

/** 质量等级候选（与 PC 端采收登记同值域） */
const grades = ['A', 'B', 'C', 'D', '待检']

const plots = ref<any[]>([])
const members = ref<any[]>([])
/** 该地块的投入品使用记录，用于休药期推算 */
const plotUsages = ref<any[]>([])
const error = ref('')
const submitting = ref(false)

const form = ref({
  plotId: '',
  harvestDate: today(),
  quantity: '',
  unit: 'kg',
  grade: 'A',
  operatorId: '',
  operatorName: '',
  remark: '',
})

const plotNames = computed(() => plots.value.map((plot) => plot.plotName))
const memberNames = computed(() => members.value.map((member) => member.realName))
const plotLabel = computed(
  () => plots.value.find((plot) => String(plot.plotId) === String(form.value.plotId))?.plotName ?? '',
)
const memberLabel = computed(
  () => members.value.find((member) => String(member.id) === String(form.value.operatorId))?.realName ?? '',
)

/**
 * 休药期判定（PRD 4.4.2 Step3 / 10.3）。
 *
 * <p>算法：取该地块**最近一次农药类使用记录**（含安全间隔期），
 * 最早可采收日 = 使用日 + 安全间隔期；采收日早于它 → 拦截。
 * 缺安全间隔期或没有用药记录时**不谎报通过**，而是标"无法判定"，由用户判断。</p>
 */
const withdrawal = computed(() => {
  const blockedResult = { blocked: true, unknown: false, reason: '', earliest: '', remain: 0 }
  const unknownResult = { blocked: false, unknown: true, reason: '', earliest: '', remain: 0 }
  const passResult = { blocked: false, unknown: false, reason: '', earliest: '', remain: 0 }

  const pesticideUsages = plotUsages.value
    .filter((usage) => Boolean(usage.safetyIntervalDays) || Number(usage.safetyIntervalDays ?? 0) > 0)
    .sort((a, b) => String(b.usedAt ?? '').localeCompare(String(a.usedAt ?? '')))
  if (pesticideUsages.length === 0) {
    return { ...unknownResult, reason: '该地块没有带安全间隔期的用药记录，无法推算休药期' }
  }
  const last = pesticideUsages[0]
  const interval = Number(last.safetyIntervalDays ?? 0)
  if (!interval) {
    return { ...unknownResult, reason: '最近一次用药未登记安全间隔期，无法推算休药期' }
  }
  const earliest = addDays(String(last.usedAt), interval)
  const remain = daysBetween(form.value.harvestDate, earliest) ?? 0
  if (form.value.harvestDate < earliest) {
    return {
      ...blockedResult,
      reason: `${String(last.usedAt).slice(0, 10)} 使用「${last.inputName ?? '农药'}」，安全间隔期 ${interval} 天`,
      earliest,
      remain,
    }
  }
  return { ...passResult, earliest }
})

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
  form.value.harvestDate = String(event.detail.value)
}

function onGradeChange(event: any): void {
  form.value.grade = grades[Number(event.detail.value)] ?? 'A'
}

function onMemberChange(event: any): void {
  const member = members.value[Number(event.detail.value)]
  form.value.operatorId = String(member?.id ?? '')
  form.value.operatorName = String(member?.realName ?? '')
}

async function submit(): Promise<void> {
  error.value = ''
  const farm = currentFarm()
  if (!farm) {
    error.value = '当前账号未关联农场，请到「我的」页选择农场'
    return
  }
  if (!form.value.plotId) {
    error.value = '请选择采收地块'
    return
  }
  if (!form.value.quantity || Number(form.value.quantity) <= 0) {
    error.value = '请填写大于 0 的采收数量'
    return
  }
  if (!form.value.operatorId) {
    error.value = '请选择采收人'
    return
  }
  if (withdrawal.value.blocked) {
    error.value = '休药期未过，不能登记本次采收'
    return
  }
  submitting.value = true
  try {
    const plot = plots.value.find((item) => String(item.plotId) === String(form.value.plotId))
    const batchId = await createHarvest({
      farmId: farm.farmId,
      farmName: farm.farmName,
      plotId: form.value.plotId,
      plotName: plot?.plotName,
      cropName: plot?.currentCrop ?? plot?.cropName,
      cropVariety: plot?.cropVariety,
      harvestDate: form.value.harvestDate,
      quantity: Number(form.value.quantity),
      unit: form.value.unit || 'kg',
      grade: form.value.grade,
      operatorId: form.value.operatorId,
      operatorName: form.value.operatorName,
      status: 1,
      inboundStatus: 0,
      remark: form.value.remark || undefined,
    })
    // 溯源码生成失败不阻断主流程（批次已落库），但要如实提示
    try {
      await generateHarvestBatch(batchId, {})
    } catch (err: any) {
      uni.showToast({ title: `批次已登记，溯源码未生成：${err?.message ?? ''}`, icon: 'none' })
    }
    uni.showToast({ title: '采收已登记', icon: 'success' })
    setTimeout(() => {
      uni.redirectTo({ url: `/pages/harvests/detail?id=${batchId}` })
    }, 700)
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
    const [plotPage, memberList] = await Promise.all([
      listPlots({ farmId: farm.farmId, pageSize: 100 }),
      listMembers({ farmId: farm.farmId }),
    ])
    plots.value = plotPage.list.map((plot: any) => ({
      ...plot,
      plotId: String(plot.plotId ?? plot.id ?? ''),
    }))
    members.value = memberList
    // 默认采收人 = 当前登录人（团队成员里能对上就用对上的那条主键）
    const me = currentUser()
    const mine = memberList.find((member: any) => String(member.realName) === String(me.realName))
    if (mine) {
      form.value.operatorId = String(mine.id)
      form.value.operatorName = String(mine.realName)
    }
  } catch (err: any) {
    error.value = err?.message ?? '地块 / 人员加载失败'
  }
})
</script>
