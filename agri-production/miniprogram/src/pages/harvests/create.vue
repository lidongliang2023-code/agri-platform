<template>
  <view class="page">
    <view v-if="error" class="error-box">{{ error }}</view>

    <view class="card">
      <view class="card-title"><text>选择采收地块</text></view>
      <picker :disabled="submitting || saved" mode="selector" :range="plotNames" @change="onPlotChange">
        <view class="field" style="border-bottom: none">
          <text class="field-label">采收地块</text>
          <text class="field-value">{{ plotLabel || '请选择' }}</text>
        </view>
      </picker>
    </view>

    <view class="card">
      <view class="card-title"><text>填写采收信息</text></view>
      <picker :disabled="submitting || saved" mode="date" :value="form.harvestDate" @change="onDateChange">
        <view class="field"><text class="field-label">采收日期</text><text class="field-value">{{ form.harvestDate }}</text></view>
      </picker>
      <view class="field">
        <text class="field-label">采收数量</text>
        <input :disabled="submitting || saved" v-model="form.quantity" class="input" type="digit" placeholder="如 500" />
      </view>
      <view class="field">
        <text class="field-label">单位</text>
        <input :disabled="submitting || saved" v-model="form.unit" class="input" placeholder="kg" />
      </view>
      <picker :disabled="submitting || saved" mode="selector" :range="grades" @change="onGradeChange">
        <view class="field"><text class="field-label">质量等级</text><text class="field-value">{{ form.grade }}</text></view>
      </picker>
      <picker :disabled="submitting || saved" mode="selector" :range="memberNames" @change="onMemberChange">
        <view class="field"><text class="field-label">采收人</text><text class="field-value">{{ memberLabel || '请选择' }}</text></view>
      </picker>
      <view class="field" style="border-bottom: none">
        <text class="field-label">备注</text>
        <input :disabled="submitting || saved" v-model="form.remark" class="input" placeholder="选填" />
      </view>
    </view>

    <!-- Step3 休药期校验：用该地块真实用药记录 + 安全间隔期推算 -->
    <view class="card">
      <view class="card-title"><text>采收前安全检查</text></view>
      <view v-if="!form.plotId" class="muted">先选择地块，系统按该地块最近用药记录推算</view>
      <view v-else-if="checkLoading" class="muted">正在向服务端校验休药期…</view>
      <view v-else-if="withdrawal.blocked" class="error-box" style="margin: 0">
        ❌ 休药期未过：{{ withdrawal.reason }}。最早可采收日 {{ withdrawal.earliest }}（还有 {{ withdrawal.remain }} 天）
      </view>
      <view v-else-if="withdrawal.unknown" class="notice" style="margin: 0">
        ⚠️ 无法判定：{{ withdrawal.reason }}
      </view>
      <view v-else class="notice" style="margin: 0">
        ✅ 休药期通过{{ withdrawal.earliest ? '（最早可采收 ' + withdrawal.earliest + '）' : '' }}{{ withdrawal.note ? '——' + withdrawal.note : '' }}
      </view>
      <button v-if="checkError" class="btn-ghost" :disabled="checkLoading || submitting" @click="loadWithdrawalCheck(form.plotId, form.harvestDate)">重新校验</button>
      <!-- 结论来源写清楚：规则在服务端，与 PC 端同一份，前端不再自己算一套 -->
      <view v-if="serverCheck || checkError" class="muted" style="margin-top: 8rpx">
        {{ withdrawal.basis || '' }}
      </view>
    </view>

    <view class="form-actions">
      <button class="btn-primary" :loading="submitting" :disabled="submitting || saved || checkLoading || withdrawal.blocked" @click="submit">{{ saved ? '已登记' : submitLabel }}</button>
      <text class="muted">采收登记通过服务端休药期校验后才会写入</text>
    </view>

    <view class="muted form-source-note">
      提交前会自动检查休药期，检查未通过时不能登记；登记成功后可在采收详情查看批次和溯源码。
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import {
  createHarvest,
  generateHarvestBatch,
  listMembers,
  listPlots,
  preHarvestCheck,
} from '@/api/production'
import { currentUser, resolveCurrentFarm } from '@/utils/auth-helper'
import { today } from '@/utils/format'

/** 质量等级候选（与 PC 端采收登记同值域） */
const grades = ['A', 'B', 'C', 'D', '待检']

const plots = ref<any[]>([])
const members = ref<any[]>([])
/** 服务端休药期校验结果（规则在服务端，前端只展示） */
const serverCheck = ref<any | null>(null)
const checkLoading = ref(false)
const checkError = ref('')
const checkedKey = ref('')
let checkVersion = 0
const error = ref('')
const submitting = ref(false)
const saved = ref(false)

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

/** 从「休药期对比」页带过来的地块（PRD §10.3 的"仅采收合格地块"落地：带地块直达登记） */
const presetPlotId = ref('')

onLoad((options) => {
  presetPlotId.value = String(options?.plotId ?? '')
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
 * 休药期结论（PRD 4.4.2 Step3 / §10.3）：**由服务端判定**，前端只做展示与拦截。
 *
 * <p>三种"不能放行"的情形都算 blocked：服务端判定 block、校验接口报错（fail-closed，
 * 安全红线不能因为接口挂了就放行）、以及服务端尚未返回结论（还没选地块或正在请求）。</p>
 */
const withdrawal = computed(() => {
  const row = serverCheck.value
  const empty = { blocked: true, unknown: false, reason: '', earliest: '', remain: 0, note: '', basis: '' }
  if (checkError.value) {
    return { ...empty, reason: '服务端校验不可用（' + checkError.value + '），按安全红线不放行' }
  }
  if (!row) {
    return { ...empty, reason: '尚未取得服务端校验结论' }
  }
  const basis = String(row.basis ?? '')
  if (row.checkResult === 'block') {
    const last = row.lastApplication ?? {}
    const interval = last.preHarvestIntervalDays ?? '—'
    return {
      ...empty,
      reason: String(last.applicationDate ?? '') + ' 使用「' + String(last.productName ?? '农药')
        + '」，安全间隔期 ' + interval + ' 天',
      earliest: String(row.earliestHarvestDate ?? ''),
      remain: Number(row.daysRemaining ?? 0),
      basis,
    }
  }
  if (row.dataComplete === false) {
    return { ...empty, blocked: false, unknown: true, reason: String(row.note ?? '该地块没有可判定的用药记录'), basis }
  }
  return {
    ...empty,
    blocked: false,
    earliest: String(row.earliestHarvestDate ?? ''),
    note: String(row.note ?? ''),
    basis,
  }
})

/**
 * 提交按钮文案。
 *
 * <p>分三种不可提交的情形，文案要能区分"休药期没过"与"校验根本没用上"
 * —— 两者都不放行，但用户该做的事不同。</p>
 */
const submitLabel = computed(() => {
  if (checkLoading.value) return '正在校验休药期…'
  if (!withdrawal.value.blocked) return '提交采收登记'
  if (checkError.value || !serverCheck.value) return '校验不可用，不可登记'
  return '休药期未过，不可登记'
})

/**
 * 向服务端要一次休药期结论。
 *
 * @param plotId 地块主键
 * @param plannedDate 计划采收日期（yyyy-MM-dd）
 */
async function loadWithdrawalCheck(plotId: string, plannedDate: string): Promise<void> {
  const version = ++checkVersion
  serverCheck.value = null
  checkedKey.value = ''
  checkError.value = ''
  checkLoading.value = Boolean(plotId)
  if (!plotId) return
  try {
    const result = await preHarvestCheck({ plotId, plannedHarvestDate: plannedDate })
    if (version !== checkVersion || form.value.plotId !== plotId || form.value.harvestDate !== plannedDate) return
    serverCheck.value = result
    checkedKey.value = plotId + '|' + plannedDate
  } catch (err: any) {
    if (version === checkVersion) checkError.value = err?.message || '校验失败，请重试'
  } finally { if (version === checkVersion) checkLoading.value = false }
}

function onPlotChange(event: any): void {
  if (submitting.value || saved.value) return
  const plot = plots.value[Number(event.detail.value)]
  form.value.plotId = String(plot?.plotId ?? '')
  void loadWithdrawalCheck(form.value.plotId, form.value.harvestDate)
}

function onDateChange(event: any): void {
  if (submitting.value || saved.value) return
  form.value.harvestDate = String(event.detail.value)
  void loadWithdrawalCheck(form.value.plotId, form.value.harvestDate)
}

function onGradeChange(event: any): void {
  if (submitting.value || saved.value) return
  form.value.grade = grades[Number(event.detail.value)] ?? 'A'
}

function onMemberChange(event: any): void {
  if (submitting.value || saved.value) return
  const member = members.value[Number(event.detail.value)]
  form.value.operatorId = String(member?.id ?? '')
  form.value.operatorName = String(member?.realName ?? '')
}

async function submit(): Promise<void> {
  if (submitting.value || saved.value) return
  submitting.value = true
  try {
  error.value = ''
  const farm = await resolveCurrentFarm().catch((e: any) => { error.value = e?.message || '农场加载失败，请稍后重试'; return null })
  if (!farm) return
  if (!form.value.plotId) {
    error.value = '请选择采收地块'
    return
  }
  if (!form.value.quantity || (!Number.isFinite(Number(form.value.quantity)) || Number(form.value.quantity) <= 0)) {
    error.value = '请填写大于 0 的采收数量'
    return
  }
  if (!form.value.operatorId) {
    error.value = '请选择采收人'
    return
  }
  if (checkLoading.value || checkedKey.value !== form.value.plotId + '|' + form.value.harvestDate) { error.value = '请等待当前地块和日期的休药期校验完成'; return }
  if (withdrawal.value.blocked) {
    error.value = '不能登记本次采收：' + withdrawal.value.reason
    return
  }
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
    saved.value = true
    let traceMessage = '采收已登记'
    // 溯源码生成失败不阻断主流程（批次已落库），但要如实提示
    try {
      await generateHarvestBatch(batchId, {})
    } catch (err: any) {
      traceMessage = '采收已登记，溯源码待生成，请在详情重试'
    }
    uni.showToast({ title: traceMessage, icon: 'none', duration: 3000 })
    setTimeout(() => {
      uni.redirectTo({ url: `/pages/harvests/detail?id=${batchId}` })
    }, 700)
  } catch (err: any) {
    error.value = err?.message ?? '登记失败，请稍后重试'
  }
  } finally { submitting.value = false }
}

onMounted(async () => {
  const farm = await resolveCurrentFarm().catch((e: any) => { error.value = e?.message || '农场加载失败，请稍后重试'; return null })
  if (!farm) return
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
    // 从休药期对比页带着地块进来：预选并立刻向服务端校验一次
    if (presetPlotId.value && plots.value.some((plot) => String(plot.plotId) === presetPlotId.value)) {
      form.value.plotId = presetPlotId.value
      await loadWithdrawalCheck(form.value.plotId, form.value.harvestDate)
    }
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

<style scoped>
.form-actions { position: sticky; bottom: 0; z-index: 8; display: flex; flex-direction: column; gap: 10rpx; margin-top: 22rpx; padding: 18rpx 24rpx calc(18rpx + env(safe-area-inset-bottom)); background: rgba(245,247,245,.96); backdrop-filter: blur(14rpx); }
.form-source-note { display: block; text-align: center; padding: 0 48rpx 24rpx; }
</style>
