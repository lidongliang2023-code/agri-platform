import axios from 'axios'

/**
 * 运营端 axios 实例之一：`baseURL: '/api'`，调用方传**相对**路径。
 *
 * <p>例：`request.get('/v1/admin/user-identities')` → 实际 `/api/v1/admin/user-identities`。</p>
 *
 * <p><b>注意本项目有两个实例，前缀规则正好相反</b>，改代码前先看 import 的是哪个：</p>
 * <ul>
 *   <li>本文件 `@/utils/request` —— baseURL 为 `/api`，路径**不要**再带 `/api`；</li>
 *   <li>`@/utils/api` —— baseURL 为 `''`，路径**必须**自带完整前缀
 *       （如 `/admin/masterdata/...`、`/api/v1/admin/...`），
 *       `certification.ts` / `tradeCatalog.ts` 用的是它。</li>
 * </ul>
 *
 * <p>搞错的后果不是 404，而是 **HTTP 200 + body.code=500**：axios 做的是字符串拼接而非
 * URL 解析，`'/api'` + `'/api/v1/admin/x'` 得到 `/api/api/v1/admin/x`，网关把它兜底转给
 * 了别的上游，页面只看到"加载失败"。这类故障排查成本很高，本项目已踩过三次。</p>
 */
const request = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

request.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

request.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export default request
