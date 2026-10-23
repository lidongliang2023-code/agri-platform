<template>
  <div class="category-page">
    <van-search v-model="keyword" placeholder="搜索农产品" @search="handleSearch" />
    <div class="category-content">
      <div class="left-menu">
        <div 
          class="menu-item" 
          :class="{ active: activeCategory === cat.id }"
          v-for="cat in leftCategories" 
          :key="cat.id"
          @click="selectCategory(cat.id)"
        >
          {{ cat.name }}
        </div>
      </div>
      <div class="right-content">
        <div class="sub-category" v-if="subCategories.length > 0">
          <div 
            class="sub-item" 
            v-for="sub in subCategories" 
            :key="sub.id"
            @click="selectSubCategory(sub.id)"
          >
            <span>{{ sub.name }}</span>
          </div>
        </div>
        <div class="product-grid">
          <div class="product-card" v-for="product in products" :key="product.id" @click="goDetail(product.id)">
            <img :src="getFirstImage(product.images)" class="product-img" />
            <h4 class="product-name">{{ product.name }}</h4>
            <p class="price">¥{{ product.price }}</p>
          </div>
        </div>
        <van-empty v-if="products.length === 0" description="暂无商品" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { consumerApi } from '../api'

const router = useRouter()
const route = useRoute()
const keyword = ref('')
const activeCategory = ref(1)
const selectedSubCategory = ref(null)
const products = ref([])

const leftCategories = ref([
  { id: 1, name: '粮油调味' },
  { id: 2, name: '新鲜果蔬' },
  { id: 3, name: '肉禽蛋奶' },
  { id: 4, name: '茶叶茶饮' },
  { id: 5, name: '滋补养生' },
  { id: 6, name: '地方特产' }
])

const subCategoryMap = {
  1: [{ id: 7, name: '大米' }, { id: 8, name: '面粉' }, { id: 9, name: '食用油' }, { id: 10, name: '调味品' }],
  2: [{ id: 11, name: '时令蔬菜' }, { id: 12, name: '新鲜水果' }, { id: 13, name: '有机蔬菜' }],
  3: [{ id: 14, name: '猪肉' }, { id: 15, name: '牛羊肉' }, { id: 16, name: '鲜蛋' }],
  4: [{ id: 17, name: '绿茶' }, { id: 18, name: '红茶' }, { id: 19, name: '普洱茶' }],
  5: [],
  6: []
}

const subCategories = ref(subCategoryMap[1] || [])

onMounted(() => {
  if (route.query.id) {
    activeCategory.value = parseInt(route.query.id)
  }
  loadProducts()
})

watch(activeCategory, () => {
  selectedSubCategory.value = null
  subCategories.value = subCategoryMap[activeCategory.value] || []
  loadProducts()
})

watch(selectedSubCategory, () => {
  loadProducts()
})

const selectCategory = (id) => {
  activeCategory.value = id
}

const selectSubCategory = (id) => {
  selectedSubCategory.value = selectedSubCategory.value === id ? null : id
}

const loadProducts = async () => {
  const params = { page: 1, size: 20, categoryId: selectedSubCategory.value || activeCategory.value }
  const res = await consumerApi.getProducts(params)
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

const handleSearch = () => {
  router.push(`/search?keyword=${keyword.value}`)
}
</script>

<style scoped>
.category-page {
  height: calc(100vh - 50px);
  display: flex;
  flex-direction: column;
}

.category-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.left-menu {
  width: 80px;
  background: #f5f5f5;
  overflow-y: auto;
}

.menu-item {
  padding: 15px 10px;
  text-align: center;
  font-size: 13px;
  color: #666;
  border-left: 3px solid transparent;
}

.menu-item.active {
  background: #fff;
  color: #667eea;
  border-left-color: #667eea;
  font-weight: bold;
}

.right-content {
  flex: 1;
  background: #fff;
  overflow-y: auto;
  padding: 10px;
}

.sub-category {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 15px;
}

.sub-item {
  padding: 5px 12px;
  background: #f5f5f5;
  border-radius: 15px;
  font-size: 12px;
}

.sub-item.active {
  background: #667eea;
  color: #fff;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.product-card {
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0,0,0,0.03);
}

.product-img {
  width: 100%;
  height: 120px;
  object-fit: cover;
}

.product-name {
  font-size: 13px;
  padding: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.price {
  font-size: 16px;
  font-weight: bold;
  color: #f44336;
  padding: 0 8px 8px;
}
</style>