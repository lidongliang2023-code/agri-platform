import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import axios from 'axios'
import App from './App.vue'
import router from './router'
import '@agri/shared/tokens/tokens.css'
import './styles/finance-ui.css'
import {
  bootstrapFinanceSso,
  installFinanceAuthInterceptor,
  showFinanceAuthFailure,
} from './auth'
import { loadFinanceProducts } from './data/products'
import { loadFinanceSubject } from './api/subject'

bootstrapFinanceSso()
  .then(async (login) => {
    if (!login) return
    try {
      // 身份卡必须先落地：融资主体号/资金机构号由后端按令牌解析，页面不再有写死的编号
      await loadFinanceSubject()
    } catch {
      // 身份解析失败不阻塞挂载，各页会在请求里拿到明确的后端提示
    }
    try {
      // 预加载统一产品目录，保证审批、借款等历史记录也使用当前配置的名称。
      await loadFinanceProducts()
    } catch {
      // 产品目录不可用不应阻塞工作台挂载，各产品页会展示明确错误。
    }
    installFinanceAuthInterceptor(axios)
    const app = createApp(App)
    app.use(ElementPlus)
    app.use(router)
    app.mount('#app')
  })
  .catch(showFinanceAuthFailure)
