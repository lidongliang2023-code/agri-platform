<template>
  <view class="page detail-page">
    <view v-if="loading" class="loading">正在加载订单详情…</view>
    <template v-else-if="order">
      <view class="status-hero">
        <text class="status-kicker">ORDER STATUS</text>
        <text class="status-title">{{ order.statusText || statusMeta(order.status).label }}</text>
        <text class="status-desc">订单已进入平台履约流程，关键节点全程留痕</text>
      </view>

      <view class="card address-card" v-if="order.address">
        <view class="address-icon">址</view>
        <view>
          <text class="address-name">{{ order.address.name }} · {{ order.address.phone }}</text>
          <text class="address-detail">{{ fullAddress(order.address) }}</text>
        </view>
      </view>

      <view class="card">
        <view class="card-head"><text class="card-title">商品清单</text><text class="card-sub">{{ order.items?.length || 0 }} 种商品</text></view>
        <view v-for="item in order.items || []" :key="item.id" class="item-row">
          <image v-if="item.image" class="item-image" :src="item.image" mode="aspectFill" />
          <view v-else class="item-image item-placeholder">丰</view>
          <view class="item-copy">
            <text class="item-name">{{ item.name }}</text>
            <text class="item-spec">{{ item.spec }}</text>
            <view class="item-bottom"><text class="price">{{ money(item.price) }}</text><text>× {{ item.quantity }}</text></view>
          </view>
        </view>
      </view>

      <view class="card info-card">
        <info-row label="订单编号" :value="order.orderNo" />
        <info-row label="创建时间" :value="order.createTime?.replace('T', ' ')" />
        <info-row label="支付方式" :value="order.payMethod || '-'" />
        <info-row label="支付时间" :value="order.payTime?.replace('T', ' ') || '-'" />
        <info-row label="物流公司" :value="order.logisticsCompany || '-'" />
        <info-row label="物流单号" :value="order.logisticsNo || '-'" />
        <info-row label="订单备注" :value="order.remark || '-'" />
      </view>

      <view class="card amount-card">
        <view><text>商品金额</text><text>{{ money(order.totalAmount) }}</text></view>
        <view><text>运费</text><text>{{ money(order.freightAmount) }}</text></view>
        <view><text>优惠</text><text class="discount">-{{ money(order.discountAmount) }}</text></view>
        <view class="total"><text>实付金额</text><text class="price">{{ money(order.payAmount) }}</text></view>
      </view>

      <view v-if="order.status === 'PENDING_PAY' || order.status === 'SHIPPED'" class="fixed-bottom detail-actions">
        <button v-if="order.status === 'PENDING_PAY'" class="btn btn-primary btn-block" @tap="pay">立即支付</button>
        <button v-if="order.status === 'SHIPPED'" class="btn btn-primary btn-block" @tap="receive">确认收货</button>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { defineComponent, h, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { mallApi, type Address, type Order } from '../../api'
import { money, statusMeta, toast } from '../../utils'

const InfoRow = defineComponent({
  props: { label: String, value: String },
  setup(props) {
    return () => h('view', { class: 'info-row' }, [
      h('text', { class: 'info-label' }, props.label || ''),
      h('text', { class: 'info-value' }, props.value || '-'),
    ])
  },
})

const order = ref<Order | null>(null)
const loading = ref(true)

onLoad((options) => load(String(options?.id || '')))

async function load(id: string | number) {
  loading.value = true
  try {
    order.value = await mallApi.getOrder(id)
  } catch (error) {
    toast((error as Error).message)
  } finally {
    loading.value = false
  }
}

function fullAddress(address: Address) {
  return `${address.province}${address.city}${address.district}${address.address}`
}

async function pay() {
  if (!order.value) return
  const result = await mallApi.payOrder(order.value.id)
  if (result.success) {
    toast('支付成功', 'success')
    load(order.value.id)
  }
}

async function receive() {
  if (!order.value) return
  const result = await mallApi.receiveOrder(order.value.id)
  if (result.success) {
    toast('已确认收货', 'success')
    load(order.value.id)
  }
}
</script>

<style scoped lang="scss">
.detail-page {
  padding-bottom: calc(40rpx + env(safe-area-inset-bottom));
}

.loading {
  padding: 120rpx 0;
  color: #84938a;
  text-align: center;
}

.status-hero {
  margin: 22rpx;
  padding: 30rpx;
  border-radius: 24rpx;
  background:
    radial-gradient(circle at 88% 0, rgba(159, 231, 184, 0.16), transparent 44%),
    linear-gradient(135deg, #073821, #12764a);
  color: #fff;
}

.status-kicker,
.status-title,
.status-desc {
  display: block;
}

.status-kicker {
  color: #9fe7b8;
  font-size: 16rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
}

.status-title {
  margin-top: 9rpx;
  font-size: 38rpx;
  font-weight: 800;
}

.status-desc {
  margin-top: 9rpx;
  color: rgba(255, 255, 255, 0.62);
  font-size: 20rpx;
}

.address-card {
  display: flex;
  align-items: flex-start;
  gap: 14rpx;
}

.address-icon {
  display: grid;
  width: 52rpx;
  height: 52rpx;
  flex: 0 0 52rpx;
  place-items: center;
  border-radius: 14rpx;
  background: #eaf7ef;
  color: #12764a;
  font-size: 21rpx;
  font-weight: 800;
}

.address-name,
.address-detail {
  display: block;
}

.address-name {
  color: #0b1a12;
  font-size: 24rpx;
  font-weight: 700;
}

.address-detail {
  margin-top: 8rpx;
  color: #718277;
  font-size: 20rpx;
  line-height: 1.55;
}

.item-row {
  display: flex;
  gap: 15rpx;
  padding: 16rpx 0;
  border-top: 1rpx solid #edf2ee;
}

.item-row:first-of-type {
  border-top: 0;
}

.item-image,
.item-placeholder {
  width: 116rpx;
  height: 116rpx;
  flex: 0 0 116rpx;
  border-radius: 14rpx;
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
  font-size: 23rpx;
  font-weight: 700;
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
}

.price {
  font-size: 28rpx;
}

.info-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
  padding: 17rpx 0;
  border-top: 1rpx solid #edf2ee;
}

.info-row:first-child {
  border-top: 0;
}

.info-label {
  color: #718277;
  font-size: 21rpx;
}

.info-value {
  max-width: 72%;
  color: #33453b;
  font-size: 21rpx;
  text-align: right;
}

.amount-card view {
  display: flex;
  justify-content: space-between;
  padding: 12rpx 0;
  color: #52665a;
  font-size: 21rpx;
}

.amount-card view.total {
  margin-top: 5rpx;
  padding-top: 18rpx;
  border-top: 1rpx solid #edf2ee;
  color: #0b1a12;
  font-weight: 700;
}

.amount-card .price {
  font-size: 30rpx;
}

.discount {
  color: #12764a;
}

.detail-actions {
  padding-top: 14rpx;
}
</style>
