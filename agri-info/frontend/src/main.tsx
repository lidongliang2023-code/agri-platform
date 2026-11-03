import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import UnifiedSsoGate from './sso'

// dev（5197）与网关产物（/info/）两种访问路径都要能回跳到首页。
const landingPath = window.location.port === '5197' ? '/#/home' : '/info/#/home'

ReactDOM.createRoot(document.getElementById('root')!).render(
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
