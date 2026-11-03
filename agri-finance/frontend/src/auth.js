import { reactive } from 'vue'

const CLIENT_ID = 'finance'
const CALLBACK_PATH = '/sso/callback'
const TOKEN_KEY = 'finance_unified_token'
const USER_KEY = 'finance_unified_user'
const STATE_KEY = 'finance_sso_state'
const VERIFIER_KEY = 'finance_sso_verifier'
const RETURN_KEY = 'finance_sso_return'

const savedUser = localStorage.getItem(USER_KEY)

export const financeSession = reactive({
  user: savedUser ? JSON.parse(savedUser) : null,
  permissions: [],
  ready: false,
})

let redirecting = false

function ssoOrigin() {
  if (['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    return `${window.location.protocol}//${window.location.hostname}:8090`
  }
  return 'https://sso.agri-platform.com'
}

function base64Url(bytes) {
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomBase64Url(size = 32) {
  return base64Url(crypto.getRandomValues(new Uint8Array(size)))
}

async function codeChallenge(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64Url(new Uint8Array(digest))
}

export function hasFinancePermission(required) {
  const permissions = financeSession.permissions
  if (permissions.includes('*') || permissions.includes(required)) return true
  return permissions.includes(`${required.split(':')[0]}:*`)
}

function isAuthenticatedRoute(path) {
  return path.startsWith('/borrower') || path === '/'
}

export function financeHomeForPermissions() {
  if (hasFinancePermission('finance:borrower')) return '/borrower/home'
  if (hasFinancePermission('finance:fund')) return '/fund/workbench'
  if (hasFinancePermission('finance:admin')) return '/admin/workbench'
  return ''
}

export function canAccessFinancePath(path) {
  if (path === '/' || isAuthenticatedRoute(path)) return hasFinancePermission('finance:borrower')
  if (path.startsWith('/fund')) return hasFinancePermission('finance:fund')
  if (path.startsWith('/admin')) return hasFinancePermission('finance:admin')
  return true
}

function currentFinancePath() {
  const hashPath = window.location.hash.replace(/^#/, '')
  return hashPath || '/borrower/home'
}

function financeReturnTarget() {
  return `${window.location.pathname}${window.location.search}${window.location.hash || '#/borrower/home'}`
}

export function getFinanceToken() {
  return sessionStorage.getItem(TOKEN_KEY) || ''
}

function setSession(data, permissions) {
  sessionStorage.setItem(TOKEN_KEY, data.accessToken)
  localStorage.setItem(USER_KEY, JSON.stringify(data.user))
  financeSession.user = data.user
  financeSession.permissions = permissions
  financeSession.ready = true
}

function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  financeSession.user = null
  financeSession.permissions = []
  financeSession.ready = false
}

async function redirectToSso(returnTo) {
  if (redirecting) return
  redirecting = true
  try {
    const verifier = randomBase64Url()
    const state = randomBase64Url(16)
    sessionStorage.setItem(VERIFIER_KEY, verifier)
    sessionStorage.setItem(STATE_KEY, state)
    sessionStorage.setItem(RETURN_KEY, returnTo || financeReturnTarget())
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
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

async function parseEnvelope(response, fallback) {
  const body = await response.json().catch(() => null)
  if (!response.ok || !body || body.code !== 0 || !body.data) {
    throw new Error(body?.message || fallback)
  }
  return body.data
}

async function exchangeCode(code, state) {
  const expected = sessionStorage.getItem(STATE_KEY)
  const verifier = sessionStorage.getItem(VERIFIER_KEY)
  if (!expected || expected !== state) throw new Error('统一登录状态校验失败，请重新登录')
  if (!verifier) throw new Error('统一登录校验信息已失效，请重新登录')
  const response = await fetch('/api/v1/sso/token', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, clientId: CLIENT_ID, codeVerifier: verifier }),
  })
  const data = await parseEnvelope(response, '统一登录换取令牌失败')
  sessionStorage.removeItem(STATE_KEY)
  sessionStorage.removeItem(VERIFIER_KEY)
  return data
}

async function refreshSession() {
  try {
    const response = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    if (!response.ok) return null
    return await parseEnvelope(response, '统一登录会话已失效')
  } catch {
    return null
  }
}

async function loadPermissions(token) {
  const response = await fetch('/api/v1/platform/permissions/mine', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) throw new Error('无法读取平台权限，请稍后重试')
  const body = await response.json()
  if (body.code !== 0) throw new Error(body.message || '无法读取平台权限')
  return body.data?.permissions || []
}

export async function bootstrapFinanceSso() {
  const callback = window.location.pathname.replace(/\/+$/, '') === CALLBACK_PATH
  let login = null
  if (callback) {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (!code) throw new Error('统一认证回跳缺少授权码')
    login = await exchangeCode(code, params.get('state'))
    const returnTo = sessionStorage.getItem(RETURN_KEY) || '/finance/#/borrower/home'
    sessionStorage.removeItem(RETURN_KEY)
    window.history.replaceState({}, '', returnTo)
  } else {
    login = await refreshSession()
  }

  if (!login) {
    await redirectToSso(currentFinancePath() === '/borrower/home' ? '/finance/#/borrower/home' : financeReturnTarget())
    return null
  }
  const permissions = await loadPermissions(login.accessToken)
  setSession(login, permissions)
  if (!permissions.includes('*')
      && !permissions.some((code) => ['finance:borrower', 'finance:fund', 'finance:admin', 'finance:*'].includes(code))) {
    const error = new Error('当前统一账号没有供应链金融角色权限，请联系平台运营开通融资方、资金方或运营权限。')
    error.permissionDenied = true
    throw error
  }
  return login
}

export function installFinanceAuthInterceptor(axios) {
  axios.interceptors.request.use((config) => {
    const token = getFinanceToken()
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  })
  axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error.response?.status === 401) {
        clearSession()
        await redirectToSso(financeReturnTarget())
      }
      // 403/400 也要把后端写的原因带出来，否则页面只会显示
      // "Request failed with status code 403"，用户不知道该找谁开权限
      const detail = error.response?.data?.message
      if (detail) {
        error.message = detail
      }
      return Promise.reject(error)
    },
  )
}

export async function logoutFinance() {
  try {
    await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' })
  } catch {
    // 本地会话必须清理，即使服务端登出接口暂时不可达。
  }
  clearSession()
  window.location.assign(`${ssoOrigin()}/logout?client_id=${CLIENT_ID}`)
}

export function showFinanceAuthFailure(error) {
  const message = error instanceof Error ? error.message : '统一认证失败'
  const safeMessage = message.replace(/[<>&"']/g, (char) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;',
  })[char])
  document.getElementById('app').innerHTML = `
    <main style="display:grid;min-height:100vh;place-items:center;padding:24px;background:#f2f6f3;color:#14251b">
      <section style="width:420px;max-width:100%;padding:32px;border:1px solid #dce7df;border-radius:16px;background:#fff;text-align:center">
        <div style="display:grid;width:56px;height:56px;margin:0 auto 16px;place-items:center;border-radius:15px;background:#12764a;color:#fff;font-size:24px;font-weight:800">丰</div>
        <h1 style="margin:0;font-size:21px">${error?.permissionDenied ? '暂无供应链金融访问权限' : '统一登录未完成'}</h1>
        <p style="margin:12px 0 22px;color:#6b7c72;font-size:14px;line-height:1.7">${safeMessage}</p>
        <button style="height:40px;padding:0 22px;border:0;border-radius:8px;background:#12764a;color:#fff;cursor:pointer" onclick="location.reload()">重新登录</button>
      </section>
    </main>`
}
