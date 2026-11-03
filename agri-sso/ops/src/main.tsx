import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import UnifiedSsoGate from './sso'

// dev（5199）与网关产物（/user-center-ops/）两种访问路径都要能回跳到工作台首页。
const landingPath = window.location.port === '5200' ? '/#/dashboard' : '/user-center-ops/#/dashboard'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <UnifiedSsoGate
      clientId="user-center-ops"
      landingPath={landingPath}
      requiredPermissions={['uc:admin']}
    >
      <App />
    </UnifiedSsoGate>
  </React.StrictMode>,
)
