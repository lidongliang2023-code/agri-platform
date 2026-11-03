<template>
  <view class="page detail-page">
    <view v-if="loading" class="loading">正在加载订单详情…</view>
    <template v-else-if="order">
      <view class="hero status-hero">
        <text class="hero-kicker">ORDER STATUS</text>
        <text class="hero-title">{{ statusMeta(order.status).label }}</text>
        <text class="hero-desc">{{ order.orderNo }}</text>
      </view>
      <view class="card">
        <view class="card-head"><text class="card-title">商品清单</text><text class="card-sub">{{ order.items?.length || 0 }} 种商品</text></view>
        <view v-for="item in order.items || []" :key="item.id" class="item-row">
          <image v-if="item.image" class="item-image" :src="item.image" mode="aspectFill" />
          <view v-else class="item-image item-placeholder">丰</view>
          <view class="item-copy"><text>{{ item.name }}</text><small class="small-copy">{{ item.spec }}</small><view><b>{{ money(item.price) }}</b><small class="small-copy">× {{ item.quantity }}</small></view></view>
        </view>
      </view>
      <view class="card info-card">
        <view><text>订单编号</text><b>{{ order.orderNo }}</b></view>
        <view><text>消费者 ID</text><b>{{ order.consumerId }}</b></view>
        <view><text>创建时间</text><b>{{ order.createTime?.replace('T', ' ') }}</b></view>
        <view><text>支付时间</text><b>{{ order.payTime?.replace('T', ' ') || '-' }}</b></view>
        <view><text>物流公司</text><b>{{ order.logisticsCompany || '-' }}</b></view>
        <view><text>物流单号</text><b>{{ order.logisticsNo || '-' }}</b></view>
        <view><text>订单备注</text><b>{{ order.remark || '-' }}</b></view>
      </view>
      <view class="card amount-card"><view><text>商品金额</text><b>{{ money(order.totalAmount) }}</b></view><view class="total"><text>实付金额</text><b class="price">{{ money(order.payAmount) }}</b></view></view>
      <view v-if="order.status === 'PENDING_SHIP'" class="fixed-bottom action-bar">
        <button class="btn btn-primary btn-block" @tap="ship">确认发货</button>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { supplierApi, type Order } from '../../api'
import { money, statusMeta, toast } from '../../utils'

const order = ref<Order | null>(null)
const loading = ref(true)

onLoad((options) => load(Number(options?.id || 0)))

async function load(id: number) {
  loading.value = true
  try {
    order.value = await supplierApi.getOrderDetail(id)
  } catch (error) {
    toast((error as Error).message)
  } finally {
    loading.value = false
  }
}

function ship() {
  if (!order.value) return
  uni.showModal({
    title: '确认发货',
    content: '请输入物流单号',
    editable: true,
    placeholderText: '物流单号',
    success: async (result) => {
      if (!result.confirm) return
      const logisticsNo = String(result.content || '').trim()
      if (!logisticsNo) return toast('请输入物流单号')
      try {
        const response = await supplierApi.shipOrder(order.value!.id, logisticsNo, '丰链云合作物流')
        if (!response.success) throw new Error(response.message || '发货失败')
        toast('订单已发货', 'success')
        load(order.value!.id)
      } catch (error) {
        toast((error as Error).message)
      }
    },
  })
}
</script>

<style scoped lang="scss">
.detail-page {
  padding-bottom: calc(30rpx + env(safe-area-inset-bottom));
}

.loading {
  padding: 100rpx 0;
  color: #84938a;
  text-align: center;
}

.status-hero {
  margin-bottom: 0;
}

.item-row {
  display: flex;
  gap: 14rpx;
  padding: 14rpx 0;
  border-top: 1rpx solid #edf2ee;
}

.item-row:first-of-type {
  border-top: 0;
}

.item-image {
  width: 112rpx;
  height: 112rpx;
  flex: 0 0 112rpx;
  border-radius: 14rpx;
  background: #eef7f1;
}

.item-placeholder {
  display: grid;
  place-items: center;
  color: rgba(18,118,74,.16);
  font-size: 40rpx;
  font-weight: 800;
}

.item-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.item-copy > text {
  font-size: 22rpx;
  font-weight: 700;
}

.item-copy > .small-copy {
  margin-top: 4rpx;
  color: #93a29a;
  font-size: 17rpx;
}

.item-copy > view {
  display: flex;
  justify-content: space-between;
  margin-top: auto;
}

.item-copy b {
  color: #d45b32;
  font-size: 21rpx;
}

.item-copy view .small-copy {
  color: #718277;
  font-size: 18rpx;
}

.info-card view,
.amount-card view {
  display: flex;
  justify-content: space-between;
  gap: 20rpx;
  padding: 14rpx 0;
  border-top: 1rpx solid #edf2ee;
}

.info-card view:first-child,
.amount-card view:first-child {
  border-top: 0;
}

.info-card text,
.amount-card text {
  color: #718277;
  font-size: 20rpx;
}

.info-card b,
.amount-card b {
  max-width: 70%;
  color: #33453b;
  font-size: 20rpx;
  font-weight: 600;
  text-align: right;
}

.amount-card .price {
  font-size: 28rpx;
}

.action-bar {
  padding-top: 14rpx;
}
</style>
