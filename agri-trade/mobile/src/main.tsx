import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import axios from 'axios'
import App from './App'
import { getAccessToken } from '@/utils/session'
import { redirectToSso, refreshAccessToken, LOGIN_PATH, SSO_CALLBACK_PATH } from '@/utils/sso'
import './index.css'

axios.defaults.withCredentials = true
axios.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      const { pathname, search, hash } = window.location
      const headers = (error.config as {
        headers?: Record<string, unknown> & { get?: (name: string) => unknown }
      } | undefined)?.headers
      const silent = headers?.get?.('X-Skip-Auth-Redirect') === '1'
        || headers?.['X-Skip-Auth-Redirect'] === '1'
        || headers?.['x-skip-auth-redirect'] === '1'
      if (!silent && pathname !== LOGIN_PATH && pathname !== SSO_CALLBACK_PATH) {
        void redirectToSso(`${pathname}${search}${hash}`)
      }
    }
    return Promise.reject(error)
  },
)

async function bootstrap(): Promise<void> {
  await refreshAccessToken()
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>,
  )
}

void bootstrap()
