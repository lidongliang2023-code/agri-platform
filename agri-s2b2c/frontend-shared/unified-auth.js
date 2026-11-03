import { reactive } from 'vue'

const TOKEN_KEY = 's2b2c_unified_token'
const USER_KEY = 's2b2c_unified_user'
const STATE_KEY = 's2b2c_sso_state'
const VERIFIER_KEY = 's2b2c_sso_verifier'
const RETURN_KEY = 's2b2c_sso_return'
const CALLBACK_PATH = '/sso/callback'

const savedUser = localStorage.getItem(USER_KEY)

export const unifiedSession = reactive({
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

function granted(permissions, required) {
  if (permissions.includes('*') || permissions.includes(required)) return true
  const prefix = required.split(':')[0]
  return permissions.includes(`${prefix}:*`)
}

function setSession(data, permissions) {
  sessionStorage.setItem(TOKEN_KEY, data.accessToken)
  localStorage.setItem(USER_KEY, JSON.stringify(data.user))
  unifiedSession.user = data.user
  unifiedSession.permissions = permissions
  unifiedSession.ready = true
}

function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  unifiedSession.user = null
  unifiedSession.permissions = []
  unifiedSession.ready = false
}

export function getUnifiedToken() {
  return sessionStorage.getItem(TOKEN_KEY) || ''
}

export function getUnifiedUser() {
  return unifiedSession.user
}

export async function redirectToUnifiedLogin(clientId, returnTo) {
  if (redirecting) return
  redirecting = true
  try {
    const verifier = randomBase64Url()
    const state = randomBase64Url(16)
    sessionStorage.setItem(VERIFIER_KEY, verifier)
    sessionStorage.setItem(STATE_KEY, state)
    sessionStorage.setItem(RETURN_KEY, returnTo || window.location.pathname + window.location.search)
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

async function readEnvelope(response, fallback) {
  const body = await response.json().catch(() => null)
  if (!response.ok || !body || body.code !== 0 || !body.data) {
    throw new Error(body?.message || fallback)
  }
  return body.data
}

async function exchangeCode(clientId, code, state) {
  const expected = sessionStorage.getItem(STATE_KEY)
  const verifier = sessionStorage.getItem(VERIFIER_KEY)
  if (!expected || expected !== state) throw new Error('统一登录状态校验失败，请重新登录')
  if (!verifier) throw new Error('统一登录校验信息已失效，请重新登录')
  const response = await fetch('/api/v1/sso/token', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, clientId, codeVerifier: verifier }),
  })
  const data = await readEnvelope(response, '统一登录换取令牌失败')
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
    return await readEnvelope(response, '统一登录会话已失效')
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

export async function bootstrapUnifiedSso({ clientId, permission, landingPath = '/' }) {
  const callback = window.location.pathname.replace(/\/+$/, '') === CALLBACK_PATH
  let login = null
  if (callback) {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (!code) throw new Error('统一认证回跳缺少授权码')
    login = await exchangeCode(clientId, code, params.get('state'))

    /*
     * 换票成功后的收尾：**必须整页跳到目标路径，不能只改地址栏**。
     *
     * 这里原来用 `history.replaceState({}, '', returnTo)`，但它只改地址栏、
     * 不动任何路由状态；而本模块的调用方是「bootstrap 完成之后才 createApp +
     * use(router)」，Vue Router 初始化时会按当时的位置解析初始路由 ——
     * 两者存在竞态：router 稍后才同步时，会把地址栏又写回 /sso/callback?code=...
     * 表现就是"页面内容已经渲染出来了，URL 却还停在回调页"，刷新一下才正常
     * （偶发，取决于 router 初始化与 replaceState 的先后）。
     *
     * 改成整页跳转：先把令牌落地（下一跳的 refresh 分支会用它换回会话），
     * 再跳到目标路径，由新页面的非回调分支完成权限加载与挂载。
     * 代价是多一次页面加载，但回调本来就是一次跳转，换来的是确定性。
     */
    const returnTo = sessionStorage.getItem(RETURN_KEY) || landingPath
    sessionStorage.removeItem(RETURN_KEY)
    sessionStorage.setItem(TOKEN_KEY, login.accessToken)
    window.location.replace(returnTo)
    return null
  }
  login = await refreshSession()

  if (!login) {
    const returnTo = window.location.pathname === '/login' ? landingPath : window.location.pathname + window.location.search
    await redirectToUnifiedLogin(clientId, returnTo)
    return null
  }

  const permissions = await loadPermissions(login.accessToken)
  if (!granted(permissions, permission)) {
    const error = new Error(`当前统一账号没有 ${permission} 权限，请联系平台运营开通 S2B2C 角色权限。`)
    error.permissionDenied = true
    throw error
  }
  setSession(login, permissions)
  return login
}

export function attachUnifiedAuth(instance, clientId) {
  instance.interceptors.request.use((config) => {
    const token = getUnifiedToken()
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  })
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error.response?.status === 401) {
        clearSession()
        await redirectToUnifiedLogin(clientId, window.location.pathname + window.location.search)
      }
      return Promise.reject(error)
    },
  )
}

export async function logoutUnified(clientId) {
  try {
    await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' })
  } catch {
    // 本地会话无论服务端是否可达都必须清理。
  }
  clearSession()
  window.location.assign(`${ssoOrigin()}/logout?client_id=${encodeURIComponent(clientId)}`)
}

export function showUnifiedAuthFailure(error) {
  const message = error instanceof Error ? error.message : '统一认证失败'
  document.getElementById('app').innerHTML = `
    <main class="s2b2c-unified-error">
      <section>
        <div class="s2b2c-unified-mark">丰</div>
        <h1>${error?.permissionDenied ? '暂无 S2B2C 访问权限' : '统一登录未完成'}</h1>
        <p>${message.replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[char])}</p>
        <button type="button" onclick="location.reload()">重新登录</button>
      </section>
    </main>`
}
