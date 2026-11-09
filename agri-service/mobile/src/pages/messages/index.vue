<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { serviceApi } from '../../api'

const items = ref<Array<{ id: number; title: string; content: string; read: boolean; createdAt: string; type: string }>>([])

onShow(load)

async function load() {
  try {
    items.value = await serviceApi.messages()
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' })
  }
}

async function readAll() {
  try {
    await serviceApi.readAll()
    items.value = items.value.map((item) => ({ ...item, read: true }))
    uni.showToast({ title: '已全部标记为已读', icon: 'success' })
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '操作失败', icon: 'none' })
  }
}
</script>

<template>
  <view class="page message-page">
    <view class="page-pad">
      <view class="message-summary"><text class="summary-icon">🔔</text><view><text class="strong">{{ items.filter(item => !item.read).length }} 条未读消息</text><text class="tiny">重要服务节点会同步短信提醒</text></view><button class="btn btn-sm" @click="readAll">全部已读</button></view>
      <view class="message-list"><view class="message" v-for="item in items" :key="item.id" :class="{ read: item.read }" @click="item.read = true"><text class="message-icon">{{ item.type === 'order' ? '📋' : item.type === 'policy' ? '📜' : item.type === 'insurance' ? '🛡️' : '💬' }}</text><view><view class="between"><text class="message-title">{{ item.title }}</text><text v-if="!item.read" class="unread-dot" /></view><text class="muted">{{ item.content }}</text><text class="tiny">{{ item.createdAt }}</text></view><text class="chev">›</text></view></view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.message-page { padding-bottom: 24rpx; }
.message-summary { display: flex; align-items: center; gap: 14rpx; margin-bottom: 18rpx; padding: 22rpx; border-radius: 20rpx; background: #f2fbf5; }
.summary-icon { display: flex; width: 66rpx; height: 66rpx; align-items: center; justify-content: center; border-radius: 17rpx; background: #e5f5eb; font-size: 29rpx; }
.message-summary > view { display: flex; flex: 1; flex-direction: column; gap: 4rpx; }
.message-list { display: flex; flex-direction: column; gap: 14rpx; }
.message { display: flex; align-items: center; gap: 14rpx; padding: 22rpx; border: 1rpx solid #e1e9e3; border-radius: 20rpx; background: #fff; }
.message.read { opacity: .62; }
.message-icon { display: flex; width: 68rpx; height: 68rpx; flex: 0 0 68rpx; align-items: center; justify-content: center; border-radius: 17rpx; background: #e5f5eb; font-size: 29rpx; }
.message > view { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 4rpx; }
.message-title { font-size: 24rpx; font-weight: 650; }
.unread-dot { width: 12rpx; height: 12rpx; border-radius: 50%; background: #df4c4c; }
.chev { color: #94a198; font-size: 36rpx; }
</style>
