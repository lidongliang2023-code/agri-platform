/**
 * 应用入口（Vue 3）—— 回归 PRD §15.1 的选型：Vue 3.4 + TS + Vite + Ant Design Vue + Pinia。
 *
 * 挂载点仍是 index.html 里的 #root；React 版入口 main.tsx 暂时保留在仓库里（可回退），
 * 但 index.html 待切换为加载本文件 —— 两者不可能同时是入口，切换必须是一次明确的替换。
 */
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
// 平台设计令牌：与其它子系统同一个品牌来源（框架无关的 CSS 变量投影）
import '@agri/shared/tokens/tokens.css'
import './index.css'
import App from './App.vue'
import router from './router'
import { useSessionStore } from './stores/session'
import { LOGIN_PATH } from './utils/sso'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)
app.use(Antd)

/**
 * 挂载前先跑一次启动续签。
 *
 * <p>访问令牌只在内存，刷新页面后必然为空；先拿 HttpOnly Cookie 换回来再挂载，
 * 路由守卫看到的才是真实登录态。否则已登录用户刷新页面会被误判成未登录而弹回登录页。
 * 无论续签成功还是失败都必须出结果，所以这里 await —— 失败时 store 会置 ready，
 * 页面照常渲染，由守卫把用户送到登录页。</p>
 *
 * <p><b>为什么用 `.finally()` 而不是顶层 `await`</b>：构建目标（es2020）不支持顶层 await，
 * 写 `await` 会让 `vite build` 直接失败（Top-level await is not available in the
 * configured target environment）。改用 Promise 链既不需要抬高构建目标、
 * 不缩小浏览器支持面，也保证成功与失败都会挂载 —— 失败时 store 已置 ready，
 * 页面照常渲染，再由守卫把用户送到登录页。</p>
 */
const session = useSessionStore()
void session.bootstrap().finally(() => {
  app.mount('#root')

  /*
   * 首屏导航发生在 bootstrap 之前 —— `app.use(router)` 的 install 会立刻触发一次导航，
   * 那时 ready 还是 false，守卫按设计放行（否则会把已登录用户误判成未登录）。
   * 于是"续签结果是未登录"这种情况必须在这里补一次跳转：少了它，会话过期的用户
   * 会停在**一个全是空值的总览页**上，而不是被送到登录页 —— 页面看起来"能用"，实际什么都没查到。
   */
  const current = router.currentRoute.value
  if (!session.isLoggedIn && current.meta.public !== true) {
    void router.replace({ path: LOGIN_PATH, query: { redirect: current.fullPath } })
  }
})
