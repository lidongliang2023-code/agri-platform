<script setup lang="ts">
import { ref } from 'vue'
import { loginTrade } from '../../auth'

const statusBarHeight = ref(Number(uni.getSystemInfoSync().statusBarHeight || 0))
const username = ref('')
const password = ref('')
const submitting = ref(false)

async function submit() {
  if (!username.value.trim() || !password.value) {
    uni.showToast({ title: '请输入统一账号和密码', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    await loginTrade(username.value.trim(), password.value)
    uni.showToast({ title: '登录成功', icon: 'success' })
    setTimeout(() => uni.switchTab({ url: '/pages/home/index' }), 250)
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '登录失败', icon: 'none', duration: 2600 })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="login-page">
    <view :style="{ height: `${statusBarHeight}px` }" />
    <view class="login-content">
      <view class="brand-mark">丰</view>
      <text class="login-title">丰链云 · 交易撮合</text>
      <text class="login-subtitle">统一账号登录 · 与平台其他系统共用身份</text>

      <view class="login-card">
        <text class="form-title">统一账号登录</text>
        <text class="form-tip">使用平台用户名和密码，无需单独创建交易账号</text>
        <view class="input-box">
          <text class="input-icon">用</text>
          <input v-model="username" placeholder="请输入统一账号用户名" />
        </view>
        <view class="input-box">
          <text class="input-icon">密</text>
          <input v-model="password" password placeholder="请输入统一账号密码" confirm-type="done" @confirm="submit" />
        </view>
        <button class="login-button" :loading="submitting" @tap="submit">登录</button>
        <text class="permission-tip">登录后自动校验交易撮合访问权限</text>
      </view>

      <view class="trust-row">
        <view><b>统一身份</b><text>全平台同一账号</text></view>
        <view><b>交易大厅</b><text>货源与采购需求</text></view>
        <view><b>多端可用</b><text>H5 / 小程序 / APP</text></view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.login-page { min-height: 100vh; background: radial-gradient(circle at 82% 8%, rgba(110,231,162,.2), transparent 42%), linear-gradient(145deg,#06281a,#0d5d3b); color: #fff; }
.login-content { display: flex; align-items: center; flex-direction: column; padding: 112rpx 34rpx 40rpx; }
.brand-mark { display: grid; width: 94rpx; height: 94rpx; place-items: center; border-radius: 26rpx; background: linear-gradient(145deg,#159a5e,#12764a); font-size: 44rpx; font-weight: 800; box-shadow: 0 16rpx 38rpx rgba(4,31,20,.25); }
.login-title { margin-top: 24rpx; font-size: 38rpx; font-weight: 800; }
.login-subtitle { margin-top: 9rpx; color: rgba(255,255,255,.58); font-size: 20rpx; }
.login-card { width: 100%; margin-top: 46rpx; padding: 32rpx; border: 1rpx solid rgba(255,255,255,.55); border-radius: 28rpx; background: #fff; color: #0b1a12; box-shadow: 0 24rpx 60rpx rgba(4,31,20,.22); }
.form-title,.form-tip,.permission-tip { display: block; }
.form-title { font-size: 31rpx; font-weight: 800; }
.form-tip { margin-top: 7rpx; color: #84938a; font-size: 18rpx; line-height: 1.5; }
.input-box { display: flex; height: 84rpx; align-items: center; margin-top: 18rpx; overflow: hidden; border: 1rpx solid #dfe8e2; border-radius: 16rpx; background: #fbfdfb; }
.input-icon { width: 72rpx; border-right: 1rpx solid #e3eae5; color: #52665a; text-align: center; }
.input-box input { flex: 1; padding: 0 18rpx; font-size: 25rpx; }
.login-button { height: 84rpx; margin-top: 22rpx; border-radius: 16rpx; background: linear-gradient(135deg,#159a5e,#12764a); color: #fff; font-size: 26rpx; font-weight: 700; line-height: 84rpx; }
.permission-tip { margin-top: 16rpx; color: #93a29a; font-size: 17rpx; text-align: center; }
.trust-row { display: flex; width: 100%; margin-top: 40rpx; }
.trust-row view { flex: 1; text-align: center; }
.trust-row b,.trust-row text { display: block; }
.trust-row b { color: rgba(255,255,255,.82); font-size: 19rpx; }
.trust-row text { margin-top: 5rpx; color: rgba(255,255,255,.42); font-size: 16rpx; }
</style>
