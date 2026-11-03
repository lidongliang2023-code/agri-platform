import { useEffect, useState } from 'react'

const SITE_NAME = '丰链云'

/**
 * 设置当前页面的标题与描述。
 *
 * <p>门户是 SPA，切页面不会重新加载 HTML，如果不手动改，所有页面的浏览器标签页都写着
 * 「丰链云 · 农业产业互联网平台」，用户开几个标签就分不清哪个是哪个，分享出去的卡片也一样。</p>
 *
 * <p>注意：hash 路由（`#/info/news/1`）对搜索引擎不友好 —— 爬虫不会把 # 之后的内容当作
 * 独立页面索引。这里做的是「用户体验 + 社交分享」层面的元信息，不等于 SEO 收录；
 * 真要收录得改成 history 路由并做预渲染。</p>
 */
export function applyPageMeta(meta: { title: string; description?: string }): void {
  const title = meta.title.includes(SITE_NAME) ? meta.title : `${meta.title} · ${SITE_NAME}`
  document.title = title

  const upsert = (key: string, attr: 'name' | 'property', content: string): void => {
    const selector = `meta[${attr}="${key}"]`
    let tag = document.head.querySelector<HTMLMetaElement>(selector)
    if (!tag) {
      tag = document.createElement('meta')
      tag.setAttribute(attr, key)
      document.head.appendChild(tag)
    }
    tag.setAttribute('content', content)
  }

  upsert('og:title', 'property', title)
  upsert('og:type', 'property', 'website')
  upsert('og:site_name', 'property', SITE_NAME)
  if (meta.description) {
    upsert('description', 'name', meta.description)
    upsert('og:description', 'property', meta.description)
  }
}

/** 页面元信息的 hook 版本：依赖变化时自动重设。 */
export function usePageMeta(title: string, description?: string): void {
  useEffect(() => {
    applyPageMeta({ title, description })
  }, [title, description])
}

/**
 * 注入 JSON-LD 结构化数据。
 *
 * <p>这是 hash 路由下**少数真正有效的 SEO 手段**：搜索引擎能执行页面 JS 并读到运行时注入的
 * JSON-LD，从而在结果里展示富摘要（标题、时间、发布方）。sitemap 那种静态声明在
 * `#/xxx` 形式上反而无效 —— 带 # 的 URL 会被规范化掉。</p>
 *
 * <p>用固定 id 覆盖而不是追加：SPA 切页面不会卸载 head，追加会让每个页面的数据越堆越多。</p>
 */
export function applyStructuredData(id: string, data: Record<string, unknown>): void {
  let tag = document.getElementById(id) as HTMLScriptElement | null
  if (!tag) {
    tag = document.createElement('script')
    tag.id = id
    tag.type = 'application/ld+json'
    document.head.appendChild(tag)
  }
  tag.textContent = JSON.stringify(data)
}

export function useStructuredData(id: string, data: Record<string, unknown> | null): void {
  useEffect(() => {
    if (data) applyStructuredData(id, data)
  }, [id, data])
}

/** 门户使用 hash 路由：静态托管在 /portal/ 下也不需要额外的前端回退规则。 */
export function parseHash(): { path: string; query: URLSearchParams } {
  const raw = window.location.hash.replace(/^#/, '') || '/'
  const [path, search = ''] = raw.split('?')
  return { path: path || '/', query: new URLSearchParams(search) }
}

export function useHashRoute(): { path: string; query: URLSearchParams } {
  const [route, setRoute] = useState(parseHash)
  useEffect(() => {
    const onChange = (): void => setRoute(parseHash())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export function go(path: string): void {
  window.location.hash = path.startsWith('#') ? path.slice(1) : path
}

const protocol = window.location.protocol
const hostname = window.location.hostname

/** 交易撮合前端（本地固定 8086）。 */
export function tradeUrl(path = '/'): string {
  return `${protocol}//${hostname}:8086${path}`
}

/**
 * 供应链金融前端。
 *
 * <p>“我要融资”必须进入融资端，不再复用交易撮合会员中心。金融端会在启动时检查
 * 统一登录态；未登录时携带当前 hash 路由进入 SSO，登录成功后回到同一融资页面。</p>
 */
export function financeUrl(hashPath = '/borrower/home'): string {
  const configured = String(import.meta.env.VITE_FINANCE_ORIGIN || '').replace(/\/+$/, '')
  const base = configured || `${protocol}//${hostname}:8081/finance`
  const path = hashPath.startsWith('/') ? hashPath : `/${hashPath}`
  return `${base}/#${path}`
}

/** 政府监管用户端（本地固定 8108）。 */
export function governmentUrl(path = '/'): string {
  return `${protocol}//${hostname}:8108${path}`
}

/** 公开交易大厅（无需登录即可浏览）。 */
export function hallUrl(): string {
  return tradeUrl('/hall')
}

/** 生产管理用户端登录入口（会经统一认证中心）。 */
export function productionLogin(): string {
  return `${protocol}//${hostname}/production/login`
}

/** 统一认证中心注册页（已支持无授权上下文的独立注册）。 */
export function ssoRegister(): string {
  return `${protocol}//${hostname}:8090/register`
}

function ssoOrigin(): string {
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//${hostname}:8090`
  }
  return 'https://sso.agri-platform.com'
}

const SSO_CLIENT_ID = 'portal'
const SSO_VERIFIER_KEY = 'agri_portal_pkce_verifier'
const SSO_STATE_KEY = 'agri_portal_pkce_state'
const SSO_RETURN_KEY = 'agri_portal_return'

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomBase64Url(length = 32): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(length)))
}

async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64Url(new Uint8Array(digest))
}

/** 门户登录统一进入平台认证页，登录完成后回到当前门户页面。 */
export async function redirectToPlatformLogin(): Promise<void> {
  const verifier = randomBase64Url()
  const state = randomBase64Url(16)
  sessionStorage.setItem(SSO_VERIFIER_KEY, verifier)
  sessionStorage.setItem(SSO_STATE_KEY, state)
  sessionStorage.setItem(SSO_RETURN_KEY, `${window.location.pathname}${window.location.search}${window.location.hash}`)
  const redirectUri = `${window.location.origin}/portal/`
  const params = new URLSearchParams({
    client_id: SSO_CLIENT_ID,
    redirect_uri: redirectUri,
    state,
    code_challenge: await codeChallenge(verifier),
    code_challenge_method: 'S256',
  })
  window.location.href = `${ssoOrigin()}/authorize?${params.toString()}`
}

/** 处理统一认证回跳：校验 state/PKCE、换取令牌并回到登录前页面。 */
export async function completePlatformLogin(): Promise<boolean> {
  const query = new URLSearchParams(window.location.search)
  const code = query.get('code')
  if (!code) return false
  const state = query.get('state')
  const expectedState = sessionStorage.getItem(SSO_STATE_KEY)
  const verifier = sessionStorage.getItem(SSO_VERIFIER_KEY)
  if (!state || !expectedState || state !== expectedState || !verifier) {
    throw new Error('统一认证回跳校验失败，请重新登录')
  }
  const response = await fetch('/api/v1/sso/token', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, clientId: SSO_CLIENT_ID, codeVerifier: verifier }),
  })
  const body = await response.json() as { code?: number; message?: string; data?: { accessToken?: string } }
  if (!response.ok || body.code !== 0 || !body.data?.accessToken) {
    throw new Error(body.message || '统一认证登录未完成')
  }
  const returnTo = sessionStorage.getItem(SSO_RETURN_KEY) || '/portal/'
  sessionStorage.removeItem(SSO_VERIFIER_KEY)
  sessionStorage.removeItem(SSO_STATE_KEY)
  sessionStorage.removeItem(SSO_RETURN_KEY)
  window.location.replace(returnTo)
  return true
}
