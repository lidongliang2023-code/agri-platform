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
        通知偏好仅保存在本机，当前尚未开通系统推送。
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
        <text class="field-value muted">生产管理移动端 v1.0.0（H5 / 小程序 / APP）</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { TOKEN_KEY } from '@/utils/request'

// 通知偏好存储键
const PREF_KEY = 'agri_mobile_notify_prefs'

const storedPrefs = uni.getStorageSync(PREF_KEY) as Partial<{
  task: boolean
  alert: boolean
  message: boolean
}> | null
const prefs = ref<{ task: boolean; alert: boolean; message: boolean }>({
  task: storedPrefs?.task ?? true,
  alert: storedPrefs?.alert ?? true,
  message: storedPrefs?.message ?? true,
})

function onToggle(key: 'task' | 'alert' | 'message', event: any): void {
  prefs.value[key] = Boolean(event.detail.value)
  uni.setStorageSync(PREF_KEY, prefs.value)
}

// 清缓存：清掉除登录令牌之外的本地键，避免「清个缓存被登出」
function clearCache(): void {
  uni.showModal({
    title: '清除缓存',
    content: '仅清理业务缓存和通知偏好，保留账号、经营主体、农场和服务地址。',
    success: (res) => {
      if (!res.confirm) return
      const keep = [TOKEN_KEY, "agri_user", "agri_current_subject", "agri_current_farm", "agri_session_expires", "agri_service_origin"]
      uni.getStorageInfoSync().keys.filter(key => !keep.includes(key) && !key.startsWith("agri_workspace_mode:")).forEach(key => uni.removeStorageSync(key))
      uni.showToast({ title: '缓存已清除', icon: 'success' })
    },
  })
}
</script>
