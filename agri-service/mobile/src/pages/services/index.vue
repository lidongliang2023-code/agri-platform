<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { serviceApi, type Provider } from '../../api'

const items = ref<Provider[]>([])
const keyword = ref('')
const category = ref('全部')
const sort = ref('recommended')
const loading = ref(false)
const categories = ['全部', '农机作业', '植保防疫', '粮食烘干', '农技问诊', '检测认证', '培训服务']
const sorts = [['recommended', '综合'], ['distance', '最近'], ['price', '低价'], ['orders', '最多']]

onShow(() => {
  const saved = uni.getStorageSync('service_search')
  if (saved) {
    keyword.value = saved.keyword || ''
    category.value = saved.category || '全部'
    uni.removeStorageSync('service_search')
  }
  load()
})

async function load() {
  loading.value = true
  try {
    items.value = await serviceApi.providers({
      keyword: keyword.value || undefined,
      category: category.value === '全部' ? undefined : category.value,
      sort: sort.value,
    })
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function selectCategory(value: string) {
  category.value = value
  load()
}

function selectSort(value: string) {
  sort.value = value
  load()
}

function toProvider(id: number) {
  uni.navigateTo({ url: `/pages/provider/detail?id=${id}` })
}

function publish() {
  uni.navigateTo({ url: '/pages/demand/publish' })
}
</script>

<template>
  <view class="page services-page">
    <view class="search-row"><view class="search"><text>⌕</text><input v-model="keyword" placeholder="搜索服务或服务商" confirm-type="search" @confirm="load" /></view><button class="btn btn-sm" @click="load">查询</button></view>
    <scroll-view scroll-x class="chips" :show-scrollbar="false">
      <view v-for="item in categories" :key="item" class="chip" :class="{ on: category === item }" @click="selectCategory(item)">{{ item }}</view>
    </scroll-view>
    <view class="sort-tabs"><button v-for="item in sorts" :key="item[0]" :class="{ on: sort === item[0] }" @click="selectSort(item[0])">{{ item[1] }}</button></view>
    <view v-if="loading" class="loading">正在加载认证服务商…</view>
    <view v-else-if="items.length === 0" class="empty"><text class="empty-icon">🔎</text><text>没有找到匹配服务</text></view>
    <view v-else class="provider-list">
      <view class="provider-card" v-for="provider in items" :key="provider.id" @click="toProvider(provider.id)">
        <view class="provider-icon">{{ provider.categoryIcon }}</view>
        <view class="provider-copy"><view class="name-line"><text class="provider-name">{{ provider.name }}</text><text class="tag green">{{ provider.badge }}</text></view><text class="provider-meta">★ {{ provider.rating }} · {{ provider.distanceKm }}km · {{ provider.responseMinutes }} 分钟响应</text><text class="provider-tags">{{ provider.tags.join(' · ') }}</text></view>
        <view class="price">¥{{ provider.price }}<text>{{ provider.unit }}</text></view>
      </view>
    </view>
    <button class="publish-float btn btn-primary" @click="publish">✨ 描述需求，智能找服务</button>
  </view>
</template>

<style lang="scss" scoped>
.services-page { padding: 22rpx 24rpx 100rpx; }
.search-row { display: flex; gap: 12rpx; }
.search { display: flex; height: 76rpx; flex: 1; align-items: center; gap: 10rpx; padding: 0 20rpx; border: 1rpx solid #e1e9e3; border-radius: 16rpx; background: #fff; color: #94a198; }
.search input { min-width: 0; flex: 1; font-size: 24rpx; }
.chips { margin-top: 16rpx; white-space: nowrap; }
.chip { display: inline-flex; padding: 10rpx 20rpx; margin-right: 10rpx; border: 1rpx solid #e1e9e3; border-radius: 28rpx; background: #fff; color: #718277; font-size: 21rpx; }
.chip.on { border-color: #12764a; background: #12764a; color: #fff; }
.sort-tabs { display: flex; margin: 16rpx 0; padding: 6rpx; border-radius: 15rpx; background: #e9f0ec; }
.sort-tabs button { flex: 1; padding: 10rpx 0; border-radius: 11rpx; color: #718277; font-size: 20rpx; }
.sort-tabs button.on { background: #fff; color: #0e5233; box-shadow: 0 4rpx 12rpx rgba(20,58,38,.08); font-weight: 650; }
.provider-list { display: flex; flex-direction: column; gap: 16rpx; }
.provider-card { display: flex; align-items: center; gap: 16rpx; padding: 22rpx; border: 1rpx solid #e1e9e3; border-radius: 22rpx; background: #fff; }
.provider-icon { display: flex; width: 86rpx; height: 86rpx; flex: 0 0 86rpx; align-items: center; justify-content: center; border-radius: 21rpx; background: linear-gradient(135deg, #e5f5eb, #d8f0e2); font-size: 41rpx; }
.provider-copy { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 5rpx; }
.name-line { display: flex; align-items: center; gap: 8rpx; }
.provider-name { overflow: hidden; font-size: 25rpx; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.provider-meta { color: #d88b1f; font-size: 19rpx; }
.provider-tags { overflow: hidden; color: #94a198; font-size: 19rpx; text-overflow: ellipsis; white-space: nowrap; }
.price { display: flex; flex: 0 0 auto; flex-direction: column; align-items: flex-end; color: #0e5233; font-size: 28rpx; font-weight: 700; }
.price text { color: #94a198; font-size: 17rpx; font-weight: 400; }
.publish-float { position: fixed; right: 24rpx; bottom: calc(130rpx + env(safe-area-inset-bottom)); z-index: 8; height: 72rpx; min-height: 72rpx; border-radius: 40rpx; font-size: 22rpx; }
</style>
