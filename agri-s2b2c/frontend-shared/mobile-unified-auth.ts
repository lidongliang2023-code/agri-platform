declare const uni: any

export interface UnifiedAccount {
  id: number | string
  username: string
  nickname?: string
  roles?: string[]
}

interface LoginData {
  accessToken: string
  user: UnifiedAccount
}

const TOKEN_KEY = 's2b2c_unified_token'
const USER_KEY = 's2b2c_unified_user'

const runtimePlatform = uni.getSystemInfoSync().uniPlatform
const configuredApi = String(import.meta.env.VITE_S2B2C_API_BASE || '').replace(/\/$/, '')
const configuredAuth = String(import.meta.env.VITE_S2B2C_AUTH_BASE || '').replace(/\/$/, '')
const webApi = runtimePlatform === 'web' ? '' : 'http://127.0.0.1:8088/api'
const API_BASE = configuredApi || webApi
const API_ORIGIN = API_BASE.replace(/\/api$/, '')
const AUTH_BASE = configuredAuth || (runtimePlatform === 'web' ? '' : API_ORIGIN)

function apiRequest<T>(
  url: string,
  method: 'GET' | 'POST',
  data?: Record<string, unknown>,
  token?: string,
): Promise<{ status: number; body: T }> {
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
  return uni.getStorageSync(TOKEN_KEY) || ''
}

export function getUnifiedAccount(): UnifiedAccount | null {
  return (uni.getStorageSync(USER_KEY) as UnifiedAccount | null) || null
}

export async function loginWithUnifiedAccount(
  username: string,
  password: string,
  requiredPermission: string,
): Promise<{ token: string; user: UnifiedAccount; permissions: string[] }> {
  const login = await apiRequest<{ code: number; message?: string; data?: LoginData }>(
    `${AUTH_BASE}/api/v1/sso/login-standalone`,
    'POST',
    { username, password, marketId: 1, remember: true },
  )
  if (login.status >= 400 || login.body.code !== 0 || !login.body.data?.accessToken) {
    throw new Error(login.body.message || '统一账号登录失败')
  }
  const token = login.body.data.accessToken
  const permission = await apiRequest<{
    code: number
    message?: string
    data?: { permissions?: string[] }
  }>(`${AUTH_BASE}/api/v1/platform/permissions/mine`, 'GET', undefined, token)
  const permissions = permission.body.data?.permissions || []
  if (permission.status >= 400 || !granted(permissions, requiredPermission)) {
    throw new Error(`当前统一账号没有 ${requiredPermission} 权限，请联系平台运营开通 S2B2C 角色权限`)
  }
  uni.setStorageSync(TOKEN_KEY, token)
  uni.setStorageSync(USER_KEY, login.body.data.user)
  return { token, user: login.body.data.user, permissions }
}

export function clearUnifiedAccount() {
  uni.removeStorageSync(TOKEN_KEY)
  uni.removeStorageSync(USER_KEY)
}

export async function logoutUnifiedAccount() {
  const token = getUnifiedToken()
  try {
    await apiRequest(`${AUTH_BASE}/api/v1/auth/logout`, 'POST', {}, token)
  } catch {
    // 即使服务端会话已失效，也必须清理移动端本地身份。
  }
  clearUnifiedAccount()
}

export function handleUnauthorized() {
  clearUnifiedAccount()
  uni.reLaunch({ url: '/pages/login/index' })
}
