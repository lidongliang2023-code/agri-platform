<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { infoApi, money, signed, type MarketData } from '../../api'
import { isLoggedIn } from '../../auth'

const data = ref<MarketData | null>(null)
const category = ref('')
const keyword = ref('')
const statusBarHeight = ref(0)
const loading = ref(true)

const categories = computed(() => ['全部', ...(data.value?.categories || [])])
const quotes = computed(() => data.value?.quotes || [])
const stats = computed(() => data.value?.stats)

const brief = computed(() => {
  const list = quotes.value.slice(0, 6)
  const up = list.filter((item) => item.changePct > 0).slice(0, 3)
  const down = list.filter((item) => item.changePct < 0).slice(0, 2)
  const fmt = (item: { name: string; changePct: number }) =>
    `${item.name} ${item.changePct > 0 ? '+' : ''}${item.changePct.toFixed(1)}%`
  return [...up.map(fmt), ...down.map(fmt)].join('｜')
})

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
  const pending = uni.getStorageSync('info_market_keyword')
  if (pending) {
    keyword.value = String(pending)
    uni.removeStorageSync('info_market_keyword')
  }
  load()
})

async function load() {
  loading.value = true
  try {
    data.value = await infoApi.markets({
      category: category.value || undefined,
      keyword: keyword.value || undefined,
    })
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function switchCategory(name: string) {
  category.value = name === '全部' ? '' : name
  load()
}

function openVariety(id: number) {
  uni.navigateTo({ url: `/pages/market/variety?id=${id}` })
}

function openIndex() {
  uni.navigateTo({ url: '/pages/market/price-index' })
}

function openAlerts() {
  uni.navigateTo({ url: '/pages/alert/setup' })
}

function openSd() {
  uni.navigateTo({ url: '/pages/sd/index' })
}

function toSearch() {
  uni.navigateTo({ url: `/pages/search/index?keyword=${encodeURIComponent(keyword.value)}&scope=market` })
}
</script>

<template>
  <view class="page market-page">
    <view class="hero-block" :style="{ paddingTop: `${statusBarHeight + 14}px` }">
      <view class="hero-top">
        <view class="hero-title-row">
          <text class="hero-name">行情</text>
          <view class="index-entry" @click="openIndex">
            <text>价格指数</text>
            <text class="tiny">›</text>
          </view>
        </view>
        <view class="search-box" @click="toSearch">
          <text class="search-icon">⌕</text>
          <input
            v-model="keyword"
            placeholder="搜品种 / 搜市场"
            placeholder-class="ph"
            confirm-type="search"
            @confirm="load()"
          />
        </view>
        <view class="hero-stats">
          <view class="stat-cell">
            <text class="stat-num light">{{ stats?.total || 0 }}</text>
            <text class="stat-label light">监测品种</text>
          </view>
          <view class="stat-cell">
            <text class="stat-num rise">{{ stats?.up || 0 }}</text>
            <text class="stat-label light">上涨</text>
          </view>
          <view class="stat-cell">
            <text class="stat-num fall">{{ stats?.down || 0 }}</text>
            <text class="stat-label light">下跌</text>
          </view>
          <view class="stat-cell">
            <text class="stat-num light">{{ stats?.flat || 0 }}</text>
            <text class="stat-label light">持平</text>
          </view>
        </view>
      </view>
    </view>

    <view class="page-body">
      <view class="quick-row">
        <view class="quick-box" @click="openAlerts">
          <text class="quick-emoji">🔔</text>
          <view class="quick-copy">
            <text class="strong">价格预警</text>
            <text class="tiny">突破阈值即时推送</text>
          </view>
        </view>
        <view class="quick-box" @click="openSd">
          <text class="quick-emoji">🤝</text>
          <view class="quick-copy">
            <text class="strong">供需大厅</text>
            <text class="tiny">看行情 → 找货源</text>
          </view>
        </view>
      </view>

      <view v-if="brief" class="ticker">
        <text class="ticker-badge">快讯</text>
        <text class="ticker-text">{{ brief }}</text>
      </view>

      <scroll-view scroll-x class="chips" :show-scrollbar="false">
        <view
          v-for="name in categories"
          :key="name"
          :class="['chip', { active: (category || '全部') === name }]"
          @click="switchCategory(name)"
        >
          {{ name }}
        </view>
      </scroll-view>

      <view v-if="loading" class="loading">正在加载行情…</view>
      <view v-else-if="!quotes.length" class="empty">
        <text class="empty-icon">📈</text>
        <text>暂无该分类行情</text>
      </view>

      <view v-else class="quote-list">
        <view v-for="quote in quotes" :key="quote.id" class="quote-item" @click="openVariety(quote.id)">
          <view class="quote-icon">{{ quote.icon }}</view>
          <view class="quote-body">
            <view class="quote-name-row">
              <text class="quote-name">{{ quote.name }}</text>
              <text v-if="Math.abs(quote.changePct) >= 5" class="tag red">异动</text>
              <text v-else-if="quote.monitorLevel && quote.monitorLevel !== 'none'" class="tag orange">重点监测</text>
            </view>
            <text class="quote-sub">{{ quote.origin }} · {{ quote.spec }}</text>
            <text class="tiny">{{ quote.updatedAt }} 更新 · {{ quote.source }}</text>
          </view>
          <view class="quote-right">
            <text class="price">{{ money(quote.price) }}<text class="price-unit">{{ quote.priceUnit }}</text></text>
            <text :class="['chg', quote.changePct >= 0 ? 'up' : 'down']">
              {{ signed(quote.changeAmount) }} {{ signed(quote.changePct, 1) }}%
            </text>
          </view>
        </view>
      </view>

      <view v-if="data?.aiRead" class="ai-card" style="margin-top: 20rpx">
        <view class="ai-icon">✦</view>
        <view class="ai-copy">
          <text>AI 行情解读</text>
          <text>{{ data.aiRead.content }}</text>
          <text>置信度 {{ data.aiRead.confidence }}% · 仅供参考</text>
        </view>
      </view>

      <view class="foot-note">批发市场数据实时更新 · 产地价每日 18:00 更新</view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.market-page {
  background: #f4f7f5;
}

.hero-block {
  padding: 0 24rpx 26rpx;
  border-radius: 0 0 36rpx 36rpx;
  background: radial-gradient(circle at 92% 4%, rgba(83, 213, 138, 0.26), transparent 420rpx), linear-gradient(145deg, #073821, #0d5d3b);
  color: #ffffff;
}

.hero-title-row {
  display: flex;
  height: 70rpx;
  align-items: center;
  justify-content: space-between;
}

.hero-name {
  font-size: 34rpx;
  font-weight: 750;
}

.index-entry {
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 8rpx 16rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.16);
  border-radius: 14rpx;
  background: rgba(255, 255, 255, 0.1);
  font-size: 21rpx;
}

.index-entry .tiny {
  color: rgba(255, 255, 255, 0.7);
}

.search-box {
  display: flex;
  height: 76rpx;
  align-items: center;
  gap: 12rpx;
  margin-top: 14rpx;
  padding: 0 22rpx;
  border-radius: 18rpx;
  background: rgba(255, 255, 255, 0.95);
}

.search-icon {
  color: #94a198;
  font-size: 28rpx;
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

.hero-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8rpx;
  margin-top: 20rpx;
}

.stat-num.light {
  color: #ffffff;
}

.stat-num.rise {
  color: #ff8f8f;
}

.stat-num.fall {
  color: #8fe0a5;
}

.stat-label.light {
  color: rgba(255, 255, 255, 0.55);
}

.page-body {
  padding: 20rpx 24rpx 40rpx;
}

.quick-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
}

.quick-box {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 18rpx;
  border: 1rpx solid #e1e9e3;
  border-radius: 20rpx;
  background: #ffffff;
}

.quick-emoji {
  font-size: 32rpx;
}

.quick-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2rpx;
}

.ticker {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin: 16rpx 0 6rpx;
  padding: 14rpx 18rpx;
  border-radius: 16rpx;
  background: #fff8ec;
}

.ticker-badge {
  padding: 2rpx 10rpx;
  border-radius: 8rpx;
  background: #f6c56b;
  color: #6b4400;
  font-size: 18rpx;
}

.ticker-text {
  flex: 1;
  overflow: hidden;
  color: #8a5a10;
  font-size: 20rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chips {
  width: 100%;
  margin: 14rpx 0;
  white-space: nowrap;
}

.quote-list {
  border: 1rpx solid #e1e9e3;
  border-radius: 24rpx;
  background: #ffffff;
  overflow: hidden;
}

.quote-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 22rpx;
  border-bottom: 1rpx solid #edf2ee;
}

.quote-item:last-child {
  border-bottom: 0;
}

.quote-icon {
  display: flex;
  width: 78rpx;
  height: 78rpx;
  flex: 0 0 78rpx;
  align-items: center;
  justify-content: center;
  border-radius: 20rpx;
  background: #eef6f1;
  font-size: 36rpx;
}

.quote-body {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4rpx;
}

.quote-name-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.quote-name {
  font-size: 27rpx;
  font-weight: 650;
}

.quote-sub {
  overflow: hidden;
  color: #718277;
  font-size: 21rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quote-right {
  display: flex;
  align-items: flex-end;
  flex-direction: column;
  gap: 2rpx;
}

.foot-note {
  padding: 24rpx 0 0;
  color: #b3c0b7;
  font-size: 20rpx;
  text-align: center;
}
</style>
