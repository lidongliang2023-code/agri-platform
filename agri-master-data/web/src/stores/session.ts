/**
 * 登录态（Pinia）。
 *
 * <p><b>凭证一律不落 localStorage</b>（V2.0 第 4.3 节「Token 存储」）：
 * 访问令牌只存**内存**，刷新页面即消失，靠启动时用 HttpOnly Cookie 里的刷新令牌
 * 静默续签拿回来；刷新令牌**完全不进前端**，JS 读不到。</p>
 *
 * <p>localStorage 只留**非凭证**的界面态（用户资料、角色），目的是刷新后
 * 用户名与角色文案不闪一下；即使被篡改也只影响显示，真正的鉴权在服务端。</p>
 *
 * <p>注意：这是**唯一**的登录态来源。此前 `stores/user.ts` 里另有一份
 * 只存 token/user 的骨架，两份并存必然分叉，已删除。</p>
 */
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { refreshAccessToken, type SsoLoginResult } from '@/utils/sso'

/** 当前登录用户（非凭证，可持久化） */
export interface SessionUser {
  userId: string
  username: string
  nickname: string
  roles: string[]
}

const USER_KEY = 'agri_mdm_user'

/** 历史遗留的凭证键：**只用于清理**，不再写入。改代码不会擦掉老浏览器里已落盘的凭证。 */
const LEGACY_CREDENTIAL_KEYS = ['token', 'user', 'userType']

function purgeLegacyCredentialKeys(): void {
  try {
    LEGACY_CREDENTIAL_KEYS.forEach((key) => localStorage.removeItem(key))
  } catch {
    // 隐私模式 / 存储被禁用：本来就没有可清理的持久化凭证，忽略
  }
}

function readUser(): SessionUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as SessionUser) : null
  } catch {
    return null
  }
}

/** 把后端的 expiresIn（可能是字符串）收敛成毫秒时间戳 */
function expireAtOf(expiresIn: number | string): number {
  const seconds = Number(expiresIn)
  return Number.isFinite(seconds) && seconds > 0 ? Date.now() + seconds * 1000 : 0
}

export const useSessionStore = defineStore('session', () => {
  /** 访问令牌：只在内存 */
  const accessToken = ref<string | null>(null)
  /** 访问令牌过期时间戳（毫秒）；0 表示未知 */
  const expireAt = ref(0)
  /** 当前用户：非凭证，可持久化 */
  const user = ref<SessionUser | null>(readUser())
  /**
   * 启动续签是否已出结果。
   *
   * <p>访问令牌只在内存，刷新页面后路由守卫看到的必然是 null；此时若就渲染路由，
   * 已登录用户会被误判成未登录弹回登录页（表现为"一刷新就掉登录"）。
   * 故用本标志把渲染压到续签出结果之后 —— 成功或失败都必须置位，否则永远卡在加载态。</p>
   */
  const ready = ref(false)

  const isLoggedIn = computed(() => accessToken.value !== null && accessToken.value !== '')

  /** 写入一次登录结果（换票成功 / 续签成功都走这里） */
  function apply(result: SsoLoginResult): void {
    accessToken.value = result.accessToken
    expireAt.value = expireAtOf(result.expiresIn)
    const nextUser: SessionUser = {
      userId: result.user?.id ?? '',
      username: result.user?.username ?? '',
      nickname: result.user?.nickname ?? result.user?.username ?? '',
      roles: result.user?.roles ?? [],
    }
    user.value = nextUser
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(nextUser))
    } catch {
      // 存储不可用时只影响刷新后的显示，不影响鉴权
    }
  }

  /** 只清本地态（401 之后用；不跳登出端点，避免"弹去认证中心又弹回来"） */
  function clear(): void {
    accessToken.value = null
    expireAt.value = 0
    user.value = null
    purgeLegacyCredentialKeys()
    try {
      localStorage.removeItem(USER_KEY)
    } catch {
      // 同上
    }
  }

  /** 启动续签：拿 Cookie 换回访问令牌。无论成败都必须置 ready。 */
  async function bootstrap(): Promise<void> {
    purgeLegacyCredentialKeys()
    if (accessToken.value === null) {
      const result = await refreshAccessToken()
      if (result) {
        apply(result)
      }
    }
    ready.value = true
  }

  return { accessToken, expireAt, user, ready, isLoggedIn, apply, clear, bootstrap }
})
