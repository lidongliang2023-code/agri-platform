<template>
  <!-- #ifdef MP-WEIXIN -->
  <view v-if="state.view === 'home'" class="mp-entry" :class="{ 'mp-entry-shake': state.shaking }" :style="{ paddingTop: `${mpEntryNavigationBottom}px` }">
    <view class="mp-entry-brand">
      <image class="mp-entry-logo" src="/static/fengchain.svg" mode="aspectFit" />
      <text class="mp-entry-name">丰链云 · 物联网</text>
      <text class="mp-entry-sub">统一账号 · 设备监测与告警处理</text>
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
      <text class="mp-entry-footer">丰链云 · 物联网 提供</text>
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
        <text class="hero-name">丰链云 · 物联网</text>
        <text class="hero-sub">统一账号 · 设备监测与告警处理</text>
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
      <text class="foot">统一账号与 PC 端、生产管理、交易撮合通用</text>
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
import { onShow, onUnload } from '@dcloudio/uni-app'
import { enterWorkspace, completeUnifiedMfa, hasIotSession, loginWithSmsCode, loginWithUnifiedAccount, sendLoginSmsCode, type UnifiedLoginResult } from '../../api/iot'
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

const platform = detectPlatform()
const statusBarHeight = Number(uni.getSystemInfoSync().statusBarHeight || 0)

function outcome(result: UnifiedLoginResult): LoginOutcome {
  return result.mfaRequired ? { mfa: true, challengeToken: String(result.challengeToken || '') } : { mfa: false }
}

const options: MobileLoginOptions = { platform, privacyKey: 'agri_iot_miniprogram_privacy_notice_v2' }
// #ifdef MP-WEIXIN
options.entryView = 'home'
// #endif
const state = reactive(createLoginState(options))
const login = createMobileLogin(state, {
  sendSmsCode: async (phone) => (await sendLoginSmsCode(phone))?.hint,
  loginBySms: async (phone, code, remember) => outcome(await loginWithSmsCode(phone, code, remember)),
  loginByPassword: async (name, secret, remember) => outcome(await loginWithUnifiedAccount(name, secret, remember)),
  completeMfa: async (challenge, code, remember) => outcome(await completeUnifiedMfa(challenge, code, remember)),
  onSuccess: () => enterWorkspace(),
}, options)
const { toggleAgree, openView, returnToLogin, requestCode, submit, channelPending } = login

const title = computed(() => state.view === 'mfa' ? '二次验证' : state.view === 'sms' ? '手机号登录' : '密码登录')
const subtitle = computed(() => state.view === 'mfa'
  ? '请输入身份验证器中的动态验证码或恢复码'
  : '登录后按权限进入用户或运营工作台')

// 已有有效会话时直接进入工作台，不再要求重复登录。
onShow(() => {
  if (!state.busy && hasIotSession()) void enterWorkspace().catch((error) => login.say(errorText(error, '工作台打开失败，请重试')))
})
onUnload(login.dispose)

function passwordHelp() {
  showPasswordHelp('物联网使用丰链云统一账号。请用绑定手机号的验证码登录，或在统一账号中心重置密码，也可联系平台管理员处理。')
}
// 小程序快捷入口先校验协议；服务端尚未提供手机号授权兑换接口。
function mpQuickLogin() {
  if (state.busy || !login.ensureAgreed()) return
  login.toast('微信手机号快捷登录暂未开通，请使用其他手机号登录')
}
</script>

<style scoped src="../../../../../packages/agri-shared/src/styles/mobile-login.css"></style>

<style scoped>
/* #ifdef MP-WEIXIN */
.mp-sms-back { display: flex; align-items: center; min-height: 48px; margin-top: 52px; color: #2d8f4e; font-size: 14px; background: transparent; }
/* #endif */
</style>

<style scoped src="../../../../../packages/agri-shared/src/styles/mp-login-entry.css"></style>
