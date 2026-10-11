/**
 * 认证接口层（/api/v1/auth）
 *
 * 与业务接口分开的原因：业务请求统一走 `@/utils/request`（baseURL
 * `/api/v1/production`），而登录 / 刷新令牌位于 `/api/v1/auth`，不在业务前缀之下，
 * 因此这里单独持有一个 axios 实例，并复用同一套 `{ code, data, message }` 解包规则。
 *
 * 令牌存放位置（V2.0 第 4.3 节「Token 存储」）：
 *   - 访问令牌：`@/store/auth` 的**内存**字段（刷新页面即消失，不写 localStorage）；
 *   - 刷新令牌：**只存在于服务端 HttpOnly Cookie**，前端读不到也不该读到。
 *     登录/刷新时由服务端 Set-Cookie 下发，浏览器自动携带（`withCredentials`）。
 *
 * 刷新策略（不改动 `@/utils/request` 的前提下实现）：
 *   1. 启动续签：页面加载时先用 Cookie 换一组新访问令牌，换完才渲染路由
 *      （见 `bootstrapAuthRefresh` 与 `store/auth` 的 `authReady`）；
 *   2. 请求拦截：访问令牌剩余有效期不足 `REFRESH_AHEAD_MS` 时，先静默换新再发请求；
 *   3. 兜底：仍收到 401 时由 `@/utils/request` 清空登录态并跳转 `/login`；
 *   4. 登出：`store.logout()` 会经注册的钩子回调服务端登出，吊销刷新令牌并清 Cookie。
 *
 * @module api/auth
 */
import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import request from '@/utils/request'
import useAuthStore, { registerServerLogout } from '@/store/auth'
import { SSO_CLIENT_ID, ssoLogoutUrl } from '@/api/sso'

/** 认证端点前缀 */
const AUTH_BASE = '/api/v1/auth'

/** 登录页地址（与 `@/utils/request` 中保持一致） */
export const LOGIN_PATH = '/login'

/**
 * 运营端独立登录页路径（路线 2「独立登录页」拆分，2026-10-11）。
 *
 * 背景：V2.0 第 2.3 节 D1 要求九大子系统独立应用、各自独立登录页；
 * 现阶段先把现有单应用的运营端 / 用户端拆成两个独立登录页，
 * 原 {@link LOGIN_PATH} 保留为「按端分流」入口，兼容旧链接与 401 跳转。
 */
export const ADMIN_LOGIN_PATH = '/admin/login'

/** 用户端独立登录页路径（同上） */
export const USER_LOGIN_PATH = '/production/login'

/** 用户端首页 */
export const USER_HOME_PATH = '/production/dashboard'

/** 运营端首页 */
export const ADMIN_HOME_PATH = '/admin/production/dashboard'

/**
 * 访问令牌剩余有效期低于该阈值时提前续期，避免请求发出后恰好过期。
 * 单位毫秒，默认 2 分钟。
 */
const REFRESH_AHEAD_MS = 2 * 60 * 1000

/**
 * 后端统一响应包装体（与 `@/utils/request` 中的 `ApiResult` 同构）。
 *
 * @typeParam T 业务数据类型
 */
interface AuthApiResult<T> {
  /** 0 表示成功 */
  code: number
  /** 业务数据 */
  data: T
  /** 提示信息 */
  message: string
  /** 链路追踪 ID */
  traceId?: string
}

/** 登录请求体（对齐后端 `LoginRequest`） */
export interface LoginPayload {
  /** 用户名 */
  username: string
  /** 密码（明文，HTTPS 传输） */
  password: string
  /** 进入的市场 ID，缺省 1 */
  marketId?: number
}

/** 登录返回的用户信息（对齐后端 `UserVO`） */
export interface AuthUserVO {
  /** 用户 ID（后端为 Long，序列化为字符串） */
  id: string
  /** 用户名 */
  username: string
  /** 昵称 */
  nickname: string
  /** 角色编码集合 */
  roles: string[]
}

/** 登录 / 刷新令牌响应（对齐后端 `LoginVO`） */
export interface LoginResult {
  /** 访问令牌 */
  accessToken: string
  /** 访问令牌有效期（秒）；后端可能返回字符串，故兼容两种形态 */
  expiresIn: number | string
  /** 当前用户 */
  user: AuthUserVO
}

const authRequest = axios.create({
  baseURL: AUTH_BASE,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
  // 必须带凭证：刷新令牌在 HttpOnly Cookie 里，不带这行浏览器不会在 /refresh、/logout
  // 上携带它（开发期经 Vite 代理是同源，看似可有可无；生产分域部署时缺了它直接失效）
  withCredentials: true,
})

/**
 * 解包后端统一响应体。
 *
 * @typeParam T 业务数据类型
 * @param response axios 原始响应
 * @returns 业务数据
 */
function unwrapAuthResult<T>(response: AxiosResponse<AuthApiResult<T>>): T {
  const body = response.data
  if (!body || typeof body !== 'object' || !('code' in body)) {
    return body as unknown as T
  }
  if (body.code !== 0) {
    throw new Error(body.message || '认证请求失败')
  }
  return body.data
}

/**
 * 把 `expiresIn`（秒，可能是字符串）换算成过期时间戳。
 *
 * @param expiresIn 有效期秒数
 * @returns 过期时间（epoch 毫秒）
 */
export function toExpireAt(expiresIn: number | string | undefined): number {
  const seconds = Number(expiresIn)
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 0
  }
  return Date.now() + seconds * 1000
}

/**
 * 登录。
 *
 * @param payload 用户名 / 密码 / 市场 ID
 * @returns 令牌与用户信息
 */
export async function login(payload: LoginPayload): Promise<LoginResult> {
  const response = await authRequest.post<AuthApiResult<LoginResult>>('/login', {
    username: payload.username,
    password: payload.password,
    marketId: payload.marketId ?? 1,
  })
  return unwrapAuthResult(response)
}

/**
 * 用刷新令牌换新一组令牌（服务端旋转，旧刷新令牌随即失效）。
 *
 * <p>刷新令牌由浏览器经 HttpOnly Cookie 自动携带（`withCredentials`），前端拿不到也不需要
 * 它。请求体留空是刻意的：往里塞令牌，就等于又给它开了一条能落进 localStorage 的路。</p>
 *
 * @returns 新的访问令牌与用户信息
 */
export async function refreshSession(): Promise<LoginResult> {
  const response = await authRequest.post<AuthApiResult<LoginResult>>('/refresh', {})
  return unwrapAuthResult(response)
}

/**
 * 查询当前登录用户。
 *
 * @returns 当前用户信息
 */
export async function fetchCurrentUser(): Promise<AuthUserVO> {
  const token = useAuthStore.getState().token
  const response = await authRequest.get<AuthApiResult<AuthUserVO>>('/me', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  return unwrapAuthResult(response)
}

/**
 * 退出登录：服务端吊销刷新令牌并清除 HttpOnly Cookie。
 *
 * <p>凭证全在 Cookie 里，前端既拿不到也无须传令牌；服务端按 Cookie 吊销。</p>
 */
export async function logout(): Promise<void> {
  try {
    await authRequest.post<AuthApiResult<null>>('/logout', {})
  } catch {
    // 服务端登出失败不影响本地清理，静默忽略
  }
}

/**
 * 按角色判定登录后的落地页。
 *
 * 运营端角色（SUPER_ADMIN / MARKET_OPS / 以 ADMIN 或 OPS 结尾）进运营端，
 * 其余（如 FARMER）进用户端。
 *
 * @param roles 角色编码集合
 * @returns 首页路径
 */
export function resolveHomePath(roles: string[]): string {
  const safeRoles = Array.isArray(roles) ? roles : []
  const isOps = safeRoles.some(
    (role) =>
      role === 'SUPER_ADMIN' ||
      role === 'MARKET_OPS' ||
      role.endsWith('ADMIN') ||
      role.endsWith('OPS'),
  )
  return isOps ? ADMIN_HOME_PATH : USER_HOME_PATH
}

/**
 * 把一次登录 / 刷新结果写入 zustand（访问令牌与用户信息；刷新令牌不经前端）。
 *
 * @param result 登录或刷新结果
 * @param marketId 当前市场 ID
 */
export function persistSession(result: LoginResult, marketId?: number): void {
  const store = useAuthStore.getState()
  store.login({
    token: result.accessToken,
    userInfo: {
      userId: result.user?.id ?? '',
      username: result.user?.username ?? '',
      realName: result.user?.nickname ?? result.user?.username ?? '',
      tenantId: '',
      // 运营端角色为 1，农户等普通用户为 3
      userType: resolveHomePath(result.user?.roles ?? []) === ADMIN_HOME_PATH ? 1 : 3,
    },
    permissions: result.user?.roles ?? [],
    expiresIn: Number(result.expiresIn),
    roles: result.user?.roles ?? [],
    marketId: marketId ?? null,
  })
}

/** 正在进行的刷新 Promise，用于合并并发请求，避免重复刷新 */
let refreshing: Promise<string> | null = null

/**
 * 执行一次令牌刷新（带并发合并）。
 *
 * @returns 新的访问令牌
 */
async function doRefresh(): Promise<string> {
  if (refreshing) {
    return refreshing
  }
  // 刷新令牌在 HttpOnly Cookie 里：前端只负责发这一次请求，不参与令牌管理
  refreshing = refreshSession()
    .then((result) => {
      persistSession(result, useAuthStore.getState().marketId ?? undefined)
      return result.accessToken
    })
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

/**
 * 应用启动时调用：用 HttpOnly Cookie 里的刷新令牌静默换一组新访问令牌。
 *
 * <p>访问令牌只存内存，刷新页面后必然为空，所以"刷新页面还能保持登录"完全依赖这一步。
 * 换签失败时清理登录态但不主动跳转——跳转交给路由守卫与后续请求的 401 处理，
 * 避免与 `@/utils/request` 的跳转逻辑重复触发。</p>
 *
 * <p>无论成功与否，最后都必须置 `authReady`，否则界面会永远停在"正在恢复登录状态"。</p>
 */
export async function bootstrapAuthRefresh(): Promise<void> {
  // 只有"本机上次确实登录过"的痕迹（本地留有用户资料）才值得跑续签，未登录访客直接跳过
  const maybeLoggedIn = Boolean(useAuthStore.getState().userInfo)
  try {
    if (maybeLoggedIn) {
      await doRefresh()
    }
  } catch {
    // 无 Cookie / Cookie 已过期 / 服务端已吊销：清干净本地痕迹，回到未登录态
    useAuthStore.getState().logout({ sso: false })
  } finally {
    useAuthStore.getState().setAuthReady(true)
  }
}

/**
 * 注册「令牌快过期前自动续期」的请求拦截器。
 *
 * 挂载在业务请求实例 `@/utils/request` 上，在应用启动时调用一次即可。
 */
export function installAuthRefreshInterceptor(): void {
  request.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      const { token, tokenExpireAt } = useAuthStore.getState()
      // 无令牌 / 距过期还早 —— 原样放行
      if (!token) {
        return config
      }
      if (tokenExpireAt <= 0 || tokenExpireAt > Date.now() + REFRESH_AHEAD_MS) {
        return config
      }
      try {
        const nextToken = await doRefresh()
        config.headers.Authorization = `Bearer ${nextToken}`
      } catch {
        // 刷新失败：交给响应侧的 401 处理（清理登录态并跳转登录页）
      }
      return config
    },
    (error: unknown) => Promise.reject(error),
  )
}

/**
 * 把"服务端登出"注册进 store。
 *
 * 这样任何调用 `store.logout()` 的地方（顶栏退出、401 清理、续签失败）都会顺带吊销
 * 服务端刷新令牌并清除 HttpOnly Cookie，不必逐个调用点去补网络请求。
 */
registerServerLogout((options) => {
  void (async () => {
    // 先吊销平台令牌（刷新令牌 + 访问令牌黑名单），再决定是否去 SSO 域销毁全局会话。
    // 顺序不能反：整页导航会中断当前文档的请求，跳走之后就没机会再发了。
    await logout()
    if (options?.sso !== false) {
      window.location.href = ssoLogoutUrl(SSO_CLIENT_ID)
    }
  })()
})
