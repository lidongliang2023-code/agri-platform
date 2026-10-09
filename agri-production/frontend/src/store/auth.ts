/**
 * 全局登录态 Store（zustand）
 *
 * 持久化字段：token / refreshToken / tokenExpireAt / roles / marketId /
 * userInfo / permissions，均写入 localStorage，刷新后自动恢复。
 *
 * 说明：`agri_token` 是 `@/utils/request` 注入 `Authorization` 头的唯一数据源，
 * 新增字段均为**增量**，不改既有方法签名，避免影响 BasicLayout / AiAssistant 等调用方。
 */
import { create } from 'zustand'

/** 访问令牌在 localStorage 中的键 */
export const TOKEN_KEY = 'agri_token'
/** 刷新令牌在 localStorage 中的键 */
export const REFRESH_TOKEN_KEY = 'agri_refresh_token'
/** 访问令牌过期时间（epoch 毫秒）在 localStorage 中的键 */
export const TOKEN_EXPIRE_AT_KEY = 'agri_token_expire_at'
/** 角色编码集合在 localStorage 中的键 */
export const ROLES_KEY = 'agri_roles'
/** 当前市场 ID 在 localStorage 中的键 */
export const MARKET_ID_KEY = 'agri_market_id'

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
  /** 刷新令牌；缺省时保留原有值 */
  refreshToken?: string
  /** 访问令牌有效期（秒）；缺省 0 表示不记录过期时间 */
  expiresIn?: number
  /** 角色编码集合 */
  roles?: string[]
  /** 当前市场 ID */
  marketId?: number | null
}

/** 登录态状态与行为 */
export interface AuthState {
  /** 访问令牌 */
  token: string | null
  /** 刷新令牌 */
  refreshToken: string | null
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

/** 从 localStorage 读取数字，失败时返回默认值 */
function readNumber(key: string, fallback: number): number {
  const raw = localStorage.getItem(key)
  if (!raw) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem(TOKEN_KEY),
  refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY),
  tokenExpireAt: readNumber(TOKEN_EXPIRE_AT_KEY, 0),
  roles: readStorage<string[]>(ROLES_KEY, []),
  marketId: localStorage.getItem(MARKET_ID_KEY)
    ? Number(localStorage.getItem(MARKET_ID_KEY))
    : null,
  userInfo: readStorage<AuthUser | null>('agri_user_info', null),
  permissions: readStorage<string[]>('agri_permissions', []),

  isLogin: () => Boolean(get().token),

  setToken: (token: string) => {
    localStorage.setItem(TOKEN_KEY, token)
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
    refreshToken,
    expiresIn = 0,
    roles,
    marketId,
  }) => {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem('agri_user_info', JSON.stringify(userInfo))
    localStorage.setItem('agri_permissions', JSON.stringify(permissions))

    const nextRefreshToken = refreshToken ?? get().refreshToken ?? ''
    const nextExpireAt = expiresIn > 0 ? Date.now() + expiresIn * 1000 : get().tokenExpireAt
    const nextRoles = roles ?? get().roles ?? []
    const nextMarketId = marketId === undefined ? get().marketId : marketId

    if (nextRefreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, nextRefreshToken)
    }
    localStorage.setItem(TOKEN_EXPIRE_AT_KEY, String(nextExpireAt))
    localStorage.setItem(ROLES_KEY, JSON.stringify(nextRoles))
    if (nextMarketId === null) {
      localStorage.removeItem(MARKET_ID_KEY)
    } else {
      localStorage.setItem(MARKET_ID_KEY, String(nextMarketId))
    }

    set({
      token,
      userInfo,
      permissions,
      refreshToken: nextRefreshToken || null,
      tokenExpireAt: nextExpireAt,
      roles: nextRoles,
      marketId: nextMarketId,
    })
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(TOKEN_EXPIRE_AT_KEY)
    localStorage.removeItem(ROLES_KEY)
    localStorage.removeItem(MARKET_ID_KEY)
    localStorage.removeItem('agri_user_info')
    localStorage.removeItem('agri_permissions')
    set({
      token: null,
      refreshToken: null,
      tokenExpireAt: 0,
      roles: [],
      marketId: null,
      userInfo: null,
      permissions: [],
    })
  },
}))

export default useAuthStore
