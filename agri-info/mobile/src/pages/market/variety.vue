<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import TrendChart from '../../components/TrendChart.vue'
import {
  infoApi,
  money,
  pushView,
  signed,
  timeAgo,
  toast,
  type MarketDetail,
  type SeriesPoint,
} from '../../api'

const id = ref(0)
const detail = ref<MarketDetail | null>(null)
const series = ref<SeriesPoint[]>([])
const horizon = ref('7d')
const loading = ref(true)
const statusBarHeight = ref(0)

const horizons = [
  { key: '7d', label: '1周' },
  { key: '30d', label: '1月' },
  { key: '90d', label: '3月' },
  { key: '1y', label: '1年' },
]

try {
  statusBarHeight.value = Number(uni.getSystemInfoSync().statusBarHeight || 0)
} catch {
  statusBarHeight.value = 0
}

const chartPoints = computed(() =>
  series.value.map((point) => ({
    label: String(point.date).slice(5, 10),
    value: Number(point.price ?? point.value ?? 0),
  })),
)

const avg = computed(() => {
  const list = chartPoints.value.map((item) => item.value).filter((value) => value > 0)
  if (!list.length) return 0
  return list.reduce((sum, value) => sum + value, 0) / list.length
})

const low = computed(() => (chartPoints.value.length ? Math.min(...chartPoints.value.map((i) => i.value)) : 0))
const high = computed(() => (chartPoints.value.length ? Math.max(...chartPoints.value.map((i) => i.value)) : 0))

onLoad((options) => {
  id.value = Number(options?.id || 0)
  load()
})

async function load() {
  loading.value = true
  try {
    const data = await infoApi.market(id.value)
    detail.value = data
    series.value = data.series || []
    pushView({
      type: 'quote',
      id: data.id,
      title: `${data.name} · 行情详情`,
      summary: `${data.origin} · ${data.spec} · ${money(data.price)} ${data.priceUnit}`,
      icon: data.icon,
    })
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

async function switchHorizon(key: string) {
  horizon.value = key
  try {
    const result = await infoApi.forecast(id.value, key)
    if (result.series?.length) series.value = result.series
  } catch (error) {
    toast(error instanceof Error ? error.message : '走势加载失败')
  }
}

function goAlert() {
  uni.navigateTo({ url: `/pages/alert/setup?quoteId=${id.value}` })
}

function openArticle(articleId: number) {
  uni.navigateTo({ url: `/pages/news/article?id=${articleId}` })
}

function compare() {
  uni.setStorageSync('info_compare_ids', [id.value])
  toast('已加入对比清单')
}

function goBack() {
  uni.navigateBack({ delta: 1 })
}
</script>

<template>
  <view class="page variety-page">
    <view class="nav-holder" :style="{ paddingTop: `${statusBarHeight}px` }">
      <view class="custom-nav">
        <text class="back" @click="goBack">‹</text>
        <text class="title">{{ detail ? `${detail.name}行情` : '品种行情' }}</text>
        <text class="right" @click="goAlert">设预警</text>
      </view>
    </view>

    <view v-if="loading" class="loading">正在加载行情…</view>

    <template v-else-if="detail">
      <view class="head">
        <view class="head-top">
          <view class="head-icon">{{ detail.icon }}</view>
          <view class="head-copy">
            <text class="head-name">{{ detail.name }}</text>
            <text class="tiny">{{ detail.origin }} · {{ detail.spec }}</text>
            <text class="tiny">更新于 {{ detail.updatedAt }}</text>
          </view>
          <view class="compare-btn" @click="compare">＋ 对比</view>
        </view>

        <view class="price-block">
          <text class="price big">{{ money(detail.price) }}</text>
          <text class="price-unit">{{ detail.priceUnit }}</text>
          <text :class="['chg', detail.changePct >= 0 ? 'up' : 'down']">
            {{ detail.changePct >= 0 ? '↑' : '↓' }} {{ signed(detail.changeAmount) }}
            ({{ signed(detail.changePct, 1) }}%)
          </text>
        </view>

        <view class="mini-stats">
          <view class="mini-cell">
            <text class="tiny">今最低</text>
            <text class="mini-num">{{ money(low) }}</text>
          </view>
          <view class="mini-cell">
            <text class="tiny">今最高</text>
            <text class="mini-num">{{ money(high) }}</text>
          </view>
          <view class="mini-cell">
            <text class="tiny">区间均价</text>
            <text class="mini-num">{{ money(avg) }}</text>
          </view>
        </view>
      </view>

      <view class="page-pad">
        <view class="card">
          <view class="card-head">
            <text class="card-title">价格走势</text>
            <text class="card-sub">{{ detail.priceUnit }}</text>
          </view>
          <view class="seg">
            <view
              v-for="item in horizons"
              :key="item.key"
              :class="{ active: horizon === item.key }"
              @click="switchHorizon(item.key)"
            >
              {{ item.label }}
            </view>
          </view>
          <view style="margin-top: 18rpx">
            <TrendChart :points="chartPoints" :unit="detail.priceUnit" :height="280" />
          </view>
        </view>

        <view v-if="detail.forecast" class="card">
          <view class="card-head">
            <text class="card-title">✦ AI 价格预测</text>
            <text class="card-sub">{{ detail.forecast.horizon }}</text>
          </view>
          <view class="prob-row">
            <view class="prob-cell">
              <text class="prob-num up">{{ detail.forecast.upProbability }}%</text>
              <text class="tiny">上涨概率</text>
            </view>
            <view class="prob-cell">
              <text class="prob-num flat">{{ detail.forecast.flatProbability }}%</text>
              <text class="tiny">震荡概率</text>
            </view>
            <view class="prob-cell">
              <text class="prob-num down">{{ detail.forecast.downProbability }}%</text>
              <text class="tiny">下跌概率</text>
            </view>
          </view>
          <view class="divider" />
          <view class="field">
            <text class="field-label">预测均价区间</text>
            <text class="field-value">
              {{ money(detail.forecast.lowPrice) }} - {{ money(detail.forecast.highPrice) }} {{ detail.priceUnit }}
            </text>
          </view>
          <view class="field">
            <text class="field-label">库存周期</text>
            <text class="field-value">{{ detail.forecast.stockDays }}</text>
          </view>
          <view class="field">
            <text class="field-label">置信度</text>
            <text class="field-value">{{ detail.forecast.confidence }}%</text>
          </view>
          <view class="notice ai" style="margin-top: 14rpx">
            <text>✦</text>
            <text>{{ detail.forecast.salesAdvice }}</text>
          </view>
        </view>

        <view v-if="detail.regionPrices?.length" class="card">
          <view class="card-head">
            <text class="card-title">多产区价格对比</text>
            <text class="card-sub">{{ detail.priceUnit }}</text>
          </view>
          <view v-for="region in detail.regionPrices" :key="region.region" class="region-row">
            <text class="region-name">{{ region.region }}</text>
            <text class="region-price">{{ money(region.price) }}</text>
            <text :class="['chg', region.changePct >= 0 ? 'up' : 'down']">{{ signed(region.changePct, 1) }}%</text>
          </view>
        </view>

        <view v-if="detail.aiRead" class="ai-card">
          <view class="ai-icon">✦</view>
          <view class="ai-copy">
            <text>AI 行情解读</text>
            <text>{{ detail.aiRead.content }}</text>
            <text>置信度 {{ detail.aiRead.confidence }}% · 不构成交易建议</text>
          </view>
        </view>

        <view class="section-head">
          <text class="section-title">相关资讯</text>
        </view>
        <view class="card">
          <view
            v-for="item in detail.relatedArticles || []"
            :key="item.id"
            class="list-item"
            @click="openArticle(item.id)"
          >
            <view class="item-icon">{{ item.coverIcon }}</view>
            <view class="item-body">
              <text class="item-title clamp-2">{{ item.title }}</text>
              <text class="item-sub">{{ item.channel }} · {{ timeAgo(item.publishedAt) }}</text>
            </view>
            <text class="item-arrow">›</text>
          </view>
          <view v-if="!detail.relatedArticles?.length" class="empty" style="min-height: 180rpx">
            <text>暂无相关资讯</text>
          </view>
        </view>
      </view>

      <view class="action-bar">
        <view class="icon-btn" @click="compare">
          <text>☆</text>
          <text>关注品种</text>
        </view>
        <button class="btn btn-primary grow" @click="goAlert">🔔 设置价格预警</button>
      </view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.variety-page {
  padding-bottom: 170rpx;
  background: #f4f7f5;
}

.nav-holder {
  background: #ffffff;
}

.head {
  padding: 20rpx 24rpx 24rpx;
  border-radius: 0 0 32rpx 32rpx;
  background: #ffffff;
}

.head-top {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.head-icon {
  display: flex;
  width: 84rpx;
  height: 84rpx;
  align-items: center;
  justify-content: center;
  border-radius: 22rpx;
  background: #eef6f1;
  font-size: 40rpx;
}

.head-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4rpx;
}

.head-name {
  font-size: 32rpx;
  font-weight: 700;
}

.compare-btn {
  padding: 10rpx 18rpx;
  border: 1rpx solid #dce7df;
  border-radius: 14rpx;
  color: #0e5233;
  font-size: 24rpx;
}

.price-block {
  display: flex;
  align-items: flex-end;
  gap: 8rpx;
  margin-top: 24rpx;
}

.price.big {
  font-size: 68rpx;
  line-height: 1;
}

.price-block .chg {
  margin-left: 8rpx;
  margin-bottom: 8rpx;
}

.mini-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10rpx;
  margin-top: 22rpx;
  padding-top: 18rpx;
  border-top: 1rpx solid #edf2ee;
}

.mini-cell {
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 4rpx;
}

.mini-num {
  font-family: "DIN Alternate", monospace;
  font-size: 26rpx;
  font-weight: 650;
}

.prob-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10rpx;
  padding: 8rpx 0;
}

.prob-cell {
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 4rpx;
}

.prob-num {
  font-family: "DIN Alternate", monospace;
  font-size: 36rpx;
  font-weight: 700;
}

.region-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f1f5f2;
}

.region-row:last-child {
  border-bottom: 0;
}

.region-name {
  flex: 1;
  font-size: 25rpx;
}

.region-price {
  margin-right: 16rpx;
  font-family: "DIN Alternate", monospace;
  font-size: 25rpx;
  font-weight: 650;
}
</style>
