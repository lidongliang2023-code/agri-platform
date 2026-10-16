<template>
  <view class="page">
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
