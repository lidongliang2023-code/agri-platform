import { logoutMobile } from '../../../packages/agri-shared/src/auth/logoutMobile'
declare const uni: any

/**
 * 信息资讯移动端 · 统一登录（平台 SSO）。
 *
 * 移动端（小程序 / App）无法像 PC 那样做浏览器整页跳转，因此统一采用
 * 平台提供的 standalone 授权入口 `/api/v1/sso/login-standalone`：
 * 账号体系统一、令牌体系统一、权限词表统一（`info:consumer` / `info:admin`），
 * 只是换取令牌的方式从「授权码 + PKCE 重定向」换成「同账号密码直连」。
 */

export interface UnifiedAccount {
  id: number | string
  username: string
  nickname?: string
  roles?: string[]
}

const TOKEN_KEY = 'info_unified_token'
const USER_KEY = 'info_unified_user'
const PERMISSION_KEY = 'info_unified_permissions'

const runtimePlatform = uni.getSystemInfoSync().uniPlatform
const configuredApi = String(import.meta.env.VITE_INFO_API_BASE || '').replace(/\/$/, '')
const configuredAuth = String(import.meta.env.VITE_INFO_AUTH_BASE || '').replace(/\/$/, '')

/** H5 走同源（Vite 代理 / 网关反代）；小程序与 App 需注入可访问的服务域名。 */
const API_BASE = configuredApi || (runtimePlatform === 'web' ? '' : 'http://127.0.0.1:8096')
const AUTH_BASE = configuredAuth || (runtimePlatform === 'web' ? '' : 'http://127.0.0.1:8093')

/**
 * 视频地址前缀。
 *
 * <p>课程视频由网关的 {@code /vod/} 静态服务提供，不在后端端口上。
 * 小程序与 App 里 {@code <video>} 必须拿到绝对地址，所以这里单独留一个
 * {@code VITE_INFO_MEDIA_BASE}：生产填网关域名（如 https://info.example.com），
 * 不填则退回 API_BASE（本地开发够用，正式环境请务必显式配置）。</p>
 */
const configuredMedia = String(import.meta.env.VITE_INFO_MEDIA_BASE || '').replace(/\/$/, '')
const MEDIA_BASE = configuredMedia || API_BASE

export { API_BASE, AUTH_BASE, MEDIA_BASE }

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

export interface InfoMerchant { merchantId: string; merchantName: string }

/** 主体清单取自统一平台，前端选择不构成授权，交易服务仍会校验归属及身份。 */
export async function getInfoMerchants(): Promise<InfoMerchant[]> {
  const token = getInfoToken()
  if (!token) throw new Error('请先登录')
  const result = await apiRequest<{ code: number; message?: string; data?: InfoMerchant[] }>(
    `${AUTH_BASE}/api/v1/platform/merchants/mine`, 'GET', undefined, token)
  if (token !== getInfoToken()) throw new Error('登录会话已变化，请重新加载经营主体')
  if (result.status === 401) handleInfoUnauthorized()
  if (result.status >= 400 || result.body.code !== 0 || !Array.isArray(result.body.data)) {
    throw new Error(result.body.message || '经营主体加载失败，请重试')
  }
  return result.body.data.map(item => ({ merchantId: String(item.merchantId), merchantName: item.merchantName }))
}

function permissionGranted(permissions: string[], required: string) {
  return permissions.some(
    (code) => code === '*' || code === required || code === `${required.split(':')[0]}:*`,
  )
}

export function getInfoToken(): string {
  return uni.getStorageSync(TOKEN_KEY) || ''
}

export function getInfoUser(): UnifiedAccount | null {
  return (uni.getStorageSync(USER_KEY) as UnifiedAccount | null) || null
}

export function getInfoPermissions(): string[] {
  return (uni.getStorageSync(PERMISSION_KEY) as string[] | null) || []
}

export function hasInfoPermission(required: string): boolean {
  return permissionGranted(getInfoPermissions(), required)
}

/** 统一账号显示名称，仅用于展示；业务归属由后端验证令牌确定。 */
export function currentOwner(): string {
  const user = getInfoUser()
  return user?.nickname || user?.username || ''
}

/** 本机数据按不可变账号 ID 隔离，不迁移旧的无归属缓存。 */
export function accountStorageKey(key: string): string {
  return `${key}:uid:${getInfoUser()?.id ?? 'guest'}`
}

export function clearInfoCache(): void {
  const keys = uni.getStorageInfoSync().keys as string[]
  keys.filter((key) => key.startsWith('info_') && ![TOKEN_KEY, USER_KEY, PERMISSION_KEY].includes(key))
    .forEach((key) => uni.removeStorageSync(key))
}

export function isLoggedIn(): boolean {
  return Boolean(getInfoToken())
}

export interface InfoMfaChallenge {
  mfaRequired: true
  challengeToken: string
}

export interface InfoLoginSuccess {
  mfaRequired?: false
  token: string
  user: UnifiedAccount
  permissions: string[]
}

export function isInfoMfaChallenge(value: unknown): value is InfoMfaChallenge {
  return Boolean(value && typeof value === 'object' && (value as InfoMfaChallenge).mfaRequired === true)
    && Boolean((value as InfoMfaChallenge).challengeToken)
}

function persistInfoSession(token: string, user: UnifiedAccount, permissions: string[]) {
  // 登录账号变化时清理上一账号的临时草稿，内容缓存仍通过 accountStorageKey 隔离。
  clearInfoCache()
  uni.setStorageSync(TOKEN_KEY, token)
  uni.setStorageSync(USER_KEY, user)
  uni.setStorageSync(PERMISSION_KEY, permissions)
}

async function resolveInfoPermissions(token: string): Promise<string[]> {
  const permission = await apiRequest<{
    code: number
    message?: string
    data?: { permissions?: string[] }
  }>(`${AUTH_BASE}/api/v1/platform/permissions/mine`, 'GET', undefined, token)
  const permissions = permission.body.data?.permissions || []
  const allowed = ['info:consumer', 'info:admin']
    .some((code) => permissionGranted(permissions, code))
  if (permission.status >= 400 || permission.body.code !== 0 || !allowed) {
    throw new Error('当前统一账号没有信息资讯角色权限，请联系平台运营开通')
  }
  return permissions
}

/** 第一步：统一账号密码登录。开启二次验证时返回一次性挑战，不保存半成品会话。 */
export async function loginWithUnifiedAccount(
  username: string,
  password: string,
  remember = true,
): Promise<InfoLoginSuccess | InfoMfaChallenge> {
  const login = await apiRequest<{
    code: number
    message?: string
    data?: {
      accessToken?: string
      user?: UnifiedAccount
      mfaRequired?: boolean
      challengeToken?: string
    }
  }>(
    `${AUTH_BASE}/api/v1/sso/login-standalone`,
    'POST',
    { username, password, marketId: 1, remember },
  )
  if (login.status >= 400 || login.body.code !== 0) {
    throw new Error(login.body.message || '统一账号登录失败')
  }
  const data = login.body.data
  if (isInfoMfaChallenge(data)) return data
  if (!data?.accessToken || !data.user) {
    throw new Error('统一认证中心未返回有效登录结果')
  }
  const permissions = await resolveInfoPermissions(data.accessToken)
  persistInfoSession(data.accessToken, data.user, permissions)
  return { token: data.accessToken, user: data.user, permissions }
}

/** 第二步：用认证中心签发的一次性挑战完成动态码登录。 */
export async function completeInfoMfaLogin(
  challengeToken: string,
  code: string,
  remember = true,
): Promise<InfoLoginSuccess> {
  const result = await apiRequest<{
    code: number
    message?: string
    data?: { accessToken?: string; user?: UnifiedAccount }
  }>(
    `${AUTH_BASE}/api/v1/sso/login-standalone-mfa`,
    'POST',
    { challengeToken, code: code.trim(), marketId: 1, remember },
  )
  if (result.status >= 400 || result.body.code !== 0 || !result.body.data?.accessToken || !result.body.data.user) {
    throw new Error(result.body.message || '二次验证码校验失败，请重新登录')
  }
  const permissions = await resolveInfoPermissions(result.body.data.accessToken)
  persistInfoSession(result.body.data.accessToken, result.body.data.user, permissions)
  return { token: result.body.data.accessToken, user: result.body.data.user, permissions }
}

export function clearUnifiedInfoSession() {
  uni.removeStorageSync(accountStorageKey('info_sd_draft:supply'))
  uni.removeStorageSync(accountStorageKey('info_sd_draft:demand'))
  uni.removeStorageSync('info_sd_draft')
  // 清除跨页面临时草稿；浏览/搜索等持久缓存使用账号专属键。
  for (const key of ['info_ai_question', 'info_alert_quote', 'info_market_keyword', 'info_sd_repost', 'info_compare_ids']) uni.removeStorageSync(key)
  uni.removeStorageSync(TOKEN_KEY)
  uni.removeStorageSync(USER_KEY)
  uni.removeStorageSync(PERMISSION_KEY)
}

export async function logoutUnifiedInfo() {
  await logoutMobile(`${AUTH_BASE}/api/v1/auth/logout`, getInfoToken(), () => {
    clearUnifiedInfoSession()
    uni.reLaunch({ url: '/pages/login/index' })
  })
}

let redirecting = false
export function handleInfoUnauthorized() {
  if (redirecting) return
  redirecting = true
  clearUnifiedInfoSession()
  uni.reLaunch({ url: '/pages/login/index', complete: () => { redirecting = false } })
}
