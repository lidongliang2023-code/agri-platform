/**
 * 主数据运营端 API 客户端。
 *
 * <p><b>本文件的路径不是"按接口名猜的"，而是逐条抄自后端真实注册的映射</b>
 * （`com.agri.admin.controller.*` 的 `@RequestMapping` + 方法注解）。
 * 之前的版本有一半路径不存在，例如用 `/admin/masterdata/tenant` 当列表、
 * 用 `/user/audit` 当认证审核、用 `/data-standard/dict` 当字典 —— 全都是 500 或 404。</p>
 *
 * <p><b>三处约定必须与后端一致，否则"看着对、实际查不到"：</b></p>
 * <ol>
 *   <li>分页参数名是 <b>`pageNum` / `pageSize`</b>（不是 `page` / `size`，也不是 `offset` / `limit`）。
 *       页面里两种写法都有，这里统一归一化。</li>
 *   <li>状态类接口的参数走 <b>query</b>（`@RequestParam`），不是请求体。写成 body 会被判 400 缺参。</li>
 *   <li>响应成功码：平台侧（认证/SSO）是 <b>0</b>，主数据业务侧是 <b>200</b>。
 *       这里统一收敛成 200，页面只需判断一种。</li>
 * </ol>
 */
import axios, { type AxiosInstance, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { useSessionStore } from '@/stores/session'
import { LOGIN_PATH } from '@/utils/sso'

/** 统一响应体（主数据业务侧形态：code/message/data） */
export interface ApiBody<T = unknown> {
  code: number
  message: string
  data: T
  traceId?: string | null
}

/** 分页结果（后端 PageResult 的序列化形态） */
export interface PageResult<T> {
  list: T[]
  total: number
  pageNum: number
  pageSize: number
  pages: number
}

/** 成功码：主数据业务侧 200，平台侧（core-platform）0 */
const SUCCESS_CODES = [0, 200]

/** 业务码：未登录 / 令牌无效 —— 两者都要回登录页，而不是在页面上弹个提示就算 */
const NOT_LOGGED_IN_CODE = 2006

/** 列表查询入参：任意筛选条件 + 分页 */
export type QueryParams = Record<string, unknown>

/**
 * 归一化查询参数。
 *
 * <p>三件事，每一件都对应一类真实故障：</p>
 * <ul>
 *   <li>`page`/`size` → `pageNum`/`pageSize`：后端只认后者，传错了会静默用默认值（第 1 页、10 条），
 *       表现为"翻页没反应"；</li>
 *   <li>丢掉 `''`/`null`/`undefined`：空串筛选值会被后端当成"有筛选条件"，
 *       例如 `status=''` 会拼出 `status = ''`，结果是**一条都查不出来**；</li>
 *   <li>保留其余筛选名（`keyword`、`tenantId` 等）由调用方与后端对齐。</li>
 * </ul>
 */
function normalizeQuery(params?: QueryParams): QueryParams | undefined {
  if (!params) {
    return undefined
  }
  const { page, size, ...rest } = params as QueryParams & { page?: unknown; size?: unknown }
  const out: QueryParams = { ...rest }
  if (out.pageNum === undefined && page !== undefined && page !== null && page !== '') {
    out.pageNum = page
  }
  if (out.pageSize === undefined && size !== undefined && size !== null && size !== '') {
    out.pageSize = size
  }
  Object.keys(out).forEach((key) => {
    const value = out[key]
    if (value === '' || value === null || value === undefined) {
      delete out[key]
    }
  })
  return out
}

const request: AxiosInstance = axios.create({
  // 路径本身就是以 /admin/masterdata 开头的绝对路径，再加 baseURL 会拼出
  // /api/admin/masterdata/... 这种后端不存在的地址（这正是上一版 500 的直接原因）。
  baseURL: '',
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
})

request.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useSessionStore().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/** 清理本地登录态并跳登录页（同一时刻只跳一次，避免并发 401 把页面弹来弹去） */
let redirecting = false
function gotoLogin(): void {
  useSessionStore().clear()
  if (redirecting) {
    return
  }
  redirecting = true
  if (!window.location.pathname.startsWith(LOGIN_PATH)) {
    // 带上当前页面：从“认证审核”被 401 弹去登录后，登录成功要回到审核页，而不是统一回首页。
    const current = `${window.location.pathname}${window.location.search}`
    window.location.href = `${LOGIN_PATH}?redirect=${encodeURIComponent(current)}`
  }
}

request.interceptors.response.use(
  (response: AxiosResponse) => {
    const body = response.data as ApiBody<unknown> | undefined

    // 非包装体（文件流、第三方）原样透传
    if (!body || typeof body !== 'object' || !('code' in body)) {
      return response.data
    }

    if (SUCCESS_CODES.includes(body.code)) {
      // 把平台侧的 0 归一成 200，页面只需判断一种成功码
      return { ...body, code: 200 }
    }

    if (body.code === NOT_LOGGED_IN_CODE) {
      gotoLogin()
    }
    // 业务失败仍然**返回响应体而不是抛异常**：页面需要在原地区分
    // "后端明确拒绝"与"后端不可达"，抛异常会让两者在外层混成同一个 catch。
    return body
  },
  (error) => {
    if (error?.response?.status === 401) {
      gotoLogin()
    }
    return Promise.reject(error)
  },
)

/** GET：查询参数经归一化后再发 */
function get<T = unknown>(url: string, params?: QueryParams): Promise<ApiBody<T>> {
  return request.get<unknown, ApiBody<T>>(url, { params: normalizeQuery(params) })
}

/** POST / PUT：写操作。params 用于 `@RequestParam` 形态的端点（状态类接口都是这种）。 */
function post<T = unknown>(url: string, data?: unknown, params?: QueryParams): Promise<ApiBody<T>> {
  return request.post<unknown, ApiBody<T>>(url, data, { params: normalizeQuery(params) })
}

function put<T = unknown>(url: string, data?: unknown, params?: QueryParams): Promise<ApiBody<T>> {
  return request.put<unknown, ApiBody<T>>(url, data, { params: normalizeQuery(params) })
}

function del<T = unknown>(url: string, params?: QueryParams): Promise<ApiBody<T>> {
  return request.delete<unknown, ApiBody<T>>(url, { params: normalizeQuery(params) })
}

const BASE = '/admin/masterdata'

/* ---------------------------------- 运营总览 ---------------------------------- */

export const getDashboard = (params?: QueryParams) => get(`${BASE}/dashboard`, params)
export const getDashboardHealth = () => get(`${BASE}/dashboard/health`)
export const getTenantActivity = (limit = 10) => get(`${BASE}/dashboard/tenant-activity`, { limit })
export const getDashboardAlerts = (limit = 5) => get(`${BASE}/dashboard/alerts`, { limit })
export const getPendingAudit = () => get(`${BASE}/dashboard/pending-audit`)

/* ---------------------------------- 主体管理 ---------------------------------- */

export const getTenantList = (params?: QueryParams) => get(`${BASE}/subject/list`, params)
export const getTenantDetail = (id: number | string) => get(`${BASE}/subject/detail/${id}`)
export const createTenant = (data: unknown) => post(`${BASE}/subject`, data)
export const updateTenant = (id: number | string, data: unknown) => put(`${BASE}/subject/${id}`, data)
export const deleteTenant = (id: number | string) => del(`${BASE}/subject/${id}`)
/** 启停经营主体：后端接收 JSON 请求体 `{ status }`。 */
export const updateTenantStatus = (id: number | string, status: number | string) =>
  put(`${BASE}/subject/${id}/status`, { status })
export const getTenantQuota = (id: number | string) => get(`${BASE}/subject/${id}/quota`)
/**
 * 配额总览（经营主体 + 其配额用量，一行一个主体）。
 *
 * <p>存储字段单位是**字节**，与 `TenantPackageVO` 一致；页面按 GB 展示时自行换算。</p>
 */
export const getTenantQuotaOverview = (params?: QueryParams) =>
  get(`${BASE}/subject/quota/list`, params)
export const adjustTenantQuota = (id: number | string, data: unknown) =>
  put(`${BASE}/subject/${id}/quota`, data)
export const setTenantQuotaAlertThreshold = (id: number | string, threshold: number) =>
  put(`${BASE}/subject/${id}/quota/alert-threshold`, null, { threshold })
export const getTenantPackageList = () => get(`${BASE}/subject/package/list`)
export const createTenantPackage = (data: unknown) => post(`${BASE}/subject/package`, data)
export const updateTenantPackage = (id: number | string, data: unknown) =>
  put(`${BASE}/subject/package/${id}`, data)
export const deleteTenantPackage = (id: number | string) => del(`${BASE}/subject/package/${id}`)
export const getTenantStatistics = (params?: QueryParams) => get(`${BASE}/subject/statistics`, params)
export const getTenantStatisticsSummary = () => get(`${BASE}/subject/statistics/summary`)

/* ---------------------------------- 用户管理 ---------------------------------- */

export const getUserList = (params?: QueryParams) => get(`${BASE}/user/list`, params)
export const getUserDetail = (id: number | string) => get(`${BASE}/user/detail/${id}`)
export const createUser = (data: unknown) => post(`${BASE}/user`, data)
export const updateUser = (id: number | string, data: unknown) => put(`${BASE}/user/${id}`, data)
export const deleteUser = (id: number | string) => del(`${BASE}/user/${id}`)
/**
 * 改用户状态。
 *
 * <p>后端参数名是 `userStatus`（String），不是 `status`，而且走 query。
 * 传错名字会得到 400「缺少必需的请求参数」——这类报错在页面上只表现为"操作失败"，
 * 不看后端签名很难定位。</p>
 */
export const changeStatus = (id: number | string, userStatus: number | string) =>
  put(`${BASE}/user/${id}/status`, null, { userStatus })
export const getUserAuditList = (params?: QueryParams) => get(`${BASE}/user/cert-audit`, params)
export const reviewUserCert = (id: number | string, data: unknown) =>
  put(`${BASE}/user/cert-audit/${id}`, data)

/* ---------------------------------- 组织管理 ---------------------------------- */

export const getOrgList = (params?: QueryParams) => get(`${BASE}/org/list`, params)
export const getOrgTree = (tenantId?: string) => get(`${BASE}/org/tree`, { tenantId })
export const getOrgDetail = (id: number | string) => get(`${BASE}/org/detail/${id}`)
export const createOrg = (data: unknown) => post(`${BASE}/org`, data)
export const updateOrg = (id: number | string, data: unknown) => put(`${BASE}/org/${id}`, data)
export const deleteOrg = (id: number | string) => del(`${BASE}/org/${id}`)
export const getOrgAuditList = (params?: QueryParams) => get(`${BASE}/org/cert-audit`, params)
export const reviewOrgCert = (id: number | string, authStatus: string, auditNote?: string) =>
  put(`${BASE}/org/cert-audit/${id}`, null, { authStatus, auditNote })

/* ---------------------------------- 权限审计 ---------------------------------- */

export const getRoleList = (params?: QueryParams) => get(`${BASE}/permission/role/list`, params)
export const getRoleDetail = (id: number | string) => get(`${BASE}/permission/role/${id}`)
export const createRole = (data: unknown) => post(`${BASE}/permission/role`, data)
export const updateRole = (id: number | string, data: unknown) =>
  put(`${BASE}/permission/role/${id}`, data)
export const deleteRole = (id: number | string) => del(`${BASE}/permission/role/${id}`)
export const getPermissionStatistics = (params?: QueryParams) =>
  get(`${BASE}/permission/statistics`, params)
/** 权限变更日志 */
export const getPermissionChangeLogs = (params?: QueryParams) =>
  get(`${BASE}/permission/change-log`, params)
export const getPermissionAnomaly = (params?: QueryParams) =>
  get(`${BASE}/permission/anomaly`, params)
/** 操作日志（对应页面 /permission/log） */
export const getOperationLogs = (params?: QueryParams) =>
  get(`${BASE}/permission/operation-log`, params)

/* ---------------------------------- 数据标准 ---------------------------------- */

export const getDictList = (params?: QueryParams) => get(`${BASE}/standard/dict/list`, params)
export const getDictDetail = (id: number | string) => get(`${BASE}/standard/dict/${id}`)
export const createDict = (data: unknown) => post(`${BASE}/standard/dict`, data)
export const updateDict = (id: number | string, data: unknown) =>
  put(`${BASE}/standard/dict/${id}`, data)
export const deleteDict = (id: number | string) => del(`${BASE}/standard/dict/${id}`)
export const createDictItem = (dictId: number | string, data: unknown) =>
  post(`${BASE}/standard/dict/${dictId}/item`, data)
export const updateDictItem = (itemId: number | string, data: unknown) =>
  put(`${BASE}/standard/dict/item/${itemId}`, data)
export const deleteDictItem = (itemId: number | string) =>
  del(`${BASE}/standard/dict/item/${itemId}`)

export const getCodeRuleList = (params?: QueryParams) => get(`${BASE}/standard/code-rule/list`, params)
export const getCodeRuleDetail = (id: number | string) => get(`${BASE}/standard/code-rule/${id}`)
export const createCodeRule = (data: unknown) => post(`${BASE}/standard/code-rule`, data)
export const updateCodeRule = (id: number | string, data: unknown) =>
  put(`${BASE}/standard/code-rule/${id}`, data)
export const deleteCodeRule = (id: number | string) => del(`${BASE}/standard/code-rule/${id}`)
export const testCodeRule = (id: number | string, data?: unknown) =>
  post(`${BASE}/standard/code-rule/${id}/test`, data)

export const getDataFormatList = (params?: QueryParams) => get(`${BASE}/standard/format/list`, params)
export const createDataFormat = (data: unknown) => post(`${BASE}/standard/format`, data)
export const getChangeApproveList = (params?: QueryParams) =>
  get(`${BASE}/standard/change-approve`, params)
export const approveStandardChange = (id: number | string, status: string, remark?: string) =>
  put(`${BASE}/standard/change-approve/${id}`, null, { status, remark })

/* ---------------------------------- 数据质量 ---------------------------------- */

export const getQualityList = (params?: QueryParams) => get(`${BASE}/quality/issues`, params)
export const getQualityDetail = (id: number | string) => get(`${BASE}/quality/issues/${id}`)
/** 手工登记质量问题（问题编码由服务端生成） */
export const createQualityIssue = (data: unknown) => post(`${BASE}/quality/issues`, data)
/**
 * 处置质量问题。
 *
 * <p>后端签名是 `@RequestParam String status, @RequestParam String remark`——
 * `status` 是**必填**，缺了直接 400。所以这里要求调用方明确给出 `status`，
 * 不接受"把一句处理结论当状态"的模糊映射（那会把业务状态写成自由文本）。</p>
 */
export const handleQualityIssue = (
  id: number | string,
  payload: { status: string; remark?: string },
) => put(`${BASE}/quality/issues/${id}/handle`, null, { status: payload.status, remark: payload.remark })
export const batchHandleQualityIssues = (ids: string, status: string, remark?: string) =>
  put(`${BASE}/quality/issues/batch-handle`, null, { ids, status, remark })
export const getQualityStatistics = (params?: QueryParams) =>
  get(`${BASE}/quality/statistics`, params)
export const getQualityTrend = (params?: QueryParams) => get(`${BASE}/quality/trend`, params)

/* ------------------------------- 质量规则 / 任务 ------------------------------- */

export const getQualityRuleList = (params?: QueryParams) => get(`${BASE}/quality/rules`, params)
export const createQualityRule = (data: unknown) => post(`${BASE}/quality/rules`, data)
export const updateQualityRule = (id: number | string, data: unknown) =>
  put(`${BASE}/quality/rules/${id}`, data)
export const deleteQualityRule = (id: number | string) => del(`${BASE}/quality/rules/${id}`)

export const getQualityTaskList = (params?: QueryParams) => get(`${BASE}/quality/tasks`, params)
export const createQualityTask = (data: unknown) => post(`${BASE}/quality/tasks`, data)
export const updateQualityTask = (id: number | string, data: unknown) =>
  put(`${BASE}/quality/tasks/${id}`, data)
export const deleteQualityTask = (id: number | string) => del(`${BASE}/quality/tasks/${id}`)
/** 手工触发一次巡检（不是真实规则计算，检测引擎尚未实现） */
export const runQualityTask = (id: number | string) => post(`${BASE}/quality/tasks/${id}/run`)

/* ---------------------------------- 数据分发 ---------------------------------- */

export const getDistributionList = (params?: QueryParams) =>
  get(`${BASE}/distribution/tasks`, params)
export const getDistributionDetail = (id: number | string) =>
  get(`${BASE}/distribution/tasks/${id}`)
export const retryDistribution = (id: number | string) =>
  post(`${BASE}/distribution/tasks/${id}/retry`)
export const pauseDistribution = (id: number | string) =>
  post(`${BASE}/distribution/tasks/${id}/pause`)
export const resumeDistribution = (id: number | string) =>
  post(`${BASE}/distribution/tasks/${id}/resume`)
export const getDistributionStatistics = (params?: QueryParams) =>
  get(`${BASE}/distribution/statistics`, params)
export const getDistributionTrend = (params?: QueryParams) =>
  get(`${BASE}/distribution/trend`, params)
export const getDistributionTargetSystems = () => get(`${BASE}/distribution/target-systems`)

/* ---------------------------------- 商品管理 ---------------------------------- */

export const getProductList = (params?: QueryParams) => get(`${BASE}/product/list`, params)
export const getProductDetail = (id: number | string) => get(`${BASE}/product/detail/${id}`)
export const createProduct = (data: unknown) => post(`${BASE}/product`, data)
export const updateProduct = (id: number | string, data: unknown) =>
  put(`${BASE}/product/${id}`, data)
export const deleteProduct = (id: number | string) => del(`${BASE}/product/${id}`)
export const updateProductStatus = (id: number | string, status: string) =>
  put(`${BASE}/product/${id}/status`, null, { status })
export const getProductStatistics = (params?: QueryParams) =>
  get(`${BASE}/product/statistics`, params)

/* ------------------------ 官网上架商品（交易域真实商品） ------------------------ */

const TRADE_PRODUCT_BASE = '/api/trade/admin/product'

export const getTradeProductManageList = (params?: QueryParams) =>
  get(`${TRADE_PRODUCT_BASE}/manage/page`, params)
export const getTradeProductManageDetail = (id: number | string) =>
  get(`${TRADE_PRODUCT_BASE}/manage/${id}`)
export const createTradeProduct = (data: unknown) => post(TRADE_PRODUCT_BASE, data)
export const updateTradeProduct = (id: number | string, data: unknown) =>
  put(`${TRADE_PRODUCT_BASE}/manage/${id}`, data)
export const updateTradeProductStatus = (id: number | string, status: number) =>
  put(`${TRADE_PRODUCT_BASE}/manage/${id}/status`, null, { status })
export const getTradeCategoryOptions = () => get('/api/trade/product/category/list')
export const getTradeSellerOptions = () =>
  get(`${TRADE_PRODUCT_BASE}/manage/page`, { pageNum: 1, pageSize: 100 })
export const uploadTradeProductImage = (file: File) => {
  const data = new FormData()
  data.append('file', file)
  return request.post<unknown, ApiBody<{ url: string; originalName?: string }>>(
    `${TRADE_PRODUCT_BASE}/image`,
    data,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
}

/* -------------------------------- 客户 / 供应商 -------------------------------- */

export const getCustomerList = (params?: QueryParams) => get(`${BASE}/customer/list`, params)
export const getCustomerDetail = (id: number | string) => get(`${BASE}/customer/detail/${id}`)
export const createCustomer = (data: unknown) => post(`${BASE}/customer`, data)
export const updateCustomer = (id: number | string, data: unknown) =>
  put(`${BASE}/customer/${id}`, data)
export const deleteCustomer = (id: number | string) => del(`${BASE}/customer/${id}`)
export const getCustomerStatistics = (params?: QueryParams) =>
  get(`${BASE}/customer/statistics`, params)
export const getCustomerSupplierRelation = (customerId: number | string) =>
  get(`${BASE}/customer/relation/${customerId}`)

export const getSupplierList = (params?: QueryParams) =>
  get(`${BASE}/customer/supplier/list`, params)
export const getSupplierDetail = (id: number | string) =>
  get(`${BASE}/customer/supplier/detail/${id}`)
export const createSupplier = (data: unknown) => post(`${BASE}/customer/supplier`, data)
export const updateSupplier = (id: number | string, data: unknown) =>
  put(`${BASE}/customer/supplier/${id}`, data)
export const deleteSupplier = (id: number | string) => del(`${BASE}/customer/supplier/${id}`)

/* ---------------------------------- 系统配置 ---------------------------------- */

export const getSystemConfigList = () => get(`${BASE}/config/list`)
export const createSystemConfig = (data: unknown) => post(`${BASE}/config`, data)
export const getSystemConfig = (id: number | string) => get(`${BASE}/config/${id}`)
export const getSystemConfigByKey = (configKey: string) => get(`${BASE}/config/value/${configKey}`)
export const updateSystemConfig = (id: number | string, data: unknown) =>
  put(`${BASE}/config/${id}`, data)
export const batchUpdateSystemConfig = (data: unknown) => put(`${BASE}/config/batch`, data)
export const deleteSystemConfig = (id: number | string) => del(`${BASE}/config/${id}`)

export default request
