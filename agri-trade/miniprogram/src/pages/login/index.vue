<template>
  <!-- #ifdef MP-WEIXIN -->
  <view v-if="state.view === 'home'" class="mp-entry" :class="{ 'mp-entry-shake': state.shaking }" :style="{ paddingTop: `${mpEntryNavigationBottom}px` }">
    <view class="mp-entry-brand">
      <image class="mp-entry-logo" src="/static/fengchain.svg" mode="aspectFit" />
      <text class="mp-entry-name">丰链云 · 交易撮合</text>
      <text class="mp-entry-sub">统一账号 · 供需对接与在线交易</text>
    </view>
    <view class="mp-entry-space" />
    <view class="mp-entry-actions">
      <button class="mp-entry-primary" :disabled="state.busy" @tap="mpQuickLogin()">
        <image class="mp-entry-wechat" src="/static/login/wechat-white.svg" mode="aspectFit" />
        <text>微信手机号快捷登录</text>
      </button>
      <button class="mp-entry-other" :disabled="state.busy" @tap="openView('sms')">其他手机号登录</button>
      <view class="mp-entry-consent" :class="{ 'mp-entry-error': state.agreeError }">
        <button class="mp-entry-toggle" role="checkbox" aria-label="我已阅读并同意用户协议和隐私政策" :disabled="state.busy" @tap="toggleAgree">
          <view class="mp-entry-circle" :class="{ 'mp-entry-checked': state.agreed }"><text v-if="state.agreed">✓</text></view>
        </button>
        <view class="mp-entry-copy">
          <text class="mp-entry-copy-toggle" @tap="toggleAgree">我已阅读并同意</text><text class="mp-entry-policy" @tap="showAgreement('用户协议')">《用户协议》</text><text>和</text><text class="mp-entry-policy" @tap="showAgreement('隐私政策')">《隐私政策》</text>
        </view>
      </view>
      <text class="mp-entry-footer">丰链云 · 交易撮合 提供</text>
    </view>
    <view v-if="state.toastText" class="mp-entry-toast" role="alert">{{ state.toastText }}</view>
  </view>
  <!-- #endif -->
  <view v-if="platform !== 'mp' || state.view !== 'home'" class="login h5-login-aligned is-card" :class="`is-${platform}`">
    <view class="screen" :class="{ 'is-shake': state.shaking }">
      <!-- #ifdef MP-WEIXIN -->
      <button class="mp-sms-back" :disabled="state.busy" @tap="openView('home')">‹ 返回登录方式</button>
      <!-- #endif -->
      <view class="hero" :style="{ paddingTop: `${statusBarHeight + 24}px` }">
        <image class="hero-logo" src="/static/fengchain.svg" mode="aspectFit" aria-hidden="true" />
        <text class="hero-name">丰链云 · 交易撮合</text>
        <text class="hero-sub">统一账号 · 供需对接与在线交易</text>
      </view>

      <view class="card">
        <view class="title-block">
          <text class="title">{{ title }}</text>
          <text class="sub">{{ subtitle }}</text>
        </view>

        <view v-if="state.view === 'mfa'" class="field" :class="{ 'is-focus': state.focused === 'mfa' }">
          <input v-model="state.mfaCode" class="field-input" :disabled="state.busy" :focus="true" :maxlength="20"
            placeholder="动态验证码或恢复码" confirm-type="done"
            @focus="state.focused = 'mfa'" @blur="state.focused = ''" @confirm="submit" />
        </view>

        <template v-else-if="state.view === 'sms'">
          <view class="field" :class="{ 'is-focus': state.focused === 'phone' }">
            <text class="field-prefix">+86</text>
            <input v-model="state.phoneInput" class="field-input" type="text" inputmode="numeric" :maxlength="13"
              :disabled="state.busy" placeholder="请输入手机号" confirm-type="next"
              @focus="state.focused = 'phone'" @blur="state.focused = ''" />
          </view>
          <view class="field" :class="{ 'is-focus': state.focused === 'code' }">
            <input v-model="state.smsCode" class="field-input" type="number" :maxlength="6" :disabled="state.busy"
              placeholder="请输入 6 位验证码" confirm-type="done"
              @focus="state.focused = 'code'" @blur="state.focused = ''" @confirm="submit" />
            <button class="field-btn" :disabled="state.busy || state.countdown > 0" @tap="requestCode">
              {{ state.sending ? '发送中…' : state.countdown ? `${state.countdown}s 后重发` : '获取验证码' }}
            </button>
          </view>
        </template>

        <template v-else>
          <view class="field" :class="{ 'is-focus': state.focused === 'user' }">
            <input v-model="state.username" class="field-input" :maxlength="64" :disabled="state.busy"
              placeholder="统一账号 / 手机号" confirm-type="next"
              @focus="state.focused = 'user'" @blur="state.focused = ''" />
          </view>
          <view class="field" :class="{ 'is-focus': state.focused === 'pwd' }">
            <input v-model="state.password" class="field-input" :password="!state.showPassword" :maxlength="128"
              :disabled="state.busy" placeholder="请输入登录密码" confirm-type="done"
              @focus="state.focused = 'pwd'" @blur="state.focused = ''" @confirm="submit" />
            <button class="eye" :aria-label="state.showPassword ? '隐藏密码' : '显示密码'" :disabled="state.busy"
              @tap="state.showPassword = !state.showPassword">
              <image v-if="state.showPassword" class="eye-icon" src="/static/login/eye.svg" mode="aspectFit" aria-hidden="true" />
              <image v-else class="eye-icon" src="/static/login/eye-off.svg" mode="aspectFit" aria-hidden="true" />
            </button>
          </view>
          <view v-if="state.rememberAvailable" class="row-between">
            <view class="check" role="checkbox" :aria-checked="state.rememberPassword" @tap="state.rememberPassword = !state.rememberPassword">
              <view class="box" :class="{ on: state.rememberPassword }" /><text>7 天内免登录</text>
            </view>
            <button class="link muted" @tap="passwordHelp">忘记密码</button>
          </view>
        </template>

        <view v-if="state.view === 'sms' && state.rememberAvailable" class="row-between">
          <view class="check" role="checkbox" :aria-checked="state.rememberPassword" @tap="state.rememberPassword = !state.rememberPassword">
            <view class="box" :class="{ on: state.rememberPassword }" /><text>7 天内免登录</text>
          </view>
        </view>

        <text v-if="state.message" aria-live="polite" class="feedback" :class="{ 'is-notice': state.messageType === 'notice' }">{{ state.message }}</text>

        <button class="btn btn-primary" :disabled="state.busy" @tap="submit">
          {{ state.submitting ? '验证中…' : state.view === 'mfa' ? '验证并登录' : '登录' }}
        </button>
        <button v-if="state.view !== 'mfa'" class="btn btn-outline btn-gap" :disabled="state.busy" @tap="browse">暂不登录，先逛逛交易大厅</button>

        <view v-if="state.view === 'mfa'" class="row-between after">
          <button class="link muted" :disabled="state.busy" @tap="returnToLogin">返回登录方式</button>
        </view>
        <view v-else-if="state.view === 'sms'" class="row-between after">
          <button v-if="platform !== 'mp'" class="link" :disabled="state.busy" @tap="openView('password')">密码登录</button>
          <!-- #ifdef H5 -->
          <button class="link muted" :disabled="state.busy" @tap="passwordHelp">忘记密码</button>
          <!-- #endif -->
          <!-- #ifndef H5 -->
          <button class="link muted" @tap="showCodeHelp">收不到验证码</button>
          <!-- #endif -->
        </view>
        <view v-else class="row-between after">
          <button class="link" :disabled="state.busy" @tap="openView('sms')">验证码登录</button>
          <button v-if="!state.rememberAvailable" class="link muted" @tap="passwordHelp">忘记密码</button>
        </view>

<!-- #ifndef H5 -->
        <!-- #ifndef MP-WEIXIN -->
        <view v-if="platform !== 'mp' && state.view !== 'mfa'" class="thirds-block">
          <view class="divider-text"><text>其他登录方式</text></view>
          <view class="thirds">
            <view class="third-item" role="button" aria-label="微信登录（待开通）" @tap="channelPending('微信')">
              <view class="third"><image src="/static/login/wechat.svg" mode="aspectFit" aria-hidden="true" /></view><text>微信</text>
            </view>
            <view class="third-item" role="button" aria-label="支付宝登录（待开通）" @tap="channelPending('支付宝')">
              <view class="third"><image src="/static/login/alipay.svg" mode="aspectFit" aria-hidden="true" /></view><text>支付宝</text>
            </view>
            <view class="third-item" role="button" aria-label="国家政务服务平台登录（待开通）" @tap="channelPending('国家政务服务平台')">
              <view class="third"><image src="/static/login/gov.svg" mode="aspectFit" aria-hidden="true" /></view><text>政务服务</text>
            </view>
          </view>
          <text class="alt-note">第三方登录待开通，暂请使用验证码或密码登录</text>
        </view>
        <!-- #endif -->
        <!-- #endif -->

        <!-- #ifdef H5 -->
        <view v-if="state.view !== 'mfa'" class="h5-thirds-block">
          <view class="h5-divider"><text>其他登录方式</text></view>
          <view class="h5-thirds">
            <button class="h5-third-button" :disabled="state.busy" aria-label="微信登录，暂未开通，查看说明" @tap="channelPending('微信')"><view class="h5-third-icon"><image src="/static/login/wechat.svg" mode="aspectFit" aria-hidden="true" /></view><text class="h5-third-label">微信登录</text><text class="h5-third-status">暂未开通</text></button>
            <button class="h5-third-button" :disabled="state.busy" aria-label="支付宝，暂未开通，查看说明" @tap="channelPending('支付宝')"><view class="h5-third-icon"><image src="/static/login/alipay.svg" mode="aspectFit" aria-hidden="true" /></view><text class="h5-third-label">支付宝</text><text class="h5-third-status">暂未开通</text></button>
            <button class="h5-third-button" :disabled="state.busy" aria-label="政务服务平台，暂未开通，查看说明" @tap="channelPending('国家政务服务平台')"><view class="h5-third-icon"><image src="/static/login/gov.svg" mode="aspectFit" aria-hidden="true" /></view><text class="h5-third-label">政务服务平台</text><text class="h5-third-status">暂未开通</text></button>
          </view>
        </view>
        <!-- #endif -->

        <!-- #ifdef H5 -->
        <view class="h5-consent" :class="{ 'is-error': state.agreeError }">
          <button class="h5-consent-toggle" role="checkbox" aria-label="我已阅读并同意用户协议与隐私政策" :aria-checked="state.agreed" :disabled="state.busy" @tap="toggleAgree"><view class="h5-dot" :class="{ 'is-checked': state.agreed }"><text v-if="state.agreed">✓</text></view></button>
          <view class="h5-consent-copy"><button class="h5-consent-text" :disabled="state.busy" @tap="toggleAgree">我已阅读并同意</button><button class="h5-policy" :disabled="state.busy" @tap="showAgreement('用户协议')">《用户协议》</button><text class="h5-joiner">和</text><button class="h5-policy" :disabled="state.busy" @tap="showAgreement('隐私政策')">《隐私政策》</button></view>
        </view>
        <text v-if="state.agreeError" class="h5-consent-error" role="alert">请先阅读并同意用户协议与隐私政策</text>
        <view v-if="state.view === 'sms'" class="h5-help"><text>验证码登录遇到问题？</text><button class="link" :disabled="state.busy" @tap="showCodeHelp">收不到验证码</button></view>
              <view class="extra">
        <text>还没有账号？</text>
        <button class="link strong" @tap="openRegister">注册账号 / 创建主体 →</button>
      </view>
        <!-- #endif -->

      </view>
      <!-- #ifndef H5 -->
      <view class="extra">
        <text>还没有账号？</text>
        <button class="link strong" @tap="openRegister">注册账号 / 创建主体 →</button>
      </view>
      <!-- #endif -->
      <!-- #ifdef H5 -->
      <view class="extra">
        <button class="link muted" @tap="openConnection">服务连接设置</button>
      </view>
      <!-- #endif -->
      <!-- #ifndef H5 -->
      <view class="extra">
        <button class="link muted" @tap="openConnection">服务连接设置</button>
      </view>
      <!-- #endif -->

      <view class="push" />
      <!-- #ifdef MP-WEIXIN -->
      <view class="mp-sms-consent" :class="{ 'mp-entry-error': state.agreeError }">
        <button class="mp-sms-toggle" role="checkbox" aria-label="我已阅读并同意用户协议与隐私政策" :disabled="state.busy" @tap="toggleAgree"><view class="mp-entry-circle" :class="{ 'mp-entry-checked': state.agreed }"><text v-if="state.agreed">✓</text></view></button>
        <view class="mp-sms-copy"><text @tap="toggleAgree">我已阅读并同意</text><text class="mp-entry-policy" @tap="showAgreement('用户协议')">《用户协议》</text><text>和</text><text class="mp-entry-policy" @tap="showAgreement('隐私政策')">《隐私政策》</text></view>
      </view>
      <!-- #endif -->
      <!-- #ifndef H5 -->
      <!-- #ifndef MP-WEIXIN -->
      <view class="agree" :class="{ 'is-error': state.agreeError }">
        <view class="agree-box" role="checkbox" :aria-checked="state.agreed" :class="{ on: state.agreed }" @tap="toggleAgree" />
        <text class="agree-text">
          <text class="agree-toggle" @tap="toggleAgree">我已阅读并同意</text>
          <text class="agree-link" @tap="showAgreement('用户协议')">《用户协议》</text>
          <text class="agree-toggle" @tap="toggleAgree">和</text>
          <text class="agree-link" @tap="showAgreement('隐私政策')">《隐私政策》</text>
        </text>
      </view>
      <!-- #endif -->
      <!-- #endif -->
      <text class="foot">主体认证通过后，方可开通完整经营权限</text>
    </view>

    <view class="toast" :class="{ 'is-on': state.toastText }">{{ state.toastText }}</view>

    <view v-if="reset.open" class="sheet-mask" @tap="closeReset">
      <view class="sheet" @tap.stop>
        <view class="sheet-head">
          <text class="sheet-title">找回密码</text>
          <button class="sheet-close" aria-label="关闭" @tap="closeReset">×</button>
        </view>
        <text class="sheet-tip">用统一账号绑定的手机号验证后重置密码，新密码对平台所有系统生效。</text>
        <view class="field">
          <text class="field-prefix">+86</text>
          <input v-model="reset.phone" class="field-input" type="number" :maxlength="11" placeholder="请输入绑定的手机号" />
        </view>
        <view class="field">
          <input v-model="reset.code" class="field-input" type="number" :maxlength="6" placeholder="请输入 6 位验证码" />
          <button class="field-btn" :disabled="reset.sending || reset.countdown > 0" @tap="requestResetCode">
            {{ reset.sending ? '发送中…' : reset.countdown ? `${reset.countdown}s 后重发` : '获取验证码' }}
          </button>
        </view>
        <view class="field">
          <input v-model="reset.password" class="field-input" password :maxlength="64" placeholder="请设置新密码" />
        </view>
        <view class="field">
          <input v-model="reset.confirm" class="field-input" password :maxlength="64" placeholder="请再次输入新密码" />
        </view>
        <text v-if="reset.message" class="feedback" :class="{ 'is-notice': reset.messageType === 'notice' }">{{ reset.message }}</text>
        <button class="btn btn-primary" :disabled="reset.submitting" @tap="submitReset">{{ reset.submitting ? '提交中…' : '重置密码' }}</button>
      </view>
    </view>
    <view v-if="state.privacyVisible" class="mask">
      <view class="dialog">
        <text class="dialog-title">用户隐私保护提示</text>
        <text class="dialog-text">登录时将使用你主动填写的账号、手机号及验证信息完成统一身份核验，并保存登录会话。业务所需的定位、相机和相册权限将在使用对应功能时单独申请。</text>
        <text class="dialog-text">请阅读<text class="agree-link" @tap="showAgreement('用户协议')">《用户协议》</text>及<text class="agree-link" @tap="showAgreement('隐私政策')">《隐私政策》</text>。若无法获取正式全文，可暂不同意并联系平台运营。</text>
        <view class="dialog-actions">
          <button class="btn btn-outline" @tap="login.refusePrivacy">不同意</button>
          <button class="btn btn-primary" @tap="login.acceptPrivacy">同意并继续</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
let mpEntryNavigationBottom = 64
// #ifdef MP-WEIXIN
mpEntryNavigationBottom = Number(uni.getSystemInfoSync().statusBarHeight || 20) + 44
try { const rect = uni.getMenuButtonBoundingClientRect(); if (rect?.bottom) mpEntryNavigationBottom = rect.bottom + 8 } catch { /* 保留状态栏回退值 */ }
// #endif
import { computed, reactive } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import {
  finishTradeLogin,
  getTradeToken,
  loginTrade,
  loginTradeBySms,
  loginTradeMfa,
  resetTradePassword,
  sendTradeSmsCode,
  tradeSsoWebUrl,
  type TradeLoginResult,
} from '../../auth'
import {
  createLoginState, createMobileLogin, errorText, PHONE_PATTERN, showAgreement, showCodeHelp,
  type LoginOutcome, type LoginPlatform, type MobileLoginOptions,
} from '../../../../../packages/agri-shared/src/auth/mobileLogin'

function detectPlatform(): LoginPlatform {
  let value: LoginPlatform = 'h5'
  // #ifdef MP-WEIXIN
  value = 'mp'
  // #endif
  // #ifdef APP-PLUS
  value = 'app'
  // #endif
  return value
}

const platform = detectPlatform()
const statusBarHeight = Number(uni.getSystemInfoSync().statusBarHeight || 0)

function outcome(result: TradeLoginResult): LoginOutcome {
  return result.done ? { mfa: false } : { mfa: true, challengeToken: result.challengeToken }
}

const options: MobileLoginOptions = { platform, privacyKey: 'agri_trade_miniprogram_privacy_notice_v2' }
// #ifdef MP-WEIXIN
options.entryView = 'home'
// #endif
const state = reactive(createLoginState(options))
const login = createMobileLogin(state, {
  sendSmsCode: async (phone) => (await sendTradeSmsCode(phone, 'login'))?.hint,
  loginBySms: async (phone, code, remember) => outcome(await loginTradeBySms(phone, code, remember)),
  loginByPassword: async (name, secret, remember) => outcome(await loginTrade(name, secret, remember)),
  completeMfa: async (challenge, code, remember) => outcome(await loginTradeMfa(challenge, code, remember)),
  onSuccess: () => {
    uni.showToast({ title: '登录成功', icon: 'success' })
    finishTradeLogin()
  },
}, options)
const { toggleAgree, openView, returnToLogin, requestCode, submit, channelPending } = login

const title = computed(() => state.view === 'mfa' ? '二次验证' : state.view === 'sms' ? '手机号登录' : '密码登录')
const subtitle = computed(() => state.view === 'mfa'
  ? '请输入身份验证器中的动态验证码或恢复码'
  : '与生产管理等子系统共用丰链云统一账号')

onLoad(() => {
  // 已有有效登录态（例如从其他页面误入登录页）直接回到原页面，不再要求重复登录。
  if (getTradeToken()) finishTradeLogin()
})

function browse() {
  if (state.busy) return
  uni.removeStorageSync('trade_return_to')
  uni.switchTab({ url: '/pages/home/index' })
}

function openConnection() {
  if (state.busy) return
  uni.showModal({
    title: '服务连接设置',
    content: '交易撮合 H5 与统一认证中心使用当前网关同源访问；微信小程序和 APP 请在发布配置中填写可访问的 HTTPS 网关地址，并登记合法域名。当前页面不支持在线修改服务地址。',
    showCancel: false,
    confirmText: '我知道了',
  })
}

function openRegister() {
  if (state.busy) return
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

/* ---------- 找回密码（手机验证码重置统一账号密码） ---------- */
const reset = reactive({
  open: false, phone: '', code: '', password: '', confirm: '',
  submitting: false, sending: false, countdown: 0, message: '', messageType: 'error' as 'error' | 'notice',
})
let resetTimer: ReturnType<typeof setInterval> | undefined

function resetSay(text: string, type: 'error' | 'notice' = 'error') {
  reset.messageType = type
  reset.message = text
}

function passwordHelp() {
  if (state.busy) return
  const account = state.username.trim()
  reset.phone = state.validPhone ? state.phoneDigits : PHONE_PATTERN.test(account) ? account : ''
  reset.code = ''
  reset.password = ''
  reset.confirm = ''
  resetSay('')
  reset.open = true
}

function closeReset() {
  if (!reset.submitting) reset.open = false
}

async function requestResetCode() {
  if (reset.sending || reset.countdown) return
  if (!PHONE_PATTERN.test(reset.phone)) return resetSay('请输入正确的 11 位手机号')
  reset.sending = true
  resetSay('')
  try {
    const result = await sendTradeSmsCode(reset.phone, 'reset_password')
    resetSay(result?.hint || '验证码已发送', 'notice')
    const until = Date.now() + 60000
    reset.countdown = 60
    clearInterval(resetTimer)
    resetTimer = setInterval(() => {
      reset.countdown = Math.max(0, Math.ceil((until - Date.now()) / 1000))
      if (!reset.countdown) clearInterval(resetTimer)
    }, 1000)
  } catch (error) {
    resetSay(errorText(error, '验证码发送失败'))
  } finally {
    reset.sending = false
  }
}

async function submitReset() {
  if (reset.submitting) return
  if (!PHONE_PATTERN.test(reset.phone)) return resetSay('请输入正确的 11 位手机号')
  if (!/^\d{6}$/.test(reset.code)) return resetSay('请输入 6 位短信验证码')
  if (!reset.password) return resetSay('请设置新密码')
  if (reset.password !== reset.confirm) return resetSay('两次输入的密码不一致')
  reset.submitting = true
  resetSay('')
  try {
    await resetTradePassword(reset.phone, reset.code, reset.password, reset.confirm)
    reset.open = false
    openView('password')
    state.username = reset.phone
    login.say('密码已重置，所有设备上的旧登录已失效，请用新密码登录', 'notice')
  } catch (error) {
    resetSay(errorText(error, '密码重置失败，请稍后重试'))
  } finally {
    reset.submitting = false
  }
}

onUnload(() => {
  clearInterval(resetTimer)
  login.dispose()
})
// 小程序快捷入口先校验协议；服务端尚未提供手机号授权兑换接口。
function mpQuickLogin() {
  if (state.busy || !login.ensureAgreed()) return
  login.toast('微信手机号快捷登录暂未开通，请使用其他手机号登录')
}
</script>

<style scoped src="../../../../../packages/agri-shared/src/styles/mobile-login.css"></style>
<style scoped>
/* 找回密码底部弹层 */
.sheet-mask { position: fixed; inset: 0; z-index: 40; display: flex; align-items: flex-end; background: rgba(0, 0, 0, .45); }
.sheet { width: 100%; max-height: 86vh; padding: 18px 20px calc(18px + env(safe-area-inset-bottom)); border-radius: 18px 18px 0 0; background: #ffffff; }
.sheet-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.sheet-title { font-size: 16px; font-weight: 700; }
.sheet-close { width: 32px; height: 32px; font-size: 22px; line-height: 30px !important; color: var(--ink3) !important; text-align: center; }
.sheet-tip { display: block; margin-bottom: 14px; color: var(--ink3); font-size: 12px; line-height: 1.6; }
@media (min-width: 540px) { .sheet { max-width: 480px; margin: 0 auto; } }
</style>

<style scoped>
/* #ifdef MP-WEIXIN */
.mp-sms-back { display: flex; align-items: center; min-height: 48px; margin-top: 52px; color: #2d8f4e; font-size: 14px; background: transparent; }
/* #endif */
</style>

<style scoped src="../../../../../packages/agri-shared/src/styles/mp-login-entry.css"></style>
