/**
 * 生产管理移动端 H5 旧授权码 + PKCE 流程兼容工具。
 *
 * 新登录与小程序 / App 共用页内表单，调用统一认证中心 standalone 接口。
 * 保留本工具用于升级前已发起的授权回调：校验 state 与 PKCE、换取统一令牌。
 * 登录页不再主动发起浏览器授权跳转。
 */
import { persistLogin, type MobileUser } from './auth'

export const SSO_CLIENT_ID = 'prod'
const CALLBACK_SEGMENT = 'sso/callback'
const VERIFIER_KEY = 'agri_prod_mobile_code_verifier'
const STATE_KEY = 'agri_prod_mobile_state'

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof sessionStorage !== 'undefined'
}

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomBase64Url(byteLength = 32): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(byteLength)))
}

async function codeChallengeOf(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64Url(new Uint8Array(digest))
}

function mobileBasePath(): string {
  if (!isBrowser()) return '/'
  const pathname = window.location.pathname
  const marker = '/prod-mobile/'
  const markerIndex = pathname.indexOf(marker)
  if (markerIndex >= 0) return pathname.slice(0, markerIndex + marker.length)
  return '/'
}

function callbackPath(): string {
  return `${mobileBasePath()}${CALLBACK_SEGMENT}`
}

function ssoOrigin(): string {
  if (!isBrowser()) return ''
  const { protocol, hostname } = window.location
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1'
  const isPrivateIp = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname)
  if (isLocalHost || isPrivateIp) return `${protocol}//${hostname}:8090`
  return 'https://sso.agri-platform.com'
}

export function isH5SsoCallback(): boolean {
  if (!isBrowser()) return false
  return window.location.pathname.endsWith(`/${CALLBACK_SEGMENT}`)
    || (window.location.pathname.includes('/prod-mobile/') && window.location.pathname.endsWith(CALLBACK_SEGMENT))
}

export async function redirectToSso(): Promise<void> {
  if (!isBrowser()) throw new Error('当前端不支持浏览器统一登录，请使用原生登录方式')
  const verifier = randomBase64Url()
  const state = randomBase64Url(16)
  sessionStorage.setItem(VERIFIER_KEY, verifier)
  sessionStorage.setItem(STATE_KEY, state)
  const params = new URLSearchParams({
    client_id: SSO_CLIENT_ID,
    redirect_uri: `${window.location.origin}${callbackPath()}`,
    state,
    code_challenge: await codeChallengeOf(verifier),
    code_challenge_method: 'S256',
  })
  window.location.assign(`${ssoOrigin()}/authorize?${params.toString()}`)
}

export async function exchangeSsoCallback(): Promise<MobileUser> {
  if (!isBrowser()) throw new Error('当前端不支持统一登录回跳')
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const state = params.get('state')
  if (!code) throw new Error('统一登录回跳缺少授权码，请重新登录')
  const expectedState = sessionStorage.getItem(STATE_KEY)
  if (!expectedState || expectedState !== state) {
    throw new Error('统一登录状态校验失败，请重新登录')
  }
  const verifier = sessionStorage.getItem(VERIFIER_KEY)
  if (!verifier) throw new Error('统一登录校验信息已失效，请重新登录')

  const response = await fetch('/api/v1/sso/token', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, clientId: SSO_CLIENT_ID, codeVerifier: verifier }),
  })
  const body = await response.json().catch(() => null)
  if (!response.ok || body?.code !== 0 || !body?.data) {
    throw new Error(body?.message || '统一登录换取令牌失败，请重新登录')
  }
  sessionStorage.removeItem(STATE_KEY)
  sessionStorage.removeItem(VERIFIER_KEY)
  const user = persistLogin(body.data, body.data?.user?.username || '')
  return user
}
