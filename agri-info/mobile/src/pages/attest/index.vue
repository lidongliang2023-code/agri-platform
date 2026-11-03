<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { infoApi, timeAgo, toast, type Attestation } from '../../api'

const items = ref<Attestation[]>([])
const type = ref('')
const loading = ref(true)

const types = ['全部', '行情资讯', '农技知识', '培训课程', '用户评价']

const filtered = computed(() =>
  type.value && type.value !== '全部'
    ? items.value.filter((item) => item.contentType === type.value)
    : items.value,
)

const todayCount = computed(() => {
  const today = new Date().toISOString().slice(0, 10)
  return items.value.filter((item) => String(item.attestedAt || '').startsWith(today)).length
})

const confirmedRate = computed(() => {
  if (!items.value.length) return 100
  const ok = items.value.filter((item) => item.status === 'valid' || item.status === 'confirmed').length
  return Math.round((ok / items.value.length) * 100)
})

onShow(() => {
  load()
})

async function load() {
  loading.value = true
  try {
    items.value = await infoApi.attestations()
  } catch (error) {
    toast(error instanceof Error ? error.message : '加载失败')
  } finally {
    loading.value = false
  }
}

function open(id: number) {
  uni.navigateTo({ url: `/pages/attest/detail?id=${id}` })
}

function toVerify() {
  uni.navigateTo({ url: '/pages/attest/verify' })
}

function iconOf(contentType: string) {
  if (contentType === '农技知识') return '🌱'
  if (contentType === '培训课程') return '🎓'
  if (contentType === '用户评价') return '⭐'
  return '📈'
}
</script>

<template>
  <view class="page">
    <view class="head">
      <view class="stat-grid">
        <view class="stat-cell">
          <text class="stat-num light">{{ items.length }}</text>
          <text class="stat-label light">我的存证</text>
        </view>
        <view class="stat-cell">
          <text class="stat-num light">{{ todayCount }}</text>
          <text class="stat-label light">今日上链</text>
        </view>
        <view class="stat-cell">
          <text class="stat-num light">{{ confirmedRate }}%</text>
          <text class="stat-label light">链上确认率</text>
        </view>
      </view>
      <view class="verify-entry" @click="toVerify">🔍 验证一条内容是否被篡改 ›</view>
    </view>

    <view class="page-pad">
      <scroll-view scroll-x class="chips" :show-scrollbar="false">
        <view
          v-for="item in types"
          :key="item"
          :class="['chip', { active: (type || '全部') === item }]"
          @click="type = item === '全部' ? '' : item"
        >
          {{ item }}
        </view>
      </scroll-view>

      <view v-if="loading" class="loading">正在加载…</view>
      <view v-else-if="!filtered.length" class="empty">
        <text class="empty-icon">🔗</text>
        <text>暂无该类存证记录</text>
      </view>

      <view v-else class="card">
        <view v-for="item in filtered" :key="item.id" class="list-item" @click="open(item.id)">
          <view class="item-icon">{{ iconOf(item.contentType) }}</view>
          <view class="item-body">
            <text class="item-title clamp-2">{{ item.title }}</text>
            <text class="item-sub">{{ item.contentType }} · {{ item.attestNo }}</text>
            <view class="meta">
              <text class="tiny">区块 {{ item.blockHeight }}</text>
              <text class="tiny">{{ timeAgo(item.attestedAt) }}</text>
            </view>
          </view>
          <text class="tag green">已验证</text>
        </view>
      </view>

      <view class="notice" style="margin-top: 16rpx">
        <text>✦</text>
        <text>内容审核通过后自动计算 SHA-256 哈希并上链，链上仅保存哈希与元数据。哈希比对一致即证明内容未被篡改，可在「内容验证」中随时复核。</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.head {
  padding: 26rpx 24rpx 24rpx;
  background: radial-gradient(circle at 92% 0, rgba(83, 213, 138, 0.24), transparent 380rpx), linear-gradient(145deg, #073821, #0d5d3b);
  color: #ffffff;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10rpx;
}

.stat-num.light {
  color: #ffffff;
}

.stat-label.light {
  color: rgba(255, 255, 255, 0.55);
}

.verify-entry {
  margin-top: 22rpx;
  padding: 16rpx 20rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.18);
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.1);
  font-size: 22rpx;
  text-align: center;
}

.chips {
  margin: 16rpx 0;
  white-space: nowrap;
}

.meta {
  display: flex;
  gap: 12rpx;
  margin-top: 3rpx;
}
</style>
