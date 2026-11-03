<template>
  <view class="login-page">
    <view class="status-bar" :style="{ height: `${statusBarHeight}px` }" />
    <view class="login-nav">
      <text class="back" @tap="goBack">‹</text>
      <text>供应商登录</text>
      <text class="nav-space" />
    </view>
    <view class="login-content">
      <view class="brand-mark">丰</view>
      <text class="login-title">丰链云 · 供应商</text>
      <text class="login-desc">商品、订单与履约作业移动化</text>
      <view class="login-card">
        <text class="form-title">统一账号登录</text>
        <text class="form-desc">使用丰链云统一用户名和密码进入供应商工作台</text>
        <view class="input-box">
          <text class="prefix">用</text>
          <input v-model="username" placeholder="请输入统一账号用户名" />
        </view>
        <view class="input-box">
          <text class="prefix">密</text>
          <input v-model="password" password placeholder="请输入密码" />
        </view>
        <button class="login-button" :loading="submitting" @tap="submit">进入工作台</button>
        <text class="login-note">登录后自动校验供应商角色权限，无需单独创建账号</text>
      </view>
      <view class="platform-trust">
        <view><b>商品审核</b><text>状态实时同步</text></view>
        <view><b>订单履约</b><text>移动端发货</text></view>
        <view><b>多端部署</b><text>小程序与APP</text></view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { saveSupplierSession, leaveSupplierLogin } from '../../session'
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
      's2b2c:supplier',
    )
    saveSupplierSession({
      id: 1,
      phone: result.user.username,
      username: result.user.username,
      nickname: result.user.nickname,
      unifiedUserId: result.user.id,
    })
    toast('登录成功', 'success')
    setTimeout(() => {
      leaveSupplierLogin()
    }, 300)
  } catch (error) {
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
.login-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at 82% 8%, rgba(110,231,162,.2), transparent 42%),
    linear-gradient(145deg, #06281a, #0d5d3b);
  color: #fff;
}

.login-page .status-bar {
  background: transparent;
}

.login-nav {
  display: flex;
  height: 86rpx;
  align-items: center;
  justify-content: space-between;
  padding: 0 24rpx;
  font-size: 25rpx;
  font-weight: 700;
}

.back,
.nav-space {
  width: 70rpx;
  font-size: 48rpx;
}

.login-content {
  display: flex;
  align-items: center;
  flex-direction: column;
  padding: 58rpx 32rpx 30rpx;
}

.brand-mark {
  display: grid;
  width: 92rpx;
  height: 92rpx;
  place-items: center;
  border-radius: 25rpx;
  background: linear-gradient(145deg, #159a5e, #12764a);
  color: #fff;
  font-size: 42rpx;
  font-weight: 800;
  box-shadow: 0 15rpx 36rpx rgba(4,31,20,.24);
}

.login-title {
  margin-top: 22rpx;
  font-size: 37rpx;
  font-weight: 800;
}

.login-desc {
  margin-top: 8rpx;
  color: rgba(255,255,255,.58);
  font-size: 19rpx;
}

.login-card {
  width: 100%;
  margin-top: 44rpx;
  padding: 30rpx;
  border: 1rpx solid rgba(255,255,255,.55);
  border-radius: 27rpx;
  background: #fff;
  color: #0b1a12;
  box-shadow: 0 24rpx 60rpx rgba(4,31,20,.2);
}

.form-title,
.form-desc {
  display: block;
}

.form-title {
  font-size: 30rpx;
  font-weight: 800;
}

.form-desc {
  margin-top: 7rpx;
  color: #84938a;
  font-size: 18rpx;
}

.input-box {
  display: flex;
  height: 82rpx;
  align-items: center;
  margin-top: 18rpx;
  overflow: hidden;
  border: 1rpx solid #dfe8e2;
  border-radius: 15rpx;
  background: #fbfdfb;
}

.prefix {
  width: 74rpx;
  border-right: 1rpx solid #e3eae5;
  color: #52665a;
  font-size: 21rpx;
  text-align: center;
}

.input-box input {
  flex: 1;
  padding: 0 18rpx;
  font-size: 25rpx;
}

.login-button {
  height: 82rpx;
  margin-top: 22rpx;
  border-radius: 16rpx;
  background: linear-gradient(135deg, #159a5e, #12764a);
  color: #fff;
  font-size: 25rpx;
  font-weight: 700;
  line-height: 82rpx;
}

.login-note {
  display: block;
  margin-top: 16rpx;
  color: #93a29a;
  font-size: 17rpx;
  text-align: center;
}

.platform-trust {
  display: flex;
  width: 100%;
  margin-top: 36rpx;
}

.platform-trust view {
  flex: 1;
  text-align: center;
}

.platform-trust b,
.platform-trust text {
  display: block;
}

.platform-trust b {
  color: rgba(255,255,255,.82);
  font-size: 18rpx;
}

.platform-trust text {
  margin-top: 5rpx;
  color: rgba(255,255,255,.42);
  font-size: 15rpx;
}
</style>
