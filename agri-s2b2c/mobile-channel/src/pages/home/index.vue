<template>
  <view class="page home-page">
    <view class="hero">
      <view class="hero-top">
        <view class="hero-copy">
          <text class="hero-kicker">CHANNEL WORKBENCH</text>
          <text class="hero-title">{{ channel?.shopName || channelSession.account?.shopName || '商家工作台' }}</text>
          <text class="hero-desc">{{ channel?.companyName || '产地好物分销' }}</text>
        </view>
        <text class="grade-tag">{{ channel?.grade || '渠道商家' }}</text>
      </view>
      <view class="today-row">
        <view><text class="strong-copy">{{ dashboard.todayOrders ?? 0 }}</text><text>今日订单</text></view>
        <view><text class="strong-copy">{{ money(dashboard.todayAmount) }}</text><text>今日成交</text></view>
        <view><text class="strong-copy">{{ shelfCount }}</text><text>货架商品</text></view>
      </view>
    </view>

    <view class="todo-row">
      <view class="todo-card" :class="{ hot: (dashboard.pendingShip || 0) > 0 }" @tap="goOrders('PENDING_SHIP')">
        <text class="todo-value">{{ dashboard.pendingShip ?? 0 }}</text>
        <text class="todo-label">待发货订单</text>
        <text class="todo-link">查看待办 ›</text>
      </view>
      <view class="todo-card" :class="{ hot: (dashboard.pendingAfterSale || 0) > 0 }" @tap="goOrders('after')">
        <text class="todo-value">{{ dashboard.pendingAfterSale ?? 0 }}</text>
        <text class="todo-label">待处理售后</text>
        <text class="todo-link">去处理 ›</text>
      </view>
    </view>

    <view class="quick-grid">
      <view v-for="item in quickEntries" :key="item.label" class="quick-item" @tap="open(item.url)">
        <view class="quick-icon">{{ item.icon }}</view>
        <text>{{ item.label }}</text>
      </view>
    </view>

    <view class="card commission-card" @tap="open('/pages/commissions/index')">
      <view class="card-head"><text class="card-title">佣金收益</text><text class="card-sub">明细与提现 ›</text></view>
      <view class="commission-grid">
        <view><text>可提现</text><text class="green strong-copy">{{ money(summary?.available) }}</text></view>
        <view><text>待结算</text><text class="orange strong-copy">{{ money(summary?.pendingTotal) }}</text></view>
        <view><text>累计已结算</text><text class="strong-copy">{{ money(summary?.settledTotal) }}</text></view>
      </view>
    </view>

    <view class="section-head"><view><text class="kicker">RECENT ORDERS</text><text class="title">最近订单</text></view><text class="sub" @tap="goOrders('')">全部 ›</text></view>
    <view class="card order-card">
      <view v-for="order in recentOrders" :key="order.id" class="order-row" @tap="open(`/pages/orders/detail?id=${order.id}`)">
        <view class="order-copy">
          <text class="order-no">{{ order.orderNo }}</text>
          <text class="order-time">{{ formatTime(order.createTime) }}</text>
        </view>
        <view class="order-right">
          <text class="strong-copy">{{ money(order.payAmount) }}</text>
          <text class="tag" :class="`tag-${orderStatus(order.status).tone}`">{{ orderStatus(order.status).label }}</text>
        </view>
      </view>
      <view v-if="!recentOrders.length" class="empty-mini">还没有订单，去选品上架把好货分享给客户吧</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { channelApi, type ChannelPartner, type CommissionSummary, type Dashboard, type Order } from '../../api'
import { channelSession, currentChannelId, openPage } from '../../session'
import { formatTime, money, orderStatus, toast } from '../../utils'

const channel = ref<ChannelPartner | null>(null)
const dashboard = ref<Dashboard>({})
const summary = ref<CommissionSummary | null>(null)
const recentOrders = ref<Order[]>([])
const shelfCount = ref(0)

const quickEntries = [
  { label: '选品中心', icon: '选', url: '/pages/pool/index' },
  { label: '我的货架', icon: '架', url: '/pages/products/index' },
  { label: '营销素材', icon: '营', url: '/pages/marketing/index' },
  { label: '店铺资料', icon: '店', url: '/pages/shop/edit' },
]

onShow(load)
onPullDownRefresh(load)

async function load() {
  const channelId = currentChannelId()
  if (!channelId) return uni.stopPullDownRefresh()
  try {
    const [detail, stats, commission, orders, shelf] = await Promise.all([
      channelApi.getChannel(channelId),
      channelApi.getDashboard(),
      channelApi.getCommissionSummary().catch(() => null),
      channelApi.getOrders({ page: 1, size: 5 }),
      channelApi.getProducts(channelId, { page: 1, size: 1 }).catch(() => null),
    ])
    channel.value = detail
    dashboard.value = stats
    summary.value = commission
    recentOrders.value = orders.records || []
    shelfCount.value = Number(shelf?.total ?? 0)
  } catch (error) {
    toast((error as Error).message)
  } finally {
    uni.stopPullDownRefresh()
  }
}

/** 订单页是 tab，switchTab 不能带参数：通过本地存储把要看的筛选交过去 */
function goOrders(filter: string) {
  uni.setStorageSync('channel_orders_intent', filter)
  uni.switchTab({ url: '/pages/orders/index' })
}

function open(url: string) {
  openPage(url)
}
</script>

<style scoped lang="scss">
.home-page { padding-bottom: 32rpx; }
.hero { margin: 18rpx 22rpx 0; }
.hero-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16rpx; }
.hero-copy { min-width: 0; flex: 1; }
.grade-tag { flex-shrink: 0; padding: 6rpx 16rpx; border: 1rpx solid rgba(255,255,255,.24); border-radius: 999rpx; color: #c9f2d7; font-size: 24rpx; }
.today-row { display: flex; margin-top: 26rpx; padding-top: 22rpx; border-top: 1rpx solid rgba(255,255,255,.14); }
.today-row view { flex: 1; }
.today-row .strong-copy, .today-row text { display: block; }
.today-row .strong-copy { color: #fff; font-size: 34rpx; font-weight: 800; }
.today-row text { margin-top: 4rpx; color: rgba(255,255,255,.62); font-size: 24rpx; }
.todo-row { display: flex; gap: 16rpx; margin: 18rpx 22rpx 0; }
.todo-card { flex: 1; padding: 22rpx 24rpx; border: 1rpx solid #e3eae5; border-radius: 22rpx; background: #fff; }
.todo-card.hot { border-color: #f1d7a6; background: #fffaf0; }
.todo-value, .todo-label, .todo-link { display: block; }
.todo-value { color: #0b1a12; font-size: 44rpx; font-weight: 800; }
.todo-card.hot .todo-value { color: #a96a08; }
.todo-label { margin-top: 2rpx; color: #52665a; font-size: 26rpx; }
.todo-link { margin-top: 10rpx; color: #12764a; font-size: 24rpx; }
.commission-card { margin-top: 18rpx; }
.commission-grid { display: flex; }
.commission-grid view { flex: 1; }
.commission-grid text, .commission-grid .strong-copy { display: block; }
.commission-grid text { color: #84938a; font-size: 24rpx; }
.commission-grid .strong-copy { margin-top: 6rpx; color: #33453b; font-size: 30rpx; font-weight: 800; }
.commission-grid .green { color: #12764a; }
.commission-grid .orange { color: #a96a08; }
.quick-grid { display: flex; margin: 0 22rpx; padding: 22rpx 0; border: 1rpx solid #e3eae5; border-radius: 22rpx; background: #fff; }
.quick-item { display: flex; flex: 1; align-items: center; flex-direction: column; gap: 10rpx; color: #33453b; font-size: 24rpx; }
.quick-icon { display: grid; width: 72rpx; height: 72rpx; place-items: center; border-radius: 20rpx; background: #eaf7ef; color: #12764a; font-size: 30rpx; font-weight: 800; }
.order-card { padding-top: 6rpx; padding-bottom: 6rpx; }
.order-row { display: flex; align-items: center; gap: 16rpx; min-height: 100rpx; border-top: 1rpx solid #edf2ee; }
.order-row:first-child { border-top: 0; }
.order-copy { min-width: 0; flex: 1; }
.order-no, .order-time { display: block; }
.order-no { overflow: hidden; color: #0b1a12; font-size: 26rpx; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.order-time { margin-top: 4rpx; color: #93a29a; font-size: 24rpx; }
.order-right { display: flex; align-items: flex-end; flex-direction: column; gap: 6rpx; }
.order-right .strong-copy { color: #d45b32; font-size: 28rpx; }
.empty-mini { padding: 44rpx 0; color: #94a198; font-size: 24rpx; text-align: center; }
.hero { background:#fff;color:#0b1a12;padding:24rpx; }.hero-title { color:#0b1a12; }.hero-desc { color:#718277; }.grade-tag { background:#e9f6ee;color:#12764a; }.today-row { margin-top:20rpx;padding-top:20rpx;border-color:#edf2ee; }.today-row .strong-copy { color:#143f2a;font-size:32rpx;overflow-wrap:anywhere; }.today-row text { color:#718277; }.today-row view { min-width:0; }.todo-card { padding:24rpx 20rpx; }.todo-value { font-size:48rpx; }.todo-link { display:flex;align-items:center;min-height:44px; }.quick-grid { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));padding:0;margin-top:18rpx; }.quick-item { flex-direction:row;justify-content:flex-start;padding:20rpx;min-height:64px;gap:14rpx;font-size:28rpx; }.quick-icon { width:56rpx;height:56rpx;font-size:26rpx; }.commission-grid { gap:12rpx; }.commission-grid view { min-width:0; }.commission-grid .strong-copy { font-size:28rpx;overflow-wrap:anywhere; }
</style>
