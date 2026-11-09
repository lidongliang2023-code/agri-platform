<template>
  <view class="page orders-page">
    <view class="hero"><text class="hero-kicker">CHANNEL ORDERS</text><text class="hero-title">订单管理</text><text class="hero-desc">跟踪成交、履约与客户订单进度</text></view>
    <scroll-view class="status-scroll" scroll-x :show-scrollbar="false"><view class="status-row"><view v-for="item in statuses" :key="item.value" class="status-chip" :class="{ active: status === item.value }" @tap="changeStatus(item.value)">{{ item.label }}</view></view></scroll-view>
    <view v-if="loading" class="loading">正在加载订单…</view>
    <view v-else-if="loadError" class="empty order-error" role="alert"><view class="empty-icon">!</view><text class="error-title">订单加载失败</text><text class="error-message">{{ loadError }}</text><button class="btn btn-sm btn-primary retry-button" @tap="load">重新加载</button></view>
    <view v-else-if="orders.length" class="order-list">
      <view v-for="order in orders" :key="order.id" class="order-card">
        <view class="order-head"><view><text class="kicker">ORDER</text><text class="order-no">{{ order.orderNo }}</text></view><text class="tag" :class="`tag-${statusMeta(order.status).tone}`">{{ statusMeta(order.status).label }}</text></view>
        <view class="order-data"><view><small class="small-copy">消费者</small><b>{{ order.consumerId }}</b></view><view><small class="small-copy">订单金额</small><b>{{ money(order.totalAmount) }}</b></view><view><small class="small-copy">实付金额</small><b class="price">{{ money(order.payAmount) }}</b></view></view>
        <text class="order-time">{{ order.createTime?.replace('T', ' ') }}</text>
      </view>
    </view>
    <view v-else class="empty"><view class="empty-icon">单</view><text>暂无订单</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { channelApi, type Order } from '../../api'
import { requireChannelLogin } from '../../session'
import { money, statusMeta } from '../../utils'

const statuses = [{ label: '全部', value: '' }, { label: '待付款', value: 'PENDING_PAY' }, { label: '待发货', value: 'PENDING_SHIP' }, { label: '已发货', value: 'SHIPPED' }, { label: '已完成', value: 'COMPLETED' }]
const status = ref('')
const orders = ref<Order[]>([])
const loading = ref(false)
const loadError = ref('')
let latestRequest = 0
onShow(load)
onPullDownRefresh(load)

async function load() {
  const requestId = ++latestRequest
  if (!requireChannelLogin()) {
    orders.value = []
    loading.value = false
    loadError.value = '请登录商家账号后查看订单'
    uni.stopPullDownRefresh()
    return
  }
  loading.value = true
  loadError.value = ''
  orders.value = []
  try {
    const result = await channelApi.getOrders({ page: 1, size: 50, status: status.value })
    if (requestId !== latestRequest) return
    if (!result || !Array.isArray(result.records)) {
      throw new Error('订单数据格式异常，请重新加载')
    }
    orders.value = result.records
  } catch (error) {
    if (requestId !== latestRequest) return
    loadError.value = error instanceof Error && error.message
      ? error.message
      : '暂时无法获取订单，请检查网络后重试'
  } finally {
    if (requestId === latestRequest) {
      loading.value = false
      uni.stopPullDownRefresh()
    }
  }
}
function changeStatus(value: string) { status.value = value; load() }
</script>

<style scoped lang="scss">
.order-error{padding:70rpx 32rpx}.error-title{font-weight:700;color:#33453b}.error-message{display:block;max-width:100%;margin-top:14rpx;color:#84938a;font-size:24rpx;line-height:1.6;white-space:normal;overflow-wrap:anywhere;text-align:center}.retry-button{margin-top:24rpx}
.orders-page{padding-bottom:28rpx}.status-scroll{width:100%;white-space:nowrap}.status-row{display:inline-flex;gap:9rpx;padding:2rpx 22rpx 16rpx}.status-chip{padding:9rpx 22rpx;border:1rpx solid #e3eae5;border-radius:999rpx;background:#fff;color:#718277;font-size:24rpx}.status-chip.active{border-color:#12764a;background:#e9f6ee;color:#0e5233;font-weight:700}.loading{padding:90rpx 0;color:#84938a;text-align:center}.order-list{padding:0 22rpx}.order-card{margin-bottom:14rpx;padding:21rpx;border:1rpx solid #e3eae5;border-radius:21rpx;background:#fff}.order-head{display:flex;align-items:center;justify-content:space-between}.kicker,.order-no{display:block}.kicker{color:#12764a;font-size:24rpx;font-weight:700;letter-spacing:2rpx}.order-no{margin-top:4rpx;color:#0b1a12;font-size:24rpx;font-weight:700}.order-data{display:flex;margin-top:15rpx;padding:16rpx 0;border-top:1rpx solid #edf2ee;border-bottom:1rpx solid #edf2ee}.order-data view{flex:1}.order-data .small-copy,.order-data b{display:block}.order-data .small-copy{color:#93a29a;font-size:24rpx}.order-data b{margin-top:5rpx;color:#33453b;font-size:24rpx}.order-time{display:block;margin-top:12rpx;color:#93a29a;font-size:24rpx;text-align:right}
</style>
