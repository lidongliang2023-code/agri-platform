import React from 'react'
import ReactDOM from 'react-dom/client'
import { App as AntApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './App'
import './styles.css'
import UnifiedSsoGate from '../../frontend/src/sso'

const landingPath = window.location.port === '5183' ? '/#/dashboard' : '/gov-ops/#/dashboard'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN} theme={{token:{colorPrimary:'#12764a',colorLink:'#12764a',colorText:'#0b1a12',colorTextSecondary:'#6b7c72',colorBorder:'#e1e9e3',colorBgLayout:'#f3f7f4',borderRadius:9,controlHeight:36,fontFamily:'-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif'}}}>
      <AntApp>
        <UnifiedSsoGate clientId="gov-ops" landingPath={landingPath} requiredPermissions={['gov:admin']}>
          <App/>
        </UnifiedSsoGate>
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>,
)
