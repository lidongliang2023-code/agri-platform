<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { infoApi, toast, type AlertMessage } from '../../api'

const items = ref<AlertMessage[]>([])
const unread = ref(0)
const tab = ref<'all' | 'unread' | 'risk'>('all')
const loading = ref(true)

const tabs = [
  { key: 'all', label: '全部' },
  { key: 'unread', label: '未读' },
  { key: 'risk', label: '异常波动' },
] as const

const filtered = computed(() => {
  if (tab.value === 'unread') return items.value.filter((item) => !item.read)
  if (tab.value === 'risk') return items.value.filter((item) => item.level !== 'normal')
  return items.value
})

const unreadLabel = computed(() => (unread.value ? `未读 ${unread.value}` : '全部已读'))

onShow(() => {
  load()
})

async function load() {
  loading.value = true
  try {
    const result = await infoApi.alertMessages()
    items.value = result.items
    unread.value = result.unread
  } catch (error) {
    toast(error instanceof Error ? error.message : '加载失败')
  } finally {
    loading.value = false
  }
}

async function readAll() {
  try {
    const result = await infoApi.readAllAlerts()
    unread.value = 0
    items.value = items.value.map((item) => ({ ...item, read: true }))
    toast(result.updated ? `已标记 ${result.updated} 条为已读` : '没有未读消息', 'success')
  } catch (error) {
    toast(error instanceof Error ? error.message : '操作失败')
  }
}

function levelTag(level: string) {
  if (level === 'high' || level === 'critical') return { text: '重要预警', tone: 'red' }
  if (level === 'medium') return { text: '价格预警', tone: 'orange' }
  return { text: '一般提醒', tone: 'gray' }
}

function openMarket() {
  uni.switchTab({ url: '/pages/market/index' })
}

function toSetup() {
  uni.navigateTo({ url: '/pages/alert/setup' })
}
</script>

<template>
  <view class="page">
    <view class="bar">
      <view class="seg">
        <view
          v-for="item in tabs"
          :key="item.key"
          :class="{ active: tab === item.key }"
          @click="tab = item.key"
        >
          {{ item.label }}
        </view>
      </view>
      <text class="read-all" @click="readAll">{{ unreadLabel }}</text>
    </view>

    <view class="page-pad">
      <view v-if="loading" class="loading">正在加载…</view>
      <view v-else-if="!filtered.length" class="empty">
        <text class="empty-icon">🔔</text>
        <text>暂无预警消息</text>
      </view>

      <view v-else class="msg-list">
        <view v-for="item in filtered" :key="item.id" class="msg-card" :class="{ unread: !item.read }">
          <view class="msg-top">
            <text :class="['tag', levelTag(item.level).tone]">{{ levelTag(item.level).text }}</text>
            <text v-if="!item.read" class="dot" />
            <text class="tiny grow-right">{{ item.createdAt }}</text>
          </view>
          <text class="msg-title">{{ item.title }}</text>
          <text class="msg-content">{{ item.content }}</text>
          <view class="msg-foot">
            <text class="tiny">触发值 {{ item.triggerValue }} · {{ item.quoteName }}</text>
            <text class="link" @click="openMarket">查看行情 ›</text>
          </view>
        </view>
      </view>

      <button class="btn btn-ghost btn-block" style="margin-top: 10rpx" @click="toSetup">
        调整我的预警阈值
      </button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.bar {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 24rpx;
  background: #ffffff;
}

.bar .seg {
  flex: 1;
}

.read-all {
  color: #12764a;
  font-size: 24rpx;
}

.msg-card {
  margin-bottom: 16rpx;
  padding: 24rpx;
  border: 1rpx solid #e1e9e3;
  border-radius: 22rpx;
  background: #ffffff;
}

.msg-card.unread {
  border-color: #cfe4d8;
  box-shadow: 0 8rpx 24rpx rgba(18, 118, 74, 0.06);
}

.msg-top {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-bottom: 12rpx;
}

.grow-right {
  flex: 1;
  text-align: right;
}

.dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: #e44949;
}

.msg-title {
  display: block;
  font-size: 27rpx;
  font-weight: 650;
  line-height: 1.5;
}

.msg-content {
  display: block;
  margin-top: 8rpx;
  color: #53665a;
  font-size: 24rpx;
  line-height: 1.65;
}

.msg-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 14rpx;
}

.link {
  color: #12764a;
  font-size: 24rpx;
}
</style>
