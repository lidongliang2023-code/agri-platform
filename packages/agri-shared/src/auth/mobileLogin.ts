/**
 * 各移动端（uni-app：H5 / 微信小程序 / APP）共用的统一账号登录流程。
 *
 * 只管页面流程：登录方式切换、手机号分组、验证码倒计时、协议勾选、免登录规则、
 * 二次验证、错误提示与防重复提交。各端的接口地址、权限校验、会话存储和登录后跳转
 * 都由调用方通过 adapter 传入，这里不碰。
 *
 * 本文件不依赖 Vue（共享包里没有 Vue，小程序与 H5 的 Vue 运行时也不同）：
 * 页面用自己的 reactive() 包住 createLoginState() 的结果再交给 createMobileLogin，
 * 这里对状态对象的读写都经过页面的响应式代理，模板直接写 state.xxx。
 *
 *   const state = reactive(createLoginState({ platform }))
 *   const login = createMobileLogin(state, adapter, { platform })
 */
declare const uni: any
declare const plus: any

export type LoginPlatform = 'h5' | 'mp' | 'app'
export type LoginMode = 'sms' | 'password'
export type LoginView = 'home' | LoginMode | 'mfa'

/** 认证结果：要么完成登录（可带上调用方需要的数据），要么需要二次验证。 */
export type LoginOutcome<T = unknown> =
  | { mfa: true; challengeToken: string }
  | { mfa: false; data?: T }

export interface MobileLoginAdapter<T = unknown> {
  /** 发送登录短信验证码，返回给用户看的提示（可选）。没有短信登录的端不传。 */
  sendSmsCode?: (phone: string) => Promise<string | undefined | void>
  loginBySms?: (phone: string, code: string, remember: boolean) => Promise<LoginOutcome<T>>
  loginByPassword: (username: string, password: string, remember: boolean) => Promise<LoginOutcome<T>>
  /** 二次验证第二步；挑战凭证一次有效。 */
  completeMfa?: (challengeToken: string, code: string, remember: boolean) => Promise<LoginOutcome<T>>
  /** 认证通过后进入业务（拉档案、保存会话、跳转）。抛错会显示在页面上。 */
  onSuccess: (data: T | undefined) => void | Promise<void>
  /** 登录失败后清理半成品会话（可选）。 */
  onError?: (error: unknown) => void
}

export interface MobileLoginOptions {
  platform: LoginPlatform
  /** 各业务客户端独立记录隐私提示确认版本。 */
  privacyKey?: string
  /** 首屏：有短信登录时默认手机验证码；监管执法小程序为 home。 */
  entryView?: LoginView
  /** 是否提供短信登录（adapter 带了 sendSmsCode / loginBySms 时为 true）。 */
  sms?: boolean
  /** 提交前的额外关卡（例如 APP 首次隐私弹窗），返回 false 时不继续。 */
  beforeSubmit?: () => boolean
}

export const PHONE_PATTERN = /^1[3-9]\d{9}$/
const SMS_SECONDS = 60
const TOAST_MS = 2400

export function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function firstView(options: MobileLoginOptions): LoginView {
  return options.entryView ?? (options.sms === false ? 'password' : 'sms')
}

/** 页面状态；用页面的 reactive() 包起来。 */
export function createLoginState(options: MobileLoginOptions) {
  const entry = firstView(options)
  return {
    platform: options.platform,
    privacyKey: options.privacyKey || 'mobile_privacy_notice_v2',
    privacyVisible: options.platform === 'app' && !uni.getStorageSync(options.privacyKey || 'mobile_privacy_notice_v2'),
    entryView: entry,
    smsEnabled: options.sms !== false,
    view: entry,
    loginView: (entry === 'home' ? 'sms' : entry) as LoginView,
    phoneDigits: '', smsCode: '', username: '', password: '',
    showPassword: false, rememberPassword: false,
    challengeToken: '', mfaCode: '',
    submitting: false, sending: false, completed: false,
    agreed: false, agreeError: false, shaking: false,
    focused: '', message: '', messageType: 'error' as 'error' | 'notice',
    toastText: '', countdown: 0,
    get busy(): boolean { return this.submitting || this.sending || this.completed },
    get validPhone(): boolean { return PHONE_PATTERN.test(this.phoneDigits) },
    /** H5 多在公共设备上打开，密码登录不提供免登录；APP / 小程序可勾选，默认不勾。 */
    get rememberAvailable(): boolean { return this.platform === 'app' },
    /** 手机号按 3-4-4 分组显示，内部只保留 11 位数字。 */
    get phoneInput(): string {
      return this.phoneDigits.replace(/^(\d{3})(\d{0,4})(\d{0,4}).*$/, (_m: string, a: string, b: string, c: string) => [a, b, c].filter(Boolean).join(' '))
    },
    set phoneInput(value: string) { this.phoneDigits = String(value).replace(/\D/g, '').slice(0, 11) },
  }
}
export type LoginState = ReturnType<typeof createLoginState>

export function createMobileLogin<T = unknown>(state: LoginState, adapter: MobileLoginAdapter<T>, options: MobileLoginOptions) {
  let timer: ReturnType<typeof setInterval> | undefined
  let toastTimer: ReturnType<typeof setTimeout> | undefined
  let shakeStartTimer: ReturnType<typeof setTimeout> | undefined
  let shakeEndTimer: ReturnType<typeof setTimeout> | undefined
  let pendingRemember = true
  let disposed = false

  function toast(text: string) {
    state.toastText = text
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => { state.toastText = '' }, TOAST_MS)
  }
  function say(text: string, type: 'error' | 'notice' = 'error') {
    state.messageType = type
    state.message = text
  }
  function shake() {
    state.shaking = false
    clearTimeout(shakeStartTimer)
    clearTimeout(shakeEndTimer)
    shakeStartTimer = setTimeout(() => {
      if (disposed || !state.agreeError) return
      state.shaking = true
      shakeEndTimer = setTimeout(() => { state.shaking = false }, 380)
    }, 0)
  }
  function toggleAgree() {
    state.agreed = !state.agreed
    if (state.agreed) {
      clearAgreementFeedback()
    }
  }
  /** 协议默认不勾选，只在提交类操作时校验，不用阻断式弹窗。 */
  function ensureAgreed(): boolean {
    if (state.platform === 'app' && !uni.getStorageSync(state.privacyKey)) { state.privacyVisible = true; return false }
    if (options.beforeSubmit && !options.beforeSubmit()) return false
    if (state.agreed) return true
    state.agreeError = true
    toast('请先阅读并同意用户协议与隐私政策')
    shake()
    return false
  }
  function clearSecrets() {
    state.password = ''
    state.showPassword = false
    state.smsCode = ''
    state.mfaCode = ''
    state.challengeToken = ''
  }
  function clearAgreementFeedback() {
    clearTimeout(shakeStartTimer)
    clearTimeout(shakeEndTimer)
    state.agreeError = false
    state.shaking = false
    clearTimeout(toastTimer)
    state.toastText = ''
  }
  function openView(next: LoginView) {
    if (state.busy || state.view === next) return
    if (next === 'sms' && !state.smsEnabled) return
    if (next === 'password' && state.platform === 'mp') return
    clearSecrets()
    clearAgreementFeedback()
    say('')
    state.view = next
    if (next !== 'home') state.loginView = next
  }
  function returnToLogin() {
    clearSecrets()
    clearAgreementFeedback()
    say('')
    state.view = state.loginView
  }

  async function requestCode() {
    if (state.busy || state.countdown || !adapter.sendSmsCode) return
    if (!state.validPhone) return say('请输入正确的 11 位手机号')
    if (!ensureAgreed()) return
    state.sending = true
    say('')
    try {
      const hint = await adapter.sendSmsCode(state.phoneDigits)
      if (disposed) return
      say(hint || '验证码已发送，请查看短信', 'notice')
      const until = Date.now() + SMS_SECONDS * 1000
      state.countdown = SMS_SECONDS
      clearInterval(timer)
      timer = setInterval(() => {
        state.countdown = Math.max(0, Math.ceil((until - Date.now()) / 1000))
        if (!state.countdown) clearInterval(timer)
      }, 1000)
    } catch (error) {
      say(errorText(error, '验证码发送失败，请重试'))
    } finally { state.sending = false }
  }

  function authenticate(): Promise<LoginOutcome<T>> {
    if (state.view === 'mfa') {
      const code = state.mfaCode.replace(/[\s-]/g, '').toUpperCase()
      // 纯数字按 6 位动态码校验；含字母的按一次性恢复码交给服务端校验。
      if (!code || (/^\d+$/.test(code) && code.length !== 6)) throw new Error('请输入 6 位动态码或一次性恢复码')
      if (!adapter.completeMfa) throw new Error('当前客户端暂不支持二次验证，请联系平台运营')
      return adapter.completeMfa(state.challengeToken, code, pendingRemember)
    }
    if (state.view === 'sms') {
      if (!adapter.loginBySms) throw new Error('当前客户端暂不支持验证码登录，请使用密码登录')
      if (!state.validPhone || !/^\d{6}$/.test(state.smsCode)) throw new Error('请输入正确的手机号和 6 位短信验证码')
      pendingRemember = state.rememberAvailable && state.rememberPassword
      return adapter.loginBySms(state.phoneDigits, state.smsCode, pendingRemember)
    }
    if (state.platform === 'mp') throw new Error('请使用手机号验证码登录')
    if (!state.username.trim() || !state.password) throw new Error('请输入统一账号和密码')
    pendingRemember = state.rememberAvailable && state.rememberPassword
    return adapter.loginByPassword(state.username.trim(), state.password, pendingRemember)
  }

  /** 统一的提交：校验协议 → 认证 → 二次验证或进入业务。 */
  async function submit() {
    if (state.busy || state.view === 'home' || !ensureAgreed()) return
    const wasMfa = state.view === 'mfa'
    // 本地格式错误不消耗一次性挑战，留在当前步骤供用户补全。
    if (wasMfa) {
      const code = state.mfaCode.replace(/[\s-]/g, '').toUpperCase()
      if (!/^\d{6}$/.test(code) && !/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/.test(code)) {
        say('请输入 6 位动态码或有效的 10 位恢复码')
        return
      }
    }
    state.submitting = true
    say('')
    try {
      const outcome = await authenticate()
      if (disposed) return
      if (outcome.mfa) {
        if (!outcome.challengeToken) throw new Error('二次验证信息不完整，请重新登录')
        clearSecrets()
        state.challengeToken = outcome.challengeToken
        state.view = 'mfa'
        say('该账号已开启二次验证，请输入验证器上的动态码', 'notice')
        return
      }
      clearSecrets()
      state.completed = true
      await adapter.onSuccess(outcome.data)
    } catch (error) {
      if (disposed) return
      state.completed = false
      adapter.onError?.(error)
      // 挑战凭证只能校验一次，失败后回到第一步重新登录。
      if (wasMfa) returnToLogin()
      else { state.smsCode = ''; state.password = '' }
      say(errorText(error, '登录失败，请稍后重试') + (wasMfa ? '，请重新登录' : ''))
    } finally { state.submitting = false }
  }

  /** 其他需要同样防重复、同样错误处理的登录动作（如以已有会话继续）。 */
  async function run(task: () => Promise<T | undefined | void>) {
    if (state.busy || !ensureAgreed()) return
    state.submitting = true
    say('')
    try {
      const data = await task()
      if (disposed) return
      state.completed = true
      await adapter.onSuccess((data ?? undefined) as T | undefined)
    } catch (error) {
      if (disposed) return
      state.completed = false
      adapter.onError?.(error)
      say(errorText(error, '登录失败，请稍后重试'))
    } finally { state.submitting = false }
  }

  /** 微信 / 支付宝 / 国家政务服务平台：统一认证中心尚未接入授权回调，先提示待开通。 */
  function channelPending(name: string) {
    if (state.busy || !ensureAgreed()) return
    toast(`${name}登录待开通，请使用验证码或密码登录`)
  }

  function acceptPrivacy() {
    try { uni.setStorageSync(state.privacyKey, true); state.privacyVisible = false }
    catch { toast('无法保存隐私确认，请检查设备存储后重试') }
  }
  function refusePrivacy() {
    state.privacyVisible = false
    state.agreed = false
    clearSecrets()
    // Android 可退出；iOS 保留页面，但登录与短信请求仍被隐私关卡拦截。
    if (state.platform === 'app' && typeof plus !== 'undefined' && plus.os?.name === 'Android') { plus.runtime.quit(); return }
    toast('暂未同意隐私提示，登录功能尚未开启')
  }

  function dispose() {
    disposed = true
    clearTimeout(shakeStartTimer)
    clearTimeout(shakeEndTimer)
    clearInterval(timer)
    clearTimeout(toastTimer)
    clearSecrets()
  }

  return { toast, say, toggleAgree, ensureAgreed, openView, returnToLogin, requestCode, submit, run, channelPending, acceptPrivacy, refusePrivacy, dispose }
}

/** 统一的协议与帮助弹窗文案。 */
export function showAgreement(name: string) {
  uni.showModal({ title: `《${name}》`, content: `《${name}》正式文本由平台运营发布，如需查看全文请联系平台运营获取。`, showCancel: false })
}
export function showCodeHelp() {
  uni.showModal({ title: '收不到验证码', content: '请确认手机号已绑定统一账号且信号正常，60 秒后可重新获取；仍收不到请联系平台运营。', showCancel: false })
}
export function showPasswordHelp(content = '可使用绑定手机号的短信验证码登录，或联系平台运营核验身份后重置密码。') {
  uni.showModal({ title: '找回密码', content, showCancel: false })
}
