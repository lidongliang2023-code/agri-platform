/**
 * 应用入口（Vue 3 + Ant Design Vue 4 + Pinia 2 + Vue Router 4）
 *
 * 挂载 Vue 根节点、Pinia、Vue Query、Vue Router 与 dayjs 中文本地化及季度插件。
 */
// 必须最先执行：内嵌在 uni-app H5 中时隔离本地存储，避免其他模块初始化时改动客户端登录信息
import './utils/embedded-storage'
import { createApp } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import dayjs from 'dayjs'
import quarterOfYear from 'dayjs/plugin/quarterOfYear'
import 'dayjs/locale/zh-cn'
import App from './vue/App.vue'
import { productionPinia } from './vue/createProductionStore'
import { createProductionRouter } from './vue/business/fullRouter'
import '../../../shared/pc-ui-v1.mjs'

dayjs.locale('zh-cn')
dayjs.extend(quarterOfYear)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 0,
      refetchOnWindowFocus: false,
      staleTime: 30 * 1000,
    },
  },
})

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('未找到 #root 挂载节点，请检查 index.html')
}

const router = createProductionRouter()

createApp(App)
  .use(productionPinia)
  .use(VueQueryPlugin, { queryClient })
  .use(router)
  .mount(rootElement)
