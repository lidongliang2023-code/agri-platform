<template>
  <div class="search-page">
    <van-search v-model="keyword" placeholder="搜索农产品" @search="handleSearch" show-action>
      <template #action>
        <span class="search-btn" @click="handleSearch">搜索</span>
      </template>
    </van-search>
    <div class="hot-search">
      <h4>热门搜索</h4>
      <div class="hot-tags">
        <span class="hot-tag" v-for="tag in hotTags" :key="tag" @click="keyword = tag; handleSearch()">{{ tag }}</span>
      </div>
    </div>
    <div class="search-result" v-if="showResult">
      <div class="product-list">
        <div class="product-item" v-for="product in products" :key="product.id" @click="goDetail(product.id)">
          <img :src="getFirstImage(product.images)" class="product-img" />
          <div class="product-info">
            <h4 class="product-name">{{ product.name }}</h4>
            <p class="product-desc">{{ product.sellingPoint }}</p>
            <div class="product-price">
              <span class="price">¥{{ product.price }}</span>
              <span class="sales">已售{{ product.sales }}</span>
            </div>
          </div>
        </div>
      </div>
      <van-empty v-if="products.length === 0" description="暂无搜索结果" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { consumerApi } from '../api'

const router = useRouter()
const route = useRoute()
const keyword = ref('')
const products = ref([])
const showResult = ref(false)

const hotTags = ['大米', '茶叶', '水果', '蔬菜', '鸡蛋']

onMounted(() => {
  if (route.query.keyword) {
    keyword.value = route.query.keyword
    handleSearch()
  }
})

const handleSearch = async () => {
  if (!keyword.value.trim()) return
  showResult.value = true
  const res = await consumerApi.getProducts({
    page: 1,
    size: 20,
    keyword: keyword.value
  })
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
</script>

<style scoped>
.search-page {
  min-height: 100vh;
}

.search-btn {
  color: #667eea;
  font-size: 16px;
}

.hot-search {
  padding: 15px;
}

.hot-search h4 {
  font-size: 14px;
  color: #666;
  margin-bottom: 10px;
}

.hot-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.hot-tag {
  padding: 6px 15px;
  background: #f5f5f5;
  border-radius: 15px;
  font-size: 13px;
  color: #666;
}

.search-result {
  padding: 0 10px;
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
}

.product-img {
  width: 120px;
  height: 120px;
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
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-desc {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.product-price {
  margin-top: auto;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.price {
  font-size: 18px;
  font-weight: bold;
  color: #f44336;
}

.sales {
  font-size: 12px;
  color: #999;
}
</style>