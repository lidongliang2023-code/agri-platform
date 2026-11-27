import { readSessionToken, sessionDeadline } from '../../../packages/agri-shared/src/auth/mobileSession'
import { logoutMobile } from '../../../packages/agri-shared/src/auth/logoutMobile'
declare const uni: any

const TOKEN_KEY = 'trade_unified_token'
const USER_KEY = 'trade_unified_user'
const PERMISSION_KEY = 'trade_unified_permissions'
export type TradeRole = 'buyer' | 'seller'
const ROLE_KEY = 'trade_active_role'
/** 中心选择是界面偏好，不替代服务端的经营主体与业务权限校验。 */
export function getTradeRole(): TradeRole {
  return uni.getStorageSync(ROLE_KEY) === 'seller' ? 'seller' : 'buyer'
}
export function setTradeRole(role: TradeRole) {
  if (role !== 'buyer' && role !== 'seller') return
  uni.setStorageSync(ROLE_KEY, role)
}
export function requireTradeRole(role: TradeRole): boolean {
  if (getTradeRole() === role) return true
  uni.showToast({ title: `请先在“我的”切换到${role === 'buyer' ? '买家' : '卖家'}中心`, icon: 'none' })
  uni.switchTab({ url: '/pages/profile/index' })
  return false
}
// 平台由编译目标确定，不能在模块导入阶段依赖真机设备接口。
let web = false
// #ifdef H5
web = true
// #endif
export const isTradeWeb = web

export function getTradeStatusBarHeight(): number {
  try {
    const info = typeof uni.getWindowInfo === 'function' ? uni.getWindowInfo() : uni.getSystemInfoSync()
    const height = Number(info?.statusBarHeight || 0)
    return Number.isFinite(height) && height >= 0 ? height : 0
  } catch { return 0 }
}
const configuredApi = String(import.meta.env.VITE_TRADE_API_BASE || '').replace(/\/$/, '')
const configuredAuth = String(import.meta.env.VITE_TRADE_AUTH_BASE || '').replace(/\/$/, '')
export const API_ORIGIN = configuredApi
const AUTH_BASE = configuredAuth

/** 仅微信开发预览允许私有 IPv4 HTTP；体验版、正式版以及其他平台仍须 HTTPS。 */
export function isTradeLanPreview(base = API_ORIGIN): boolean {
  // VITE_TRADE_LAN_PREVIEW 是构建时显式开关；不再依赖 MODE，避免预览构建漏传 mode 后把认证误判为未配置。
  if (String(import.meta.env.VITE_TRADE_LAN_PREVIEW || '').toLowerCase() !== 'true') return false
  const match = /^http:\/\/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?::\d{1,5})?$/.exec(base)
  if (!match) return false
  const octets = match.slice(1).map(Number)
  if (octets.some(value => value > 255)) return false
  if (!(octets[0] === 10 || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) || (octets[0] === 192 && octets[1] === 168))) return false
  try {
    return typeof uni.getAccountInfoSync === 'function' && uni.getAccountInfoSync()?.miniProgram?.envVersion === 'develop'
  } catch { return false }
}

export function isTradeServiceConfigured(base = API_ORIGIN): boolean {
  return web || /^https:\/\//.test(base) || isTradeLanPreview(base)
}

function request<T>(url: string, method: 'GET' | 'POST', data?: Record<string, unknown>, token?: string) {
  if (!isTradeServiceConfigured(AUTH_BASE)) throw new Error('请配置可访问的 HTTPS 认证服务地址')
  return new Promise<{ status: number; body: T }>((resolve, reject) => {
    uni.request({
      url,
      method,
      data,
      timeout: 15000,
      header: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      success(response: { statusCode: number; data: T }) {
        resolve({ status: response.statusCode, body: response.data })
      },
      fail(error: { errMsg?: string }) {
        reject(new Error(/timeout/i.test(String(error?.errMsg || '')) ? '统一认证中心响应超时，请稍后重试' : '统一认证中心连接失败，请检查网络后重试'))
      },
    })
  })
}

export function getTradeToken() {
  return readSessionToken(TOKEN_KEY, 'trade_token_expires', clearTradeSession)
}

export function getTradeUser() {
  return uni.getStorageSync(USER_KEY) || null
}

/** 统一认证中心 /api/v1/sso/login-standalone* 的返回（SsoController.StandaloneLoginResult）。 */
interface StandaloneLogin {
  accessToken?: string | null
  expiresIn?: number | string
  user?: { id?: number | string; username?: string; nickname?: string; roles?: string[] } | null
  stage?: string | null
  mfaRequired?: boolean | null
  challengeToken?: string | null
}

type SsoBody<T> = { code: number; message?: string; data?: T }

/** 登录结果：要么已登录，要么账号开了二次验证，需要再提交验证器上的动态码。 */
export type TradeLoginResult = { done: true; user: StandaloneLogin['user'] } | { done: false; challengeToken: string }

async function sso<T>(path: string, data: Record<string, unknown>, fallback: string): Promise<T> {
  const response = await request<SsoBody<T>>(`${AUTH_BASE}/api/v1/sso${path}`, 'POST', data)
  if (response.status >= 400 || response.body?.code !== 0) throw new Error(response.body?.message || fallback)
  return response.body.data as T
}

/** 签发令牌后校验交易权限再落本地；没有交易权限时撤销刚建立的统一会话，不留半登录状态。 */
async function completeTradeLogin(data: StandaloneLogin | undefined): Promise<TradeLoginResult> {
  if (data?.mfaRequired && data.challengeToken) return { done: false, challengeToken: data.challengeToken }
  const token = data?.accessToken
  if (!token) throw new Error('登录失败：统一认证中心未返回访问令牌')
  const permission = await request<SsoBody<{ permissions?: string[] }>>(
    `${AUTH_BASE}/api/v1/platform/permissions/mine`,
    'GET',
    undefined,
    token,
  )
  if (permission.status >= 400 || permission.body?.code !== 0) throw new Error('无法校验交易权限，请重试')
  const permissions = permission.body.data?.permissions || []
  if (!permissions.some((code) => ['*', 'trade:read', 'trade:*'].includes(code))) {
    void request(`${AUTH_BASE}/api/v1/auth/logout`, 'POST', {}, token).catch(() => undefined)
    throw new Error('当前统一账号没有交易撮合访问权限，请联系平台运营开通')
  }
  uni.setStorageSync('trade_token_expires', sessionDeadline(data.expiresIn))
  uni.setStorageSync(TOKEN_KEY, token)
  uni.setStorageSync(USER_KEY, data.user || {})
  uni.setStorageSync(PERMISSION_KEY, permissions)
  return { done: true, user: data.user }
}

/** 账号密码登录（用户名或手机号均可，与生产管理等子系统同一个统一账号）。 */
export async function loginTrade(username: string, password: string, remember = true) {
  const data = await sso<StandaloneLogin>('/login-standalone', { username, password, marketId: 1, remember }, '统一账号登录失败')
  return completeTradeLogin(data)
}

/** 手机号 + 短信验证码登录。 */
export async function loginTradeBySms(phone: string, code: string, remember = true) {
  const data = await sso<StandaloneLogin>('/login-standalone-by-sms', { phone, code, marketId: 1, remember }, '验证码登录失败')
  return completeTradeLogin(data)
}

/** 二次验证第二步：提交验证器动态码，challengeToken 由第一步返回、一次有效。 */
export async function loginTradeMfa(challengeToken: string, code: string, remember = true) {
  const data = await sso<StandaloneLogin>('/login-standalone-mfa', { challengeToken, code, marketId: 1, remember }, '二次验证失败')
  return completeTradeLogin(data)
}

/** 发送登录 / 找回密码验证码；开发模式下验证码只写后端日志。 */
export function sendTradeSmsCode(phone: string, scene: 'login' | 'reset_password') {
  return sso<{ sent?: boolean; devMode?: boolean; hint?: string }>('/sms/code', { phone, scene }, '验证码发送失败')
}

/** 手机验证码重置统一账号密码；成功后该账号在所有子系统的旧会话都会失效。 */
export async function resetTradePassword(phone: string, code: string, newPassword: string, confirmPassword: string) {
  await sso<unknown>('/password-reset', { phone, code, newPassword, confirmPassword }, '密码重置失败')
}

/** 统一认证中心网页版地址（注册账号、创建主体用）；只有 H5 能直接打开。 */
export function tradeSsoWebUrl(path = '/register') {
  const configured = String(import.meta.env.VITE_TRADE_SSO_WEB || '').replace(/\/$/, '')
  if (configured) return `${configured}${path}`
  if (!web || typeof location === 'undefined') return ''
  // 本地网关约定：交易移动端 :8181，统一认证中心 :8090（ops/gateway/conf/conf.d/50-sso.conf）
  return location.port === '8181' ? `${location.protocol}//${location.hostname}:8090${path}` : ''
}

export function clearTradeSession() {
  uni.removeStorageSync('trade_token_expires')
  uni.removeStorageSync(TOKEN_KEY)
  uni.removeStorageSync(USER_KEY)
  uni.removeStorageSync(PERMISSION_KEY)
  uni.removeStorageSync('trade_merchant')
}

export async function logoutTrade() {
  const token = String(uni.getStorageSync(TOKEN_KEY) || '')
  const end = () => { clearTradeSession(); uni.reLaunch({ url: '/pages/login/index' }) }
  await logoutMobile(`${AUTH_BASE}/api/v1/auth/logout`, token, end, end,
    () => String(uni.getStorageSync(TOKEN_KEY) || '') === token)
}

export function handleTradeUnauthorized() {
  clearTradeSession()
  requireTradeLogin()
}

let navigatingLogin = false
export function requireTradeLogin(): boolean {
  if (getTradeToken()) return true
  if (navigatingLogin) return false
  const pages = getCurrentPages() as any[]
  const current = pages[pages.length - 1]
  if (current?.route === 'pages/login/index') return false
  if (current?.route) {
    const opts = current.options || {}
    const q = Object.keys(opts).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(opts[k])}`).join('&')
    uni.setStorageSync('trade_return_to', `/${current.route}${q ? '?' + q : ''}`)
  }
  navigatingLogin = true
  uni.navigateTo({ url:'/pages/login/index', complete:()=> { navigatingLogin = false } })
  return false
}
export function finishTradeLogin() {
  const target = String(uni.getStorageSync('trade_return_to') || '/pages/home/index')
  uni.removeStorageSync('trade_return_to')
  const safe = /^\/pages\/[a-z-]+\/(index|detail)(\?|$)/.test(target) ? target : '/pages/home/index'
  const tabs = ['home','products','demands','orders','profile'].map(p=>`/pages/${p}/index`)
  if (tabs.includes(safe.split('?')[0])) uni.switchTab({url:safe.split('?')[0]})
  else {
    const pages = getCurrentPages() as any[]
    const previous = pages[pages.length - 2]
    const [route, search = ''] = safe.split('?')
    const expected: Record<string, string> = {}
    search.split('&').filter(Boolean).forEach(pair => {
      const [key, ...value] = pair.split('=')
      expected[decodeURIComponent(key)] = decodeURIComponent(value.join('='))
    })
    const options = previous?.options || {}
    const sameOptions = Object.keys(expected).length === Object.keys(options).length
      && Object.entries(expected).every(([key, value]) => String(options[key]) === value)
    if (previous && `/${previous.route}` === route && sameOptions) uni.navigateBack({delta:1})
    else uni.redirectTo({url:safe})
  }
}
