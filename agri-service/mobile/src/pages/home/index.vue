<script setup lang="ts">
import { ref } from 'vue'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { serviceApi, type Overview } from '../../api'
import { getServiceUser, hasServicePermission } from '../../auth'

const overview = ref<Overview | null>(null)
const keyword = ref('')
const loading = ref(false)
const error = ref('')
const consumer = ref(false)
const provider = ref(false)
const userName = ref('平台用户')
onShow(() => {
  consumer.value = hasServicePermission('service:consumer')
  provider.value = hasServicePermission('service:provider')
  userName.value = getServiceUser()?.nickname || getServiceUser()?.username || '平台用户'
  load()
})
onPullDownRefresh(async () => { await load(); uni.stopPullDownRefresh() })
async function load() {
  if (!consumer.value || loading.value) return
  loading.value = true
  error.value = ''
  try { overview.value = await serviceApi.overview() }
  catch (reason) { error.value = reason instanceof Error ? reason.message : '服务数据暂不可用' }
  finally { loading.value = false }
}
function nav(url: string) { uni.navigateTo({ url }) }
function orders() { uni.switchTab({ url: '/pages/orders/index' }) }
function findService(category = '') {
  uni.setStorageSync('service_search', { keyword: keyword.value.trim(), category })
  uni.switchTab({ url: '/pages/services/index' })
}
function categoryNav(name: string) {
  if (name === '农险服务') return nav('/pages/insurance/index')
  findService(name)
}
function todoNav(link: string) {
  if (link.startsWith('order:')) return nav(`/pages/orders/detail?id=${encodeURIComponent(link.slice(6))}`)
  if (link === 'policy') return nav('/pages/policies/index')
  if (link === 'claim') return nav('/pages/insurance/index')
  if (link === 'complaint') return nav('/pages/feedback/index')
  uni.switchTab({ url: '/pages/orders/index' })
}
</script>

<template>
  <view class="page home-page">
    <view class="welcome">
      <view class="between"><text class="greeting">您好，{{ userName }}</text><button class="message-button" @click="nav('/pages/messages/index')">消息{{ overview?.stats.unreadMessages ? ` · ${overview.stats.unreadMessages}` : '' }}</button></view>
      <text class="headline">农事服务，一站办理</text>
      <text class="welcome-copy">找服务、跟进作业、验收评价</text>
      <view v-if="consumer" class="search-row"><input v-model="keyword" confirm-type="search" placeholder="搜索服务项目或服务商" @confirm="findService()" /><button @click="findService()">搜索</button></view>
    </view>
    <view class="page-pad">
      <view v-if="provider" class="card provider-entry" @click="nav('/pages/workbench/index')"><view><text class="card-title">服务商接单台</text><text class="muted">查看同类目需求、填写履约进度</text></view><text class="arrow">›</text></view>
      <template v-if="consumer">
        <view class="primary-actions">
          <button class="primary-action" @click="findService()"><text class="action-title">找服务</text><text>按项目选择服务商 ›</text></button>
          <button class="primary-action light" @click="nav('/pages/demand/publish')"><text class="action-title">发布需求</text><text>填写要求，等待接单 ›</text></button>
        </view>
        <view class="entry-grid">
          <button @click="nav('/pages/demand/index')"><text class="entry-symbol">需</text><text>我的需求</text></button>
          <button @click="nav('/pages/policies/index')"><text class="entry-symbol">政</text><text>政策申报</text></button>
          <button @click="nav('/pages/insurance/index')"><text class="entry-symbol">保</text><text>农业保险</text></button>
          <button @click="nav('/pages/feedback/index')"><text class="entry-symbol">问</text><text>投诉反馈</text></button>
          <button @click="nav('/pages/consult/index')"><text class="entry-symbol">诊</text><text>专家问诊</text></button>
          <button @click="nav('/pages/resources/index')"><text class="entry-symbol">资</text><text>产业资源</text></button>
          <button @click="nav('/pages/training/index')"><text class="entry-symbol">学</text><text>培训课堂</text></button>
          <button @click="nav('/pages/join/index')"><text class="entry-symbol">入</text><text>服务商入驻</text></button>
        </view>
        <view v-if="error" class="card error-state"><text>{{ error }}</text><button class="btn btn-ghost" @click="load">重新加载</button></view>
        <view v-else-if="loading && !overview" class="loading">正在加载服务数据…</view>
        <template v-if="overview && !error">
          <view class="card">
            <view class="card-head"><text class="card-title">待我处理</text><button class="text-action" @click="orders">全部订单 ›</button></view>
            <view v-for="todo in overview.todos" :key="todo.link + todo.title" class="todo-row" @click="todoNav(todo.link)"><view><text class="strong">{{ todo.title }}</text><text class="muted">{{ todo.content }}</text></view><text class="arrow">›</text></view>
            <text v-if="!overview.todos.length" class="muted">暂无待办，服务进度会在这里和消息中同步。</text>
          </view>
          <view v-if="overview.categories.length" class="card"><view class="card-head"><text class="card-title">按服务类型查找</text></view><view class="category-grid"><button v-for="item in overview.categories" :key="item.key" @click="categoryNav(item.name)"><text class="strong">{{ item.name }}</text><text class="tiny">{{ item.count }} 家服务商 ›</text></button></view></view>
          <view v-if="overview.featuredProviders.length" class="card"><view class="card-head"><text class="card-title">服务商推荐</text><button class="text-action" @click="findService()">查看全部 ›</button></view><view v-for="item in overview.featuredProviders.slice(0, 3)" :key="item.id" class="provider-row" @click="nav(`/pages/provider/detail?id=${item.id}`)"><view><text class="strong">{{ item.name }}</text><text class="muted">{{ item.category }} · {{ item.region }}</text></view><view class="provider-price"><text>¥{{ item.price }}起</text><text class="tiny">{{ item.unit }}</text></view></view></view>
        </template>
        <view class="assistant-entry" @click="nav('/pages/ai/index')"><text class="strong">农事问题初判</text><text class="muted">文字描述症状，获取初步建议 ›</text></view>
      </template>
      <view v-else-if="!provider" class="card"><text class="card-title">当前账号尚无移动业务角色</text><text class="muted">请联系平台开通综合服务消费者或服务商权限。</text></view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.welcome { padding: 24rpx 28rpx 32rpx; background: #0d5036; color: white; }
.greeting { font-size: 14px; color: #d3e8dc; }
.message-button { min-height: 44px; padding: 16rpx; color: white; font-size: 14px; }
.headline { display: block; margin-top: 12rpx; font-size: 44rpx; font-weight: 700; }
.welcome-copy { display: block; margin-top: 8rpx; color: #d3e8dc; font-size: 14px; }
.search-row { display: flex; align-items: center; margin-top: 24rpx; padding-left: 24rpx; background: white; color: #183a29; border-radius: 18rpx; }
.search-row input { flex: 1; min-width: 0; height: 96rpx; font-size: 15px; }
.search-row button { min-width: 112rpx; min-height: 96rpx; line-height: 96rpx; font-size: 15px; }
.primary-actions { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 18rpx; }
.primary-action { padding: 28rpx 22rpx; background: #12764a; border-radius: 20rpx; color: white; text-align: left; }
.primary-action text { display: block; font-size: 13px; }
.primary-action .action-title { font-size: 34rpx; font-weight: 700; margin-bottom: 8rpx; }
.primary-action.light { background: #e7efdf; color: #315127; }
.entry-grid { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 12rpx; padding: 28rpx 0; }
.entry-grid button { display: flex; flex-direction: column; align-items: center; gap: 10rpx; font-size: 14px; }
.entry-symbol { display: flex; align-items: center; justify-content: center; width: 76rpx; height: 76rpx; border-radius: 22rpx; background: white; border: 1rpx solid #dce7df; color: #12764a; font-size: 32rpx; font-weight: 700; }
.todo-row,.provider-row,.provider-entry { display: flex; gap: 20rpx; align-items: center; justify-content: space-between; }
.todo-row,.provider-row { padding: 22rpx 0; border-top: 1rpx solid #edf2ee; }
.todo-row > view,.provider-row > view:first-child,.provider-entry > view { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 6rpx; }
.arrow { color: #666666; font-size: 40rpx; }
.text-action { min-height: 44px; display: flex; align-items: center; color: #12764a; font-size: 13px; }
.category-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12rpx; }
.category-grid button { display: flex; flex-direction: column; gap: 8rpx; padding: 20rpx; background: #f4f7f2; border-radius: 14rpx; text-align: left; }
.provider-price { display: flex; flex-direction: column; align-items: flex-end; color: #12764a; font-weight: 650; }
.assistant-entry { display: flex; flex-direction: column; gap: 8rpx; padding: 24rpx; border-left: 6rpx solid #b5c68c; background: #eef2e7; }
.error-state { display: flex; flex-direction: column; gap: 20rpx; }
</style>
