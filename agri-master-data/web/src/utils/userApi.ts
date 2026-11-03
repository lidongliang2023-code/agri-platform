/**
 * 企业端 axios 实例。
 *
 * <p>与运营端实例（`@/utils/api`）的唯一区别：额外带 `X-Agri-Merchant` 请求头。
 * 主数据后端会用**同一个令牌**回源 core-platform 校验“当前用户是否属于该主体”，
 * 通过后才把 tenant_id 写进安全上下文 —— 所以这个头只能由前端声明、由后端确认，不能当凭据用。</p>
 *
 * <p>主体 id 存在 localStorage（非凭证信息，仅标识），由 `stores/me.ts` 在加载主体后写入。</p>
 */
import axios, { type AxiosInstance, type AxiosResponse } from 'axios'
import { useSessionStore } from '@/stores/session'
import { LOGIN_PATH } from '@/utils/sso'

export interface ApiBody<T = unknown> {
  code: number
  message: string
  data: T
}

const SUCCESS_CODES = [0, 200]
const NOT_LOGGED_IN_CODE = 2006

export const MERCHANT_STORAGE_KEY = 'agri_merchant'

const request: AxiosInstance = axios.create({
  baseURL: '',
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
})

request.interceptors.request.use((config) => {
  const token = useSessionStore().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  const merchant = localStorage.getItem(MERCHANT_STORAGE_KEY)
  if (merchant) {
    config.headers['X-Agri-Merchant'] = merchant
  }
  return config
})

let redirecting = false
function gotoLogin() {
  useSessionStore().clear()
  if (redirecting) return
  redirecting = true
  if (!window.location.pathname.startsWith(LOGIN_PATH)) {
    const current = `${window.location.pathname}${window.location.search}`
    window.location.href = `${LOGIN_PATH}?redirect=${encodeURIComponent(current)}`
  }
}

request.interceptors.response.use(
  (response: AxiosResponse) => {
    const body = response.data as ApiBody<unknown> | undefined
    if (!body || typeof body !== 'object' || !('code' in body)) {
      return response.data
    }
    if (SUCCESS_CODES.includes(body.code)) {
      return { ...body, code: 200 }
    }
    if (body.code === NOT_LOGGED_IN_CODE) gotoLogin()
    return body
  },
  (error) => {
    if (error?.response?.status === 401) gotoLogin()
    return Promise.reject(error)
  },
)

function withQuery(params?: Record<string, unknown>) {
  if (!params) return undefined
  const out: Record<string, unknown> = {}
  Object.entries(params).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) out[key] = value
  })
  return out
}

export const userGet = <T = unknown>(url: string, params?: Record<string, unknown>) =>
  request.get<unknown, ApiBody<T>>(url, { params: withQuery(params) })

export const userPost = <T = unknown>(url: string, data?: unknown) =>
  request.post<unknown, ApiBody<T>>(url, data)

export const userPut = <T = unknown>(url: string, data?: unknown) =>
  request.put<unknown, ApiBody<T>>(url, data)

export const userDelete = <T = unknown>(url: string) =>
  request.delete<unknown, ApiBody<T>>(url)

export default request
