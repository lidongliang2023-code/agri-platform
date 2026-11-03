<template>
  <view class="page pool-page">
    <view class="page-top"><view><text class="kicker">PRODUCT POOL</text><text class="title">选品中心</text></view><text class="sub">共 {{ total }} 件好货</text></view>
    <view class="search-card">
      <view class="search-box"><text>⌕</text><input v-model="keyword" placeholder="搜索商品或供应商" confirm-type="search" @confirm="search" /><text v-if="keyword" @tap="clear">×</text></view>
      <scroll-view scroll-x :show-scrollbar="false" class="category-scroll">
        <view class="category-row"><view v-for="item in categories" :key="item.id" class="category-chip" :class="{ active: categoryId === item.id }" @tap="selectCategory(item.id)">{{ item.name }}</view></view>
      </scroll-view>
    </view>

    <view v-if="loading" class="loading">正在加载平台商品…</view>
    <view v-else-if="products.length" class="pool-list">
      <view v-for="item in products" :key="item.id" class="pool-card">
        <image v-if="firstImage(item.images)" class="product-image" :src="firstImage(item.images)" mode="aspectFill" />
        <view v-else class="product-image product-placeholder">丰</view>
        <view class="product-body">
          <text class="product-name">{{ item.name }}</text>
          <text class="product-point">{{ item.sellingPoint }}</text>
          <view class="tags"><text class="tag tag-green">佣金 {{ item.commissionRate || 0 }}%</text><text class="tag tag-gray">{{ item.categoryName }}</text></view>
          <view class="product-meta">
            <view><text class="price">{{ money(item.price) }}</text><small class="small-copy">供货价</small></view>
            <view><b>{{ item.sales || 0 }}</b><small class="small-copy">销量</small></view>
            <view><b>{{ item.stock }}</b><small class="small-copy">库存</small></view>
          </view>
          <button class="btn btn-sm btn-primary select-button" :loading="selectingId === item.id" @tap="select(item)">选品上架</button>
        </view>
      </view>
    </view>
    <view v-else class="empty"><view class="empty-icon">选</view><text>没有找到可分销商品</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { channelApi, type Product } from '../../api'
import { channelSession, requireChannelLogin } from '../../session'
import { firstImage, money, toast } from '../../utils'

const categories = [
  { id: 0, name: '全部' }, { id: 7, name: '粮油' }, { id: 12, name: '果蔬' },
  { id: 16, name: '蛋奶' }, { id: 17, name: '茶叶' }, { id: 18, name: '养生' },
]
const keyword = ref('')
const categoryId = ref(0)
const products = ref<Product[]>([])
const total = ref(0)
const loading = ref(false)
const selectingId = ref(0)

onShow(load)
onPullDownRefresh(load)

async function load() {
  if (!requireChannelLogin()) return
  loading.value = true
  try {
    const result = await channelApi.getProductPool({
      page: 1,
      size: 40,
      keyword: keyword.value.trim() || undefined,
      categoryId: categoryId.value || null,
    })
    products.value = result.records || []
    total.value = result.total || 0
  } catch (error) {
    toast((error as Error).message)
  } finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function search() { load() }
function clear() { keyword.value = ''; load() }
function selectCategory(id: number) { categoryId.value = id; load() }

async function select(product: Product) {
  selectingId.value = product.id
  try {
    const result = await channelApi.selectProduct(channelSession.account?.id || 1, product.id)
    if (!result.success) throw new Error(result.message || '选品失败')
    toast('选品成功，已加入我的货架', 'success')
  } catch (error) {
    toast((error as Error).message)
  } finally {
    selectingId.value = 0
  }
}
</script>

<style scoped lang="scss">
.pool-page{padding-bottom:26rpx}.page-top{display:flex;align-items:flex-end;justify-content:space-between;padding:24rpx 22rpx 16rpx}.page-top .kicker,.page-top .title{display:block}.page-top .kicker{color:#12764a;font-size:16rpx;font-weight:700;letter-spacing:2rpx}.page-top .title{margin-top:4rpx;font-size:34rpx;font-weight:800}
.search-card{margin:0 22rpx;padding:14rpx;border:1rpx solid #e3eae5;border-radius:20rpx;background:#fff}.search-box{display:flex;height:70rpx;align-items:center;gap:10rpx;padding:0 17rpx;border:1rpx solid #dfe8e2;border-radius:14rpx}.search-box text{color:#52665a;font-size:28rpx}.search-box input{flex:1;font-size:23rpx}
.category-scroll{width:100%;margin-top:12rpx;white-space:nowrap}.category-row{display:inline-flex;gap:9rpx}.category-chip{padding:8rpx 20rpx;border:1rpx solid #e3eae5;border-radius:999rpx;color:#718277;font-size:19rpx}.category-chip.active{border-color:#12764a;background:#e9f6ee;color:#0e5233;font-weight:700}
.loading{padding:90rpx 0;color:#84938a;text-align:center}.pool-list{padding:16rpx 22rpx 0}.pool-card{display:flex;gap:16rpx;margin-bottom:14rpx;padding:18rpx;border:1rpx solid #e3eae5;border-radius:21rpx;background:#fff}
.product-image,.product-placeholder{width:190rpx;height:230rpx;flex:0 0 190rpx;border-radius:16rpx}.product-image{background:#eef7f1}.product-placeholder{display:grid;place-items:center;background:#edf7f1;color:rgba(18,118,74,.16);font-size:60rpx;font-weight:800}
.product-body{display:flex;min-width:0;flex:1;flex-direction:column}.product-name{color:#0b1a12;font-size:23rpx;font-weight:700}.product-point{margin-top:6rpx;overflow:hidden;color:#84938a;font-size:17rpx;text-overflow:ellipsis;white-space:nowrap}.tags{display:flex;gap:6rpx;margin-top:9rpx}.product-meta{display:flex;justify-content:space-between;margin-top:auto;padding-top:10rpx}.product-meta view{display:flex;flex-direction:column}.product-meta .price{font-size:26rpx}.product-meta b{color:#33453b;font-size:22rpx}.product-meta .small-copy{margin-top:3rpx;color:#93a29a;font-size:15rpx}.select-button{align-self:flex-end;margin-top:9rpx}
</style>
