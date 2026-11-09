<script setup lang="ts">
import { ref } from 'vue'
import { getTradeUser, logoutTrade } from '../../auth'

const statusBarHeight = ref(Number(uni.getSystemInfoSync().statusBarHeight || 0))
const account = getTradeUser()
const displayName = account?.nickname || account?.username || '平台用户'

function publish() { uni.navigateTo({ url: '/pages/publish-demand/index' }) }
function orders() { uni.switchTab({ url: '/pages/orders/index' }) }
function toMarket() { uni.switchTab({ url: '/pages/products/index' }) }
function logout() {
  uni.showModal({
    title: '退出登录',
    content: '确定退出交易撮合移动端吗？',
    success(result) {
      if (result.confirm) void logoutTrade()
    },
  })
}
</script>

<template>
  <view class="page">
    <view class="hero" :style="{ paddingTop: `${statusBarHeight + 20}px` }">
      <text class="page-title">我的交易账户</text>
      <view class="avatar">{{ displayName.slice(0, 1) }}</view>
      <text class="name">{{ displayName }}</text>
      <text class="account">统一账号 · {{ account?.username || '' }}</text>
      <text class="verified">✓ 平台统一身份已生效</text>
    </view>
    <view class="pad">
      <view class="menu">
        <view @tap="orders"><text class="icon">单</text><b>我的交易订单</b><text>›</text></view>
        <view @tap="publish"><text class="icon">求</text><b>发布采购需求</b><text>›</text></view>
        <view @tap="toMarket"><text class="icon">货</text><b>浏览交易大厅</b><text>›</text></view>
      </view>
      <view class="menu">
        <view><text class="icon">证</text><b>经营主体与资质</b><text>›</text></view>
        <view><text class="icon">设</text><b>设置</b><text>›</text></view>
        <view @tap="logout"><text class="icon">退</text><b>退出统一登录</b><text>›</text></view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.hero { display: flex; align-items: center; flex-direction: column; padding: 0 28rpx 42rpx; border-radius: 0 0 38rpx 38rpx; background: radial-gradient(circle at 85% 0,rgba(82,204,134,.23),transparent 390rpx),linear-gradient(145deg,#073821,#0d5a3a); color: #fff; }
.page-title { align-self: stretch; margin-bottom: 20rpx; font-size: 31rpx; font-weight: 700; }
.avatar { display: grid; width: 120rpx; height: 120rpx; place-items: center; border: 6rpx solid rgba(255,255,255,.16); border-radius: 50%; background: linear-gradient(135deg,#26a96a,#12764a); font-size: 42rpx; font-weight: 750; }
.name { margin-top: 14rpx; font-size: 34rpx; font-weight: 700; }
.account { margin-top: 6rpx; color: rgba(255,255,255,.55); font-size: 24rpx; }
.verified { margin-top: 12rpx; padding: 6rpx 14rpx; border-radius: 18rpx; background: rgba(255,255,255,.1); color: #a9e7c1; font-size: 24rpx; }
.pad { margin-top: -20rpx; position: relative; padding: 0 24rpx; }
.menu { margin-bottom: 16rpx; overflow: hidden; border: 1rpx solid #e1e9e3; border-radius: 21rpx; background: #fff; }
.menu view { display: flex; min-height: 90rpx; align-items: center; gap: 14rpx; padding: 12rpx 20rpx; border-bottom: 1rpx solid #edf2ee; }
.menu view:last-child { border-bottom: 0; }
.icon { display: grid; width: 52rpx; height: 52rpx; place-items: center; border-radius: 14rpx; background: #edf8f2; color: #12764a; font-size: 24rpx; font-weight: 750; }
.menu b { flex: 1; font-size: 24rpx; }
.menu view > text:last-child { color: #94a198; font-size: 30rpx; }
</style>
