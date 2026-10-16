<template>
  <view class="page">
    <view class="tabs">
      <view
        v-for="tab in tabs"
        :key="tab.key"
        class="tab-item"
        :class="{ active: activeTab === tab.key }"
        @click="switchTab(tab.key)"
      >
        {{ tab.label }}
      </view>
    </view>

    <view class="card" style="margin-top: 16rpx">
      <view class="row">
        <text class="muted">未读 {{ unread }} 条</text>
        <text class="link" @click="markAllRead">全部标为已读</text>
      </view>
    </view>

    <view v-if="error" class="error-box">{{ error }}</view>
    <view v-if="!error && messages.length === 0" class="empty">暂无消息</view>

    <view v-for="message in messages" :key="message.messageId ?? message.id" class="card">
      <view class="row">
        <text class="strong">{{ message.title || '系统消息' }}</text>
        <text v-if="!isRead(message)" class="tag" style="color: #cf1322">未读</text>
      </view>
      <view class="muted" style="margin-top: 8rpx">{{ fmtDateTime(message.createdAt ?? message.sendTime) }}</view>
      <view style="margin-top: 8rpx">{{ message.content || message.summary || '—' }}</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { listMessages, markAllMessagesRead, unreadMessageCount } from '@/api/production'
import { ensureLogin } from '@/utils/auth-helper'
import { fmtDateTime } from '@/utils/format'

const tabs = [
  { key: 'all', label: '全部', readFlag: undefined as number | undefined },
  { key: 'unread', label: '未读', readFlag: 0 },
]

const activeTab = ref('all')
const messages = ref<any[]>([])
const unread = ref(0)
const error = ref('')

const isRead = (message: any): boolean => {
  const flag = message.readFlag ?? message.isRead
  return flag === 1 || flag === true || String(flag) === '1'
}

async function load(): Promise<void> {
  error.value = ''
  try {
    const tab = tabs.find((item) => item.key === activeTab.value)
    const page = await listMessages({ pageSize: 30, readFlag: tab?.readFlag })
    messages.value = page.list
    unread.value = await unreadMessageCount().catch(() => 0)
  } catch (err: any) {
    error.value = err?.message ?? '消息加载失败'
  }
}

function switchTab(key: string): void {
  activeTab.value = key
  void load()
}

function markAllRead(): void {
  uni.showModal({
    title: '全部标为已读',
    content: '确认把全部消息标为已读？该操作会写入服务端。',
    success: async (res) => {
      if (!res.confirm) return
      try {
        await markAllMessagesRead()
        uni.showToast({ title: '已标记', icon: 'success' })
        void load()
      } catch (err: any) {
        uni.showToast({ title: err?.message ?? '操作失败', icon: 'none' })
      }
    },
  })
}

onShow(() => {
  if (!ensureLogin()) return
  void load()
})
</script>
