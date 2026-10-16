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

// #ifdef H5
/** H5：同源（开发期由 vite proxy 反代到 nginx 网关） */
const BASE_URL = ''
// #endif
// #ifndef H5
/** 小程序 / App：必须绝对地址 */
const BASE_URL = 'http://localhost'
// #endif

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

/** 清空登录态并回登录页（401 时调用一次，避免多请求并发时反复跳转） */
let redirecting = false
function handleUnauthorized(): void {
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
export function request<T = any>(options: RequestOptions): Promise<T> {
  const url = `${BASE_URL}${options.url}${toQuery(options.params)}`
  const header: Record<string, string> = { 'Content-Type': 'application/json' }
  if (options.auth !== false) {
    const token = uni.getStorageSync(TOKEN_KEY)
    if (token) header.Authorization = `Bearer ${token}`
  }
  return new Promise<T>((resolve, reject) => {
    uni.request({
      url,
      method: options.method || 'GET',
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
          reject(new Error(`请求失败（HTTP ${res.statusCode}）`))
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
