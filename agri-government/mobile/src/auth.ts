declare const uni: any

export interface UnifiedAccount {
  id: number | string
  username: string
  nickname?: string
  roles?: string[]
}

const TOKEN_KEY = 'gov_unified_token'
const USER_KEY = 'gov_unified_user'
const PERMISSION_KEY = 'gov_unified_permissions'
const runtimePlatform = uni.getSystemInfoSync().uniPlatform
const configuredApi = String(import.meta.env.VITE_GOVERNMENT_API_BASE || '').replace(/\/$/, '')
const configuredAuth = String(import.meta.env.VITE_GOVERNMENT_AUTH_BASE || '').replace(/\/$/, '')
const API_BASE = configuredApi || (runtimePlatform === 'web' ? '' : 'http://127.0.0.1:8095')
const AUTH_BASE = configuredAuth || (runtimePlatform === 'web' ? '' : API_BASE)

function request<T>(
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

export function getGovToken(): string {
  return uni.getStorageSync(TOKEN_KEY) || ''
}

export function getGovUser(): UnifiedAccount | null {
  return (uni.getStorageSync(USER_KEY) as UnifiedAccount | null) || null
}

export async function loginWithUnifiedAccount(
  username: string,
  password: string,
): Promise<{ token: string; user: UnifiedAccount; permissions: string[] }> {
  const login = await request<{
    code: number
    message?: string
    data?: { accessToken: string; user: UnifiedAccount }
  }>(
    `${AUTH_BASE}/api/v1/sso/login-standalone`,
    'POST',
    { username, password, marketId: 1, remember: true },
  )
  if (login.status >= 400 || login.body.code !== 0 || !login.body.data?.accessToken) {
    throw new Error(login.body.message || '统一账号登录失败')
  }
  const token = login.body.data.accessToken
  const permission = await request<{
    code: number
    message?: string
    data?: { permissions?: string[] }
  }>(`${AUTH_BASE}/api/v1/platform/permissions/mine`, 'GET', undefined, token)
  const permissions = permission.body.data?.permissions || []
  const allowed = permissions.some((code) =>
    code === '*' || code === 'gov:inspector' || code === 'gov:admin' || code === 'gov:*',
  )
  if (permission.status >= 400 || !allowed) {
    throw new Error('当前统一账号没有政府监管执法或运营权限，请联系平台运营开通')
  }
  uni.setStorageSync(TOKEN_KEY, token)
  uni.setStorageSync(USER_KEY, login.body.data.user)
  uni.setStorageSync(PERMISSION_KEY, permissions)
  return { token, user: login.body.data.user, permissions }
}

export function clearGovSession() {
  uni.removeStorageSync(TOKEN_KEY)
  uni.removeStorageSync(USER_KEY)
  uni.removeStorageSync(PERMISSION_KEY)
}

export async function logoutGov() {
  try {
    await request(`${AUTH_BASE}/api/v1/auth/logout`, 'POST', {}, getGovToken())
  } catch {
    // 本地身份必须清理，即使统一认证服务暂时不可达。
  }
  clearGovSession()
  uni.reLaunch({ url: '/pages/login/index' })
}

export function handleGovUnauthorized() {
  clearGovSession()
  uni.reLaunch({ url: '/pages/login/index' })
}
