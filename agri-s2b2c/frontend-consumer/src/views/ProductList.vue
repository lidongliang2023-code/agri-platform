<template>
  <div class="m-container" v-loading="loading">
    <!-- 顶部：分类标题 + 跨模块入口 -->
    <div class="m-page-hd lead">
      <h1>{{ categoryName }}</h1>
      <span class="sub">{{ subTitle }}</span>
      <div class="hd-actions">
        <button type="button" class="m-btn sm" @click="router.push('/category')">‹ 返回分类</button>
        <a class="m-btn sm" :href="crossModule.masterData" target="_blank" rel="noopener">货源主数据 ›</a>
      </div>
    </div>

    <!-- 筛选区 -->
    <div class="m-card m-card-pad filter">
      <div class="m-row-wrap">
        <el-input
          v-model="keyword"
          class="kw"
          placeholder="输入商品名称 / 关键词后回车"
          clearable
          @keyup.enter="applySearch"
        />
        <button type="button" class="m-btn" @click="applySearch">搜索</button>
        <span class="m-spacer" />
        <span class="muted small">共 <b class="num">{{ total }}</b> 件</span>
      </div>

      <div class="m-row-wrap filter-line">
        <span class="muted small">排序</span>
        <button
          v-for="item in SORTS"
          :key="item.value || 'default'"
          type="button"
          class="m-btn sm"
          :class="{ primary: sort === item.value }"
          @click="changeSort(item.value)"
        >
          {{ item.label }}
        </button>

        <span class="gap" />

        <span class="muted small">价格区间</span>
        <el-input-number
          v-model="priceMin"
          class="price-input"
          :min="0"
          :controls="false"
          placeholder="最低价"
        />
        <span class="muted">—</span>
        <el-input-number
          v-model="priceMax"
          class="price-input"
          :min="0"
          :controls="false"
          placeholder="最高价"
        />
        <button type="button" class="m-btn sm ghost" @click="applyPrice">应用</button>
        <span class="muted small">排序与价格区间随请求提交，结果以接口返回为准</span>
      </div>
    </div>

    <!-- 结果 -->
    <div v-if="products.length" class="m-grid m-grid-4 list">
      <ProductCard
        v-for="p in products"
        :key="p.id"
        :product="p"
        :favorited="favorites.has(p.id)"
        @favorite="favorites.toggle(p.id)"
        @add="addToCart(p)"
      />
    </div>

    <EmptyBlock
      v-else-if="!loading"
      icon="🌾"
      title="没有符合条件的商品"
      desc="当前分类或关键词下没有在架商品。商品由供应商上架、平台审核通过后进入列表，可清空筛选或换个分类看看。"
    >
      <template #actions>
        <div class="m-row-wrap empty-actions">
          <button type="button" class="m-btn ghost" @click="router.push('/category')">换个分类</button>
          <button type="button" class="m-btn" @click="resetAll">清空筛选</button>
        </div>
      </template>
    </EmptyBlock>

    <el-pagination
      v-if="total > size"
      class="pager"
      background
      layout="prev, pager, next, jumper, total"
      :total="total"
      :page-size="size"
      :current-page="page"
      @current-change="changePage"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { consumerApi } from '../api'
import { useUserStore } from '../stores/user'
import { useFavorites } from '../composables/useFavorites'
import { crossModule } from '../config/cross-module'
import ProductCard from '../components/ProductCard.vue'
import EmptyBlock from '../components/EmptyBlock.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const favorites = useFavorites()

const SORTS = [
  { label: '综合', value: '' },
  { label: '销量', value: 'sales' },
  { label: '价格升', value: 'priceAsc' },
  { label: '价格降', value: 'priceDesc' },
]

const size = 12
const loading = ref(false)
const keyword = ref('')
const sort = ref('')
const priceMin = ref(null)
const priceMax = ref(null)
const minPrice = ref(null)
const maxPrice = ref(null)
const products = ref([])
const total = ref(0)
const page = ref(1)

const categoryId = computed(() => {
  const raw = route.query.categoryId
  return raw === undefined || raw === '' ? '' : String(raw)
})

/** 从分类树里递归找分类名，找不到就按「全部商品」处理。 */
function findCategoryName(nodes, id) {
  for (const node of nodes || []) {
    if (String(node.id) === id) return node.name
    const hit = findCategoryName(node.children, id)
    if (hit) return hit
  }
  return ''
}

const categoryName = computed(() => {
  if (!categoryId.value) return '全部商品'
  return findCategoryName(userStore.categories, categoryId.value) || '全部商品'
})

const subTitle = computed(() => {
  const scope = categoryId.value ? '该分类下的在架商品' : '全部在架商品'
  return `${scope} · 第 ${page.value} 页`
})

function toNumber(value) {
  if (value === undefined || value === null || value === '') return null
  const num = Number(value)
  return Number.isNaN(num) ? null : num
}

function readQuery() {
  const query = route.query
  keyword.value = String(query.q || '')
  page.value = Math.max(1, Number(query.page) || 1)
  minPrice.value = toNumber(query.minPrice)
  maxPrice.value = toNumber(query.maxPrice)
  priceMin.value = minPrice.value
  priceMax.value = maxPrice.value
}

/** 把当前筛选条件写回 URL（page 只在 >1 时保留）。 */
function syncQuery() {
  const query = { ...route.query }
  const q = keyword.value.trim()
  if (q) query.q = q
  else delete query.q
  if (page.value > 1) query.page = String(page.value)
  else delete query.page
  if (minPrice.value != null) query.minPrice = String(minPrice.value)
  else delete query.minPrice
  if (maxPrice.value != null) query.maxPrice = String(maxPrice.value)
  else delete query.maxPrice
  router.replace({ path: '/products', query })
}

async function load() {
  loading.value = true
  try {
    const params = { page: page.value, size }
    if (categoryId.value) params.categoryId = categoryId.value
    const q = keyword.value.trim()
    if (q) params.keyword = q
    if (sort.value) params.sort = sort.value
    if (minPrice.value != null) params.minPrice = minPrice.value
    if (maxPrice.value != null) params.maxPrice = maxPrice.value

    const res = await consumerApi.getProducts(params)
    products.value = res?.records || []
    total.value = Number(res?.total || 0)
  } catch (err) {
    products.value = []
    total.value = 0
    ElMessage.error(err.friendlyMessage || '商品列表加载失败')
  } finally {
    loading.value = false
  }
}

function applySearch() {
  page.value = 1
  syncQuery()
  load()
}

function changeSort(value) {
  sort.value = value
  page.value = 1
  syncQuery()
  load()
}

function applyPrice() {
  const min = priceMin.value == null ? null : Number(priceMin.value)
  const max = priceMax.value == null ? null : Number(priceMax.value)
  if (min != null && max != null && min > max) {
    ElMessage.warning('最低价不能高于最高价')
    return
  }
  minPrice.value = min
  maxPrice.value = max
  page.value = 1
  syncQuery()
  load()
}

function resetAll() {
  keyword.value = ''
  sort.value = ''
  priceMin.value = null
  priceMax.value = null
  minPrice.value = null
  maxPrice.value = null
  page.value = 1
  syncQuery()
  load()
}

function changePage(next) {
  page.value = next
  syncQuery()
  load()
}

async function addToCart(product) {
  if (!userStore.consumerId) {
    ElMessage.warning('请先完成登录')
    return
  }
  try {
    const res = await consumerApi.addCart({
      consumerId: userStore.consumerId,
      productId: product.id,
      quantity: 1,
    })
    if (res?.success === false) {
      ElMessage.warning(res.message || '加入购物车失败')
      return
    }
    await userStore.refreshCart()
    ElMessage.success('已加入购物车')
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '加入购物车失败')
  }
}

// 从顶栏分类下拉等处跳进来时，categoryId 会变，需要重新取数
watch(
  () => route.query.categoryId,
  (next, prev) => {
    if (next === prev) return
    readQuery()
    load()
  },
)

// 浏览器前进/后退改了关键词时同步输入框并重新取数（自己写入的 q 不会触发重复请求）
watch(
  () => route.query.q,
  (next) => {
    const value = String(next || '')
    if (value === keyword.value.trim()) return
    readQuery()
    load()
  },
)

onMounted(async () => {
  readQuery()
  await userStore.loadCategories()
  await favorites.load()
  load()
})
</script>

<style scoped>
.m-container {
  width: min(1280px, calc(100% - 48px));
  margin: 0 auto;
}

.lead {
  margin-top: 18px;
}

.filter {
  display: grid;
  gap: 12px;
}

.kw {
  width: 320px;
}

.filter-line {
  padding-top: 12px;
  border-top: 1px dashed #eef3ef;
}

.gap {
  width: 8px;
}

.price-input {
  width: 110px;
}

.list {
  margin-top: 16px;
}

.pager {
  margin-top: 18px;
}

@media (max-width: 960px) {
  .kw { width: 100%; }
}
</style>
