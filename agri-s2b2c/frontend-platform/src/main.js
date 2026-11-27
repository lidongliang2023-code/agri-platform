import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import '@agri/shared/tokens/tokens.css'
import '../../frontend-shared/styles/s2b2c-admin.css'
import {
  bootstrapUnifiedSso,
  showUnifiedAuthFailure,
} from '../../frontend-shared/unified-auth'
import '../../../shared/pc-ui-v1.mjs'


bootstrapUnifiedSso({
  clientId: 's2b2c-platform',
  permission: 's2b2c:admin',
  landingPath: '/',
})
  .then((login) => {
    if (!login) return
    const app = createApp(App)
    app.use(createPinia())
    app.use(router)
    const elLocale = {
      ...zhCn,
      el: {
        ...zhCn.el,
        table: { ...zhCn.el.table, emptyText: '暂无符合条件的记录，请调整筛选条件或稍后再试' },
        empty: { ...zhCn.el.empty, description: '暂无符合条件的记录，请调整筛选条件或稍后再试' },
      },
    }
    app.use(ElementPlus, { locale: elLocale })
    app.mount('#app')
  })
  .catch((error) => showUnifiedAuthFailure(error, 's2b2c-platform'))
