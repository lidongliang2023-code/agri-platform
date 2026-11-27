<template>
  <!-- #ifdef MP-WEIXIN -->
  <view v-if="state.view === 'home'" class="mp-entry" :class="{ 'mp-entry-shake': state.shaking }" :style="{ paddingTop: `${mpEntryNavigationBottom}px` }">
    <view class="mp-entry-brand">
      <image class="mp-entry-logo" src="/static/fengchain.svg" mode="aspectFit" />
      <text class="mp-entry-name">丰链云 · 生产管理</text>
      <text class="mp-entry-sub">产地直连 · 全链协同</text>
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
      <text class="mp-entry-footer">丰链云 · 生产管理 提供</text>
    </view>
    <view v-if="state.toastText" class="mp-entry-toast" role="alert">{{ state.toastText }}</view>
  </view>
  <!-- #endif -->
  <view v-if="platform !== 'mp' || state.view !== 'home'" class="login prod-login" :class="`is-${platform}`">
    <view class="pl-screen" :class="{ 'pl-home': state.view === 'home', 'is-shake': state.shaking }" :style="{ paddingTop: `${platform === 'mp' ? navigationBottom : statusBarHeight + 16}px` }">
      <view v-if="platform === 'mp' && state.view !== 'home'" class="pl-nav">
        <button class="pl-back" aria-label="返回登录入口" :disabled="state.busy" @tap="backToEntry">‹</button>
      </view>
      <view class="pl-brand">
        <image class="pl-logo" src="/static/fengchain.svg" mode="aspectFit" aria-hidden="true" />
        <text class="pl-brand-name">丰链云 · 生产管理</text>
        <text class="pl-brand-sub">产地直连 · 全链协同</text>
      </view>

      <view v-if="isH5 && callbackActive" class="pl-form">
        <text class="pl-title">正在完成统一登录</text>
        <text class="pl-sub">正在校验授权并恢复生产管理会话，请稍候</text>
        <text v-if="ssoError" class="pl-feedback" role="alert">{{ ssoError }}</text>
        <button v-if="ssoError" class="pl-primary" @tap="returnToLocalLogin">返回手机号登录</button>
      </view>
      <view v-else class="pl-auth-card" :class="{ 'pl-form': state.view !== 'home' }">
        <view v-if="state.view === 'home'" class="pl-entry">
          <text class="pl-entry-note">管好每块田，记好每次农事</text>
          <button class="pl-primary" :disabled="state.busy" @tap="openView('sms')">手机号验证码登录</button>
          <button class="pl-secondary" :disabled="state.busy" @tap="openRegister">注册账号 / 创建主体</button>
        </view>
        <view v-else class="pl-fields">
          <view class="pl-heading"><text class="pl-title">{{ title }}</text><text class="pl-sub">{{ subtitle }}</text></view>
          <template v-if="state.view === 'mfa'">
            <view class="pl-field" :class="{ 'is-focus': state.focused === 'mfa' }">
              <input v-model="state.mfaCode" class="pl-input" aria-label="动态验证码或恢复码" :disabled="state.busy" :focus="true" :maxlength="20" :cursor-spacing="24" placeholder="动态验证码或恢复码" placeholder-class="pl-placeholder" confirm-type="done" @focus="state.focused = 'mfa'" @blur="state.focused = ''" @confirm="submit" />
            </view>
          </template>
          <template v-else-if="state.view === 'sms'">
            <view class="pl-field" :class="{ 'is-focus': state.focused === 'phone' }">
              <text class="pl-prefix">+86</text>
              <input v-model="state.phoneInput" class="pl-input" aria-label="手机号" type="tel" :maxlength="13" :disabled="state.busy" :cursor-spacing="24" placeholder="请输入手机号" placeholder-class="pl-placeholder" confirm-type="next" @focus="state.focused = 'phone'; codeFocused = false" @blur="state.focused = ''" @confirm="codeFocused = true" />
            </view>
            <view class="pl-field" :class="{ 'is-focus': state.focused === 'code' }">
              <input v-model="state.smsCode" class="pl-input" aria-label="短信验证码" type="number" :maxlength="6" :disabled="state.busy" :focus="codeFocused" :cursor-spacing="24" placeholder="请输入 6 位验证码" placeholder-class="pl-placeholder" confirm-type="done" @focus="state.focused = 'code'" @blur="state.focused = ''; codeFocused = false" @confirm="submit" />
              <button class="pl-code" :disabled="state.busy || state.countdown > 0" @tap="requestCode">{{ state.sending ? '发送中…' : state.countdown ? `${state.countdown}s 后重发` : '获取验证码' }}</button>
            </view>
          </template>
          <template v-else-if="state.view === 'password' && platform !== 'mp'">
            <view class="pl-field" :class="{ 'is-focus': state.focused === 'user' }">
              <input v-model="state.username" class="pl-input" aria-label="统一账号或手机号" :maxlength="64" :disabled="state.busy" placeholder="统一账号 / 手机号" placeholder-class="pl-placeholder" confirm-type="next" @focus="state.focused = 'user'" @blur="state.focused = ''" />
            </view>
            <view class="pl-field" :class="{ 'is-focus': state.focused === 'pwd' }">
              <input v-model="state.password" class="pl-input" aria-label="登录密码" :password="!state.showPassword" :maxlength="128" :disabled="state.busy" placeholder="请输入登录密码" placeholder-class="pl-placeholder" confirm-type="done" @focus="state.focused = 'pwd'" @blur="state.focused = ''" @confirm="submit" />
              <button class="pl-eye" :aria-label="state.showPassword ? '隐藏密码' : '显示密码'" :disabled="state.busy" @tap="state.showPassword = !state.showPassword"><image :src="state.showPassword ? '/static/login/eye.svg' : '/static/login/eye-off.svg'" mode="aspectFit" /></button>
            </view>
          </template>
          <view v-if="state.rememberAvailable && state.view !== 'mfa'" class="pl-remember">
            <button class="pl-check-action" role="checkbox" :disabled="state.busy" @tap="state.rememberPassword = !state.rememberPassword"><view class="pl-dot" :class="{ 'is-checked': state.rememberPassword }"><text v-if="state.rememberPassword">✓</text></view><text>7 天内免登录</text></button>
          </view>
          <text v-if="state.message" class="pl-feedback" :class="{ 'is-notice': state.messageType === 'notice' }" role="alert">{{ state.message }}</text>
          <button class="pl-primary" :disabled="state.busy" :loading="state.submitting" @tap="submit">{{ state.completed ? '正在进入…' : state.submitting ? '正在验证…' : state.view === 'mfa' ? '验证并登录' : '登录' }}</button>
          <view class="pl-actions">
            <button v-if="state.view === 'mfa'" class="pl-link" :disabled="state.busy" @tap="returnToLogin">返回登录方式</button>
            <template v-else>
              <button v-if="platform !== 'mp'" class="pl-link" :disabled="state.busy" @tap="openView(state.view === 'sms' ? 'password' : 'sms')">{{ state.view === 'sms' ? '密码登录' : '验证码登录' }}</button>
              <button v-else class="pl-link" :disabled="state.busy" @tap="backToEntry">其他登录选项</button>
              <button v-if="platform !== 'mp'" class="pl-link pl-muted" :disabled="state.busy" @tap="passwordHelp">忘记密码</button>
            </template>
          </view>

        </view>
        <!-- #ifndef MP-WEIXIN -->
        <view v-if="!callbackActive && state.view !== 'mfa'" class="pl-third-party">
          <view class="pl-third-divider"><text>其他登录方式</text></view>
          <view class="pl-third-options">
            <button v-for="provider in thirdPartyProviders" :key="provider.id" class="pl-third-button" :disabled="state.busy" :aria-label="`${provider.label}，暂未开通，查看说明`" @tap="showThirdPartyNotice(provider)">
              <view class="pl-third-icon" :class="`pl-third-${provider.id}`"><image :src="provider.icon" mode="aspectFit" aria-hidden="true" /></view>
              <text class="pl-third-label">{{ provider.label }}</text>
              <text class="pl-third-status">暂未开通</text>
            </button>
          </view>
          <text v-if="thirdPartyNotice" class="pl-third-notice" role="status" aria-live="polite">{{ thirdPartyNotice }}</text>
        </view>
        <!-- #endif -->
        <!-- #ifdef MP-WEIXIN -->
        <view class="mp-sms-consent" :class="{ 'mp-entry-error': state.agreeError }">
          <button class="mp-sms-toggle" role="checkbox" aria-label="我已阅读并同意用户协议与隐私政策" :disabled="state.busy" @tap="toggleAgree"><view class="mp-entry-circle" :class="{ 'mp-entry-checked': state.agreed }"><text v-if="state.agreed">✓</text></view></button>
          <view class="mp-sms-copy"><text @tap="toggleAgree">我已阅读并同意</text><text class="mp-entry-policy" @tap="showAgreement('用户协议')">《用户协议》</text><text>和</text><text class="mp-entry-policy" @tap="showAgreement('隐私政策')">《隐私政策》</text></view>
        </view>
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <view class="pl-consent" :class="{ 'is-error': state.agreeError }">
          <button class="pl-consent-toggle" role="checkbox" aria-label="我已阅读并同意用户协议与隐私政策" :disabled="state.busy" @tap="toggleAgree"><view class="pl-dot" :class="{ 'is-checked': state.agreed }"><text v-if="state.agreed">✓</text></view></button>
          <view class="pl-consent-copy"><view class="pl-consent-line"><button class="pl-consent-text" :disabled="state.busy" @tap="toggleAgree">我已阅读并同意</button><button class="pl-policy" :disabled="state.busy" @tap="showAgreement('用户协议')">《用户协议》</button><text class="pl-policy-joiner">和</text><button class="pl-policy" :disabled="state.busy" @tap="showAgreement('隐私政策')">《隐私政策》</button></view></view>
        </view>
        <!-- #endif -->
        <text v-if="state.agreeError" class="pl-consent-error" role="alert">请先阅读并同意用户协议与隐私政策</text>
          <view v-if="state.view === 'sms'" class="pl-help-panel"><text>验证码登录遇到问题？</text><button class="pl-link" :disabled="state.busy" @tap="showCodeHelp">收不到验证码</button></view>
          <view v-if="platform !== 'mp' && state.view !== 'mfa'" class="pl-register"><text>还没有账号？</text><button class="pl-link" :disabled="state.busy" @tap="openRegister">注册账号 / 创建主体</button></view>
      </view>

      <view class="pl-bottom">
        <text class="pl-foot">农业产业互联网平台 · 统一账号安全登录</text>
        <button class="pl-connection" :disabled="state.busy" @tap="openConnection">服务连接设置</button>
      </view>
    </view>
    <view class="toast" :class="{ 'is-on': state.toastText }">{{ state.toastText }}</view>
    <view v-if="state.privacyVisible" class="mask">
      <view class="dialog">
        <text class="dialog-title">用户隐私保护提示</text>
        <text class="dialog-text">登录时将使用你主动填写的账号、手机号及验证信息完成统一身份核验，并保存登录会话。业务所需的定位、相机和相册权限将在使用对应功能时单独申请。</text>
        <text class="dialog-text">请阅读<text class="agree-link" @tap="showAgreement('用户协议')">《用户协议》</text>及<text class="agree-link" @tap="showAgreement('隐私政策')">《隐私政策》</text>。若无法获取正式全文，可暂不同意并联系平台运营。</text>
        <view class="dialog-actions"><button class="btn btn-outline" @tap="login.refusePrivacy">不同意</button><button class="btn btn-primary" @tap="login.acceptPrivacy">同意并继续</button></view>
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
import { computed, reactive, ref } from 'vue'
import { onShow, onUnload } from '@dcloudio/uni-app'
import { isLoggedIn } from '@/utils/auth'
import { workspaceMode } from '@/utils/workspace'
import {
  completeMfaLogin,
  getOnboardingStatus,
  isMfaChallenge,
  listFarms,
  login as loginByPassword,
  loginBySms,
  sendSmsCode,
  setCurrentFarm,
  type MobileUser,
} from '@/utils/auth-helper'
import { exchangeSsoCallback, isH5SsoCallback } from '@/utils/sso'
import {
  createLoginState, createMobileLogin, errorText, showAgreement, showCodeHelp, showPasswordHelp,
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

type Entered = { stage?: string | null; user: MobileUser }

const platform = detectPlatform()
const isH5 = platform === 'h5'
const statusBarHeight = Number(uni.getSystemInfoSync().statusBarHeight || 0)
const codeFocused = ref(false)
// 当前服务端未接入第三方 OAuth，不模拟授权或登录成功。
const thirdPartyProviders = [
  { id: 'wechat', label: '微信登录', icon: '/static/login/wechat.svg', notice: '微信登录暂未开通，请先使用手机号或密码登录。开通需要接入微信授权服务并配置应用与回调域名。' },
  { id: 'alipay', label: '支付宝', icon: '/static/login/alipay.svg', notice: '支付宝登录暂未开通，请先使用手机号或密码登录。开通需要接入支付宝授权服务并配置应用与回调地址。' },
  { id: 'gov', label: '政务服务平台', icon: '/static/login/gov.svg', notice: '政务服务平台登录暂未开通，请先使用手机号或密码登录。开通需要确认对接的政务平台并完成统一身份认证接入。' },
] as const
const thirdPartyNotice = ref('')
function showThirdPartyNotice(provider: typeof thirdPartyProviders[number]): void {
  if (state.busy) return
  thirdPartyNotice.value = platform === 'mp'
    ? provider.notice.replace('手机号或密码登录', '手机号验证码登录')
    : provider.notice
}
// 自定义导航：内容从胶囊下缘之后开始，避免刘海和右上角系统按钮遮挡。
let navigationBottom = statusBarHeight + 44
// #ifdef MP-WEIXIN
try {
  const capsule = uni.getMenuButtonBoundingClientRect()
  if (capsule && capsule.height > 0 && capsule.top >= statusBarHeight) {
    navigationBottom = capsule.bottom + Math.max(8, capsule.top - statusBarHeight)
  }
} catch { /* 无胶囊信息时使用状态栏 + 44px 导航栏。 */ }
// #endif


/* 仅兼容升级前已经发起的 H5 授权回调；新登录统一使用下方共享表单。 */
const callbackActive = ref(isH5 && isH5SsoCallback())
const ssoError = ref('')
let ssoHandled = false

async function enterWorkbench(): Promise<void> {
  if (workspaceMode() === 'ops') { uni.reLaunch({ url: '/pages/business/business' }); return }
  try {
    const farms = await listFarms()
    if (farms.length > 0) setCurrentFarm(farms[0])
  } catch {
    uni.setStorageSync('agri_scope_notice', '登录成功，农场暂未加载，请在我的页面选择主体或重试')
  }
  uni.reLaunch({ url: '/pages/workbench/workbench' })
}

/** 主体未建或未认证时进入注册与认证流程，否则进入工作台。 */
async function handleStage(stage: string | null | undefined): Promise<void> {
  if (workspaceMode() !== 'ops' && stage && stage !== 'done') {
    uni.redirectTo({ url: `/pages/register/register?step=${stage === 'subject' ? 2 : 3}` })
    return
  }
  await enterWorkbench()
}

async function stageOf(fallback?: string | null): Promise<string | null | undefined> {
  return (await getOnboardingStatus().catch(() => ({ stage: fallback ?? 'done' })))?.stage
}

/* ---------- H5 / 小程序 / APP：共用统一认证表单与登录规则 ---------- */
const options: MobileLoginOptions = { platform, entryView: platform === 'mp' ? 'home' : 'sms', privacyKey: 'agri_production_miniprogram_privacy_notice_v2' }
// #ifdef MP-WEIXIN
options.entryView = 'home'
// #endif
const state = reactive(createLoginState(options))
const login = createMobileLogin<Entered>(state, {
  sendSmsCode: async (phone) => (await sendSmsCode(phone, 'login'))?.hint,
  loginBySms: async (phone, code, remember): Promise<LoginOutcome<Entered>> => {
    const result = await loginBySms({ phone, code, marketId: 1, remember })
    if (isMfaChallenge(result)) return { mfa: true, challengeToken: result.challengeToken }
    return { mfa: false, data: { stage: result.stage, user: result.user } }
  },
  loginByPassword: async (username, password, remember): Promise<LoginOutcome<Entered>> => {
    const user = await loginByPassword({ username, password, marketId: 1, remember })
    if (isMfaChallenge(user)) return { mfa: true, challengeToken: user.challengeToken }
    return { mfa: false, data: { stage: await stageOf('done'), user } }
  },
  completeMfa: async (challenge, code, remember): Promise<LoginOutcome<Entered>> => {
    const result = await completeMfaLogin(challenge, code, remember)
    return { mfa: false, data: { stage: await stageOf(result.stage), user: result.user } }
  },
  onSuccess: (entered) => handleStage(entered?.stage),
}, options)
const { toggleAgree, returnToLogin, requestCode, submit } = login
function openView(next: import('../../../../../packages/agri-shared/src/auth/mobileLogin').LoginView): void {
  if (state.busy) return
  login.openView(next)
  // 页面切换完成后显式清除本地校验反馈；不改变用户的协议选择。
  state.agreeError = false
  state.shaking = false
  state.toastText = ''
}

const title = computed(() => state.view === 'mfa' ? '身份验证' : state.view === 'sms' ? '手机号登录' : '密码登录')
const subtitle = computed(() => state.view === 'mfa'
  ? '请输入身份验证器中的动态验证码或恢复码'
  : state.view === 'sms' ? '使用已注册手机号，管理地块与农事任务' : '使用平台统一账号，进入生产管理工作台')

function clearLegacyCallbackUrl(): void {
  if (!isH5 || !isH5SsoCallback()) return
  const base = window.location.pathname.replace(/sso\/callback\/?$/, '')
  window.history.replaceState({}, document.title, `${base}#/pages/login/login`)
}

function returnToLocalLogin(): void {
  clearLegacyCallbackUrl()
  callbackActive.value = false
  ssoError.value = ''
  state.submitting = false
  openView('sms')
}

async function handleSsoCallback(): Promise<void> {
  if (!isH5 || !callbackActive.value || ssoHandled) return
  ssoHandled = true
  state.submitting = true
  ssoError.value = ''
  try {
    await exchangeSsoCallback()
    callbackActive.value = false
    // 清理授权码，避免刷新时重复换票；保留 uni-app 的 hash 首页入口。
    clearLegacyCallbackUrl()
    await handleStage(await stageOf('done'))
  } catch (error) {
    ssoError.value = errorText(error, '统一登录失败，请重新登录')
  } finally {
    state.submitting = false
  }
}

function backToEntry(): void {
  if (state.busy) return
  if (state.view === 'mfa') returnToLogin()
  else openView('home')
}

function leaveForm(): void {
  if (state.view === 'mfa') returnToLogin()
}
function openConnection(): void {
  if (state.busy) return
  leaveForm()
  uni.navigateTo({ url: '/pages/connection/connection' })
}
function openRegister(): void {
  if (state.busy) return
  leaveForm()
  uni.navigateTo({ url: '/pages/register/register' })
}
function passwordHelp(): void {
  showPasswordHelp('请联系平台管理员，或使用注册手机号完成身份核验后重置密码。')
}

onShow(() => {
  if (isH5 && callbackActive.value) {
    void handleSsoCallback()
    return
  }
  if (!isLoggedIn() || state.busy) return
  // 已有登录态：直接进入对应工作台或注册认证流程。
  if (workspaceMode() === 'ops') { void enterWorkbench(); return }
  state.submitting = true
  void getOnboardingStatus().then(status => handleStage(status?.stage))
    .catch(() => login.say('登录状态暂时无法核实，请重新登录或稍后重试'))
    .finally(() => { state.submitting = false })
})
onUnload(login.dispose)
// 小程序快捷入口先校验协议；服务端尚未提供手机号授权兑换接口。
function mpQuickLogin() {
  if (state.busy || !login.ensureAgreed()) return
  login.toast('微信手机号快捷登录暂未开通，请使用其他手机号登录')
}
</script>

<style scoped src="../../../../../packages/agri-shared/src/styles/mobile-login.css"></style>
<style scoped>
/* H5按原型使用品牌横幅与悬浮表单卡；小程序保留白底居中入口。 */
.prod-login.is-h5 { background: #f5f6fa; }
.prod-login.is-h5 .pl-screen { padding-top: 0 !important; padding-left: 20px; padding-right: 20px; background: #f5f6fa; }
.prod-login.is-h5 .pl-brand { align-items: flex-start; margin: 0 -20px; padding: 24px 20px 40px; text-align: left; background: linear-gradient(135deg,#2d8f4e 0%,#45b369 100%); }
.prod-login.is-h5 .pl-logo { width: 48px; height: 48px; margin-bottom: 12px; border-radius: 14px; }
.prod-login.is-h5 .pl-brand-name { color: #fff; font-size: 18px; }
.prod-login.is-h5 .pl-brand-sub { color: #fff; font-size: 12px; margin-top: 5px; }
.prod-login.is-h5 .pl-form { position: relative; margin-top: -24px; padding: 22px 18px 20px; border-radius: 20px; background: #fff; box-shadow: 0 10px 28px rgba(20,40,25,.09); }
.prod-login.is-h5 .pl-title { font-size: 16px; line-height: 24px; }
.prod-login.is-h5 .pl-heading { margin-bottom: 18px; }
.prod-login.is-h5 .pl-sub { margin-top: 4px; }
/* 生产管理专用：以登录页原型 V1.0 为依据，不影响其他子系统。 */
.prod-login { background: #fff; --brand: #2d8f4e; --brand-dark: #1e6b38; }
.pl-screen { box-sizing: border-box; width: 100%; max-width: 480px; margin: 0 auto; display: flex; flex-direction: column; min-height: 100vh; min-height: 100dvh; padding: 0 24px calc(16px + env(safe-area-inset-bottom)); background: #fff; }
.pl-screen.is-shake { animation: pl-shake .38s ease; }
.pl-brand { display: flex; flex-direction: column; align-items: center; padding: 28px 0 0; text-align: center; flex-shrink: 0; }
.pl-logo { width: 62px; height: 62px; margin-bottom: 16px; border-radius: 18px; }
.pl-brand-name { color: #1a1a1a; font-size: 18px; font-weight: 700; line-height: 27px; }
.pl-brand-sub { margin-top: 6px; color: #666; font-size: 12.5px; line-height: 20px; letter-spacing: .06em; }
.pl-form { padding-top: 32px; }
.pl-heading { display: flex; flex-direction: column; margin-bottom: 22px; }
.pl-title { display: block; color: #1a1a1a; font-size: 22px; font-weight: 700; line-height: 30px; }
.pl-sub { display: block; margin-top: 6px; color: #666; font-size: 12.5px; line-height: 20px; }
.pl-field { display: flex; align-items: center; gap: 10px; height: 48px; margin-bottom: 12px; padding: 0 14px; border: 1px solid transparent; border-radius: 10px; background: #f7f8fa; }
.pl-field.is-focus { background: #fff; border-color: #2d8f4e; box-shadow: 0 0 0 3px rgba(45,143,78,.1); }
.pl-prefix { flex: none; padding-right: 10px; border-right: 1px solid #dfe2e6; font-size: 14px; font-weight: 500; }
.pl-input { width: 0; flex: 1; min-width: 0; height: 46px; color: #1a1a1a; font-size: 15px; letter-spacing: .04em; }
.pl-placeholder { color: #777; font-size: 15px; letter-spacing: 0; }
.prod-login .pl-code { display: flex; align-items: center; justify-content: center; align-self: center; flex: none; min-width: 78px; height: 48px; min-height: 48px; padding: 0; line-height: 20px; text-align: center; color: #1e6b38; font-size: 12.5px; font-weight: 600; white-space: nowrap; }
.prod-login .pl-eye { display: flex; align-items: center; justify-content: center; flex: none; width: 48px; height: 48px; margin-right: -8px; }
.pl-eye image { width: 20px; height: 20px; }
.prod-login .pl-primary, .prod-login .pl-secondary { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 48px; padding: 10px 16px; border-radius: 10px; font-size: 15px; font-weight: 600; line-height: 24px; }
.prod-login .pl-primary { background: #2d8f4e; color: #fff; box-shadow: 0 6px 16px rgba(45,143,78,.18); }
.prod-login .pl-secondary { margin-top: 12px; border: 1px solid #eaeaea; color: #1a1a1a; background: #fff; font-weight: 500; }
.prod-login button[disabled] { opacity: .62; }
.prod-login .pl-code[disabled] { color: #666; }
.prod-login .pl-primary:active, .prod-login .pl-secondary:active { transform: scale(.985); }
.pl-actions { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 8px; }
.prod-login .pl-link { display: inline-flex; align-items: center; justify-content: center; min-width: 48px; min-height: 48px; color: #1e6b38; font-size: 12.5px; line-height: 20px; }
.prod-login .pl-muted { color: #666; }
.pl-help-panel { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; column-gap: 8px; margin-top: 12px; padding: 4px 12px; border-radius: 10px; background: #f7f8fa; color: #666; font-size: 12.5px; line-height: 20px; }
.pl-register { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 4px; margin-top: 8px; color: #666; font-size: 12.5px; }
.pl-feedback { display: block; margin: 0 0 12px; color: #b71c1c; font-size: 12.5px; line-height: 20px; overflow-wrap: anywhere; }
.pl-feedback.is-notice { color: #1e6b38; }
.pl-remember { margin: -4px 0 8px; }
.prod-login .pl-check-action { display: flex; align-items: center; gap: 8px; min-height: 48px; color: #666; font-size: 12.5px; }
.pl-bottom { margin-top: auto; padding-top: 24px; }
.pl-third-party { margin-top: 16px; margin-bottom: 16px; }
.pl-third-divider { display: flex; align-items: center; gap: 14px; color: #666; font-size: 12px; line-height: 20px; }
.pl-third-divider::before, .pl-third-divider::after { content: ''; flex: 1; height: 1px; background: #e0e5e2; }
.pl-third-options { display: flex; align-items: stretch; gap: 8px; margin-top: 16px; }
.prod-login .pl-third-button { display: flex; flex: 1; min-width: 0; min-height: 96px; padding: 8px 2px; flex-direction: column; align-items: center; justify-content: center; gap: 6px; border-radius: 12px; color: #333; line-height: 20px; }
.prod-login .pl-third-button:active { background: #eaf0ec; }
.pl-third-icon { display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 50%; background: #fff; border: 1px solid #e6ebe7; }
.pl-third-icon image { width: 30px; height: 30px; }
.pl-third-label { font-size: 12px; white-space: nowrap; }
.pl-third-status { color: #666; font-size: 11px; line-height: 16px; }
.pl-third-notice { display: block; margin-top: 12px; padding: 12px; border-radius: 10px; background: #edf3ef; color: #42554a; font-size: 12px; line-height: 20px; }
.pl-consent { display: flex; align-items: flex-start; justify-content: center; color: #666; font-size: 12px; line-height: 20px; }
.prod-login .pl-consent-toggle { display: flex; align-items: center; justify-content: center; flex: none; width: 48px; height: 48px; }
.pl-dot { display: flex; align-items: center; justify-content: center; flex: none; width: 18px; height: 18px; border: 1.5px solid #888; border-radius: 50%; background: #fff; }
.pl-dot.is-checked { border-color: #2d8f4e; background: #2d8f4e; color: #fff; font-size: 12px; font-weight: 700; }
.pl-consent-copy { max-width: 260px; flex: 1; min-width: 0; min-height: 48px; padding: 14px 0; box-sizing: border-box; }
.pl-consent-line { display: block; min-height: 20px; line-height: 20px; }
.prod-login .pl-consent-text,
.prod-login .pl-policy,
.prod-login .pl-policy-joiner { display: inline; min-width: 0; min-height: 0; width: auto; height: auto; padding: 0 2px; vertical-align: baseline; color: inherit; font-size: 12px; line-height: 20px; }
.prod-login .pl-policy { color: #1e6b38; }
.prod-login .pl-policy-joiner { padding-left: 0; padding-right: 0; }
.pl-consent.is-error, .prod-login .pl-consent.is-error .pl-policy { color: #b71c1c; }
.pl-consent.is-error .pl-dot { border-color: #b71c1c; }
.pl-consent-error { display: block; color: #b71c1c; font-size: 12px; line-height: 20px; text-align: center; }
.pl-foot { display: block; margin-top: 8px; color: #666; text-align: center; font-size: 11px; line-height: 18px; }
.prod-login .pl-connection { display: flex; align-items: center; justify-content: center; min-width: 48px; min-height: 48px; margin: 0 auto; color: #666; font-size: 12px; }
.pl-home .pl-brand { padding-top: 64px; }
.pl-home .pl-auth-card { margin-top: auto; }
.pl-entry { padding-top: 72px; }
.pl-entry-note { display: block; margin-bottom: 20px; color: #666; text-align: center; font-size: 12.5px; line-height: 20px; }
.pl-home .pl-bottom { margin-top: 0; padding-top: 18px; }
.pl-nav { height: 48px; margin-left: -12px; }
.prod-login .pl-back { display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; color: #1a1a1a; font-size: 32px; }
.pl-nav + .pl-brand { padding-top: 4px; }
@keyframes pl-shake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-6px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(4px); } }
@media (max-height: 700px) { .pl-brand { padding-top: 12px; } .pl-home .pl-brand { padding-top: 24px; } .pl-form { padding-top: 24px; } .pl-bottom { padding-top: 16px; } .pl-entry { padding-top: 40px; } }
@media (prefers-reduced-motion: reduce) { .pl-screen.is-shake { animation: none; } .prod-login .pl-primary:active, .prod-login .pl-secondary:active { transform: none; } }
/* #ifdef MP-WEIXIN */
.prod-login .mp-sms-consent { display:flex; align-items:flex-start; justify-content:center; color:#666; font-size:12px; line-height:20px; }
.prod-login .mp-sms-toggle { display:flex; align-items:center; justify-content:center; flex:none; width:36px; height:48px; min-height:48px; padding:0; margin:0; background:transparent; }
.prod-login .mp-sms-copy { display:block; flex:0 1 auto; min-width:0; box-sizing:border-box; padding:14px 0; line-height:20px; }
.prod-login .mp-sms-copy text { display:inline; min-height:0; padding:0; font-size:12px; line-height:20px; vertical-align:baseline; }
.prod-login .mp-sms-consent.mp-entry-error { color:#e53935; }
/* #endif */
</style>

<style scoped src="../../../../../packages/agri-shared/src/styles/mp-login-entry.css"></style>
