import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import router from './router'
import App from './App.vue'
import SignedOut from './views/SignedOut.vue'

import 'element-plus/dist/index.css'
// 统一品牌令牌（与主数据 / 生产 / 金融等模块同源）
import '@agri/shared/tokens/tokens.css'
// S2B2C 四端共享主题：--s2-* 令牌 + Element Plus 主题变量
import '../../frontend-shared/styles/s2b2c-admin.css'
// 商城侧版式（只用 --s2-* 令牌，不另立品牌色）
import './styles/mall.css'

import {
  bootstrapUnifiedSso,
  showUnifiedAuthFailure,
} from '../../frontend-shared/unified-auth'
import { PUBLIC_PATHS } from './config/public-paths'
import '../../../shared/pc-ui-v1.mjs'


async function startMall() {
  // SSO 退出完成后返回 /?logout=1。只渲染确认页，避免受保护的首页立即发起登录。
  const { pathname, search } = window.location
  if (pathname === '/' && new URLSearchParams(search).get('logout') === '1') {
    document.title = '已退出商城 · 丰链云'
    createApp(SignedOut).mount('#app')
    return
  }

  const session = await bootstrapUnifiedSso({
    clientId: 'mall-consumer',
    permission: 's2b2c:consumer',
    landingPath: '/',
    publicPaths: PUBLIC_PATHS,
  })
  if (!session) return
  const app = createApp(App)
  app.use(createPinia())
  app.use(router)
  app.use(ElementPlus, { locale: zhCn })
  app.mount('#app')
}

startMall().catch((error) => showUnifiedAuthFailure(error, 'mall-consumer'))
