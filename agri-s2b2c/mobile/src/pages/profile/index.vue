<template>
  <view class="page profile-page">
    <view class="status-bar" :style="{ height: `${statusBarHeight}px` }" />
    <view class="profile-nav">
      <view class="brand"><view class="brand-mark">丰</view><text>丰链云 · 农联优选</text></view>
      <text class="platform">{{ platformName }}</text>
    </view>

    <view class="user-card">
      <view class="user-avatar">{{ userInitial }}</view>
      <view class="user-copy">
        <template v-if="session.user">
          <text class="user-name">{{ session.user.nickname || '农联优选会员' }}</text>
          <text class="user-phone">{{ maskedPhone }}</text>
          <view class="member-row">
            <text class="member-level">{{ session.user.memberLevel || '普通会员' }}</text>
            <text class="member-code">NO. {{ String(session.user.id).padStart(6, '0') }}</text>
          </view>
        </template>
        <template v-else>
          <text class="user-name">欢迎来到丰链云</text>
          <text class="user-phone">登录后同步购物车和订单</text>
          <button class="login-button" @tap="login">统一账号登录</button>
        </template>
      </view>
    </view>

    <view class="stats-row">
      <view><b>{{ session.user?.points || 0 }}</b><text>积分</text></view>
      <view><b>{{ money(session.user?.totalConsume) }}</b><text>累计消费</text></view>
      <view><b>品质</b><text>会员等级</text></view>
    </view>

    <view class="section-label"><text>MY SERVICE</text><b>我的服务</b></view>
    <view class="menu-card">
      <view class="menu-row" @tap="goOrders">
        <view class="menu-icon">单</view>
        <view class="menu-copy"><text>我的订单</text><small>查看付款、发货与收货状态</small></view>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-row" @tap="goAddresses">
        <view class="menu-icon">址</view>
        <view class="menu-copy"><text>收货地址</text><small>管理常用配送地址</small></view>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-row" @tap="openServices">
        <view class="menu-icon">券</view>
        <view class="menu-copy"><text>营销与服务</text><small>优惠券、溯源与售后服务</small></view>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-row" @tap="goCart">
        <view class="menu-icon">袋</view>
        <view class="menu-copy"><text>购物车</text><small>继续挑选产地好货</small></view>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <view class="section-label"><text>MULTI PLATFORM</text><b>多端服务</b></view>
    <view class="platform-card">
      <view class="platform-copy">
        <text class="platform-title">一套业务，多端部署</text>
        <text class="platform-desc">当前移动应用支持微信小程序、Android / iOS App 与 H5。</text>
      </view>
      <view class="platform-tags">
        <text class="tag tag-green">小程序</text>
        <text class="tag tag-blue">APP</text>
        <text class="tag tag-gray">H5</text>
      </view>
    </view>

    <button v-if="session.user" class="logout-button" @tap="logout">退出登录</button>
    <text class="version">丰链云优选 v1.0.0</text>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { clearSession, session } from '../../session'
import { money, toast } from '../../utils'
import { logoutUnifiedAccount } from '../../../../frontend-shared/mobile-unified-auth'

const statusBarHeight = ref(uni.getSystemInfoSync().statusBarHeight || 24)
const platform = uni.getSystemInfoSync().uniPlatform || 'web'
const userInitial = computed(() => session.user?.nickname?.slice(0, 1) || '丰')
const maskedPhone = computed(() => session.user?.nickname || session.user?.phone || '统一账号用户')
const platformName = computed(() => {
  if (platform === 'mp-weixin') return '微信小程序'
  if (platform === 'app') return 'APP'
  return 'H5'
})

function login() {
  uni.navigateTo({ url: '/pages/login/index?redirect=%2Fpages%2Fprofile%2Findex' })
}

function requireLogin() {
  if (session.user) return true
  login()
  return false
}

function goOrders() {
  if (requireLogin()) uni.navigateTo({ url: '/pages/orders/index' })
}

function goAddresses() {
  if (requireLogin()) uni.navigateTo({ url: '/pages/addresses/index' })
}

function goCart() {
  uni.switchTab({ url: '/pages/cart/index' })
}

function openServices() {
  uni.navigateTo({ url: '/pages/services/index' })
}

function logout() {
  uni.showModal({
    title: '退出登录',
    content: '退出后仍可浏览商品，购物车和订单需重新登录查看。',
    async success(result) {
      if (!result.confirm) return
      await logoutUnifiedAccount()
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
  height: 94rpx;
  align-items: center;
  justify-content: space-between;
  padding: 0 24rpx;
  border-bottom: 1rpx solid #e6ede8;
  background: #fff;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12rpx;
  color: #0b1a12;
  font-size: 26rpx;
  font-weight: 700;
}

.brand-mark {
  display: grid;
  width: 52rpx;
  height: 52rpx;
  place-items: center;
  border-radius: 15rpx;
  background: linear-gradient(145deg, #159a5e, #12764a);
  color: #fff;
  font-size: 25rpx;
  font-weight: 800;
}

.platform {
  padding: 7rpx 13rpx;
  border: 1rpx solid #dce7df;
  border-radius: 999rpx;
  color: #718277;
  font-size: 17rpx;
}

.user-card {
  display: flex;
  min-height: 280rpx;
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
  color: rgba(255, 255, 255, 0.66);
  font-size: 20rpx;
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
  font-size: 17rpx;
}

.member-code {
  color: rgba(255, 255, 255, 0.42);
  font-size: 16rpx;
  letter-spacing: 1rpx;
}

.login-button {
  width: 230rpx;
  height: 62rpx;
  margin-top: 18rpx;
  border-radius: 14rpx;
  background: #fff;
  color: #0e5233;
  font-size: 21rpx;
  font-weight: 700;
  line-height: 62rpx;
}

.stats-row {
  display: flex;
  margin: 0 22rpx;
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

.stats-row b,
.stats-row text {
  display: block;
}

.stats-row b {
  color: #0e5233;
  font-size: 27rpx;
  font-weight: 800;
}

.stats-row text {
  margin-top: 6rpx;
  color: #84938a;
  font-size: 18rpx;
}

.section-label {
  margin: 32rpx 24rpx 13rpx;
}

.section-label text,
.section-label b {
  display: block;
}

.section-label text {
  color: #12764a;
  font-size: 16rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
}

.section-label b {
  margin-top: 4rpx;
  color: #0b1a12;
  font-size: 30rpx;
}

.menu-card {
  margin: 0 22rpx;
  overflow: hidden;
  border: 1rpx solid #e3eae5;
  border-radius: 22rpx;
  background: #fff;
}

.menu-row {
  display: flex;
  align-items: center;
  gap: 15rpx;
  min-height: 105rpx;
  padding: 16rpx 22rpx;
  border-top: 1rpx solid #edf2ee;
}

.menu-row:first-child {
  border-top: 0;
}

.menu-icon {
  display: grid;
  width: 54rpx;
  height: 54rpx;
  flex: 0 0 54rpx;
  place-items: center;
  border-radius: 15rpx;
  background: #eaf7ef;
  color: #12764a;
  font-size: 21rpx;
  font-weight: 800;
}

.menu-copy {
  min-width: 0;
  flex: 1;
}

.menu-copy text,
.menu-copy small {
  display: block;
}

.menu-copy text {
  color: #0b1a12;
  font-size: 24rpx;
  font-weight: 650;
}

.menu-copy small {
  margin-top: 5rpx;
  color: #93a29a;
  font-size: 18rpx;
}

.menu-arrow {
  color: #a1ada6;
  font-size: 38rpx;
}

.platform-card {
  margin: 0 22rpx;
  padding: 24rpx;
  border: 1rpx solid #dcebe2;
  border-radius: 22rpx;
  background: #f5fbf7;
}

.platform-title,
.platform-desc {
  display: block;
}

.platform-title {
  color: #0e5233;
  font-size: 24rpx;
  font-weight: 700;
}

.platform-desc {
  margin-top: 8rpx;
  color: #718277;
  font-size: 19rpx;
  line-height: 1.55;
}

.platform-tags {
  display: flex;
  gap: 9rpx;
  margin-top: 16rpx;
}

.logout-button {
  height: 76rpx;
  margin: 28rpx 22rpx 0;
  border: 1rpx solid #efcccc;
  border-radius: 18rpx;
  background: #fff;
  color: #c54b4b;
  font-size: 23rpx;
  line-height: 74rpx;
}

.version {
  display: block;
  margin: 28rpx 0 10rpx;
  color: #a4aea8;
  font-size: 17rpx;
  text-align: center;
}
</style>
