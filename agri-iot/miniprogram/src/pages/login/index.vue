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
        <text class="hero-desc">使用丰链云统一账号登录，设备监测、告警处理与农场运维随时处理。</text>
      </view>
      <view class="hero-flow">
        <view><text>01</text><text>统一账号</text></view>
        <i />
        <view><text>02</text><text>权限校验</text></view>
        <i />
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
        <text class="mfa-tip">该账号已开启二次验证，请输入验证器上的 6 位动态码</text>
      </view>

      <view class="form-block">
        <template v-if="challengeToken">
          <view class="input-group">
            <text class="label">动态验证码</text>
            <view class="input-shell">
              <input v-model="mfaCode" type="number" maxlength="6" :disabled="submitting" placeholder="请输入 6 位动态码" confirm-type="done" @confirm="submitLogin" />
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
              <input v-model="password" password :disabled="submitting" placeholder="请输入统一账号密码" confirm-type="done" @confirm="submitLogin" />
            </view>
          </view>
        </template>

        <view v-if="!challengeToken" class="form-meta">
          <view class="remember" @tap="remember = !remember">
            <text class="check" :class="{ on: remember }">{{ remember ? '✓' : '' }}</text>
            <text>保持登录（有效期内）</text>
          </view>
          <text class="meta-link" @tap="showPasswordHelp">忘记密码？</text>
        </view>
        <view v-else class="form-meta">
          <text />
          <text class="meta-link" @tap="resetMfa">返回账号登录</text>
        </view>

        <view v-if="messageText" :class="['inline-message', messageType]" role="alert">{{ messageText }}</view>

        <button class="primary-button" :disabled="submitting" @tap="submitLogin">
          {{ submitting ? '登录中…' : challengeToken ? '验证并登录' : '登 录' }}
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
const sending = ref(false)
const submitting = ref(false)
const countdown = ref(0)
const challengeToken = ref('')
const mfaCode = ref('')
const messageText = ref('')
const messageType = ref<'error' | 'notice'>('error')
let timer: ReturnType<typeof setInterval> | null = null

const canSubmit = computed(() => {
  if (challengeToken.value) return /^\d{6}$/.test(mfaCode.value.trim())
  return tab.value === 'sms'
    ? PHONE_PATTERN.test(phone.value) && /^\d{6}$/.test(smsCode.value)
    : account.value.trim().length > 0 && password.value.length > 0
})

function notice(text: string, type: 'error' | 'notice' = 'error'): void {
  messageType.value = type
  messageText.value = text
}

function switchTab(next: LoginTab): void {
  tab.value = next
  notice('')
}

function resetMfa(): void {
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
  if (submitting.value) return
  if (!canSubmit.value) {
    notice(challengeToken.value ? '请输入 6 位动态码' : tab.value === 'sms' ? '请填写正确的手机号和 6 位验证码' : '请输入账号和密码')
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
    smsCode.value = ''
    if (result.mfaRequired) {
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
.hero-flow view, .hero-flow uni-view { display: flex; align-items: center; gap: 8rpx; color: rgba(255, 255, 255, .82); font-size: 24rpx; }
.hero-flow view text:first-child, .hero-flow uni-view uni-text:first-child {
  display: flex; width: 34rpx; height: 34rpx; align-items: center; justify-content: center;
  border-radius: 50%; background: rgba(255, 255, 255, .14); color: #d7f8e4; font-size: 20rpx; font-weight: 800;
}
.hero-flow i { height: 1rpx; flex: 1; background: rgba(255, 255, 255, .18); }

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

.auth-footer {
  display: flex; align-items: center; justify-content: center;
  padding: 24rpx 20rpx 28rpx; border-top: 1rpx solid #edf2ee;
  color: #819086; font-size: 24rpx; text-align: center;
}

.auth-bottom {
  display: flex; flex-direction: column; gap: 6rpx; padding: 28rpx 16rpx 0;
  color: #91a098; font-size: 24rpx; line-height: 1.5; text-align: center;
}
</style>
