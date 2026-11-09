<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onReachBottom } from '@dcloudio/uni-app'
import { infoApi, timeAgo, type Article } from '../../api'

const channel = ref('')
const keyword = ref('')
const contentType = ref('')
const items = ref<Article[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const finished = ref(false)

const types = ['全部', '图文', '短视频', '直播', '行情简报']

onLoad((options) => {
  channel.value = decodeURIComponent(String(options?.channel || ''))
  keyword.value = decodeURIComponent(String(options?.keyword || ''))
  if (channel.value) uni.setNavigationBarTitle({ title: channel.value })
  load(true)
})

async function load(reset = false) {
  if (loading.value) return
  if (reset) {
    page.value = 1
    finished.value = false
    items.value = []
  }
  if (finished.value) return
  loading.value = true
  try {
    const result = await infoApi.articles({
      channel: channel.value || undefined,
      contentType: contentType.value || undefined,
      keyword: keyword.value || undefined,
      page: page.value,
      size: 10,
    })
    items.value = reset ? result.items : [...items.value, ...result.items]
    total.value = result.total
    finished.value = items.value.length >= result.total
    if (!finished.value) page.value += 1
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

onReachBottom(() => load())

function switchType(name: string) {
  contentType.value = name === '全部' ? '' : name
  load(true)
}

function openArticle(id: number) {
  uni.navigateTo({ url: `/pages/news/article?id=${id}` })
}

function toSearch() {
  uni.navigateTo({ url: `/pages/search/index?keyword=${encodeURIComponent(keyword.value)}` })
}
</script>

<template>
  <view class="page">
    <view class="bar">
      <view class="search" @click="toSearch">
        <text class="search-icon">⌕</text>
        <text class="search-ph">搜本频道资讯</text>
      </view>
    </view>

    <scroll-view scroll-x class="chips type-chips" :show-scrollbar="false">
      <view
        v-for="name in types"
        :key="name"
        :class="['chip', { active: (contentType || '全部') === name }]"
        @click="switchType(name)"
      >
        {{ name }}
      </view>
    </scroll-view>

    <view class="page-pad">
      <view v-if="!items.length && loading" class="loading">正在加载…</view>
      <view v-else-if="!items.length" class="empty">
        <text class="empty-icon">📰</text>
        <text>暂无匹配的资讯</text>
      </view>

      <view v-else class="card list-card">
        <view v-for="item in items" :key="item.id" class="list-item" @click="openArticle(item.id)">
          <view class="item-icon">{{ item.coverIcon }}</view>
          <view class="item-body">
            <text class="item-title clamp-2">{{ item.title }}</text>
            <text class="item-sub">{{ item.summary }}</text>
            <view class="meta">
              <text class="tag green">{{ item.channel }}</text>
              <text class="tiny">{{ item.author }}</text>
              <text class="tiny">{{ timeAgo(item.publishedAt) }}</text>
              <text class="tiny">👁 {{ item.readCount }}</text>
            </view>
          </view>
        </view>
        <view class="foot">
          <text v-if="loading">加载中…</text>
          <text v-else-if="finished">— 共 {{ total }} 条，已全部加载 —</text>
          <text v-else @click="load()">上拉或点击加载更多</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.bar {
  padding: 16rpx 24rpx;
  background: #ffffff;
}

.search {
  display: flex;
  height: 72rpx;
  align-items: center;
  gap: 10rpx;
  padding: 0 20rpx;
  border-radius: 16rpx;
  background: #f2f5f3;
}

.search-icon {
  color: #94a198;
  font-size: 28rpx;
}

.search-ph {
  color: #b3c0b7;
  font-size: 24rpx;
}

.type-chips {
  padding: 6rpx 24rpx 14rpx;
  background: #ffffff;
  white-space: nowrap;
}

.meta {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-top: 4rpx;
}

.foot {
  padding: 24rpx 0 8rpx;
  color: #b3c0b7;
  font-size: 24rpx;
  text-align: center;
}
</style>
