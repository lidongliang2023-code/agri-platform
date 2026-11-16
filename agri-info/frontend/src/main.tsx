import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import UnifiedSsoGate from './sso'

// 手机入口统一进入 uni-app；桌面窗口缩放不改变应用。
const mobileDevice = /Android|iPhone|iPod|Mobile/i.test(navigator.userAgent)
if (mobileDevice) {
  const local = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  const base = String(import.meta.env.VITE_INFO_MOBILE_URL || (local
    ? `${window.location.protocol}//${window.location.hostname}:8114/` : '/info-mobile/'))
  const [path, query = ''] = window.location.hash.replace(/^#/, '').split('?')
  const pages: Record<string, string> = { '/home': '/pages/news/index', '/news': '/pages/news/index', '/news-detail': '/pages/news/article', '/market': '/pages/market/index', '/market-detail': '/pages/market/variety', '/sd': '/pages/sd/index', '/sd-detail': '/pages/sd/detail', '/favorites': '/pages/favorite/index', '/alerts': '/pages/alert/messages', '/search': '/pages/search/index' }
  const parts = path.split('/').filter(Boolean)
  const params = new URLSearchParams(query)
  if (parts[1] && /^\d+$/.test(parts[1])) params.set('id', parts[1])
  const suffix = params.toString()
  window.location.replace(`${base.replace(/\/$/, '')}/#${pages[`/${parts[0]}`] || '/pages/news/index'}${suffix ? `?${suffix}` : ''}`)
}

// dev（5197）与网关产物（/info/）两种访问路径都要能回跳到首页。
const landingPath = window.location.port === '5197' ? '/#/home' : '/info/#/home'

if (!mobileDevice) ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <UnifiedSsoGate
      clientId="info"
      landingPath={landingPath}
      requiredPermissions={['info:consumer']}
    >
      <App />
    </UnifiedSsoGate>
  </React.StrictMode>,
)
