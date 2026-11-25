import { logoutBrowser } from '../../../packages/agri-shared/src/auth/logout'
import { reactive } from 'vue'
import axios, { type AxiosError, type AxiosInstance } from 'axios'

export interface UnifiedUser {
  id: number
  username: string
  nickname?: string
  roles: string[]
}

export interface LoginResult {
  accessToken: string
  expiresIn: number | string
  user: UnifiedUser
}

interface PermissionResult {
  code: number
  message?: string
  data?: { permissions?: string[] }
}

export const CALLBACK_PATH = '/sso/callback'
export const RETURN_KEY = 'agri_uc_ops_sso_return'
const VERIFIER_KEY = 'agri_uc_ops_code_verifier'
const STATE_KEY = 'agri_uc_ops_sso_state'
let accessToken: string | null = null
let redirecting = false

export const ucSession = reactive<{ user: UnifiedUser | null; permissions: string[] }>({
  user: null,
  permissions: [],
})

export function routeTarget(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

function ssoOrigin(): string {
  if (['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    return `${window.location.protocol}//${window.location.hostname}:8090`
  }
  return 'https://sso.agri-platform.com'
}

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomBase64Url(size = 32): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(size)))
}

async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64Url(new Uint8Array(digest))
}

export function granted(permissions: string[], required: string): boolean {
  if (permissions.includes('*') || permissions.includes(required)) return true
  return permissions.includes(`${required.split(':')[0]}:*`)
}

export function clearSession(): void {
  accessToken = null
  ucSession.user = null
  ucSession.permissions = []
}

export function getAccessToken(): string | null {
  return accessToken
}

export async function redirectToSso(clientId: string, returnTo?: string): Promise<void> {
  if (redirecting) return
  redirecting = true
  try {
    const verifier = randomBase64Url()
    const state = randomBase64Url(16)
    sessionStorage.setItem(VERIFIER_KEY, verifier)
    sessionStorage.setItem(STATE_KEY, state)
    if (returnTo) sessionStorage.setItem(RETURN_KEY, returnTo)
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${window.location.origin}${CALLBACK_PATH}`,
      state,
      code_challenge: await codeChallenge(verifier),
      code_challenge_method: 'S256',
    })
    window.location.assign(`${ssoOrigin()}/authorize?${params.toString()}`)
  } catch (error) {
    redirecting = false
    throw error
  }
}

export async function exchangeCode(clientId: string, code: string, state: string | null): Promise<LoginResult> {
  const expected = sessionStorage.getItem(STATE_KEY)
  const verifier = sessionStorage.getItem(VERIFIER_KEY)
  if (!expected || expected !== state) throw new Error('统一登录状态校验失败，请重新登录')
  if (!verifier) throw new Error('统一登录校验信息已失效，请重新登录')
  const response = await axios.post(
    '/api/v1/sso/token',
    { code, clientId, codeVerifier: verifier },
    { timeout: 20000, withCredentials: true },
  )
  if (response.data?.code !== 0 || !response.data?.data) {
    throw new Error(response.data?.message || '统一登录换取令牌失败')
  }
  sessionStorage.removeItem(STATE_KEY)
  sessionStorage.removeItem(VERIFIER_KEY)
  accessToken = response.data.data.accessToken
  return response.data.data as LoginResult
}

export async function restoreSession(clientId: string): Promise<LoginResult | null> {
  try {
    const response = await axios.post('/api/v1/auth/refresh', {}, {
      headers: { 'X-Sso-Client': clientId },
      timeout: 20000,
      withCredentials: true,
    })
    if (response.data?.code !== 0 || !response.data?.data) return null
    accessToken = response.data.data.accessToken
    return response.data.data as LoginResult
  } catch {
    clearSession()
    return null
  }
}

export async function loadPermissions(): Promise<string[]> {
  if (!accessToken) throw new Error('登录会话已失效，请重新登录')
  const response = await axios.get<PermissionResult>('/api/v1/platform/permissions/mine', {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 15000,
  }).catch((cause: unknown) => {
    if (axios.isAxiosError(cause)) {
      throw new Error((cause.response?.data as { message?: string } | undefined)?.message || `权限服务读取失败${cause.response ? `（HTTP ${cause.response.status}）` : '，请检查服务连接'}`)
    }
    throw cause
  })
  if (response.data?.code !== 0) {
    throw new Error(response.data?.message || '权限服务返回异常，请重试')
  }
  const permissions = response.data.data?.permissions
  if (!Array.isArray(permissions) || !permissions.every((value) => typeof value === 'string')) {
    throw new Error('权限服务返回格式异常，请联系平台管理员')
  }
  return permissions
}

export function attachUnifiedAuth(client: AxiosInstance, clientId: string): void {
  client.interceptors.request.use((config) => {
    if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
    return config
  })
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      if (error.response?.status === 401) {
        clearSession()
        await redirectToSso(clientId, routeTarget())
      }
      if (error.response?.status === 403) {
        const body = error.response.data as { message?: string } | undefined
        error.message = body?.message || '当前账号无权执行该操作'
      }
      return Promise.reject(error)
    },
  )
}

export async function logoutUnified(clientId: string): Promise<void> {
  await logoutBrowser({ token: accessToken, clientId, ssoOrigin: ssoOrigin(), clear: clearSession })
}
