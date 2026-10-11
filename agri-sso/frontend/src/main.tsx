import React from 'react'
import ReactDOM from 'react-dom/client'
// 平台设计令牌（框架无关的 CSS 变量投影）：登录页的品牌色与尺寸只有一个来源
import '@agri/shared/tokens/tokens.css'
import './app.css'
import App from './App'
import './shared-wiring'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('未找到 #root 挂载节点，请检查 index.html')
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
