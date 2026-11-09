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

/**
 * 是否落在"允许匿名访问"的路径上。
 *
 * 只比前缀且要求边界（/trace 命中 /trace 与 /trace/x，不命中 /tracer），
 * 因为这一判断决定"要不要把访客送去登录"，判宽了等于全站免登录。
 */
export function isPublicPath(pathname, publicPaths = []) {
  return publicPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`))
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
  return (body.data || {}).permissions || []
}

export async function bootstrapUnifiedSso({ clientId, permission, landingPath = '/', publicPaths = [] }) {
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
    /*
     * 公开路径（消费者端只有 /trace）在此直接匿名挂载，不回跳登录。
     *
     * 溯源码的唯一意义是"拿到这串码的人都能验"。原先整个应用挂在 SSO 之后：
     * 消费者扫包装上的码 → 浏览器先跳统一认证中心 → 页面根本没挂载，
     * 后端那个免登录的 /api/public/trace/** 就成了没人能走到的死路。
     * 返回值刻意用对象而不是 null：null 表示"正在跳登录，别挂载"，
     * { anonymous: true } 表示"没有会话但要挂载"，调用方据此分流。
     */
    if (isPublicPath(window.location.pathname, publicPaths)) return { anonymous: true }
    const returnTo = window.location.pathname === '/login' ? landingPath : window.location.pathname + window.location.search
    await redirectToUnifiedLogin(clientId, returnTo)
    return null
  }

  let permissions
  let gateFailure = null
  try {
    permissions = await loadPermissions(login.accessToken)
    // 准入判定只认权限码：后端 SupplierController 就是 @OperatorOnly("s2b2c:supplier")，
    // 运营账号（MARKET_OPS）没有这个码时进得来也调不动接口，与其放进来看到一堆 403，
    // 不如在这里明确告知需要开通。
    if (!granted(permissions, permission)) {
      gateFailure = new Error(`当前统一账号没有 ${permission} 权限，请联系平台运营开通 S2B2C 角色权限。`)
      gateFailure.permissionDenied = true
    }
  } catch (error) {
    gateFailure = error
  }
  if (gateFailure) {
    /*
     * 带着刷新令牌访问公开路径时也放行渲染：读权限失败，或这个账号本来就没有
     * 商城消费者权限（例如监管账号顺手点开一支码），都不该被挡在核验页外面 ——
     * 链路内容来自免登录的 /api/public/trace/**，不依赖商城身份。
     * 此时按空权限挂载：会话仍是有效的（头部显示已登录），只是不复用商城能力。
     */
    if (!isPublicPath(window.location.pathname, publicPaths)) throw gateFailure
    permissions = []
  }
  setSession(login, permissions)
  return login
}

export function attachUnifiedAuth(instance, clientId, publicPaths = []) {
  instance.interceptors.request.use((config) => {
    const token = getUnifiedToken()
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  })
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error.response?.status === 401 && !isPublicPath(window.location.pathname, publicPaths)) {
        // 公开路径上这个跳转尤其致命：溯源页顺带拉一次商品下拉就会 401，
        // 于是"扫码即验"的人被整页送去登录，链路一次都看不到。
        clearSession()
        await redirectToUnifiedLogin(clientId, window.location.pathname + window.location.search)
      }
      return Promise.reject(error)
    },
  )
}

export function logoutUnified(clientId) {
  /*
   * 登出请求**不等返回**就整页跳转。
   *
   * 原来写的是 `await fetch(...)` 再 assign：只要这个请求慢一点、被网关卡住或响应始终
   * 不落地，await 就永远挂着，按钮表现成"点了没反应"（2026-11-03 在 8084 供应商端实测到
   * 这一现象：请求已发出，但两种存储都没清、URL 也没变）。
   * 清本地会话与跳转不依赖这个请求的成败，所以立即执行；请求用 keepalive 让它在页面
   * 卸载后仍能发完。真正销毁 SSO 全局会话的是下一跳认证中心的 /logout 端点，
   * 它同时会清掉该 client 的刷新 Cookie。
   */
  try {
    void fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include', keepalive: true })
  } catch {
    // 本地会话无论服务端是否可达都必须清理。
  }
  clearSession()
  window.location.assign(`${ssoOrigin()}/logout?client_id=${encodeURIComponent(clientId)}`)
}

/**
 * 统一登录 / 权限失败页。
 *
 * 「重新登录」不能再 `location.reload()`：SSO 全局会话仍然有效，刷新只会用同一个账号
 * 重新走一遍权限判定，页面看起来就是"点了没反应"。正确动作是先登出 SSO
 * （清理本地会话 + 跳认证中心登出端点），回到登录页换账号登录。
 */
export function showUnifiedAuthFailure(error, clientId) {
  const message = error instanceof Error ? error.message : '统一认证失败'
  document.getElementById('app').innerHTML = `
    <main class="s2b2c-unified-error">
      <section>
        <div class="s2b2c-unified-mark">丰</div>
        <h1>${error?.permissionDenied ? '暂无 S2B2C 访问权限' : '统一登录未完成'}</h1>
        <p>${message.replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[char])}</p>
        <button type="button" class="s2b2c-unified-relogin">重新登录</button>
      </section>
    </main>`
  document.querySelector('.s2b2c-unified-relogin')?.addEventListener('click', () => {
    void logoutUnified(clientId)
  })
}
