/**
 * 登录态与「当前农场」上下文。
 *
 * <p>移动端不复用浏览器 Cookie 会话（小程序没有 Cookie 语义），而是拿统一认证中心
 * 返回的 accessToken 存本地、按 Bearer 发送 —— 这与 PC 端探针/联调脚本用的是同一套。</p>
 */
import { BASE_URL, request, TOKEN_KEY, clearProductionContext } from './request'

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

export interface SmsLoginPayload {
  phone: string
  code: string
  marketId?: number
}

export interface OnboardingVerification {
  channel?: string
  policeVerified?: boolean
  livenessVerified?: boolean
  businessLicenseUrl?: string
  legalPersonFaceUrl?: string
  legalPersonFaceStatus?: string
  corporateBankName?: string
  corporateBankAccount?: string
  corporateTransferAmount?: string
  corporateTransferReference?: string
  corporateTransferProofUrl?: string
  corporateTransferStatus?: string
  registeredCapital?: string
  idNoMasked?: string
  creditCode?: string
  legalPerson?: string
}

export interface OnboardingStatus {
  stage: string
  phone?: string
  nickname?: string
  identity?: 'enterprise' | 'personal'
  merchantId?: number | string | null
  subjectName?: string
  certificationStatus?: string
  certificationNo?: string
  verification?: OnboardingVerification
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
function persistLogin(data: any, fallbackUsername: string): MobileUser {
  const token = data?.accessToken ?? data?.token
  if (!token) throw new Error('登录失败：认证中心未返回访问令牌')
  clearProductionContext()
  uni.setStorageSync(TOKEN_KEY, token)
  const user: MobileUser = {
    userId: data?.user?.id ?? data?.user?.userId ?? data?.userId,
    username: data?.user?.username ?? fallbackUsername,
    realName: data?.user?.nickname ?? data?.user?.realName ?? data?.realName ?? fallbackUsername,
    phone: data?.user?.phone ?? data?.phone ?? data?.user?.mobile,
    roles: data?.roles ?? data?.user?.roles ?? [],
  }
  uni.setStorageSync(USER_KEY, user)
  return user
}

export async function login(payload: LoginPayload): Promise<MobileUser> {
  const data = await request<any>({
    url: '/api/v1/auth/login',
    method: 'POST',
    auth: false,
    data: { username: payload.username, password: payload.password, marketId: payload.marketId ?? 1 },
  })
  // 姓名口径：统一认证中心返回的是 user.nickname（如「张农户」），
  // 不是 realName；拿不到才退回账号名，避免界面上直接把登录名当姓名显示。
  return persistLogin(data, payload.username)
}

/** 手机验证码登录；返回开通阶段，登录账号本身可先进入业务端。 */
export async function loginBySms(payload: SmsLoginPayload): Promise<{
  user: MobileUser
  stage: string
  redirect?: string
}> {
  const data = await request<any>({
    url: '/api/v1/sso/login-standalone-by-sms',
    method: 'POST',
    auth: false,
    data: {
      phone: payload.phone,
      code: payload.code,
      marketId: payload.marketId ?? 1,
      remember: true,
    },
  })
  return {
    user: persistLogin(data, payload.phone),
    stage: data?.stage ?? 'done',
    redirect: data?.redirect,
  }
}

/** 发送登录、注册或找回密码验证码。 */
export async function sendSmsCode(
  phone: string,
  scene: 'login' | 'register' | 'reset_password',
): Promise<{ hint?: string; devMode?: boolean }> {
  return request({
    url: '/api/v1/sso/sms/code',
    method: 'POST',
    auth: false,
    data: { phone, scene },
  })
}

/** 分步注册第 1 步，随后用刚设置的密码获取移动端访问令牌。 */
export async function registerAccount(payload: {
  phone: string
  code: string
  password: string
  nickname?: string
}): Promise<OnboardingStatus> {
  const status = await request<OnboardingStatus>({
    url: '/api/v1/sso/register-account',
    method: 'POST',
    auth: false,
    data: {
      ...payload,
      marketId: 1,
      remember: true,
    },
  })
  await login({ username: payload.phone, password: payload.password, marketId: 1 })
  return status
}

export async function getOnboardingStatus(): Promise<OnboardingStatus> {
  return request<OnboardingStatus>({
    url: '/api/v1/sso/onboarding/status',
    method: 'GET',
  })
}

export async function createOnboardingSubject(payload: Record<string, unknown>): Promise<OnboardingStatus> {
  return request<OnboardingStatus>({
    url: '/api/v1/sso/onboarding/subject',
    method: 'POST',
    data: payload,
  })
}

export async function verifyPersonalOnboarding(kind: 'police' | 'liveness', payload: {
  realName?: string
  idCard?: string
} = {}): Promise<OnboardingStatus> {
  return request<OnboardingStatus>({
    url: `/api/v1/sso/onboarding/verification/personal/${kind}`,
    method: 'POST',
    data: kind === 'police' ? payload : undefined,
  })
}

export async function prepareEnterpriseOnboarding(payload: Record<string, unknown>): Promise<OnboardingStatus> {
  return request<OnboardingStatus>({
    url: '/api/v1/sso/onboarding/verification/enterprise/prepare',
    method: 'POST',
    data: payload,
  })
}

export async function submitOnboardingCertification(): Promise<{ stage: string; redirect?: string }> {
  return request({
    url: '/api/v1/sso/onboarding/certification',
    method: 'POST',
    data: { clientId: '', redirectUri: '' },
  })
}

/** 认证材料上传，H5 与小程序共用 uni.uploadFile。 */
export function uploadOnboardingFile(
  merchantId: string,
  kind: 'business_license' | 'legal_person_face' | 'corporate_transfer_proof',
  filePath: string,
): Promise<string> {
  const token = uni.getStorageSync(TOKEN_KEY)
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: `${BASE_URL}/api/v1/sso/account/businesses/${encodeURIComponent(merchantId)}/certification-files?kind=${kind}`,
      filePath,
      name: 'file',
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: (response) => {
        try {
          const body = typeof response.data === 'string' ? JSON.parse(response.data) : response.data
          if (response.statusCode >= 400 || body?.code !== 0 || !body?.data?.url) {
            reject(new Error(body?.message || '认证材料上传失败'))
            return
          }
          resolve(String(body.data.url))
        } catch {
          reject(new Error('认证材料上传响应无法解析'))
        }
      },
      fail: (error) => reject(new Error(error.errMsg || '认证材料上传失败')),
    })
  })
}

/** 退出登录：清本地登录态（服务端吊销是 PC 端与会话凭证的事，移动端不持有刷新令牌） */
export function logout(): void {
  clearProductionContext()
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
