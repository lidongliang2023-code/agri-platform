<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { serviceApi, statusMeta, type Order } from '../../api'

const orders = ref<Order[]>([])
const tab = ref('all')
const loading = ref(false)
const tabs = [['all', '全部'], ['confirmed', '待服务'], ['in_progress', '服务中'], ['completed', '已完成']]
const visible = computed(() => tab.value === 'all' ? orders.value : orders.value.filter((order) => order.status === tab.value))

onShow(load)

async function load() {
  loading.value = true
  try {
    orders.value = await serviceApi.orders()
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function openOrder(id: number) {
  uni.navigateTo({ url: `/pages/orders/detail?id=${id}` })
}

function publish() {
  uni.navigateTo({ url: '/pages/demand/publish' })
}
</script>

<template>
  <view class="page orders-page">
    <view class="page-top between"><view><text class="page-title">我的订单</text><text class="muted">服务进度与验收记录</text></view><button class="btn btn-sm btn-primary" @click="publish">＋发布</button></view>
    <scroll-view scroll-x class="tabs" :show-scrollbar="false">
      <button v-for="item in tabs" :key="item[0]" :class="{ on: tab === item[0] }" @click="tab = item[0]">{{ item[1] }}</button>
    </scroll-view>
    <view v-if="loading" class="loading">正在加载订单…</view>
    <view v-else-if="visible.length === 0" class="empty"><text class="empty-icon">📋</text><text>当前没有订单</text></view>
    <view v-else class="order-list">
      <view class="order-card" v-for="order in visible" :key="order.id" @click="openOrder(order.id)">
        <view class="between"><text class="tag green">{{ order.category }}</text><text class="tag" :class="statusMeta(order.status).tone">{{ statusMeta(order.status).label }}</text></view>
        <text class="order-title">{{ order.serviceName }}</text>
        <text class="muted">{{ order.providerName }} · {{ order.quantity }}{{ order.unit }} · ¥{{ order.totalAmount }}</text>
        <view class="order-meta"><text>📅 {{ order.appointmentDate }} {{ order.appointmentSlot }}</text><text>📍 {{ order.location }}</text></view>
        <view v-if="order.status === 'in_progress'" class="progress"><view :style="{ width: `${order.progress}%` }" /></view>
        <view class="order-foot"><text class="tiny">{{ order.orderNo }}</text><text class="link">{{ order.status === 'completed' && !order.rating ? '去评价' : '查看详情' }} ›</text></view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.orders-page { padding: 24rpx; }
.page-top { margin-bottom: 12rpx; }
.page-top > view { display: flex; flex-direction: column; gap: 5rpx; }
.page-title { font-size: 38rpx; font-weight: 750; }
.tabs { white-space: nowrap; }
.tabs button { display: inline-flex; padding: 12rpx 22rpx; margin: 8rpx 10rpx 18rpx 0; border-radius: 28rpx; background: #e9f0ec; color: #718277; font-size: 24rpx; }
.tabs button.on { background: #12764a; color: #fff; }
.order-list { display: flex; flex-direction: column; gap: 16rpx; }
.order-card { display: flex; flex-direction: column; gap: 9rpx; padding: 24rpx; border: 1rpx solid #e1e9e3; border-radius: 22rpx; background: #fff; }
.order-title { margin-top: 5rpx; font-size: 28rpx; font-weight: 650; }
.order-meta { display: flex; flex-direction: column; gap: 4rpx; color: #94a198; font-size: 24rpx; }
.order-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 4rpx; padding-top: 16rpx; border-top: 1rpx solid #edf2ee; }
.link { color: #12764a; font-size: 24rpx; font-weight: 600; }
</style>
