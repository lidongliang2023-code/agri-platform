<template>
  <view class="page profile-page">
    <view class="status-bar" :style="{ height: `${statusBarHeight}px` }" />
    <view class="profile-nav">
      <view class="brand"><image class="brand-mark" src="/static/fengchain.svg" mode="aspectFill" /><text>丰链云</text></view>
    </view>

    <view class="user-card">
      <view class="user-avatar">{{ userInitial }}</view>
      <view class="user-copy">
        <template v-if="session.user">
          <text class="user-name">{{ session.user.nickname || '丰链云会员' }}</text>
          <text class="user-phone">{{ maskedPhone }}</text>
          <view class="member-row">
            <text class="member-level">{{ session.user.memberLevel || '普通会员' }}</text>
            <text class="member-code">NO. {{ String(session.user.id).padStart(6, '0') }}</text>
          </view>
        </template>
        <template v-else>
          <text class="user-name">欢迎来到丰链云</text>
          <text class="user-phone">登录后同步购物车、订单和优惠券</text>
          <button class="login-button" @tap="login">统一账号登录</button>
        </template>
      </view>
    </view>

    <view v-if="session.user" class="stats-row">
      <view><text class="strong-copy">{{ session.user.points || 0 }}</text><text>积分</text></view>
      <view><text class="strong-copy">{{ money(session.user.totalConsume) }}</text><text>累计消费</text></view>
      <view @tap="goCoupons"><text class="strong-copy">{{ couponCount }}</text><text>可用优惠券</text></view>
    </view>

    <view class="panel">
      <view class="panel-head" @tap="goOrders('')">
        <text class="panel-title">我的订单</text>
        <text class="panel-link">全部订单 ›</text>
      </view>
      <view class="order-grid">
        <view v-for="entry in orderEntries" :key="entry.label" class="order-entry" @tap="entry.action()">
          <view class="order-icon">
            <text>{{ entry.icon }}</text>
            <text v-if="entry.count" class="badge">{{ entry.count > 99 ? '99+' : entry.count }}</text>
          </view>
          <text class="order-label">{{ entry.label }}</text>
        </view>
      </view>
    </view>

    <view class="panel menu-panel">
      <view class="menu-row" @tap="goAddresses">
        <view class="menu-icon">址</view>
        <view class="menu-copy"><text>收货地址</text><text class="small-copy">管理常用配送地址</text></view>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-row" @tap="goCoupons">
        <view class="menu-icon">券</view>
        <view class="menu-copy"><text>领券中心</text><text class="small-copy">优惠券、限时秒杀与社区拼团</text></view>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-row" @tap="goTrace">
        <view class="menu-icon">溯</view>
        <view class="menu-copy"><text>扫码溯源</text><text class="small-copy">查询种植、采收、质检与仓储记录</text></view>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-row" @tap="goAfterSales">
        <view class="menu-icon">售</view>
        <view class="menu-copy"><text>退款 / 售后</text><text class="small-copy">查看售后进度、填写退货物流</text></view>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <view class="panel menu-panel">
      <view class="menu-row" @tap="openNative('/pages/member/index')"><view class="menu-icon">会</view><view class="menu-copy"><text>会员中心</text></view><text class="menu-arrow">›</text></view>
      <view class="menu-row" @tap="openNative('/pages/signin/index')"><view class="menu-icon">每</view><view class="menu-copy"><text>每日签到</text></view><text class="menu-arrow">›</text></view>
      <view class="menu-row" @tap="openNative('/pages/points/index')"><view class="menu-icon">积</view><view class="menu-copy"><text>积分明细</text></view><text class="menu-arrow">›</text></view>
      <view class="menu-row" @tap="openNative('/pages/points/mall')"><view class="menu-icon">积</view><view class="menu-copy"><text>积分商城</text></view><text class="menu-arrow">›</text></view>
      <view class="menu-row" @tap="openNative('/pages/coupons/index')"><view class="menu-icon">我</view><view class="menu-copy"><text>我的优惠券</text></view><text class="menu-arrow">›</text></view>
      <view class="menu-row" @tap="openNative('/pages/favorites/index')"><view class="menu-icon">我</view><view class="menu-copy"><text>我的收藏</text></view><text class="menu-arrow">›</text></view>
      <view class="menu-row" @tap="openNative('/pages/footprints/index')"><view class="menu-icon">浏</view><view class="menu-copy"><text>浏览足迹</text></view><text class="menu-arrow">›</text></view>
      <view class="menu-row" @tap="openNative('/pages/reviews/index')"><view class="menu-icon">评</view><view class="menu-copy"><text>评价中心</text></view><text class="menu-arrow">›</text></view>
      <view class="menu-row" @tap="openNative('/pages/messages/index')"><view class="menu-icon">消</view><view class="menu-copy"><text>消息中心</text></view><text class="menu-arrow">›</text></view>
      <view class="menu-row" @tap="openNative('/pages/groups/index')"><view class="menu-icon">社</view><view class="menu-copy"><text>社区拼团</text></view><text class="menu-arrow">›</text></view>
      <view class="menu-row" @tap="openNative('/pages/groups/mine')"><view class="menu-icon">我</view><view class="menu-copy"><text>我的拼团</text></view><text class="menu-arrow">›</text></view>
      <view class="menu-row" @tap="openNative('/pages/flash/index')"><view class="menu-icon">限</view><view class="menu-copy"><text>限时秒杀</text></view><text class="menu-arrow">›</text></view>
      <view class="menu-row" @tap="openNative('/pages/security/index')"><view class="menu-icon">个</view><view class="menu-copy"><text>个人资料</text></view><text class="menu-arrow">›</text></view>
    </view>

    <button v-if="session.user" class="logout-button" @tap="logout">退出登录</button>
    <text class="version">丰链云 v1.1.0 · {{ platformName }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { mallApi } from '../../api'
import { clearSession, session } from '../../session'
import { money, toast } from '../../utils'
import { logoutUnifiedAccount } from '../../../../frontend-shared/mobile-unified-auth'

const statusBarHeight = ref(uni.getSystemInfoSync().statusBarHeight || 24)
const platform = uni.getSystemInfoSync().uniPlatform || 'web'
const userInitial = computed(() => session.user?.nickname?.slice(0, 1) || '丰')
const maskedPhone = computed(() => {
  const phone = String(session.user?.phone || '')
  if (/^1\d{10}$/.test(phone)) return `${phone.slice(0, 3)}****${phone.slice(7)}`
  return phone ? `账号 ${phone}` : '统一账号用户'
})
const platformName = computed(() => {
  if (platform === 'mp-weixin') return '微信小程序'
  if (platform === 'app') return 'APP'
  return 'H5'
})

const counts = ref<Record<string, number>>({})
const afterSaleCount = ref(0)
const couponCount = ref(0)

const orderEntries = computed(() => [
  { label: '待付款', icon: '付', count: counts.value.PENDING_PAY || 0, action: () => goOrders('PENDING_PAY') },
  { label: '待发货', icon: '发', count: counts.value.PENDING_SHIP || 0, action: () => goOrders('PENDING_SHIP') },
  { label: '待收货', icon: '收', count: (counts.value.SHIPPED || 0) + (counts.value.PENDING_RECEIVE || 0), action: () => goOrders('SHIPPED') },
  { label: '已完成', icon: '完', count: 0, action: () => goOrders('COMPLETED') },
  { label: '退款/售后', icon: '售', count: afterSaleCount.value, action: goAfterSales },
])

onShow(loadSummary)

async function loadSummary() {
  if (!session.user) {
    counts.value = {}
    afterSaleCount.value = 0
    couponCount.value = 0
    return
  }
  // 角标只是提示，任何一项失败都不影响页面使用
  const [orders, afterSales, coupons] = await Promise.all([
    mallApi.getOrders({ consumerId: session.user.id, page: 1, size: 50 }).catch(() => null),
    mallApi.getAfterSales().catch(() => []),
    mallApi.getCoupons(session.user.id).catch(() => []),
  ])
  const next: Record<string, number> = {}
  for (const order of orders?.records || []) next[order.status] = (next[order.status] || 0) + 1
  counts.value = next
  afterSaleCount.value = afterSales.filter((item) => ['PENDING', 'RETURNING'].includes(item.status)).length
  couponCount.value = coupons.filter((item) => String(item.status || '').toUpperCase() === 'UNUSED').length
}

function openNative(url: string) { if (requireLogin()) uni.navigateTo({url}) }

function login() {
  uni.navigateTo({ url: '/pages/login/index?redirect=%2Fpages%2Fprofile%2Findex' })
}

function requireLogin() {
  if (session.user) return true
  login()
  return false
}

function goOrders(status: string) {
  if (requireLogin()) uni.navigateTo({ url: `/pages/orders/index${status ? `?status=${status}` : ''}` })
}

function goAddresses() {
  if (requireLogin()) uni.navigateTo({ url: '/pages/addresses/index' })
}

function goAfterSales() {
  if (requireLogin()) uni.navigateTo({ url: '/pages/aftersale/index' })
}

function goCoupons() {
  uni.navigateTo({ url: '/pages/services/index' })
}

function goTrace() {
  // 扫码溯源不需要登录
  uni.navigateTo({ url: '/pages/services/index?tab=trace' })
}

function logout() {
  uni.showModal({
    title: '退出登录',
    content: '退出后仍可浏览商品，购物车和订单需重新登录查看。',
    async success(result) {
      if (!result.confirm) return
      if (!await logoutUnifiedAccount()) return
      clearSession()
      toast('已退出登录', 'success')
      uni.reLaunch({ url: '/pages/login/index' })
    },
  })
}
</script>

<style scoped lang="scss">
.profile-page {
  padding-bottom: 40rpx;
}

.profile-nav {
  display: flex;
  height: 88rpx;
  align-items: center;
  padding: 0 24rpx;
  background: #fff;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12rpx;
  color: #0b1a12;
  font-size: 28rpx;
  font-weight: 700;
}

.brand-mark {
  width: 52rpx;
  height: 52rpx;
  border-radius: 15rpx;
}

.user-card {
  display: flex;
  min-height: 240rpx;
  align-items: center;
  gap: 24rpx;
  margin: 22rpx;
  padding: 32rpx;
  overflow: hidden;
  border-radius: 28rpx;
  background:
    radial-gradient(circle at 88% 0, rgba(110, 231, 162, 0.2), transparent 40%),
    linear-gradient(135deg, #073821, #12764a);
  color: #fff;
}

.user-avatar {
  display: grid;
  width: 118rpx;
  height: 118rpx;
  flex: 0 0 118rpx;
  place-items: center;
  border: 3rpx solid rgba(255, 255, 255, 0.36);
  border-radius: 35rpx;
  background: rgba(255, 255, 255, 0.12);
  font-size: 49rpx;
  font-weight: 800;
}

.user-copy {
  min-width: 0;
  flex: 1;
}

.user-name,
.user-phone {
  display: block;
}

.user-name {
  font-size: 34rpx;
  font-weight: 800;
}

.user-phone {
  margin-top: 7rpx;
  color: rgba(255, 255, 255, 0.7);
  font-size: 24rpx;
}

.member-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 15rpx;
}

.member-level {
  padding: 5rpx 13rpx;
  border-radius: 999rpx;
  background: rgba(159, 231, 184, 0.16);
  color: #c9f2d7;
  font-size: 24rpx;
}

.member-code {
  color: rgba(255, 255, 255, 0.5);
  font-size: 24rpx;
  letter-spacing: 1rpx;
}

.login-button {
  width: 240rpx;
  height: 68rpx;
  margin-top: 18rpx;
  border-radius: 14rpx;
  background: #fff;
  color: #0e5233;
  font-size: 26rpx;
  font-weight: 700;
  line-height: 68rpx;
}

.stats-row {
  display: flex;
  margin: 0 22rpx 18rpx;
  padding: 24rpx 0;
  border: 1rpx solid #e3eae5;
  border-radius: 22rpx;
  background: #fff;
}

.stats-row > view {
  flex: 1;
  border-left: 1rpx solid #edf2ee;
  text-align: center;
}

.stats-row > view:first-child {
  border-left: 0;
}

.stats-row .strong-copy,
.stats-row text {
  display: block;
}

.stats-row .strong-copy {
  color: #0e5233;
  font-size: 30rpx;
  font-weight: 800;
}

.stats-row text {
  margin-top: 6rpx;
  color: #666666;
  font-size: 24rpx;
}

.panel {
  margin: 0 22rpx 18rpx;
  overflow: hidden;
  border: 1rpx solid #e3eae5;
  border-radius: 22rpx;
  background: #fff;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 24rpx 8rpx;
}

.panel-title {
  color: #0b1a12;
  font-size: 30rpx;
  font-weight: 700;
}

.panel-link {
  color: #666666;
  font-size: 24rpx;
}

.order-grid {
  display: flex;
  padding: 12rpx 8rpx 24rpx;
}

.order-entry {
  display: flex;
  flex: 1;
  align-items: center;
  flex-direction: column;
  gap: 10rpx;
  min-height: 120rpx;
  justify-content: center;
}

.order-icon {
  position: relative;
  display: grid;
  width: 64rpx;
  height: 64rpx;
  place-items: center;
  border-radius: 18rpx;
  background: #eaf7ef;
  color: #12764a;
  font-size: 28rpx;
  font-weight: 800;
}

.badge {
  position: absolute;
  top: -12rpx;
  right: -18rpx;
  min-width: 32rpx;
  height: 32rpx;
  padding: 0 8rpx;
  border-radius: 16rpx;
  background: #d45b32;
  color: #fff;
  font-size: 24rpx;
  font-weight: 700;
  line-height: 32rpx;
  text-align: center;
}

.order-label {
  color: #33453b;
  font-size: 24rpx;
}

.menu-row {
  display: flex;
  align-items: center;
  gap: 18rpx;
  min-height: 112rpx;
  padding: 16rpx 24rpx;
  border-top: 1rpx solid #edf2ee;
}

.menu-row:first-child {
  border-top: 0;
}

.menu-icon {
  display: grid;
  width: 58rpx;
  height: 58rpx;
  flex: 0 0 58rpx;
  place-items: center;
  border-radius: 16rpx;
  background: #eaf7ef;
  color: #12764a;
  font-size: 26rpx;
  font-weight: 800;
}

.menu-copy {
  min-width: 0;
  flex: 1;
}

.menu-copy text,
.menu-copy .small-copy {
  display: block;
}

.menu-copy text {
  color: #0b1a12;
  font-size: 28rpx;
  font-weight: 650;
}

.menu-copy .small-copy {
  margin-top: 5rpx;
  color: #666666;
  font-size: 24rpx;
}

.menu-arrow {
  color: #a1ada6;
  font-size: 38rpx;
}

.logout-button {
  height: 84rpx;
  margin: 28rpx 22rpx 0;
  border: 1rpx solid #efcccc;
  border-radius: 18rpx;
  background: #fff;
  color: #b71c1c;
  font-size: 28rpx;
  line-height: 82rpx;
}

.version {
  display: block;
  margin: 28rpx 0 10rpx;
  color: #666666;
  font-size: 24rpx;
  text-align: center;
}

/* 2026-11-20：逐页实测控件的48px触控区。 */
.stats-row > view { min-height:48px; }
</style>
