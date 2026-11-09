<template>
  <view class="login-page">
    <view class="status-bar" :style="{ height: `${statusBarHeight}px` }" />
    <view class="login-nav">
      <text class="back" @tap="goBack">‹</text>
      <text class="nav-title">统一登录</text>
      <text class="nav-right" />
    </view>

    <view class="login-content">
      <image class="brand-mark" src="/static/fengchain.svg" mode="aspectFill" />
      <text class="login-title">丰链云</text>
      <text class="login-subtitle">产地好货，从田间直达餐桌</text>

      <view class="login-card">
        <text class="form-title">统一账号登录</text>
        <text class="form-desc">使用丰链云统一用户名和密码，无需单独注册商城账号</text>
        <view class="phone-field">
          <text class="phone-prefix">用</text>
          <input
            v-model="username"
            placeholder="请输入统一账号用户名"
            confirm-type="done"
          />
        </view>
        <view class="phone-field">
          <text class="phone-prefix">密</text>
          <input v-model="password" password placeholder="请输入统一账号密码" confirm-type="done" @confirm="submit" />
        </view>
        <button class="login-button" :loading="submitting" @tap="submit">统一账号登录</button>
      </view>

      <view class="trust-row">
        <view><b>品质溯源</b><text>全流程记录</text></view>
        <view><b>平台担保</b><text>交易售后无忧</text></view>
        <view><b>多端同步</b><text>小程序与APP</text></view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { clearSession, leaveLoginPage, saveSession } from '../../session'
import { mallApi } from '../../api'
import { toast } from '../../utils'
import { loginWithUnifiedAccount } from '../../../../frontend-shared/mobile-unified-auth'

const statusBarHeight = ref(uni.getSystemInfoSync().statusBarHeight || 24)
const username = ref('')
const password = ref('')
const submitting = ref(false)
const redirect = ref('')

onLoad((options) => {
  redirect.value = String(options?.redirect || '')
})

async function submit() {
  if (!username.value.trim()) return toast('请输入统一账号用户名')
  if (!password.value) return toast('请输入统一账号密码')
  submitting.value = true
  try {
    await loginWithUnifiedAccount(
      username.value.trim(),
      password.value,
      's2b2c:consumer',
    )
    const profile = await mallApi.getProfile()
    if (!profile?.id) throw new Error('未能获取当前消费者档案，请重新登录')
    saveSession(profile)
    toast('登录成功', 'success')
    setTimeout(() => leaveLoginPage(redirect.value), 300)
  } catch (error) {
    clearSession()
    toast((error as Error).message)
  } finally {
    submitting.value = false
  }
}

function goBack() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: '/pages/profile/index' })
  }
}
</script>

<style scoped lang="scss">
.login-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at 80% 12%, rgba(110, 231, 162, 0.2), transparent 42%),
    linear-gradient(145deg, #06281a, #0d5d3b);
  color: #fff;
}

.login-page .status-bar {
  background: transparent;
}

.login-nav {
  display: flex;
  height: 88rpx;
  align-items: center;
  justify-content: space-between;
  padding: 0 26rpx;
}

.back,
.nav-right {
  width: 70rpx;
  font-size: 50rpx;
  line-height: 1;
}

.nav-title {
  font-size: 26rpx;
  font-weight: 700;
}

.login-content {
  display: flex;
  align-items: center;
  flex-direction: column;
  padding: 60rpx 34rpx 40rpx;
}

.brand-mark {
  display: grid;
  width: 92rpx;
  height: 92rpx;
  place-items: center;
  border-radius: 26rpx;
  background: linear-gradient(145deg, #159a5e, #12764a);
  color: #fff;
  font-size: 44rpx;
  font-weight: 800;
  box-shadow: 0 16rpx 38rpx rgba(4, 31, 20, 0.25);
}

.login-title {
  margin-top: 24rpx;
  font-size: 38rpx;
  font-weight: 800;
}

.login-subtitle {
  margin-top: 9rpx;
  color: rgba(255, 255, 255, 0.58);
  font-size: 24rpx;
}

.login-card {
  width: 100%;
  margin-top: 48rpx;
  padding: 32rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.58);
  border-radius: 28rpx;
  background: #fff;
  color: #0b1a12;
  box-shadow: 0 24rpx 60rpx rgba(4, 31, 20, 0.22);
}

.form-title,
.form-desc {
  display: block;
}

.form-title {
  font-size: 31rpx;
  font-weight: 800;
}

.form-desc {
  margin-top: 7rpx;
  color: #84938a;
  font-size: 24rpx;
}

.phone-field {
  display: flex;
  height: 86rpx;
  align-items: center;
  margin-top: 28rpx;
  border: 1rpx solid #dfe8e2;
  border-radius: 16rpx;
  background: #fbfdfb;
}

.phone-prefix {
  padding: 0 20rpx;
  border-right: 1rpx solid #e3eae5;
  color: #52665a;
  font-size: 24rpx;
}

.phone-field input {
  flex: 1;
  padding: 0 20rpx;
  font-size: 27rpx;
}

.login-button {
  height: 84rpx;
  margin-top: 20rpx;
  border-radius: 16rpx;
  background: linear-gradient(135deg, #159a5e, #12764a);
  color: #fff;
  font-size: 26rpx;
  font-weight: 700;
  line-height: 84rpx;
  box-shadow: 0 10rpx 26rpx rgba(18, 118, 74, 0.18);
}

.agreement {
  display: flex;
  align-items: flex-start;
  gap: 9rpx;
  margin-top: 20rpx;
  color: #84938a;
  font-size: 24rpx;
  line-height: 1.5;
}

.agreement-check {
  display: grid;
  width: 28rpx;
  height: 28rpx;
  flex: 0 0 28rpx;
  place-items: center;
  margin-top: 1rpx;
  border: 1rpx solid #cbd7cf;
  border-radius: 7rpx;
  color: #fff;
  font-size: 24rpx;
}

.agreement-check.checked {
  border-color: #12764a;
  background: #12764a;
}

.trust-row {
  display: flex;
  width: 100%;
  margin-top: 42rpx;
}

.trust-row > view {
  flex: 1;
  text-align: center;
}

.trust-row b,
.trust-row text {
  display: block;
}

.trust-row b {
  color: rgba(255, 255, 255, 0.82);
  font-size: 24rpx;
}

.trust-row text {
  margin-top: 5rpx;
  color: rgba(255, 255, 255, 0.42);
  font-size: 24rpx;
}
</style>
