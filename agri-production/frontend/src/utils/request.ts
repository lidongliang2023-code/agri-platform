/**
 * axios 统一封装
 *
 * - baseURL: /api/v1/production
 * - 请求头自动注入 Authorization: Bearer <token>（取自 store/auth）
 * - 响应统一解包 { code, data, message }；code !== 0 时 toast 提示并 reject
 * - 401 未授权：清空登录态并跳转登录页
 */
import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios'
import { message } from 'antd'
import useAuthStore from '@/store/auth'

/** 后端统一响应包装体（shared-kernel ApiResponse） */
export interface ApiResult<T> {
  /** 0 表示成功，非 0 表示业务异常 */
  code: number
  /** 业务数据 */
  data: T
  /** 提示信息 */
  message: string
  /** 链路追踪 ID，排查问题时提供 */
  traceId?: string
}

/**
 * 后端分页原始结构（shared-kernel PageResult）
 * 注意：平台全局契约为 records/total/page/size，前端统一消费 list/pageNum/pageSize/pages。
 *
 * ⚠️ 实测（POST /api/v1/auth/login 登录后直连 core-app :8099）：
 * 后端把 total / page / size 序列化成了**字符串**，例如
 * `{"records":[],"total":"0","page":"2","size":"7"}`。
 * 因此类型标注为 number 只是「语义类型」，运行时可能是 string，
 * 归一化时必须经过 toNumber 强转，否则会把 string 泄漏给调用方（AntD Pagination 收到 "12"）。
 */
interface RawPageResult<T> {
  /** 数据列表 */
  records: T[]
  /** 总条数（运行时可能是字符串） */
  total: number
  /** 当前页码，从 1 开始（运行时可能是字符串） */
  page: number
  /** 每页条数（运行时可能是字符串） */
  size: number
}

/** 前端统一分页结构 */
export interface PageData<T> {
  /** 数据列表 */
  list: T[]
  /** 总条数 */
  total: number
  /** 当前页码，从 1 开始 */
  pageNum: number
  /** 每页条数 */
  pageSize: number
  /** 总页数 */
  pages: number
}

/**
 * 把「可能是字符串的数字」安全转成 number。
 *
 * 后端分页字段实测返回字符串（如 total: "12"），直接用会让 TS 声明与运行时不一致。
 * @param value 原始值（number / 数字字符串 / null / undefined）
 * @param fallback 无法解析时使用的兜底值
 * @returns 解析后的有限数字
 */
function toNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

/**
 * 将后端分页结构归一化为前端统一结构。
 * 非分页数据（无 records 数组）原样返回，不做任何改写。
 *
 * @param data 后端返回的业务数据
 * @returns 归一化后的数据（total / pageNum / pageSize / pages 均为真正的 number）
 */
function normalizePageData<T>(data: unknown): T | PageData<T> {
  if (data && typeof data === 'object' && Array.isArray((data as RawPageResult<T>).records)) {
    const raw = data as RawPageResult<T>
    const list = raw.records
    const total = toNumber(raw.total, list.length)
    const pageSize = toNumber(raw.size, list.length || 1)
    const pageNum = toNumber(raw.page, 1)
    return {
      list,
      total,
      pageNum,
      pageSize,
      pages: pageSize > 0 ? Math.ceil(total / pageSize) : 0,
    }
  }
  return data as T
}

/** 业务成功码 */
export const SUCCESS_CODE = 0

/** 登录页地址 */
const LOGIN_PATH = '/login'

const request = axios.create({
  baseURL: '/api/v1/production',
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
})

/** 扩展请求配置：是否静默失败（不弹全局错误提示） */
export interface RequestOptions extends AxiosRequestConfig {
  silent?: boolean
}

/** 请求拦截：注入 token */
request.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error: AxiosError) => Promise.reject(error),
)

/** 响应拦截：解包 + 统一错误处理 */
request.interceptors.response.use(
  (response) => {
    const body = response.data as ApiResult<unknown> | undefined
    const silent = (response.config as RequestOptions)?.silent === true

    // 非标准包装体（如文件流、第三方接口）直接透传
    if (!body || typeof body !== 'object' || !('code' in body)) {
      return response.data
    }

    if (body.code === SUCCESS_CODE) {
      return normalizePageData(body.data)
    }

    if (!silent) {
      message.error(body.message || '请求失败，请稍后重试')
    }
    return Promise.reject(new Error(body.message || '请求失败'))
  },
  (error: AxiosError<ApiResult<unknown>>) => {
    const status = error.response?.status
    const silent = (error.config as RequestOptions)?.silent === true

    if (status === 401) {
      useAuthStore.getState().logout()
      if (!window.location.pathname.startsWith(LOGIN_PATH)) {
        window.location.href = LOGIN_PATH
      }
      return Promise.reject(new Error('登录已失效，请重新登录'))
    }

    if (!silent) {
      const bizMessage = error.response?.data?.message
      message.error(bizMessage || error.message || '网络异常，请稍后重试')
    }
    return Promise.reject(error)
  },
)

/** 查询参数类型：任意键值对对象 */
export type QueryParams = object

/**
 * 类型安全的 HTTP 方法集合。
 * 泛型 T 为「解包后的业务数据类型」，调用方无需再取 res.data。
 */
export const http = {
  /** GET 请求 */
  get<T>(url: string, params?: QueryParams, config?: RequestOptions): Promise<T> {
    return request.get<unknown, T>(url, { params, ...config })
  },
  /** POST 请求 */
  post<T>(url: string, data?: unknown, config?: RequestOptions): Promise<T> {
    return request.post<unknown, T>(url, data, config)
  },
  /** PUT 请求（全量更新） */
  put<T>(url: string, data?: unknown, config?: RequestOptions): Promise<T> {
    return request.put<unknown, T>(url, data, config)
  },
  /** PATCH 请求（部分更新） */
  patch<T>(url: string, data?: unknown, config?: RequestOptions): Promise<T> {
    return request.patch<unknown, T>(url, data, config)
  },
  /** DELETE 请求 */
  delete<T>(url: string, params?: Record<string, unknown>, config?: RequestOptions): Promise<T> {
    return request.delete<unknown, T>(url, { params, ...config })
  },
}

export default request
