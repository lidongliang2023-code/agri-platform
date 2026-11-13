/** 两端共用统一认证入口，不提供本地账号登录回退。 */
import { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import useAuthStore from '@/store/auth'
import { resolveHomePath } from '@/api/auth'
import { redirectToSso } from '@/api/sso'

function takeReturnTarget(from: unknown): string | undefined {
  const path = typeof from === 'string' ? from : ''
  if (!path.startsWith('/') || path.startsWith('//')) return undefined
  if (/\/login(?:[/?#]|$)/.test(path) || /\/sso\/callback/.test(path)) return undefined
  return path
}

export default function SsoHandoff({ clientId }: { clientId: string }): JSX.Element {
  const token = useAuthStore(state => state.token)
  const roles = useAuthStore(state => state.roles)
  const location = useLocation()
  const started = useRef(false)
  const [error, setError] = useState('')
  const returnTo = takeReturnTarget((location.state as { from?: unknown } | null)?.from)
  const begin = () => {
    setError('')
    void redirectToSso(clientId, returnTo).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : '无法跳转到统一认证中心')
    })
  }
  useEffect(() => {
    if (token || started.current) return
    started.current = true
    void redirectToSso(clientId, returnTo).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : '无法跳转到统一认证中心')
    })
  }, [clientId, token, returnTo])
  if (token) return <Navigate to={returnTo ?? resolveHomePath(roles)} replace />
  return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 12 }}>
    {error ? <><span style={{ color: 'var(--agri-color-error, #ff4d4f)' }}>{error}</span><button type="button" onClick={begin}>重新前往统一认证中心</button></> : <span>正在跳转到统一认证中心…</span>}
  </div>
}
