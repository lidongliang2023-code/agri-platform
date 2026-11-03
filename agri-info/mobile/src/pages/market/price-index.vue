<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import TrendChart from '../../components/TrendChart.vue'
import {
  infoApi,
  money,
  signed,
  toast,
  type IndexDetail,
  type MarketData,
  type PriceIndex,
} from '../../api'

const indices = ref<PriceIndex[]>([])
const market = ref<MarketData | null>(null)
const active = ref<IndexDetail | null>(null)
const activeId = ref(0)
const loading = ref(true)
const statusBarHeight = ref(0)

try {
  statusBarHeight.value = Number(uni.getSystemInfoSync().statusBarHeight || 0)
} catch {
  statusBarHeight.value = 0
}

/** 综合指数：由平台各分类指数按样本数加权合成，仅用于移动端总览展示。 */
const composite = computed(() => {
  const list = indices.value
  if (!list.length) return { value: 0, changePct: 0, series: [] as Array<{ label: string; value: number }> }
  const weight = list.reduce((sum, item) => sum + (item.sampleCount || 1), 0)
  const value = list.reduce((sum, item) => sum + item.value * (item.sampleCount || 1), 0) / weight
  const changePct = list.reduce((sum, item) => sum + item.changePct * (item.sampleCount || 1), 0) / weight
  const length = Math.max(...list.map((item) => item.trend?.length || 0))
  const series = Array.from({ length }, (_, index) => {
    let total = 0
    let count = 0
    list.forEach((item) => {
      const point = item.trend?.[index]
      if (point !== undefined) {
        total += Number(point)
        count += 1
      }
    })
    return { label: `T-${length - index - 1}`, value: count ? total / count : 0 }
  })
  return { value, changePct, series }
})

const topMovers = computed(() => {
  const quotes = market.value?.quotes || []
  return [...quotes].sort((a, b) => b.changePct - a.changePct).slice(0, 5)
})

onLoad(() => {
  load()
})

async function load() {
  loading.value = true
  try {
    const [list, marketData] = await Promise.all([infoApi.indices(), infoApi.markets({})])
    indices.value = list
    market.value = marketData
    if (list.length) await openIndex(list[0].id)
  } catch (error) {
    toast(error instanceof Error ? error.message : '加载失败')
  } finally {
    loading.value = false
  }
}

async function openIndex(id: number) {
  try {
    activeId.value = id
    active.value = await infoApi.indexDetail(id)
  } catch (error) {
    toast(error instanceof Error ? error.message : '指数加载失败')
  }
}

function explain() {
  uni.showModal({
    title: '指数说明',
    content:
      '平台指数以 2020 年为基期（=100），按品种成交量加权几何平均计算，每日 18:00 更新。综合指数由各分类指数按样本品种数加权合成，用于反映整体价格水平变化。',
    showCancel: false,
  })
}

function goBack() {
  uni.navigateBack({ delta: 1 })
}

function goMarket() {
  uni.switchTab({ url: '/pages/market/index' })
}

const totalSamples = computed(() =>
  indices.value.reduce((sum, item) => sum + (item.sampleCount || 0), 0),
)

const activePoints = computed(() =>
  (active.value?.trend || []).map((value, index, array) => ({
    label: `T-${array.length - index - 1}`,
    value: Number(value),
  })),
)
</script>

<template>
  <view class="page index-page">
    <view class="nav-holder" :style="{ paddingTop: `${statusBarHeight}px` }">
      <view class="custom-nav">
        <text class="back" @click="goBack">‹</text>
        <text class="title">农产品价格指数</text>
        <text class="right" @click="explain">说明</text>
      </view>
    </view>

    <view v-if="loading" class="loading">正在加载指数…</view>

    <template v-else>
      <view class="head">
        <text class="head-label">综合价格指数</text>
        <view class="head-value">
          <text class="big">{{ money(composite.value, 1) }}</text>
          <text :class="['chg', composite.changePct >= 0 ? 'up' : 'down']">
            {{ signed(composite.changePct, 1) }}% 日环比
          </text>
        </view>
        <text class="tiny">基期 2020 年 = 100 · 样本 {{ totalSamples }} 个品种</text>
      </view>

      <view class="page-pad">
        <view class="card">
          <view class="card-head">
            <text class="card-title">综合指数走势</text>
            <text class="card-sub">最近 {{ composite.series.length }} 个采集周期</text>
          </view>
          <TrendChart :points="composite.series" :height="240" :digits="1" />
        </view>

        <view class="section-head">
          <text class="section-title">分类指数</text>
          <text class="card-sub">点击查看成分品种</text>
        </view>

        <view class="card index-list">
          <view
            v-for="item in indices"
            :key="item.id"
            :class="['index-row', { active: activeId === item.id }]"
            @click="openIndex(item.id)"
          >
            <view class="index-main">
              <text class="index-name">{{ item.name }}</text>
              <text class="tiny">{{ item.category }} · {{ item.sampleCount }} 个代表品种</text>
            </view>
            <view class="index-right">
              <text class="index-value">{{ money(item.value, 1) }}</text>
              <text :class="['chg', item.changePct >= 0 ? 'up' : 'down']">{{ signed(item.changePct, 1) }}%</text>
            </view>
          </view>
        </view>

        <view v-if="active" class="card">
          <view class="card-head">
            <text class="card-title">{{ active.name }}</text>
            <text class="card-sub">{{ active.method }}</text>
          </view>
          <TrendChart :points="activePoints" :height="220" :digits="1" />
          <view class="divider" />
          <text class="tiny">成分品种</text>
          <view
            v-for="item in active.components"
            :key="item.id"
            class="list-item"
            @click="goMarket"
          >
            <view class="item-icon">{{ item.icon }}</view>
            <view class="item-body">
              <text class="item-title">{{ item.name }}</text>
              <text class="item-sub">{{ item.origin }}</text>
            </view>
            <view class="index-right">
              <text class="index-value">{{ money(item.price) }}</text>
              <text :class="['chg', item.changePct >= 0 ? 'up' : 'down']">{{ signed(item.changePct, 1) }}%</text>
            </view>
          </view>
        </view>

        <view class="section-head">
          <text class="section-title">品种涨幅榜 TOP5</text>
        </view>
        <view class="card">
          <view v-for="(item, index) in topMovers" :key="item.id" class="rank-row">
            <text :class="['rank-no', index < 3 ? 'hot' : '']">{{ index + 1 }}</text>
            <text class="rank-icon">{{ item.icon }}</text>
            <text class="rank-name">{{ item.name }}</text>
            <text :class="['chg', item.changePct >= 0 ? 'up' : 'down']">{{ signed(item.changePct, 1) }}%</text>
          </view>
          <view v-if="!topMovers.length" class="empty" style="min-height: 160rpx">
            <text>暂无榜单数据</text>
          </view>
        </view>
      </view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.index-page {
  background: #f4f7f5;
}

.nav-holder {
  background: #ffffff;
}

.head {
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 8rpx;
  padding: 28rpx 24rpx 34rpx;
  background: radial-gradient(circle at 50% 0, rgba(83, 213, 138, 0.22), transparent 420rpx), linear-gradient(160deg, #073821, #0d5d3b);
  color: #ffffff;
}

.head-label {
  color: rgba(255, 255, 255, 0.6);
  font-size: 22rpx;
}

.head-value {
  display: flex;
  align-items: baseline;
  gap: 14rpx;
}

.big {
  font-family: "DIN Alternate", monospace;
  font-size: 78rpx;
  font-weight: 750;
  letter-spacing: -2rpx;
}

.head .chg.up {
  color: #ff9a9a;
}

.head .chg.down {
  color: #8fe0a5;
}

.head .tiny {
  color: rgba(255, 255, 255, 0.5);
}

.index-list {
  padding: 6rpx 24rpx;
}

.index-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #edf2ee;
}

.index-row:last-child {
  border-bottom: 0;
}

.index-row.active .index-name {
  color: #0e5233;
}

.index-main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4rpx;
}

.index-name {
  font-size: 26rpx;
  font-weight: 620;
}

.index-right {
  display: flex;
  align-items: flex-end;
  flex-direction: column;
  gap: 2rpx;
}

.index-value {
  font-family: "DIN Alternate", monospace;
  font-size: 26rpx;
  font-weight: 700;
}

.rank-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f1f5f2;
}

.rank-row:last-child {
  border-bottom: 0;
}

.rank-no {
  width: 34rpx;
  color: #94a198;
  font-family: "DIN Alternate", monospace;
  font-size: 24rpx;
  font-weight: 700;
  text-align: center;
}

.rank-no.hot {
  color: #c62828;
}

.rank-icon {
  font-size: 30rpx;
}

.rank-name {
  flex: 1;
  font-size: 25rpx;
}
</style>
