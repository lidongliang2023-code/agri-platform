<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { serviceApi, type Overview } from '../../api'
import { getServiceUser } from '../../auth'

const overview = ref<Overview | null>(null)
const search = ref('')
const statusBarHeight = ref(0)
const userName = getServiceUser()?.nickname || getServiceUser()?.username || '平台用户'

onShow(() => {
  const info = uni.getSystemInfoSync()
  statusBarHeight.value = Number(info.statusBarHeight || 0)
  load()
})

async function load() {
  try {
    overview.value = await serviceApi.overview()
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' })
  }
}

function findService(keyword = '', category = '') {
  const query = [keyword ? `keyword=${encodeURIComponent(keyword)}` : '', category ? `category=${encodeURIComponent(category)}` : ''].filter(Boolean).join('&')
  uni.switchTab({ url: '/pages/services/index' })
  uni.setStorageSync('service_search', { keyword, category })
  if (query) uni.setStorageSync('service_search_url', query)
}

function handleCategory(name: string) {
  if (name === '农险服务') return uni.navigateTo({ url: '/pages/insurance/index' })
  if (name === '培训服务') return findService('', '培训服务')
  findService('', name)
}

function toMessages() {
  uni.navigateTo({ url: '/pages/messages/index' })
}

function toAi() {
  uni.navigateTo({ url: '/pages/ai/index' })
}

function toOrders() {
  uni.switchTab({ url: '/pages/orders/index' })
}

/** 待办跳转按后端下发的 link 走（order:12 / policy / claim / complaint），不再写死某张订单。 */
function toTodo(todo?: { link?: string }) {
  const link = todo?.link ?? ''
  if (link.startsWith('order:')) {
    uni.navigateTo({ url: `/pages/orders/detail?id=${link.slice(6)}` })
    return
  }
  if (link === 'policy') {
    uni.navigateTo({ url: '/pages/policies/index' })
    return
  }
  if (link === 'claim' || link === 'complaint') {
    uni.navigateTo({ url: link === 'claim' ? '/pages/insurance/index' : '/pages/messages/index' })
    return
  }
  uni.switchTab({ url: '/pages/orders/index' })
}

function toPolicies() {
  uni.navigateTo({ url: '/pages/policies/index' })
}

function toProvider(id: number) {
  uni.navigateTo({ url: `/pages/provider/detail?id=${id}` })
}
</script>

<template>
  <view class="page home-page">
    <view class="home-hero" :style="{ paddingTop: `${statusBarHeight + 18}px` }">
      <view class="home-nav">
        <text class="home-title">综合服务</text>
        <view class="bell" @click="toMessages">🔔<text v-if="Number(overview?.stats?.unreadMessages || 0) > 0">{{ overview?.stats?.unreadMessages }}</text></view>
      </view>
      <view class="home-greeting">
        <text class="small">您好，{{ userName }}</text>
        <text class="title">今天需要什么服务？</text>
      </view>
      <view class="search-box">
        <text>⌕</text>
        <input v-model="search" placeholder="搜农机、农技、保险、政策" confirm-type="search" @confirm="findService(search)" />
      </view>
      <view class="weather">
        <text class="temp">{{ overview?.stats?.myOrders ?? 0 }}</text>
        <view>
          <text class="weather-title">累计服务订单 · 已完成 {{ overview?.stats?.completedOrders ?? 0 }} 单</text>
          <text class="weather-sub">未读消息 {{ overview?.stats?.unreadMessages ?? 0 }} 条 · 保障金额 ¥{{ overview?.stats?.protectedAmount ?? 0 }}</text>
        </view>
        <text @click="toOrders">›</text>
      </view>
    </view>

    <view class="page-body">
      <view class="ai-entry" @click="toAi">
        <view class="ai-icon">🤖</view>
        <view class="ai-copy"><text>AI 服务管家</text><text>说不清需求？直接告诉我</text><text>支持语音、拍照识别，自动匹配附近服务</text></view>
        <text class="arrow">›</text>
      </view>

      <view v-if="!overview" class="loading">正在加载服务数据…</view>
      <template v-else>
        <view class="card quick-card">
          <view class="quick-item" v-for="category in overview.categories.slice(0, 8)" :key="category.name" @click="handleCategory(category.name)">
            <view class="quick-icon">{{ category.icon }}</view>
            <text>{{ category.name.replace('服务', '') }}</text>
          </view>
        </view>

        <view class="card todo-card">
          <view class="card-head"><text class="card-title">我的服务待办</text><text class="card-sub" @click="toOrders">全部 ›</text></view>
          <view class="todo" v-if="overview.todos?.length" @click="toTodo(overview.todos[0])">
            <view class="todo-icon">⚡</view>
            <view class="todo-copy"><text class="strong">{{ overview.todos[0]?.title }}</text><text class="muted">{{ overview.todos[0]?.content }}</text><view class="progress"><view :style="{ width: overview.todos[0]?.progress }" /></view></view>
            <text class="todo-percent">{{ overview.todos[0]?.progress }}</text>
          </view>
          <view v-else class="empty">当前没有在途的服务，去服务中心下一单试试</view>
        </view>

        <view class="section-head"><text class="section-title">政策补贴</text><text class="card-sub" @click="toPolicies">更多 ›</text></view>
        <scroll-view scroll-x class="policy-scroll" :show-scrollbar="false">
          <view class="policy-banner" v-for="(policy, index) in overview.policies" :key="policy.id" :class="`tone-${index}`" @click="toPolicies">
            <text class="tiny">{{ policy.level }} · {{ policy.deadline }} 截止</text>
            <text class="policy-title">{{ policy.title }}</text>
            <text class="policy-amount">{{ policy.amountText }} ›</text>
          </view>
        </scroll-view>

        <view class="section-head"><text class="section-title">附近优质服务</text><text class="card-sub" @click="findService()">全部 ›</text></view>
        <scroll-view scroll-x class="provider-scroll" :show-scrollbar="false">
          <view class="near-card" v-for="provider in overview.featuredProviders" :key="provider.id" @click="toProvider(provider.id)">
            <view class="near-icon">{{ provider.categoryIcon }}</view>
            <text class="near-name">{{ provider.name }}</text>
            <text class="tiny gold">★ {{ provider.rating }} · {{ provider.distanceKm }}km</text>
            <text class="muted near-tags">{{ provider.tags.join(' · ') }}</text>
            <text class="near-price">¥{{ provider.price }}<text>{{ provider.unit }}</text></text>
          </view>
        </scroll-view>
      </template>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.home-page { background: #f4f7f5; }
.home-hero { padding: 0 28rpx 38rpx; border-radius: 0 0 40rpx 40rpx; background: radial-gradient(circle at 90% 10%, rgba(83,213,138,.28), transparent 430rpx), linear-gradient(145deg, #073821, #0d5d3b); color: #fff; }
.home-nav { display: flex; align-items: center; justify-content: space-between; height: 70rpx; }
.home-title { font-size: 31rpx; font-weight: 700; }
.bell { position: relative; display: flex; width: 68rpx; height: 68rpx; align-items: center; justify-content: center; border: 1rpx solid rgba(255,255,255,.14); border-radius: 20rpx; background: rgba(255,255,255,.08); }
.bell text { position: absolute; top: -4rpx; right: -2rpx; min-width: 30rpx; height: 30rpx; border: 3rpx solid #0d4e32; border-radius: 16rpx; background: #e44949; font-size: 16rpx; line-height: 27rpx; text-align: center; }
.home-greeting { display: flex; flex-direction: column; gap: 7rpx; margin-top: 24rpx; }
.home-greeting .small { color: rgba(255,255,255,.55); font-size: 22rpx; }
.home-greeting .title { font-size: 43rpx; font-weight: 750; }
.search-box { display: flex; height: 82rpx; align-items: center; gap: 12rpx; margin-top: 24rpx; padding: 0 22rpx; border-radius: 20rpx; background: rgba(255,255,255,.95); color: #94a198; }
.search-box input { flex: 1; color: #0b1a12; font-size: 24rpx; }
.weather { display: flex; align-items: center; gap: 18rpx; margin-top: 20rpx; padding: 18rpx; border: 1rpx solid rgba(255,255,255,.1); border-radius: 18rpx; background: rgba(1,28,15,.17); }
.weather .temp { color: #8be1af; font-family: monospace; font-size: 45rpx; }
.weather view { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 4rpx; }
.weather-title { font-size: 22rpx; }
.weather-sub { overflow: hidden; color: rgba(255,255,255,.45); font-size: 18rpx; text-overflow: ellipsis; white-space: nowrap; }
.page-body { padding: 20rpx 24rpx 30rpx; }
.ai-entry { display: flex; align-items: center; gap: 16rpx; margin-top: -54rpx; padding: 20rpx; border: 1rpx solid #e2d4ec; border-radius: 22rpx; background: linear-gradient(135deg, #fbf8fd, #f1e9f7); box-shadow: 0 12rpx 30rpx rgba(63,34,82,.08); }
.arrow { color: #a395ab; font-size: 34rpx; }
.quick-card { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24rpx 4rpx; padding: 28rpx 12rpx; }
.quick-item { display: flex; align-items: center; flex-direction: column; gap: 9rpx; font-size: 21rpx; }
.quick-icon { display: flex; width: 82rpx; height: 82rpx; align-items: center; justify-content: center; border-radius: 23rpx; background: #e5f5eb; font-size: 38rpx; }
.todo { display: flex; align-items: center; gap: 16rpx; padding: 17rpx; border-radius: 18rpx; background: #f2fbf5; }
.todo-icon { display: flex; width: 66rpx; height: 66rpx; flex: 0 0 66rpx; align-items: center; justify-content: center; border-radius: 17rpx; background: #e5f5eb; font-size: 29rpx; }
.todo-copy { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 4rpx; }
.todo-copy .progress { margin-top: 5rpx; }
.todo-percent { color: #0e5233; font-family: monospace; font-size: 22rpx; }
.section-head { display: flex; align-items: center; justify-content: space-between; margin: 26rpx 2rpx 14rpx; }
.section-title { font-size: 30rpx; font-weight: 700; }
.policy-scroll, .provider-scroll { width: 100%; white-space: nowrap; }
.policy-banner { display: inline-flex; width: 460rpx; min-height: 170rpx; box-sizing: border-box; flex-direction: column; gap: 8rpx; margin-right: 16rpx; padding: 22rpx; border-radius: 22rpx; background: linear-gradient(135deg, #176b93, #0f5475); color: #fff; white-space: normal; }
.policy-banner.tone-1 { background: linear-gradient(135deg, #16805a, #0e573c); }
.policy-banner.tone-2 { background: linear-gradient(135deg, #78509a, #543174); }
.policy-banner .tiny { color: rgba(255,255,255,.55); }
.policy-title { min-height: 62rpx; font-size: 26rpx; font-weight: 650; line-height: 1.4; }
.policy-amount { color: #d2f2df; font-size: 20rpx; }
.near-card { display: inline-flex; width: 340rpx; box-sizing: border-box; flex-direction: column; gap: 7rpx; margin-right: 16rpx; padding: 20rpx; border: 1rpx solid #e1e9e3; border-radius: 20rpx; background: #fff; white-space: normal; }
.near-icon { display: flex; width: 70rpx; height: 70rpx; align-items: center; justify-content: center; border-radius: 18rpx; background: #e5f5eb; font-size: 34rpx; }
.near-name { font-size: 24rpx; font-weight: 650; }
.gold { color: #d88b1f; }
.near-tags { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.near-price { color: #0e5233; font-size: 28rpx; font-weight: 700; }
.near-price text { color: #94a198; font-size: 18rpx; font-weight: 400; }
</style>
