import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import axios, { type AxiosError, type AxiosInstance } from 'axios'

export interface UnifiedUser {
  id: number
  username: string
  nickname?: string
  roles: string[]
}

interface LoginResult {
  accessToken: string
  expiresIn: number | string
  user: UnifiedUser
}

interface SsoGateProps {
  clientId: string
  landingPath: string
  requiredPermissions: string[]
  children: ReactNode
}

interface SsoState {
  user: UnifiedUser
  permissions: string[]
}

interface PermissionResult {
  code: number
  message?: string
  data?: { permissions?: string[] }
}

const SessionContext = createContext<SsoState | null>(null)
const CALLBACK_PATH = '/sso/callback'
const RETURN_KEY = 'agri_iot_sso_return'
const VERIFIER_KEY = 'agri_iot_code_verifier'
const STATE_KEY = 'agri_iot_sso_state'
let accessToken: string | null = null
let redirecting = false

function ssoOrigin() {
  if (['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    return `${window.location.protocol}//${window.location.hostname}:8090`
  }
  return 'https://sso.agri-platform.com'
}

function base64Url(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomBase64Url(size = 32) {
  return base64Url(crypto.getRandomValues(new Uint8Array(size)))
}

async function codeChallenge(verifier: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64Url(new Uint8Array(digest))
}

export function getAccessToken() {
  return accessToken
}

function clearSession() {
  accessToken = null
}

export async function redirectToSso(clientId: string, returnTo?: string) {
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
    window.location.href = `${ssoOrigin()}/authorize?${params.toString()}`
  } catch (error) {
    redirecting = false
    throw error
  }
}

async function exchangeCode(clientId: string, code: string, state: string | null): Promise<LoginResult> {
  const expected = sessionStorage.getItem(STATE_KEY)
  const verifier = sessionStorage.getItem(VERIFIER_KEY)
  if (!expected || expected !== state) throw new Error('统一登录状态校验失败，请重新登录')
  if (!verifier) throw new Error('登录校验信息已失效，请重新登录')
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

async function restoreSession(): Promise<LoginResult | null> {
  try {
    const response = await axios.post(
      '/api/v1/auth/refresh',
      {},
      { timeout: 20000, withCredentials: true },
    )
    if (response.data?.code !== 0 || !response.data?.data) return null
    accessToken = response.data.data.accessToken
    return response.data.data as LoginResult
  } catch {
    clearSession()
    return null
  }
}

async function loadPermissions(): Promise<string[]> {
  if (!accessToken) return []
  try {
    const response = await axios.get<PermissionResult>('/api/v1/platform/permissions/mine', {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 15000,
    })
    return response.data?.data?.permissions ?? []
  } catch {
    return []
  }
}

function granted(permissions: string[], required: string) {
  if (permissions.includes('*') || permissions.includes(required)) return true
  const prefix = required.split(':')[0]
  return permissions.includes(`${prefix}:*`)
}

export function useUnifiedUser() {
  const session = useContext(SessionContext)
  if (!session) throw new Error('统一用户上下文尚未初始化')
  return session
}

export async function logoutUnified(clientId: string) {
  try {
    await axios.post('/api/v1/auth/logout', {}, { timeout: 10000, withCredentials: true })
  } catch {
    // 即使本地令牌已经失效，也继续清理 SSO 全局会话。
  }
  clearSession()
  window.location.href = `${ssoOrigin()}/logout?client_id=${encodeURIComponent(clientId)}`
}

export function attachUnifiedAuth(client: AxiosInstance, clientId: string) {
  client.interceptors.request.use((config) => {
    if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
    return config
  })
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      if (error.response?.status === 401) {
        clearSession()
        await redirectToSso(clientId, `${window.location.pathname}${window.location.search}`)
      }
      return Promise.reject(error)
    },
  )
}

function Failure({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f4f7f5', padding: 24 }}>
      <div style={{ width: 420, maxWidth: '100%', padding: 28, border: '1px solid #e3eae5', borderRadius: 14, background: '#fff', textAlign: 'center' }}>
        <div style={{ width: 54, height: 54, margin: '0 auto 14px', display: 'grid', placeItems: 'center', borderRadius: 14, background: '#eaf7ef', color: '#12764a', fontSize: 24, fontWeight: 800 }}>丰</div>
        <h2 style={{ margin: 0, color: '#0b1a12', fontSize: 20 }}>{title}</h2>
        <p style={{ margin: '10px 0 20px', color: '#718277', fontSize: 13, lineHeight: 1.7 }}>{message}</p>
        {onRetry && <button type="button" onClick={onRetry} style={{ height: 40, padding: '0 20px', border: 0, borderRadius: 9, background: '#12764a', color: '#fff', cursor: 'pointer' }}>重新登录</button>}
      </div>
    </div>
  )
}

export default function UnifiedSsoGate({
  clientId,
  landingPath,
  requiredPermissions,
  children,
}: SsoGateProps) {
  const [session, setSession] = useState<SsoState | null>(null)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)
  const [denied, setDenied] = useState(false)

  const retry = () => {
    setChecking(true)
    setError('')
    setDenied(false)
    void redirectToSso(clientId, landingPath)
  }

  useEffect(() => {
    let cancelled = false
    const boot = async () => {
      try {
        let login: LoginResult | null = null
        if (window.location.pathname.replace(/\/+$/, '') === CALLBACK_PATH) {
          const params = new URLSearchParams(window.location.search)
          const code = params.get('code')
          if (!code) throw new Error('统一认证回跳缺少授权码')
          login = await exchangeCode(clientId, code, params.get('state'))
          const returnTo = sessionStorage.getItem(RETURN_KEY)
          sessionStorage.removeItem(RETURN_KEY)
          window.history.replaceState({}, '', returnTo || landingPath)
        } else {
          login = await restoreSession()
        }
        if (!login) {
          await redirectToSso(clientId, `${window.location.pathname}${window.location.search}`)
          return
        }
        const permissions = await loadPermissions()
        const allowed = requiredPermissions.every((permission) => granted(permissions, permission))
        if (cancelled) return
        if (!allowed) {
          setDenied(true)
          clearSession()
          return
        }
        setSession({ user: login.user, permissions })
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : '统一认证失败')
      } finally {
        if (!cancelled) setChecking(false)
      }
    }
    void boot()
    return () => { cancelled = true }
  }, [clientId, landingPath, requiredPermissions])

  if (error) return <Failure title="统一登录未完成" message={error} onRetry={retry} />
  if (denied) return <Failure title="暂无物联网访问权限" message="当前统一账号没有开通物联网访问权限，请联系平台运营为该账号分配 iot 权限。" onRetry={retry} />
  if (checking || !session) {
    return <Failure title="正在连接统一认证中心" message="正在核验统一账号与物联网访问权限，请稍候…" />
  }
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}
