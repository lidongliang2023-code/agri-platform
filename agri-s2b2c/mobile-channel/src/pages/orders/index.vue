<template>
  <view class="page orders-page">
    <view class="sticky-head">
      <view class="segment">
        <text class="segment-item" :class="{ active: mode === 'order' }" @tap="switchMode('order')">订单</text>
        <text class="segment-item" :class="{ active: mode === 'after' }" @tap="switchMode('after')">
          售后<text v-if="pendingAfterCount" class="segment-badge">{{ pendingAfterCount }}</text>
        </text>
      </view>
      <scroll-view class="status-scroll" scroll-x :show-scrollbar="false">
        <view class="status-row">
          <text v-for="item in currentStatuses" :key="item.value" class="status-chip" :class="{ active: currentStatus === item.value }" @tap="changeStatus(item.value)">{{ item.label }}</text>
        </view>
      </scroll-view>
      <view v-if="mode === 'order'" class="search-box">
        <text class="search-icon">⌕</text>
        <input v-model="keyword" placeholder="搜索订单号" confirm-type="search" @confirm="load()" />
        <text v-if="keyword" class="ui-action-target search-clear" @tap="keyword = ''; load()">×</text>
      </view>
    </view>

    <view v-if="loading" class="loading">正在加载…</view>
    <view v-else-if="loadError && !(mode === 'order' ? orders.length : afterSales.length)" class="empty">
      <view class="empty-icon">!</view>
      <text>{{ loadError }}</text>
      <button class="btn btn-sm btn-primary retry-button" @tap="load()">重新加载</button>
    </view>

    <!-- 订单 -->
    <view v-else-if="mode === 'order' && orders.length" class="list">
      <view v-for="order in orders" :key="order.id" class="item-card" @tap="openOrder(order.id)">
        <view class="item-head">
          <text class="order-no">{{ order.orderNo }}</text>
          <text class="tag" :class="`tag-${orderStatus(order.status).tone}`">{{ orderStatus(order.status).label }}</text>
        </view>
        <view class="item-data">
          <view><text>实付金额</text><text class="price strong-copy">{{ money(order.payAmount) }}</text></view>
          <view><text>下单时间</text><text class="strong-copy">{{ formatTime(order.createTime) }}</text></view>
        </view>
        <view v-if="shipHint(order)" class="ship-hint">{{ shipHint(order) }}</view>
        <view class="item-foot"><text class="link">{{ order.status === 'PENDING_SHIP' ? '去发货' : '查看详情' }} ›</text></view>
      </view>
    </view>

    <!-- 售后 -->
    <view v-else-if="mode === 'after' && afterSales.length" class="list">
      <view v-for="item in afterSales" :key="item.id" class="item-card">
        <view class="item-head">
          <view>
            <text class="order-no">{{ afterSaleTypeLabel(item.type) }} · {{ money(item.amount) }}</text>
            <text class="sub-line ui-action-target" @tap="openOrder(item.orderId)">订单 {{ item.orderNo || item.orderId }} ›</text>
          </view>
          <text class="tag" :class="`tag-${afterSaleStatus(item.status, item.returnShippedAt).tone}`">{{ afterSaleStatus(item.status, item.returnShippedAt).label }}</text>
        </view>
        <text class="reason">{{ item.reason }}</text>
        <text v-if="item.items" class="sub-line">商品：{{ item.items }}</text>
        <text v-if="item.buyerName" class="sub-line">买家：{{ item.buyerName }} {{ item.buyerPhone }}</text>
        <text v-if="item.returnShippedAt" class="sub-line blue">退货物流：{{ item.returnCompany }} {{ item.returnLogisticsNo }}</text>
        <text v-if="item.handleOpinion" class="sub-line">处理意见：{{ item.handleOpinion }}</text>
        <view class="after-actions">
          <text class="time">{{ formatTime(item.createTime) }}</text>
          <template v-if="item.status === 'PENDING'">
            <button class="btn btn-sm" :disabled="busyId !== null" @tap="review(item, 'REJECTED')">拒绝</button>
            <button class="btn btn-sm btn-primary" :disabled="busyId !== null" @tap="review(item, 'APPROVED')">{{ item.type === 'RETURN' ? '同意退货' : '同意退款' }}</button>
          </template>
          <button v-else-if="item.status === 'RETURNING' && item.returnShippedAt" class="btn btn-sm btn-primary" :disabled="busyId !== null" @tap="confirmReturn(item)">确认收货并退款</button>
          <text v-else-if="item.status === 'RETURNING'" class="waiting">等待买家寄回</text>
        </view>
      </view>
    </view>

    <view v-else class="empty">
      <view class="empty-icon">{{ mode === 'order' ? '单' : '售' }}</view>
      <text>{{ mode === 'order' ? '暂无订单' : '暂无售后单' }}</text>
    </view>
    <view v-if="mode === 'order' && orders.length && !loading" class="list-feedback"><text v-if="loadError">{{ loadError }}</text><button v-if="orders.length < total" class="btn load-more" :disabled="loadingMore" @tap="loadMore">{{ loadingMore ? '加载中…' : '加载更多' }}</button><text v-else>已显示全部订单</text></view>
    <MobileInputSheet :show="!!rejectItem" title="拒绝售后" description="请说明拒绝原因，买家可查看此内容" placeholder="填写拒绝原因" confirm-text="确认拒绝" :busy="busyId !== null" :error="rejectError" @close="rejectItem = null" @submit="submitRejection" />
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import MobileInputSheet from '../../components/MobileInputSheet.vue'
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { channelApi, type AfterSale, type Order } from '../../api'
import { requireChannelLogin } from '../../session'
import { afterSaleStatus, afterSaleTypeLabel, confirmAction, formatTime, money, orderStatus, toast } from '../../utils'

const orderStatuses = [
  { label: '全部', value: '' }, { label: '待发货', value: 'PENDING_SHIP' }, { label: '待付款', value: 'PENDING_PAY' },
  { label: '已发货', value: 'SHIPPED' }, { label: '已完成', value: 'COMPLETED' }, { label: '退款', value: 'REFUNDED' },
]
const afterStatuses = [
  { label: '待处理', value: 'PENDING' }, { label: '退货中', value: 'RETURNING' }, { label: '全部', value: '' },
]

const rejectItem = ref<AfterSale | null>(null)
const rejectError = ref('')
const currentPage = ref(0)
const total = ref(0)
const loadingMore = ref(false)
const mode = ref<'order' | 'after'>('order')
const orderStatusValue = ref('')
const afterStatusValue = ref('PENDING')
const keyword = ref('')
const orders = ref<Order[]>([])
const afterSales = ref<AfterSale[]>([])
const pendingAfterCount = ref(0)
const loading = ref(false)
const loadError = ref('')
const busyId = ref<number | null>(null)
let requestSeq = 0

const currentStatuses = computed(() => mode.value === 'order' ? orderStatuses : afterStatuses)
const currentStatus = computed(() => mode.value === 'order' ? orderStatusValue.value : afterStatusValue.value)

onShow(() => {
  // 工作台待办卡片跳过来时带的筛选
  const hasIntent = uni.getStorageInfoSync().keys.includes('channel_orders_intent')
  const intent = uni.getStorageSync('channel_orders_intent')
  if (hasIntent) {
    uni.removeStorageSync('channel_orders_intent')
    if (intent === 'after') {
      mode.value = 'after'
      afterStatusValue.value = 'PENDING'
    } else {
      mode.value = 'order'
      orderStatusValue.value = String(intent)
    }
  }
  load()
})
onPullDownRefresh(() => load())
onReachBottom(() => loadMore())
function loadMore() { if (mode.value === 'order') return load(true) }

function switchMode(next: 'order' | 'after') {
  if (mode.value === next) return
  mode.value = next
  rejectItem.value = null
  load()
}

function changeStatus(value: string) {
  rejectItem.value = null
  if (mode.value === 'order') orderStatusValue.value = value
  else afterStatusValue.value = value
  load()
}

async function load(append = false) {
  if (append && (loading.value || loadingMore.value || orders.value.length >= total.value)) return
  const nextPage = append ? currentPage.value + 1 : 1
  const seq = ++requestSeq
  if (!requireChannelLogin()) {
    uni.stopPullDownRefresh()
    return
  }
  if (append) loadingMore.value = true
  else {
    loading.value = true
    loadingMore.value = false
    if (mode.value === 'order') { orders.value = []; total.value = 0; currentPage.value = 0 }
    else afterSales.value = []
  }
  loadError.value = ''
  try {
    if (mode.value === 'order') {
      const result = await channelApi.getOrders({ page: nextPage, size: 20, status: orderStatusValue.value, keyword: keyword.value.trim() })
      if (seq !== requestSeq) return
      orders.value = append ? [...orders.value, ...(result.records || [])] : result.records || []
      total.value = Number(result.total || 0)
      currentPage.value = nextPage
    } else {
      const rows = await channelApi.getAfterSales(afterStatusValue.value)
      if (seq !== requestSeq) return
      afterSales.value = rows
      if (afterStatusValue.value === 'PENDING') pendingAfterCount.value = rows.length
    }
    if (mode.value !== 'after' || afterStatusValue.value !== 'PENDING') {
      channelApi.getAfterSales('PENDING').then((rows) => {
        if (seq === requestSeq) pendingAfterCount.value = rows.length
      }).catch(() => undefined)
    }
  } catch (error) {
    if (seq === requestSeq) loadError.value = (error as Error).message || '加载失败，请重试'
  } finally {
    if (seq === requestSeq) {
      loadingMore.value = false
      loading.value = false
      uni.stopPullDownRefresh()
    }
  }
}

function shipHint(order: Order) {
  if (order.shipConfirmStatus !== 'PENDING') return ''
  return order.shipProposedBy === 'SUPPLIER' ? '供应商已提交发货信息，待你确认' : '已提交发货信息，等待供应商确认'
}

function openOrder(id: number) {
  uni.navigateTo({ url: `/pages/orders/detail?id=${id}` })
}

async function review(item: AfterSale, status: 'APPROVED' | 'REJECTED') {
  if (busyId.value !== null) return
  let opinion: string | null = ''
  if (status === 'REJECTED') {
    rejectError.value = ''
    rejectItem.value = item
    return
  } else {
    const content = item.type === 'RETURN'
      ? '同意后请买家寄回商品，确认收到退货后才会退款。'
      : `同意后将按售后金额 ${money(item.amount)} 处理退款。全额退款会回补库存和活动成本，部分退款不回补。`
    if (!await confirmAction(item.type === 'RETURN' ? '同意退货' : '同意退款', content)) return
  }
  await run(item.id, () => channelApi.reviewAfterSale(item.id, status, opinion || undefined))
}

async function confirmReturn(item: AfterSale) {
  if (busyId.value !== null) return
  if (!await confirmAction('确认收到退货', `确认后将退款 ${money(item.amount)} 给买家。`)) return
  await run(item.id, () => channelApi.confirmReturn(item.id))
}

async function run(id: number, action: () => Promise<{ success: boolean; message?: string }>) {
  if (busyId.value !== null) return
  busyId.value = id
  try {
    const result = await action()
    if (!result.success) throw new Error(result.message || '操作失败')
    rejectItem.value = null
    toast(result.message || '已处理', 'success')
    await load()
  } catch (error) {
    rejectError.value = (error as Error).message
    toast(rejectError.value)
  } finally {
    busyId.value = null
  }
}
async function submitRejection(value: string) {
  value = value.trim()
  if (!value) { rejectError.value = '请填写拒绝原因，买家可见'; return }
  if (!rejectItem.value) return
  const id = rejectItem.value.id
  await run(id, () => channelApi.reviewAfterSale(id, 'REJECTED', value))
}
</script>

<style scoped lang="scss">
.orders-page { padding-bottom: 28rpx; }
.sticky-head { position: sticky; top: 0; z-index: 10; padding: 16rpx 22rpx 12rpx; background: #fff; box-shadow: 0 4rpx 16rpx rgba(17,62,41,.04); }
.segment { display: flex; padding: 6rpx; border-radius: 16rpx; background: #f0f4f1; }
.segment-item { flex: 1; padding: 14rpx 0; border-radius: 12rpx; color: #666666; font-size: 28rpx; text-align: center; }
.segment-item.active { background: #fff; color: #0e5233; font-weight: 700; box-shadow: 0 2rpx 8rpx rgba(17,62,41,.08); }
.segment-badge { margin-left: 8rpx; padding: 0 10rpx; border-radius: 999rpx; background: #d45b32; color: #fff; font-size: 24rpx; }
.status-scroll { width: 100%; margin-top: 14rpx; white-space: nowrap; }
.status-row { display: inline-flex; gap: 10rpx; }
.status-chip { padding: 10rpx 22rpx; border: 1rpx solid #e3eae5; border-radius: 999rpx; color: #666666; font-size: 24rpx; }
.status-chip.active { border-color: #12764a; background: #e9f6ee; color: #0e5233; font-weight: 700; }
.search-box { display: flex; height: 68rpx; align-items: center; gap: 10rpx; margin-top: 14rpx; padding: 0 18rpx; border: 1rpx solid #dfe8e2; border-radius: 14rpx; }
.search-box input { flex: 1; font-size: 26rpx; }
.search-icon, .search-clear { color: #52665a; font-size: 30rpx; }
.loading { padding: 90rpx 0; color: #666666; text-align: center; }
.retry-button { margin-top: 18rpx; }
.list { padding: 18rpx 22rpx 0; }
.item-card { margin-bottom: 16rpx; padding: 22rpx; border: 1rpx solid #e3eae5; border-radius: 22rpx; background: #fff; }
.item-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12rpx; }
.order-no { display: block; color: #0b1a12; font-size: 28rpx; font-weight: 700; word-break: break-all; }
.sub-line { display: block; margin-top: 8rpx; color: #666666; font-size: 24rpx; }
.sub-line.blue { color: #176c93; }
.item-data { display: flex; margin-top: 16rpx; padding: 16rpx 0; border-top: 1rpx solid #edf2ee; }
.item-data view { flex: 1; }
.item-data text, .item-data .strong-copy { display: block; }
.item-data text { color: #666666; font-size: 24rpx; }
.item-data .strong-copy { margin-top: 4rpx; color: #33453b; font-size: 26rpx; }
.ship-hint { padding: 12rpx 16rpx; border-radius: 12rpx; background: #fff6e6; color: #8f4500; font-size: 24rpx; }
.item-foot { margin-top: 12rpx; text-align: right; }
.link { color: #12764a; font-size: 26rpx; font-weight: 600; }
.reason { display: block; margin-top: 14rpx; color: #33453b; font-size: 26rpx; line-height: 1.6; }
.after-actions { display: flex; align-items: center; justify-content: flex-end; gap: 12rpx; margin-top: 16rpx; padding-top: 14rpx; border-top: 1rpx solid #edf2ee; }
.after-actions .time { flex: 1; color: #666666; font-size: 24rpx; }
.after-actions .btn { min-height: 64rpx; }
.waiting { color: #176c93; font-size: 24rpx; }
.after-actions { flex-wrap:wrap; }.after-actions .time { flex-basis:100%; }.after-actions .btn { flex:1; }.item-foot .link { display:inline-flex;align-items:center;min-height:44px; }.item-data { gap:12rpx; }.item-data view { min-width:0; }.item-data .strong-copy { overflow-wrap:anywhere; }.search-box { min-height:48px;height:auto; }.status-row { padding-bottom:4rpx; }
</style>
