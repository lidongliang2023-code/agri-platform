import { useState } from 'react'

// 统一登录页（V2.0 第 5.1 节要点 1：九个登录页只负责"收集意图与跳转"，
// 凭证只提交到 SSO 中心，子系统前端与后端均不接触用户密码）。
//
// 本页只做三件事：
//   1. 从 URL 上读出本次授权请求的上下文（authorize 端点原样带过来的那些参数）；
//   2. 收集凭据（**手机号+密码** 或 **账号+密码**），提交给 SSO 中心（/api/v1/sso/login）；
//   3. 按服务端返回的回跳地址整页跳转 —— 不在前端拼 code / state。
//
// 刻意不做的事：不在本页存任何令牌（令牌由子系统在 /token 处换），
// 不自己判断"登录成功与否"（以服务端返回为准）。
//
// 2026-10-16 改为多 Tab：
//   · 「手机号登录」已可用（账号表 phone 列 + AuthService 支持按手机号查账号）；
//   · 「账号密码」是原有方式，保留（超管这类账号没有手机号）；
//   · 「微信扫码」与「手机验证码 / 微信注册」**依赖外部凭据**（微信开放平台 AppID/AppSecret +
//     可被微信回调的公网地址；短信服务商 AccessKey/签名/模板）。当前部署未配置，
//     所以这里如实说明依赖，**不放一个点了必然失败的按钮**，也不伪造二维码或"验证码已发送"。

/** 登录方式 */
type LoginMode = 'phone' | 'account' | 'wechat'

export default function App(): JSX.Element {
  const params = new URLSearchParams(window.location.search)
  const clientId = params.get('client_id') ?? ''
  const redirectUri = params.get('redirect_uri') ?? ''

  const [mode, setMode] = useState<LoginMode>('phone')
  const [phone, setPhone] = useState('')
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
          // 按当前 Tab 决定提交哪种账号标识：手机号登录发 phone，账号密码登录发 username
          username: mode === 'account' ? username : undefined,
          phone: mode === 'phone' ? phone : undefined,
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

        <div
          role="tablist"
          aria-label="登录方式"
          style={{ display: 'flex', gap: 8, marginBottom: 16 }}
        >
          {(
            [
              { key: 'phone', label: '手机号登录' },
              { key: 'account', label: '账号密码' },
              { key: 'wechat', label: '微信扫码' },
            ] as { key: LoginMode; label: string }[]
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={mode === tab.key}
              onClick={() => {
                setMode(tab.key)
                setError('')
              }}
              style={{
                flex: 1,
                padding: '8px 4px',
                fontSize: 13,
                cursor: 'pointer',
                borderRadius: 6,
                border: mode === tab.key ? '1px solid #13a05a' : '1px solid #d9d9d9',
                background: mode === tab.key ? '#f0faf4' : '#fff',
                color: mode === tab.key ? '#13a05a' : 'inherit',
                fontWeight: mode === tab.key ? 600 : 400,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {mode === 'wechat' && (
          <div className="sso-error" style={{ background: '#fffbe6', borderColor: '#ffe58f' }}>
            微信扫码登录（含扫码注册）尚未接入：需要先提供微信开放平台应用的 AppID / AppSecret，
            以及一个能被微信回调的公网地址（本机 localhost 无法作为回调域）。
            配置到位后我再把二维码与回调接上 —— 在那之前这里不放一个点了会失败的按钮。
          </div>
        )}

        {mode === 'phone' && (
          <label className="sso-label">
            手机号
            <input
              className="sso-input"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              autoComplete="tel"
              inputMode="numeric"
              placeholder="如 13800000001"
              required
            />
          </label>
        )}

        {mode === 'account' && (
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
        )}

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

        {mode !== 'wechat' && (
          <button className="sso-button" type="submit" disabled={busy || contextMissing}>
            {busy ? '登录中…' : '登 录'}
          </button>
        )}

        <p className="sso-hint">
          一次登录，全网通行。登录后由本中心向子系统签发一次性授权码，密码不会离开本页与认证中心。
        </p>
        <p className="sso-hint" style={{ marginTop: 8 }}>
          注册（手机号验证码注册 / 微信扫码注册）与手机验证码登录同样依赖外部服务：
          前者需要短信服务商的 AccessKey、签名与模板；后者需要微信开放平台凭据。两者当前均未配置。
        </p>
      </form>
    </div>
  )
}
