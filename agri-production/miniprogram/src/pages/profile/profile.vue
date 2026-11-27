<template>
  <view class="page">
    <view class="page-hero profile-hero">
      <view class="avatar">{{ (user.realName || user.username || '我').slice(0, 1) }}</view>
      <view class="profile-id">
        <text class="hero-title">{{ user.realName || '未登录' }}</text>
        <text class="hero-sub">{{ user.phone || user.username || '—' }} · {{ ops ? '运营管理账号' : roleText }}</text>
      </view>
    </view>

    <view v-if="canSwitch" class="card mode-card">
      <view class="card-title"><text>工作模式</text><text class="muted">切换后重新进入对应工作台</text></view>
      <view class="mode-switch">
        <button :disabled="switching" :class="['mode-option', mode === 'user' && 'active']" @click="switchMode('user')">
          <text class="mode-icon">🌱</text><view><text class="mode-name">用户端</text><text class="mode-desc">查看本主体和农场业务</text></view>
        </button>
        <button :disabled="switching" :class="['mode-option', mode === 'ops' && 'active']" @click="switchMode('ops')">
          <text class="mode-icon">📊</text><view><text class="mode-name">运营端</text><text class="mode-desc">查看平台运营和监管业务</text></view>
        </button>
      </view>
    </view>

    <view v-if="!ops" class="card">
      <view class="card-title"><text>经营主体</text><text class="link" @click="load">刷新准入</text></view>
      <view v-if="scopeError" class="error-box inline-box">{{ scopeError }}</view>
      <button class="scope-summary" :disabled="switching" @click="showSubjectPicker = true"><view><text class="scope-name">{{ subjectName }}</text><text class="muted">{{ subjects.length }} 个可用主体</text></view><text class="field-arrow">›</text></button>
      <view :class="['admission', admissionText.startsWith('已具备') ? 'ok' : '']">{{ admissionText }}</view>
      <view class="muted admission-note">切换主体后将重新选择农场。需要办理业务时，请先完成企业认证和身份审核。</view>
    </view>

    <view v-if="!ops" class="card farm-card">
      <view class="card-title"><text>当前农场</text><text class="muted">{{ farms.length }} 个可用</text></view>
      <button class="farm-summary" :disabled="switching" @click="showFarmPicker = true">
        <view class="farm-summary-main">
          <text class="farm-summary-icon">🏡</text>
          <view class="farm-summary-copy">
            <text class="farm-summary-name">{{ farm?.farmName || '暂未选择农场' }}</text>
            <text class="farm-summary-hint">{{ farm ? '当前业务数据将按此农场展示' : '请选择一个农场开始使用' }}</text>
          </view>
        </view>
        <text class="field-arrow">›</text>
      </button>

    </view>

    <view class="card menu-card">
      <view v-if="!ops" class="field" @click="goMessages">
        <text class="field-value left">💬 消息通知</text>
        <text v-if="unread > 0" class="badge">{{ unread > 99 ? '99+' : unread }}</text><text class="field-arrow">›</text>
      </view>
      <view class="field" @click="goAlerts"><text class="field-value left">🚨 告警中心</text><text class="field-arrow">›</text></view>
      <view class="field" @click="goSettings"><text class="field-value left">⚙️ 设置</text><text class="muted">通知偏好 / 清缓存</text><text class="field-arrow">›</text></view>
      <view class="field" @click="goConnection"><text class="field-value left">🔗 服务连接</text><text class="field-arrow">›</text></view>
    </view>

    <view v-if="!ops" class="section-title"><text>智能能力</text></view>
    <view v-if="!ops" class="card">
      <view class="grid">
        <view v-for="item in aiEntries" :key="item.path" class="grid-cell" @click="goAi(item.path)">
          <view class="grid-icon">{{ item.icon }}</view>
          <text class="grid-label">{{ item.label }}</text>
        </view>
      </view>
    </view>

    <mobile-choice-sheet :open="showSubjectPicker" title="经营主体" :value="selectedSubject" :options="subjectOptions" :busy="switching" @select="pickSubject" @close="closePickers" />
    <mobile-choice-sheet :open="showFarmPicker" title="农场" :value="String(farm?.farmId || '')" :options="farmOptions" :busy="switching" @select="pickFarm" @close="closePickers" />
    <view class="logout-wrap"><view class="btn-ghost logout" @click="goLogout">退出登录</view></view>
  </view>
</template>

<script setup lang="ts">
import MobileChoiceSheet from '@/components/mobile-choice-sheet/mobile-choice-sheet.vue'
import { computed, ref, watch } from 'vue'
import { canSwitchWorkspace, openWorkspace, ensureWorkspaceSession, setWorkspaceMode, workspaceMode, type WorkspaceMode } from '@/utils/workspace'
import { onShow, onHide, onBackPress } from '@dcloudio/uni-app'
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

import { SUBJECT_KEY, subjectSummary, productionAdmission, activateProductionSubject, clearProductionContext } from '@/utils/request'
import type { ProductionSubject } from '@/utils/request'
const subjects = ref<ProductionSubject[]>([])
const selectedSubject = ref('')
const subjectName = computed(() => subjects.value.find(item => String(item.merchantId) === selectedSubject.value)?.merchantName || '选择经营主体')
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
      // 服务端主体可能在其他端发生变化，同步时同时使旧主体的在途请求失效。
      clearProductionContext()
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
    showSubjectPicker.value = false
  } catch (e: any) { scopeError.value = e.message || '切换主体失败' }
  finally { switching.value = false }
}
const user = ref(currentUser())
const mode = ref<WorkspaceMode>(workspaceMode())
const canSwitch = ref(canSwitchWorkspace())
const ops = ref(mode.value === 'ops')
const farms = ref<FarmBrief[]>([])
const farm = ref(currentFarm())
const farmKeyword = ref('')
const showFarmPicker = ref(false)
const showSubjectPicker = ref(false)
const pickerOpen = computed(() => showSubjectPicker.value || showFarmPicker.value)
function closePickers(): void {
  if (switching.value) return
  showSubjectPicker.value = false
  showFarmPicker.value = false
}
watch(pickerOpen, open => {
  if (open) uni.hideTabBar({ animation: false })
  else uni.showTabBar({ animation: false })
})
onBackPress(() => {
  if (!pickerOpen.value) return false
  closePickers()
  return true
})
onHide(() => {
  showSubjectPicker.value = false
  showFarmPicker.value = false
  uni.showTabBar({ animation: false })
})
const subjectOptions = computed(() => subjects.value.map(item => ({ value: String(item.merchantId), label: item.merchantName || String(item.merchantId) })))
const farmOptions = computed(() => farms.value.map(item => ({ value: String(item.farmId), label: item.farmName })))
function pickSubject(value: string): void { const item = subjects.value.find(row => String(row.merchantId) === value); if (item) void selectSubject(item) }
function pickFarm(value: string): void { const item = farms.value.find(row => String(row.farmId) === value); if (item) switchFarm(item) }
const filteredFarms = computed(() => {
  const keyword = farmKeyword.value.trim().toLowerCase()
  if (!keyword) return farms.value
  return farms.value.filter((item) => String(item.farmName ?? '').toLowerCase().includes(keyword))
})
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
  canSwitch.value = canSwitchWorkspace()
  mode.value = workspaceMode()
  ops.value = mode.value === 'ops'
  showFarmPicker.value = false
  showSubjectPicker.value = false
  farmKeyword.value = ''

  if (ops.value) { subjects.value = []; farms.value = []; farm.value = null; unread.value = 0; return }
  await refreshScope()
  farm.value = currentFarm()
  try {
    farms.value = await listFarms()
  } catch (e: any) {
    farms.value = []
    scopeError.value = e?.message || '农场加载失败，请点击刷新准入重试'
  }
  unread.value = await unreadMessageCount().catch(() => 0)
}

async function switchMode(next: WorkspaceMode): Promise<void> {
  if (!canSwitch.value || mode.value === next || switching.value) return
  switching.value = true
  try {
    setWorkspaceMode(next)
    mode.value = next
    ops.value = next === 'ops'
    uni.showToast({ title: next === 'ops' ? '已切换到运营端' : '已切换到用户端', icon: 'success' })
    setTimeout(() => uni.switchTab({ url: '/pages/workbench/workbench' }), 250)
  } catch (e: any) {
    uni.showToast({ title: e?.message || '切换失败', icon: 'none' })
  } finally {
    switching.value = false
  }
}

// 切换农场：写上下文（各 Tab 数据都是农场作用域，切完回工作台重新取数）
function switchFarm(item: FarmBrief): void {
  if (switching.value) return
  setCurrentFarm(item)
  farm.value = item
  showFarmPicker.value = false
  farmKeyword.value = ''
  uni.showToast({ title: '已切换到 ' + item.farmName, icon: 'none' })
}

const goMessages = (): void => {
  uni.navigateTo({ url: '/pages/messages/messages' })
}
const goAlerts = (): void => {
  if (ops.value) { openWorkspace('/admin/production/alerts'); return }
  uni.navigateTo({ url: '/pages/alerts/alerts' })
}
const goConnection = (): void => {
  uni.navigateTo({ url: '/pages/connection/connection' })
}
const goSettings = (): void => {
  uni.navigateTo({ url: '/pages/profile/settings' })
}

/** 5 个 AI 能力页（PRD §4.7）；badge 提前说明"未接入"，点进去能看到后端原文与替代路径 */
const aiEntries = [
  { icon: '🤖', label: '农事助手', path: '/production/ai/assistant' },
  { icon: '🔬', label: '病虫害诊断', path: '/production/ai/pest-detection' },
  { icon: '🛡️', label: '投入品校验', path: '/production/ai/input-safety' },
  { icon: '📈', label: '产量预估', path: '/production/ai/yield-forecast' },
  { icon: '🏭', label: '协同排产', path: '/production/ai/processing-schedule' },
  { icon: '🎓', label: '农技培训', path: '/production/ai/tech-learning' },
]

const goAi = (path: string): void => {
  openWorkspace(path)
}

function goLogout(): void {
  uni.showModal({
    title: '退出登录',
    content: '确认退出当前账号？',
    success: async (res) => {
      if (!res.confirm || !await logout()) return
      uni.reLaunch({ url: '/pages/login/login' })
    },
  })
}

onShow(async () => {
  if (!await ensureWorkspaceSession()) return
  void load()
})
</script>

<style scoped>
.profile-hero { display: flex; align-items: center; gap: 24rpx; padding-bottom: 88rpx; }
.mode-card { margin-top: 18rpx; position: relative; }
.mode-switch { display: grid; grid-template-columns: 1fr; gap: 14rpx; }
.farm-summary { width: 100%; background: transparent; text-align: left; line-height: 1.5; display: flex; align-items: center; justify-content: space-between; gap: 16rpx; min-height: 108rpx; padding: 18rpx 4rpx; }
.farm-summary-main { display: flex; align-items: center; gap: 16rpx; min-width: 0; }
.farm-summary-icon { flex: none; width: 72rpx; height: 72rpx; border-radius: 20rpx; background: #e8f6ee; display: flex; align-items: center; justify-content: center; font-size: 34rpx; }
.farm-summary-copy { min-width: 0; display: flex; flex-direction: column; gap: 6rpx; }
.farm-summary-name { color: #16462e; font-size: 29rpx; font-weight: 600; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.farm-summary-hint { color: #666666; font-size: 24rpx; line-height: 1.4; }
.farm-picker-panel { border-top: 1rpx solid #edf1ee; padding-top: 10rpx; }
.farm-search { margin: 10rpx 0 8rpx; height: 72rpx; }
.farm-search input { height: 72rpx; }
.farm-empty { padding: 44rpx 0; }
.mode-option { width:100%; margin:0; text-align:left; line-height:1.5;  display: flex; align-items: center; gap: 16rpx; min-height: 92rpx; padding: 18rpx 16rpx; border: 2rpx solid #e7eee9; border-radius: 16rpx; background: #fafcfb; }
.mode-option.active { border-color: #13a05a; background: #e8f6ee; box-shadow: 0 4rpx 14rpx rgba(19,160,90,.12); }
.mode-icon { font-size: 34rpx; }
.mode-name, .mode-desc { display: block; }
.mode-name { color: #16462e; font-size: 28rpx; font-weight: 600; }
.mode-desc { display: block; margin-top: 6rpx; color: #666666; font-size: 24rpx; line-height: 1.35; }
.avatar { flex: none; width: 112rpx; height: 112rpx; border-radius: 50%; background: rgba(255, 255, 255, 0.22); border: 4rpx solid rgba(255, 255, 255, 0.5); color: #fff; font-size: 48rpx; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.profile-id { min-width: 0; }
.field-value.left { text-align: left; }
.inline-box { margin: 0 0 16rpx; }
.admission { margin-top: 16rpx; padding: 16rpx 20rpx; border-radius: 12rpx; background: #fff7e6; color: #ad6800; font-size: 24rpx; }
.admission.ok { background: #e8f6ee; color: #0f7a45; }
.admission-note { margin-top: 12rpx; line-height: 1.6; }
.badge { min-width: 36rpx; height: 36rpx; padding: 0 10rpx; border-radius: 18rpx; background: #b71c1c; color: #fff; font-size: 24rpx; line-height: 36rpx; text-align: center; box-sizing: border-box; }
.menu-card { padding-top: 8rpx; padding-bottom: 8rpx; }
.logout-wrap { margin: 40rpx 24rpx 0; }
.logout { color: #d4380d; border-color: #ffd2c2; }
.scope-summary { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 16rpx; min-height: 100rpx; background: #f3faf6; padding: 18rpx; text-align: left; line-height: 1.5; }
.scope-summary > view { min-width: 0; }
.scope-name { display: block; overflow-wrap: anywhere; font-size: 28rpx; color: #16462e; }
</style>
