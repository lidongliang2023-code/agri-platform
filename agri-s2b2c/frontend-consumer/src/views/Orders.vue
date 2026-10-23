<template>
  <div class="orders-page">
    <van-tabs v-model="activeTab" @change="loadOrders">
      <van-tab title="全部">全部</van-tab>
      <van-tab title="待付款">待付款</van-tab>
      <van-tab title="待发货">待发货</van-tab>
      <van-tab title="待收货">待收货</van-tab>
      <van-tab title="已完成">已完成</van-tab>
    </van-tabs>
    <div class="order-list">
      <div class="order-card" v-for="order in orders" :key="order.id" @click="goDetail(order.id)">
        <div class="order-header">
          <span class="order-no">订单号: {{ order.orderNo }}</span>
          <span class="order-status" :class="order.status">{{ order.statusText }}</span>
        </div>
        <div class="order-items">
          <div class="order-item" v-for="item in order.items" :key="item.id">
            <img :src="item.image" class="item-img" />
            <div class="item-info">
              <h4 class="item-name">{{ item.name }}</h4>
              <p class="item-spec">{{ item.spec }}</p>
              <p class="item-price">¥{{ item.price }} x {{ item.quantity }}</p>
            </div>
          </div>
        </div>
        <div class="order-footer">
          <span class="order-total">合计: <span class="total-price">¥{{ order.payAmount }}</span></span>
          <div class="order-actions">
            <van-button v-if="order.status === 'PENDING_PAY'" type="primary" @click.stop="payOrder(order.id)">支付</van-button>
            <van-button v-if="order.status === 'SHIPPED'" type="primary" @click.stop="receiveOrder(order.id)">确认收货</van-button>
          </div>
        </div>
      </div>
    </div>
    <van-empty v-if="orders.length === 0" description="暂无订单" />
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { consumerApi } from '../api'

const router = useRouter()
const userStore = useUserStore()
const activeTab = ref(0)
const orders = ref([])

const statusMap = ['', 'PENDING_PAY', 'PENDING_SHIP', 'SHIPPED', 'COMPLETED']

onMounted(() => {
  loadOrders()
})

const loadOrders = async () => {
  if (!userStore.user) {
    router.push('/login')
    return
  }
  const status = statusMap[activeTab.value]
  const res = await consumerApi.getOrders({
    consumerId: userStore.user.id,
    page: 1,
    size: 20,
    status
  })
  orders.value = res.records || []
}

const goDetail = (id) => {
  router.push(`/order-detail/${id}`)
}

const payOrder = async (id) => {
  const res = await consumerApi.payOrder(id)
  if (res.success) {
    alert('支付成功')
    loadOrders()
  }
}

const receiveOrder = async (id) => {
  const res = await consumerApi.receiveOrder(id)
  if (res.success) {
    alert('收货成功')
    loadOrders()
  }
}

watch(userStore.user, () => {
  loadOrders()
})
</script>

<style scoped>
.orders-page {
  min-height: 100vh;
}

.order-list {
  padding: 10px;
}

.order-card {
  background: #fff;
  border-radius: 12px;
  padding: 15px;
  margin-bottom: 10px;
}

.order-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 15px;
}

.order-no {
  font-size: 13px;
  color: #999;
}

.order-status {
  font-size: 14px;
  font-weight: bold;
}

.order-status.PENDING_PAY {
  color: #f44336;
}

.order-status.PENDING_SHIP {
  color: #ff9800;
}

.order-status.SHIPPED {
  color: #2196f3;
}

.order-status.COMPLETED {
  color: #4caf50;
}

.order-items {
  margin-bottom: 15px;
}

.order-item {
  display: flex;
  margin-bottom: 10px;
}

.order-item:last-child {
  margin-bottom: 0;
}

.item-img {
  width: 60px;
  height: 60px;
  border-radius: 8px;
  object-fit: cover;
}

.item-info {
  flex: 1;
  margin-left: 12px;
}

.item-name {
  font-size: 14px;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-spec {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.item-price {
  font-size: 14px;
  color: #333;
  margin-top: 4px;
}

.order-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
  border-top: 1px solid #f0f0f0;
}

.order-total {
  font-size: 14px;
}

.total-price {
  font-size: 16px;
  font-weight: bold;
  color: #f44336;
}

.order-actions {
  display: flex;
  gap: 10px;
}
</style>