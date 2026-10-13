import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import axios from 'axios'
import App from './App'
import { getAccessToken } from './utils/session'
import { refreshAccessToken, LOGIN_PATH, SSO_CALLBACK_PATH } from './utils/sso'
import './index.css'

/**
 * 统一的请求层接在 axios 全局默认上，而不是新包一层。
 *
 * <p>原因很实际：10 个 `api/*.ts` 里是 40 多处裸 `axios.get/post`，逐个改成自定义实例
 * 既容易漏、又会把接口文件搅得面目全非。挂在 defaults + 拦截器上，一处生效、全部生效。</p>
 */
axios.defaults.withCredentials = true

axios.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    // 401 = 没登录或令牌过期：清掉会话并送回登录页（登录页与回跳页自身除外，否则会死循环）
    if (error?.response?.status === 401) {
      const { pathname } = window.location
      if (pathname !== LOGIN_PATH && pathname !== SSO_CALLBACK_PATH) {
        window.location.href = `${LOGIN_PATH}?redirect=${encodeURIComponent(pathname)}`
      }
    }
    return Promise.reject(error)
  },
)

/**
 * 启动时先静默续签再渲染。
 *
 * <p>访问令牌只在内存，刷新页面后必然为空 —— 若直接就渲染，已登录用户会被路由守卫
 * 弹回登录页（表现为"一刷新就掉登录"）。所以先用认证中心的 HttpOnly Cookie 换一次令牌，
 * 换不到就当未登录，正常进登录页。</p>
 */
async function bootstrap(): Promise<void> {
  await refreshAccessToken()
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>,
  )
}

void bootstrap()
