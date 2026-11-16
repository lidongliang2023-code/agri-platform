<template>
  <view class="auth-page">
    <view class="auth-hero" :style="{ paddingTop: `calc(${statusBarHeight}px + 38rpx)` }">
      <view class="brand-row">
        <image class="brand-mark" src="/static/fengchain.svg" mode="aspectFill" />
        <view>
          <text class="brand-name">丰链云</text>
          <text class="brand-en">FENGCHAIN · IOT</text>
        </view>
      </view>
      <view class="hero-copy">
        <text class="hero-kicker">物联网移动工作台</text>
        <text class="hero-title">欢迎回来</text>
        <text class="hero-desc">使用丰链云统一账号登录，随时查看设备、处理告警与管理农场。</text>
      </view>
      <view class="hero-flow">
        <view><text>01</text><text>统一账号</text></view>
        <view class="flow-line" />
        <view><text>02</text><text>权限校验</text></view>
        <view class="flow-line" />
        <view><text>03</text><text>进入主体</text></view>
      </view>
    </view>

    <view class="auth-card">
      <view v-if="!challengeToken" class="auth-tabs">
        <button :class="{ on: tab === 'sms' }" :disabled="submitting" @tap="switchTab('sms')">手机验证码</button>
        <button :class="{ on: tab === 'pwd' }" :disabled="submitting" @tap="switchTab('pwd')">账号密码</button>
      </view>
      <view v-else class="mfa-head">
        <text class="mfa-title">二次验证</text>
        <text class="mfa-tip">{{ recoveryMode ? '请输入启用二次验证时保存的一次性备用码，用后即失效' : '该账号已开启二次验证，请输入验证器上的 6 位动态码' }}</text>
      </view>

      <view class="form-block">
        <template v-if="challengeToken">
          <view class="input-group">
            <text class="label">{{ recoveryMode ? '一次性备用码' : '动态验证码' }}</text>
            <view class="input-shell">
              <input v-if="!recoveryMode" v-model="mfaCode" type="number" maxlength="6" :disabled="submitting" placeholder="请输入 6 位动态码" confirm-type="done" @confirm="submitLogin" />
              <input v-else v-model="mfaCode" type="text" maxlength="32" :disabled="submitting" placeholder="请输入一次性备用码" confirm-type="done" @confirm="submitLogin" />
            </view>
          </view>
        </template>

        <template v-else-if="tab === 'sms'">
          <view class="input-group">
            <text class="label">手机号</text>
            <view class="input-shell">
              <text class="prefix">+86</text>
              <input v-model="phone" type="number" maxlength="11" :disabled="submitting" placeholder="请输入 11 位手机号" />
            </view>
          </view>
          <view class="input-group">
            <text class="label">短信验证码</text>
            <view class="code-row">
              <view class="input-shell">
                <input v-model="smsCode" type="number" maxlength="6" :disabled="submitting" placeholder="请输入 6 位验证码" confirm-type="done" @confirm="submitLogin" />
              </view>
              <button class="code-button" :disabled="sending || countdown > 0 || submitting" @tap="requestLoginCode">
                {{ sending ? '发送中…' : countdown > 0 ? `${countdown}s 后重发` : '获取验证码' }}
              </button>
            </view>
          </view>
        </template>

        <template v-else>
          <view class="input-group">
            <text class="label">账号 / 手机号</text>
            <view class="input-shell">
              <input v-model="account" :disabled="submitting" placeholder="请输入用户名或手机号" />
            </view>
          </view>
          <view class="input-group">
            <text class="label">登录密码</text>
            <view class="input-shell">
              <input v-model="password" :password="!showPassword" :disabled="submitting" placeholder="请输入统一账号密码" confirm-type="done" @confirm="submitLogin" />
              <button class="password-toggle" :disabled="submitting" @tap="showPassword = !showPassword">{{ showPassword ? '隐藏' : '显示' }}</button>
            </view>
          </view>
        </template>

        <view v-if="!challengeToken" class="form-meta">
          <button class="remember" :disabled="submitting" @tap="remember = !remember">
            <text class="check" :class="{ on: remember }">{{ remember ? '✓' : '' }}</text>
            <text>保持登录（有效期内）</text>
          </button>
          <button class="meta-link" :disabled="submitting" @tap="showPasswordHelp">忘记密码？</button>
        </view>
        <view v-else class="form-meta">
          <button class="meta-link" :disabled="submitting" @tap="toggleMfaMode">{{ recoveryMode ? '使用动态码' : '使用备用码' }}</button>
          <button class="meta-link" :disabled="submitting" @tap="backFromMfa">返回账号登录</button>
        </view>

        <view v-if="messageText" :class="['inline-message', messageType]" role="alert">{{ messageText }}</view>

        <button class="primary-button" :disabled="submitting || sending" :loading="submitting" @tap="submitLogin">
          {{ submitting ? '登录中…' : challengeToken ? '验证并登录' : '登 录' }}
        </button>
      </view>

      <view v-if="!challengeToken" class="divider"><i /><text>其他登录方式</text><i /></view>
      <view v-if="!challengeToken" class="third-party">
        <button @tap="showThirdParty('微信')">
          <text class="third-icon wechat">微</text>
          <text>微信</text>
        </button>
        <button @tap="showThirdParty('支付宝')">
          <text class="third-icon alipay">支</text>
          <text>支付宝</text>
        </button>
        <button @tap="showThirdParty('国家政务服务平台')">
          <text class="third-icon gov">政</text>
          <text>政务服务</text>
        </button>
      </view>

      <view class="auth-footer">
        <text>统一账号与 PC 端、生产管理、交易撮合通用</text>
      </view>
    </view>

    <view class="auth-bottom">
      <text>登录即表示同意《用户服务协议》和《隐私政策》</text>
      <text>登录后自动校验物联网权限，业务数据按经营主体管理</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { PHONE_PATTERN, completeUnifiedMfa, hasIotSession, loginWithSmsCode, loginWithUnifiedAccount, sendLoginSmsCode, type UnifiedLoginResult } from '../../api/iot'

type LoginTab = 'sms' | 'pwd'

const statusBarHeight = Number(uni.getSystemInfoSync().statusBarHeight || 0)
const tab = ref<LoginTab>('pwd')
const phone = ref('')
const smsCode = ref('')
const account = ref('')
const password = ref('')
const remember = ref(true)
const showPassword = ref(false)
const recoveryMode = ref(false)
const sending = ref(false)
const submitting = ref(false)
const countdown = ref(0)
const challengeToken = ref('')
const mfaCode = ref('')
const messageText = ref('')
const messageType = ref<'error' | 'notice'>('error')
let timer: ReturnType<typeof setInterval> | null = null

const canSubmit = computed(() => {
  if (challengeToken.value) return recoveryMode.value
    ? /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/.test(mfaCode.value.replace(/[\s-]/g, '').toUpperCase())
    : /^\d{6}$/.test(mfaCode.value.trim())
  return tab.value === 'sms'
    ? PHONE_PATTERN.test(phone.value) && /^\d{6}$/.test(smsCode.value)
    : account.value.trim().length > 0 && password.value.length > 0
})

function notice(text: string, type: 'error' | 'notice' = 'error'): void {
  messageType.value = type
  messageText.value = text
}

function switchTab(next: LoginTab): void {
  if (submitting.value || sending.value) return
  showPassword.value = false
  tab.value = next
  notice('')
}

function toggleMfaMode(): void {
  if (submitting.value) return
  recoveryMode.value = !recoveryMode.value
  mfaCode.value = ''
  notice('')
}

function backFromMfa(): void {
  if (!submitting.value) resetMfa()
}

function resetMfa(): void {
  recoveryMode.value = false
  showPassword.value = false
  challengeToken.value = ''
  mfaCode.value = ''
  password.value = ''
  smsCode.value = ''
  notice('')
}

function startCountdown(): void {
  countdown.value = 60
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0 && timer) {
      clearInterval(timer)
      timer = null
    }
  }, 1000)
}

async function requestLoginCode(): Promise<void> {
  if (submitting.value || sending.value || countdown.value > 0) return
  if (!PHONE_PATTERN.test(phone.value)) {
    notice('请输入正确的 11 位手机号')
    return
  }
  sending.value = true
  notice('')
  try {
    const result = await sendLoginSmsCode(phone.value)
    notice(result?.hint || '验证码已发送', 'notice')
    startCountdown()
  } catch (error) {
    notice(error instanceof Error ? error.message : '验证码发送失败')
  } finally {
    sending.value = false
  }
}

function enterWorkbench(): void {
  uni.showToast({ title: '登录成功', icon: 'success' })
  setTimeout(() => uni.reLaunch({ url: '/pages/index/index' }), 250)
}

async function submitLogin(): Promise<void> {
  if (submitting.value || sending.value) return
  if (!canSubmit.value) {
    notice(challengeToken.value ? (recoveryMode.value ? '请输入有效的 10 位备用码，可带连字符' : '请输入 6 位动态码') : tab.value === 'sms' ? '请填写正确的手机号和 6 位验证码' : '请输入账号和密码')
    return
  }
  submitting.value = true
  notice('')
  const wasMfa = Boolean(challengeToken.value)
  try {
    let result: UnifiedLoginResult
    if (wasMfa) result = await completeUnifiedMfa(challengeToken.value, mfaCode.value, remember.value)
    else if (tab.value === 'sms') result = await loginWithSmsCode(phone.value, smsCode.value, remember.value)
    else result = await loginWithUnifiedAccount(account.value.trim(), password.value, remember.value)
    password.value = ''
    showPassword.value = false
    smsCode.value = ''
    if (result.mfaRequired) {
      recoveryMode.value = false
      challengeToken.value = result.challengeToken!
      mfaCode.value = ''
      return
    }
    challengeToken.value = ''
    mfaCode.value = ''
    enterWorkbench()
  } catch (error) {
    if (wasMfa) resetMfa()
    notice((error instanceof Error ? error.message : '登录失败，请稍后重试') + (wasMfa ? '；请重新登录获取验证机会' : ''))
  } finally {
    submitting.value = false
  }
}

function showPasswordHelp(): void {
  uni.showModal({
    title: '找回密码',
    content: '物联网使用丰链云统一账号。请在统一账号中心用注册手机号重置密码，或联系平台管理员处理。',
    showCancel: false,
    confirmText: '我知道了',
  })
}

function showThirdParty(name: string): void {
  uni.showModal({
    title: `${name}登录`,
    content: `${name}登录入口已预留，本部署尚未配置开放平台应用凭据和回调域名，暂不能发起真实授权。请使用丰链云统一账号登录。`,
    showCancel: false,
    confirmText: '我知道了',
  })
}

onShow(() => {
  if (!submitting.value && hasIotSession()) uni.reLaunch({ url: '/pages/index/index' })
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style lang="scss" scoped>
.auth-page {
  min-height: 100vh;
  padding: 0 28rpx calc(42rpx + env(safe-area-inset-bottom));
  background:
    radial-gradient(circle at 92% 5%, rgba(67, 190, 121, .18), transparent 340rpx),
    linear-gradient(180deg, #0f5838 0, #13764a 520rpx, #f3f8f5 520rpx, #f3f8f5 100%);
}

.auth-hero { padding: 38rpx 12rpx 28rpx; color: #fff; }
.brand-row { display: flex; align-items: center; gap: 16rpx; }
.brand-mark { width: 66rpx; height: 66rpx; border-radius: 19rpx; box-shadow: 0 12rpx 30rpx rgba(0, 0, 0, .12); }
.brand-name, .brand-en { display: block; }
.brand-name { font-size: 30rpx; font-weight: 800; letter-spacing: 2rpx; }
.brand-en { margin-top: 3rpx; color: rgba(255, 255, 255, .62); font-size: 24rpx; letter-spacing: 2rpx; }

.hero-copy { display: flex; flex-direction: column; gap: 8rpx; margin-top: 40rpx; }
.hero-kicker { color: #a7e9c3; font-size: 24rpx; letter-spacing: 2rpx; }
.hero-title { font-size: 48rpx; font-weight: 800; letter-spacing: 2rpx; }
.hero-desc { color: rgba(255, 255, 255, .72); font-size: 24rpx; line-height: 1.6; }

.hero-flow { display: flex; align-items: center; gap: 12rpx; margin-top: 34rpx; }
.hero-flow > view:not(.flow-line), .hero-flow > uni-view:not(.flow-line) { display: flex; align-items: center; gap: 8rpx; color: rgba(255, 255, 255, .82); font-size: 24rpx; }
.hero-flow view text:first-child, .hero-flow uni-view uni-text:first-child {
  display: flex; width: 34rpx; height: 34rpx; align-items: center; justify-content: center;
  border-radius: 50%; background: rgba(255, 255, 255, .14); color: #d7f8e4; font-size: 20rpx; font-weight: 800;
}
.hero-flow .flow-line { height: 1rpx; flex: 1; background: rgba(255, 255, 255, .18); }

.auth-card {
  overflow: hidden;
  border: 1rpx solid rgba(218, 232, 223, .85);
  border-radius: 24rpx;
  background: #fff;
  box-shadow: 0 20rpx 60rpx rgba(21, 67, 43, .11);
}

.auth-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 8rpx; padding: 12rpx; background: #f7faf8; }
.auth-tabs button, .auth-tabs uni-button {
  min-height: 72rpx; padding: 0 8rpx; border-radius: 14rpx;
  color: #7b8c82; font-size: 26rpx; font-weight: 600; line-height: 72rpx;
}
.auth-tabs button.on, .auth-tabs uni-button.on { background: #fff; color: #0f6d43; box-shadow: 0 4rpx 18rpx rgba(21, 67, 43, .08); }

.mfa-head { padding: 28rpx 28rpx 0; }
.mfa-title { display: block; color: #0b1a12; font-size: 32rpx; font-weight: 800; }
.mfa-tip { display: block; margin-top: 8rpx; color: #718277; font-size: 24rpx; line-height: 1.6; }

.form-block { padding: 30rpx 28rpx 24rpx; }
.input-group + .input-group { margin-top: 24rpx; }
.label { display: block; margin-bottom: 10rpx; color: #40574a; font-size: 26rpx; font-weight: 600; }

.input-shell {
  display: flex; min-width: 0; height: 88rpx; flex: 1; align-items: center; gap: 12rpx;
  padding: 0 22rpx; border: 1rpx solid #dce7e0; border-radius: 14rpx; background: #fbfdfc;
}
.input-shell:focus-within { border-color: #159a5e; background: #fff; }
.input-shell input { min-width: 0; height: 88rpx; flex: 1; color: #243d2e; font-size: 28rpx; }
.prefix { padding-right: 12rpx; border-right: 1rpx solid #e1e9e4; color: #6e8275; font-size: 26rpx; }

.code-row { display: flex; align-items: center; gap: 14rpx; }
.code-button {
  flex-shrink: 0; width: 210rpx; height: 88rpx; border: 1rpx solid #a8d6ba; border-radius: 14rpx;
  background: #eff9f3; color: #117849; font-size: 26rpx; font-weight: 700; line-height: 86rpx;
}
.code-button[disabled] { opacity: .55; }

.form-meta { display: flex; align-items: center; justify-content: space-between; margin: 22rpx 2rpx 0; color: #7c8f83; font-size: 24rpx; }
.remember { display: flex; min-height: 64rpx; align-items: center; gap: 12rpx; }
.check {
  display: flex; width: 32rpx; height: 32rpx; align-items: center; justify-content: center;
  border: 2rpx solid #b9cbbf; border-radius: 8rpx; background: #fff; color: #fff; font-size: 22rpx; font-weight: 800;
}
.check.on { border-color: #159a5e; background: #159a5e; }
.meta-link { display: flex; min-height: 64rpx; align-items: center; color: #188454; font-size: 26rpx; }

.inline-message { margin-top: 18rpx; padding: 16rpx 18rpx; border-radius: 12rpx; font-size: 26rpx; line-height: 1.55; overflow-wrap: anywhere; }
.inline-message.error { border: 1rpx solid #f2c5bf; background: #fff3f1; color: #b42318; }
.inline-message.notice { border: 1rpx solid #b9dfc8; background: #effaf4; color: #14764a; }

.primary-button {
  height: 92rpx; margin-top: 26rpx; border-radius: 14rpx;
  background: linear-gradient(135deg, #12764a, #19a361); color: #fff;
  font-size: 30rpx; font-weight: 700; letter-spacing: 3rpx; line-height: 92rpx;
  box-shadow: 0 12rpx 26rpx rgba(18, 118, 74, .2);
}
.primary-button[disabled] { opacity: .55; }

.divider {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 0 28rpx;
  color: #95a39b;
  font-size: 24rpx;
}
.divider i { height: 1rpx; flex: 1; background: #edf1ee; }

.third-party {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
  padding: 24rpx 28rpx 12rpx;
}
.third-party button,
.third-party uni-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 9rpx;
  min-height: 82rpx;
  border: none;
  background: transparent;
  color: #667a6e;
  font-size: 24rpx;
}
.third-party button::after,
.third-party uni-button::after { border: 0; }
.third-icon {
  display: flex;
  width: 62rpx;
  height: 62rpx;
  align-items: center;
  justify-content: center;
  border-radius: 18rpx;
  color: #fff;
  font-size: 26rpx;
  font-weight: 800;
}
.third-icon.wechat { background: #16a34a; }
.third-icon.alipay { background: #1677ff; }
.third-icon.gov { background: linear-gradient(135deg, #d9363e, #f05b42); }

.auth-footer {
  display: flex; align-items: center; justify-content: center;
  padding: 24rpx 20rpx 28rpx; border-top: 1rpx solid #edf2ee;
  color: #819086; font-size: 24rpx; text-align: center;
}

.auth-bottom {
  display: flex; flex-direction: column; gap: 6rpx; padding: 28rpx 16rpx 0;
  color: #91a098; font-size: 24rpx; line-height: 1.5; text-align: center;
}

/* 与生产管理同系的登录卡片，兼顾窄屏、触控和 H5 宽屏。 */
.auth-page { box-sizing: border-box; }
.auth-hero, .auth-card, .auth-bottom { width: 100%; max-width: 480px; margin-left: auto; margin-right: auto; }
.auth-tabs { display: flex; }
.auth-tabs button { flex: 1; min-width: 0; min-height: 44px; display: flex; align-items: center; justify-content: center; line-height: 1.4; }
.input-shell { min-height: 48px; }
.input-shell input { width: 0; min-height: 44px; font-size: 16px; }
.code-button { min-height: 48px; display: flex; align-items: center; justify-content: center; line-height: 1.4; font-size: 14px; }
.password-toggle { flex-shrink: 0; min-width: 44px; min-height: 44px; color: #188454; font-size: 14px; }
.primary-button { min-height: 48px; display: flex; align-items: center; justify-content: center; line-height: 1.4; }
.remember, .meta-link { min-height: 44px; font-size: 12px; }
.form-meta { flex-wrap: wrap; gap: 4px; }
.hero-flow .flow-line { min-width: 6px; }
.brand-en, .hero-kicker, .hero-desc, .hero-flow > view, .auth-footer, .auth-bottom, .mfa-tip { font-size: 12px; }
.auth-bottom { color: #647a6d; }
@media (max-width: 350px) {
  .auth-page { padding-left: 16rpx; padding-right: 16rpx; }
  .form-block { padding-left: 22rpx; padding-right: 22rpx; }
  .hero-copy { margin-top: 26rpx; }
  .hero-flow { gap: 6rpx; }
  .code-row { gap: 8rpx; }
  .code-button { width: 102px; }
  .input-shell { padding-left: 14rpx; padding-right: 14rpx; }
}
</style>
