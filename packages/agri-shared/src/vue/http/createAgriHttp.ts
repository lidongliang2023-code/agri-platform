import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios'

export interface AgriHttpOptions {
  baseURL?: string
  timeout?: number
  getToken?: () => string | null | undefined
  onUnauthorized?: (error: AxiosError) => void
  /** 是否在请求头注入 X-Requested-With / 自定义头 */
  headers?: Record<string, string>
}

export interface ApiEnvelope<T = unknown> {
  code: number
  message?: string
  data: T
}

export function extractApiErrorMessage(err: unknown, fallback = '请求失败，请稍后重试'): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string; error?: string } | undefined
    if (data?.message) return data.message
    if (data?.error) return data.error
    if (err.message) return err.message
  }
  if (err instanceof Error && err.message) return err.message
  return fallback
}

/**
 * 统一创建 Axios 1.x 实例：自动注入 Bearer Token，统一处理 401 回调。
 */
export function createAgriHttp(options: AgriHttpOptions = {}): AxiosInstance {
  const client = axios.create({
    baseURL: options.baseURL ?? '',
    timeout: options.timeout ?? 20_000,
    headers: options.headers,
  })

  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = options.getToken?.()
    if (token && !config.headers?.Authorization) {
      config.headers = config.headers ?? ({} as InternalAxiosRequestConfig['headers'])
      config.headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`
    }
    return config
  })

  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.response?.status === 401) {
        options.onUnauthorized?.(error)
      }
      return Promise.reject(error)
    },
  )

  return client
}

/** 解包标准 `{ code, data, message }` 响应体（兼容直接返回业务对象）。 */
export async function requestData<T>(
  client: AxiosInstance,
  config: AxiosRequestConfig,
): Promise<T> {
  const response = await client.request<ApiEnvelope<T> | T>(config)
  const body = response.data
  if (body && typeof body === 'object' && 'code' in body && 'data' in body) {
    const envelope = body as ApiEnvelope<T>
    if (envelope.code !== 0 && envelope.code !== 200) {
      throw new Error(envelope.message || `请求失败（code=${envelope.code}）`)
    }
    return envelope.data
  }
  return body as T
}
