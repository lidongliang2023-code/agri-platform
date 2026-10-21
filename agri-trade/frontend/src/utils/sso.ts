/**
 * 平台统一认证（SSO）客户端 —— 授权码 + PKCE。
 *
 * <p>依据架构文档 V2.0 第 5.1 / 5.2 节：子系统前端**不接触用户密码**，只做三件事 ——
 * 把浏览器送到认证中心、把回来的 code 换成令牌、把会话存下来。
 * 交易模块在 SSO 中心的 client_id 是 `trade`，注册在 core-platform 的
 * `agri.sso.clients` 白名单里（未注册会被直接 400 拒绝）。</p>
 *
 * <p>与主数据模块的 `web/src/utils/sso.ts` 是同一套流程，函数语义刻意保持一致，
 * 便于两端对照排查。</p>
 */
import axios from 'axios'
import { setSession, clearSession, type SessionUser } from './session'

/** 本应用在 SSO 中心的 client_id */
export const SSO_CLIENT_ID = 'trade'

/** 授权码回跳路径，必须落在注册表里的 redirect_uri 前缀之下 */
export const SSO_CALLBACK_PATH = '/sso/callback'

/** 登录页路径 */
export const LOGIN_PATH = '/login'

/**
 * 认证中心地址。本地按"一端一口"的既有约定映射（sso 在 :8090），生产走 sso 子域。
 * 不读环境变量：它必须与网关实际布局一致，布局变了就该改这里。
 */
function resolveSsoOrigin(): string {
  const { protocol, hostname } = window.location
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//${hostname}:8090`
  }
  return 'https://sso.agri-platform.com'
}

const VERIFIER_KEY = 'agri_trade_code_verifier'
const STATE_KEY = 'agri_trade_state'
const RETURN_KEY = 'agri_trade_return'
let redirectingToSso = false

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomBase64Url(byteLength = 32): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(byteLength)))
}

/** S256：sha256(code_verifier) 的 base64url */
async function codeChallengeOf(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64Url(new Uint8Array(digest))
}

/** 跳转到认证中心授权端点。verifier 与 state 是本次跳转的短期状态，放 sessionStorage。 */
export async function redirectToSso(returnTo?: string): Promise<void> {
  if (redirectingToSso) return
  redirectingToSso = true
  try {
    const verifier = randomBase64Url()
    const state = randomBase64Url(16)
    sessionStorage.setItem(VERIFIER_KEY, verifier)
    sessionStorage.setItem(STATE_KEY, state)
    if (returnTo) {
      sessionStorage.setItem(RETURN_KEY, returnTo)
    }
    const params = new URLSearchParams({
      client_id: SSO_CLIENT_ID,
      redirect_uri: `${window.location.origin}${SSO_CALLBACK_PATH}`,
      state,
      code_challenge: await codeChallengeOf(verifier),
      code_challenge_method: 'S256',
    })
    window.location.href = `${resolveSsoOrigin()}/authorize?${params.toString()}`
  } catch (error) {
    redirectingToSso = false
    throw error
  }
}

/** 回跳后要去的页面 */
export function takeReturnTo(): string | undefined {
  const value = sessionStorage.getItem(RETURN_KEY)
  sessionStorage.removeItem(RETURN_KEY)
  return value ?? undefined
}

/** 平台令牌响应体（core-platform LoginVO） */
export interface SsoLoginResult {
  accessToken: string
  /** 后端序列化成字符串，这里统一收敛成 number | string */
  expiresIn: number | string
  user: SessionUser
}

/**
 * 用授权码换令牌。
 *
 * <p>请求打到**本域**的 `/api/v1/sso/token`：同域就没有跨域与第三方 Cookie 的问题，
 * 刷新令牌也落在本域的 HttpOnly Cookie 上。网关必须把 `/api/v1/sso/` 与 `/api/v1/auth/`
 * 转发到 core-platform（而不是交易后端），少了这条转发，登录会在换票这一步断掉。</p>
 */
export async function exchangeCode(code: string, state: string | null): Promise<SsoLoginResult> {
  const expectedState = sessionStorage.getItem(STATE_KEY)
  if (!expectedState || expectedState !== state) {
    throw new Error('state 校验不通过：本次回跳可能被篡改，已中止换取令牌')
  }
  const verifier = sessionStorage.getItem(VERIFIER_KEY)
  if (!verifier) {
    throw new Error('缺少 PKCE code_verifier（换过标签页或清过会话存储），请重新登录')
  }
  const response = await axios.post(
    '/api/v1/sso/token',
    { code, clientId: SSO_CLIENT_ID, codeVerifier: verifier },
    { timeout: 20000, withCredentials: true },
  )
  const body = response.data
  // 平台侧统一用 code=0 表示成功（与交易业务接口的 200 不同），这里按平台口径判断
  if (!body || body.code !== 0) {
    throw new Error(body?.message ?? '换取令牌失败')
  }
  sessionStorage.removeItem(VERIFIER_KEY)
  sessionStorage.removeItem(STATE_KEY)
  const result = body.data as SsoLoginResult
  setSession(result.accessToken, result.user)
  return result
}

/**
 * 用 HttpOnly Cookie 里的刷新令牌静默续签。
 * 访问令牌只在内存，刷新页面即消失，所以每次启动都要先用 Cookie 换回来。
 */
export async function refreshAccessToken(): Promise<SsoLoginResult | null> {
  try {
    const response = await axios.post(
      '/api/v1/auth/refresh',
      {},
      {
        timeout: 20000,
        withCredentials: true,
        headers: { 'X-Skip-Auth-Redirect': '1' },
      },
    )
    const body = response.data
    if (!body || body.code !== 0 || !body.data) {
      return null
    }
    const result = body.data as SsoLoginResult
    setSession(result.accessToken, result.user)
    return result
  } catch {
    clearSession()
    return null
  }
}

/**
 * 认证中心登出地址（整页导航用：全局会话 Cookie 只存在于认证中心自己的域上）。
 *
 * <p>`logoutClientId` 决定认证中心销毁会话后的白名单回跳目标。卖家/买家中心退出后
 * 统一回官网门户，而不是回交易根路径再次进入会员中心。</p>
 */
export function ssoLogoutUrl(logoutClientId = SSO_CLIENT_ID): string {
  return `${resolveSsoOrigin()}/logout?client_id=${encodeURIComponent(logoutClientId)}`
}
