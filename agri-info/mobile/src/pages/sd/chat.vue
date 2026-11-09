<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { infoApi, money, timeAgo, toast, type SdMessage, type SupplyDemandDetail } from '../../api'

const id = ref(0)
const detail = ref<SupplyDemandDetail | null>(null)
const messages = ref<SdMessage[]>([])
const text = ref('')
const sending = ref(false)
const loading = ref(true)
const scrollInto = ref('')
const statusBarHeight = ref(0)

const quickReplies = ['能提供质检报告吗？', '最快什么时候能发货？', '可以先发一车试单吗？', '价格能再谈一下吗？']

try {
  statusBarHeight.value = Number(uni.getSystemInfoSync().statusBarHeight || 0)
} catch {
  statusBarHeight.value = 0
}

const priceHint = computed(() => {
  const ref0 = detail.value?.priceRef
  if (!ref0?.available) return ''
  return `当前${ref0.variety}行情 ${money(ref0.price || 0)} ${ref0.priceUnit || ''}（${(ref0.changePct || 0) >= 0 ? '+' : ''}${ref0.changePct || 0}%）。${ref0.note}`
})

onLoad((options) => {
  id.value = Number(options?.id || 0)
  load()
})

async function load() {
  loading.value = true
  try {
    const data = await infoApi.supplyDemand(id.value)
    detail.value = data
    messages.value = data.messages || []
    scrollToEnd()
  } catch (error) {
    toast(error instanceof Error ? error.message : '加载失败')
  } finally {
    loading.value = false
  }
}

async function send(content?: string) {
  const value = (content ?? text.value).trim()
  if (!value || sending.value) return
  sending.value = true
  text.value = ''
  try {
    const result = await infoApi.sendSdMessage(id.value, { content: value }, detail.value?.sdType)
    messages.value = result.messages
    scrollToEnd()
  } catch (error) {
    toast(error instanceof Error ? error.message : '发送失败')
  } finally {
    sending.value = false
  }
}

function scrollToEnd() {
  nextTick(() => {
    scrollInto.value = ''
    setTimeout(() => {
      scrollInto.value = 'chat-end'
    }, 30)
  })
}

function isMine(message: SdMessage) {
  return message.direction === 'out' || message.direction === 'mine'
}

function goBack() {
  uni.navigateBack({ delta: 1 })
}

function openDetail() {
  uni.navigateTo({ url: `/pages/sd/detail?id=${id.value}` })
}
</script>

<template>
  <view class="page chat-page">
    <view class="nav-holder" :style="{ paddingTop: `${statusBarHeight}px` }">
      <view class="custom-nav">
        <text class="back" @click="goBack">‹</text>
        <text class="title">在线沟通</text>
        <text class="right" @click="openDetail">详情</text>
      </view>
    </view>

    <view v-if="detail" class="target" @click="openDetail">
      <text class="target-icon">{{ detail.sdType === 'supply' ? '📦' : '🛒' }}</text>
      <view class="target-copy">
        <text class="target-title">{{ detail.title }}</text>
        <text class="tiny">{{ money(detail.price) }} {{ detail.priceUnit }} · {{ detail.quantity }} · 剩余 {{ detail.durationDays }} 天</text>
      </view>
      <text class="item-arrow">›</text>
    </view>

    <scroll-view scroll-y class="chat" :scroll-into-view="scrollInto" :scroll-with-animation="true">
      <view class="chat-inner">
        <view v-if="loading" class="loading">正在加载会话…</view>
        <view v-else-if="!messages.length" class="empty" style="min-height: 320rpx">
          <text class="empty-icon">💬</text>
          <text>还没有对话，打个招呼开始议价</text>
        </view>

        <view v-for="item in messages" :key="item.id" :class="['msg', isMine(item) ? 'mine' : 'other']">
          <view class="avatar">{{ (item.fromName || '对').slice(0, 1) }}</view>
          <view class="bubble-wrap">
            <view class="bubble">
              <text class="bubble-text">{{ item.content }}</text>
            </view>
            <text class="time">{{ item.fromName }} · {{ timeAgo(item.createdAt) }}</text>
          </view>
        </view>

        <view v-if="priceHint" class="ai-tip">
          <text class="ai-tag">AI 议价助手</text>
          <text class="ai-text">{{ priceHint }}</text>
          <text class="tiny">✦ 基于平台行情数据生成 · 仅供参考</text>
        </view>

        <view id="chat-end" style="height: 16rpx" />
      </view>
    </scroll-view>

    <view class="quick-row">
      <scroll-view scroll-x :show-scrollbar="false" class="quick-scroll">
        <text v-for="item in quickReplies" :key="item" class="quick" @click="send(item)">{{ item }}</text>
      </scroll-view>
    </view>

    <view class="input-bar">
      <input
        v-model="text"
        class="chat-input"
        placeholder="输入消息，支持议价与交期沟通"
        placeholder-class="ph"
        confirm-type="send"
        @confirm="send()"
      />
      <button class="send-btn" :disabled="sending" @click="send()">发送</button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.chat-page {
  display: flex;
  height: 100vh;
  flex-direction: column;
  overflow: hidden;
  background: #f4f7f5;
}

.nav-holder {
  background: #ffffff;
}

.target {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 16rpx 24rpx;
  border-bottom: 1rpx solid #edf2ee;
  background: #ffffff;
}

.target-icon {
  font-size: 28rpx;
}

.target-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 3rpx;
}

.target-title {
  overflow: hidden;
  font-size: 25rpx;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat {
  flex: 1;
  overflow: hidden;
}

.chat-inner {
  padding: 20rpx 24rpx 0;
}

.msg {
  display: flex;
  gap: 12rpx;
  margin-bottom: 22rpx;
}

.msg.mine {
  flex-direction: row-reverse;
}

.avatar {
  display: flex;
  width: 60rpx;
  height: 60rpx;
  flex: 0 0 60rpx;
  align-items: center;
  justify-content: center;
  border-radius: 18rpx;
  background: #e5f5eb;
  color: #0e5233;
  font-size: 24rpx;
  font-weight: 700;
}

.msg.mine .avatar {
  background: #12764a;
  color: #ffffff;
}

.bubble-wrap {
  display: flex;
  max-width: 76%;
  flex-direction: column;
  gap: 5rpx;
}

.msg.mine .bubble-wrap {
  align-items: flex-end;
}

.bubble {
  padding: 18rpx 20rpx;
  border-radius: 18rpx;
  background: #ffffff;
}

.msg.mine .bubble {
  background: linear-gradient(135deg, #159a5e, #12764a);
  color: #ffffff;
}

.bubble-text {
  font-size: 25rpx;
  line-height: 1.68;
}

.time {
  color: #b3c0b7;
  font-size: 24rpx;
}

.ai-tip {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  margin: 10rpx 0 20rpx;
  padding: 18rpx;
  border: 1rpx solid #e2d4ec;
  border-radius: 18rpx;
  background: #faf7fc;
}

.ai-tag {
  color: #6b418d;
  font-size: 24rpx;
  font-weight: 700;
}

.ai-text {
  color: #53665a;
  font-size: 24rpx;
  line-height: 1.66;
}

.quick-row {
  padding: 8rpx 0;
  background: #ffffff;
}

.quick-scroll {
  padding: 0 20rpx;
  white-space: nowrap;
}

.quick {
  display: inline-flex;
  margin-right: 12rpx;
  padding: 10rpx 18rpx;
  border: 1rpx dashed #cfe0d6;
  border-radius: 14rpx;
  color: #53665a;
  font-size: 24rpx;
}

.input-bar {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 12rpx 20rpx calc(12rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid #e8efea;
  background: #ffffff;
}

.chat-input {
  flex: 1;
  height: 72rpx;
  padding: 0 20rpx;
  border-radius: 16rpx;
  background: #f2f5f3;
  font-size: 24rpx;
}

.ph {
  color: #b3c0b7;
}

.send-btn {
  display: flex;
  height: 72rpx;
  align-items: center;
  justify-content: center;
  padding: 0 26rpx;
  border-radius: 16rpx;
  background: linear-gradient(135deg, #159a5e, #12764a);
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 650;
}
</style>
