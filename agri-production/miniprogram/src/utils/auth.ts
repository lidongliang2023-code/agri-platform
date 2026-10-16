/**
 * 登录态与「当前农场」上下文。
 *
 * <p>移动端不复用浏览器 Cookie 会话（小程序没有 Cookie 语义），而是拿统一认证中心
 * 返回的 accessToken 存本地、按 Bearer 发送 —— 这与 PC 端探针/联调脚本用的是同一套。</p>
 */
import { request, TOKEN_KEY } from './request'

/** 用户信息存储键 */
const USER_KEY = 'agri_user'
/** 当前农场存储键（与 PC 端同名，便于同一账号两端观感一致） */
const FARM_KEY = 'agri_current_farm'

/** 登录入参 */
export interface LoginPayload {
  username: string
  password: string
  marketId?: number
}

/** 登录后本地保存的用户信息 */
export interface MobileUser {
  userId?: string
  username?: string
  realName?: string
  phone?: string
  roles?: string[]
}

/** 农场（移动端只用到这几个字段） */
export interface FarmBrief {
  farmId: string
  farmCode?: string
  farmName: string
  location?: string
}

/**
 * 账号密码登录（统一认证中心）。
 *
 * @param payload 账号 / 密码 / 市场 ID
 * @returns 登录后的用户信息
 */
export async function login(payload: LoginPayload): Promise<MobileUser> {
  const data = await request<any>({
    url: '/api/v1/auth/login',
    method: 'POST',
    auth: false,
    data: { username: payload.username, password: payload.password, marketId: payload.marketId ?? 1 },
  })
  // 令牌字段历史上叫过 accessToken / token，这里两种都认，拿不到就如实报错
  const token = data?.accessToken ?? data?.token
  if (!token) throw new Error('登录失败：认证中心未返回访问令牌')
  uni.setStorageSync(TOKEN_KEY, token)
  // 姓名口径：统一认证中心返回的是 user.nickname（如「张农户」），
  // 不是 realName；拿不到才退回账号名，避免界面上直接把登录名当姓名显示。
  const user: MobileUser = {
    userId: data?.user?.id ?? data?.user?.userId ?? data?.userId,
    username: data?.user?.username ?? payload.username,
    realName: data?.user?.nickname ?? data?.user?.realName ?? data?.realName ?? payload.username,
    phone: data?.user?.phone ?? data?.phone ?? data?.user?.mobile,
    roles: data?.roles ?? data?.user?.roles ?? [],
  }
  uni.setStorageSync(USER_KEY, user)
  return user
}

/** 退出登录：清本地登录态（服务端吊销是 PC 端与会话凭证的事，移动端不持有刷新令牌） */
export function logout(): void {
  uni.removeStorageSync(TOKEN_KEY)
  uni.removeStorageSync(USER_KEY)
  uni.removeStorageSync(FARM_KEY)
}

/** 是否已登录 */
export function isLoggedIn(): boolean {
  return Boolean(uni.getStorageSync(TOKEN_KEY))
}

/** 读当前用户 */
export function currentUser(): MobileUser {
  return (uni.getStorageSync(USER_KEY) as MobileUser) ?? {}
}

/** 读当前农场（可能是空对象，页面据此提示先选农场） */
export function currentFarm(): FarmBrief | null {
  const farm = uni.getStorageSync(FARM_KEY) as FarmBrief | ''
  return farm ? (farm as FarmBrief) : null
}

/** 写当前农场 */
export function setCurrentFarm(farm: FarmBrief): void {
  uni.setStorageSync(FARM_KEY, farm)
}

/**
 * 未登录则跳登录页（各 Tab 页 onShow 时调用）。
 *
 * @returns 已登录返回 true，未登录返回 false（调用方应停止后续请求）
 */
export function ensureLogin(): boolean {
  if (isLoggedIn()) return true
  uni.reLaunch({ url: '/pages/login/login' })
  return false
}
