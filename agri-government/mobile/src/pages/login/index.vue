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
        <text class="hero-kicker">农业产业互联网平台</text>
        <text class="hero-title">监管执法移动端</text>
        <text class="hero-desc">登录后处理本人承办的执法任务、现场检查、案件登记与取证。</text>
      </view>

      <view class="hero-flow">
        <view class="flow-step active"><text>01</text><text>统一账号</text></view>
        <i />
        <view class="flow-step"><text>02</text><text>执法权限</text></view>
        <i />
        <view class="flow-step"><text>03</text><text>辖区授权</text></view>
      </view>
    </view>

    <view class="auth-card">
      <view class="card-heading">
        <view>
          <text class="form-title">统一账号登录</text>
          <text class="form-tip">使用丰链云平台账号，无需单独创建监管执法账号</text>
        </view>
        <view class="auth-badge"><text class="badge-dot" />统一认证</view>
      </view>

      <view class="form-block">
        <view class="input-group">
          <text class="label">账号 / 手机号</text>
          <view class="input-shell">
            <text class="input-prefix">用</text>
            <input
              v-model="username"
              :disabled="submitting"
              placeholder="请输入用户名或手机号"
              confirm-type="next"
              @confirm="focusPassword"
            />
          </view>
        </view>

        <view class="input-group">
          <text class="label">登录密码</text>
          <view class="input-shell">
            <text class="input-prefix">密</text>
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

        <view class="form-meta">
          <label class="remember" @tap="remember = !remember">
            <checkbox :checked="remember" color="#159a5e" />
            <text>保持登录（有效期内）</text>
          </label>
          <text class="meta-link" @tap="showPasswordHelp">忘记密码？</text>
        </view>

        <view v-if="messageText" :class="['inline-message', messageType]">
          <text class="message-mark">{{ messageType === 'notice' ? '✓' : '!' }}</text>
          <text>{{ messageText }}</text>
        </view>

        <button class="primary-button" :disabled="submitting" @tap="submit">
          {{ submitting ? '登录中…' : '登 录' }}
        </button>

        <view class="permission-note">
          <text class="permission-icon">盾</text>
          <view>
            <text class="permission-title">登录后自动校验监管执法身份</text>
            <text class="permission-desc">需具备 gov:inspector 权限，并拥有有效的人员、机构和辖区职责授权</text>
          </view>
        </view>
      </view>

      <view class="auth-divider"><i /><text>登录后可使用</text><i /></view>
      <view class="service-grid">
        <view class="service-item"><text class="service-icon green">任</text><text>执法任务</text></view>
        <view class="service-item"><text class="service-icon blue">查</text><text>现场检查</text></view>
        <view class="service-item"><text class="service-icon orange">案</text><text>案件登记</text></view>
        <view class="service-item"><text class="service-icon purple">证</text><text>取证归档</text></view>
      </view>

      <view class="auth-footer">
        <text>账号、权限或辖区未开通？</text>
        <text class="footer-link" @tap="showAccessHelp">联系平台运营开通 →</text>
      </view>
    </view>

    <view class="auth-bottom">
      <view class="security-line"><text class="security-dot" />统一认证中心已接入</view>
      <text>账号密码仅提交至丰链云统一认证中心</text>
      <text>登录后数据范围由服务端按本人承办范围和辖区职责判定</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { loginWithUnifiedAccount } from '../../auth'

const statusBarHeight = ref(Number(uni.getSystemInfoSync().statusBarHeight || 0))
const username = ref('')
const password = ref('')
const remember = ref(true)
const submitting = ref(false)
const messageText = ref('')
const messageType = ref<'error' | 'notice'>('error')

function notice(text: string, type: 'error' | 'notice' = 'error'): void {
  messageType.value = type
  messageText.value = text
}

function focusPassword(): void {
  // H5、小程序和 App 均支持回车提交；账号输入框回车后由系统切换到密码框。
}

async function submit(): Promise<void> {
  if (submitting.value) return
  if (!username.value.trim() || !password.value) {
    notice('请输入统一账号和密码')
    return
  }

  submitting.value = true
  notice('', 'notice')
  try {
    await loginWithUnifiedAccount(username.value.trim(), password.value, remember.value)
    uni.showToast({ title: '登录成功', icon: 'success' })
    setTimeout(() => uni.switchTab({ url: '/pages/workbench/index' }), 250)
  } catch (error) {
    notice(error instanceof Error ? error.message : '登录失败，请稍后重试')
  } finally {
    submitting.value = false
  }
}

function showPasswordHelp(): void {
  uni.showModal({
    title: '找回密码',
    content: '请使用丰链云统一账号的找回密码流程，或联系平台运营完成身份核验后重置。',
    showCancel: false,
    confirmText: '知道了',
  })
}

function showAccessHelp(): void {
  uni.showModal({
    title: '开通监管执法权限',
    content: '请联系平台运营开通政府监管执法身份，并在监管运营端完成人员、机构和辖区职责授权。账号仅有平台角色而没有有效授权时，无法进入执法数据。',
    showCancel: false,
    confirmText: '知道了',
  })
}
</script>

<style scoped lang="scss">
.auth-page {
  min-height: 100vh;
  padding: 0 28rpx calc(42rpx + env(safe-area-inset-bottom));
  background:
    radial-gradient(circle at 92% 5%, rgba(67, 190, 121, .18), transparent 340rpx),
    linear-gradient(180deg, #0f5838 0, #13764a 520rpx, #f3f8f5 520rpx, #f3f8f5 100%);
}

.status-bar {
  height: v-bind('`${statusBarHeight}px`');
}

.auth-hero {
  padding: 38rpx 12rpx 30rpx;
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
.brand-en,
.hero-kicker,
.hero-title,
.hero-desc,
.form-title,
.form-tip,
.label,
.permission-title,
.permission-desc,
.auth-bottom text {
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
  font-size: 24rpx;
  letter-spacing: 2rpx;
}

.hero-copy {
  display: grid;
  gap: 8rpx;
  margin-top: 40rpx;
}

.hero-kicker {
  color: #a7e9c3;
  font-size: 24rpx;
  letter-spacing: 2rpx;
}

.hero-title {
  font-size: 48rpx;
  font-weight: 800;
  letter-spacing: 2rpx;
}

.hero-desc {
  max-width: 650rpx;
  color: rgba(255, 255, 255, .72);
  font-size: 24rpx;
  line-height: 1.6;
}

.hero-flow {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 34rpx;
}

.flow-step {
  display: flex;
  align-items: center;
  gap: 7rpx;
  color: rgba(255, 255, 255, .82);
  font-size: 24rpx;
  white-space: nowrap;
}

.flow-step text:first-child {
  display: grid;
  width: 30rpx;
  height: 30rpx;
  place-items: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, .14);
  color: #d7f8e4;
  font-size: 22rpx;
  font-weight: 800;
}

.flow-step.active text:first-child {
  background: #d7f8e4;
  color: #117849;
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

.card-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
  padding: 30rpx 28rpx 0;
}

.form-title {
  color: #0b1a12;
  font-size: 32rpx;
  font-weight: 800;
}

.form-tip {
  margin-top: 8rpx;
  color: #718277;
  font-size: 24rpx;
  line-height: 1.55;
}

.auth-badge {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 7rpx;
  padding: 8rpx 12rpx;
  border-radius: 20rpx;
  background: #eff9f3;
  color: #14764a;
  font-size: 21rpx;
  white-space: nowrap;
}

.badge-dot,
.security-dot {
  width: 11rpx;
  height: 11rpx;
  border-radius: 50%;
  background: #21a463;
}

.form-block {
  padding: 28rpx 28rpx 20rpx;
}

.input-group + .input-group {
  margin-top: 24rpx;
}

.label {
  margin-bottom: 10rpx;
  color: #40574a;
  font-size: 25rpx;
  font-weight: 650;
}

.input-shell {
  display: flex;
  min-width: 0;
  height: 88rpx;
  align-items: center;
  gap: 0;
  overflow: hidden;
  border: 1rpx solid #dce7e0;
  border-radius: 14rpx;
  background: #fbfdfc;
}

.input-shell:focus-within {
  border-color: #159a5e;
  background: #fff;
}

.input-prefix {
  display: grid;
  width: 72rpx;
  height: 44rpx;
  place-items: center;
  border-right: 1rpx solid #e1e9e4;
  color: #6e8275;
  font-size: 24rpx;
}

.input-shell input {
  min-width: 0;
  flex: 1;
  padding: 0 20rpx;
  color: #243d2e;
  font-size: 27rpx;
}

.form-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 20rpx 2rpx 0;
  color: #7c8f83;
  font-size: 24rpx;
}

.remember {
  display: flex;
  align-items: center;
  gap: 7rpx;
}

.remember checkbox {
  transform: scale(.78);
}

.meta-link,
.footer-link {
  color: #188454;
  font-weight: 650;
}

.inline-message {
  display: flex;
  align-items: flex-start;
  gap: 10rpx;
  margin-top: 18rpx;
  padding: 16rpx 18rpx;
  border-radius: 12rpx;
  font-size: 24rpx;
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

.message-mark {
  display: grid;
  width: 28rpx;
  height: 28rpx;
  flex: 0 0 28rpx;
  place-items: center;
  border-radius: 50%;
  background: currentColor;
  color: #fff;
  font-size: 20rpx;
  font-weight: 800;
}

.inline-message.error .message-mark {
  color: #b42318;
}

.inline-message.notice .message-mark {
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
  line-height: 88rpx;
  box-shadow: 0 12rpx 26rpx rgba(18, 118, 74, .2);
}

.primary-button[disabled] {
  opacity: .55;
}

.permission-note {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  margin-top: 20rpx;
  padding: 18rpx;
  border-radius: 14rpx;
  background: #f5faf7;
}

.permission-icon {
  display: grid;
  width: 40rpx;
  height: 40rpx;
  flex: 0 0 40rpx;
  place-items: center;
  border-radius: 12rpx;
  background: #dff4e7;
  color: #117849;
  font-size: 21rpx;
  font-weight: 700;
}

.permission-title {
  color: #31523f;
  font-size: 23rpx;
  font-weight: 700;
}

.permission-desc {
  margin-top: 5rpx;
  color: #789083;
  font-size: 22rpx;
  line-height: 1.5;
}

.auth-divider {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 4rpx 28rpx 0;
  color: #95a39b;
  font-size: 23rpx;
}

.auth-divider i {
  height: 1rpx;
  flex: 1;
  background: #edf1ee;
}

.service-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8rpx;
  padding: 24rpx 28rpx 28rpx;
}

.service-item {
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 9rpx;
  color: #667a6e;
  font-size: 22rpx;
}

.service-icon {
  display: grid;
  width: 58rpx;
  height: 58rpx;
  place-items: center;
  border-radius: 17rpx;
  color: #fff;
  font-size: 24rpx;
  font-weight: 800;
}

.service-icon.green { background: #16a05d; }
.service-icon.blue { background: #2779bd; }
.service-icon.orange { background: #d88a2d; }
.service-icon.purple { background: #7a5ab2; }

.auth-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9rpx;
  padding: 24rpx 20rpx 28rpx;
  border-top: 1rpx solid #edf2ee;
  color: #819086;
  font-size: 23rpx;
}

.auth-bottom {
  display: grid;
  gap: 6rpx;
  padding: 28rpx 16rpx 0;
  color: #91a098;
  font-size: 22rpx;
  line-height: 1.5;
  text-align: center;
}

.security-line {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  color: #5c806b;
  font-weight: 650;
}

@media (min-width: 768px) {
  .auth-page {
    width: 750rpx;
    margin: 0 auto;
  }
}
</style>
