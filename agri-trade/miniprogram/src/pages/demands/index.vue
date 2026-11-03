<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { money, tradeApi, type TradeDemand } from '../../api'

const demands = ref<TradeDemand[]>([])
const loading = ref(false)

onShow(() => void load())

async function load() {
  loading.value = true
  try {
    demands.value = await tradeApi.demands()
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function publish() {
  uni.navigateTo({ url: '/pages/publish-demand/index' })
}
</script>

<template>
  <view class="page pad">
    <view class="section-head"><view><text class="kicker">PURCHASE DEMAND</text><text class="title">采购需求大厅</text></view><button class="btn btn-primary btn-sm" @tap="publish">+ 发布需求</button></view>
    <view v-if="loading" class="loading">正在加载需求…</view>
    <view v-else>
      <view class="card demand-card" v-for="item in demands" :key="item.id">
        <view class="between"><text class="demand-name">{{ item.demandName }}</text><text class="tag">{{ item.demandStatus === 'open' ? '招募中' : item.demandStatus }}</text></view>
        <text class="muted">{{ item.productName || item.demandName }} · {{ item.categoryName || '农产品' }}</text>
        <view class="info"><view><text>采购量</text><b>{{ item.quantity }} {{ item.unit || '吨' }}</b></view><view><text>预算</text><b>{{ item.priceMin || item.priceMax ? `${money(item.priceMin)} - ${money(item.priceMax)}` : '面议' }}</b></view></view>
        <view class="between foot"><text class="tiny">{{ item.buyerName }} · {{ item.deliveryAddress || '交货地待协商' }}</text><text class="tiny">{{ item.responseCount || 0 }} 条报价</text></view>
      </view>
      <view v-if="!demands.length" class="empty">暂无公开采购需求</view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20rpx; }
.kicker,.title { display: block; }
.kicker { color: #12764a; font-size: 17rpx; font-weight: 750; letter-spacing: .1em; }
.title { margin-top: 4rpx; font-size: 34rpx; font-weight: 760; }
.btn-sm { min-height: 60rpx; padding: 0 18rpx; font-size: 21rpx; }
.demand-name { font-size: 26rpx; font-weight: 700; }
.demand-card > .muted { display: block; margin-top: 8rpx; }
.info { display: grid; grid-template-columns: repeat(2,1fr); gap: 12rpx; margin-top: 16rpx; padding: 16rpx; border-radius: 14rpx; background: #f4faf6; }
.info view { display: flex; flex-direction: column; gap: 4rpx; }
.info text { color: #718277; font-size: 18rpx; }
.info b { font-size: 22rpx; }
.foot { margin-top: 15rpx; }
</style>
