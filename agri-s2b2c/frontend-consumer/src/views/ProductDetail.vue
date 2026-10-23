<template>
  <div class="product-detail-page">
    <van-swipe :autoplay="3000" indicator-color="white" indicator-active-color="#667eea">
      <van-swipe-item v-for="(img, index) in images" :key="index">
        <img :src="img" class="product-img" />
      </van-swipe-item>
    </van-swipe>
    <div class="product-info">
      <h1 class="product-name">{{ product.name }}</h1>
      <p class="selling-point">{{ product.sellingPoint }}</p>
      <div class="price-row">
        <span class="price">¥{{ product.price }}</span>
        <span class="original-price" v-if="product.originalPrice">¥{{ product.originalPrice }}</span>
      </div>
      <van-tag type="primary" size="small" v-for="cert in certifications" :key="cert">{{ cert }}</van-tag>
    </div>
    <van-divider />
    <div class="product-detail">
      <h3>商品详情</h3>
      <div class="detail-info">
        <div class="info-row">
          <span class="label">产地</span>
          <span class="value">{{ product.origin }}</span>
        </div>
        <div class="info-row">
          <span class="label">规格</span>
          <span class="value">{{ product.spec }}</span>
        </div>
        <div class="info-row">
          <span class="label">等级</span>
          <span class="value">{{ product.grade }}</span>
        </div>
        <div class="info-row">
          <span class="label">库存</span>
          <span class="value">{{ product.stock }}件</span>
        </div>
      </div>
    </div>
    <van-divider />
    <div class="trace-section">
      <h3>🌱 溯源信息</h3>
      <p>扫码即可查看完整溯源记录，包括种植、加工、质检等全流程信息</p>
    </div>
    <div class="bottom-bar">
      <div class="action-btn" @click="goCart">
        <van-icon name="cart-o" size="24" />
        <span>购物车</span>
      </div>
      <van-button type="primary" size="large" @click="addToCart">加入购物车</van-button>
      <van-button type="danger" size="large" @click="buyNow">立即购买</van-button>
    </div>
    <van-popup v-model="showSpec" position="bottom">
      <div class="spec-panel">
        <img :src="images[0]" class="spec-img" />
        <div class="spec-info">
          <p class="spec-price">¥{{ product.price }}</p>
          <p>库存 {{ product.stock }} 件</p>
        </div>
        <van-stepper v-model="quantity" :min="1" :max="product.stock" />
        <van-button type="primary" block @click="confirmSpec">确定</van-button>
      </div>
    </van-popup>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { consumerApi } from '../api'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const product = ref({})
const images = ref([])
const certifications = ref([])
const showSpec = ref(false)
const quantity = ref(1)

onMounted(() => {
  loadProduct()
})

const loadProduct = async () => {
  const res = await consumerApi.getProductDetail(route.params.id)
  product.value = res
  images.value = res.images || []
  certifications.value = res.certifications ? res.certifications.split('、') : []
}

const addToCart = async () => {
  if (!userStore.user) {
    router.push('/login')
    return
  }
  showSpec.value = true
}

const confirmSpec = async () => {
  const res = await consumerApi.addCart({
    consumerId: userStore.user.id,
    productId: product.value.id,
    quantity: quantity.value
  })
  if (res.success) {
    alert('加入购物车成功')
    showSpec.value = false
  }
}

const buyNow = () => {
  if (!userStore.user) {
    router.push('/login')
    return
  }
  showSpec.value = true
}

const goCart = () => {
  router.push('/cart')
}
</script>

<style scoped>
.product-detail-page {
  min-height: 100vh;
  padding-bottom: 80px;
}

.product-img {
  width: 100%;
  height: 300px;
  object-fit: cover;
}

.product-info {
  padding: 15px;
  background: #fff;
}

.product-name {
  font-size: 18px;
  font-weight: bold;
  color: #333;
  margin-bottom: 8px;
}

.selling-point {
  font-size: 14px;
  color: #666;
  margin-bottom: 12px;
}

.price-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.price {
  font-size: 28px;
  font-weight: bold;
  color: #f44336;
}

.original-price {
  font-size: 14px;
  color: #999;
  text-decoration: line-through;
}

.product-detail {
  padding: 15px;
  background: #fff;
}

.product-detail h3 {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 15px;
}

.detail-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-row {
  display: flex;
  justify-content: space-between;
}

.label {
  font-size: 14px;
  color: #999;
}

.value {
  font-size: 14px;
  color: #333;
}

.trace-section {
  padding: 15px;
  background: #fff;
}

.trace-section h3 {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 8px;
}

.trace-section p {
  font-size: 14px;
  color: #666;
}

.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  padding: 8px 15px;
  background: #fff;
  box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
  gap: 10px;
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 12px;
  color: #666;
}

.spec-panel {
  padding: 20px;
}

.spec-img {
  width: 100px;
  height: 100px;
  border-radius: 8px;
  margin-bottom: 15px;
}

.spec-info {
  margin-bottom: 15px;
}

.spec-price {
  font-size: 24px;
  font-weight: bold;
  color: #f44336;
}
</style>