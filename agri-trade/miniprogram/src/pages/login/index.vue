<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { computed, onUnmounted, ref } from 'vue'
import {
  finishTradeLogin,
  getTradeStatusBarHeight,
  getTradeToken,
  loginTrade,
  loginTradeBySms,
  loginTradeMfa,
  resetTradePassword,
  sendTradeSmsCode,
  tradeSsoWebUrl,
  type TradeLoginResult,
} from '../../auth'

type LoginTab = 'pwd' | 'sms'
const PHONE = /^1[3-9]\d{9}$/

const statusBarHeight = getTradeStatusBarHeight()
// 与当前生产管理登录页一致：默认账号密码，支持切换手机验证码。
const tab = ref<LoginTab>('pwd')
const account = ref('')
const password = ref('')
const phone = ref('')
const smsCode = ref('')
const remember = ref(true)
const submitting = ref(false)
const messageText = ref('')
const messageType = ref<'error' | 'notice'>('error')

/** 二次验证：账号开了验证器时，密码 / 短信通过后还要再输一次动态码。 */
const challengeToken = ref('')
const mfaCode = ref('')

/** 找回密码弹层 */
const resetOpen = ref(false)
const resetPhone = ref('')
const resetCode = ref('')
const resetPassword = ref('')
const resetConfirm = ref('')
const resetting = ref(false)
const resetMessage = ref('')
const resetMessageType = ref<'error' | 'notice'>('error')

/** 验证码倒计时（登录、找回密码各一个） */
const countdown = ref<Record<'login' | 'reset_password', number>>({ login: 0, reset_password: 0 })
const sending = ref<'' | 'login' | 'reset_password'>('')
const timers: Partial<Record<'login' | 'reset_password', ReturnType<typeof setInterval>>> = {}

const canSubmit = computed(() => {
  if (challengeToken.value) return /^\d{6}$/.test(mfaCode.value.trim())
  return tab.value === 'sms'
    ? PHONE.test(phone.value) && /^\d{6}$/.test(smsCode.value)
    : account.value.trim().length > 0 && password.value.length > 0
})

onLoad(() => {
  // 已有有效登录态（例如从其他页面误入登录页）直接回到原页面，不再要求重复登录。
  if (getTradeToken()) finishTradeLogin()
})

onUnmounted(() => {
  Object.values(timers).forEach((timer) => timer && clearInterval(timer))
})

function notice(text: string, type: 'error' | 'notice' = 'error') {
  messageType.value = type
  messageText.value = text
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function switchTab(next: LoginTab) {
  if (submitting.value) return
  tab.value = next
  notice('')
}

function startCountdown(scene: 'login' | 'reset_password') {
  countdown.value[scene] = 60
  if (timers[scene]) clearInterval(timers[scene])
  timers[scene] = setInterval(() => {
    countdown.value[scene] -= 1
    if (countdown.value[scene] <= 0) {
      clearInterval(timers[scene])
      timers[scene] = undefined
    }
  }, 1000)
}

async function requestCode(scene: 'login' | 'reset_password') {
  const target = scene === 'login' ? phone.value : resetPhone.value
  const say = scene === 'login' ? notice : resetNotice
  if (!PHONE.test(target)) { say('请输入正确的 11 位手机号'); return }
  if (sending.value || countdown.value[scene] > 0) return
  sending.value = scene
  say('')
  try {
    const result = await sendTradeSmsCode(target, scene)
    say(result?.hint || '验证码已发送', 'notice')
    startCountdown(scene)
  } catch (error) {
    say(errorText(error, '验证码发送失败'))
  } finally {
    sending.value = ''
  }
}

function codeLabel(scene: 'login' | 'reset_password') {
  if (sending.value === scene) return '发送中…'
  return countdown.value[scene] > 0 ? `${countdown.value[scene]}s 后重发` : '获取验证码'
}

async function afterLogin(result: TradeLoginResult) {
  if (!result.done) {
    challengeToken.value = result.challengeToken
    mfaCode.value = ''
    notice('该账号已开启二次验证，请输入验证器 App 上的 6 位动态码', 'notice')
    return
  }
  password.value = ''
  smsCode.value = ''
  mfaCode.value = ''
  challengeToken.value = ''
  uni.showToast({ title: '登录成功', icon: 'success' })
  finishTradeLogin()
}

async function submit() {
  if (submitting.value) return
  if (!canSubmit.value) {
    if (challengeToken.value) notice('请输入 6 位动态码')
    else notice(tab.value === 'sms' ? '请填写正确的手机号和 6 位验证码' : '请输入账号和密码')
    return
  }
  submitting.value = true
  notice('')
  try {
    if (challengeToken.value) {
      await afterLogin(await loginTradeMfa(challengeToken.value, mfaCode.value.trim(), remember.value))
    } else if (tab.value === 'sms') {
      await afterLogin(await loginTradeBySms(phone.value, smsCode.value, remember.value))
    } else {
      await afterLogin(await loginTrade(account.value.trim(), password.value, remember.value))
    }
  } catch (error) {
    // 二次验证的挑战码一次有效，失败后要回到第一步重新输入账号密码
    if (challengeToken.value) { challengeToken.value = ''; mfaCode.value = '' }
    notice(errorText(error, '登录失败，请稍后重试'))
  } finally {
    submitting.value = false
  }
}

function cancelMfa() {
  challengeToken.value = ''
  mfaCode.value = ''
  notice('')
}

function browse() {
  if (submitting.value) return
  uni.removeStorageSync('trade_return_to')
  uni.switchTab({ url: '/pages/home/index' })
}

function showThirdParty(name: string) {
  if (submitting.value) return
  uni.showModal({
    title: `${name}登录`,
    content: `${name}登录暂未开通，请使用账号密码或手机验证码登录。`,
    showCancel: false,
    confirmText: '我知道了',
  })
}

function openConnection() {
  if (submitting.value) return
  uni.showModal({
    title: '服务连接设置',
    content: '交易撮合 H5 与统一认证中心使用当前网关同源访问；微信小程序和 APP 请在发布配置中填写可访问的 HTTPS 网关地址，并登记合法域名。当前页面不支持在线修改服务地址。',
    showCancel: false,
    confirmText: '我知道了',
  })
}

function openRegister() {
  if (submitting.value) return
  // #ifdef H5
  const url = tradeSsoWebUrl('/register')
  if (url) { window.location.href = url; return }
  // #endif
  uni.showModal({
    title: '注册统一账号',
    content: '交易撮合使用丰链云统一账号，与生产管理等系统共用。请在丰链云统一认证中心或生产管理 APP 注册账号、创建经营主体，再由平台开通交易权限。',
    showCancel: false,
    confirmText: '我知道了',
  })
}

/* ---------- 找回密码 ---------- */
function resetNotice(text: string, type: 'error' | 'notice' = 'error') {
  resetMessageType.value = type
  resetMessage.value = text
}

function openReset() {
  if (submitting.value) return
  resetPhone.value = PHONE.test(phone.value) ? phone.value : PHONE.test(account.value.trim()) ? account.value.trim() : ''
  resetCode.value = ''
  resetPassword.value = ''
  resetConfirm.value = ''
  resetNotice('')
  resetOpen.value = true
}

function closeReset() {
  if (!resetting.value) resetOpen.value = false
}

async function submitReset() {
  if (resetting.value) return
  if (!PHONE.test(resetPhone.value)) { resetNotice('请输入正确的 11 位手机号'); return }
  if (!/^\d{6}$/.test(resetCode.value)) { resetNotice('请输入 6 位短信验证码'); return }
  if (!resetPassword.value) { resetNotice('请设置新密码'); return }
  if (resetPassword.value !== resetConfirm.value) { resetNotice('两次输入的密码不一致'); return }
  resetting.value = true
  resetNotice('')
  try {
    await resetTradePassword(resetPhone.value, resetCode.value, resetPassword.value, resetConfirm.value)
    resetOpen.value = false
    tab.value = 'pwd'
    account.value = resetPhone.value
    password.value = ''
    challengeToken.value = ''
    notice('密码已重置，所有设备上的旧登录已失效，请用新密码登录', 'notice')
  } catch (error) {
    resetNotice(errorText(error, '密码重置失败，请稍后重试'))
  } finally {
    resetting.value = false
  }
}
</script>

<template>
  <view class="auth-page">
    <view class="auth-hero" :style="{ paddingTop: `calc(${statusBarHeight}px + 38rpx)` }">
      <view class="brand-row">
        <image class="brand-mark" src="/static/fengchain.svg" mode="aspectFit" />
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
        <view class="flow-step"><text class="flow-no">01</text><text>登录账号</text></view>
        <view class="flow-line" />
        <view class="flow-step"><text class="flow-no">02</text><text>创建主体</text></view>
        <view class="flow-line" />
        <view class="flow-step"><text class="flow-no">03</text><text>认证开通</text></view>
      </view>
    </view>

    <view class="auth-card">
      <view v-if="challengeToken" class="form-block">
        <text class="mfa-title">二次验证</text>
        <text class="mfa-desc">打开已绑定的验证器 App，输入当前显示的 6 位动态码。</text>
        <view class="input-group">
          <text class="label">动态码</text>
          <view class="input-shell">
            <input :disabled="submitting" v-model="mfaCode" type="number" maxlength="6" focus placeholder="请输入 6 位动态码" confirm-type="done" @confirm="submit" />
          </view>
        </view>
        <view v-if="messageText" :class="['inline-message', messageType]">{{ messageText }}</view>
        <button class="primary-button" :disabled="submitting" @tap="submit">{{ submitting ? '验证中…' : '验证并登录' }}</button>
        <button class="text-button" :disabled="submitting" @tap="cancelMfa">返回重新输入账号</button>
      </view>

      <template v-else>
        <view class="auth-tabs">
          <button :disabled="submitting" :class="['auth-tab', { on: tab === 'sms' }]" @tap="switchTab('sms')">手机验证码</button>
          <button :disabled="submitting" :class="['auth-tab', { on: tab === 'pwd' }]" @tap="switchTab('pwd')">账号密码</button>
        </view>

        <view class="form-block">
          <template v-if="tab === 'pwd'">
            <view class="input-group">
              <text class="label">账号 / 手机号</text>
              <view class="input-shell">
                <input :disabled="submitting" v-model="account" maxlength="64" placeholder="请输入用户名或手机号" />
              </view>
            </view>
            <view class="input-group">
              <text class="label">登录密码</text>
              <view class="input-shell">
                <input :disabled="submitting" v-model="password" password maxlength="64" placeholder="请输入登录密码" confirm-type="done" @confirm="submit" />
              </view>
            </view>
          </template>

          <template v-else>
            <view class="input-group">
              <text class="label">手机号</text>
              <view class="input-shell">
                <text class="prefix">+86</text>
                <input :disabled="submitting" v-model="phone" type="number" maxlength="11" placeholder="请输入 11 位手机号" />
              </view>
            </view>
            <view class="input-group">
              <text class="label">短信验证码</text>
              <view class="code-row">
                <view class="input-shell">
                  <input :disabled="submitting" v-model="smsCode" type="number" maxlength="6" placeholder="请输入 6 位验证码" confirm-type="done" @confirm="submit" />
                </view>
                <button class="code-button" :disabled="submitting || sending === 'login' || countdown.login > 0" @tap="requestCode('login')">{{ codeLabel('login') }}</button>
              </view>
            </view>
          </template>

          <view class="form-meta">
            <view class="remember" @tap="!submitting && (remember = !remember)">
              <view :class="['check', { on: remember }]"><text v-if="remember">✓</text></view>
              <text>保持登录（有效期内）</text>
            </view>
            <text class="meta-link" @tap="openReset">忘记密码？</text>
          </view>

          <view v-if="messageText" :class="['inline-message', messageType]">{{ messageText }}</view>

          <button class="primary-button" :disabled="submitting" @tap="submit">{{ submitting ? '登录中…' : '登 录' }}</button>
          <button class="text-button" :disabled="submitting" @tap="browse">暂不登录，先逛逛交易大厅</button>
        </view>
      </template>

      <view v-if="!challengeToken" class="divider"><view /><text>其他登录方式</text><view /></view>
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

      <view class="auth-footer compact">
        <text class="footer-link" @tap="openConnection">服务连接设置</text>
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

    <view v-if="resetOpen" class="sheet-mask" @tap="closeReset">
      <view class="sheet" @tap.stop>
        <view class="sheet-head">
          <text class="sheet-title">找回密码</text>
          <view class="sheet-close" @tap="closeReset">×</view>
        </view>
        <scroll-view scroll-y class="sheet-body">
          <view class="sheet-body-inner reset-body">
            <text class="reset-tip">用统一账号绑定的手机号验证后重置密码，新密码对平台所有系统生效。</text>
            <view class="input-group">
              <text class="label">手机号</text>
              <view class="input-shell">
                <text class="prefix">+86</text>
                <input v-model="resetPhone" type="number" maxlength="11" placeholder="请输入绑定的手机号" />
              </view>
            </view>
            <view class="input-group">
              <text class="label">短信验证码</text>
              <view class="code-row">
                <view class="input-shell">
                  <input v-model="resetCode" type="number" maxlength="6" placeholder="请输入 6 位验证码" />
                </view>
                <button class="code-button" :disabled="sending === 'reset_password' || countdown.reset_password > 0" @tap="requestCode('reset_password')">{{ codeLabel('reset_password') }}</button>
              </view>
            </view>
            <view class="input-group">
              <text class="label">新密码</text>
              <view class="input-shell">
                <input v-model="resetPassword" password maxlength="64" placeholder="请设置新密码" />
              </view>
            </view>
            <view class="input-group">
              <text class="label">确认新密码</text>
              <view class="input-shell">
                <input v-model="resetConfirm" password maxlength="64" placeholder="请再次输入新密码" />
              </view>
            </view>
            <view v-if="resetMessage" :class="['inline-message', resetMessageType]">{{ resetMessage }}</view>
          </view>
        </scroll-view>
        <view class="sheet-foot">
          <button class="primary-button flat" :disabled="resetting" @tap="submitReset">{{ resetting ? '提交中…' : '重置密码' }}</button>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
/* 版式与生产管理移动端登录页（agri-production/miniprogram/src/pages/login/login.vue）保持一致。 */
.auth-page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 0 28rpx calc(42rpx + env(safe-area-inset-bottom));
  background:
    radial-gradient(circle at 92% 5%, rgba(67, 190, 121, .18), transparent 340rpx),
    linear-gradient(180deg, #0f5838 0, #13764a 500rpx, #f3f8f5 500rpx, #f3f8f5 100%);
}

.auth-hero { padding: 38rpx 12rpx 28rpx; color: #fff; }
.brand-row { display: flex; align-items: center; gap: 16rpx; }
.brand-mark { width: 66rpx; height: 66rpx; flex-shrink: 0; border-radius: 19rpx; background: linear-gradient(145deg, #dff8e8, #8fe0af); box-shadow: 0 12rpx 30rpx rgba(0, 0, 0, .12); }
.brand-name, .brand-en { display: block; }
.brand-name { font-size: 30rpx; font-weight: 800; letter-spacing: 2rpx; }
.brand-en { margin-top: 3rpx; color: rgba(255, 255, 255, .62); font-size: 24rpx; letter-spacing: 2rpx; }

.hero-copy { display: flex; flex-direction: column; gap: 8rpx; margin-top: 40rpx; }
.hero-kicker { color: #a7e9c3; font-size: 24rpx; letter-spacing: 2rpx; }
.hero-title { font-size: 48rpx; font-weight: 800; letter-spacing: 2rpx; }
.hero-desc { color: rgba(255, 255, 255, .72); font-size: 24rpx; line-height: 1.6; }

.hero-flow { display: flex; align-items: center; gap: 12rpx; margin-top: 34rpx; }
.flow-step { display: flex; flex-shrink: 0; align-items: center; gap: 7rpx; color: rgba(255, 255, 255, .82); font-size: 24rpx; }
.flow-no { display: flex; width: 36rpx; height: 36rpx; align-items: center; justify-content: center; border-radius: 50%; background: rgba(255, 255, 255, .14); color: #d7f8e4; font-size: 20rpx; font-weight: 800; }
.flow-line { height: 1rpx; min-width: 12rpx; flex: 1; background: rgba(255, 255, 255, .18); }

.auth-card { overflow: hidden; border: 1rpx solid rgba(218, 232, 223, .85); border-radius: 24rpx; background: #fff; box-shadow: 0 20rpx 60rpx rgba(21, 67, 43, .11); }

.auth-tabs { display: flex; gap: 8rpx; padding: 12rpx; background: #f7faf8; }
.auth-tab { display: flex; min-width: 0; min-height: 44px; flex: 1; align-items: center; justify-content: center; border-radius: 14rpx; color: #7b8c82; font-size: 28rpx; font-weight: 600; }
.auth-tab.on { background: #fff; color: #0f6d43; box-shadow: 0 4rpx 18rpx rgba(21, 67, 43, .08); }

.form-block { padding: 30rpx 28rpx 18rpx; }
.input-group + .input-group { margin-top: 24rpx; }
.label { display: block; margin-bottom: 10rpx; color: #40574a; font-size: 24rpx; font-weight: 600; }
.input-shell { display: flex; min-width: 0; min-height: 44px; height: 86rpx; flex: 1; align-items: center; gap: 12rpx; padding: 0 22rpx; border: 1rpx solid #dce7e0; border-radius: 14rpx; background: #fbfdfc; }
.input-shell:focus-within { border-color: #159a5e; background: #fff; }
.input-shell input { width: 100%; min-width: 0; min-height: 44px; height: 86rpx; flex: 1; color: #243d2e; font-size: 26rpx; }
.prefix { padding-right: 12rpx; border-right: 1rpx solid #e1e9e4; color: #6e8275; font-size: 24rpx; }
.code-row { display: flex; align-items: center; gap: 14rpx; }
.code-button { display: flex; width: 200rpx; min-height: 44px; height: 86rpx; flex-shrink: 0; align-items: center; justify-content: center; border: 1rpx solid #a8d6ba; border-radius: 14rpx; background: #eff9f3; color: #117849; font-size: 24rpx; font-weight: 700; }

.form-meta { display: flex; flex-wrap: wrap; gap: 0 12rpx; align-items: center; justify-content: space-between; margin: 14rpx 2rpx 0; color: #7c8f83; font-size: 24rpx; }
.remember { display: flex; min-height: 44px; align-items: center; gap: 12rpx; }
.check { display: flex; width: 34rpx; height: 34rpx; align-items: center; justify-content: center; border: 2rpx solid #b9cbbf; border-radius: 8rpx; background: #fff; color: #fff; font-size: 22rpx; line-height: 1; }
.check.on { border-color: #159a5e; background: #159a5e; }
.meta-link { display: flex; min-height: 44px; align-items: center; padding-left: 20rpx; color: #188454; }

.inline-message { margin-top: 12rpx; padding: 16rpx 18rpx; border-radius: 12rpx; font-size: 24rpx; line-height: 1.55; }
.inline-message.error { border: 1rpx solid #f2c5bf; background: #fff3f1; color: #b42318; }
.inline-message.notice { border: 1rpx solid #b9dfc8; background: #effaf4; color: #14764a; }

.primary-button { display: flex; width: 100%; min-height: 44px; height: 88rpx; align-items: center; justify-content: center; margin-top: 26rpx; border-radius: 14rpx; background: linear-gradient(135deg, #12764a, #19a361); color: #fff; font-size: 28rpx; font-weight: 700; letter-spacing: 3rpx; box-shadow: 0 12rpx 26rpx rgba(18, 118, 74, .2); }
.primary-button.flat { margin-top: 0; box-shadow: none; }
.text-button { display: flex; width: 100%; min-height: 44px; align-items: center; justify-content: center; margin-top: 8rpx; color: #12764a; font-size: 24rpx; }

.divider { display: flex; align-items: center; gap: 14rpx; padding: 0 28rpx; color: #95a39b; font-size: 24rpx; }
.divider view { height: 1rpx; flex: 1; background: #edf1ee; }
.third-party { display: flex; gap: 12rpx; padding: 22rpx 28rpx 10rpx; }
.third-party button { display: flex; min-width: 0; min-height: 48px; flex: 1; flex-direction: column; align-items: center; justify-content: center; gap: 8rpx; color: #667a6e; font-size: 24rpx; }
.third-icon { display: flex; width: 62rpx; height: 62rpx; align-items: center; justify-content: center; border-radius: 18rpx; color: #fff; font-size: 26rpx; font-weight: 800; }
.third-icon.wechat { background: #16a34a; }
.third-icon.alipay { background: #1677ff; }
.third-icon.gov { background: linear-gradient(135deg, #d9363e, #f05b42); }

.mfa-title { display: block; font-size: 34rpx; font-weight: 800; color: #17271e; }
.mfa-desc { display: block; margin: 8rpx 0 26rpx; color: #7c8f83; font-size: 24rpx; line-height: 1.6; }

.auth-footer { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 10rpx; padding: 12rpx 20rpx 18rpx; border-top: 1rpx solid #edf2ee; color: #819086; font-size: 24rpx; }
.auth-footer.compact { padding-top: 4rpx; padding-bottom: 4rpx; }
.footer-link { display: flex; min-height: 44px; align-items: center; color: #12804e; font-weight: 700; }

.auth-bottom { display: flex; flex-direction: column; gap: 6rpx; padding: 28rpx 16rpx 0; color: #91a098; font-size: 24rpx; line-height: 1.5; text-align: center; }

.reset-body { padding-top: 4rpx; }
.reset-tip { display: block; margin-bottom: 24rpx; color: #6e8275; font-size: 24rpx; line-height: 1.6; }
.sheet .input-shell { background: #fff; }

@media (max-width: 360px) {
  .form-block { padding-left: 20rpx; padding-right: 20rpx; }
  .code-row { gap: 10rpx; }
  .code-row .input-shell { padding-left: 14rpx; padding-right: 14rpx; }
  .hero-flow { gap: 8rpx; }
  .flow-step { gap: 4rpx; }
}
</style>
