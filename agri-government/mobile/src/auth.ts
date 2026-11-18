import { logoutMobile } from '../../../packages/agri-shared/src/auth/logoutMobile'
import { governmentBase } from './endpoints'
declare const uni: any

export interface UnifiedAccount {
  id: number | string
  username: string
  nickname?: string
  roles?: string[]
}

interface LoginData {
  accessToken?: string
  user?: UnifiedAccount
  mfaRequired?: boolean
  challengeToken?: string
}
interface Envelope<T> { code: number; message?: string; data?: T }
export class GovMfaRequired extends Error {
  constructor(public readonly challengeToken: string) {
    super('请输入身份验证器中的动态验证码完成登录')
    this.name = 'GovMfaRequired'
  }
}
const TOKEN_KEY = 'gov_unified_token'
const USER_KEY = 'gov_unified_user'
const PERMISSION_KEY = 'gov_unified_permissions'

function request<T>(
  path: string,
  method: 'GET' | 'POST',
  data?: Record<string, unknown>,
  token?: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${governmentBase('auth')}${path}`,
      method, data, timeout: 15000,
      header: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      success(response: { statusCode: number; data: Envelope<T> }) {
        const body = response.data
        if (response.statusCode < 200 || response.statusCode >= 300 || body?.code !== 0 || !body.data) {
          reject(new Error(body?.message || (response.statusCode === 401
            ? '统一登录凭证已失效，请重新登录' : '统一认证服务响应异常，请稍后重试')))
          return
        }
        resolve(body.data)
      },
      fail() { reject(new Error('统一认证中心连接失败，请检查网络后重试')) },
    })
  })
}

export function getGovToken(): string {
  return uni.getStorageSync(TOKEN_KEY) || ''
}
export function getGovUser(): UnifiedAccount | null {
  return (uni.getStorageSync(USER_KEY) as UnifiedAccount | null) || null
}

async function acceptLogin(login: LoginData): Promise<{
  token: string; user: UnifiedAccount; permissions: string[]
}> {
  if (login.mfaRequired === true) {
    if (typeof login.challengeToken !== 'string' || !login.challengeToken.trim()) {
      throw new Error('统一认证二次验证信息不完整，请重新登录')
    }
    throw new GovMfaRequired(login.challengeToken)
  }
  const token = login.accessToken
  const user = login.user
  if (typeof token !== 'string' || !token.trim() || !user || user.id == null || !user.username) {
    throw new Error('统一认证返回的登录信息不完整，请重新登录')
  }
  const permission = await request<{ permissions?: unknown }>(
    '/api/v1/platform/permissions/mine', 'GET', undefined, token,
  )
  if (!Array.isArray(permission.permissions)
    || !permission.permissions.every((code) => typeof code === 'string')) {
    throw new Error('统一认证权限信息格式异常，请稍后重试')
  }
  const permissions: string[] = permission.permissions
  if (!permissions.some((code) => code === '*' || code === 'gov:inspector' || code === 'gov:*')) {
    throw new Error('当前统一账号没有政府监管执法权限，请联系平台运营开通')
  }
  try {
    uni.setStorageSync(USER_KEY, user)
    uni.setStorageSync(PERMISSION_KEY, permissions)
    uni.setStorageSync(TOKEN_KEY, token)
  } catch {
    clearGovSession()
    throw new Error('无法保存登录状态，请检查设备存储后重试')
  }
  return { token, user, permissions }
}

export async function loginWithUnifiedAccount(username: string, password: string, remember = true) {
  clearGovSession()
  // 登录前检查业务地址，避免认证成功后才发现无法访问执法服务。
  governmentBase('api')
  return acceptLogin(await request<LoginData>('/api/v1/sso/login-standalone', 'POST', {
    username: username.trim(), password, marketId: 1, remember,
  }))
}

export async function completeGovMfa(challengeToken: string, code: string, remember = true) {
  clearGovSession()
  governmentBase('api')
  return acceptLogin(await request<LoginData>('/api/v1/sso/login-standalone-mfa', 'POST', {
    challengeToken, code: code.trim(), marketId: 1, remember,
  }))
}

export function clearGovSession() {
  uni.removeStorageSync(TOKEN_KEY)
  uni.removeStorageSync(USER_KEY)
  uni.removeStorageSync(PERMISSION_KEY)
}

export async function logoutGov() {
  try {
    const token = getGovToken()
    const endCurrentSession = () => {
      if (getGovToken() === token) handleGovUnauthorized()
    }
    return await logoutMobile(`${governmentBase('auth')}/api/v1/auth/logout`, token,
      endCurrentSession, endCurrentSession)
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '退出失败，请重试', icon: 'none' })
    return false
  }
}

let redirectingToLogin = false
/** 等当前页面导航完成后再读取页面栈，避免 onShow 中读到上一页或跳转被覆盖。 */
export function handleGovUnauthorized() {
  clearGovSession()
  if (redirectingToLogin) return
  redirectingToLogin = true
  const redirect = (retry: boolean) => {
    let onLoginPage = getCurrentPages().slice(-1)[0]?.route === 'pages/login/index'
    // #ifdef H5
    // 浏览器直接更改 hash 时，页面栈可能仍是上一页，必须以实际 URL 为准。
    onLoginPage = window.location.hash.split('?')[0] === '#/pages/login/index'
    // #endif
    if (getGovToken() || onLoginPage) {
      redirectingToLogin = false
      return
    }
    // #ifdef H5
    if (!retry) {
      redirectingToLogin = false
      window.location.replace(`${window.location.pathname}${window.location.search}#/pages/login/index`)
      window.location.reload()
      return
    }
    // #endif
    uni.reLaunch({
      url: '/pages/login/index',
      complete: () => {
        if (retry) {
          // 初始路由或原生页面动画可能仍在完成；只补偿一次，避免跳转循环。
          setTimeout(() => redirect(false), 150)
        } else {
          redirectingToLogin = false
        }
      },
    })
  }
  setTimeout(() => redirect(true), 0)
}
