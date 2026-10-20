import React from 'react'
import ReactDOM from 'react-dom/client'
import './theme.css'
import './portal.css'
import App from './App'

const root = document.getElementById('root')
if (!root) {
  throw new Error('未找到 #root 挂载节点')
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
