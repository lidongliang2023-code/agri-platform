<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { infoApi, toast, type QaRecord } from '../../api'

const records = ref<QaRecord[]>([])
const loading = ref(true)

onShow(() => {
  load()
})

async function load() {
  loading.value = true
  try {
    records.value = await infoApi.qaRecords()
  } catch (error) {
    toast(error instanceof Error ? error.message : '加载失败')
  } finally {
    loading.value = false
  }
}

function askAgain(record: QaRecord) {
  uni.setStorageSync('info_ai_question', record.question)
  uni.switchTab({ url: '/pages/ai/index' })
}

function newQuestion() {
  uni.switchTab({ url: '/pages/ai/index' })
}
</script>

<template>
  <view class="page">
    <view class="page-pad">
      <view v-if="loading" class="loading">正在加载…</view>
      <view v-else-if="!records.length" class="empty">
        <text class="empty-icon">🤖</text>
        <text>还没有提问记录</text>
      </view>

      <view v-else class="card list-card">
        <view v-for="record in records" :key="record.id" class="list-item" @click="askAgain(record)">
          <view class="item-icon">{{ record.expertName ? '👨‍🌾' : '🤖' }}</view>
          <view class="item-body">
            <text class="item-title clamp-2">{{ record.question }}</text>
            <text class="item-sub">{{ record.expertName ? `${record.expertName}：` : 'AI：' }}{{ record.answer }}</text>
            <view class="meta">
              <text class="tiny">{{ record.createdAt }}</text>
              <text v-if="record.confidence" class="tag green">置信度 {{ record.confidence }}%</text>
              <text v-if="record.crop" class="tag gray">{{ record.crop }}</text>
            </view>
          </view>
          <text class="item-arrow">›</text>
        </view>
      </view>

      <button class="btn btn-primary btn-block" style="margin-top: 8rpx" @click="newQuestion">
        🤖 开始新的提问
      </button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.meta {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-top: 4rpx;
}
</style>
