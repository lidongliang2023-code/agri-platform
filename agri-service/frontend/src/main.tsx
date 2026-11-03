import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import UnifiedSsoGate from './sso'

const landingPath = window.location.port === '5194' ? '/#/home' : '/service/#/home'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <UnifiedSsoGate
      clientId="service"
      landingPath={landingPath}
      requiredPermissions={['service:consumer']}
    >
      <App />
    </UnifiedSsoGate>
  </React.StrictMode>,
)
