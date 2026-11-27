import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import axios from 'axios'
import App from './App.vue'
import { createFinanceRouter } from './router'
import '@agri/shared/tokens/tokens.css'
import './styles/finance-ui.css'
import {
  bootstrapFinanceSso,
  installFinanceAuthInterceptor,
  showFinanceAuthFailure,
} from './auth'
import { loadFinanceProducts } from './data/products'
import { loadFinanceSubject } from './api/subject'
import '../../../shared/pc-ui-v1.mjs'


bootstrapFinanceSso()
  .then(async (login) => {
    if (!login) return
    // 先安装认证拦截器，再发身份卡和业务预加载请求，避免首次冷启动的 /api/v1/finance/subject 缺少 Authorization 头。
    installFinanceAuthInterceptor(axios)
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
    const app = createApp(App)
    const elLocale = {
      ...zhCn,
      el: {
        ...zhCn.el,
        table: { ...zhCn.el.table, emptyText: '暂无符合条件的记录，请调整筛选条件或稍后再试' },
        empty: { ...zhCn.el.empty, description: '暂无符合条件的记录，请调整筛选条件或稍后再试' },
      },
    }
    app.use(ElementPlus, { locale: elLocale })
    // 认证回跳已把地址栏恢复为原始目标后再创建路由，避免首次进入丢失目标页。
    app.use(createFinanceRouter())
    app.mount('#app')
  })
  .catch(showFinanceAuthFailure)
