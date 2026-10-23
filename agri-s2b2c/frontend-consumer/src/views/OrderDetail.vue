<template>
  <div class="order-detail-page">
    <van-nav-bar title="订单详情" left-arrow @click-left="$router.back()" />
    <div v-if="order" class="order-content">
      <div class="status-card">
        <span class="status-icon">📦</span>
        <span class="status-text">{{ order.statusText }}</span>
      </div>
      <div class="info-card">
        <h3>收货信息</h3>
        <div v-if="order.address" class="address-info">
          <span class="address-name">{{ order.address.name }}</span>
          <span class="address-phone">{{ order.address.phone }}</span>
          <p class="address-detail">{{ order.address.province }}{{ order.address.city }}{{ order.address.district }}{{ order.address.address }}</p>
        </div>
      </div>
      <div class="items-card">
        <h3>商品清单</h3>
        <div class="order-items">
          <div class="order-item" v-for="item in order.items" :key="item.id">
            <img :src="item.image" class="item-img" />
            <div class="item-info">
              <h4 class="item-name">{{ item.name }}</h4>
              <p class="item-spec">{{ item.spec }}</p>
              <div class="item-bottom">
                <span class="item-price">¥{{ item.price }}</span>
                <span class="item-quantity">x{{ item.quantity }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="logistics-card">
        <h3>物流信息</h3>
        <div v-if="order.logisticsNo" class="logistics-info">
          <p>物流公司: {{ order.logisticsCompany }}</p>
          <p>物流单号: {{ order.logisticsNo }}</p>
        </div>
        <div v-else class="logistics-empty">
          <p>暂无物流信息</p>
        </div>
      </div>
      <div class="price-card">
        <div class="price-row">
          <span>商品总价</span>
          <span>¥{{ order.totalAmount }}</span>
        </div>
        <div class="price-row">
          <span>运费</span>
          <span>¥{{ order.freightAmount }}</span>
        </div>
        <div class="price-row">
          <span>优惠</span>
          <span>-¥{{ order.discountAmount }}</span>
        </div>
        <div class="price-row total">
          <span>实付款</span>
          <span>¥{{ order.payAmount }}</span>
        </div>
      </div>
      <div class="bottom-bar">
        <van-button type="primary" v-if="order.status === 'PENDING_PAY'" @click="payOrder">支付</van-button>
        <van-button type="primary" v-if="order.status === 'SHIPPED'" @click="receiveOrder">确认收货</van-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { consumerApi } from '../api'

const route = useRoute()
const router = useRouter()
const order = ref(null)

onMounted(() => {
  loadOrder()
})

const loadOrder = async () => {
  const res = await consumerApi.getOrderDetail(route.params.id)
  order.value = res
}

const payOrder = async () => {
  const res = await consumerApi.payOrder(order.value.id)
  if (res.success) {
    alert('支付成功')
    loadOrder()
  }
}

const receiveOrder = async () => {
  const res = await consumerApi.receiveOrder(order.value.id)
  if (res.success) {
    alert('收货成功')
    loadOrder()
  }
}
</script>

<style scoped>
.order-detail-page {
  min-height: 100vh;
  padding-bottom: 80px;
}

.order-content {
  padding: 10px;
}

.status-card {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  margin-bottom: 10px;
}

.status-icon {
  font-size: 48px;
  margin-right: 15px;
}

.status-text {
  font-size: 20px;
  font-weight: bold;
  color: #fff;
}

.info-card, .items-card, .logistics-card, .price-card {
  background: #fff;
  border-radius: 12px;
  padding: 15px;
  margin-bottom: 10px;
}

.info-card h3, .items-card h3, .logistics-card h3, .price-card h3 {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 15px;
}

.address-info {
  display: flex;
  flex-direction: column;
}

.address-name, .address-phone {
  font-size: 14px;
  color: #333;
}

.address-detail {
  font-size: 14px;
  color: #666;
  margin-top: 8px;
}

.order-item {
  display: flex;
  margin-bottom: 15px;
}

.order-item:last-child {
  margin-bottom: 0;
}

.item-img {
  width: 80px;
  height: 80px;
  border-radius: 8px;
  object-fit: cover;
}

.item-info {
  flex: 1;
  margin-left: 12px;
  display: flex;
  flex-direction: column;
}

.item-name {
  font-size: 14px;
  color: #333;
}

.item-spec {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.item-bottom {
  display: flex;
  justify-content: space-between;
  margin-top: auto;
}

.item-price {
  font-size: 14px;
  font-weight: bold;
  color: #f44336;
}

.item-quantity {
  font-size: 14px;
  color: #666;
}

.logistics-info {
  font-size: 14px;
  color: #666;
}

.logistics-empty {
  font-size: 14px;
  color: #999;
}

.price-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  font-size: 14px;
}

.price-row.total {
  font-weight: bold;
  font-size: 16px;
  color: #f44336;
  margin-top: 15px;
  padding-top: 10px;
  border-top: 1px solid #f0f0f0;
}

.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 10px 15px;
  background: #fff;
  box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
}
</style>