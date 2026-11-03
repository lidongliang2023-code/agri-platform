<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { infoApi, money, timeAgo, toast, type SupplyDemand } from '../../api'

const items = ref<SupplyDemand[]>([])
const onlineCount = ref(0)
const pendingCount = ref(0)
const status = ref('all')
const loading = ref(true)

const tabs = [
  { key: 'all', label: '全部' },
  { key: 'online', label: '展示中' },
  { key: 'pending', label: '审核中' },
  { key: 'expired', label: '已过期' },
  { key: 'offline', label: '已下架' },
]

const filtered = computed(() =>
  status.value === 'all' ? items.value : items.value.filter((item) => item.status === status.value),
)

const totalViews = computed(() => items.value.reduce((sum, item) => sum + (item.viewCount || 0), 0))
const totalChats = computed(() => items.value.reduce((sum, item) => sum + (item.chatCount || 0), 0))

onShow(() => {
  load()
})

async function load() {
  loading.value = true
  try {
    const result = await infoApi.mySupplyDemands()
    items.value = result.items || []
    onlineCount.value = result.onlineCount || 0
    pendingCount.value = result.pendingCount || 0
  } catch (error) {
    toast(error instanceof Error ? error.message : '加载失败')
  } finally {
    loading.value = false
  }
}

function openDetail(item: SupplyDemand) {
  uni.navigateTo({ url: `/pages/sd/detail?id=${item.id}` })
}

function openMatch(item: SupplyDemand) {
  uni.navigateTo({ url: `/pages/sd/match?id=${item.id}` })
}

function publish() {
  uni.navigateTo({ url: '/pages/sd/publish?type=supply' })
}

function repost(item: SupplyDemand) {
  uni.setStorageSync('info_sd_repost', {
    sdType: item.sdType,
    category: item.category,
    variety: item.variety,
    spec: item.spec,
    quantity: item.quantity,
    price: String(item.price),
    origin: item.origin,
    duration: item.durationDays,
  })
  uni.navigateTo({ url: `/pages/sd/publish?type=${item.sdType}` })
}

function statusTone(value: string) {
  if (value === 'online') return 'green'
  if (value === 'pending') return 'orange'
  if (value === 'rejected') return 'red'
  return 'gray'
}

function statusLabel(value: string) {
  const map: Record<string, string> = {
    online: '展示中',
    pending: '审核中',
    expired: '已过期',
    offline: '已下架',
    rejected: '已驳回',
  }
  return map[value] || value
}
</script>

<template>
  <view class="page">
    <view class="head">
      <view class="stat-grid">
        <view class="stat-cell">
          <text class="stat-num light">{{ totalViews }}</text>
          <text class="stat-label light">累计浏览</text>
        </view>
        <view class="stat-cell">
          <text class="stat-num light">{{ totalChats }}</text>
          <text class="stat-label light">收到询价</text>
        </view>
        <view class="stat-cell">
          <text class="stat-num light">{{ onlineCount }}</text>
          <text class="stat-label light">展示中</text>
        </view>
        <view class="stat-cell">
          <text class="stat-num light">{{ pendingCount }}</text>
          <text class="stat-label light">审核中</text>
        </view>
      </view>
    </view>

    <view class="page-pad">
      <scroll-view scroll-x class="chips" :show-scrollbar="false">
        <view
          v-for="item in tabs"
          :key="item.key"
          :class="['chip', { active: status === item.key }]"
          @click="status = item.key"
        >
          {{ item.label }}
        </view>
      </scroll-view>

      <view v-if="loading" class="loading">正在加载…</view>
      <view v-else-if="!filtered.length" class="empty">
        <text class="empty-icon">📦</text>
        <text>还没有发布过供需信息</text>
        <button class="btn btn-ghost btn-sm" style="margin-top: 12rpx" @click="publish">立即发布</button>
      </view>

      <view v-else>
        <view v-for="item in filtered" :key="item.id" class="post-card" @click="openDetail(item)">
          <view class="post-top">
            <text class="post-icon">{{ item.sdType === 'supply' ? '📦' : '🛒' }}</text>
            <view class="post-copy">
              <text class="post-title">{{ item.title }}</text>
              <text class="tiny">{{ item.origin }} · {{ item.quantity }} · {{ money(item.price) }} {{ item.priceUnit }}</text>
            </view>
            <text :class="['tag', statusTone(item.status)]">{{ statusLabel(item.status) }}</text>
          </view>

          <view class="post-meta">
            <text class="tiny">👁 {{ item.viewCount }}</text>
            <text class="tiny">💬 {{ item.chatCount }}</text>
            <text class="tiny">✦ 匹配 {{ item.matchScore }}%</text>
            <text class="tiny">发布于 {{ timeAgo(item.createdAt) }}</text>
          </view>

          <view v-if="item.auditNote" class="notice" style="margin-top: 10rpx">
            <text>·</text>
            <text>审核意见：{{ item.auditNote }}</text>
          </view>

          <view class="post-actions">
            <text class="act" @click.stop="openMatch(item)">智能匹配</text>
            <text v-if="item.status === 'expired'" class="act primary" @click.stop="repost(item)">一键重新发布</text>
            <text v-else class="act" @click.stop="openDetail(item)">查看详情</text>
          </view>
        </view>
      </view>

      <button class="btn btn-primary btn-block" style="margin-top: 12rpx" @click="publish">
        ＋ 发布新的供需信息
      </button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.head {
  padding: 24rpx;
  background: radial-gradient(circle at 92% 0, rgba(83, 213, 138, 0.24), transparent 380rpx), linear-gradient(145deg, #073821, #0d5d3b);
  color: #ffffff;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8rpx;
}

.stat-num.light {
  color: #ffffff;
}

.stat-label.light {
  color: rgba(255, 255, 255, 0.55);
}

.chips {
  margin-bottom: 16rpx;
  white-space: nowrap;
}

.post-card {
  margin-bottom: 16rpx;
  padding: 22rpx;
  border: 1rpx solid #e1e9e3;
  border-radius: 22rpx;
  background: #ffffff;
}

.post-top {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
}

.post-icon {
  font-size: 30rpx;
}

.post-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4rpx;
}

.post-title {
  font-size: 26rpx;
  font-weight: 650;
  line-height: 1.42;
}

.post-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
  margin-top: 12rpx;
}

.post-actions {
  display: flex;
  justify-content: flex-end;
  gap: 20rpx;
  margin-top: 14rpx;
  padding-top: 12rpx;
  border-top: 1rpx solid #f1f5f2;
}

.act {
  color: #12764a;
  font-size: 21rpx;
  font-weight: 600;
}

.act.primary {
  padding: 4rpx 14rpx;
  border-radius: 10rpx;
  background: #eef7f2;
}
</style>
