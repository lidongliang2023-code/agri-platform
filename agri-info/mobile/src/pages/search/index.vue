<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { infoApi, money, signed, timeAgo, toast, type SearchResult } from '../../api'

const HISTORY_KEY = 'info_search_history'
const keyword = ref('')
const submitted = ref('')
const history = ref<string[]>(uni.getStorageSync(HISTORY_KEY) || [])
const result = ref<SearchResult | null>(null)
const loading = ref(false)
const tab = ref<'all' | 'article' | 'quote' | 'knowledge'>('all')
const statusBarHeight = ref(0)

try {
  statusBarHeight.value = Number(uni.getSystemInfoSync().statusBarHeight || 0)
} catch {
  statusBarHeight.value = 0
}

const hotList = [
  { tag: '热', title: '大蒜价格走势', desc: '行情 · 搜索指数 ↑72%', keyword: '大蒜' },
  { tag: '热', title: '2026 种粮补贴怎么领', desc: '政策法规 · 3.2 万人搜过', keyword: '补贴' },
  { tag: '新', title: '番茄黄叶怎么治（问 AI）', desc: '农技问答 · AI 秒答', keyword: '番茄叶片发黄' },
]

const tabs = [
  { key: 'all', label: '综合' },
  { key: 'article', label: '资讯' },
  { key: 'quote', label: '行情' },
  { key: 'knowledge', label: '农技' },
] as const

const totals = computed(() => {
  const data = result.value
  if (!data) return { article: 0, quote: 0, knowledge: 0 }
  return {
    article: data.articles?.length || 0,
    quote: data.quotes?.length || 0,
    knowledge: data.knowledge?.length || 0,
  }
})

onLoad((options) => {
  const preset = decodeURIComponent(String(options?.keyword || ''))
  if (preset) {
    keyword.value = preset
    doSearch(preset)
  }
})

async function doSearch(text?: string) {
  const value = (text ?? keyword.value).trim()
  if (!value) return
  keyword.value = value
  submitted.value = value
  loading.value = true
  tab.value = 'all'
  try {
    result.value = await infoApi.search(value)
    const list = [value, ...history.value.filter((item) => item !== value)].slice(0, 10)
    history.value = list
    uni.setStorageSync(HISTORY_KEY, list)
  } catch (error) {
    toast(error instanceof Error ? error.message : '搜索失败')
  } finally {
    loading.value = false
  }
}

function clearHistory() {
  history.value = []
  uni.removeStorageSync(HISTORY_KEY)
}

function openArticle(id: number) {
  uni.navigateTo({ url: `/pages/news/article?id=${id}` })
}

function openVariety(id: number) {
  uni.navigateTo({ url: `/pages/market/variety?id=${id}` })
}

function askAi(text: string) {
  uni.setStorageSync('info_ai_question', text)
  uni.switchTab({ url: '/pages/ai/index' })
}

function openSd(id: number) {
  uni.navigateTo({ url: `/pages/sd/detail?id=${id}` })
}

function goBack() {
  uni.navigateBack({ delta: 1 })
}
</script>

<template>
  <view class="page search-page">
    <view class="nav" :style="{ paddingTop: `${statusBarHeight}px` }">
      <view class="nav-row">
        <text class="back" @click="goBack">‹</text>
        <view class="search-box">
          <text class="search-icon">⌕</text>
          <input
            v-model="keyword"
            class="search-input"
            placeholder="搜资讯 · 品种 · 农技"
            placeholder-class="ph"
            confirm-type="search"
            :focus="true"
            @confirm="doSearch()"
          />
          <text v-if="keyword" class="clear" @click="keyword = ''">✕</text>
        </view>
        <text class="submit" @click="doSearch()">搜索</text>
      </view>
    </view>

    <view v-if="!submitted" class="page-pad">
      <view v-if="history.length" class="block">
        <view class="block-head">
          <text class="block-title">搜索历史</text>
          <text class="card-sub" @click="clearHistory">🗑 清空</text>
        </view>
        <view class="chip-wrap">
          <text v-for="item in history" :key="item" class="chip" @click="doSearch(item)">{{ item }}</text>
        </view>
      </view>

      <view class="block">
        <view class="block-head">
          <text class="block-title">🔥 大家都在搜</text>
        </view>
        <view class="hot-list">
          <view v-for="item in hotList" :key="item.title" class="hot-row" @click="doSearch(item.keyword)">
            <text :class="['hot-tag', item.tag === '新' ? 'new' : '']">{{ item.tag }}</text>
            <view class="hot-copy">
              <text class="hot-title">{{ item.title }}</text>
              <text class="tiny">{{ item.desc }}</text>
            </view>
            <text class="item-arrow">›</text>
          </view>
        </view>
      </view>
    </view>

    <view v-else class="page-pad">
      <view class="seg" style="margin-bottom: 16rpx">
        <view
          v-for="item in tabs"
          :key="item.key"
          :class="{ active: tab === item.key }"
          @click="tab = item.key"
        >
          {{ item.label }}<text v-if="item.key === 'article'"> {{ totals.article }}</text>
        </view>
      </view>

      <view v-if="loading" class="loading">正在搜索…</view>
      <view v-else-if="!result || !result.total" class="empty">
        <text class="empty-icon">🔍</text>
        <text>没有找到「{{ submitted }}」相关内容</text>
        <button class="btn btn-ghost btn-sm" style="margin-top: 12rpx" @click="askAi(submitted)">
          问问 AI 助手
        </button>
      </view>

      <template v-else>
        <view v-if="(tab === 'all' || tab === 'article') && result.articles?.length" class="card">
          <text class="group-title">资讯</text>
          <view v-for="item in result.articles" :key="item.id" class="list-item" @click="openArticle(item.id)">
            <view class="item-icon">{{ item.coverIcon }}</view>
            <view class="item-body">
              <text class="item-title clamp-2">{{ item.title }}</text>
              <text class="item-sub">{{ item.channel }} · {{ item.author }} · {{ timeAgo(item.publishedAt) }}</text>
            </view>
            <text class="item-arrow">›</text>
          </view>
        </view>

        <view v-if="(tab === 'all' || tab === 'quote') && result.quotes?.length" class="card">
          <text class="group-title">行情</text>
          <view v-for="item in result.quotes" :key="item.id" class="list-item" @click="openVariety(item.id)">
            <view class="item-icon">{{ item.icon }}</view>
            <view class="item-body">
              <text class="item-title">{{ item.name }}</text>
              <text class="item-sub">{{ item.origin }} · {{ item.spec }}</text>
            </view>
            <view class="quote-right">
              <text class="quote-price">{{ money(item.price) }}<text class="tiny">{{ item.priceUnit }}</text></text>
              <text :class="['chg', item.changePct >= 0 ? 'up' : 'down']">{{ signed(item.changePct, 1) }}%</text>
            </view>
          </view>
        </view>

        <view v-if="(tab === 'all' || tab === 'knowledge') && result.knowledge?.length" class="card">
          <text class="group-title">农技知识</text>
          <view v-for="item in result.knowledge" :key="item.id" class="list-item" @click="askAi(item.title)">
            <view class="item-icon">🌱</view>
            <view class="item-body">
              <text class="item-title clamp-2">{{ item.title }}</text>
              <text class="item-sub">{{ item.crop }} · {{ item.category }} · {{ item.sourceName }}</text>
            </view>
            <text class="item-arrow">›</text>
          </view>
        </view>

        <view v-if="tab === 'all' && result.supplyDemands?.length" class="card">
          <text class="group-title">供需信息</text>
          <view
            v-for="item in result.supplyDemands"
            :key="item.id"
            class="list-item"
            @click="openSd(item.id)"
          >
            <view class="item-icon">{{ item.sdType === 'supply' ? '📦' : '🛒' }}</view>
            <view class="item-body">
              <text class="item-title clamp-2">{{ item.title }}</text>
              <text class="item-sub">{{ item.origin }} · {{ item.quantity }} · {{ money(item.price) }} {{ item.priceUnit }}</text>
            </view>
            <text class="item-arrow">›</text>
          </view>
        </view>

        <view class="ai-entry" @click="askAi(submitted)">
          <text class="ai-emoji">🤖</text>
          <view class="ai-copy">
            <text>没找到想要的答案？</text>
            <text>让 AI 助手直接回答「{{ submitted }}」</text>
          </view>
          <text class="item-arrow">›</text>
        </view>
      </template>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.search-page {
  background: #f4f7f5;
}

.nav {
  padding: 0 24rpx 14rpx;
  background: #ffffff;
}

.nav-row {
  display: flex;
  height: 88rpx;
  align-items: center;
  gap: 12rpx;
}

.back {
  width: 44rpx;
  font-size: 50rpx;
  font-weight: 300;
  line-height: 1;
}

.search-box {
  display: flex;
  height: 72rpx;
  flex: 1;
  align-items: center;
  gap: 10rpx;
  padding: 0 18rpx;
  border-radius: 16rpx;
  background: #f2f5f3;
}

.search-icon {
  color: #94a198;
  font-size: 28rpx;
}

.search-input {
  height: 100%;
  flex: 1;
  font-size: 24rpx;
}

.ph {
  color: #b3c0b7;
}

.clear {
  color: #b3c0b7;
  font-size: 22rpx;
}

.submit {
  color: #12764a;
  font-size: 25rpx;
  font-weight: 650;
}

.block {
  margin-bottom: 26rpx;
}

.block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14rpx;
}

.block-title {
  font-size: 26rpx;
  font-weight: 700;
}

.chip-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.chip {
  padding: 10rpx 20rpx;
  border: 1rpx solid #e1e9e3;
  border-radius: 30rpx;
  background: #ffffff;
  color: #53665a;
  font-size: 22rpx;
}

.hot-list {
  border: 1rpx solid #e1e9e3;
  border-radius: 22rpx;
  background: #ffffff;
  overflow: hidden;
}

.hot-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 20rpx 22rpx;
  border-bottom: 1rpx solid #f1f5f2;
}

.hot-row:last-child {
  border-bottom: 0;
}

.hot-tag {
  padding: 2rpx 10rpx;
  border-radius: 8rpx;
  background: #feebeb;
  color: #c54b4b;
  font-size: 18rpx;
}

.hot-tag.new {
  background: #e7f3fa;
  color: #176c93;
}

.hot-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4rpx;
}

.hot-title {
  font-size: 25rpx;
  font-weight: 600;
}

.group-title {
  display: block;
  margin-bottom: 6rpx;
  color: #0e5233;
  font-size: 22rpx;
  font-weight: 700;
}

.quote-right {
  display: flex;
  align-items: flex-end;
  flex-direction: column;
  gap: 2rpx;
}

.quote-price {
  font-family: "DIN Alternate", monospace;
  font-size: 25rpx;
  font-weight: 700;
}

.ai-entry {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-top: 6rpx;
  padding: 20rpx;
  border: 1rpx solid #e2d4ec;
  border-radius: 20rpx;
  background: linear-gradient(135deg, #faf7fc, #f1e9f7);
}

.ai-emoji {
  font-size: 30rpx;
}

.ai-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4rpx;
  font-size: 23rpx;
}

.ai-copy text:last-child {
  color: #6b418d;
  font-size: 21rpx;
}
</style>
