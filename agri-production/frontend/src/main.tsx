/**
 * 应用入口
 *
 * 挂载 React 根节点、react-query 全局数据请求客户端与 dayjs 中文本地化。
 * 并在此统一注册 dayjs 插件（quarterOfYear），使 dayjs().quarter() /
 * startOf('quarter') 在全工程可用——该插件的 d.ts 会做模块增强，
 * 因此业务页面无需各自 import 即可通过类型检查。
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import dayjs from 'dayjs'
import quarterOfYear from 'dayjs/plugin/quarterOfYear'
import 'dayjs/locale/zh-cn'
import App from './App'

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

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)
