/**
 * 应用入口（Vue 3）—— 回归 PRD §15.1 的选型：Vue 3.4 + TS + Vite + Ant Design Vue + Pinia。
 *
 * index.html 加载本入口，并将 Vue 3 应用挂载到 #root。
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
import { normalizeReturnTarget, redirectToSso, SSO_CALLBACK_PATH } from './utils/sso'
import '../../../shared/pc-ui-v1.mjs'


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
  const rawPathname = window.location.pathname.replace(/\/+$/, '') || '/'
  const isPublicEntry = rawPathname === SSO_CALLBACK_PATH

  // 未登录访问受保护页面或旧 /login、/user/login 地址时，直接前往统一认证中心，不渲染任何本地登录页
  if (!session.isLoggedIn && !isPublicEntry) {
    const queryRedirect = new URLSearchParams(window.location.search).get('redirect')
    const target =
      rawPathname === '/login'
        ? normalizeReturnTarget(queryRedirect, '/dashboard')
        : rawPathname === '/user/login'
          ? normalizeReturnTarget(queryRedirect, '/user/workbench')
          : normalizeReturnTarget(`${window.location.pathname}${window.location.search}${window.location.hash}`)
    void redirectToSso(target)
    return
  }

  app.mount('#root')

  /*
   * 权限点清单在启动时读一次，全站共用。
   */
  if (session.isLoggedIn) {
    void usePointStore().load()
  }

  await router.isReady()
  const current = router.currentRoute.value
  if (!session.isLoggedIn && current.meta.public !== true) {
    void redirectToSso(current.fullPath)
  }
})
