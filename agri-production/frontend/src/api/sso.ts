/**
 * SSO 客户端（授权码 + PKCE）—— 子系统侧只做三件事：把浏览器送过去、把 code 换回来、把会话存下来。
 *
 * <p>依据 V2.0 第 5.2 节：子系统前端**不接触用户密码**，只携带 client_id / redirect_uri /
 * state / PKCE 参数跳转；换票后拿到的是平台令牌（访问令牌进内存、刷新令牌进 HttpOnly Cookie）。</p>
 */
import axios from 'axios'
import type { LoginResult } from './auth'

const SSO_PATH = '/api/v1/sso'

/**
 * SSO 中心地址。
 *
 * 本地按"一端一口"的既定约定映射（sso 在 :8090）；生产走 sso 子域。
 * 不用环境变量是因为它需要与网关的实际布局一致 —— 布局变了就该改这里，而不是指望某台机器的 .env。
 */
function resolveSsoOrigin(): string {
  const { protocol, hostname } = window.location
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//${hostname}:8090`
  }
  return 'https://sso.agri-platform.com'
}

const VERIFIER_KEY = 'agri_sso_code_verifier'
const STATE_KEY = 'agri_sso_state'
const RETURN_KEY = 'agri_sso_return'

/** base64url（PKCE 要求 URL 安全且无填充） */
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
export async function codeChallengeOf(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64Url(new Uint8Array(digest))
}

/**
 * 跳转到 SSO 授权端点。
 *
 * <p>verifier 与 state 放 sessionStorage：它们是本次跳转的短期状态，不是凭证，
 * 也不该跨标签页或跨浏览器复用（放 localStorage 反而会让它们长期留存）。</p>
 */
export async function redirectToSso(clientId: string, returnTo?: string): Promise<void> {
  const verifier = randomBase64Url()
  const state = randomBase64Url(16)
  sessionStorage.setItem(VERIFIER_KEY, verifier)
  sessionStorage.setItem(STATE_KEY, state)
  if (returnTo) {
    sessionStorage.setItem(RETURN_KEY, returnTo)
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${window.location.origin}/sso/callback`,
    state,
    code_challenge: await codeChallengeOf(verifier),
    code_challenge_method: 'S256',
  })
  window.location.href = `${resolveSsoOrigin()}/authorize?${params.toString()}`
}

const ssoRequest = axios.create({ baseURL: SSO_PATH, timeout: 20000, withCredentials: true })

/**
 * 用授权码换令牌。
 *
 * <p>请求打到**本域**的 `/api/v1/sso/token`：同域就没有 CORS 与第三方 Cookie 的问题，
 * 刷新令牌也是落在本子域的 HttpOnly Cookie 上（跨域去写别的域的 Cookie 本来也做不到）。</p>
 */
export async function exchangeCode(clientId: string, code: string, state: string | null): Promise<LoginResult> {
  const expectedState = sessionStorage.getItem(STATE_KEY)
  if (!expectedState || expectedState !== state) {
    throw new Error('state 校验不通过：本次回跳可能被篡改，已中止换取令牌')
  }
  const verifier = sessionStorage.getItem(VERIFIER_KEY)
  if (!verifier) {
    throw new Error('缺少 PKCE code_verifier（换过标签页或清过会话存储），请重新登录')
  }
  const response = await ssoRequest.post('/token', { code, clientId, codeVerifier: verifier })
  const body = response.data
  if (!body || body.code !== 0) {
    throw new Error(body?.message ?? '换取令牌失败')
  }
  sessionStorage.removeItem(VERIFIER_KEY)
  sessionStorage.removeItem(STATE_KEY)
  return body.data as LoginResult
}
