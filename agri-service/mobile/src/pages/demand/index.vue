<script setup lang="ts">
import { ref } from 'vue'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { serviceApi, statusMeta } from '../../api'
const items = ref<Awaited<ReturnType<typeof serviceApi.myDemands>>>([])
const loading = ref(false)
const error = ref('')
onShow(load)
onPullDownRefresh(async () => { await load(); uni.stopPullDownRefresh() })
async function load() {
  if (loading.value) return
  loading.value = true; error.value = ''
  try { items.value = await serviceApi.myDemands() }
  catch (reason) { error.value = reason instanceof Error ? reason.message : '需求加载失败' }
  finally { loading.value = false }
}
function publish() { uni.navigateTo({ url: '/pages/demand/publish' }) }
function orders() { uni.switchTab({ url: '/pages/orders/index' }) }
</script>
<template>
  <view class="page page-pad">
    <view class="card-head"><view><text class="card-title">我发布的需求</text><text class="intro muted">跟踪匹配、指派与接单进度</text></view><button class="btn btn-primary" @click="publish">发布需求</button></view>
    <view v-if="loading" class="loading">正在加载需求…</view>
    <view v-else-if="error" class="empty"><text>{{ error }}</text><button class="btn" @click="load">重新加载</button></view>
    <view v-else-if="!items.length" class="empty"><text>还没有发布需求</text><text>填写作业要求后，同类目服务商可接单。</text><button class="btn btn-ghost" @click="publish">发布第一条需求</button></view>
    <view v-else v-for="item in items" :key="item.id" class="card demand-card">
      <view class="between"><text class="card-title">{{ item.serviceName }}</text><text class="tag" :class="statusMeta(item.status).tone">{{ statusMeta(item.status).label }}</text></view>
      <text class="muted">{{ item.area }} · {{ item.preferredDate }}</text><text class="muted">{{ item.location }}</text><text class="tiny">需求号 {{ item.demandNo }}</text>
      <view v-if="item.acceptedProviderName" class="accepted"><text>承接服务商：{{ item.acceptedProviderName }}</text><button class="btn btn-ghost" @click="orders">查看服务订单</button></view>
      <text v-else class="muted">匹配中，接单结果将通过平台消息同步。</text>
    </view>
  </view>
</template>
<style scoped>
.intro { display: block; margin-top: 8rpx; }
.demand-card { display: flex; flex-direction: column; gap: 16rpx; }
.demand-card .between { gap: 16rpx; align-items: flex-start; }
.accepted { display: flex; flex-direction: column; gap: 16rpx; padding-top: 16rpx; border-top: 1rpx solid #e4ece6; }
</style>
