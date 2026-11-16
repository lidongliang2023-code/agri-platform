<template>
  <view class="auth-page">
    <view class="status-bar" :style="{ height: `${statusBarHeight}px` }" />
    <view class="auth-hero">
      <view class="brand-row">
        <image class="brand-mark" src="/static/fengchain.svg" mode="aspectFill" />
        <view>
          <text class="brand-name">丰链云</text>
          <text class="brand-en">FENGCHAIN · AGRI</text>
        </view>
      </view>
      <view class="hero-copy">
        <text class="hero-kicker">信息资讯移动端</text>
        <text class="hero-title">掌握产业动态</text>
        <text class="hero-desc">统一账号登录后，资讯、行情、供需与培训数据在多端同步。</text>
      </view>
      <view class="hero-flow">
        <view class="flow-step active"><text>01</text><text>统一登录</text></view>
        <i />
        <view class="flow-step"><text>02</text><text>权限校验</text></view>
        <i />
        <view class="flow-step"><text>03</text><text>进入资讯</text></view>
      </view>
    </view>

    <view class="auth-card">
      <view v-if="!challengeToken" class="card-heading">
        <text class="form-title">登录信息资讯</text>
        <text class="form-tip">使用丰链云统一账号，无需单独创建资讯账号</text>
      </view>
      <view v-else class="card-heading">
        <text class="form-title">完成二次验证</text>
        <text class="form-tip">账号已开启二次验证，请输入验证器上的 6 位动态码</text>
      </view>

      <view class="form-block">
        <template v-if="challengeToken">
          <view class="input-group">
            <text class="label">动态验证码</text>
            <view class="input-shell focused">
              <text class="input-icon">码</text>
              <input
                v-model="mfaCode"
                type="number"
                maxlength="6"
                :disabled="submitting"
                placeholder="请输入 6 位动态码"
                confirm-type="done"
                @confirm="submit"
              />
            </view>
          </view>
          <view class="mfa-note">验证码校验失败后挑战会失效，需要重新输入账号密码。</view>
        </template>
        <template v-else>
          <view class="input-group">
            <text class="label">统一账号</text>
            <view class="input-shell">
              <text class="input-icon">用</text>
              <input v-model="username" :disabled="submitting" placeholder="请输入用户名或手机号" />
            </view>
          </view>
          <view class="input-group">
            <text class="label">登录密码</text>
            <view class="input-shell">
              <text class="input-icon">密</text>
              <input
                v-model="password"
                password
                :disabled="submitting"
                placeholder="请输入统一账号密码"
                confirm-type="done"
                @confirm="submit"
              />
            </view>
          </view>
        </template>

        <view v-if="!challengeToken" class="form-meta">
          <label class="remember" @tap="remember = !remember">
            <checkbox :checked="remember" color="#159a5e" />
            <text>保持登录（有效期内）</text>
          </label>
          <text class="meta-link" @tap="showPasswordHelp">忘记密码？</text>
        </view>
        <view v-else class="form-meta">
          <text class="meta-link" @tap="resetMfa">返回账号登录</text>
          <text class="meta-link">挑战凭证 5 分钟内有效</text>
        </view>

        <view v-if="messageText" :class="['inline-message', messageType]">{{ messageText }}</view>
        <button class="primary-button" :disabled="submitting" @tap="submit">
          {{ submitting ? '处理中…' : challengeToken ? '验证并登录' : '登 录' }}
        </button>
      </view>

      <view v-if="!challengeToken" class="divider"><i /><text>统一认证安全保障</text><i /></view>
      <view v-if="!challengeToken" class="security-row">
        <view><text class="security-icon">统</text><text>统一身份</text><text>全平台同一账号</text></view>
        <view><text class="security-icon">权</text><text>权限同步</text><text>按角色安全访问</text></view>
        <view><text class="security-icon">端</text><text>多端可用</text><text>H5 / 小程序 / APP</text></view>
      </view>

      <view class="auth-footer">
        <text>还没有账号？</text>
        <text class="footer-link" @tap="showRegisterHelp">联系平台管理员开通 →</text>
      </view>
    </view>

    <view class="auth-bottom">
      <text>登录即表示同意《用户服务协议》和《隐私政策》</text>
      <text>登录后将自动校验信息资讯用户或运营权限</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
  completeInfoMfaLogin,
  isInfoMfaChallenge,
  isLoggedIn,
  loginWithUnifiedAccount,
} from '../../auth'

const statusBarHeight = ref(0)
const username = ref('')
const password = ref('')
const remember = ref(true)
const submitting = ref(false)
const challengeToken = ref('')
const mfaCode = ref('')
const messageText = ref('')
const messageType = ref<'error' | 'notice'>('error')

try {
  statusBarHeight.value = Number(uni.getSystemInfoSync().statusBarHeight || 0)
} catch {
  statusBarHeight.value = 0
}

function notice(text: string, type: 'error' | 'notice' = 'error'): void {
  messageType.value = type
  messageText.value = text
}

function resetMfa(): void {
  challengeToken.value = ''
  mfaCode.value = ''
  password.value = ''
  notice('')
}

async function submit(): Promise<void> {
  if (submitting.value) return
  if (challengeToken.value) {
    if (!/^\d{6}$/.test(mfaCode.value.trim())) {
      notice('请输入 6 位动态验证码')
      return
    }
  } else if (!username.value.trim() || !password.value) {
    notice('请输入统一账号和密码')
    return
  }

  submitting.value = true
  notice('')
  try {
    if (challengeToken.value) {
      await completeInfoMfaLogin(challengeToken.value, mfaCode.value, remember.value)
    } else {
      const result = await loginWithUnifiedAccount(username.value.trim(), password.value, remember.value)
      if (isInfoMfaChallenge(result)) {
        challengeToken.value = result.challengeToken
        mfaCode.value = ''
        password.value = ''
        notice('密码校验通过，请完成二次验证', 'notice')
        return
      }
    }
    uni.showToast({ title: '登录成功', icon: 'success' })
    setTimeout(() => uni.switchTab({ url: '/pages/news/index' }), 250)
  } catch (error) {
    notice(error instanceof Error ? error.message : '登录失败，请稍后重试')
  } finally {
    submitting.value = false
  }
}

function showPasswordHelp(): void {
  uni.showModal({
    title: '找回密码',
    content: '请联系平台管理员，或使用注册手机号完成身份核验后重置密码。',
    showCancel: false,
  })
}

function showRegisterHelp(): void {
  uni.showModal({
    title: '账号开通',
    content: '信息资讯使用丰链云统一账号。还没有账号时，请联系平台管理员开通统一身份。',
    showCancel: false,
  })
}

onShow(() => {
  // 已有有效会话时由 App 入口或业务页接管，避免登录页重复覆盖用户当前页面。
  if (isLoggedIn()) return
  messageText.value = ''
})
</script>

<style lang="scss" scoped>
.auth-page {
  min-height: 100vh;
  padding: 0 28rpx calc(42rpx + env(safe-area-inset-bottom));
  background:
    radial-gradient(circle at 92% 5%, rgba(67, 190, 121, .18), transparent 340rpx),
    linear-gradient(180deg, #0f5838 0, #13764a 540rpx, #f3f8f5 540rpx, #f3f8f5 100%);
}

.status-bar { background: transparent; }

.auth-hero { padding: 38rpx 12rpx 28rpx; color: #fff; }

.brand-row { display: flex; align-items: center; gap: 16rpx; }

.brand-mark {
  width: 66rpx;
  height: 66rpx;
  border-radius: 19rpx;
  background: linear-gradient(145deg, #dff8e8, #8fe0af);
  box-shadow: 0 12rpx 30rpx rgba(0, 0, 0, .12);
}

.brand-name, .brand-en, .hero-kicker, .hero-title, .hero-desc, .form-title, .form-tip,
.label, .mfa-note, .security-row text, .auth-bottom text { display: block; }
.brand-name { font-size: 30rpx; font-weight: 800; letter-spacing: 2rpx; }
.brand-en { margin-top: 3rpx; color: rgba(255, 255, 255, .62); font-size: 20rpx; letter-spacing: 2rpx; }
.hero-copy { display: grid; gap: 8rpx; margin-top: 40rpx; }
.hero-kicker { color: #a7e9c3; font-size: 24rpx; letter-spacing: 2rpx; }
.hero-title { font-size: 48rpx; font-weight: 800; letter-spacing: 2rpx; }
.hero-desc { color: rgba(255, 255, 255, .72); font-size: 24rpx; line-height: 1.6; }
.hero-flow { display: flex; align-items: center; gap: 12rpx; margin-top: 34rpx; }
.flow-step { display: flex; align-items: center; gap: 7rpx; color: rgba(255, 255, 255, .58); font-size: 23rpx; }
.flow-step text:first-child { display: grid; width: 38rpx; height: 38rpx; place-items: center; border: 1rpx solid rgba(255, 255, 255, .38); border-radius: 50%; font-size: 19rpx; }
.flow-step.active { color: #fff; }
.flow-step.active text:first-child { border-color: #b8f1cf; background: #a7e9c3; color: #0e6a41; }
.hero-flow i, .divider i { display: block; height: 1rpx; flex: 1; background: rgba(255, 255, 255, .22); }

.auth-card {
  padding: 32rpx 30rpx 0;
  border: 1rpx solid rgba(255, 255, 255, .7);
  border-radius: 28rpx;
  background: #fff;
  box-shadow: 0 24rpx 60rpx rgba(4, 31, 20, .2);
  color: #0b1a12;
}
.card-heading { display: grid; gap: 8rpx; }
.form-title { font-size: 32rpx; font-weight: 800; }
.form-tip { color: #84938a; font-size: 24rpx; line-height: 1.5; }
.form-block { margin-top: 26rpx; }
.input-group + .input-group { margin-top: 20rpx; }
.label { margin-bottom: 10rpx; color: #52665a; font-size: 24rpx; font-weight: 650; }
.input-shell { display: flex; height: 88rpx; align-items: center; overflow: hidden; border: 1rpx solid #dfe8e2; border-radius: 16rpx; background: #fbfdfb; }
.input-shell.focused { border-color: #55b981; box-shadow: 0 0 0 5rpx rgba(85, 185, 129, .1); }
.input-icon { display: grid; width: 72rpx; height: 44rpx; place-items: center; border-right: 1rpx solid #e3eae5; color: #52665a; font-size: 24rpx; }
.input-shell input { min-width: 0; flex: 1; padding: 0 18rpx; font-size: 26rpx; }
.form-meta { display: flex; align-items: center; justify-content: space-between; margin-top: 20rpx; color: #7c8f83; font-size: 23rpx; }
.remember { display: flex; align-items: center; gap: 6rpx; }
.remember checkbox { transform: scale(.78); }
.meta-link, .footer-link { color: #12804e; }
.inline-message { margin-top: 18rpx; padding: 16rpx 18rpx; border-radius: 12rpx; font-size: 24rpx; line-height: 1.55; }
.inline-message.error { border: 1rpx solid #f2c5bf; background: #fff3f1; color: #b42318; }
.inline-message.notice { border: 1rpx solid #b9dfc8; background: #effaf4; color: #14764a; }
.mfa-note { margin-top: 12rpx; color: #8a9a90; font-size: 22rpx; line-height: 1.5; }
.primary-button { height: 88rpx; margin-top: 24rpx; border-radius: 15rpx; background: linear-gradient(135deg, #159a5e, #12764a); color: #fff; font-size: 28rpx; font-weight: 700; line-height: 88rpx; letter-spacing: 3rpx; box-shadow: 0 12rpx 26rpx rgba(18, 118, 74, .2); }
.primary-button[disabled] { opacity: .55; }
.divider { display: flex; align-items: center; gap: 14rpx; padding: 30rpx 0 20rpx; color: #95a39b; font-size: 22rpx; }
.divider i { background: #edf1ee; }
.security-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8rpx; padding-bottom: 26rpx; }
.security-row view { display: grid; justify-items: center; gap: 6rpx; text-align: center; }
.security-row text:nth-child(2) { color: #52665a; font-size: 23rpx; font-weight: 700; }
.security-row text:nth-child(3) { color: #9aa89f; font-size: 20rpx; white-space: nowrap; transform: scale(.9); }
.security-icon { display: grid; width: 52rpx; height: 52rpx; place-items: center; border-radius: 17rpx; background: #eaf8ef; color: #12804e; font-size: 23rpx; font-weight: 800; }
.auth-footer { display: flex; align-items: center; justify-content: center; gap: 8rpx; padding: 23rpx 0 27rpx; border-top: 1rpx solid #edf2ee; color: #819086; font-size: 23rpx; }
.auth-footer + .auth-footer { border-top: 0; padding-top: 0; }
.auth-bottom { display: grid; gap: 6rpx; padding: 28rpx 12rpx 0; color: #91a098; font-size: 22rpx; line-height: 1.5; text-align: center; }
</style>
