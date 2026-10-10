/**
 * axios 统一封装
 *
 * - baseURL: /api/v1/production
 * - 请求头自动注入 Authorization: Bearer <token>（取自 store/auth）
 * - 响应统一解包 { code, data, message }；code !== 0 时 toast 提示并 reject
 * - 401 未授权：清空登录态并跳转登录页
 */
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios'
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
export function toNumber(value: unknown, fallback: number): number {
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

/**
 * 分页入参的最小形状。
 *
 * 后端主参数名是 `page` / `size`，前端页面统一用 `pageNum` / `pageSize`
 * （由 PageParamAliasFilter 做等价兼容），此处两者都接受。
 */
export interface PageQueryLike {
  /** 页码，从 1 开始 */
  pageNum?: number
  /** 页码别名，与 pageNum 等价 */
  page?: number
  /** 每页条数 */
  pageSize?: number
  /** 每页条数别名，与 pageSize 等价 */
  size?: number
}

/**
 * 把「后端直接返回裸数组」的响应适配成前端统一分页结构。
 *
 * 背景：响应拦截器里的 `normalizePageData` 只认 `{ records: [...] }` 这一种
 * 分页结构，`data` 是裸数组时它原样透传，导致声明了
 * `Promise<PageResult<T>>` 的 api 函数实际返回一个数组，页面解构出的 `list`
 * 恒为 `undefined`。本函数把裸数组补成完整的 `PageResult`，使页面无需改动。
 *
 * ⚠️ 这类端点**在后端是整表全量返回、完全忽略分页入参的**（实测
 * `GET /analytics/reports?pageNum=2&pageSize=2` 仍返回全部 6 行，
 * 源码上 `AnalyticsController#reports` 只接收 `metricCode`，没有 page/size）。
 * 因此这里做的是**前端切片分页（伪分页）**：
 * - `total` / `pages` 反映后端真实的全量规模，不因切片而变小；
 * - `list` 按调用方传入的 `pageNum` / `pageSize` 切片，使「第 1 页只渲染
 *   pageSize 行、翻到第 2 页是另外一批行」成立。
 * 若不做切片，只按 pageSize 算出 `pages`，就会出现分页器显示多页、
 * 但每一页都渲染全量且内容完全相同的**假分页**。
 *
 * ⚠️ `total` 是**后端全量行数**，`list` 只是**当前页的切片** —— 两者不相等是
 * 正常现象。下游要总数请一律读 `total`，**不要用 `list.length` 代替**
 * （切片后 `list.length` ≤ pageSize，拿它当总数会静默少算）。
 *
 * 幂等：入参已经是归一化分页结构（含 `list` 数组）时原样返回，
 * 因此后端日后改成真 PageResult 也不需要改调用方。
 *
 * @param raw 接口解包后的业务数据（裸数组 / 已归一化的分页对象 / 其他）
 * @param params 本次请求的分页入参，用于回填 pageNum / pageSize 并切片
 * @returns 前端统一分页结构；无法识别时返回空分页（`list` 为空数组，不是 undefined）
 */
export function toPageResult<T>(raw: unknown, params: PageQueryLike = {}): PageData<T> {
  const pageNum = toNumber(params.pageNum ?? params.page, 1)
  const pageSize = toNumber(params.pageSize ?? params.size, 10)

  // 已经是归一化分页结构（拦截器处理过真 PageResult）：原样返回
  if (raw && typeof raw === 'object' && Array.isArray((raw as PageData<T>).list)) {
    return raw as PageData<T>
  }

  // 裸数组：后端全量返回，这里按调用方的分页入参做前端切片
  if (Array.isArray(raw)) {
    const all = raw as T[]
    const total = all.length
    // 页码小于 1 时按第 1 页处理，避免 slice 起始下标为负（slice(-n, 0) 会得到空数组）
    const safePageNum = pageNum > 0 ? pageNum : 1
    // 每页条数非正时整表即一页（不做切片）。此时 sliceSize = total，
    // 下面的 pages 会算成 1 而不是 0 —— 有数据却显示 0 页是错的。
    const sliceSize = pageSize > 0 ? pageSize : total
    const start = (safePageNum - 1) * sliceSize
    return {
      list: all.slice(start, start + sliceSize),
      total,
      pageNum: safePageNum,
      // 回传生效值而非调用方原值：整表一页时 pageSize 应为 total，
      // 否则会出现 list.length !== pageSize 的自相矛盾结构。
      pageSize: sliceSize,
      pages: sliceSize > 0 ? Math.ceil(total / sliceSize) : 0,
    }
  }

  // 无法识别（null / 非数组对象 / 异常形状）：返回空分页，绝不返回 undefined
  return { list: [], total: 0, pageNum, pageSize, pages: 0 }
}

/** 业务成功码 */
export const SUCCESS_CODE = 0

/** 登录页地址 */
const LOGIN_PATH = '/login'

/**
 * 业务域请求前缀（core-platform mod-produce）。
 *
 * `http` / 默认导出的 `request` 使用这个前缀。
 */
const PRODUCTION_BASE_URL = '/api/v1/production'

/**
 * 平台域请求前缀（core-platform mod-platform，如 `/api/v1/admin/roles`）。
 *
 * ⚠️ 平台域接口**不能**走 `http`：`http.get('/api/v1/admin/roles')` 会被 axios
 * 拼成 `/api/v1/production/api/v1/admin/roles`（axios 只有在 url 是带协议的绝对
 * URL 时才忽略 baseURL），直接 404。跨前缀请求必须用 `httpPlatform`。
 */
const PLATFORM_BASE_URL = '/api/v1/admin'

const request = axios.create({
  baseURL: PRODUCTION_BASE_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
})

/** 平台域请求实例（仅 baseURL 不同，拦截器与业务实例完全一致） */
const platformRequest = axios.create({
  baseURL: PLATFORM_BASE_URL,
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
function installRequestInterceptor(instance: AxiosInstance): void {
  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const token = useAuthStore.getState().token
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
      return config
    },
    (error: AxiosError) => Promise.reject(error),
  )
}

installRequestInterceptor(request)
installRequestInterceptor(platformRequest)

/**
 * 业务异常错误对象。
 *
 * 响应拦截器在 `code !== 0` 时 reject 的 Error 会额外挂载后端业务码与 HTTP 状态码，
 * 供调用方区分「后端收到了请求并明确拒绝」与「后端不可达 / 5xx」，
 * 从而避免无差别降级后向用户弹出与事实不符的成功提示。
 *
 * 说明：字段名用 `bizCode` 而非 `code`，避免与 axios 自身的 `AxiosError.code`
 * （字符串，如 'ERR_NETWORK'）语义混淆。
 */
export interface ApiRequestError extends Error {
  /** 后端业务码（code !== 0 时的值；网络层错误无此字段） */
  bizCode?: number
  /** HTTP 状态码（网络层错误无此字段） */
  httpStatus?: number
}

/**
 * 判断一个未知错误是否为「后端业务拒绝」（请求已到达服务端且被明确拒绝）。
 *
 * @param error catch 到的未知错误
 * @returns 是业务拒绝错误时返回带 bizCode 的错误对象，否则返回 null
 */
export function asApiRequestError(error: unknown): ApiRequestError | null {
  if (!error || typeof error !== 'object') {
    return null
  }
  const candidate = error as ApiRequestError
  return typeof candidate.bizCode === 'number' ? candidate : null
}

/**
 * 读取错误的 HTTP 状态码（无响应时返回 0）。
 *
 * @param error catch 到的未知错误
 * @returns HTTP 状态码，取不到时为 0
 */
export function httpStatusOf(error: unknown): number {
  if (!error || typeof error !== 'object') {
    return 0
  }
  const status = (error as { response?: { status?: number } }).response?.status
  return typeof status === 'number' ? status : 0
}

/**
 * 取写操作失败时展示给用户的原因文案。
 *
 * 写操作（新增 / 编辑 / 启停 / 删除 / 处置 / 忽略…）失败时必须把原因透传给用户：
 * "写失败却提示已保存"是本轮最严禁的一类问题，而"失败但不说原因"同样让人无法
 * 判断是网络断了还是数据被拒。拿不到原因时返回占位文案，**绝不编造**具体原因。
 *
 * 原来在 `pages/user/alerts/AlertRules.tsx` 与 `AlertCenter.tsx` 各留了一份私有副本，
 * 出现第三处之前上提到这里，避免同一个函数散落多份。
 *
 * 需要更结构化的失败信息（业务码 / HTTP 状态）时用 {@link asApiRequestError}
 * 与 {@link httpStatusOf}，本函数只负责给出一句能直接展示的中文文案。
 *
 * @param error catch 到的未知错误
 * @returns 用于展示的原因文案
 */
export function errorMessageOf(error: unknown): string {
  return error instanceof Error && error.message ? error.message : '未知错误（后端未返回原因）'
}

/** 响应拦截：解包 + 统一错误处理 */
function installResponseInterceptor(instance: AxiosInstance): void {
  instance.interceptors.response.use(
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

    // 业务码挂载到 Error 上：调用方据此区分「明确拒绝」与「不可达」，避免无差别降级说假话
    const failure = new Error(body.message || '请求失败') as ApiRequestError
    failure.bizCode = body.code
    failure.httpStatus = response.status

    if (!silent) {
      message.error(body.message || '请求失败，请稍后重试')
    }
    return Promise.reject(failure)
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
}

installResponseInterceptor(request)
installResponseInterceptor(platformRequest)

/** 查询参数类型：任意键值对对象 */
export type QueryParams = object

/**
 * 类型安全的 HTTP 方法集合。
 * 泛型 T 为「解包后的业务数据类型」，调用方无需再取 res.data。
 */
/**
 * 按实例构造类型安全的 HTTP 方法集合。
 *
 * 泛型 T 为「解包后的业务数据类型」，调用方无需再取 res.data。
 *
 * @param instance axios 实例
 * @returns HTTP 方法集合
 */
function createHttpMethods(instance: AxiosInstance) {
  return {
    /** GET 请求 */
    get<T>(url: string, params?: QueryParams, config?: RequestOptions): Promise<T> {
      return instance.get<unknown, T>(url, { params, ...config })
    },
    /** POST 请求 */
    post<T>(url: string, data?: unknown, config?: RequestOptions): Promise<T> {
      return instance.post<unknown, T>(url, data, config)
    },
    /** PUT 请求（全量更新） */
    put<T>(url: string, data?: unknown, config?: RequestOptions): Promise<T> {
      return instance.put<unknown, T>(url, data, config)
    },
    /** PATCH 请求（部分更新） */
    patch<T>(url: string, data?: unknown, config?: RequestOptions): Promise<T> {
      return instance.patch<unknown, T>(url, data, config)
    },
    /** DELETE 请求 */
    delete<T>(url: string, params?: Record<string, unknown>, config?: RequestOptions): Promise<T> {
      return instance.delete<unknown, T>(url, { params, ...config })
    },
  }
}

/** 业务域 HTTP 方法集合（baseURL `/api/v1/production`） */
export const http = createHttpMethods(request)

/** 平台域 HTTP 方法集合（baseURL `/api/v1/admin`）：跨前缀接口走这里，勿用 http */
export const httpPlatform = createHttpMethods(platformRequest)

export default request
