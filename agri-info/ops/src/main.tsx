import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import UnifiedSsoGate from './sso'

// dev（5198）与网关产物（/info-ops/）两种访问路径都要能回跳到工作台首页。
const landingPath = window.location.port === '5198' ? '/#/dashboard' : '/info-ops/#/dashboard'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <UnifiedSsoGate
      clientId="info-ops"
      landingPath={landingPath}
      requiredPermissions={['info:admin']}
    >
      <App />
    </UnifiedSsoGate>
  </React.StrictMode>,
)
