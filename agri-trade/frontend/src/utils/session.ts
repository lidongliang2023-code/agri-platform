/**
 * 登录态：访问令牌只放**内存**，不放 localStorage。
 *
 * <p>为什么不用 localStorage：任何一处 XSS 都能把它读走，而且它不会随标签页关闭而失效。
 * 访问令牌本身是短时效的（平台侧 2 小时），刷新页面后靠认证中心的 HttpOnly Cookie
 * 静默续签拿回来 —— 这也是"刷新不掉登录"的唯一依据。</p>
 */

let accessToken: string | null = null

/** 登录用户（来自令牌响应，仅用于界面展示） */
export interface SessionUser {
  id: string
  username: string
  nickname?: string
  roles?: string[]
}

let currentUser: SessionUser | null = null

export function setSession(token: string, user?: SessionUser | null): void {
  accessToken = token
  currentUser = user ?? null
}

export function clearSession(): void {
  accessToken = null
  currentUser = null
}

export function getAccessToken(): string | null {
  return accessToken
}

export function getCurrentUser(): SessionUser | null {
  return currentUser
}

export function isLoggedIn(): boolean {
  return accessToken !== null
}
