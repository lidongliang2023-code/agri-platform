<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { infoApi, timeAgo, type Overview } from '../../api'
import { currentOwner, isLoggedIn } from '../../auth'

const overview = ref<Overview | null>(null)
const keyword = ref('')
const activeChannel = ref('推荐')
const statusBarHeight = ref(0)
const loading = ref(true)

const channels = computed(() => {
  const list = overview.value?.channels?.map((item) => item.name) || []
  return ['推荐', ...list.filter((name) => name !== '推荐')]
})

const feed = computed(() => {
  const items = overview.value?.feed || []
  if (activeChannel.value === '推荐') return items
  return items.filter((item) => item.channel === activeChannel.value)
})

const unread = computed(() => overview.value?.stats?.unreadAlerts || 0)
const owner = computed(() => currentOwner() || overview.value?.greeting?.owner || '平台用户')

const entries = [
  { icon: '🤝', label: '供需大厅', url: '/pages/sd/index' },
  { icon: '📑', label: '数据报告', url: '/pages/report/mine' },
  { icon: '🔗', label: '内容存证', url: '/pages/attest/index' },
  { icon: '🎖', label: '专家认证', url: '/pages/expert/cert' },
  { icon: '📈', label: '实时行情', tab: '/pages/market/index' },
  { icon: '📊', label: '价格指数', url: '/pages/market/price-index' },
  { icon: '🔔', label: '价格预警', url: '/pages/alert/setup' },
  { icon: '⭐', label: '我的订阅', url: '/pages/subscription/index' },
]

onShow(() => {
  if (!isLoggedIn()) {
    uni.reLaunch({ url: '/pages/login/index' })
    return
  }
  try {
    statusBarHeight.value = Number(uni.getSystemInfoSync().statusBarHeight || 0)
  } catch {
    statusBarHeight.value = 0
  }
  load()
})

async function load() {
  loading.value = true
  try {
    overview.value = await infoApi.overview()
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function go(url: string, tab = false) {
  if (tab) {
    uni.switchTab({ url })
    return
  }
  uni.navigateTo({ url })
}

function onEntry(entry: { url?: string; tab?: string }) {
  if (entry.tab) go(entry.tab, true)
  else if (entry.url) go(entry.url)
}

function openChannel(name: string) {
  if (name === '推荐') return
  uni.navigateTo({ url: `/pages/news/channel?channel=${encodeURIComponent(name)}` })
}

function openArticle(id: number) {
  uni.navigateTo({ url: `/pages/news/article?id=${id}` })
}

function doSearch() {
  uni.navigateTo({ url: `/pages/search/index?keyword=${encodeURIComponent(keyword.value)}` })
}

function openMessages() {
  uni.navigateTo({ url: '/pages/message/index' })
}

function openAlerts() {
  uni.navigateTo({ url: '/pages/alert/messages' })
}

function openVariety(id: number) {
  uni.navigateTo({ url: `/pages/market/variety?id=${id}` })
}
</script>

<template>
  <view class="page news-home">
    <view class="home-hero" :style="{ paddingTop: `${statusBarHeight + 16}px` }">
      <view class="home-nav">
        <view class="city">
          <text class="city-name">山东 · 潍坊</text>
          <text class="city-caret">▾</text>
        </view>
        <view class="bell" @click="openMessages">
          🔔
          <text v-if="unread">{{ unread }}</text>
        </view>
      </view>

      <view class="greeting">
        <text class="small">您好，{{ owner }}</text>
        <text class="title">今天有什么可以帮您？</text>
      </view>

      <view class="search-box">
        <text class="search-icon">⌕</text>
        <input
          v-model="keyword"
          placeholder="搜资讯 · 查行情 · 问农技"
          placeholder-class="ph"
          confirm-type="search"
          @confirm="doSearch"
        />
      </view>

      <scroll-view scroll-x class="ticker" :show-scrollbar="false">
        <view class="ticker-inner">
          <text class="ticker-badge">快讯</text>
          <text v-for="(line, index) in overview?.ticker || []" :key="index" class="ticker-line">{{ line }}</text>
        </view>
      </scroll-view>
    </view>

    <view class="page-body">
      <view v-if="overview?.aiBrief" class="ai-card brief" @click="openArticle(overview.aiBrief.articleId)">
        <view class="ai-icon">✦</view>
        <view class="ai-copy">
          <text>{{ overview.aiBrief.title }}</text>
          <text>{{ overview.aiBrief.lines[0] }}</text>
          <text>置信度 {{ overview.aiBrief.confidence }}% · 点击查看完整解读</text>
        </view>
        <text class="arrow">›</text>
      </view>

      <view class="card quick-card">
        <view v-for="entry in entries" :key="entry.label" class="quick-item" @click="onEntry(entry)">
          <view class="quick-icon">{{ entry.icon }}</view>
          <text>{{ entry.label }}</text>
        </view>
      </view>

      <view v-if="unread" class="alert-banner" @click="openAlerts">
        <text class="alert-icon">🔔</text>
        <view class="alert-copy">
          <text class="strong">{{ unread }} 条价格预警待查看</text>
          <text class="tiny">突破阈值第一时间推送，点击查看详情</text>
        </view>
        <text class="arrow">›</text>
      </view>

      <scroll-view scroll-x class="chips channel-chips" :show-scrollbar="false">
        <view
          v-for="name in channels"
          :key="name"
          :class="['chip', { active: activeChannel === name }]"
          @click="activeChannel = name"
        >
          {{ name }}
        </view>
      </scroll-view>

      <view class="section-head">
        <text class="section-title">今日要闻</text>
        <text class="card-sub" @click="openChannel(activeChannel)">更多 ›</text>
      </view>

      <view v-if="loading" class="loading">正在加载资讯…</view>
      <view v-else-if="!feed.length" class="empty">
        <text class="empty-icon">📰</text>
        <text>该频道暂无内容</text>
      </view>

      <view v-else class="card feed-card">
        <view v-for="item in feed" :key="item.id" class="feed-item" @click="openArticle(item.id)">
          <view class="feed-cover">
            <text class="feed-icon">{{ item.coverIcon }}</text>
            <text v-if="item.contentType === 'video'" class="feed-play">▶</text>
            <text v-if="item.aiGenerated" class="feed-ai">AI</text>
          </view>
          <view class="feed-body">
            <text class="item-title clamp-2">{{ item.title }}</text>
            <text class="feed-summary">{{ item.summary }}</text>
            <view class="feed-meta">
              <text class="tag green">{{ item.channel }}</text>
              <text class="tiny">{{ item.author }}</text>
              <text class="tiny">{{ timeAgo(item.publishedAt) }}</text>
              <text class="tiny">👁 {{ item.readCount }}</text>
            </view>
          </view>
        </view>
        <view class="feed-end">— 已为你加载全部推荐 —</view>
      </view>

      <view class="section-head">
        <text class="section-title">热门行情</text>
        <text class="card-sub" @click="go('/pages/market/index', true)">全部 ›</text>
      </view>
      <view class="card hot-card">
        <view
          v-for="hot in overview?.hotRank || []"
          :key="hot.quoteId"
          class="hot-item"
          @click="openVariety(hot.quoteId)"
        >
          <text class="hot-icon">{{ hot.icon }}</text>
          <view class="hot-copy">
            <text class="strong">{{ hot.name }}</text>
            <text class="tiny">{{ hot.origin }}</text>
          </view>
          <view class="hot-right">
            <text class="hot-price">{{ hot.price }}</text>
            <text :class="['chg', hot.changePct >= 0 ? 'up' : 'down']">
              {{ hot.changePct >= 0 ? '↑' : '↓' }} {{ Math.abs(hot.changePct).toFixed(1) }}%
            </text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.news-home {
  background: #f4f7f5;
}

.home-hero {
  padding: 0 28rpx 34rpx;
  border-radius: 0 0 40rpx 40rpx;
  background: radial-gradient(circle at 90% 6%, rgba(83, 213, 138, 0.28), transparent 430rpx), linear-gradient(145deg, #073821, #0d5d3b);
  color: #ffffff;
}

.home-nav {
  display: flex;
  height: 70rpx;
  align-items: center;
  justify-content: space-between;
}

.city {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.city-name {
  font-size: 28rpx;
  font-weight: 650;
}

.city-caret {
  color: rgba(255, 255, 255, 0.6);
  font-size: 20rpx;
}

.bell {
  position: relative;
  display: flex;
  width: 68rpx;
  height: 68rpx;
  align-items: center;
  justify-content: center;
  border: 1rpx solid rgba(255, 255, 255, 0.14);
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.08);
  font-size: 30rpx;
}

.bell text {
  position: absolute;
  top: -4rpx;
  right: -4rpx;
  min-width: 30rpx;
  height: 30rpx;
  padding: 0 5rpx;
  border: 3rpx solid #0d4e32;
  border-radius: 16rpx;
  background: #e44949;
  font-size: 16rpx;
  line-height: 27rpx;
  text-align: center;
}

.greeting {
  display: flex;
  flex-direction: column;
  gap: 7rpx;
  margin-top: 22rpx;
}

.greeting .small {
  color: rgba(255, 255, 255, 0.55);
  font-size: 22rpx;
}

.greeting .title {
  font-size: 42rpx;
  font-weight: 750;
}

.search-box {
  display: flex;
  height: 82rpx;
  align-items: center;
  gap: 12rpx;
  margin-top: 22rpx;
  padding: 0 22rpx;
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.95);
}

.search-icon {
  color: #94a198;
  font-size: 30rpx;
}

.search-box input {
  height: 100%;
  flex: 1;
  color: #0b1a12;
  font-size: 24rpx;
}

.ph {
  color: #b3c0b7;
}

.ticker {
  width: 100%;
  margin-top: 18rpx;
  white-space: nowrap;
}

.ticker-inner {
  display: inline-flex;
  align-items: center;
  gap: 18rpx;
  padding: 10rpx 18rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.1);
  border-radius: 16rpx;
  background: rgba(1, 28, 15, 0.2);
}

.ticker-badge {
  padding: 2rpx 10rpx;
  border-radius: 8rpx;
  background: rgba(255, 255, 255, 0.16);
  font-size: 18rpx;
}

.ticker-line {
  color: rgba(255, 255, 255, 0.78);
  font-size: 20rpx;
}

.page-body {
  padding: 18rpx 24rpx 40rpx;
}

.brief {
  margin-top: -46rpx;
  box-shadow: 0 12rpx 30rpx rgba(63, 34, 82, 0.08);
}

.arrow {
  color: #a395ab;
  font-size: 34rpx;
}

.quick-card {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24rpx 4rpx;
  padding: 28rpx 12rpx;
}

.quick-item {
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 9rpx;
  font-size: 21rpx;
}

.quick-icon {
  display: flex;
  width: 82rpx;
  height: 82rpx;
  align-items: center;
  justify-content: center;
  border-radius: 23rpx;
  background: #e5f5eb;
  font-size: 38rpx;
}

.alert-banner {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-bottom: 20rpx;
  padding: 20rpx;
  border: 1rpx solid #f0d9d9;
  border-radius: 20rpx;
  background: #fdf5f5;
}

.alert-icon {
  font-size: 30rpx;
}

.alert-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4rpx;
}

.channel-chips {
  margin: 4rpx 0 6rpx;
}

.feed-card {
  padding: 6rpx 26rpx;
}

.feed-item {
  display: flex;
  gap: 18rpx;
  padding: 22rpx 0;
  border-bottom: 1rpx solid #edf2ee;
}

.feed-item:last-of-type {
  border-bottom: 0;
}

.feed-cover {
  position: relative;
  display: flex;
  width: 150rpx;
  height: 150rpx;
  flex: 0 0 150rpx;
  align-items: center;
  justify-content: center;
  border-radius: 18rpx;
  background: linear-gradient(135deg, #eef6f1, #e2f0e8);
}

.feed-icon {
  font-size: 54rpx;
}

.feed-play {
  position: absolute;
  right: 10rpx;
  bottom: 8rpx;
  color: #0e5233;
  font-size: 20rpx;
}

.feed-ai {
  position: absolute;
  top: 8rpx;
  left: 8rpx;
  padding: 1rpx 8rpx;
  border-radius: 6rpx;
  background: #765097;
  color: #ffffff;
  font-size: 16rpx;
}

.feed-body {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 6rpx;
}

.feed-summary {
  overflow: hidden;
  color: #718277;
  font-size: 21rpx;
  line-height: 1.5;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.feed-meta {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-top: 2rpx;
}

.feed-end {
  padding: 20rpx 0 24rpx;
  color: #b3c0b7;
  font-size: 20rpx;
  text-align: center;
}

.hot-card {
  padding: 8rpx 26rpx;
}

.hot-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #edf2ee;
}

.hot-item:last-child {
  border-bottom: 0;
}

.hot-icon {
  font-size: 34rpx;
}

.hot-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4rpx;
}

.hot-right {
  display: flex;
  align-items: flex-end;
  flex-direction: column;
  gap: 4rpx;
}

.hot-price {
  font-family: "DIN Alternate", monospace;
  font-size: 28rpx;
  font-weight: 700;
}
</style>
