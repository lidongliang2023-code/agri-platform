<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { money, tradeApi, type TradeProduct } from '../../api'

const product = ref<TradeProduct | null>(null)
const loading = ref(true)

onLoad((options?: Record<string, string>) => void load(Number(options?.id)))

async function load(id: number) {
  try {
    product.value = await tradeApi.product(id)
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function inquire() {
  uni.showModal({
    title: '发起询价',
    content: '询价功能已连接交易撮合流程，请在 PC 端会员中心继续完成报价与合同。',
    showCancel: false,
  })
}
</script>

<template>
  <view class="page pad">
    <view v-if="loading" class="loading">正在加载商品…</view>
    <template v-else-if="product">
      <view class="hero-card">
        <view class="glyph">{{ product.productName?.slice(0, 1) || '农' }}</view>
        <text class="title">{{ product.productName }}</text>
        <text class="muted">{{ product.variety || '' }} {{ product.specification || '' }}</text>
        <view class="price-row"><text class="price">{{ money(product.price) }}</text><text class="tiny">/{{ product.unit }}</text></view>
      </view>
      <view class="card">
        <view class="card-head"><text class="card-title">商品信息</text><text class="tag">已发布</text></view>
        <view class="row"><text>供应商</text><b>{{ product.sellerName || '认证供应商' }}</b></view>
        <view class="row"><text>品类</text><b>{{ product.categoryName || '农产品' }}</b></view>
        <view class="row"><text>产地</text><b>{{ product.originCity || '产地直供' }}</b></view>
        <view class="row"><text>库存</text><b>{{ product.stockQuantity || 0 }} {{ product.unit }}</b></view>
      </view>
      <view class="card">
        <text class="card-title">商品说明</text>
        <text class="description">{{ product.description || '品质农产品，支持交易撮合询价与订单履约。' }}</text>
      </view>
      <button class="btn btn-primary" @tap="inquire">向供应商询价</button>
    </template>
  </view>
</template>

<style scoped lang="scss">
.hero-card { margin-bottom: 20rpx; padding: 30rpx; border-radius: 26rpx; background: linear-gradient(145deg,#073821,#12764a); color: #fff; }
.glyph { display: grid; width: 100rpx; height: 100rpx; place-items: center; border-radius: 25rpx; background: rgba(255,255,255,.12); font-size: 40rpx; font-weight: 800; }
.title { display: block; margin-top: 18rpx; font-size: 38rpx; font-weight: 780; }
.hero-card .muted { display: block; margin-top: 8rpx; color: rgba(255,255,255,.55); }
.price-row { margin-top: 20rpx; }
.price-row .price { color: #9ce8ba; font-size: 38rpx; }
.price-row .tiny { color: rgba(255,255,255,.5); }
.row { display: flex; justify-content: space-between; padding: 16rpx 0; border-bottom: 1rpx solid #edf2ee; font-size: 22rpx; }
.row:last-child { border-bottom: 0; }
.row text { color: #718277; }
.description { display: block; margin-top: 14rpx; line-height: 1.75; }
</style>
