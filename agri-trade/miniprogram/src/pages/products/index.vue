<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { money, tradeApi, type TradeProduct } from '../../api'

const keyword = ref('')
const products = ref<TradeProduct[]>([])
const loading = ref(false)

onShow(() => void load())

async function load() {
  loading.value = true
  try {
    products.value = await tradeApi.products({ keyword: keyword.value })
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function detail(id: number) {
  uni.navigateTo({ url: `/pages/product/detail?id=${id}` })
}
</script>

<template>
  <view class="page pad">
    <view class="search">
      <input v-model="keyword" placeholder="搜索产品、品类或产地" confirm-type="search" @confirm="load" />
      <button @tap="load">搜索</button>
    </view>
    <view v-if="loading" class="loading">正在加载货源…</view>
    <view v-else class="grid">
      <view class="product-card" v-for="item in products" :key="item.id" @tap="detail(item.id)">
        <view class="glyph">{{ item.productName?.slice(0, 1) || '农' }}</view>
        <text class="name">{{ item.productName }}</text>
        <text class="tiny">{{ item.sellerName || '认证供应商' }}</text>
        <text class="muted">{{ item.categoryName || '农产品' }} · {{ item.originCity || '产地直供' }}</text>
        <view class="foot"><text class="price">{{ money(item.price) }}</text><text class="tiny">/{{ item.unit }}</text></view>
      </view>
    </view>
    <view v-if="!loading && !products.length" class="empty">没有找到匹配货源</view>
  </view>
</template>

<style scoped lang="scss">
.search { display: flex; gap: 12rpx; margin-bottom: 20rpx; }
.search input { flex: 1; height: 78rpx; padding: 0 20rpx; border: 1rpx solid #dfe8e2; border-radius: 16rpx; background: #fff; font-size: 24rpx; }
.search button { width: 116rpx; border-radius: 16rpx; background: #12764a; color: #fff; font-size: 24rpx; font-weight: 650; }
.grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 16rpx; }
.product-card { padding: 18rpx; border: 1rpx solid #e1e9e3; border-radius: 20rpx; background: #fff; }
.glyph { display: grid; width: 88rpx; height: 88rpx; place-items: center; border-radius: 22rpx; background: #e5f5eb; color: #0e5233; font-size: 34rpx; font-weight: 750; }
.name,.product-card > text { display: block; }
.name { margin-top: 14rpx; font-size: 24rpx; font-weight: 680; }
.product-card > .tiny { margin-top: 5rpx; }
.product-card > .muted { margin-top: 8rpx; font-size: 24rpx; }
.foot { display: flex; align-items: flex-end; gap: 3rpx; margin-top: 12rpx; }
</style>
