<template>
  <view class="page orders-page">
    <scroll-view class="status-scroller" scroll-x :show-scrollbar="false">
      <view class="status-row">
        <view
          v-for="item in tabs"
          :key="item.value"
          class="status-chip"
          :class="{ active: activeStatus === item.value }"
          @tap="changeStatus(item.value)"
        >
          {{ item.label }}
        </view>
      </view>
    </scroll-view>

    <view v-if="loading" class="loading">正在加载订单…</view>
    <view v-else-if="orders.length" class="order-list">
      <view v-for="order in orders" :key="order.id" class="order-card" @tap="openDetail(order.id)">
        <view class="order-head">
          <view><text class="order-kicker">ORDER</text><text class="order-no">{{ order.orderNo }}</text></view>
          <text class="tag" :class="`tag-${statusMeta(order.status).tone}`">{{ order.statusText || statusMeta(order.status).label }}</text>
        </view>
        <view class="order-items">
          <view v-for="item in order.items || []" :key="item.id" class="order-item">
            <image v-if="item.image" class="item-image" :src="item.image" mode="aspectFill" />
            <view v-else class="item-image item-placeholder">丰</view>
            <view class="item-copy">
              <text class="item-name">{{ item.name }}</text>
              <text class="item-spec">{{ item.spec }}</text>
              <view class="item-bottom"><text>{{ money(item.price) }}</text><text>× {{ item.quantity }}</text></view>
            </view>
          </view>
        </view>
        <view class="order-foot">
          <text class="order-time">{{ order.createTime?.replace('T', ' ') }}</text>
          <view class="order-total">合计 <text class="price">{{ money(order.payAmount) }}</text></view>
        </view>
        <view class="order-actions">
          <button class="btn btn-sm order-action" @tap.stop="openDetail(order.id)">查看详情</button>
          <button v-if="order.status === 'PENDING_PAY'" class="btn btn-sm btn-primary order-action" @tap.stop="pay(order)">立即支付</button>
          <button v-if="order.status === 'SHIPPED'" class="btn btn-sm btn-primary order-action" @tap.stop="receive(order)">确认收货</button>
        </view>
      </view>
    </view>
    <view v-else class="empty">
      <view class="empty-icon">单</view>
      <text>暂无相关订单</text>
      <button class="btn btn-ghost empty-button" @tap="goShopping">去选购</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { mallApi, type Order } from '../../api'
import { session } from '../../session'
import { money, statusMeta, toast } from '../../utils'

const tabs = [
  { label: '全部', value: '' },
  { label: '待付款', value: 'PENDING_PAY' },
  { label: '待发货', value: 'PENDING_SHIP' },
  { label: '已发货', value: 'SHIPPED' },
  { label: '已完成', value: 'COMPLETED' },
]

const activeStatus = ref('')
const orders = ref<Order[]>([])
const loading = ref(false)

onShow(loadOrders)

async function loadOrders() {
  if (!session.user) {
    uni.redirectTo({ url: '/pages/login/index?redirect=%2Fpages%2Forders%2Findex' })
    return
  }
  loading.value = true
  try {
    const result = await mallApi.getOrders({
      consumerId: session.user.id,
      page: 1,
      size: 30,
      status: activeStatus.value,
    })
    orders.value = result.records || []
  } catch (error) {
    toast((error as Error).message)
  } finally {
    loading.value = false
  }
}

function changeStatus(status: string) {
  activeStatus.value = status
  loadOrders()
}

function openDetail(id: number) {
  uni.navigateTo({ url: `/pages/orders/detail?id=${id}` })
}

async function pay(order: Order) {
  try {
    const result = await mallApi.payOrder(order.id)
    if (!result.success) throw new Error(result.message || '支付失败')
    toast('支付成功', 'success')
    loadOrders()
  } catch (error) {
    toast((error as Error).message)
  }
}

async function receive(order: Order) {
  try {
    const result = await mallApi.receiveOrder(order.id)
    if (!result.success) throw new Error(result.message || '收货失败')
    toast('已确认收货', 'success')
    loadOrders()
  } catch (error) {
    toast((error as Error).message)
  }
}

function goShopping() {
  uni.switchTab({ url: '/pages/home/index' })
}
</script>

<style scoped lang="scss">
.status-scroller {
  width: 100%;
  white-space: nowrap;
}

.status-row {
  display: inline-flex;
  gap: 10rpx;
  padding: 20rpx 22rpx;
}

.status-chip {
  height: 60rpx;
  padding: 0 24rpx;
  border: 1rpx solid #e3eae5;
  border-radius: 999rpx;
  background: #fff;
  color: #4b5d53;
  font-size: 21rpx;
  line-height: 58rpx;
}

.status-chip.active {
  border-color: #12764a;
  background: #e9f6ee;
  color: #0e5233;
  font-weight: 700;
}

.loading {
  padding: 100rpx 0;
  color: #84938a;
  text-align: center;
}

.order-list {
  padding: 0 22rpx 30rpx;
}

.order-card {
  margin-bottom: 16rpx;
  padding: 22rpx;
  border: 1rpx solid #e3eae5;
  border-radius: 22rpx;
  background: #fff;
}

.order-head,
.order-foot,
.order-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.order-kicker,
.order-no {
  display: block;
}

.order-kicker {
  color: #12764a;
  font-size: 15rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
}

.order-no {
  margin-top: 4rpx;
  color: #0b1a12;
  font-size: 22rpx;
  font-weight: 700;
}

.order-items {
  margin-top: 14rpx;
}

.order-item {
  display: flex;
  gap: 14rpx;
  padding: 13rpx 0;
  border-top: 1rpx solid #edf2ee;
}

.item-image,
.item-placeholder {
  width: 112rpx;
  height: 112rpx;
  flex: 0 0 112rpx;
  border-radius: 13rpx;
}

.item-image {
  background: #eef7f1;
}

.item-placeholder {
  display: grid;
  place-items: center;
  background: #edf7f1;
  color: rgba(18, 118, 74, 0.18);
  font-size: 40rpx;
  font-weight: 800;
}

.item-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.item-name {
  color: #0b1a12;
  font-size: 23rpx;
  font-weight: 650;
}

.item-spec {
  margin-top: 6rpx;
  color: #84938a;
  font-size: 18rpx;
}

.item-bottom {
  display: flex;
  justify-content: space-between;
  margin-top: auto;
  color: #52665a;
  font-size: 19rpx;
}

.order-foot {
  margin-top: 10rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #edf2ee;
}

.order-time {
  color: #93a29a;
  font-size: 17rpx;
}

.order-total {
  color: #52665a;
  font-size: 20rpx;
}

.order-total .price {
  font-size: 27rpx;
}

.order-actions {
  justify-content: flex-end;
  gap: 10rpx;
  margin-top: 16rpx;
}

.order-action {
  margin: 0;
}

.empty-button {
  min-width: 220rpx;
  margin-top: 15rpx;
}
</style>
