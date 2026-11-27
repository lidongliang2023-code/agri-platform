<script setup lang="ts">
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { money, tradeApi, type TradeDemand } from '../../api'

import { getTradeRole } from '../../auth'
const role = ref(getTradeRole())

const demands = ref<TradeDemand[]>([])
const loading = ref(false)
const loadError = ref('')
const keyword = ref('')
const hasKeyword = computed(() => Boolean(keyword.value.trim()))
const shown = computed(() => {
  const k = keyword.value.trim()
  if (!k) return demands.value
  return demands.value.filter(item => [item.demandName, item.productName, item.categoryName, item.buyerName, item.deliveryAddress].some(v => String(v || '').includes(k)))
})

onShow(() => { role.value=getTradeRole(); void load() })
onPullDownRefresh(() => { void load().finally(() => uni.stopPullDownRefresh()) })

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    demands.value = await tradeApi.demands()
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '采购需求加载失败'
  } finally {
    loading.value = false
  }
}

function publish() { uni.navigateTo({ url: '/pages/publish-demand/index' }) }
function clearKeyword() { keyword.value = '' }
function quote() { uni.navigateTo({ url: '/pages/seller/quote' }) }
function budget(item: TradeDemand) {
  if (item.priceMin == null && item.priceMax == null) return '面议'
  if (item.priceMin != null && item.priceMax != null) return `${money(item.priceMin)}–${money(item.priceMax)}`
  return money(item.priceMin ?? item.priceMax)
}
function statusText(status: string) { return ({ open: '招募中', pending: '待撮合', matching: '撮合中', quoted: '已报价', closed: '已关闭', completed: '已完成' } as Record<string, string>)[status] || status }
</script>

<template>
  <view class="page with-fab">
    <view class="search-row">
      <view class="search-bar">
        <text class="search-icon">⌕</text>
        <input v-model="keyword" placeholder="按需求、品类、采购方筛选" confirm-type="search" />
      </view>
      <button v-if="hasKeyword" class="clear-button" @tap="clearKeyword">清除</button>
    </view>
    <view class="page-head">
      <view><text class="page-title">采购需求大厅</text><text class="page-sub">{{ loading ? '正在刷新…' : `共 ${shown.length} 条公开需求` }}</text></view>
      <button v-if="role === 'seller'" class="btn btn-line btn-sm" @tap="quote">我要报价</button>
    </view>

    <view v-if="loading && !demands.length" class="loading">正在加载需求…</view>
    <view v-else-if="loadError" class="load-error"><text>{{ loadError }}</text><button class="btn btn-ghost" @tap="load">重新加载需求</button></view>
    <template v-else>
      <view v-for="item in shown" :key="item.id" class="card list-card">
        <view class="between">
          <text class="demand-name">{{ item.demandName }}</text>
          <text class="tag" :class="{ gray: item.demandStatus !== 'open' }">{{ statusText(item.demandStatus) }}</text>
        </view>
        <text class="muted line">{{ item.productName || item.demandName }} · {{ item.categoryName || '农产品' }}</text>
        <view class="stats">
          <view class="stat"><text class="tiny">采购量</text><text class="stat-value">{{ item.quantity }} {{ item.unit || '吨' }}</text></view>
          <view class="stat"><text class="tiny">预算单价</text><text class="stat-value price">{{ budget(item) }}</text></view>
        </view>
        <view class="foot">
          <text class="tiny ellipsis grow">{{ item.buyerName }} · {{ item.deliveryAddress || '交货地待协商' }}</text>
          <text class="tiny">{{ item.responseCount || 0 }} 条报价</text>
        </view>
      </view>
      <view v-if="!shown.length" class="empty-state">
        <text class="empty-title">{{ keyword ? '没有符合条件的需求' : '暂时没有公开采购需求' }}</text>
        <text class="empty-desc">{{ keyword ? '换个关键词试试' : '发布一条需求，让供应商主动报价' }}</text>
        <button v-if="keyword" class="btn btn-ghost btn-sm" @tap="clearKeyword">清除筛选</button>
        <button v-else class="btn btn-primary btn-sm" @tap="publish">发布需求</button>
      </view>
    </template>

    <view v-if="role === 'buyer'" class="fab" @tap="publish">＋ 发布需求</view>
  </view>
</template>

<style scoped lang="scss">
.with-fab { padding-bottom: calc(180rpx + env(safe-area-inset-bottom)); }
.search-row { display: flex; align-items: center; gap: 12rpx; margin-bottom: 16rpx; }
.search-row .search-bar { min-width: 0; flex: 1; }
.clear-button { display: flex; min-height: 64rpx; align-items: center; padding: 0 18rpx; border-radius: 32rpx; background: #fff; color: var(--c-primary); font-size: 24rpx; }
.search-bar { margin-bottom: 0; }
.demand-name { min-width: 0; flex: 1; font-size: 30rpx; font-weight: 700; }
.stats { display: flex; gap: 16rpx; margin-top: 20rpx; padding: 20rpx 24rpx; border-radius: 16rpx; background: #f5faf7; }
.stat { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 4rpx; }
.stat-value { font-size: 28rpx; font-weight: 600; overflow-wrap: anywhere; }
.stat-value.price { font-size: 32rpx; }
</style>
