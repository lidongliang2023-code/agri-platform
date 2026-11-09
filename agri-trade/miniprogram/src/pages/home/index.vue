<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { money, tradeApi, type TradeDemand, type TradeProduct } from '../../api'
import { getTradeUser } from '../../auth'

const products = ref<TradeProduct[]>([])
const demands = ref<TradeDemand[]>([])
const loading = ref(true)
const statusBarHeight = ref(Number(uni.getSystemInfoSync().statusBarHeight || 0))
const account = getTradeUser()
const displayName = account?.nickname || account?.username || '平台用户'

onShow(load)

async function load() {
  loading.value = true
  try {
    const [productData, demandData] = await Promise.all([tradeApi.products(), tradeApi.demands()])
    products.value = productData
    demands.value = demandData
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function toProduct(id: number) {
  uni.navigateTo({ url: `/pages/product/detail?id=${id}` })
}
function toMarket() { uni.switchTab({ url: '/pages/products/index' }) }
function toDemand() { uni.switchTab({ url: '/pages/demands/index' }) }
</script>

<template>
  <view class="page">
    <view class="hero" :style="{ paddingTop: `${statusBarHeight + 18}px` }">
      <view class="hero-top"><text class="brand">交易撮合</text><text class="online">● 交易大厅在线</text></view>
      <text class="welcome">您好，{{ displayName }}</text>
      <text class="hero-title">找货源，接需求</text>
      <text class="hero-desc">品质农产品供需撮合，从产地直达采购方</text>
      <view class="metrics">
        <view><b>{{ products.length }}</b><text>在售货源</text></view>
        <view><b>{{ demands.length }}</b><text>采购需求</text></view>
        <view><b>AI</b><text>智能撮合</text></view>
      </view>
    </view>

    <view class="pad">
      <view v-if="loading" class="loading">正在加载交易数据…</view>
      <template v-else>
        <view class="card">
          <view class="card-head"><text class="card-title">热门货源</text><text class="tiny" @tap="toMarket">全部 ›</text></view>
          <view class="product" v-for="item in products.slice(0, 4)" :key="item.id" @tap="toProduct(item.id)">
            <view class="product-icon">{{ item.productName?.slice(0, 1) || '农' }}</view>
            <view class="product-copy">
              <text class="product-name">{{ item.productName }}</text>
              <text class="muted">{{ item.sellerName || '认证供应商' }} · {{ item.originCity || '产地直供' }}</text>
            </view>
            <view class="product-price"><text class="price">{{ money(item.price) }}</text><text class="tiny">/{{ item.unit }}</text></view>
          </view>
          <view v-if="!products.length" class="empty">暂无在售货源</view>
        </view>

        <view class="card">
          <view class="card-head"><text class="card-title">最新采购需求</text><text class="tiny" @tap="toDemand">更多 ›</text></view>
          <view class="demand" v-for="item in demands.slice(0, 4)" :key="item.id">
            <view class="between"><text class="demand-name">{{ item.demandName }}</text><text class="tag">{{ item.categoryName || '农产品' }}</text></view>
            <text class="muted">{{ item.buyerName }} · {{ item.deliveryAddress || '待协商交货地' }}</text>
            <view class="between demand-foot"><text>{{ item.quantity }} {{ item.unit || '吨' }}</text><text class="price">{{ item.priceMin || item.priceMax ? `${money(item.priceMin)} - ${money(item.priceMax)}` : '面议' }}</text></view>
          </view>
          <view v-if="!demands.length" class="empty">暂无公开采购需求</view>
        </view>
      </template>
    </view>
  </view>
</template>

<style scoped lang="scss">
.hero { padding: 0 28rpx 42rpx; border-radius: 0 0 38rpx 38rpx; background: radial-gradient(circle at 88% 8%, rgba(83,213,138,.28), transparent 430rpx), linear-gradient(145deg,#073821,#0d5d3b); color: #fff; }
.hero-top { display: flex; align-items: center; justify-content: space-between; height: 70rpx; }
.brand { font-size: 31rpx; font-weight: 750; }
.online { color: #9ce8ba; font-size: 24rpx; }
.welcome { display: block; margin-top: 22rpx; color: rgba(255,255,255,.55); font-size: 24rpx; }
.hero-title { display: block; margin-top: 6rpx; font-size: 44rpx; font-weight: 760; }
.hero-desc { display: block; margin-top: 8rpx; color: rgba(255,255,255,.6); font-size: 24rpx; }
.metrics { display: grid; grid-template-columns: repeat(3,1fr); margin-top: 28rpx; padding: 20rpx; border: 1rpx solid rgba(255,255,255,.12); border-radius: 20rpx; background: rgba(1,28,15,.18); }
.metrics view { display: flex; align-items: center; flex-direction: column; gap: 4rpx; }
.metrics b { font-family: monospace; font-size: 34rpx; }
.metrics text { color: rgba(255,255,255,.5); font-size: 24rpx; }
.pad { margin-top: -26rpx; padding: 0 24rpx 30rpx; position: relative; }
.product,.demand { padding: 17rpx 0; border-top: 1rpx solid #edf2ee; }
.product:first-of-type,.demand:first-of-type { border-top: 0; }
.product { display: flex; align-items: center; gap: 14rpx; }
.product-icon { display: grid; width: 70rpx; height: 70rpx; flex: 0 0 70rpx; place-items: center; border-radius: 18rpx; background: #e5f5eb; color: #0e5233; font-size: 27rpx; font-weight: 750; }
.product-copy { min-width: 0; flex: 1; }
.product-name,.product-copy text { display: block; }
.product-name { margin-bottom: 5rpx; font-size: 24rpx; font-weight: 650; }
.product-price { text-align: right; }
.product-price text { display: block; }
.between { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; }
.demand-name { font-size: 24rpx; font-weight: 650; }
.demand .muted { display: block; margin-top: 6rpx; }
.demand-foot { margin-top: 10rpx; font-size: 24rpx; }
</style>
