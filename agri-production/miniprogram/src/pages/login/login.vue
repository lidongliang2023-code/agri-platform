<template>
  <view class="auth-page">
    <view class="auth-hero">
      <view class="brand-row">
        <view class="brand-mark">丰</view>
        <view>
          <text class="brand-name">丰链云</text>
          <text class="brand-en">FENGCHAIN · AGRI</text>
        </view>
      </view>
      <view class="hero-copy">
        <text class="hero-kicker">农业产业互联网平台</text>
        <text class="hero-title">欢迎回来</text>
        <text class="hero-desc">登录后可进入生产管理、交易撮合与主体认证。</text>
      </view>
      <view class="hero-flow">
        <view><text>01</text><text>登录账号</text></view>
        <i />
        <view><text>02</text><text>创建主体</text></view>
        <i />
        <view><text>03</text><text>认证开通</text></view>
      </view>
    </view>

    <view class="auth-card">
      <view class="auth-tabs">
        <button :class="{ on: tab === 'sms' }" @tap="switchTab('sms')">手机验证码</button>
        <button :class="{ on: tab === 'pwd' }" @tap="switchTab('pwd')">账号密码</button>
      </view>

      <view class="form-block">
        <template v-if="tab === 'sms'">
          <view class="input-group">
            <text class="label">手机号</text>
            <view class="input-shell">
              <text class="prefix">+86</text>
              <input v-model="phone" type="number" maxlength="11" placeholder="请输入 11 位手机号" />
            </view>
          </view>
          <view class="input-group">
            <text class="label">短信验证码</text>
            <view class="code-row">
              <view class="input-shell">
                <input v-model="smsCode" type="number" maxlength="6" placeholder="请输入 6 位验证码" />
              </view>
              <button class="code-button" :disabled="sending || countdown > 0" @tap="requestLoginCode">
                {{ sending ? '发送中…' : countdown > 0 ? `${countdown}s 后重发` : '获取验证码' }}
              </button>
            </view>
          </view>
        </template>

        <template v-else>
          <view class="input-group">
            <text class="label">账号 / 手机号</text>
            <view class="input-shell">
              <input v-model="account" placeholder="请输入用户名或手机号" />
            </view>
          </view>
          <view class="input-group">
            <text class="label">登录密码</text>
            <view class="input-shell">
              <input v-model="password" password placeholder="请输入登录密码" />
            </view>
          </view>
        </template>

        <view class="form-meta">
          <label class="remember"><checkbox :checked="remember" color="#159a5e" @tap="remember = !remember" /><text>7 天内保持登录</text></label>
          <text class="meta-link" @tap="showPasswordHelp">忘记密码？</text>
        </view>

        <view v-if="messageText" :class="['inline-message', messageType]">{{ messageText }}</view>

        <button class="primary-button" :disabled="submitting" @tap="submitLogin">
          {{ submitting ? '登录中…' : '登 录' }}
        </button>
      </view>

      <view class="divider"><i /><text>其他登录方式</text><i /></view>
      <view class="third-party">
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
        <text>还没有账号？</text>
        <text class="footer-link" @tap="openRegister">注册账号 / 创建主体 →</text>
      </view>
    </view>

    <view class="auth-bottom">
      <text>登录即表示同意《用户服务协议》和《隐私政策》</text>
      <text>企业或个人主体认证通过后，方可开通完整经营权限</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import {
  getOnboardingStatus,
  listFarms,
  login,
  loginBySms,
  sendSmsCode,
  setCurrentFarm,
  type MobileUser,
} from '@/utils/auth-helper'

type LoginTab = 'sms' | 'pwd'

const tab = ref<LoginTab>('sms')
const phone = ref('')
const smsCode = ref('')
const account = ref('')
const password = ref('')
const remember = ref(true)
const sending = ref(false)
const submitting = ref(false)
const countdown = ref(0)
const messageText = ref('')
const messageType = ref<'error' | 'notice'>('error')
let timer: ReturnType<typeof setInterval> | null = null

const canSubmit = computed(() => tab.value === 'sms'
  ? /^1[3-9]\d{9}$/.test(phone.value) && /^\d{6}$/.test(smsCode.value)
  : account.value.trim().length > 0 && password.value.length > 0)

function notice(text: string, type: 'error' | 'notice' = 'error'): void {
  messageType.value = type
  messageText.value = text
}

function switchTab(next: LoginTab): void {
  tab.value = next
  notice('', 'error')
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
  if (!/^1[3-9]\d{9}$/.test(phone.value)) {
    notice('请输入正确的 11 位手机号')
    return
  }
  sending.value = true
  notice('', 'error')
  try {
    const result = await sendSmsCode(phone.value, 'login')
    notice(result?.hint || '验证码已发送', 'notice')
    startCountdown()
  } catch (error) {
    notice(error instanceof Error ? error.message : '验证码发送失败')
  } finally {
    sending.value = false
  }
}

async function enterWorkbench(user: MobileUser): Promise<void> {
  try {
    const farms = await listFarms()
    if (farms.length > 0) setCurrentFarm(farms[0])
    uni.reLaunch({ url: '/pages/workbench/workbench' })
  } catch {
    notice(`登录成功${user.realName ? `，${user.realName}` : ''}，但暂时无法读取农场信息`)
  }
}

async function handleStage(stage: string | undefined, user: MobileUser): Promise<void> {
  if (stage && stage !== 'done') {
    const targetStep = stage === 'subject' ? 2 : 3
    uni.redirectTo({ url: `/pages/register/register?step=${targetStep}` })
    return
  }
  await enterWorkbench(user)
}

async function submitLogin(): Promise<void> {
  if (!canSubmit.value || submitting.value) {
    notice(tab.value === 'sms' ? '请填写正确的手机号和验证码' : '请输入账号和密码')
    return
  }
  submitting.value = true
  notice('', 'error')
  try {
    if (tab.value === 'sms') {
      const result = await loginBySms({ phone: phone.value, code: smsCode.value, marketId: 1 })
      await handleStage(result.stage, result.user)
      return
    }
    const user = await login({ username: account.value.trim(), password: password.value, marketId: 1 })
    const status = await getOnboardingStatus()
    await handleStage(status?.stage, user)
  } catch (error) {
    notice(error instanceof Error ? error.message : '登录失败，请稍后重试')
  } finally {
    submitting.value = false
  }
}

function openRegister(): void {
  uni.navigateTo({ url: '/pages/register/register' })
}

function showThirdParty(name: string): void {
  uni.showModal({
    title: `${name}登录`,
    content: `${name}登录入口已预留，本部署尚未配置开放平台应用凭据和回调域名，暂不能发起真实授权。`,
    showCancel: false,
    confirmText: '我知道了',
  })
}

function showPasswordHelp(): void {
  uni.showModal({
    title: '找回密码',
    content: '请联系平台管理员或使用注册手机号完成身份核验后重置密码。',
    showCancel: false,
  })
}

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
    linear-gradient(180deg, #0f5838 0, #13764a 500rpx, #f3f8f5 500rpx, #f3f8f5 100%);
}

.auth-hero {
  padding: 38rpx 12rpx 28rpx;
  color: #fff;
}

.brand-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.brand-mark {
  display: grid;
  width: 66rpx;
  height: 66rpx;
  place-items: center;
  border-radius: 19rpx;
  background: linear-gradient(145deg, #dff8e8, #8fe0af);
  color: #0e6a41;
  font-size: 34rpx;
  font-weight: 900;
  box-shadow: 0 12rpx 30rpx rgba(0, 0, 0, .12);
}

.brand-name,
.brand-en {
  display: block;
}

.brand-name {
  font-size: 30rpx;
  font-weight: 800;
  letter-spacing: 2rpx;
}

.brand-en {
  margin-top: 3rpx;
  color: rgba(255, 255, 255, .62);
  font-size: 16rpx;
  letter-spacing: 2rpx;
}

.hero-copy {
  display: grid;
  gap: 8rpx;
  margin-top: 40rpx;
}

.hero-kicker {
  color: #a7e9c3;
  font-size: 20rpx;
  letter-spacing: 2rpx;
}

.hero-title {
  font-size: 48rpx;
  font-weight: 800;
  letter-spacing: 2rpx;
}

.hero-desc {
  color: rgba(255, 255, 255, .72);
  font-size: 23rpx;
  line-height: 1.6;
}

.hero-flow {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 34rpx;
}

.hero-flow view,
.hero-flow uni-view {
  display: flex;
  align-items: center;
  gap: 7rpx;
  color: rgba(255, 255, 255, .82);
  font-size: 20rpx;
}

.hero-flow view text:first-child,
.hero-flow uni-view uni-text:first-child {
  display: grid;
  width: 30rpx;
  height: 30rpx;
  place-items: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, .14);
  color: #d7f8e4;
  font-size: 15rpx;
  font-weight: 800;
}

.hero-flow i {
  height: 1rpx;
  flex: 1;
  background: rgba(255, 255, 255, .18);
}

.auth-card {
  overflow: hidden;
  border: 1rpx solid rgba(218, 232, 223, .85);
  border-radius: 24rpx;
  background: #fff;
  box-shadow: 0 20rpx 60rpx rgba(21, 67, 43, .11);
}

.auth-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding: 12rpx;
  background: #f7faf8;
}

.auth-tabs button,
.auth-tabs uni-button {
  padding: 20rpx 8rpx;
  border: none;
  border-radius: 14rpx;
  background: transparent;
  color: #7b8c82;
  font-size: 25rpx;
  font-weight: 600;
}

.auth-tabs button::after,
.auth-tabs uni-button::after,
.code-button::after,
.primary-button::after,
.third-party button::after,
.third-party uni-button::after {
  border: 0;
}

.auth-tabs button.on,
.auth-tabs uni-button.on {
  background: #fff;
  color: #0f6d43;
  box-shadow: 0 4rpx 18rpx rgba(21, 67, 43, .08);
}

.form-block {
  padding: 30rpx 28rpx 18rpx;
}

.input-group + .input-group {
  margin-top: 24rpx;
}

.label {
  display: block;
  margin-bottom: 10rpx;
  color: #40574a;
  font-size: 23rpx;
  font-weight: 600;
}

.input-shell {
  display: flex;
  min-width: 0;
  height: 86rpx;
  flex: 1;
  align-items: center;
  gap: 12rpx;
  padding: 0 22rpx;
  border: 1rpx solid #dce7e0;
  border-radius: 14rpx;
  background: #fbfdfc;
  box-sizing: border-box;
}

.input-shell:focus-within {
  border-color: #159a5e;
  background: #fff;
}

.input-shell input {
  min-width: 0;
  flex: 1;
  color: #243d2e;
  font-size: 26rpx;
}

.prefix {
  padding-right: 12rpx;
  border-right: 1rpx solid #e1e9e4;
  color: #6e8275;
  font-size: 24rpx;
}

.code-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.code-button {
  width: 210rpx;
  height: 78rpx;
  border: 1rpx solid #a8d6ba;
  border-radius: 13rpx;
  background: #eff9f3;
  color: #117849;
  font-size: 22rpx;
  font-weight: 700;
}

.code-button[disabled] {
  opacity: .55;
}

.form-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 22rpx 2rpx 0;
  color: #7c8f83;
  font-size: 21rpx;
}

.remember {
  display: flex;
  align-items: center;
  gap: 7rpx;
}

.remember checkbox {
  transform: scale(.78);
}

.meta-link {
  color: #188454;
}

.inline-message {
  margin-top: 18rpx;
  padding: 16rpx 18rpx;
  border-radius: 12rpx;
  font-size: 22rpx;
  line-height: 1.55;
}

.inline-message.error {
  border: 1rpx solid #f2c5bf;
  background: #fff3f1;
  color: #b42318;
}

.inline-message.notice {
  border: 1rpx solid #b9dfc8;
  background: #effaf4;
  color: #14764a;
}

.primary-button {
  height: 88rpx;
  margin-top: 26rpx;
  border: none;
  border-radius: 14rpx;
  background: linear-gradient(135deg, #12764a, #19a361);
  color: #fff;
  font-size: 28rpx;
  font-weight: 700;
  letter-spacing: 3rpx;
  box-shadow: 0 12rpx 26rpx rgba(18, 118, 74, .2);
}

.primary-button[disabled] {
  opacity: .55;
}

.divider {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 0 28rpx;
  color: #95a39b;
  font-size: 20rpx;
}

.divider i {
  height: 1rpx;
  flex: 1;
  background: #edf1ee;
}

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
  border: none;
  background: transparent;
  color: #667a6e;
  font-size: 20rpx;
}

.third-icon {
  display: grid;
  width: 62rpx;
  height: 62rpx;
  place-items: center;
  border-radius: 18rpx;
  color: #fff;
  font-size: 26rpx;
  font-weight: 800;
}

.third-icon.wechat { background: #16a34a; }
.third-icon.alipay { background: #1677ff; }
.third-icon.gov { background: linear-gradient(135deg, #d9363e, #f05b42); }

.auth-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  padding: 24rpx 20rpx 30rpx;
  border-top: 1rpx solid #edf2ee;
  color: #819086;
  font-size: 22rpx;
}

.footer-link {
  color: #12804e;
  font-weight: 700;
}

.auth-bottom {
  display: grid;
  gap: 6rpx;
  padding: 28rpx 16rpx 0;
  color: #91a098;
  font-size: 19rpx;
  line-height: 1.5;
  text-align: center;
}
</style>
