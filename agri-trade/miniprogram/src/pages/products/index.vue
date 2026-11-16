<script setup lang="ts">
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { money, request, tradeApi, type TradeProduct } from '../../api'

const keyword = ref('')
const categoryId = ref<number | string>('')
const categories = ref<{ id: number | string; name: string }[]>([])
const products = ref<TradeProduct[]>([])
const loading = ref(false)
const loadError = ref('')
const hasFilters = computed(() => Boolean(keyword.value.trim() || categoryId.value !== ''))
let loadedOnce = false

onLoad(() => { void loadCategories() })
onShow(() => { if (!loadedOnce) void load() })
onPullDownRefresh(() => { void load().finally(() => uni.stopPullDownRefresh()) })

async function loadCategories() {
  try {
    const data = await request<any[]>('/public/categories')
    categories.value = (Array.isArray(data) ? data : []).map((item: any) => ({ id: item.id, name: item.categoryName || item.name })).filter(item => item.name)
  } catch { categories.value = [] }
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    products.value = await tradeApi.products({ keyword: keyword.value.trim(), categoryId: categoryId.value })
    loadedOnce = true
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '货源加载失败'
  } finally {
    loading.value = false
  }
}

function pickCategory(id: number | string) {
  if (categoryId.value === id) return
  categoryId.value = id
  void load()
}
function detail(id: number) { uni.navigateTo({ url: `/pages/product/detail?id=${id}` }) }
function clearFilters() { keyword.value = ''; categoryId.value = ''; void load() }
</script>

<template>
  <view class="page flush">
    <view class="filter">
      <view class="search-bar">
        <text class="search-icon">⌕</text>
        <input v-model="keyword" placeholder="搜索产品、品类或产地" confirm-type="search" @confirm="load" />
        <button @tap="load">搜索</button>
      </view>
      <scroll-view v-if="categories.length" scroll-x class="chips" :show-scrollbar="false">
        <view class="chip" :class="{ on: categoryId === '' }" @tap="pickCategory('')">全部</view>
        <view v-for="item in categories" :key="item.id" class="chip" :class="{ on: categoryId === item.id }" @tap="pickCategory(item.id)">{{ item.name }}</view>
      </scroll-view>
    </view>

    <view class="pad">
      <view class="result-head">
        <view><text class="result-title">货源列表</text><text class="result-count tiny">{{ loading ? '正在刷新…' : `共 ${products.length} 个货源` }}</text></view>
        <button v-if="hasFilters" class="clear-button" @tap="clearFilters">清除筛选</button>
      </view>
      <view v-if="loading && !products.length" class="loading">正在加载货源…</view>
      <view v-else-if="loadError" class="load-error"><text>{{ loadError }}</text><button class="btn btn-ghost" @tap="load">重新加载货源</button></view>
      <template v-else>
        <view class="grid">
          <view v-for="item in products" :key="item.id" class="product-card" @tap="detail(item.id)">
            <view class="cover"><text>{{ item.productName?.slice(0, 1) || '农' }}</text></view>
            <view class="info">
              <text class="name">{{ item.productName }}</text>
              <text class="tiny ellipsis">{{ item.categoryName || '农产品' }} · {{ item.originCity || item.originProvince || '产地直供' }}</text>
              <text class="tiny ellipsis">{{ item.sellerName || '认证供应商' }}</text>
              <view class="foot"><text class="price">{{ money(item.price ?? item.priceMin) }}</text><text class="tiny">/{{ item.unit }}</text></view>
            </view>
          </view>
        </view>
        <view v-if="!products.length" class="empty">没有找到匹配货源，换个关键词试试</view>
      </template>
    </view>
  </view>
</template>

<style scoped lang="scss">
.filter { position: sticky; top: var(--window-top, 0); z-index: 10; padding: 20rpx 24rpx 16rpx; background: var(--c-bg); }
.filter .chips { margin-top: 16rpx; }
.result-head { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; min-height: 72rpx; margin: 4rpx 4rpx 12rpx; }
.result-title { display: block; font-size: 30rpx; font-weight: 700; }
.result-count { display: block; margin-top: 2rpx; }
.clear-button { display: flex; min-height: 64rpx; align-items: center; padding: 0 20rpx; border-radius: 32rpx; background: var(--c-primary-soft); color: var(--c-primary); font-size: 24rpx; }
.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20rpx; }
.product-card { overflow: hidden; border-radius: 24rpx; background: #fff; }
.cover { display: flex; height: 200rpx; align-items: center; justify-content: center; background: linear-gradient(145deg, #e8f6ee, #d3ecdd); color: var(--c-primary-dark); font-size: 64rpx; font-weight: 700; }
.info { padding: 18rpx 20rpx 22rpx; }
.name { display: -webkit-box; overflow: hidden; margin-bottom: 8rpx; font-size: 28rpx; font-weight: 600; line-height: 1.4; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.info .tiny { display: block; margin-top: 4rpx; }
.foot { display: flex; align-items: baseline; gap: 4rpx; margin-top: 12rpx; }
</style>
