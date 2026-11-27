import { readSessionToken, sessionDeadline } from '../../packages/agri-shared/src/auth/mobileSession'
import { logoutMobile } from '../../packages/agri-shared/src/auth/logoutMobile'
declare const uni: any

export interface UnifiedAccount {
  id: number | string
  username: string
  nickname?: string
  roles?: string[]
}

interface LoginData {
  expiresIn?: number | string
  accessToken?: string
  user?: UnifiedAccount
  mfaRequired?: boolean
  challengeToken?: string
}

/** 登录结果：已登录，或账号开启了二次验证、需要再提交动态码。 */
export type UnifiedLoginResult =
  | { mfaRequired: true; challengeToken: string }
  | { mfaRequired: false; token: string; user: UnifiedAccount; permissions: string[] }

const TOKEN_KEY = 's2b2c_unified_token'
const USER_KEY = 's2b2c_unified_user'

const runtimePlatform = uni.getSystemInfoSync().uniPlatform
const configuredApi = String(uni.getStorageSync('s2b2c_api_base') || import.meta.env.VITE_S2B2C_API_BASE || '').replace(/\/$/, '')
const configuredAuth = String(import.meta.env.VITE_S2B2C_AUTH_BASE || '').replace(/\/$/, '')
const API_BASE = configuredApi
const API_ORIGIN = API_BASE.replace(/\/api$/, '')
const AUTH_BASE = configuredAuth || (runtimePlatform === 'web' ? '' : API_ORIGIN)

function apiRequest<T>(
  url: string,
  method: 'GET' | 'POST',
  data?: Record<string, unknown>,
  token?: string,
): Promise<{ status: number; body: T }> {
  if (runtimePlatform !== 'web') {
    const match = /^https:\/\/([^/?#]+)(\/[^?#]*)?$/i.exec(url)
    if (!match || match[1].includes('@') || /^(localhost|127\.[\d.]+|0\.0\.0\.0|\[::1\])(?::\d+)?$/i.test(match[1])) {
      return Promise.reject(new Error('小程序和 App 须配置设备可访问的 HTTPS 统一认证地址'))
    }
  }
  return new Promise((resolve, reject) => {
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
        reject(new Error(error?.errMsg || '统一认证中心连接失败'))
      },
    })
  })
}

function granted(permissions: string[], required: string) {
  return permissions.some(
    (code) => code === '*' || code === required || code === `${required.split(':')[0]}:*`,
  )
}

export function getUnifiedToken(): string {
  return readSessionToken(TOKEN_KEY, 's2b2c_session_expires', clearUnifiedAccount)
}

export function getUnifiedAccount(): UnifiedAccount | null {
  return (uni.getStorageSync(USER_KEY) as UnifiedAccount | null) || null
}

async function standaloneLogin(
  path: 'login-standalone' | 'login-standalone-by-sms' | 'login-standalone-mfa',
  body: Record<string, unknown>,
  requiredPermission: string,
): Promise<UnifiedLoginResult> {
  const login = await apiRequest<{ code: number; message?: string; data?: LoginData }>(
    `${AUTH_BASE}/api/v1/sso/${path}`,
    'POST',
    { ...body, marketId: 1 },
  )
  if (login.status >= 400 || login.body?.code !== 0) {
    throw new Error(login.body?.message || '统一账号登录失败')
  }
  const data = login.body.data
  // 开启二次验证的账号：认证中心只返回一次性挑战凭证，不保存半成品会话。
  if (data?.mfaRequired) {
    if (!data.challengeToken) throw new Error('二次验证信息缺失，请重新登录')
    return { mfaRequired: true, challengeToken: data.challengeToken }
  }
  if (typeof data?.accessToken !== 'string' || !data.accessToken.trim() || data.user?.id == null || !data.user.username) throw new Error('统一认证中心未返回有效登录结果')
  const token = data.accessToken
  const permission = await apiRequest<{
    code: number
    message?: string
    data?: { permissions?: string[] }
  }>(`${AUTH_BASE}/api/v1/platform/permissions/mine`, 'GET', undefined, token)
  const permissions = permission.body?.data?.permissions
  if (permission.status < 200 || permission.status >= 300 || permission.body?.code !== 0
    || !Array.isArray(permissions) || !permissions.every(code => typeof code === 'string')) {
    throw new Error('统一账号权限校验失败，请稍后重试')
  }
  if (!granted(permissions, requiredPermission)) {
    throw new Error(`当前统一账号没有 ${requiredPermission} 权限，请联系平台运营开通 S2B2C 角色权限`)
  }
  const expires = sessionDeadline(data.expiresIn)
  try {
    uni.setStorageSync('s2b2c_session_expires', expires)
    uni.setStorageSync(USER_KEY, data.user)
    uni.setStorageSync(TOKEN_KEY, token)
  } catch {
    clearUnifiedAccount()
    throw new Error('无法保存登录状态，请检查设备存储后重试')
  }
  return { mfaRequired: false, token, user: data.user, permissions }
}

/** 统一账号密码登录；remember 由登录页按端规则传入（H5 不保留免登录）。 */
export function loginWithUnifiedAccount(
  username: string,
  password: string,
  requiredPermission: string,
  remember = false,
): Promise<UnifiedLoginResult> {
  return standaloneLogin('login-standalone', { username, password, remember }, requiredPermission)
}

/** 手机号 + 短信验证码登录。 */
export function loginWithUnifiedSms(phone: string, code: string, requiredPermission: string, remember = true) {
  return standaloneLogin('login-standalone-by-sms', { phone: phone.trim(), code: code.trim(), remember }, requiredPermission)
}

/** 二次验证第二步：挑战凭证一次有效。 */
export function completeUnifiedMfa(challengeToken: string, code: string, requiredPermission: string, remember = true) {
  return standaloneLogin('login-standalone-mfa', { challengeToken, code: code.trim(), remember }, requiredPermission)
}

/** 发送登录短信验证码，返回给用户看的提示。 */
export async function sendUnifiedLoginCode(phone: string): Promise<string> {
  const result = await apiRequest<{ code: number; message?: string; data?: { sent?: boolean; devMode?: boolean; hint?: string } }>(
    `${AUTH_BASE}/api/v1/sso/sms/code`, 'POST', { phone: phone.trim(), scene: 'login' },
  )
  if (result.status >= 400 || result.body?.code !== 0 || !result.body.data?.sent) {
    throw new Error(result.body?.message || '验证码发送失败，请稍后重试')
  }
  return result.body.data.hint || (result.body.data.devMode ? '当前为短信开发模式，手机不会收到短信' : '验证码已发送，请查看短信')
}

export function clearUnifiedAccount() {
  uni.removeStorageSync('s2b2c_session_expires')
  uni.removeStorageSync(TOKEN_KEY)
  uni.removeStorageSync(USER_KEY)
  uni.$emit('s2b2c:session-cleared')
}

export async function logoutUnifiedAccount() {
  const token = String(uni.getStorageSync(TOKEN_KEY) || '')
  const success = await logoutMobile(`${AUTH_BASE}/api/v1/auth/logout`, token, clearUnifiedAccount,
    () => { clearUnifiedAccount(); uni.reLaunch({ url: '/pages/login/index' }) },
    () => String(uni.getStorageSync(TOKEN_KEY) || '') === token)
  return success
}

/**
 * 401 的统一处理：清本地身份，并（除非正停在允许匿名访问的页面上）送回登录页。
 *
 * <p>`publicPages` 的判据与 PC 端一致：**这一页要展示的东西全部来自免登录端点**才算公开页。
 * 消费者扫包装上的溯源码落到的就是这一页，若跟着跳转，扫码第一步变成"请先登录"，
 * 而后端 /api/public/trace/** 本来就是公开的——链路明明查得到，却没人能看到。</p>
 */
export function handleUnauthorized(publicPages: string[] = []) {
  clearUnifiedAccount()
  if (publicPages.length && isPublicPage(publicPages)) return
  const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
  const current = pages[pages.length - 1] as {route?: string; options?: Record<string,string>} | undefined
  if (current?.route === 'pages/login/index') return
  const query = Object.entries(current?.options || {}).map(([k,v])=>`${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
  const target = current?.route ? `/${current.route}${query?'?'+query:''}` : '/pages/profile/index'
  uni.setStorageSync('s2b2c_channel_redirect', target)
  uni.reLaunch({ url: `/pages/login/index?redirect=${encodeURIComponent(target)}` })
}

/** uni-app 的页面栈顶就是当前页；路由名不带前导斜杠（pages/services/index）。 */
function isPublicPage(publicPages: string[]): boolean {
  const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
  const route = String((pages[pages.length - 1] as { route?: string } | undefined)?.route ?? '')
  return publicPages.some((p) => route === p.replace(/^\/+/, '') || route.startsWith(`${p.replace(/^\/+/, '')}/`))
}
