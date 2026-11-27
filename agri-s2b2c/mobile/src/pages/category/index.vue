<template>
  <view class="page category-page">
    <view class="browse-head">
    <view class="search-wrap">
      <view class="search-box">
        <text class="search-icon">⌕</text>
        <input v-model="keyword" :focus="searchFocus" @blur="searchFocus = false" confirm-type="search" placeholder="搜索农产品" @confirm="search" />
        <text v-if="keyword" class="ui-action-target clear" @tap="clearSearch">×</text>
      </view>
      <view class="ui-action-target search-button" @tap="search">搜索</view>
    </view>

    <scroll-view class="category-scroller" scroll-x :show-scrollbar="false">
      <view class="category-chips">
        <view
          v-for="item in categories"
          :key="item.id"
          class="category-chip"
          :class="{ active: activeCategory === item.id }"
          @tap="selectCategory(item.id)"
        >
          <text class="chip-icon">{{ item.icon }}</text>
          <text>{{ item.name }}</text>
        </view>
      </view>
    </scroll-view>
    </view>

    <view class="result-head">
      <view>
        <text class="result-kicker">ORIGIN SELECTION</text>
        <text class="result-title">{{ currentName }}</text>
      </view>
      <text class="result-count">共 {{ total }} 件</text>
    </view>

    <view v-if="loading" class="loading">正在加载商品…</view>
    <view v-else-if="loadError && !products.length" class="empty"><text>{{ loadError }}</text><button class="btn" @tap="loadProducts()">重新加载</button></view>
    <view v-else-if="products.length" class="product-list">
      <view v-for="item in products" :key="item.id" class="product-card" @tap="openProduct(item)">
        <image v-if="firstImage(item.images)" class="product-image" :src="firstImage(item.images)" mode="aspectFill" />
        <view v-else class="product-placeholder">丰</view>
        <view class="product-body">
          <text class="product-name">{{ item.name }}</text>
          <text class="product-point">{{ item.sellingPoint }}</text>
          <view class="product-tags">
            <text v-if="item.origin" class="tag tag-green">{{ item.origin }}</text>
            <text class="tag tag-gray">{{ item.spec }}</text>
          </view>
          <view class="product-meta">
            <view>
              <text class="price">{{ money(item.price) }}</text>
              <text v-if="item.originalPrice" class="original">{{ money(item.originalPrice) }}</text>
            </view>
            <text class="sales">已售 {{ item.sales }}</text>
          </view>
        </view>
      </view>
    </view>
    <view v-else class="empty">
      <view class="empty-icon">寻</view>
      <text>没有找到相关商品</text>
      <text class="tiny">换个关键词或分类试试</text>
    </view>
    <view v-if="products.length && !loading" class="list-feedback">
      <text v-if="loadError">{{ loadError }}</text>
      <button v-if="loadError" class="btn load-more" :disabled="loadingMore" @tap="loadProducts(failedAppend)">重新加载商品</button>
      <button v-else-if="products.length < total" class="btn load-more" :disabled="loadingMore" @tap="loadMore">{{ loadingMore ? '加载中…' : loadError ? '重试加载' : '加载更多' }}</button>
      <text v-else>已显示全部 {{ total }} 条</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { mallApi, type Product } from '../../api'
import { firstImage, money, openProduct, toast } from '../../utils'

const categories = ref([{id:0,name:'全部',icon:'全'}])

const searchFocus = ref(false)
const keyword = ref('')
const activeCategory = ref(0)
const products = ref<Product[]>([])
const total = ref(0)
const loading = ref(false)
const loadingMore = ref(false)
const loadError = ref('')
const currentPage = ref(0)
const failedAppend = ref(false)
let requestSeq = 0
const currentName = computed(() => categories.value.find((item) => item.id === activeCategory.value)?.name || '全部商品')
const categoryStorageKey = 's2b2c_pending_category'
const searchStorageKey = 's2b2c_search_keyword'



onShow(() => {
  mallApi.getCategories().then(tree=>{
    const flat: {id:number;name:string;icon:string}[]=[]
    const visit=(nodes: import('../../api').Category[],depth=0)=>{for(const c of nodes){flat.push({id:c.id,name:(depth?'· ':'')+c.name,icon:'丰'});visit(c.children || [],depth+1)}}
    visit(tree);categories.value=[{id:0,name:'全部',icon:'全'},...flat]
  }).catch(e=>{loadError.value=(e as Error).message})
  const pendingCategory = uni.getStorageSync(categoryStorageKey)
  const pendingKeyword = uni.getStorageSync(searchStorageKey)
  let changed = false
  if (pendingCategory !== '' && pendingCategory !== undefined && pendingCategory !== null) {
    keyword.value = ''
    activeCategory.value = Number(pendingCategory)
    uni.removeStorageSync(categoryStorageKey)
    changed = true
  }
  if (pendingKeyword) {
    keyword.value = String(pendingKeyword)
    uni.removeStorageSync(searchStorageKey)
    changed = true
  }
  if (uni.getStorageSync('s2b2c_search_focus')) {
    uni.removeStorageSync('s2b2c_search_focus')
    searchFocus.value = true
  }
  if (changed || !products.value.length) loadProducts()
})

async function loadProducts(append = false) {

  if (append && (loading.value || loadingMore.value || products.value.length >= total.value)) return
  const seq = ++requestSeq
  const nextPage = append ? currentPage.value + 1 : 1
  if (append) loadingMore.value = true
  else { loading.value = true; loadingMore.value = false }
  loadError.value = ''
  try {
    const result = await mallApi.getProducts({ page: nextPage, size: 20, keyword: keyword.value.trim() || undefined, categoryId: activeCategory.value || null, })
    if (seq !== requestSeq) return
    const rows = result.records || []
    products.value = append ? [...products.value, ...rows] : rows
    total.value = Number(result.total || 0)
    currentPage.value = nextPage
  } catch (error) {
    if (seq === requestSeq) { failedAppend.value = append; loadError.value = (error as Error).message }
  } finally {
    if (seq === requestSeq) { loading.value = false; loadingMore.value = false; uni.stopPullDownRefresh() }
  }
}
function loadMore() { return loadProducts(true) }
onReachBottom(loadMore)

function selectCategory(id: number) {
  activeCategory.value = id
  loadProducts()
}

function search() {
  loadProducts()
}

function clearSearch() {
  keyword.value = ''
  loadProducts()
}

onPullDownRefresh(() => loadProducts())
</script>

<style scoped lang="scss">
.category-page {
  padding-bottom: 24rpx;
}

.search-wrap {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 20rpx 22rpx 12rpx;
}

.search-box {
  display: flex;
  height: 76rpx;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 10rpx;
  padding: 0 18rpx;
  border: 1rpx solid #e3eae5;
  border-radius: 18rpx;
  background: #fff;
}

.search-box input {
  flex: 1;
  color: #0b1a12;
  font-size: 24rpx;
}

.search-icon {
  color: #52665a;
  font-size: 32rpx;
}

.clear {
  color: #666666;
  font-size: 32rpx;
}

.search-button {
  color: #12764a;
  font-size: 24rpx;
  font-weight: 700;
}

.category-scroller {
  width: 100%;
  white-space: nowrap;
}

.category-chips {
  display: inline-flex;
  gap: 12rpx;
  padding: 8rpx 22rpx 20rpx;
}

.category-chip {
  display: flex;
  min-width: 120rpx;
  height: 66rpx;
  align-items: center;
  justify-content: center;
  gap: 7rpx;
  padding: 0 20rpx;
  border: 1rpx solid #e3eae5;
  border-radius: 999rpx;
  background: #fff;
  color: #4b5d53;
  font-size: 24rpx;
}

.category-chip.active {
  border-color: #12764a;
  background: #e9f6ee;
  color: #0e5233;
  font-weight: 700;
}

.chip-icon {
  font-size: 24rpx;
}

.result-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 15rpx 24rpx 18rpx;
}

.result-kicker,
.result-title {
  display: block;
}

.result-kicker {
  color: #12764a;
  font-size: 24rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
}

.result-title {
  margin-top: 5rpx;
  color: #0b1a12;
  font-size: 34rpx;
  font-weight: 800;
}

.result-count {
  color: #666666;
  font-size: 24rpx;
}

.loading {
  padding: 100rpx 0;
  color: #666666;
  font-size: 24rpx;
  text-align: center;
}

.product-list {
  padding: 0 22rpx;
}

.product-card {
  display: flex;
  min-height: 234rpx;
  margin-bottom: 16rpx;
  overflow: hidden;
  border: 1rpx solid #e3eae5;
  border-radius: 22rpx;
  background: #fff;
}

.product-image,
.product-placeholder {
  width: 220rpx;
  min-width: 220rpx;
  min-height: 234rpx;
}

.product-image {
  background: #eef7f1;
}

.product-placeholder {
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #f2fbf6, #e1f0e7);
  color: rgba(18, 118, 74, 0.12);
  font-size: 70rpx;
  font-weight: 800;
}

.product-body {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  padding: 20rpx;
}

.product-name {
  color: #0b1a12;
  font-size: 27rpx;
  font-weight: 700;
}

.product-point {
  margin-top: 8rpx;
  color: #666666;
  font-size: 24rpx;
}

.product-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 7rpx;
  margin-top: 12rpx;
}

.product-meta {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-top: auto;
  padding-top: 16rpx;
}

.price {
  font-size: 32rpx;
}

.original {
  margin-left: 9rpx;
  color: #666666;
  font-size: 24rpx;
  text-decoration: line-through;
}

.sales {
  color: #666666;
  font-size: 24rpx;
}
.browse-head { position:sticky;top:var(--window-top,0px);z-index:12;background:#f5f6fa; }.search-box { min-height:48px; }.product-meta { flex-wrap:wrap;gap:12rpx; }.product-name { white-space:normal;line-height:1.5; }
</style>
