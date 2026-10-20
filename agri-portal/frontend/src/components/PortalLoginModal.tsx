import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Icon } from './Icon'
import './portal-login.css'

export interface PortalUser {
  id?: string
  username?: string
  nickname?: string
  phone?: string
}

interface PortalLoginModalProps {
  open: boolean
  onClose: () => void
  onSuccess: (user: PortalUser) => void
}

interface LoginBody {
  code?: number
  message?: string
  data?: {
    stage?: string
    redirect?: string
    user?: {
      id?: string
      username?: string
      nickname?: string
      roles?: string[]
    }
  }
}

export function PortalLoginModal({ open, onClose, onSuccess }: PortalLoginModalProps): JSX.Element | null {
  const [tab, setTab] = useState<'pwd' | 'sms'>('pwd')
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)
  const [sending, setSending] = useState(false)
  const [left, setLeft] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (left <= 0) return undefined
    const timer = window.setTimeout(() => setLeft(left - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [left])

  useEffect(() => {
    if (!open) {
      setError('')
      setNotice('')
    }
  }, [open])

  if (!open) return null

  async function sendCode(): Promise<void> {
    setError('')
    setNotice('')
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError('请输入正确的 11 位手机号')
      return
    }
    setSending(true)
    try {
      const response = await fetch('/api/v1/sso/sms/code', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, scene: 'login' }),
      })
      const body = await response.json() as LoginBody & { data?: { hint?: string } }
      if (!response.ok || body.code !== 0) {
        setError(body.message ?? '验证码发送失败')
        return
      }
      setNotice(body.data?.hint ?? '验证码已发送')
      setLeft(60)
    } catch {
      setError('无法联系认证服务，请确认后端已启动')
    } finally {
      setSending(false)
    }
  }

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault()
    setError('')
    setNotice('')
    if (tab === 'pwd' && (!account.trim() || !password)) {
      setError('请输入账号和密码')
      return
    }
    if (tab === 'sms' && (!/^1[3-9]\d{9}$/.test(phone) || !/^\d{6}$/.test(code))) {
      setError('请输入正确的手机号和 6 位验证码')
      return
    }
    setBusy(true)
    try {
      const response = await fetch(
        tab === 'pwd' ? '/api/v1/sso/login-standalone' : '/api/v1/sso/login-standalone-by-sms',
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tab === 'pwd'
            ? {
                username: /^1[3-9]\d{9}$/.test(account.trim()) ? undefined : account.trim(),
                phone: /^1[3-9]\d{9}$/.test(account.trim()) ? account.trim() : undefined,
                password,
                marketId: 1,
                remember,
              }
            : { phone, code, marketId: 1, remember }),
        },
      )
      const body = await response.json() as LoginBody
      if (!response.ok || body.code !== 0) {
        setError(body.message ?? '登录失败，请重试')
        return
      }
      const user: PortalUser = {
        id: body.data?.user?.id,
        username: body.data?.user?.username,
        nickname: body.data?.user?.nickname,
        phone: tab === 'sms' ? phone : undefined,
      }
      onSuccess(user)
      setPassword('')
      setCode('')
    } catch {
      setError('无法联系认证服务，请确认后端已启动')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="portal-login-mask" role="dialog" aria-modal="true" aria-label="登录农产云" onClick={onClose}>
      <div className="portal-login-card" onClick={(event) => event.stopPropagation()}>
        <div className="portal-login-head">
          <div>
            <span className="portal-login-badge"><Icon name="shield" size={13} />统一认证</span>
            <h2>登录农产云</h2>
            <p>登录后停留在官网，点击生产管理、交易大厅等入口时再进入对应子系统。</p>
          </div>
          <button className="portal-login-close" type="button" aria-label="关闭" onClick={onClose}>×</button>
        </div>

        <div className="portal-login-tabs">
          <button type="button" className={tab === 'pwd' ? 'on' : ''} onClick={() => { setTab('pwd'); setError(''); }}>账号 + 密码</button>
          <button type="button" className={tab === 'sms' ? 'on' : ''} onClick={() => { setTab('sms'); setError(''); }}>手机号 + 验证码</button>
        </div>

        <form className="portal-login-form" onSubmit={(event) => void submit(event)}>
          {tab === 'pwd' ? (
            <>
              <label>账号
                <input value={account} autoComplete="username" placeholder="手机号 / 用户名"
                  onChange={(event) => { setAccount(event.target.value); setError('') }} />
              </label>
              <label>密码
                <input type="password" value={password} autoComplete="current-password" placeholder="请输入登录密码"
                  onChange={(event) => { setPassword(event.target.value); setError('') }} />
              </label>
            </>
          ) : (
            <>
              <label>手机号
                <input type="tel" value={phone} maxLength={11} inputMode="numeric" placeholder="请输入 11 位手机号"
                  onChange={(event) => { setPhone(event.target.value.replace(/\D/g, '')); setError('') }} />
              </label>
              <label>验证码
                <div className="portal-code-row">
                  <input value={code} maxLength={6} inputMode="numeric" placeholder="6 位验证码"
                    onChange={(event) => { setCode(event.target.value.replace(/\D/g, '')); setError('') }} />
                  <button type="button" disabled={sending || left > 0} onClick={() => void sendCode()}>
                    {sending ? '发送中…' : left > 0 ? `重新获取（${left}s）` : '获取验证码'}
                  </button>
                </div>
              </label>
            </>
          )}

          <div className="portal-login-options">
            <label><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />7 天内自动登录</label>
            <span>登录后返回官网</span>
          </div>

          {error && <div className="portal-login-error">{error}</div>}
          {notice && <div className="portal-login-notice">{notice}</div>}
          <button className="portal-login-submit" type="submit" disabled={busy}>{busy ? '登录中…' : '登 录'}</button>
        </form>
      </div>
    </div>
  )
}
