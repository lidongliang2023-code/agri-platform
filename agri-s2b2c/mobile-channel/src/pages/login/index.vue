<template>
  <view class="login-page">
    <view class="status-bar" :style="{ height: `${statusBarHeight}px` }" />
    <view class="login-nav"><text class="back" @tap="goBack">‹</text><text>商家登录</text><text class="nav-space" /></view>
    <view class="login-content">
      <image class="brand-mark" src="/static/fengchain.svg" mode="aspectFill" />
      <text class="login-title">丰链云</text>
      <text class="login-desc">选品、分销、佣金与客户经营</text>
      <view class="login-card">
        <text class="form-title">统一账号登录</text>
        <text class="form-desc">使用丰链云统一用户名和密码进入商家工作台</text>
        <view class="input-box"><text class="prefix">用</text><input v-model="username" placeholder="请输入统一账号用户名" /></view>
        <view class="input-box"><text class="prefix">密</text><input v-model="password" password placeholder="请输入密码" /></view>
        <button class="login-button" :loading="submitting" @tap="submit">进入工作台</button>
        <text class="login-note">登录后自动校验商家角色权限</text>
      </view>
      <view class="trust-row"><view><b>灵活选品</b><text>平台好货直供</text></view><view><b>佣金透明</b><text>结算进度可见</text></view><view><b>多端部署</b><text>小程序与APP</text></view></view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { clearChannelSession, leaveChannelLogin, saveChannelSession } from '../../session'
import { channelApi } from '../../api'
import { toast } from '../../utils'
import { loginWithUnifiedAccount } from '../../../../frontend-shared/mobile-unified-auth'

const statusBarHeight = ref(uni.getSystemInfoSync().statusBarHeight || 24)
const username = ref('')
const password = ref('')
const submitting = ref(false)

async function submit() {
  if (!username.value.trim()) return toast('请输入统一账号用户名')
  if (!password.value) return toast('请输入密码')
  submitting.value = true
  try {
    const result = await loginWithUnifiedAccount(
      username.value.trim(),
      password.value,
      's2b2c:channel',
    )
    const profile = await channelApi.getProfile()
    if (!profile.applied || !profile.id) throw new Error('当前账号尚未入驻渠道，请先在商家网页端提交入驻申请')
    if (profile.auditStatus?.toUpperCase() !== 'APPROVED') {
      throw new Error('渠道资质尚未通过审核，通过后才能进入工作台')
    }
    saveChannelSession({
      id: profile.id,
      shopName: profile.shopName,
      phone: result.user.username,
      username: result.user.username,
      nickname: result.user.nickname,
      unifiedUserId: result.user.id,
    })
    toast('登录成功', 'success')
    setTimeout(() => {
      leaveChannelLogin()
    }, 300)
  } catch (error) {
    clearChannelSession()
    toast((error as Error).message)
  } finally {
    submitting.value = false
  }
}

function goBack() {
  const pages = getCurrentPages()
  if (pages.length > 1) uni.navigateBack()
  else uni.switchTab({ url: '/pages/home/index' })
}
</script>

<style scoped lang="scss">
.login-page{min-height:100vh;background:radial-gradient(circle at 82% 8%,rgba(110,231,162,.2),transparent 42%),linear-gradient(145deg,#06281a,#0d5d3b);color:#fff}
.login-page .status-bar{background:transparent}.login-nav{display:flex;height:86rpx;align-items:center;justify-content:space-between;padding:0 24rpx;font-size:25rpx;font-weight:700}.back,.nav-space{width:70rpx;font-size:48rpx}
.login-content{display:flex;align-items:center;flex-direction:column;padding:58rpx 32rpx 30rpx}.brand-mark{display:grid;width:92rpx;height:92rpx;place-items:center;border-radius:25rpx;background:linear-gradient(145deg,#159a5e,#12764a);font-size:42rpx;font-weight:800;box-shadow:0 15rpx 36rpx rgba(4,31,20,.24)}
.login-title{margin-top:22rpx;font-size:37rpx;font-weight:800}.login-desc{margin-top:8rpx;color:rgba(255,255,255,.58);font-size:24rpx}.login-card{width:100%;margin-top:44rpx;padding:30rpx;border:1rpx solid rgba(255,255,255,.55);border-radius:27rpx;background:#fff;color:#0b1a12;box-shadow:0 24rpx 60rpx rgba(4,31,20,.2)}
.form-title,.form-desc{display:block}.form-title{font-size:30rpx;font-weight:800}.form-desc{margin-top:7rpx;color:#84938a;font-size:24rpx}.input-box{display:flex;height:82rpx;align-items:center;margin-top:18rpx;overflow:hidden;border:1rpx solid #dfe8e2;border-radius:15rpx;background:#fbfdfb}.prefix{width:74rpx;border-right:1rpx solid #e3eae5;color:#52665a;font-size:24rpx;text-align:center}.input-box input{flex:1;padding:0 18rpx;font-size:25rpx}
.login-button{height:82rpx;margin-top:22rpx;border-radius:16rpx;background:linear-gradient(135deg,#159a5e,#12764a);color:#fff;font-size:25rpx;font-weight:700;line-height:82rpx}.login-note{display:block;margin-top:16rpx;color:#93a29a;font-size:24rpx;text-align:center}
.trust-row{display:flex;width:100%;margin-top:36rpx}.trust-row view{flex:1;text-align:center}.trust-row b,.trust-row text{display:block}.trust-row b{color:rgba(255,255,255,.82);font-size:24rpx}.trust-row text{margin-top:5rpx;color:rgba(255,255,255,.42);font-size:24rpx}
</style>
