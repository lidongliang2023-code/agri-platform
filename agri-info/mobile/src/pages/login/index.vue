<template>
  <view class="login" :style="{ paddingTop: statusBar + 'px' }">
    <view class="topbar">
      <view class="brand-mark"><image src="/static/fengchain.svg" mode="aspectFit" /></view>
      <view class="brand-copy">
        <text class="brand-name">丰链云</text>
        <text class="brand-subtitle">FENGCHAIN · INFORMATION</text>
      </view>
    </view>

    <view class="hero-copy">
      <text class="eyebrow">信息资讯服务</text>
      <text class="title">欢迎回来</text>
      <text class="lead">掌握行情、供需与农技知识，让每一次经营决策更有依据。</text>
    </view>

    <view class="panel">
      <view class="panel-heading">
        <text class="heading">登录信息资讯</text>
        <text class="heading-hint">使用丰链云统一账号，无需重复注册</text>
      </view>

      <view v-if="!challenge" class="tabs">
        <button v-for="item in modes" :key="item.key" :disabled="busy" :aria-pressed="mode === item.key" :class="{ active: mode === item.key }" @tap="switchMode(item.key)">{{ item.label }}</button>
      </view>

      <template v-if="challenge">
        <text class="label">动态验证码</text>
        <text class="field-hint">请输入验证器中的 6 位动态码，完成登录。</text>
        <view class="field">
          <input v-model="totp" type="number" :maxlength="6" placeholder="请输入 6 位动态码" :disabled="busy" confirm-type="done" @confirm="submit()" />
        </view>
        <button class="text-button back-login" :disabled="busy" @tap="changeChallenge">返回登录方式选择</button>
      </template>

      <template v-else-if="mode === 'sms'">
        <text class="label">绑定手机号</text>
        <view class="field">
          <input v-model="phone" type="number" :maxlength="11" :disabled="busy" placeholder="请输入 11 位手机号" />
        </view>
        <text class="label">短信验证码</text>
        <view class="field">
          <input v-model="code" type="number" :maxlength="6" :disabled="busy" placeholder="请输入 6 位验证码" confirm-type="done" @confirm="submit()" />
          <button class="field-action" :disabled="busy || remaining > 0" @tap="sendCode">{{ sending ? '发送中' : remaining ? `${remaining} 秒后重发` : '获取验证码' }}</button>
        </view>
      </template>

      <template v-else>
        <text class="label">统一账号</text>
        <view class="field">
          <input v-model="username" :disabled="busy" placeholder="请输入统一账号用户名" />
        </view>
        <text class="label">登录密码</text>
        <view class="field">
          <input v-model="password" :password="!visible" :disabled="busy" placeholder="请输入登录密码" confirm-type="done" @confirm="submit()" />
          <button class="field-action" :disabled="busy" @tap="visible = !visible">{{ visible ? '隐藏' : '显示' }}</button>
        </view>
      </template>

      <view v-if="!challenge" class="meta">
        <checkbox-group @change="remember = $event.detail.value.includes('remember')">
          <label><checkbox value="remember" :checked="remember" :disabled="busy" color="#147a4b" />保持登录</label>
        </checkbox-group>
        <button v-if="mode === 'password'" class="text-button" :disabled="busy" @tap="passwordHelp">忘记密码？</button>
      </view>

      <text v-if="message" :class="['feedback', { error: failed }]">{{ message }}</text>
      <button class="primary" :disabled="busy" @tap="submit()">{{ submitting ? '正在验证…' : challenge ? '验证并登录' : '进入信息资讯' }}</button>

      <view v-if="!challenge" class="alternatives">
        <view class="section-title">
          <text>其他登录方式</text>
          <text class="section-note">更多方式陆续开通</text>
        </view>
        <button v-if="sessionName" class="session" :disabled="busy" @tap="submit(true)">以「{{ sessionName }}」继续</button>
        <view class="other-methods">
          <button v-for="item in otherMethods" :key="item.key" class="other-method" disabled>
            <text class="method-icon" :class="item.tone">{{ item.icon }}</text>
            <text class="method-copy">
              <text class="method-name">{{ item.name }}</text>
              <text class="method-state">暂未开通</text>
            </text>
          </button>
        </view>
      </view>
    </view>

    <button class="help" @tap="accountHelp">没有资讯访问权限？查看开通方式</button>
    <text class="footer">丰链云 · 农业产业互联网平台</text>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow, onUnload } from '@dcloudio/uni-app'
import { completeInfoMfaLogin, continueInfoSession, currentOwner, getInfoToken, isInfoMfaChallenge, loginWithInfoSms, loginWithUnifiedAccount, requestInfoLoginCode } from '../../auth'

const statusBar = Number(uni.getSystemInfoSync().statusBarHeight || 0)
const modes = [{ key: 'sms', label: '手机验证码登录' }, { key: 'password', label: '账号密码登录' }] as const
const otherMethods = [
  { key: 'wechat', icon: '微', name: '微信', tone: 'wechat' },
  { key: 'alipay', icon: '支', name: '支付宝', tone: 'alipay' },
  { key: 'government', icon: '政', name: '政务服务', tone: 'government' },
]
type Mode = typeof modes[number]['key']
const mode = ref<Mode>('password')
const phone = ref(''), code = ref(''), username = ref(''), password = ref('')
const challenge = ref(''), totp = ref(''), sessionName = ref('')
const visible = ref(false), remember = ref(true)
const message = ref(''), failed = ref(false), submitting = ref(false), sending = ref(false)
const busy = computed(() => sending.value || submitting.value)
const remaining = ref(0)
let timer: ReturnType<typeof setInterval> | undefined
let deadline = 0
let disposed = false

function show(text: string, error = false) {
  message.value = text
  failed.value = error
}
function switchMode(next: Mode) {
  if (busy.value || mode.value === next) return
  mode.value = next
  code.value = password.value = ''
  visible.value = false
  show('')
}
function changeChallenge() {
  challenge.value = totp.value = ''
  show('')
}
function tick() {
  remaining.value = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
  if (!remaining.value && timer) { clearInterval(timer); timer = undefined }
}
onShow(() => { sessionName.value = getInfoToken() ? currentOwner() : ''; tick() })
onUnload(() => { disposed = true; clearInterval(timer) })

async function sendCode() {
  if (busy.value || remaining.value) return
  if (!/^1[3-9]\d{9}$/.test(phone.value)) return show('请输入有效的 11 位手机号', true)
  sending.value = true
  show('')
  try {
    const hint = await requestInfoLoginCode(phone.value)
    if (disposed) return
    show(hint)
    deadline = Date.now() + 60000
    tick()
    timer = setInterval(tick, 1000)
  } catch (error) {
    show(error instanceof Error ? error.message : '验证码发送失败，请重试', true)
  } finally { sending.value = false }
}
async function submit(useSession = false) {
  if (busy.value) return
  if (!useSession) {
    if (challenge.value) {
      if (!/^\d{6}$/.test(totp.value)) return show('请输入 6 位动态码', true)
    } else if (mode.value === 'sms') {
      if (!/^1[3-9]\d{9}$/.test(phone.value)) return show('请输入有效的 11 位手机号', true)
      if (!/^\d{6}$/.test(code.value)) return show('请输入短信中的 6 位验证码', true)
    } else if (!username.value.trim() || !password.value) return show('请输入统一账号和密码', true)
  }
  submitting.value = true
  show('')
  try {
    if (useSession) await continueInfoSession()
    else if (challenge.value) await completeInfoMfaLogin(challenge.value, totp.value, remember.value)
    else {
      const result = mode.value === 'sms' ? await loginWithInfoSms(phone.value, code.value, remember.value) : await loginWithUnifiedAccount(username.value.trim(), password.value, remember.value)
      password.value = code.value = ''
      visible.value = false
      if (isInfoMfaChallenge(result)) { challenge.value = result.challengeToken; return }
    }
    if (!disposed) uni.switchTab({ url: '/pages/news/index' })
  } catch (error) {
    if (challenge.value) changeChallenge()
    show(error instanceof Error ? error.message : '登录失败，请稍后重试', true)
  } finally { submitting.value = false }
}
function passwordHelp() {
  uni.showModal({ title: '找回密码', content: '可用已绑定的手机验证码登录，或联系平台管理员重置密码。', showCancel: false })
}
function accountHelp() {
  uni.showModal({ title: '开通资讯访问权限', content: '请联系平台管理员，为你的统一账号开通资讯用户或资讯运营权限。', showCancel: false })
}
</script>

<style scoped>
.login { min-height: 100vh; padding: 0 32rpx calc(34rpx + env(safe-area-inset-bottom)); background: linear-gradient(180deg, #f3f9f4 0, #f6f7f2 46%, #f6f7f2 100%); color: #12291d; }
.topbar { display: flex; align-items: center; gap: 16rpx; max-width: 490px; min-height: 112rpx; margin: 0 auto; }
.brand-mark { display: flex; width: 68rpx; height: 68rpx; align-items: center; justify-content: center; border-radius: 20rpx; background: #ffffff; box-shadow: 0 10rpx 28rpx rgba(21, 92, 57, 0.12); }
.brand-mark image { width: 48rpx; height: 48rpx; }
.brand-copy { display: flex; flex-direction: column; gap: 2rpx; }
.brand-name { color: #165a3b; font-size: 30rpx; font-weight: 750; letter-spacing: 1rpx; }
.brand-subtitle { color: #71907d; font-size: 17rpx; letter-spacing: 2rpx; }
.hero-copy { max-width: 490px; margin: 0 auto; padding: 62rpx 4rpx 36rpx; }
.eyebrow { display: block; margin-bottom: 14rpx; color: #27845a; font-size: 23rpx; font-weight: 700; letter-spacing: 2rpx; }
.title { display: block; color: #102d1e; font-size: 62rpx; font-weight: 800; letter-spacing: -2rpx; }
.lead { display: block; max-width: 620rpx; margin-top: 16rpx; color: #65796c; font-size: 26rpx; line-height: 1.7; }
.panel { max-width: 490px; margin: 0 auto; padding: 34rpx 30rpx 30rpx; border: 1rpx solid #e0ebe2; border-radius: 28rpx; background: rgba(255, 255, 255, 0.97); box-shadow: 0 18rpx 48rpx rgba(23, 76, 48, 0.08); }
.panel-heading { display: flex; flex-direction: column; gap: 8rpx; margin-bottom: 24rpx; }
.heading { display: block; color: #153c28; font-size: 34rpx; font-weight: 750; }
.heading-hint, .field-hint { display: block; color: #8a9a90; font-size: 23rpx; line-height: 1.5; }
.tabs { display: flex; gap: 28rpx; margin: 0 -2rpx 26rpx; border-bottom: 1rpx solid #e4ece5; }
.tabs button { position: relative; min-height: 74rpx; padding: 0 4rpx; color: #87968d; font-size: 27rpx; }
.tabs button.active { color: #147447; font-weight: 750; }
.tabs button.active::after { position: absolute; right: 0; bottom: -1rpx; left: 0; height: 5rpx; border-radius: 5rpx 5rpx 0 0; background: #168052; content: ''; }
.label { display: block; margin: 20rpx 0 10rpx; color: #405a4b; font-size: 25rpx; font-weight: 650; }
.field-hint { margin: -2rpx 0 12rpx; }
.field { display: flex; min-height: 86rpx; align-items: center; overflow: hidden; border: 1rpx solid #d8e4db; border-radius: 16rpx; background: #fbfdfb; transition: border-color 0.2s; }
.field:focus-within { border-color: #238659; background: #ffffff; }
.field input { flex: 1; min-width: 0; height: 84rpx; padding: 0 22rpx; color: #172d20; font-size: 27rpx; }
.field-action { flex: 0 0 auto; min-height: 84rpx; padding: 0 22rpx; color: #16774b; font-size: 24rpx; font-weight: 650; }
.field-action[disabled] { color: #9aa89f; }
.text-button { padding: 0; color: #19784d; font-size: 24rpx; }
.back-login { display: block; margin: 18rpx 0 2rpx; }
.meta { display: flex; min-height: 86rpx; align-items: center; justify-content: space-between; color: #75867b; font-size: 24rpx; }
.meta label { display: flex; align-items: center; }
.meta checkbox { transform: scale(.78); }
.feedback { display: block; margin: 10rpx 0 16rpx; padding: 16rpx 18rpx; border-radius: 12rpx; background: #edf8f0; color: #246344; font-size: 24rpx; line-height: 1.5; }
.feedback.error { background: #fff1ed; color: #a13d29; }
.primary { width: 100%; min-height: 88rpx; border-radius: 16rpx; background: linear-gradient(135deg, #18935b, #126d44); box-shadow: 0 12rpx 28rpx rgba(18, 109, 68, 0.2); color: #ffffff; font-size: 28rpx; font-weight: 750; }
.primary[disabled] { opacity: 0.66; }
.alternatives { margin-top: 32rpx; padding-top: 28rpx; border-top: 1rpx solid #e8efe9; }
.section-title { display: flex; align-items: center; justify-content: space-between; color: #486252; font-size: 25rpx; font-weight: 650; }
.section-note { color: #a1aea5; font-size: 22rpx; font-weight: 400; }
.session { width: 100%; min-height: 72rpx; margin: 18rpx 0 12rpx; border: 1rpx solid #b9ddc4; border-radius: 14rpx; background: #f0faf2; color: #176b44; font-size: 24rpx; font-weight: 650; }
.other-methods { display: flex; gap: 12rpx; margin-top: 18rpx; }
.other-method { display: flex; min-width: 0; flex: 1; align-items: center; justify-content: center; gap: 10rpx; min-height: 76rpx; padding: 0 8rpx; border: 1rpx solid #e6ece7; border-radius: 14rpx; background: #fafcf9; color: #718077; }
.other-method[disabled] { opacity: 1; }
.method-icon { display: flex; width: 38rpx; height: 38rpx; align-items: center; justify-content: center; border-radius: 10rpx; font-size: 21rpx; font-weight: 750; }
.method-icon.wechat { background: #e3f6e8; color: #28a358; }
.method-icon.alipay { background: #e5f4fc; color: #278cc2; }
.method-icon.government { background: #fceaea; color: #bf5252; }
.method-copy { display: flex; flex-direction: column; gap: 2rpx; align-items: flex-start; }
.method-name { color: #596b60; font-size: 22rpx; }
.method-state { color: #a3aea7; font-size: 18rpx; }
.help { display: block; max-width: 490px; margin: 20rpx auto 0; padding: 16rpx 0; color: #3e7355; font-size: 23rpx; }
.footer { display: block; margin-top: 18rpx; color: #a0ada4; font-size: 21rpx; text-align: center; }
button[disabled] { color: #9aa89f; }
</style>
