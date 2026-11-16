<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getTradeStatusBarHeight, getTradeUser, getTradeToken, getTradeRole, setTradeRole, logoutTrade, type TradeRole } from '../../auth'

import { buyerMenu, sellerMenu } from '../../business'

const statusBarHeight = ref(getTradeStatusBarHeight())
const account = ref(getTradeUser())
const displayName = computed(() => account.value?.nickname || account.value?.username || '未登录')

const role = ref(getTradeRole())
const loggedIn = ref(!!getTradeToken())
const centerName = computed(() => role.value === 'buyer' ? '买家中心' : '卖家中心')
const menu = computed(() => role.value === 'buyer' ? buyerMenu : sellerMenu)
const groups = computed(() => [
  { title: centerName.value, items: menu.value.map(([key, label]) => ({ key, label })) },
  { title: '账户', items: [{ key: 'identity', label: '经营主体与资质' }] },
])
onShow(() => {
  role.value = getTradeRole()
  loggedIn.value = !!getTradeToken()
  account.value = loggedIn.value ? getTradeUser() : null
})
function switchRole(value: TradeRole) {
  if (role.value === value) return
  setTradeRole(value)
  role.value = value
  uni.showToast({ title: `已切换到${centerName.value}`, icon: 'none' })
}
function open(key: string) {
  // 先进入目标页，由目标页保存登录返回位置，确保登录后仍在选定中心。
  uni.navigateTo({ url: `/pages/business/index?key=${key}&role=${role.value}` })
}
function enterCenter() {
  uni.navigateTo({ url: `/pages/workspace/index?role=${role.value}` })
}
function logout() {
  uni.showModal({
    title: '退出登录',
    content: '确定退出交易撮合移动端吗？',
    success(result) { if (result.confirm) void logoutTrade() },
  })
}
</script>

<template>
  <view class="page flush">
    <view class="hero" :style="{ paddingTop: `${statusBarHeight + 12}px` }">
      <text class="nav-title">我的</text>
      <view class="account-row">
        <view class="avatar">{{ displayName.slice(0, 1) }}</view>
        <view class="grow">
          <text class="name ellipsis">{{ displayName }}</text>
          <text class="account ellipsis">{{ loggedIn ? `统一账号 · ${account?.username || ''}` : '登录后办理当前中心业务' }}</text>
          <text v-if="loggedIn" class="verified">{{ centerName }} · 统一账号已登录</text>
        </view>
      </view>
    </view>

    <view class="pad body">
      <view class="center-card">
        <view class="center-switch">
          <button class="center-option" :class="{ active: role === 'buyer' }" @tap="switchRole('buyer')"><text class="center-label">买家中心</text><text class="center-desc">采购 · 询价 · 收货</text></button>
          <button class="center-option" :class="{ active: role === 'seller' }" @tap="switchRole('seller')"><text class="center-label">卖家中心</text><text class="center-desc">商品 · 报价 · 发货</text></button>
        </view>
        <text class="center-hint">{{ role === 'buyer' ? '当前展示采购业务，可切换到卖家中心管理供货。' : '当前展示供货业务，可切换到买家中心办理采购。' }}</text>
        <button class="btn btn-primary btn-block" @tap="enterCenter">{{ loggedIn ? `进入${centerName}` : `登录并进入${centerName}` }}</button>
      </view>
      <view v-for="group in groups" :key="group.title" class="group">
        <text class="group-title">{{ group.title }}</text>
        <view class="menu-list">
          <view v-for="item in group.items" :key="item.label" class="menu-row" @tap="open(item.key)">
            <view class="entry-icon">{{ item.label.slice(0, 1) }}</view>
            <view class="menu-text"><text class="menu-label">{{ item.label }}</text></view>
            <text class="arrow">›</text>
          </view>
        </view>
      </view>
      <button v-if="loggedIn" class="btn btn-block logout" @tap="logout">退出统一登录</button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.hero { padding: 0 32rpx 72rpx; background: radial-gradient(circle at 85% 0, rgba(82, 204, 134, .23), transparent 390rpx), linear-gradient(150deg, #073821, #0f6440); color: #fff; }
.nav-title { display: flex; height: 88rpx; align-items: center; font-size: 32rpx; font-weight: 700; }
.account-row { display: flex; align-items: center; gap: 24rpx; margin-top: 16rpx; }
.avatar { display: flex; width: 120rpx; height: 120rpx; flex-shrink: 0; align-items: center; justify-content: center; border: 6rpx solid rgba(255, 255, 255, .18); border-radius: 50%; background: linear-gradient(135deg, #26a96a, #12764a); font-size: 44rpx; font-weight: 700; }
.name { display: block; font-size: 36rpx; font-weight: 700; }
.account { display: block; margin-top: 4rpx; color: rgba(255, 255, 255, .7); font-size: 24rpx; }
.verified { display: inline-flex; margin-top: 12rpx; padding: 4rpx 16rpx; border-radius: 20rpx; background: rgba(255, 255, 255, .12); color: #a9e7c1; font-size: 24rpx; }
.body { position: relative; margin-top: -40rpx; }
.group { margin-bottom: 24rpx; }
.group-title { display: block; margin: 0 8rpx 12rpx; color: var(--c-text-3); font-size: 24rpx; }
.center-card { margin-bottom: 28rpx; padding: 24rpx; border-radius: 24rpx; background: #fff; }
.center-switch { display: flex; gap: 16rpx; }
.center-option { flex: 1; min-width: 0; min-height: 112rpx; padding: 20rpx 12rpx; border: 2rpx solid #e3ebe6; border-radius: 18rpx; background: #f6f8f6; color: var(--c-text-3); line-height: 1.5; }
.center-option.active { border-color: var(--c-primary); background: #e6f5ed; color: var(--c-primary); }
.center-label, .center-desc { display: block; }
.center-label { font-size: 30rpx; font-weight: 700; }
.center-desc { margin-top: 4rpx; font-size: 24rpx; }
.center-hint { display: block; margin: 20rpx 0; color: var(--c-text-3); font-size: 24rpx; line-height: 1.6; }
.menu-text { display: flex; flex-direction: column; justify-content: center; }
.menu-label { font-size: 28rpx; }
.logout { margin-top: 8rpx; background: #fff; color: var(--c-danger); }
</style>
