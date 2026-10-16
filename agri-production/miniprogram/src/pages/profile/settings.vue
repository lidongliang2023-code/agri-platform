<template>
  <view class="page">
    <view class="card">
      <view class="card-title"><text>🔔 通知偏好（本机）</text></view>
      <view class="field">
        <text class="field-label">任务到期提醒</text>
        <switch :checked="prefs.task" color="#13a05a" @change="onToggle('task', $event)" />
      </view>
      <view class="field">
        <text class="field-label">告警推送</text>
        <switch :checked="prefs.alert" color="#13a05a" @change="onToggle('alert', $event)" />
      </view>
      <view class="field" style="border-bottom: none">
        <text class="field-label">生产消息</text>
        <switch :checked="prefs.message" color="#13a05a" @change="onToggle('message', $event)" />
      </view>
      <view class="muted" style="margin-top: 12rpx">
        推送注册接口（POST /api/v1/mobile/push/register）后端未提供，这里只保存本机偏好，不会假装已订阅。
      </view>
    </view>

    <view class="card">
      <view class="field" @click="clearCache">
        <text class="field-label">清除缓存</text>
        <text class="field-value link">清理本机缓存（保留登录态） →</text>
      </view>
      <view class="field" style="border-bottom: none">
        <text class="field-label">离线数据</text>
        <text class="field-value muted">未接入同步接口</text>
      </view>
    </view>

    <view class="card">
      <view class="field" style="border-bottom: none">
        <text class="field-label">关于</text>
        <text class="field-value muted">生产管理移动端 v1.0.0（小程序 / H5 双端）</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { TOKEN_KEY } from '@/utils/request'

// 通知偏好存储键
const PREF_KEY = 'agri_mobile_notify_prefs'

const prefs = ref<{ task: boolean; alert: boolean; message: boolean }>({
  task: true,
  alert: true,
  message: true,
  ...(uni.getStorageSync(PREF_KEY) || {}),
})

function onToggle(key: 'task' | 'alert' | 'message', event: any): void {
  prefs.value[key] = Boolean(event.detail.value)
  uni.setStorageSync(PREF_KEY, prefs.value)
}

// 清缓存：清掉除登录令牌之外的本地键，避免「清个缓存被登出」
function clearCache(): void {
  uni.showModal({
    title: '清除缓存',
    content: '将清理本机缓存的农场上下文与偏好（保留登录态）。清除后请回「我的」重新选择农场。',
    success: (res) => {
      if (!res.confirm) return
      const token = uni.getStorageSync(TOKEN_KEY)
      uni.clearStorageSync()
      if (token) uni.setStorageSync(TOKEN_KEY, token)
      uni.showToast({ title: '缓存已清除', icon: 'success' })
    },
  })
}
</script>
