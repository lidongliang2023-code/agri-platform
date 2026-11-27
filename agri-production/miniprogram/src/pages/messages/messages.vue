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
        <button class="btn-ghost btn-sm" :disabled="marking || !unread" :loading="marking" @click="markAllRead">全部已读</button>
      </view>
    </view>



    <view v-for="message in messages" :key="message.messageId ?? message.id" class="card" @click="openMessage(message)">
      <view class="row">
        <text class="strong">{{ message.title || '系统消息' }}</text>
        <text v-if="!isRead(message)" class="tag" style="color: #cf1322">未读</text>
      </view>
      <view class="muted" style="margin-top: 8rpx">{{ fmtDateTime(message.createdAt ?? message.sendTime) }}</view>
      <view style="margin-top: 8rpx">{{ message.content || message.summary || '—' }}</view>
      <view class="message-actions"><button v-if="!isRead(message)" class="btn-ghost btn-sm" @click.stop="readOne(message)">标为已读</button><button class="btn-danger btn-sm" @click.stop="removeOne(message)">删除</button></view>
    </view>
    <mobile-list-state :loading="loading" :error="error" :count="messages.length" :total="total" :has-more="hasMore" empty-text="暂无消息" @retry="retry" @more="more" />
    <view class="more-management"><button class="btn-ghost" @click="openWorkspace('/production/messages', true)">更多管理功能 ›</button><text class="muted">打开完整业务，可处理更多管理操作</text></view>
  </view>
</template>

<script setup lang="ts">
import { openWorkspace, ensureWorkspaceSession, isProductionOps } from '@/utils/workspace'
import MobileListState from '@/components/mobile-list-state/mobile-list-state.vue'
import { useMobileList } from '@/composables/use-mobile-list'

import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { deleteMessage, listMessages, markAllMessagesRead, markMessageRead, unreadMessageCount } from '@/api/production'
import { ensureLogin } from '@/utils/auth-helper'
import { fmtDateTime } from '@/utils/format'

const tabs = [
  { key: 'all', label: '全部', readFlag: undefined as number | undefined },
  { key: 'unread', label: '未读', readFlag: 0 },
]

const activeTab = ref('all')

const unread = ref(0)
const { rows: messages, loading, error, total, hasMore, reload: load, more, retry, cancel } = useMobileList(async (pageNum, pageSize) => {
  if (!await ensureWorkspaceSession() || isProductionOps()) throw new Error('请切换到用户端查看消息')
  return listMessages({ pageNum, pageSize, readFlag: tabs.find(t => t.key === activeTab.value)?.readFlag })
}, row => String(row.messageId ?? row.id))

const isRead = (message: any): boolean => {
  const flag = message.readFlag ?? message.isRead
  return flag === 1 || flag === true || String(flag) === '1'
}

function switchTab(key: string): void {
  activeTab.value = key
  void load()
}

async function readOne(message: any): Promise<void> {
  const id = String(message.messageId ?? message.id ?? '')
  if (!id) return
  try {
    await markMessageRead(id)
    message.readFlag = 1
    message.isRead = true
    unread.value = Math.max(0, unread.value - 1)
    uni.showToast({ title: '已标记', icon: 'success' })
  } catch (err: any) {
    uni.showToast({ title: err?.message ?? '操作失败', icon: 'none' })
  }
}

async function removeOne(message: any): Promise<void> {
  const id = String(message.messageId ?? message.id ?? '')
  if (!id) return
  const confirmed = await new Promise<boolean>((resolve) => uni.showModal({ title: '删除消息？', content: '删除后不再出现在消息中心。', success: (res) => resolve(res.confirm), fail: () => resolve(false) }))
  if (!confirmed) return
  try {
    await deleteMessage(id)
    void load()
    unread.value = await unreadMessageCount().catch(() => unread.value)
    uni.showToast({ title: '已删除', icon: 'success' })
  } catch (err: any) {
    uni.showToast({ title: err?.message ?? '删除失败', icon: 'none' })
  }
}

function openMessage(message: any): void {
  if (!isRead(message)) void readOne(message)
  const content = String(message.content || message.summary || '—')
  uni.showModal({ title: message.title || '系统消息', content, showCancel: false })
}

const marking = ref(false)
function markAllRead(): void {
  if (marking.value || !unread.value) return
  marking.value = true
  uni.showModal({
    title: '全部标为已读',
    content: '确认把全部消息标为已读？',
    success: async (res) => {
      if (!res.confirm) { marking.value = false; return }
      try {
        await markAllMessagesRead()
        unread.value = await unreadMessageCount().catch(() => unread.value)
        uni.showToast({ title: '已标记', icon: 'success' })
        void load()
      } catch (err: any) {
        uni.showToast({ title: err?.message ?? '操作失败', icon: 'none' })
      } finally { marking.value = false }
    },
    fail: () => { marking.value = false },
  })
}

onShow(async () => {
  cancel(); messages.value = []
  if (!await ensureWorkspaceSession() || isProductionOps()) return
  void load()
  unread.value = await unreadMessageCount().catch(() => 0)
})
</script>

<style scoped>
.message-actions { display: flex; justify-content: flex-end; gap: 16rpx; margin-top: 18rpx; }
.btn-danger { color: #c0392b; border: 1rpx solid #efc3bd; background: #fff7f5; }
</style>
