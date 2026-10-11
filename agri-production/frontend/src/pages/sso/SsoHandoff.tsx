/**
 * SSO 跳转闸门 —— 包住既有登录页，把"未登录用户"改为送去统一认证中心。
 *
 * <p>依据 V2.0 第 5.2 节（子系统改为「跳转 SSO + 回跳参数」）。做成"包一层"而不是改登录页本体，
 * 有三个理由：① 登录页里有既有的快捷入口与本地登录逻辑，改动面越小越好；
 * ② 两个端（运营端 / 用户端）共用同一段跳转逻辑，不会各写一份走偏；
 * ③ 过渡期可回退 —— 带 `?local=1` 就照旧显示本地登录页（SSO 出问题时还有路可走）。</p>
 */
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import useAuthStore from '@/store/auth'
import { redirectToSso } from '@/api/sso'

/** 跳转闸门：已登录或显式要求本地登录时放行，否则送去 SSO */
export default function SsoHandoff({ clientId, fallback }: { clientId: string; fallback: ReactNode }): JSX.Element {
  const token = useAuthStore((state) => state.token)
  const params = new URLSearchParams(window.location.search)
  const useLocal = params.get('local') === '1'
  const [error, setError] = useState<string>('')

  useEffect(() => {
    if (token || useLocal) {
      return
    }
    redirectToSso(clientId).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : '无法跳转到统一认证中心')
    })
  }, [clientId, token, useLocal])

  if (token || useLocal) {
    return <>{fallback}</>
  }

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
      <span>正在跳转到统一认证中心…</span>
      {error !== '' && (
        <>
          <span style={{ color: 'var(--agri-color-error, #ff4d4f)' }}>{error}</span>
          <button type="button" onClick={() => void redirectToSso(clientId)}>
            立即跳转
          </button>
          <a href="?local=1">改用本地账号登录（过渡期）</a>
        </>
      )}
    </div>
  )
}
