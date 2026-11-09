<template>
  <view class="page">
    <view class="card">
      <view class="card-title"><text>当前经营主体与生产准入</text></view>
      <view v-if="scopeError" class="error-box">{{ scopeError }}</view>
      <view v-for="item in subjects" :key="item.merchantId" class="field" @click="selectSubject(item)">
        <text class="field-label">{{ item.merchantName || item.merchantId }}</text>
        <text class="field-value link">{{ selectedSubject === String(item.merchantId) ? '✓ 当前主体' : '切换' }}</text>
      </view>
      <view class="muted">{{ admissionText }}</view>
      <view class="muted" style="margin-top: 12rpx">生产写入需本主体成员关系有效、企业认证通过，并具备本主体已批准的农户或合作社管理员身份。</view>
      <text class="link" @click="refreshScope">刷新准入状态</text>
    </view>
    <view class="card">
      <view class="row">
        <view>
          <text class="strong" style="font-size: 34rpx">{{ user.realName || '未登录' }}</text>
          <view class="muted" style="margin-top: 6rpx">{{ user.phone || user.username || '—' }}</view>
          <view class="muted" style="margin-top: 4rpx">角色：{{ roleText }}</view>
        </view>
        <text class="link" @click="goLogout">退出登录</text>
      </view>
    </view>

    <view class="card">
      <view class="card-title"><text>🏠 我的农场（点击切换）</text></view>
      <view v-if="farms.length === 0" class="muted">该账号名下暂无农场</view>
      <view v-for="item in farms" :key="item.farmId" class="field" @click="switchFarm(item)">
        <text class="field-label">{{ item.farmName }}</text>
        <text class="field-value" :style="{ color: isCurrent(item) ? '#13a05a' : '#8c8c8c' }">
          {{ isCurrent(item) ? '✓ 当前' : '切换' }}
        </text>
      </view>
    </view>

    <view class="card">
      <view class="field" @click="goMessages">
        <text class="field-label">消息通知</text>
        <text class="field-value link">{{ unread > 0 ? unread + ' 条未读' : '查看 →' }}</text>
      </view>
      <view class="field" @click="goAlerts">
        <text class="field-label">告警中心</text>
        <text class="field-value link">查看 →</text>
      </view>
      <view class="field" @click="goSettings">
        <text class="field-label">设置</text>
        <text class="field-value link">通知偏好 / 清缓存 / 关于 →</text>
      </view>
      <view class="field" style="border-bottom: none">
        <text class="field-label">离线数据</text>
        <text class="field-value muted">未接入同步接口</text>
      </view>
    </view>

    <!-- 智能能力入口：页面都在，能力未接入时页面会展示后端原文与替代路径（不藏起来、也不假装能用） -->
    <view class="card">
      <view class="card-title"><text>🤖 智能能力</text></view>
      <view v-for="item in aiEntries" :key="item.path" class="field" @click="goAi(item.path)">
        <text class="field-label">{{ item.label }}</text>
        <text class="field-value link">{{ item.badge }} →</text>
      </view>
    </view>

    <view class="muted" style="text-align: center; padding: 24rpx">
      离线数据同步（POST /api/v1/mobile/sync）后端尚未提供，本轮不展示“已缓存 N 条”这类假状态。
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { unreadMessageCount } from '@/api/production'
import {
  currentFarm,
  currentUser,
  ensureLogin,
  listFarms,
  logout,
  setCurrentFarm,
} from '@/utils/auth-helper'
import type { FarmBrief } from '@/utils/auth'

import { SUBJECT_KEY, subjectSummary, productionAdmission, activateProductionSubject } from '@/utils/request'
import type { ProductionSubject } from '@/utils/request'
const subjects = ref<ProductionSubject[]>([])
const selectedSubject = ref('')
const admissionText = ref('正在读取生产准入状态')
const scopeError = ref('')
const switching = ref(false)
async function refreshScope(): Promise<void> {
  scopeError.value = ''
  admissionText.value = '正在读取生产准入状态'
  try {
    const summary = await subjectSummary()
    subjects.value = summary.merchants || []
    const active = summary.activeMerchantId ? String(summary.activeMerchantId) : ''
    if (String(uni.getStorageSync(SUBJECT_KEY) || '') !== active) {
      uni.removeStorageSync('agri_current_farm')
      farm.value = null
      farms.value = []
    }
    selectedSubject.value = active
    if (active) uni.setStorageSync(SUBJECT_KEY, active)
    else uni.removeStorageSync(SUBJECT_KEY)
    const result = await productionAdmission(active)
    admissionText.value = result.granted ? '已具备当前主体的生产写入准入条件' : result.reason || '当前主体暂不具备生产写入权限'
  } catch (e: any) {
    admissionText.value = '暂无法确认准入，生产写入不会放行'
    scopeError.value = e.message || '读取主体失败'
  }
}
async function selectSubject(item: ProductionSubject): Promise<void> {
  if (switching.value || selectedSubject.value === String(item.merchantId)) return
  switching.value = true
  try {
    await activateProductionSubject(String(item.merchantId))
    farms.value = []
    farm.value = null
    await load()
  } catch (e: any) { scopeError.value = e.message || '切换主体失败' }
  finally { switching.value = false }
}
const user = ref(currentUser())
const farms = ref<FarmBrief[]>([])
const farm = ref(currentFarm())
const unread = ref(0)

const roleText = computed(() => {
  const roles = user.value.roles ?? []
  if (roles.length === 0) return '—'
  const map: Record<string, string> = {
    FARMER: '农场主',
    ADMIN: '管理员',
    OPERATOR: '田间操作工',
  }
  return roles.map((role) => map[role] ?? role).join(' / ')
})

const isCurrent = (item: FarmBrief): boolean =>
  String(item.farmId) === String(farm.value?.farmId ?? '')

async function load(): Promise<void> {
  user.value = currentUser()
  await refreshScope()
  farm.value = currentFarm()
  try {
    farms.value = await listFarms()
  } catch {
    farms.value = []
  }
  unread.value = await unreadMessageCount().catch(() => 0)
}

// 切换农场：写上下文（各 Tab 数据都是农场作用域，切完回工作台重新取数）
function switchFarm(item: FarmBrief): void {
  setCurrentFarm(item)
  farm.value = item
  uni.showToast({ title: '已切换到 ' + item.farmName, icon: 'none' })
}

const goMessages = (): void => {
  uni.navigateTo({ url: '/pages/messages/messages' })
}
const goAlerts = (): void => {
  uni.navigateTo({ url: '/pages/alerts/alerts' })
}
const goSettings = (): void => {
  uni.navigateTo({ url: '/pages/profile/settings' })
}

/** 5 个 AI 能力页（PRD §4.7）；badge 提前说明"未接入"，点进去能看到后端原文与替代路径 */
const aiEntries = [
  { label: 'AI 农艺师对话', badge: '未接入', path: '/pages/ai/assistant' },
  { label: 'AI 种植处方', badge: '未接入', path: '/pages/ai/prescription' },
  { label: 'AI 遥感监测', badge: '未接入', path: '/pages/ai/remote-sensing' },
  { label: 'AI 产量预测', badge: '未接入', path: '/pages/ai/yield-forecast' },
  { label: '消费者 AI 验真', badge: '未接入', path: '/pages/food-safety/ai-verify' },
]

const goAi = (path: string): void => {
  uni.navigateTo({ url: path })
}

function goLogout(): void {
  uni.showModal({
    title: '退出登录',
    content: '确认退出当前账号？',
    success: (res) => {
      if (!res.confirm) return
      logout()
      uni.reLaunch({ url: '/pages/login/login' })
    },
  })
}

onShow(() => {
  if (!ensureLogin()) return
  void load()
})
</script>
