<template>
  <div class="order-confirm-page">
    <van-nav-bar title="确认订单" left-arrow @click-left="$router.back()" />
    <div class="address-card" @click="goAddresses">
      <van-icon name="map-o" size="24" />
      <div class="address-info" v-if="selectedAddress">
        <div class="address-top">
          <span class="address-name">{{ selectedAddress.name }}</span>
          <span class="address-phone">{{ selectedAddress.phone }}</span>
        </div>
        <p class="address-detail">{{ selectedAddress.province }}{{ selectedAddress.city }}{{ selectedAddress.district }}{{ selectedAddress.address }}</p>
      </div>
      <div class="address-empty" v-else>
        <p>请选择收货地址</p>
      </div>
      <van-icon name="arrow-right" size="20" />
    </div>
    <div class="products-card">
      <div class="product-item" v-for="item in cartItems" :key="item.id">
        <img :src="item.image" class="product-img" />
        <div class="product-info">
          <h4 class="product-name">{{ item.name }}</h4>
          <p class="product-spec">{{ item.spec }}</p>
          <div class="product-bottom">
            <span class="price">¥{{ item.price }}</span>
            <span class="quantity">x{{ item.quantity }}</span>
          </div>
        </div>
      </div>
    </div>
    <div class="coupon-card">
      <div class="coupon-left">
        <van-icon name="ticket-o" size="20" />
        <span>优惠券</span>
      </div>
      <div class="coupon-right">
        <span>暂无可用优惠券</span>
        <van-icon name="arrow-right" size="20" />
      </div>
    </div>
    <div class="remark-card">
      <van-field v-model="remark" placeholder="订单备注" />
    </div>
    <div class="price-card">
      <div class="price-row">
        <span>商品总价</span>
        <span>¥{{ totalAmount }}</span>
      </div>
      <div class="price-row">
        <span>运费</span>
        <span>¥{{ freightAmount }}</span>
      </div>
      <div class="price-row">
        <span>优惠</span>
        <span>-¥{{ discountAmount }}</span>
      </div>
      <div class="price-row total">
        <span>实付款</span>
        <span>¥{{ payAmount }}</span>
      </div>
    </div>
    <div class="bottom-bar">
      <div class="total-info">
        <span>合计:</span>
        <span class="total-price">¥{{ payAmount }}</span>
      </div>
      <van-button type="danger" size="large" @click="submitOrder">提交订单</van-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { consumerApi } from '../api'

const router = useRouter()
const userStore = useUserStore()
const cartItems = ref([])
const addresses = ref([])
const selectedAddress = ref(null)
const remark = ref('')

const freightAmount = ref(0)
const discountAmount = ref(0)

const totalAmount = computed(() => {
  return cartItems.value.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0).toFixed(2)
})

const payAmount = computed(() => {
  return (Number(totalAmount.value) + Number(freightAmount.value) - Number(discountAmount.value)).toFixed(2)
})

onMounted(() => {
  if (!userStore.user) {
    router.push('/login')
    return
  }
  loadCart()
  loadAddresses()
})

const loadCart = async () => {
  const res = await consumerApi.getCart(userStore.user.id)
  cartItems.value = res.filter(item => item.selected)
}

const loadAddresses = async () => {
  const res = await consumerApi.getAddresses(userStore.user.id)
  addresses.value = res
  selectedAddress.value = res.find(a => a.isDefault) || res[0] || null
}

const goAddresses = () => {
  router.push('/addresses')
}

const submitOrder = async () => {
  if (!selectedAddress.value) {
    alert('请选择收货地址')
    return
  }
  if (cartItems.value.length === 0) {
    alert('请选择商品')
    return
  }
  const order = {
    consumerId: userStore.user.id,
    addressId: selectedAddress.value.id,
    totalAmount: totalAmount.value,
    discountAmount: discountAmount.value,
    freightAmount: freightAmount.value,
    payAmount: payAmount.value,
    remark: remark.value
  }
  const res = await consumerApi.createOrder(order)
  if (res.success) {
    alert('下单成功')
    router.push('/orders')
  }
}
</script>

<style scoped>
.order-confirm-page {
  min-height: 100vh;
  padding-bottom: 80px;
}

.address-card {
  display: flex;
  align-items: center;
  padding: 15px;
  background: #fff;
  margin: 10px;
  border-radius: 12px;
}

.address-info {
  flex: 1;
  margin-left: 12px;
}

.address-top {
  display: flex;
  gap: 15px;
  margin-bottom: 5px;
}

.address-name {
  font-size: 16px;
  font-weight: bold;
}

.address-phone {
  font-size: 14px;
  color: #666;
}

.address-detail {
  font-size: 14px;
  color: #666;
}

.address-empty {
  flex: 1;
  margin-left: 12px;
}

.address-empty p {
  font-size: 14px;
  color: #999;
}

.products-card {
  background: #fff;
  margin: 10px;
  border-radius: 12px;
  padding: 15px;
}

.product-item {
  display: flex;
  margin-bottom: 15px;
}

.product-item:last-child {
  margin-bottom: 0;
}

.product-img {
  width: 80px;
  height: 80px;
  border-radius: 8px;
  object-fit: cover;
}

.product-info {
  flex: 1;
  margin-left: 12px;
  display: flex;
  flex-direction: column;
}

.product-name {
  font-size: 14px;
  font-weight: bold;
}

.product-spec {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.product-bottom {
  display: flex;
  justify-content: space-between;
  margin-top: auto;
}

.price {
  font-size: 14px;
  font-weight: bold;
  color: #f44336;
}

.quantity {
  font-size: 14px;
  color: #666;
}

.coupon-card, .remark-card, .price-card {
  background: #fff;
  margin: 10px;
  border-radius: 12px;
  padding: 15px;
}

.coupon-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.coupon-left, .coupon-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.price-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.price-row {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
}

.price-row.total {
  font-weight: bold;
  font-size: 16px;
  color: #f44336;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #f0f0f0;
}

.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 15px;
  background: #fff;
  box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
}

.total-info {
  font-size: 16px;
}

.total-price {
  font-size: 20px;
  font-weight: bold;
  color: #f44336;
}
</style>