/**
 * 平台统一认证（SSO）客户端 —— 授权码 + PKCE。
 *
 * <p>依据 V2.0 第 5.1 / 5.2 节：子系统前端**不接触用户密码**，只负责三件事：
 * 把浏览器送到认证中心、把回来的 code 换成令牌、把会话存下来。
 * 主数据在 SSO 中心的 client_id 是 `mdm`，已注册在 core-platform 的
 * `agri.sso.clients` 注册表里（redirect_uri 前缀白名单）。</p>
 *
 * <p>与生产管理模块的 `api/sso.ts` 是同一套流程，差别只有 client_id 与调用方，
 * 因此这里刻意保持同名函数语义，便于两处对照。</p>
 */
import axios from 'axios'

/** 本应用在 SSO 中心的 client_id（与后端 SsoProperties 注册表对应） */
export const SSO_CLIENT_ID = 'mdm'

/** 授权码回跳路径。必须落在注册表里的 redirect_uri 前缀 `http://localhost:8080/` 之下。 */
export const SSO_CALLBACK_PATH = '/sso/callback'

/** 登录页路径 */
export const LOGIN_PATH = '/login'

/**
 * 认证中心地址。
 *
 * 本地按"一端一口"的既定约定映射（sso 在 :8090）；生产走 sso 子域。
 * 不读环境变量：它必须与网关的实际布局一致，布局变了就该改这里，
 * 而不是指望某台机器的 .env 恰好对。
 */
function resolveSsoOrigin(): string {
  const { protocol, hostname } = window.location
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//${hostname}:8090`
  }
  return 'https://sso.agri-platform.com'
}

const VERIFIER_KEY = 'agri_mdm_code_verifier'
const STATE_KEY = 'agri_mdm_state'
const RETURN_KEY = 'agri_mdm_return'
/**
 * 上一次"自动跳认证中心"的时间戳。
 *
 * <p>用途是**防无限打转**：如果换票没成功（state 不匹配、Cookie 被禁、回调页被别处
 * 打断等），用户会回到登录页，而登录页挂载后又自动跳认证中心 —— 就形成
 * 「认证中心 ↔ 回调页」的死循环，用户只看到页面在闪，没有任何提示。</p>
 *
 * <p>所以自动跳转加冷却：冷却期内再次自动跳直接报错，把控制权交回用户（页面上有
 * 手动按钮）。手动点击不受冷却限制。</p>
 */
const NAV_AT_KEY = 'agri_mdm_sso_nav_at'
const NAV_COOLDOWN_MS = 8000

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
async function codeChallengeOf(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64Url(new Uint8Array(digest))
}

/**
 * 跳转到认证中心授权端点。
 *
 * <p>verifier 与 state 放 sessionStorage：它们是本次跳转的**短期状态**，不是凭证，
 * 也不该跨标签页长期留存（放 localStorage 反而会让它们一直躺在磁盘上）。</p>
 */
export async function redirectToSso(returnTo?: string, options?: { manual?: boolean }): Promise<void> {
  const now = Date.now()
  let lastNavAt = 0
  try {
    lastNavAt = Number(sessionStorage.getItem(NAV_AT_KEY) ?? 0)
  } catch {
    // 会话存储不可用时不做冷却判断，交给后续流程兜底
  }
  if (!options?.manual && lastNavAt > 0 && now - lastNavAt < NAV_COOLDOWN_MS) {
    throw new Error(
      '刚完成一次认证跳转但仍未登录，可能是浏览器禁用了 Cookie 或登录态未能建立。请点上方按钮重试。',
    )
  }
  try {
    sessionStorage.setItem(NAV_AT_KEY, String(now))
  } catch {
    // 同上
  }

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
}

/** 回跳后要去的页面（没记过就回 undefined，由调用方决定默认页） */
export function takeReturnTo(): string | undefined {
  const value = sessionStorage.getItem(RETURN_KEY)
  sessionStorage.removeItem(RETURN_KEY)
  return value ?? undefined
}

/** 平台令牌响应体（core-platform LoginVO） */
export interface SsoLoginResult {
  accessToken: string
  /** 有效期（秒）。后端序列化成字符串，这里统一收敛成 number。 */
  expiresIn: number | string
  user: {
    id: string
    username: string
    nickname?: string
    roles?: string[]
  }
}

/**
 * 用授权码换令牌。
 *
 * <p>请求打到**本域**的 `/api/v1/sso/token`：同域就没有跨域与第三方 Cookie 的问题，
 * 刷新令牌也落在本域的 HttpOnly Cookie 上（跨域去写别人的域本来也做不到）。
 * 网关已把 `/api/v1/sso/` 与 `/api/v1/auth/` 转发到 core-platform，
 * 而不是主数据后端 —— 少了这条转发，登录会在换票这一步直接断掉。</p>
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
  // 平台侧统一响应体用 code=0 表示成功（与主数据业务接口的 200 不同），这里按平台口径判断
  if (!body || body.code !== 0) {
    throw new Error(body?.message ?? '换取令牌失败')
  }
  sessionStorage.removeItem(VERIFIER_KEY)
  sessionStorage.removeItem(STATE_KEY)
  // 换票成功说明这一轮认证闭环了，清掉冷却标记，避免影响下一次正常登录
  sessionStorage.removeItem(NAV_AT_KEY)
  return body.data as SsoLoginResult
}

/**
 * 用 HttpOnly Cookie 里的刷新令牌静默续签。
 *
 * <p>访问令牌只在内存、刷新页面即消失，所以每次启动都要先用 Cookie 换回来 ——
 * 这也是"刷新页面不掉登录"的唯一依据。没有 Cookie 时后端返回业务失败，属正常情况，
 * 调用方据此判定未登录。</p>
 */
export async function refreshAccessToken(): Promise<SsoLoginResult | null> {
  try {
    const response = await axios.post('/api/v1/auth/refresh', {}, {
      timeout: 20000,
      withCredentials: true,
    })
    const body = response.data
    if (!body || body.code !== 0 || !body.data) {
      return null
    }
    return body.data as SsoLoginResult
  } catch {
    // 没有可用的刷新令牌（或后端不可达）：当作"未登录"处理，不抛给调用方
    return null
  }
}

/**
 * 吊销本域的刷新令牌并清除 HttpOnly Cookie。
 *
 * <p>SSO 全局会话位于认证中心域，本函数清不到；反过来，只跳认证中心登出也清不掉
 * 主数据域上的刷新 Cookie。因此完整退出必须两件事都做。</p>
 */
export async function revokePlatformSession(): Promise<boolean> {
  try {
    const response = await axios.post('/api/v1/auth/logout', {}, {
      timeout: 10000,
      withCredentials: true,
    })
    return response.data?.code === 0
  } catch {
    // 网络异常时仍继续清理本地态和 SSO 会话；强制退出标记会阻止本域 Cookie 自动续签。
    return false
  }
}

/**
 * 认证中心登出地址（供浏览器**整页导航**使用）。
 *
 * <p>为什么不能用 XHR：SSO 会话 Cookie 只存在于认证中心自己的域上，
 * 子系统发起的跨域请求带不上它。销毁全局会话必须发生在那个域上，
 * 所以登出是"跳过去、它清理完再跳回来"。</p>
 */
export function ssoLogoutUrl(): string {
  return `${resolveSsoOrigin()}/logout?client_id=${encodeURIComponent(SSO_CLIENT_ID)}`
}
