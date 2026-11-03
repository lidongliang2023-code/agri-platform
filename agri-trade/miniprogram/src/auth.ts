declare const uni: any

const TOKEN_KEY = 'trade_unified_token'
const USER_KEY = 'trade_unified_user'
const PERMISSION_KEY = 'trade_unified_permissions'
const runtimePlatform = uni.getSystemInfoSync().uniPlatform
const configuredApi = String(import.meta.env.VITE_TRADE_API_BASE || '').replace(/\/$/, '')
const configuredAuth = String(import.meta.env.VITE_TRADE_AUTH_BASE || '').replace(/\/$/, '')
export const API_ORIGIN = configuredApi || (runtimePlatform === 'web' ? '' : 'http://127.0.0.1:8089')
const AUTH_BASE = configuredAuth || (runtimePlatform === 'web' ? '' : 'http://127.0.0.1:8093')

function request<T>(url: string, method: 'GET' | 'POST', data?: Record<string, unknown>, token?: string) {
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
        reject(new Error(error?.errMsg || '统一认证中心连接失败'))
      },
    })
  })
}

export function getTradeToken() {
  return uni.getStorageSync(TOKEN_KEY) || ''
}

export function getTradeUser() {
  return uni.getStorageSync(USER_KEY) || null
}

export async function loginTrade(username: string, password: string) {
  const login = await request<{ code: number; message?: string; data?: { accessToken: string; user: Record<string, unknown> } }>(
    `${AUTH_BASE}/api/v1/sso/login-standalone`,
    'POST',
    { username, password, marketId: 1, remember: true },
  )
  if (login.status >= 400 || login.body.code !== 0 || !login.body.data?.accessToken) {
    throw new Error(login.body.message || '统一账号登录失败')
  }
  const token = login.body.data.accessToken
  const permission = await request<{ code: number; data?: { permissions?: string[] } }>(
    `${AUTH_BASE}/api/v1/platform/permissions/mine`,
    'GET',
    undefined,
    token,
  )
  const permissions = permission.body.data?.permissions || []
  if (!permissions.some((code) => ['*', 'trade:read', 'trade:*'].includes(code))) {
    throw new Error('当前统一账号没有交易撮合访问权限，请联系平台运营开通')
  }
  uni.setStorageSync(TOKEN_KEY, token)
  uni.setStorageSync(USER_KEY, login.body.data.user)
  uni.setStorageSync(PERMISSION_KEY, permissions)
  return login.body.data
}

export function clearTradeSession() {
  uni.removeStorageSync(TOKEN_KEY)
  uni.removeStorageSync(USER_KEY)
  uni.removeStorageSync(PERMISSION_KEY)
}

export async function logoutTrade() {
  try {
    await request(`${AUTH_BASE}/api/v1/auth/logout`, 'POST', {}, getTradeToken())
  } catch {
    // 本地身份必须清理。
  }
  clearTradeSession()
  uni.reLaunch({ url: '/pages/login/index' })
}

export function handleTradeUnauthorized() {
  clearTradeSession()
  uni.reLaunch({ url: '/pages/login/index' })
}
