<script setup lang="ts">
import { ref } from 'vue'
import { serviceApi } from '../../api'

const text = ref('')
const example = '叶片从下部开始出现红褐色斑点，近期连续阴雨，约 3 亩出现类似症状。'
const diagnosis = ref<{ consultNo: string; level: string; suggestion: string; matchedDiseases: string[] } | null>(null)
const loading = ref(false)
const statusBarHeight = ref(Number(uni.getSystemInfoSync().statusBarHeight || 0))

async function diagnose() {
  if (!text.value.trim()) {
    uni.showToast({ title: '先描述一下田间情况', icon: 'none' })
    return
  }
  loading.value = true
  try {
    diagnosis.value = await serviceApi.diagnose({ subject: '农事问题初判', crop: '水稻', content: text.value })
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '诊断失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function back() {
  uni.switchTab({ url: '/pages/home/index' })
}

function toServices() {
  uni.switchTab({ url: '/pages/services/index' })
}

/** 本版没有语音与图像识别通道，按钮只保留真正能做的事。 */
function useExample() {
  text.value = example
}
</script>

<template>
  <view class="page ai-page">
    <view class="ai-nav" :style="{ paddingTop: `${statusBarHeight + 10}px` }"><text class="back" @click="back">‹</text><text class="nav-title">AI 农事助手</text><text class="nav-right" @click="toServices">服务</text></view>
    <view class="chat">
      <view class="robot-message"><view class="robot-icon">🤖</view><view><text class="strong">我是丰小耘，您的 AI 农事助手。</text><text class="muted">用文字描述田间情况，我给出风险等级、初步判断与处置建议，并可直接查看匹配服务。</text></view></view>
      <view class="user-message">{{ text }}</view>
      <view v-if="!diagnosis" class="upload-grid"><button @click="useExample"><text>✍️</text><text>用示例描述试一次</text></button></view>
      <view v-else class="result-card"><view class="between"><text class="tag orange">{{ diagnosis.level }}</text><text class="tiny">{{ diagnosis.consultNo }}</text></view><text class="result-title">初步判断与处置建议</text><text class="result-text">{{ diagnosis.suggestion }}</text><view class="matched"><text v-for="item in diagnosis.matchedDiseases" :key="item">{{ item }}</text></view><button class="btn btn-primary btn-block" @click="toServices">查看匹配服务</button></view>
      <view class="quick-topics"><text v-for="topic in ['水稻病虫害','飞防报价','补贴政策','土地合同']" :key="topic" @click="text = topic">{{ topic }}</text></view>
    </view>
    <view class="chat-input safe-bottom"><input v-model="text" placeholder="描述您的农事问题…" /><button class="btn btn-sm btn-primary" :loading="loading" @click="diagnose">发送</button></view>
  </view>
</template>

<style lang="scss" scoped>
.ai-page { background: linear-gradient(180deg, #f3ebf8 0 480rpx, #f4f7f5 480rpx); padding-bottom: 140rpx; }
.ai-nav { display: flex; align-items: center; padding-right: 24rpx; padding-bottom: 14rpx; padding-left: 16rpx; }
.back { width: 70rpx; font-size: 56rpx; font-weight: 300; }
.nav-title { flex: 1; font-size: 32rpx; font-weight: 700; text-align: center; }
.nav-right { width: 70rpx; font-size: 32rpx; text-align: right; }
.chat { display: flex; flex-direction: column; gap: 20rpx; padding: 12rpx 24rpx; }
.robot-message { display: flex; align-items: flex-start; gap: 14rpx; }
.robot-icon { display: flex; width: 64rpx; height: 64rpx; flex: 0 0 64rpx; align-items: center; justify-content: center; border-radius: 18rpx; background: linear-gradient(135deg,#765098,#553274); font-size: 30rpx; }
.robot-message > view:last-child { display: flex; flex-direction: column; gap: 7rpx; padding: 20rpx; border: 1rpx solid #e2d7ea; border-radius: 5rpx 22rpx 22rpx 22rpx; background: rgba(255,255,255,.82); }
.user-message { align-self: flex-end; max-width: 78%; padding: 20rpx; border-radius: 22rpx 5rpx 22rpx 22rpx; background: #12764a; color: #fff; font-size: 23rpx; line-height: 1.6; }
.upload-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14rpx; }
.upload-grid button { display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 8rpx; padding: 22rpx; border: 1rpx dashed #cfdace; border-radius: 18rpx; background: rgba(255,255,255,.65); color: #6b418d; }
.upload-grid button text:first-child { font-size: 34rpx; }
.upload-grid button text:last-child { color: #53665a; font-size: 21rpx; }
.result-card { display: flex; flex-direction: column; gap: 13rpx; padding: 24rpx; border: 1rpx solid #dfd2e8; border-radius: 22rpx; background: #fff; }
.result-title { font-size: 25rpx; font-weight: 700; }
.result-text { color: #53665a; font-size: 22rpx; line-height: 1.75; }
.matched { display: flex; gap: 8rpx; flex-wrap: wrap; }
.matched text { padding: 4rpx 10rpx; border-radius: 14rpx; background: #f2eafa; color: #6b418d; font-size: 18rpx; }
.quick-topics { display: flex; gap: 8rpx; flex-wrap: wrap; }
.quick-topics text { padding: 9rpx 14rpx; border: 1rpx solid #e0d7e6; border-radius: 24rpx; background: rgba(255,255,255,.7); color: #6b418d; font-size: 19rpx; }
.chat-input { position: fixed; right: 0; bottom: 0; left: 0; z-index: 20; display: flex; align-items: center; gap: 12rpx; padding: 14rpx 24rpx; border-top: 1rpx solid #e1e9e3; background: rgba(255,255,255,.97); }
.chat-input input { height: 70rpx; flex: 1; padding: 0 18rpx; border: 1rpx solid #e1e9e3; border-radius: 16rpx; background: #f6f9f7; font-size: 21rpx; }
.chat-input .btn { min-height: 64rpx; }
</style>
