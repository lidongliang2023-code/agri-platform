/**
 * SSO 回跳页（`/sso/callback`）—— 授权码换令牌的落点。
 *
 * <p>它只做一件事：把 URL 上的 code 换成平台令牌并写入登录态，然后按角色回到首页。
 * 之所以单独成页而不是塞进登录页：登录页的职责是"收集意图并跳转"，回跳是另一件事，
 * 混在一起会让"本地账号登录"和"SSO 登录"两条路径互相干扰。</p>
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ADMIN_LOGIN_PATH, persistSession, resolveHomePath } from '@/api/auth'
import { exchangeCode } from '@/api/sso'

/** 回跳页：换票 → 写登录态 → 回到角色首页 */
export default function SsoCallback({ clientId }: { clientId: string }): JSX.Element {
  const navigate = useNavigate()
  const [error, setError] = useState<string>('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (!code) {
      setError('回跳地址里没有授权码')
      return
    }
    let cancelled = false
    exchangeCode(clientId, code, params.get('state'))
      .then((result) => {
        if (cancelled) return
        persistSession(result)
        const returnTo = sessionStorage.getItem('agri_sso_return')
        sessionStorage.removeItem('agri_sso_return')
        navigate(returnTo ?? resolveHomePath(result.user?.roles ?? []), { replace: true })
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : '换取令牌失败')
        }
      })
    return () => {
      cancelled = true
    }
  }, [clientId, navigate])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 12,
      }}
    >
      {error === '' ? (
        <span>正在完成登录…</span>
      ) : (
        <>
          <span style={{ color: 'var(--agri-color-error, #ff4d4f)' }}>{error}</span>
          {/* 带 ?local=1 回到登录页：绕过自动跳转，避免"跳过去又失败"来回打转 */}
          <a href={`${ADMIN_LOGIN_PATH}?local=1`}>返回登录页</a>
        </>
      )}
    </div>
  )
}
