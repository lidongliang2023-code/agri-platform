<template>
  <view class="page products-page">
    <view class="hero"><text class="hero-kicker">MY STORE SHELF</text><text class="hero-title">我的货架</text><text class="hero-desc">已选商品与销售状态统一查看</text></view>
    <view v-if="loading" class="loading">正在加载货架商品…</view>
    <view v-else-if="products.length" class="product-list">
      <view v-for="item in products" :key="item.id" class="product-card">
        <image v-if="firstImage(item.images)" class="product-image" :src="firstImage(item.images)" mode="aspectFill" />
        <view v-else class="product-image product-placeholder">丰</view>
        <view class="product-body"><text class="product-name">{{ item.name }}</text><text class="product-point">{{ item.sellingPoint }}</text><view class="tags"><text class="tag tag-green">佣金 {{ item.commissionRate || 0 }}%</text><text class="tag tag-gray">{{ item.categoryName }}</text></view><view class="meta"><text class="price">{{ money(item.price) }}</text><text>销量 {{ item.sales || 0 }}</text><text>库存 {{ item.stock }}</text></view></view>
      </view>
    </view>
    <view v-else class="empty"><view class="empty-icon">品</view><text>货架还没有商品</text><button class="btn btn-sm btn-primary empty-button" @tap="goPool">去选品中心</button></view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { channelApi, type Product } from '../../api'
import { channelSession, requireChannelLogin } from '../../session'
import { firstImage, money, toast } from '../../utils'

const products = ref<Product[]>([])
const loading = ref(false)
onShow(load)
onPullDownRefresh(load)

async function load() {
  if (!requireChannelLogin()) return
  loading.value = true
  try {
    const result = await channelApi.getProducts({ channelId: channelSession.account?.id || 1, page: 1, size: 50 })
    products.value = result.records || []
  } catch (error) {
    toast((error as Error).message)
  } finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function goPool() { uni.switchTab({ url: '/pages/pool/index' }) }
</script>

<style scoped lang="scss">
.products-page{padding-bottom:28rpx}.loading{padding:90rpx 0;color:#84938a;text-align:center}.product-list{padding:6rpx 22rpx 0}.product-card{display:flex;gap:16rpx;margin-bottom:14rpx;padding:18rpx;border:1rpx solid #e3eae5;border-radius:21rpx;background:#fff}.product-image,.product-placeholder{width:180rpx;height:190rpx;flex:0 0 180rpx;border-radius:16rpx}.product-image{background:#eef7f1}.product-placeholder{display:grid;place-items:center;background:#edf7f1;color:rgba(18,118,74,.16);font-size:58rpx;font-weight:800}.product-body{display:flex;min-width:0;flex:1;flex-direction:column}.product-name{color:#0b1a12;font-size:24rpx;font-weight:700}.product-point{margin-top:6rpx;color:#84938a;font-size:24rpx}.tags{display:flex;gap:6rpx;margin-top:10rpx}.meta{display:flex;align-items:baseline;gap:13rpx;margin-top:auto;color:#84938a;font-size:24rpx}.meta .price{font-size:26rpx}.empty-button{margin-top:14rpx}
</style>
