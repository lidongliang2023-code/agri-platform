<template>
  <!-- #ifdef MP-WEIXIN -->
  <view v-if="state.view === 'home'" class="mp-entry" :class="{ 'mp-entry-shake': state.shaking }" :style="{ paddingTop: `${mpEntryNavigationBottom}px` }">
    <view class="mp-entry-brand">
      <image class="mp-entry-logo" src="/static/fengchain.svg" mode="aspectFit" />
      <text class="mp-entry-name">丰链云监管执法</text>
      <text class="mp-entry-sub">统一账号 · 依法履职</text>
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
      <text class="mp-entry-footer">丰链云监管执法 提供</text>
    </view>
    <view v-if="state.toastText" class="mp-entry-toast" role="alert">{{ state.toastText }}</view>
  </view>
  <!-- #endif -->
  <view v-if="platform !== 'mp' || state.view !== 'home'" class="login h5-login-aligned" :class="[`is-${platform}`, { 'is-card': platform === 'h5' }]" :style="{ paddingTop: `${statusBarHeight}px` }">
    <view class="screen" :class="{ 'is-shake': state.shaking }">
      <!-- H5：绿色品牌条 + 白色卡片 -->
      <view v-if="platform === 'h5'" class="hero">
        <image class="hero-logo" src="/static/fengchain.svg" mode="aspectFit" aria-hidden="true" />
        <text class="hero-name">丰链云监管执法</text>
        <text class="hero-sub">统一账号 · 依法履职</text>
      </view>

      <view :class="platform === 'h5' ? 'card' : 'body'">
        <view v-if="showBack" class="nav-back">
          <button class="back" aria-label="返回" :disabled="state.busy" @tap="goBack">‹</button>
        </view>

        <!-- 小程序首屏 -->
        <view v-if="state.view === 'home'" class="home">
          <view class="brand-block">
            <image class="logo" src="/static/fengchain.svg" mode="aspectFit" aria-hidden="true" />
            <text class="brand-name">丰链云监管执法</text>
            <text class="brand-sub">统一账号 · 依法履职</text>
          </view>
          <view class="push" />
          <button class="btn btn-primary" :disabled="state.busy" @tap="openView('sms')">手机号验证码登录</button>
          <button class="btn btn-wechat" disabled aria-disabled="true">
            <image class="btn-icon" src="/static/login/wechat-white.svg" mode="aspectFit" aria-hidden="true" />
            微信手机号快捷登录<text class="soon">待开通</text>
          </button>
        </view>

        <template v-else>
          <view class="title-block">
            <text class="title">{{ title }}</text>
            <text class="sub">{{ subtitle }}</text>
          </view>

          <!-- 二次验证 -->
          <view v-if="state.view === 'mfa'" class="field" :class="{ 'is-focus': state.focused === 'mfa' }">
            <input v-model="state.mfaCode" class="field-input" :disabled="state.busy" :focus="true" :maxlength="20"
              placeholder="动态验证码或恢复码" confirm-type="done"
              @focus="state.focused = 'mfa'" @blur="state.focused = ''" @confirm="submit" />
          </view>

          <!-- 手机号 + 短信验证码 -->
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

          <!-- 账号 + 密码 -->
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
                <image class="eye-icon" :src="state.showPassword ? eyeIcon : eyeOffIcon"
                  mode="aspectFit" aria-hidden="true" />
              </button>
            </view>
            <view v-if="platform === 'app'" class="row-between">
              <view class="check" role="checkbox" :aria-checked="state.rememberPassword" @tap="state.rememberPassword = !state.rememberPassword">
                <view class="box" :class="{ on: state.rememberPassword }" /><text>7 天内免登录</text>
              </view>
              <button class="link muted" @tap="showPasswordHelp()">忘记密码</button>
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

          <!-- 次级入口 -->
          <view v-if="state.view === 'mfa'" class="row-between after">
            <button class="link muted" :disabled="state.busy" @tap="returnToLogin">返回登录方式</button>
          </view>
          <view v-else-if="state.view === 'sms' && platform === 'h5'" class="row-between after">
            <button class="link" :disabled="state.busy" @tap="openView('password')">密码登录</button>
            <button class="link muted" @tap="showPasswordHelp()">忘记密码</button>
          </view>
          <view v-else-if="state.view === 'sms'" class="row-between after">
            <button class="link muted" @tap="showCodeHelp">收不到验证码</button>
            <button v-if="platform === 'app'" class="link" :disabled="state.busy" @tap="openView('password')">密码登录</button>
          </view>
          <view v-else-if="platform === 'app'" class="row-center after">
            <button class="link" :disabled="state.busy" @tap="openView('sms')">切换验证码登录</button>
          </view>
          <view v-else class="row-between after">
            <button class="link" :disabled="state.busy" @tap="openView('sms')">验证码登录</button>
            <button class="link muted" @tap="showPasswordHelp()">忘记密码</button>
          </view>

          <!-- 其他登录方式：微信 / 支付宝 / 国家政务服务平台（H5、APP） -->
<!-- #ifndef H5 -->
          <!-- #ifndef MP-WEIXIN -->
        <view v-if="platform !== 'mp' && state.view !== 'mfa'" class="thirds-block">
            <view class="divider-text"><text>其他登录方式</text></view>
            <view class="thirds">
              <view v-for="item in thirdChannels" :key="item.id" class="third-item" role="button"
                :aria-label="`${item.fullName}登录（待开通）`" @tap="channelPending(item.fullName)">
                <view class="third"><image :src="item.icon" mode="aspectFit" aria-hidden="true" /></view>
                <text>{{ item.name }}</text>
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

        </template>
        <!-- #ifdef H5 -->
        <view class="h5-consent" :class="{ 'is-error': state.agreeError }">
          <button class="h5-consent-toggle" role="checkbox" aria-label="我已阅读并同意用户协议与隐私政策" :aria-checked="state.agreed" :disabled="state.busy" @tap="toggleAgree"><view class="h5-dot" :class="{ 'is-checked': state.agreed }"><text v-if="state.agreed">✓</text></view></button>
          <view class="h5-consent-copy"><button class="h5-consent-text" :disabled="state.busy" @tap="toggleAgree">我已阅读并同意</button><button class="h5-policy" :disabled="state.busy" @tap="showAgreement('用户协议')">《用户协议》</button><text class="h5-joiner">和</text><button class="h5-policy" :disabled="state.busy" @tap="showAgreement('隐私政策')">《隐私政策》</button></view>
        </view>
        <text v-if="state.agreeError" class="h5-consent-error" role="alert">请先阅读并同意用户协议与隐私政策</text>
        <view v-if="state.view === 'sms'" class="h5-help"><text>验证码登录遇到问题？</text><button class="link" :disabled="state.busy" @tap="showCodeHelp">收不到验证码</button></view>
        
        <!-- #endif -->

      </view>

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
      <text v-if="platform !== 'app'" class="foot">丰链云农业产业互联网平台{{ platform === 'mp' ? ' 提供' : ' · 统一认证' }}</text>
    </view>

    <view class="toast" :class="{ 'is-on': state.toastText }">{{ state.toastText }}</view>

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
import { onUnload } from '@dcloudio/uni-app'
import { completeGovMfa, GovMfaRequired, loginWithGovSms, loginWithUnifiedAccount, sendGovLoginCode } from '../../auth'
import {
  createLoginState, createMobileLogin, showAgreement, showCodeHelp, showPasswordHelp,
  type LoginOutcome, type LoginPlatform, type MobileLoginOptions,
} from '../../../../../packages/agri-shared/src/auth/mobileLogin'
// 脚本里的图片须经构建导入，才会带上发布目录前缀（直接写 /static/... 在子路径部署时会取到网站根目录）。
import wechatIcon from '../../static/login/wechat.svg'
import alipayIcon from '../../static/login/alipay.svg'
import govIcon from '../../static/login/gov.svg'
import eyeIcon from '../../static/login/eye.svg'
import eyeOffIcon from '../../static/login/eye-off.svg'


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

const system = uni.getSystemInfoSync()
const platform = detectPlatform()
const statusBarHeight = Number(system.statusBarHeight || 0)
const thirdChannels = [
  { id: 'wechat', name: '微信', fullName: '微信', icon: wechatIcon },
  { id: 'alipay', name: '支付宝', fullName: '支付宝', icon: alipayIcon },
  { id: 'gov', name: '政务服务', fullName: '国家政务服务平台', icon: govIcon },
]

/** 监管认证在需要二次验证时抛出 GovMfaRequired，这里转成统一的认证结果。 */
async function outcome(task: () => Promise<unknown>): Promise<LoginOutcome> {
  try {
    await task()
    return { mfa: false }
  } catch (error) {
    if (error instanceof GovMfaRequired) return { mfa: true, challengeToken: error.challengeToken }
    throw error
  }
}

const loginOptions: MobileLoginOptions = {
  platform,
  // 小程序只保留短信路径，首屏是品牌区；APP / H5 默认落在验证码登录。
  entryView: platform === 'mp' ? 'home' : 'sms',
  privacyKey: 'gov_privacy_notice_v2',
}
// #ifdef MP-WEIXIN
loginOptions.entryView = 'home'
// #endif
const state = reactive(createLoginState(loginOptions))
const login = createMobileLogin(state, {
  sendSmsCode: async (phone) => (await sendGovLoginCode(phone)).hint || '验证码已发送，请查看短信',
  loginBySms: (phone, code, remember) => outcome(() => loginWithGovSms(phone, code, remember)),
  loginByPassword: (name, secret, remember) => outcome(() => loginWithUnifiedAccount(name, secret, remember)),
  completeMfa: (challenge, code, remember) => outcome(() => completeGovMfa(challenge, code, remember)),
  onSuccess: () => new Promise<void>((resolve, reject) => {
    uni.reLaunch({ url: '/pages/workbench/index', success: () => resolve(),
      fail: () => reject(new Error('登录成功，但工作台打开失败，请重试')) })
  }),
}, loginOptions)
const { toast, toggleAgree, openView, returnToLogin, requestCode, submit, channelPending } = login

const showBack = computed(() => state.view !== 'mfa' && state.view !== state.entryView && platform !== 'h5')
const title = computed(() => state.view === 'mfa' ? '二次验证' : state.view === 'sms' ? '手机号登录' : '密码登录')
const subtitle = computed(() => {
  if (state.view === 'mfa') return '请输入身份验证器中的动态验证码或恢复码'
  if (state.view === 'sms') return '仅限已开通执法权限的统一账号'
  return platform === 'h5' ? '适合已在电脑端使用的统一账号' : '适合每天办理任务的执法人员'
})

function goBack() {
  openView(state.entryView === 'home' ? 'home' : 'sms')
}
onUnload(login.dispose)

// 小程序快捷入口先校验协议；服务端尚未提供手机号授权兑换接口。
function mpQuickLogin() {
  if (state.busy || !login.ensureAgreed()) return
  login.toast('微信手机号快捷登录暂未开通，请使用其他手机号登录')
}
</script>

<style scoped src="../../../../../packages/agri-shared/src/styles/mobile-login.css"></style>

<style scoped src="../../../../../packages/agri-shared/src/styles/mp-login-entry.css"></style>
