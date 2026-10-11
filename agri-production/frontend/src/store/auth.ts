/**
 * 全局登录态 Store（zustand）
 *
 * <p><b>凭证一律不落 localStorage</b>（V2.0 第 4.3 节「Token 存储」）：
 * 访问令牌只存**内存**（本 store 的 `token`，页面刷新即消失，靠启动时用
 * HttpOnly Cookie 里的刷新令牌静默续签回来）；刷新令牌**完全不进前端**
 * （只在服务端 Redis 与浏览器 HttpOnly Cookie 中，JS 读不到）。</p>
 *
 * <p>localStorage 只保留**非凭证**的界面态（用户资料、权限点、角色、当前市场），
 * 目的是刷新后菜单与角色文案不闪一下；即使被篡改也只影响显示，真正的授权判定在服务端
 * （JwtAuthFilter + MarketContext）。</p>
 *
 * <p>`token` 仍是 `@/utils/request` 注入 `Authorization` 头的唯一数据源。</p>
 */
import { create } from 'zustand'

/**
 * 历史遗留的凭证键（**只用于清理**，不再写入）。
 *
 * 2026-10-11 之前，访问令牌 / 刷新令牌 / 过期时间都写在 localStorage。
 * 升级后必须在启动时主动删除：改代码不会自动擦掉老用户浏览器里已经落盘的那几份凭证。
 */
export const TOKEN_KEY = 'agri_token'
export const REFRESH_TOKEN_KEY = 'agri_refresh_token'
export const TOKEN_EXPIRE_AT_KEY = 'agri_token_expire_at'

/** 角色编码集合在 localStorage 中的键（非凭证，保留） */
export const ROLES_KEY = 'agri_roles'
/** 当前市场 ID 在 localStorage 中的键（非凭证，保留） */
export const MARKET_ID_KEY = 'agri_market_id'

/** 启动即清理历史凭证（隐私模式下 localStorage 不可用，静默跳过） */
function purgeLegacyCredentialKeys(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(TOKEN_EXPIRE_AT_KEY)
  } catch {
    // 隐私模式 / 存储被禁用：本来就没有持久化凭证可清，忽略
  }
}

purgeLegacyCredentialKeys()

/** 登录用户信息 */
export interface AuthUser {
  /** 用户 ID */
  userId: string
  /** 用户名 */
  username: string
  /** 昵称 / 姓名 */
  realName: string
  /** 头像地址 */
  avatar?: string
  /** 手机号 */
  phone?: string
  /** 所属租户 ID */
  tenantId: string
  /** 租户名称 */
  tenantName?: string
  /** 用户类型：1 平台运营 2 租户管理员 3 普通成员 */
  userType: 1 | 2 | 3
}

/** 整体登录入参 */
export interface LoginPayload {
  /** 访问令牌 */
  token: string
  /** 当前登录用户 */
  userInfo: AuthUser
  /** 权限点编码集合 */
  permissions?: string[]
  /** 访问令牌有效期（秒）；缺省 0 表示不记录过期时间 */
  expiresIn?: number
  /** 角色编码集合 */
  roles?: string[]
  /** 当前市场 ID */
  marketId?: number | null
}

/** 登录态状态与行为 */
export interface AuthState {
  /** 访问令牌（仅内存；页面刷新后由静默续签恢复） */
  token: string | null
  /** 访问令牌过期时间（epoch 毫秒）；0 表示未知 */
  tokenExpireAt: number
  /** 角色编码集合 */
  roles: string[]
  /** 当前市场 ID */
  marketId: number | null
  /** 当前登录用户 */
  userInfo: AuthUser | null
  /** 权限点编码集合 */
  permissions: string[]
  /**
   * 启动静默续签是否已出结果。
   *
   * <p>访问令牌只在内存，刷新页面后要先用 Cookie 换回来；换回来之前路由守卫看到的
   * `token` 必然是 null，此时若就渲染路由，已登录用户会被误判成未登录而弹回登录页
   * （表现为"一刷新就掉登录"）。故用本标志把渲染压到续签出结果之后。</p>
   */
  authReady: boolean
  /** 标记启动续签已出结果（成功/失败都必须置位，否则界面永远卡在加载态） */
  setAuthReady: (ready: boolean) => void
  /** 是否已登录 */
  isLogin: () => boolean
  /** 写入 token */
  setToken: (token: string) => void
  /** 写入用户信息 */
  setUserInfo: (userInfo: AuthUser) => void
  /** 写入权限点 */
  setPermissions: (permissions: string[]) => void
  /** 整体登录（token + 用户 + 权限，可附带刷新令牌 / 有效期 / 角色 / 市场） */
  login: (payload: LoginPayload) => void
  /** 退出登录并跳转登录页 */
  logout: () => void
}

/** 从 localStorage 读取 JSON，失败时返回默认值 */
function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw || raw === 'null' || raw === 'undefined') return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

const useAuthStore = create<AuthState>((set, get) => ({
  // 凭证一律从内存起步：刷新页面后为空，由 bootstrapAuthRefresh 用 HttpOnly Cookie 换回
  token: null,
  tokenExpireAt: 0,
  authReady: false,
  roles: readStorage<string[]>(ROLES_KEY, []),
  marketId: localStorage.getItem(MARKET_ID_KEY)
    ? Number(localStorage.getItem(MARKET_ID_KEY))
    : null,
  userInfo: readStorage<AuthUser | null>('agri_user_info', null),
  permissions: readStorage<string[]>('agri_permissions', []),

  isLogin: () => Boolean(get().token),

  setToken: (token: string) => {
    // 只进内存：访问令牌不写 localStorage
    set({ token })
  },

  setUserInfo: (userInfo: AuthUser) => {
    localStorage.setItem('agri_user_info', JSON.stringify(userInfo))
    set({ userInfo })
  },

  setPermissions: (permissions: string[]) => {
    localStorage.setItem('agri_permissions', JSON.stringify(permissions))
    set({ permissions })
  },

  login: ({
    token,
    userInfo,
    permissions = [],
    expiresIn = 0,
    roles,
    marketId,
  }) => {
    // 用户资料 / 权限 / 角色 / 市场是界面态，可持久化；令牌一律不落盘
    localStorage.setItem('agri_user_info', JSON.stringify(userInfo))
    localStorage.setItem('agri_permissions', JSON.stringify(permissions))
    localStorage.setItem(ROLES_KEY, JSON.stringify(roles ?? get().roles ?? []))

    const nextExpireAt = expiresIn > 0 ? Date.now() + expiresIn * 1000 : get().tokenExpireAt
    const nextRoles = roles ?? get().roles ?? []
    const nextMarketId = marketId === undefined ? get().marketId : marketId

    if (nextMarketId === null) {
      localStorage.removeItem(MARKET_ID_KEY)
    } else {
      localStorage.setItem(MARKET_ID_KEY, String(nextMarketId))
    }

    set({
      token,
      userInfo,
      permissions,
      tokenExpireAt: nextExpireAt,
      roles: nextRoles,
      marketId: nextMarketId,
    })
  },

  setAuthReady: (ready: boolean) => set({ authReady: ready }),

  logout: () => {
    localStorage.removeItem(ROLES_KEY)
    localStorage.removeItem(MARKET_ID_KEY)
    localStorage.removeItem('agri_user_info')
    localStorage.removeItem('agri_permissions')
    purgeLegacyCredentialKeys()
    set({
      token: null,
      tokenExpireAt: 0,
      roles: [],
      marketId: null,
      userInfo: null,
      permissions: [],
    })
    // 通知服务端：吊销刷新令牌并清除 HttpOnly Cookie。
    // 少了这一步就会出现"点了登出、刷新页面又登回来"—— Cookie 还在，静默续签照样成功。
    serverLogoutNotifier?.()
  },
}))

/**
 * 服务端登出动作由 `@/api/auth` 注册进来。
 *
 * 为什么用注册而不是直接 import：`api/auth` 依赖本 store，本 store 反向 import 会成环；
 * 且本 store 也是 `@/utils/request` 处理 401 时的清理入口，那里同样不该背上网络调用。
 */
let serverLogoutNotifier: (() => void) | null = null

/** 注册服务端登出动作（由 `@/api/auth` 在模块加载时调用一次） */
export function registerServerLogout(fn: () => void): void {
  serverLogoutNotifier = fn
}

export default useAuthStore
