/**
 * 入口：挂载 React、统一中文本地化、注入共享包的 antd 主题。
 *
 * 主题取自 `@agri/shared` 而不是本目录另写一份：九个子系统共用同一套品牌色与布局尺寸，
 * 各子系统各写一份是「同一平台看起来像九个产品」的根源。
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import { antdTheme } from '@agri/shared'
import '@agri/shared/styles/global.less'
import App from './App'

dayjs.locale('zh-cn')

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('未找到 #root 挂载节点，请检查 index.html')
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN} theme={antdTheme}>
      <App />
    </ConfigProvider>
  </React.StrictMode>,
)
