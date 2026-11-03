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
// 统一界面基础样式（页面骨架 / 卡片 / 表格 / 标签 / 统计卡），与其它子系统同一套品牌口径。
import './styles/ui.css'
// 历史页面外壳兼容层：统一标题 / 卡片 / 表头 / 主按钮的品牌色与圆角，不改布局与语义色。
import './styles/legacy-compat.css'
import './index.css'
import App from './App.vue'
import router from './router'
import { pointDirective } from './directives/point'
import { usePointStore } from './stores/points'
import { useSessionStore } from './stores/session'
import { LOGIN_PATH } from './utils/sso'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)
app.use(Antd)
// 按钮级权限点的显隐指令：`v-point="'POST /admin/masterdata/...'"`
app.directive('point', pointDirective)

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
void session.bootstrap().finally(async () => {
  app.mount('#root')

  /*
   * 权限点清单在启动时读一次，全站共用。
   *
   * 只在已登录时读：未登录去读会撞上"用户未登录"的业务码，
   * 而响应拦截器会因此把用户弹去登录页 —— 首页还没看清就被弹走，比按钮没隐藏更糟。
   */
  if (session.isLoggedIn) {
    void usePointStore().load()
  }

  /*
   * 首屏导航发生在 bootstrap 之前 —— `app.use(router)` 的 install 会立刻触发一次导航，
   * 那时 ready 还是 false，守卫按设计放行（否则会把已登录用户误判成未登录）。
   * 于是"续签结果是未登录"这种情况必须在这里补一次跳转：少了它，会话过期的用户
   * 会停在**一个全是空值的总览页**上，而不是被送到登录页 —— 页面看起来"能用"，实际什么都没查到。
   *
   * ⚠️ 必须先 `await router.isReady()` 再判断目标路由。
   * 不 await 的话 `currentRoute` 还是初始的 START_LOCATION（meta 为空、fullPath 为 '/'），
   * 于是**任何页面**（包括公开的 /sso/callback）都会被当成受保护页踢到登录页：
   * 认证中心回跳到 callback → 被换到 /login → 登录页又自动跳认证中心 → 再回 callback …
   * 表现为浏览器在「统一认证登录」与回跳页之间无限打转（网关日志里是每秒数十条
   * /authorize 302 + /sso/callback 200，且全程没有 /sso/token 请求）。
   * 这是竞态：router 恰好先 resolve 时才正常，所以"有时候能进、有时候卡住"。
   */
  await router.isReady()
  const current = router.currentRoute.value
  if (!session.isLoggedIn && current.meta.public !== true) {
    void router.replace({ path: LOGIN_PATH, query: { redirect: current.fullPath } })
  }
})
