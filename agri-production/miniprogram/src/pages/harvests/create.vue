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
      <!-- 结论来源写清楚：规则在服务端，与 PC 端同一份，前端不再自己算一套 -->
      <view v-if="serverCheck || checkError" class="muted" style="margin-top: 8rpx">
        结论来自服务端校验（规则与 PC 端同一份）。{{ withdrawal.basis || '' }}
      </view>
    </view>

    <view style="margin: 24rpx">
      <view
        class="btn-primary"
        :style="submitLabel !== '提交采收登记' ? 'background-color:#d9d9d9' : ''"
        @click="submit"
      >
        {{ submitting ? '提交中…' : submitLabel }}
      </view>
    </view>

    <view class="muted" style="text-align: center; padding: 0 48rpx">
      提交走 POST /api/v1/production/harvests；休药期校验走服务端（GET /food-safety/pre-harvest-check），
      结论为「未过」或**校验接口不可用**时都不放行（安全红线 fail-closed，与 PRD 4.4.2 Step3 的"拦截"一致）。
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
import { currentFarm, currentUser } from '@/utils/auth-helper'
import { today } from '@/utils/format'

/** 质量等级候选（与 PC 端采收登记同值域） */
const grades = ['A', 'B', 'C', 'D', '待检']

const plots = ref<any[]>([])
const members = ref<any[]>([])
/** 服务端休药期校验结果（规则在服务端，前端只展示） */
const serverCheck = ref<any | null>(null)
const checkLoading = ref(false)
const checkError = ref('')
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
  if (!plotId) {
    serverCheck.value = null
    return
  }
  checkLoading.value = true
  checkError.value = ''
  try {
    serverCheck.value = await preHarvestCheck({ plotId, plannedHarvestDate: plannedDate })
  } catch (err: any) {
    serverCheck.value = null
    checkError.value = err?.message ?? '未知错误'
  } finally {
    checkLoading.value = false
  }
}

function onPlotChange(event: any): void {
  const plot = plots.value[Number(event.detail.value)]
  form.value.plotId = String(plot?.plotId ?? '')
  void loadWithdrawalCheck(form.value.plotId, form.value.harvestDate)
}

function onDateChange(event: any): void {
  form.value.harvestDate = String(event.detail.value)
  void loadWithdrawalCheck(form.value.plotId, form.value.harvestDate)
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
    error.value = '不能登记本次采收：' + withdrawal.value.reason
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
