<script setup lang="ts">
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { requireTradeLogin, getTradeRole } from '../../auth'
import { money, ORDER_STATUS, tradeApi, type TradeOrder } from '../../api'

const orders = ref<TradeOrder[]>([])
const loading = ref(false)
const loadError = ref('')
const side = ref(getTradeRole())
const status = ref('')
const statuses = [
  { value: '', label: '全部' }, { value: 'awaiting_payment', label: '待付款' }, { value: 'paid', label: '待发货' },
  { value: 'shipped', label: '运输中' }, { value: 'received', label: '待完成' }, { value: 'completed', label: '已完成' },
  { value: 'refunding', label: '退款中' }, { value: 'cancelled', label: '已取消' },
]
const hasFilter = computed(() => Boolean(status.value))
let serial = 0

onShow(() => { if(side.value !== getTradeRole()){ side.value=getTradeRole(); orders.value=[]; status.value=''; serial++ }; void load() })
onPullDownRefresh(() => { void load().finally(() => uni.stopPullDownRefresh()) })
function detail(id: number) { uni.navigateTo({ url: '/pages/order-detail/index?id=' + id }) }

async function load() {
  if (!requireTradeLogin()) return
  const token = ++serial
  loading.value = true
  loadError.value = ''
  try {
    const data = await tradeApi.orders({ side: side.value || undefined, orderStatus: status.value || undefined })
    if (token === serial) orders.value = data
  } catch (error) {
    if (token === serial) loadError.value = error instanceof Error ? error.message : '订单加载失败'
  } finally {
    if (token === serial) loading.value = false
  }
}
function pickStatus(value: string) { if (status.value !== value) { status.value = value; void load() } }
function changeCenter() { uni.switchTab({ url: '/pages/profile/index' }) }
function clearFilters() { status.value = ''; void load() }
function toHall() { uni.switchTab({ url: '/pages/products/index' }) }
function toGoods() { uni.navigateTo({ url: '/pages/seller/goods' }) }
function tone(value: string) {
  if (['completed'].includes(value)) return ''
  if (['cancelled', 'closed', 'refunded'].includes(value)) return 'gray'
  if (['refunding'].includes(value)) return 'red'
  if (['shipped', 'received'].includes(value)) return 'blue'
  return 'amber'
}
</script>

<template>
  <view class="page flush">
    <view class="filter">
      <view class="page-head"><text class="page-title">{{ side === 'buyer' ? '采购订单' : '销售订单' }}</text><text class="link" @tap="changeCenter">切换中心 ›</text></view>
      <scroll-view scroll-x class="chips" :show-scrollbar="false">
        <view v-for="item in statuses" :key="item.value" class="chip" :class="{ on: status === item.value }" @tap="pickStatus(item.value)">{{ item.label }}</view>
      </scroll-view>
      <view v-if="hasFilter" class="filter-summary"><text>当前：{{ side ? (side === 'buyer' ? '我买到的' : '我卖出的') : '全部方向' }}{{ status ? ` · ${statuses.find(item => item.value === status)?.label}` : '' }}</text><button @tap="clearFilters">清除筛选</button></view>
    </view>

    <view class="pad">
      <view v-if="loading && !orders.length" class="loading">正在加载订单…</view>
      <view v-else-if="loadError" class="load-error"><text>{{ loadError }}</text><button class="btn btn-ghost" @tap="load">重新加载订单</button></view>
      <template v-else>
        <view v-for="item in orders" :key="item.id" class="card list-card" @tap="detail(item.id)">
          <view class="between">
            <text class="tiny mono ellipsis grow">{{ item.orderNo }}</text>
            <text class="tag" :class="tone(item.orderStatus)">{{ ORDER_STATUS[item.orderStatus] || item.orderStatus }}</text>
          </view>
          <text class="list-title">{{ item.productName || '交易订单' }}</text>
          <text class="muted line ellipsis">{{ item.buyerName || '采购方' }} → {{ item.sellerName || '供货方' }}</text>
          <view class="foot">
            <text class="tiny">{{ item.createTime }}</text>
            <view><text class="tiny">合计 </text><text class="price">{{ money(item.totalAmount) }}</text></view>
          </view>
        </view>
        <view v-if="!orders.length" class="empty-state">
        <text class="empty-title">{{ status ? '当前筛选下没有订单' : side === 'seller' ? '还没有销售订单' : '还没有采购订单' }}</text>
        <text class="empty-desc">{{ status ? '换个状态看看，或查看全部订单' : side === 'seller' ? '买家下单后，销售订单会显示在这里' : '去交易大厅挑选货源，下单后会显示在这里' }}</text>
        <button v-if="status" class="btn btn-ghost btn-sm" @tap="clearFilters">查看全部订单</button>
        <button v-else-if="side === 'seller'" class="btn btn-ghost btn-sm" @tap="toGoods">管理商品</button>
        <button v-else class="btn btn-primary btn-sm" @tap="toHall">去交易大厅</button>
      </view>
      </template>
    </view>
  </view>
</template>

<style scoped lang="scss">
.filter { position: sticky; top: var(--window-top, 0); z-index: 10; padding: 20rpx 24rpx 16rpx; background: var(--c-bg); }
.filter .chips { margin-top: 16rpx; }
.filter-summary { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; margin-top: 12rpx; padding: 12rpx 16rpx; border-radius: 14rpx; background: #e8f6ee; color: var(--c-primary); font-size: 24rpx; }
.filter-summary button { flex-shrink: 0; min-height: 48rpx; padding: 0 12rpx; color: var(--c-primary); font-size: 24rpx; }
</style>
