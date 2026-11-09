/**
 * 生产管理模块移动端 · 请求层
 *
 * <p>与 PC 端（{@code agri-production/frontend/src/utils/request.ts}）保持同一套契约：
 * 统一网关前缀 {@code /api/v1}，成功判据是**业务码 {@code code === 0}**（不是 HTTP 200），
 * 令牌走 {@code Authorization: Bearer <accessToken>}。</p>
 *
 * <p>基址按端区分（uni-app 条件编译）：H5 走同源 + vite 代理，小程序端必须写绝对地址
 * （开发者工具里勾选「不校验合法域名」；真机需在微信后台配置 https 域名）。</p>
 */

/**
 * 接口基址：**运行时判断**而不是 uni-app 条件编译。
 *
 * <p>一开始用的是 `// #ifdef H5` 条件编译，构建没问题，但 `tsc --noEmit` 会同时看到两个分支，
 * 报 "Cannot redeclare block-scoped variable BASE_URL" —— 类型检查就永远过不去。
 * 改成运行时判断：小程序/App 里没有 `window`（必须绝对地址，开发者工具要勾"不校验合法域名"），
 * H5 用同源地址（开发期由 vite proxy 反代到网关）。</p>
 */
const configuredBase = String(import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
export const BASE_URL = configuredBase || (typeof window === 'undefined' ? 'http://localhost' : '')

/** 后端统一响应体 */
export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

/** 后端分页体：历史上有 records / list 两种键，移动端统一归一化成 list */
export interface PageResult<T> {
  list: T[]
  total: number
  pageNum: number
  pageSize: number
}

/** 请求参数 */
export interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  data?: Record<string, any>
  params?: Record<string, any>
  /** 是否携带令牌，默认 true（登录接口自身传 false） */
  auth?: boolean
}

/** 令牌存储键 */
export const TOKEN_KEY = 'agri_token'
export const SUBJECT_KEY = 'agri_current_subject'
let contextVersion = 0
export function clearProductionContext(): void {
  contextVersion++
  uni.removeStorageSync(SUBJECT_KEY)
  uni.removeStorageSync('agri_current_farm')
}
export interface ProductionSubject { merchantId: string; merchantName?: string; active?: boolean }
export interface Admission { granted: boolean; reason?: string }
export async function subjectSummary(): Promise<{ merchants: ProductionSubject[]; activeMerchantId?: string }> {
  return request({ url: '/api/v1/sso/account/summary' })
}
export async function productionAdmission(subject?: string): Promise<Admission> {
  const id = subject || String(uni.getStorageSync(SUBJECT_KEY) || '')
  const data = await request<{ capabilities: Array<Admission & { code: string }> }>({
    url: '/api/v1/sso/account/capabilities', params: id ? { merchantId: id } : undefined,
  })
  const result = data.capabilities?.find(row => row.code === 'production.manage')
  if (!result) throw new Error('生产准入结果缺失，请稍后重试')
  return result
}
export async function activateProductionSubject(id: string): Promise<void> {
  await request({ url: `/api/v1/sso/account/businesses/${encodeURIComponent(id)}/activate`, method: 'POST' })
  clearProductionContext()
  uni.setStorageSync(SUBJECT_KEY, id)
}


/** 清空登录态并回登录页（401 时调用一次，避免多请求并发时反复跳转） */
let redirecting = false
function handleUnauthorized(): void {
  clearProductionContext()
  uni.removeStorageSync(TOKEN_KEY)
  uni.removeStorageSync('agri_user')
  if (redirecting) return
  redirecting = true
  uni.reLaunch({
    url: '/pages/login/login',
    complete: () => {
      setTimeout(() => {
        redirecting = false
      }, 1000)
    },
  })
}

/** 把 params 拼成查询串（uni.request 的 params 在部分端上不稳定，这里自己拼） */
function toQuery(params?: Record<string, any>): string {
  if (!params) return ''
  const pairs: string[] = []
  Object.keys(params).forEach((key) => {
    const value = params[key]
    if (value === undefined || value === null || value === '') return
    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  })
  return pairs.length > 0 ? `?${pairs.join('&')}` : ''
}

/**
 * 发一次请求，成功时直接 resolve 业务 data。
 *
 * @param options 见 RequestOptions
 * @returns 业务数据
 */
export async function request<T = any>(options: RequestOptions): Promise<T> {
  const tokenAtStart = uni.getStorageSync(TOKEN_KEY)
  const versionAtStart = contextVersion
  const production = options.auth !== false && /^\/api\/v1\/production(?:\/|$)/.test(options.url)
    && !/^\/api\/v1\/production\/admin(?:\/|$)/.test(options.url)
  let subject = String(uni.getStorageSync(SUBJECT_KEY) || '')
  if (production && !subject) {
    const summary = await subjectSummary()
    if (tokenAtStart !== uni.getStorageSync(TOKEN_KEY) || versionAtStart !== contextVersion) throw new Error('账号或主体已切换，请刷新后重试')
    subject = summary.activeMerchantId ? String(summary.activeMerchantId) : ''
    if (!subject) throw new Error('请先在「我的」选择当前经营主体')
    uni.setStorageSync(SUBJECT_KEY, subject)
  }
  if (production && !/^(GET|HEAD|OPTIONS)$/i.test(options.method || 'GET')) {
    const admission = await productionAdmission(subject)
    if (!admission.granted) throw new Error(admission.reason || '当前主体尚未具备生产写入权限')
  }
  if (production && (tokenAtStart !== uni.getStorageSync(TOKEN_KEY) || versionAtStart !== contextVersion
      || subject !== String(uni.getStorageSync(SUBJECT_KEY) || ''))) throw new Error('账号或主体已切换，请刷新后重试')

  const url = `${BASE_URL}${options.url}${toQuery(options.params)}`
  const header: Record<string, string> = { 'Content-Type': 'application/json' }
  if (production && subject) header['X-Merchant-Id'] = subject
  if (options.auth !== false) {
    const token = uni.getStorageSync(TOKEN_KEY)
    if (token) header.Authorization = `Bearer ${token}`
  }
  return new Promise<T>((resolve, reject) => {
    uni.request({
      url,
      timeout: 15000,
      // uni 的类型定义里没有 PATCH（微信小程序的 wx.request 也不支持 PATCH），
      // 这里强转一次；实际只有 /messages/read-all 会用到，且后端已同时开放 PUT（见 UserMessageController）。
      method: (options.method || 'GET') as any,
      data: options.data,
      header,
      success: (res) => {
        const body = res.data as ApiResponse<T>
        if (res.statusCode === 401 || body?.code === 401) {
          handleUnauthorized()
          reject(new Error('登录已过期，请重新登录'))
          return
        }
        if (res.statusCode >= 400) {
          reject(new Error(body?.message || `请求失败（HTTP ${res.statusCode}）`))
          return
        }
        // 成功判据：业务码 0（生产域口径）。非 0 一律当失败并带上后端文案，
        // 尤其 501「未接入」要如实透出，不能吞掉显示成空数据。
        if (body?.code === 0) {
          resolve(body.data)
          return
        }
        reject(new Error(body?.message || `请求失败（code=${body?.code}）`))
      },
      fail: (err) => {
        reject(new Error(err?.errMsg || '网络异常，请检查网络后重试'))
      },
    })
  })
}

/**
 * 分页查询归一化：把 records / list 两种返回形状统一成 {@link PageResult}。
 *
 * @param result 后端原始返回
 * @param pageNum 页码
 * @param pageSize 每页条数
 * @returns 归一化分页结果
 */
export function normalizePage<T>(
  result: any,
  pageNum: number,
  pageSize: number,
): PageResult<T> {
  if (Array.isArray(result)) {
    return { list: result as T[], total: result.length, pageNum, pageSize }
  }
  const list = (result?.records ?? result?.list ?? []) as T[]
  return {
    list,
    total: Number(result?.total ?? list.length),
    pageNum: Number(result?.pageNum ?? pageNum),
    pageSize: Number(result?.pageSize ?? pageSize),
  }
}
