<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { money, ORDER_STATUS, tradeApi, type TradeOrder } from '../../api'

const orders = ref<TradeOrder[]>([])
const loading = ref(false)

onShow(() => void load())

async function load() {
  loading.value = true
  try {
    orders.value = await tradeApi.orders()
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '订单加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <view class="page pad">
    <view class="section-head"><text class="title">我的交易订单</text><text class="tiny">{{ orders.length }} 笔</text></view>
    <view v-if="loading" class="loading">正在加载订单…</view>
    <view v-else>
      <view class="card order-card" v-for="item in orders" :key="item.id">
        <view class="between"><text class="order-no">{{ item.orderNo }}</text><text class="tag">{{ ORDER_STATUS[item.orderStatus] || item.orderStatus }}</text></view>
        <text class="order-name">{{ item.productName || '交易订单' }}</text>
        <text class="muted">{{ item.buyerName || '' }} {{ item.sellerName ? `→ ${item.sellerName}` : '' }}</text>
        <view class="between foot"><text class="tiny">{{ item.createTime }}</text><text class="price">{{ money(item.totalAmount) }}</text></view>
      </view>
      <view v-if="!orders.length" class="empty">暂无交易订单</view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20rpx; }
.title { font-size: 34rpx; font-weight: 760; }
.order-no { font-family: monospace; font-size: 21rpx; font-weight: 650; }
.order-name { display: block; margin-top: 14rpx; font-size: 26rpx; font-weight: 700; }
.order-card > .muted { display: block; margin-top: 6rpx; }
.foot { margin-top: 16rpx; padding-top: 14rpx; border-top: 1rpx solid #edf2ee; }
</style>
