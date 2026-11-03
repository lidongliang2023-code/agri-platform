<template>
  <view class="page orders-page">
    <view class="page-top">
      <view><text class="kicker">ORDER FULFILLMENT</text><text class="title">订单管理</text></view>
      <text class="sub">共 {{ orders.length }} 单</text>
    </view>
    <scroll-view class="status-scroll" scroll-x :show-scrollbar="false">
      <view class="status-row">
        <view v-for="item in statuses" :key="item.value" class="status-chip" :class="{ active: status === item.value }" @tap="changeStatus(item.value)">
          {{ item.label }}
        </view>
      </view>
    </scroll-view>

    <view v-if="loading" class="loading">正在加载订单…</view>
    <view v-else-if="orders.length" class="order-list">
      <view v-for="order in orders" :key="order.id" class="order-card" @tap="openDetail(order.id)">
        <view class="order-head">
          <view><text class="order-kicker">ORDER</text><text class="order-no">{{ order.orderNo }}</text></view>
          <text class="tag" :class="`tag-${statusMeta(order.status).tone}`">{{ statusMeta(order.status).label }}</text>
        </view>
        <view class="order-data">
          <view><small class="small-copy">消费者</small><b>{{ order.consumerId }}</b></view>
          <view><small class="small-copy">订单金额</small><b>{{ money(order.totalAmount) }}</b></view>
          <view><small class="small-copy">实付金额</small><b class="price">{{ money(order.payAmount) }}</b></view>
        </view>
        <view class="order-foot">
          <text>{{ order.createTime?.replace('T', ' ') }}</text>
          <view class="order-actions">
            <button class="btn btn-sm" @tap.stop="openDetail(order.id)">详情</button>
            <button v-if="order.status === 'PENDING_SHIP'" class="btn btn-sm btn-primary" @tap.stop="ship(order)">立即发货</button>
          </view>
        </view>
      </view>
    </view>
    <view v-else class="empty"><view class="empty-icon">单</view><text>暂无订单</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { supplierApi, type Order } from '../../api'
import { requireSupplierLogin } from '../../session'
import { money, statusMeta, toast } from '../../utils'

const statuses = [
  { label: '全部', value: '' },
  { label: '待付款', value: 'PENDING_PAY' },
  { label: '待发货', value: 'PENDING_SHIP' },
  { label: '已发货', value: 'SHIPPED' },
  { label: '已完成', value: 'COMPLETED' },
]
const orders = ref<Order[]>([])
const status = ref('')
const loading = ref(false)

onShow(load)
onPullDownRefresh(load)

async function load() {
  if (!requireSupplierLogin()) return
  loading.value = true
  try {
    const result = await supplierApi.getOrders({ page: 1, size: 50, status: status.value })
    orders.value = result.records || []
  } catch (error) {
    toast((error as Error).message)
  } finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function changeStatus(value: string) {
  status.value = value
  load()
}

function openDetail(id: number) {
  uni.navigateTo({ url: `/pages/orders/detail?id=${id}` })
}

function ship(order: Order) {
  uni.showModal({
    title: '订单发货',
    content: `为订单 ${order.orderNo} 输入物流单号`,
    editable: true,
    placeholderText: '请输入物流单号',
    confirmText: '确认发货',
    success: async (result) => {
      if (!result.confirm) return
      const logisticsNo = String(result.content || '').trim()
      if (!logisticsNo) return toast('请输入物流单号')
      try {
        const response = await supplierApi.shipOrder(order.id, logisticsNo, '丰链云合作物流')
        if (!response.success) throw new Error(response.message || '发货失败')
        toast('订单已发货', 'success')
        load()
      } catch (error) {
        toast((error as Error).message)
      }
    },
  })
}
</script>

<style scoped lang="scss">
.orders-page {
  padding-bottom: 26rpx;
}

.page-top {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 24rpx 22rpx 16rpx;
}

.page-top .kicker,
.page-top .title {
  display: block;
}

.page-top .kicker {
  color: #12764a;
  font-size: 16rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
}

.page-top .title {
  margin-top: 4rpx;
  font-size: 34rpx;
  font-weight: 800;
}

.status-scroll {
  width: 100%;
  white-space: nowrap;
}

.status-row {
  display: inline-flex;
  gap: 9rpx;
  padding: 0 22rpx 16rpx;
}

.status-chip {
  padding: 9rpx 22rpx;
  border: 1rpx solid #e3eae5;
  border-radius: 999rpx;
  background: #fff;
  color: #718277;
  font-size: 19rpx;
}

.status-chip.active {
  border-color: #12764a;
  background: #e9f6ee;
  color: #0e5233;
  font-weight: 700;
}

.loading {
  padding: 90rpx 0;
  color: #84938a;
  text-align: center;
}

.order-list {
  padding: 0 22rpx;
}

.order-card {
  margin-bottom: 14rpx;
  padding: 21rpx;
  border: 1rpx solid #e3eae5;
  border-radius: 21rpx;
  background: #fff;
}

.order-head,
.order-foot {
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
  font-size: 14rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
}

.order-no {
  margin-top: 4rpx;
  color: #0b1a12;
  font-size: 21rpx;
  font-weight: 700;
}

.order-data {
  display: flex;
  margin-top: 16rpx;
  padding: 16rpx 0;
  border-top: 1rpx solid #edf2ee;
  border-bottom: 1rpx solid #edf2ee;
}

.order-data view {
  flex: 1;
}

.order-data .small-copy,
.order-data b {
  display: block;
}

.order-data .small-copy {
  color: #93a29a;
  font-size: 16rpx;
}

.order-data b {
  margin-top: 5rpx;
  color: #33453b;
  font-size: 20rpx;
}

.order-foot {
  padding-top: 14rpx;
}

.order-foot > text {
  color: #93a29a;
  font-size: 16rpx;
}

.order-actions {
  display: flex;
  gap: 8rpx;
}
</style>
