import { readSessionToken, sessionDeadline } from '../../../packages/agri-shared/src/auth/mobileSession'
import { logoutMobile } from '../../../packages/agri-shared/src/auth/logoutMobile'
declare const uni: any

export interface UnifiedAccount {
  id: string | number
  username: string
  nickname?: string
  roles?: string[]
}

const TOKEN_KEY = 'service_unified_token'
const USER_KEY = 'service_unified_user'
const PERMISSION_KEY = 'service_unified_permissions'
const runtimePlatform = uni.getSystemInfoSync().uniPlatform
const configuredApi = String(import.meta.env.VITE_SERVICE_API_BASE || '').replace(/\/$/, '')
const configuredAuth = String(import.meta.env.VITE_SERVICE_AUTH_BASE || '').replace(/\/$/, '')
const API_BASE = configuredApi
const AUTH_BASE = configuredAuth || (runtimePlatform === 'web' ? '' : API_BASE)

function apiRequest<T>(
  url: string,
  method: 'GET' | 'POST',
  data?: Record<string, unknown>,
  token?: string,
): Promise<{ status: number; body: T }> {
  if (runtimePlatform === 'web' && typeof location !== 'undefined' && !/^https?:$/.test(location.protocol)) {
    return Promise.reject(new Error('当前是文件预览，请从已部署的综合服务移动端入口登录'))
  }
  if (runtimePlatform !== 'web' && !/^https?:\/\//.test(url)) return Promise.reject(new Error('当前版本未配置统一登录地址，请联系平台更新客户端'))
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
        if (!response.data || typeof response.data !== 'object' || !('code' in response.data)) {
          reject(new Error(`统一认证接口返回异常（HTTP ${response.statusCode}），请检查访问入口或服务状态`))
          return
        }
        resolve({ status: response.statusCode, body: response.data })
      },
      fail(error: { errMsg?: string }) {
        reject(new Error(error?.errMsg || '统一认证中心连接失败'))
      },
    })
  })
}

function permissionGranted(permissions: string[], required: string) {
  return permissions.some(
    (code) => code === '*' || code === required || code === `${required.split(':')[0]}:*`,
  )
}

export function getServiceToken(): string {
  return readSessionToken(TOKEN_KEY, 'service_session_expires', clearUnifiedServiceSession)
}

export function getServiceUser(): UnifiedAccount | null {
  return (uni.getStorageSync(USER_KEY) as UnifiedAccount | null) || null
}

export function getServicePermissions(): string[] {
  return (uni.getStorageSync(PERMISSION_KEY) as string[] | null) || []
}

export function hasServicePermission(required: string): boolean {
  return permissionGranted(getServicePermissions(), required)
}

export function serviceLandingPage(): string {
  if (hasServicePermission('service:provider') && !hasServicePermission('service:consumer') && !hasServicePermission('service:admin')) {
    return '/pages/workbench/index'
  }
  return '/pages/home/index'
}

interface LoginData {
  expiresIn?: number | string
  accessToken?: string
  user?: UnifiedAccount
  mfaRequired?: boolean
  challengeToken?: string
}
interface AuthEnvelope<T> { code: number; message?: string; data?: T }
export type ServiceLoginResult =
  | { mfaRequired: true; challengeToken: string }
  | { mfaRequired: false; token: string; user: UnifiedAccount; permissions: string[] }

function assertSuccess(result: { status: number; body: { code: number; message?: string } }, fallback: string) {
  if (result.status >= 400 || result.body.code !== 0) {
    throw new Error(result.body.message || `${fallback}（HTTP ${result.status}）`)
  }
}

async function fetchPermissions(token: string): Promise<string[]> {
  const result = await apiRequest<AuthEnvelope<{ permissions?: string[] }>>(
    `${AUTH_BASE}/api/v1/platform/permissions/mine`, 'GET', undefined, token,
  )
  if (result.status === 401 || result.body?.code === 401) {
    const error = new Error('登录已失效，请重新登录') as Error & { status: number }; error.status = 401; throw error
  }
  assertSuccess(result, '统一账号权限校验失败，请重新登录或稍后重试')
  const permissions = result.body.data?.permissions
  if (!Array.isArray(permissions) || !permissions.every((value) => typeof value === 'string')) {
    throw new Error('统一认证权限数据异常，请稍后重试')
  }
  if (!['service:consumer', 'service:provider', 'service:admin'].some((code) => permissionGranted(permissions, code))) {
    throw new Error('当前统一账号没有综合服务角色权限，请联系平台运营开通')
  }
  return permissions
}

async function finishLogin(result: { status: number; body: AuthEnvelope<LoginData> }): Promise<ServiceLoginResult> {
  assertSuccess(result, '统一账号认证失败，请稍后重试')
  const data = result.body.data
  if (data?.mfaRequired) {
    if (!data.challengeToken) throw new Error('二次验证信息缺失，请重新登录')
    return { mfaRequired: true, challengeToken: data.challengeToken }
  }
  if (!data?.accessToken || !data.user) throw new Error('统一认证未返回完整会话，请重新登录')
  const permissions = await fetchPermissions(data.accessToken)
  uni.setStorageSync('service_session_expires', sessionDeadline(data.expiresIn))
  uni.setStorageSync(TOKEN_KEY, data.accessToken)
  uni.setStorageSync(USER_KEY, data.user)
  uni.setStorageSync(PERMISSION_KEY, permissions)
  return { mfaRequired: false, token: data.accessToken, user: data.user, permissions }
}

export async function loginWithUnifiedAccount(username: string, password: string, remember = true): Promise<ServiceLoginResult> {
  return finishLogin(await apiRequest<AuthEnvelope<LoginData>>(
    `${AUTH_BASE}/api/v1/sso/login-standalone`, 'POST',
    { username, password, marketId: 1, remember },
  ))
}

export async function completeUnifiedMfa(challengeToken: string, code: string, remember = true): Promise<ServiceLoginResult> {
  return finishLogin(await apiRequest<AuthEnvelope<LoginData>>(
    `${AUTH_BASE}/api/v1/sso/login-standalone-mfa`, 'POST',
    { challengeToken, code, marketId: 1, remember },
  ))
}

/** 手机号 + 短信验证码登录，与密码登录走同一套权限校验和会话保存。 */
export async function loginWithServiceSms(phone: string, code: string, remember = true): Promise<ServiceLoginResult> {
  return finishLogin(await apiRequest<AuthEnvelope<LoginData>>(
    `${AUTH_BASE}/api/v1/sso/login-standalone-by-sms`, 'POST',
    { phone: phone.trim(), code: code.trim(), marketId: 1, remember },
  ))
}

/** 发送登录短信验证码，返回给用户看的提示。 */
export async function sendServiceLoginCode(phone: string): Promise<string> {
  const result = await apiRequest<AuthEnvelope<{ sent?: boolean; devMode?: boolean; hint?: string }>>(
    `${AUTH_BASE}/api/v1/sso/sms/code`, 'POST', { phone: phone.trim(), scene: 'login' },
  )
  assertSuccess(result, '验证码发送失败，请稍后重试')
  if (!result.body.data?.sent) throw new Error('未能发送验证码，请稍后重试')
  return result.body.data.hint || (result.body.data.devMode ? '当前为短信开发模式，手机不会收到短信' : '验证码已发送，请查看短信')
}

// 每次启动重新验证旧会话，认证不可用时不继续使用缓存权限。
export async function restoreServiceSession(): Promise<boolean> {
  const token = getServiceToken()
  if (!token) return false
  try {
    const permissions = await fetchPermissions(token)
    if (getServiceToken() !== token) return false
    uni.setStorageSync(PERMISSION_KEY, permissions)
    return true
  } catch (error) {
    if (getServiceToken() === token) {
      if ((error as { status?: number })?.status === 401) clearUnifiedServiceSession()
      else uni.removeStorageSync(PERMISSION_KEY)
      uni.setStorageSync('service_login_notice', error instanceof Error ? error.message : '请重新登录统一账号')
    }
    return false
  }
}

export function clearUnifiedServiceSession() {
  uni.removeStorageSync('service_session_expires')
  uni.removeStorageSync(TOKEN_KEY)
  uni.removeStorageSync(USER_KEY)
  uni.removeStorageSync(PERMISSION_KEY)
}

export async function logoutUnifiedService() {
  const token = String(uni.getStorageSync(TOKEN_KEY) || '')
  const end = () => { clearUnifiedServiceSession(); uni.reLaunch({ url: '/pages/login/index' }) }
  await logoutMobile(`${AUTH_BASE}/api/v1/auth/logout`, token, end, end,
    () => String(uni.getStorageSync(TOKEN_KEY) || '') === token)
}

export function handleServiceUnauthorized() {
  clearUnifiedServiceSession()
  uni.reLaunch({ url: '/pages/login/index' })
}
