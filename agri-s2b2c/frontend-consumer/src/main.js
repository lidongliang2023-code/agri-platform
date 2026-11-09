import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import router from './router'
import App from './App.vue'

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

bootstrapUnifiedSso({
  clientId: 'mall-consumer',
  permission: 's2b2c:consumer',
  landingPath: '/',
  publicPaths: PUBLIC_PATHS,
})
  .then((session) => {
    // 只有"正在跳登录"（null）不挂载；匿名访客（{ anonymous: true }）照常挂载，
    // 否则扫码进来的第一步就是"先注册"，溯源码等于白印。
    if (!session) return
    const app = createApp(App)
    app.use(createPinia())
    app.use(router)
    app.use(ElementPlus, { locale: zhCn })
    app.mount('#app')
  })
  .catch((error) => showUnifiedAuthFailure(error, 'mall-consumer'))
