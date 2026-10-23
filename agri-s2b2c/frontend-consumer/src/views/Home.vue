<template>
  <div class="home-page">
    <van-search v-model="keyword" placeholder="搜索农产品" @search="handleSearch" />
    <van-swipe :autoplay="3000" indicator-color="white" indicator-active-color="#667eea">
      <van-swipe-item v-for="banner in banners" :key="banner.id">
        <img :src="banner.image" class="banner-img" />
      </van-swipe-item>
    </van-swipe>
    <div class="category-grid">
      <div class="category-item" v-for="cat in categories" :key="cat.id" @click="goCategory(cat.id)">
        <span class="category-icon">{{ cat.icon }}</span>
        <span class="category-name">{{ cat.name }}</span>
      </div>
    </div>
    <van-divider />
    <div class="section">
      <h3 class="section-title">🔥 热销推荐</h3>
      <div class="product-list">
        <div class="product-item" v-for="product in products" :key="product.id" @click="goDetail(product.id)">
          <img :src="getFirstImage(product.images)" class="product-img" />
          <div class="product-info">
            <h4 class="product-name">{{ product.name }}</h4>
            <p class="product-desc">{{ product.sellingPoint }}</p>
            <div class="product-price">
              <span class="price">¥{{ product.price }}</span>
              <span class="original-price" v-if="product.originalPrice">¥{{ product.originalPrice }}</span>
              <span class="sales">已售{{ product.sales }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { consumerApi } from '../api'

const router = useRouter()
const keyword = ref('')
const products = ref([])
const categories = ref([
  { id: 1, name: '粮油调味', icon: '🍚' },
  { id: 2, name: '新鲜果蔬', icon: '🥬' },
  { id: 3, name: '肉禽蛋奶', icon: '🥩' },
  { id: 4, name: '茶叶茶饮', icon: '🍵' },
  { id: 5, name: '滋补养生', icon: '🍯' },
  { id: 6, name: '地方特产', icon: '🎁' }
])
const banners = ref([
  { id: 1, image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=fresh%20organic%20agricultural%20products%20banner%20green%20nature&image_size=landscape_16_9' },
  { id: 2, image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=premium%20rice%20grains%20farm%20harvest%20banner&image_size=landscape_16_9' },
  { id: 3, image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=tea%20ceremony%20premium%20chinese%20tea%20banner&image_size=landscape_16_9' }
])

onMounted(() => {
  loadProducts()
})

const loadProducts = async () => {
  const res = await consumerApi.getProducts({ page: 1, size: 10 })
  products.value = res.records || []
}

const getFirstImage = (images) => {
  if (images && Array.isArray(images) && images.length > 0) {
    return images[0]
  }
  return 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=agricultural%20product%20placeholder&image_size=square'
}

const goDetail = (id) => {
  router.push(`/product/${id}`)
}

const goCategory = (id) => {
  router.push(`/category?id=${id}`)
}

const handleSearch = () => {
  router.push(`/search?keyword=${keyword.value}`)
}
</script>

<style scoped>
.home-page {
  padding: 10px;
}

.banner-img {
  width: 100%;
  height: 180px;
  object-fit: cover;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 10px;
  padding: 15px 0;
}

.category-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.category-icon {
  font-size: 32px;
  margin-bottom: 5px;
}

.category-name {
  font-size: 12px;
  color: #333;
}

.section {
  padding: 10px 0;
}

.section-title {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 10px;
  color: #333;
}

.product-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.product-item {
  display: flex;
  background: #fff;
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.product-img {
  width: 120px;
  height: 120px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
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
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-desc {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-price {
  margin-top: auto;
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.price {
  font-size: 18px;
  font-weight: bold;
  color: #f44336;
}

.original-price {
  font-size: 12px;
  color: #999;
  text-decoration: line-through;
}

.sales {
  font-size: 12px;
  color: #999;
  margin-left: auto;
}
</style>