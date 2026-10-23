<template>
  <div class="cart-page">
    <van-search v-model="keyword" placeholder="搜索商品" />
    <div v-if="carts.length > 0" class="cart-list">
      <div class="cart-item" v-for="item in carts" :key="item.id">
        <van-checkbox v-model="item.selected" />
        <img :src="item.image" class="product-img" @click="goDetail(item.productId)" />
        <div class="product-info">
          <h4 class="product-name">{{ item.name }}</h4>
          <p class="product-spec">{{ item.spec }}</p>
          <div class="product-bottom">
            <span class="price">¥{{ item.price }}</span>
            <van-stepper v-model="item.quantity" :min="1" :max="item.stock" @change="updateCart(item)" />
          </div>
        </div>
        <van-icon name="delete" class="delete-btn" @click="deleteCart(item.id)" />
      </div>
    </div>
    <van-empty v-else description="购物车是空的" />
    <div class="bottom-bar" v-if="carts.length > 0">
      <van-checkbox v-model="selectAll" @change="toggleSelectAll" />
      <span>全选</span>
      <div class="total-info">
        <span class="total-label">合计:</span>
        <span class="total-price">¥{{ totalPrice }}</span>
      </div>
      <van-button type="danger" @click="checkout">结算({{ selectedCount }})</van-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { consumerApi } from '../api'

const router = useRouter()
const userStore = useUserStore()
const keyword = ref('')
const carts = ref([])
const selectAll = ref(false)

onMounted(() => {
  loadCart()
})

const loadCart = async () => {
  if (!userStore.user) {
    router.push('/login')
    return
  }
  const res = await consumerApi.getCart(userStore.user.id)
  carts.value = res.map(item => ({ ...item, selected: true }))
  updateSelectAll()
}

const updateSelectAll = () => {
  selectAll.value = carts.value.length > 0 && carts.value.every(item => item.selected)
}

const toggleSelectAll = () => {
  carts.value.forEach(item => {
    item.selected = selectAll.value
  })
}

const totalPrice = computed(() => {
  return carts.value
    .filter(item => item.selected)
    .reduce((sum, item) => sum + Number(item.price) * item.quantity, 0)
    .toFixed(2)
})

const selectedCount = computed(() => {
  return carts.value.filter(item => item.selected).reduce((sum, item) => sum + item.quantity, 0)
})

const updateCart = async (item) => {
  await consumerApi.updateCart({ id: item.id, quantity: item.quantity })
}

const deleteCart = async (id) => {
  await consumerApi.deleteCart(id)
  loadCart()
}

const goDetail = (id) => {
  router.push(`/product/${id}`)
}

const checkout = () => {
  router.push('/order-confirm')
}

watch(userStore.user, () => {
  loadCart()
})
</script>

<style scoped>
.cart-page {
  min-height: 100vh;
  padding-bottom: 80px;
}

.cart-list {
  padding: 10px;
}

.cart-item {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 10px;
}

.product-img {
  width: 80px;
  height: 80px;
  border-radius: 8px;
  object-fit: cover;
  margin: 0 12px;
}

.product-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.product-name {
  font-size: 14px;
  font-weight: bold;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-spec {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.product-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
}

.price {
  font-size: 16px;
  font-weight: bold;
  color: #f44336;
}

.delete-btn {
  color: #999;
  margin-left: 10px;
}

.bottom-bar {
  position: fixed;
  bottom: 50px;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  padding: 10px 15px;
  background: #fff;
  box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
  gap: 10px;
}

.total-info {
  flex: 1;
  text-align: right;
}

.total-label {
  font-size: 14px;
  color: #666;
}

.total-price {
  font-size: 18px;
  font-weight: bold;
  color: #f44336;
}
</style>