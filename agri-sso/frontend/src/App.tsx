import { useState } from 'react'

// 统一登录页（V2.0 第 5.1 节要点 1：九个登录页只负责"收集意图与跳转"，
// 凭证只提交到 SSO 中心，子系统前端与后端均不接触用户密码）。
//
// 本页只做三件事：
//   1. 从 URL 上读出本次授权请求的上下文（authorize 端点原样带过来的那些参数）；
//   2. 收集账号密码，提交给 SSO 中心（/api/v1/sso/login）；
//   3. 按服务端返回的回跳地址整页跳转 —— 不在前端拼 code / state。
//
// 刻意不做的事：不在本页存任何令牌（令牌由子系统在 /token 处换），
// 不自己判断"登录成功与否"（以服务端返回为准）。

export default function App(): JSX.Element {
  const params = new URLSearchParams(window.location.search)
  const clientId = params.get('client_id') ?? ''
  const redirectUri = params.get('redirect_uri') ?? ''

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [marketId, setMarketId] = useState('1')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const contextMissing = clientId === '' || redirectUri === ''

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/v1/sso/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          marketId: Number(marketId),
          clientId,
          redirectUri,
          state: params.get('state'),
          codeChallenge: params.get('code_challenge'),
          codeChallengeMethod: params.get('code_challenge_method'),
        }),
      })
      const body = await response.json()
      if (!response.ok || body.code !== 0) {
        setError(body.message ?? '登录失败，请重试')
        return
      }
      // 回跳地址由服务端拼好（已带 code 与 state），这里只负责跳
      window.location.href = body.data.redirect
    } catch {
      setError('无法联系认证服务，请确认后端已启动')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sso-page">
      <form className="sso-card" onSubmit={submit}>
        <h1 className="sso-title">统一认证中心</h1>
        <p className="sso-subtitle">
          {contextMissing ? '请从子系统入口进入登录' : `正在为「${clientId}」完成登录`}
        </p>

        <label className="sso-label">
          用户名
          <input
            className="sso-input"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label className="sso-label">
          密码
          <input
            className="sso-input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <label className="sso-label">
          市场 ID
          <input
            className="sso-input"
            value={marketId}
            onChange={(event) => setMarketId(event.target.value)}
            inputMode="numeric"
          />
        </label>

        {error !== '' && <div className="sso-error">{error}</div>}

        <button className="sso-button" type="submit" disabled={busy || contextMissing}>
          {busy ? '登录中…' : '登 录'}
        </button>

        <p className="sso-hint">
          一次登录，全网通行。登录后由本中心向子系统签发一次性授权码，密码不会离开本页与认证中心。
        </p>
      </form>
    </div>
  )
}
