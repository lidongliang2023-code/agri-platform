/**
 * 用户中心 · 二次验证（TOTP）
 *
 * <p>与手机验证器兼容（Google / 微软 Authenticator、1Password 等）：
 * HMAC-SHA1、30 秒步长、6 位数字、Base32 密钥。</p>
 *
 * <p><b>流程是"先生成、再确认"两段</b>：扫码后必须输一次正确的码才算启用 ——
 * 否则用户装错应用或手机时间不准，会直接被锁在门外。</p>
 *
 * <p>备用码只在生成时显示一次，之后库里只有哈希。停用必须再验一次码，
 * 防止会话被别人拿到就直接关掉 2FA。</p>
 *
 * <p><b>已知缺口（页面上也写明）</b>：二次验证目前拦在独立登录接口
 * （密码登录 / 短信登录）。子系统跳转的 OIDC 授权码流程尚未接入第二因子 ——
 * 那需要在授权码流程里插入一个可恢复的中间态，改动面比本页大。</p>
 */
import { useCallback, useEffect, useState } from 'react'
import type { JSX } from 'react'
import { Icon } from '@/components/Icon'

interface MfaStatus {
  enabled: boolean
  status: string
  enabledAt: string | null
  lastUsedAt: string | null
  remainingRecoveryCodes: number
}

interface SetupResult {
  secret: string
  otpauthUri: string
  issuer: string
  digits: number
  period: number
}

interface ApiBody<T> {
  code: number
  message?: string
  data?: T
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const body = (await response.json()) as ApiBody<T>
  if (!response.ok || body.code !== 0) {
    throw new Error(body.message || '请求失败')
  }
  return body.data as T
}

const formatTime = (value: string | null): string =>
  (value ?? '').replace('T', ' ').slice(0, 16)

/** Base32 密钥按 4 位分组，方便手输 */
function groupSecret(secret: string): string {
  return secret.replace(/(.{4})/g, '$1 ').trim()
}

/**
 * 二次验证页面
 *
 * @returns 页面内容
 */
export function Mfa(): JSX.Element {
  const [status, setStatus] = useState<MfaStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  /** setup：已生成密钥待确认；recovery：展示备用码；disable：输入码停用；regen：重生成备用码 */
  const [step, setStep] = useState<'idle' | 'setup' | 'recovery' | 'disable' | 'regen'>('idle')
  const [setup, setSetup] = useState<SetupResult | null>(null)
  const [code, setCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [savedChecked, setSavedChecked] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const data = await api<MfaStatus>('/api/v1/sso/account/mfa')
      setStatus(data)
    } catch (e) {
      setError((e as Error).message || '状态加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const resetFlow = (): void => {
    setStep('idle')
    setSetup(null)
    setCode('')
    setRecoveryCodes([])
    setSavedChecked(false)
  }

  const startSetup = async (): Promise<void> => {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const data = await api<SetupResult>('/api/v1/sso/account/mfa/setup', { method: 'POST' })
      setSetup(data)
      setStep('setup')
      setCode('')
    } catch (e) {
      setError((e as Error).message || '生成密钥失败')
    } finally {
      setSaving(false)
    }
  }

  const confirm = async (): Promise<void> => {
    if (code.replace(/\s/g, '').length !== 6) {
      setError('请输入验证器上的 6 位验证码')
      return
    }
    setSaving(true)
    setError('')
    try {
      const data = await api<{ recoveryCodes: string[] }>('/api/v1/sso/account/mfa/confirm', {
        method: 'POST',
        body: JSON.stringify({ code: code.replace(/\s/g, '') }),
      })
      setRecoveryCodes(data?.recoveryCodes ?? [])
      setStep('recovery')
      setNotice('')
      await load()
    } catch (e) {
      setError((e as Error).message || '验证失败')
    } finally {
      setSaving(false)
    }
  }

  const disable = async (): Promise<void> => {
    if (!code.trim()) {
      setError('请输入验证码或备用码')
      return
    }
    setSaving(true)
    setError('')
    try {
      await api('/api/v1/sso/account/mfa/disable', {
        method: 'POST',
        body: JSON.stringify({ code: code.trim() }),
      })
      setNotice('二次验证已停用。建议尽快重新启用，账号安全会明显下降')
      resetFlow()
      await load()
    } catch (e) {
      setError((e as Error).message || '停用失败')
    } finally {
      setSaving(false)
    }
  }

  const regenerate = async (): Promise<void> => {
    if (!code.trim()) {
      setError('请输入验证码或备用码')
      return
    }
    setSaving(true)
    setError('')
    try {
      const data = await api<{ recoveryCodes: string[] }>('/api/v1/sso/account/mfa/recovery-codes', {
        method: 'POST',
        body: JSON.stringify({ code: code.trim() }),
      })
      setRecoveryCodes(data?.recoveryCodes ?? [])
      setStep('recovery')
      await load()
    } catch (e) {
      setError((e as Error).message || '生成失败')
    } finally {
      setSaving(false)
    }
  }

  const enabled = status?.enabled ?? false

  return (
    <div className="uc-mfa">
      <div className="uc-mfa-head">
        <div>
          <strong>二次验证</strong>
          <small>用手机验证器生成的 6 位动态码，作为密码之外的第二道验证</small>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => void load()} disabled={loading}>
          刷新
        </button>
      </div>

      {notice && <div className="account-notice">{notice}</div>}
      {error && <div className="account-error">{error}</div>}
      {loading && <div className="card empty">正在加载…</div>}

      {!loading && status && (
        <>
          <div className={`uc-mfa-status ${enabled ? 'on' : ''}`}>
            <span className="uc-mfa-icon">
              <Icon name={enabled ? 'shield' : 'alert'} size={20} />
            </span>
            <div className="uc-mfa-status-body">
              <strong>{enabled ? '已启用' : '未启用'}</strong>
              <small>
                {enabled
                  ? `启用时间 ${formatTime(status.enabledAt)}　最近验证 ${formatTime(status.lastUsedAt)}　剩余备用码 ${status.remainingRecoveryCodes} 个`
                  : '未启用时，只有密码一道防线；密码泄露即账号失守'}
              </small>
            </div>
            {enabled ? (
              <div className="uc-mfa-actions">
                <button
                  className="btn btn-outline btn-sm"
                  disabled={saving}
                  onClick={() => {
                    resetFlow()
                    setStep('regen')
                  }}
                >
                  重生成备用码
                </button>
                <button
                  className="btn btn-outline btn-sm uc-mfa-danger"
                  disabled={saving}
                  onClick={() => {
                    resetFlow()
                    setStep('disable')
                  }}
                >
                  停用
                </button>
              </div>
            ) : (
              <button className="btn btn-primary btn-sm" disabled={saving} onClick={() => void startSetup()}>
                {saving ? '生成中…' : '开始设置'}
              </button>
            )}
          </div>

          {/* 设置：展示密钥 + 输码确认 */}
          {step === 'setup' && setup && (
            <div className="uc-mfa-panel">
              <h4>第 1 步：把密钥添加到验证器</h4>
              <p className="uc-mfa-hint">
                用验证器 App（Google Authenticator / 微软 Authenticator / 1Password）扫描下方链接，
                或手动输入密钥。当前环境没有生成二维码，**扫码链接可直接复制**到手机打开。
              </p>
              <label className="uc-mfa-field">
                密钥（Base32，手动输入时用这个）
                <input readOnly value={groupSecret(setup.secret)} onFocus={(e) => e.target.select()} />
              </label>
              <label className="uc-mfa-field">
                otpauth 链接
                <input readOnly value={setup.otpauthUri} onFocus={(e) => e.target.select()} />
              </label>
              <p className="uc-mfa-hint">
                参数：{setup.issuer}　{setup.digits} 位　{setup.period} 秒刷新　算法 SHA1
              </p>

              <h4>第 2 步：输入验证器当前的 6 位码</h4>
              <div className="uc-mfa-code-row">
                <input
                  className="uc-mfa-code"
                  value={code}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                />
                <button className="btn btn-primary btn-sm" disabled={saving} onClick={() => void confirm()}>
                  {saving ? '校验中…' : '确认启用'}
                </button>
                <button className="btn btn-outline btn-sm" disabled={saving} onClick={resetFlow}>
                  取消
                </button>
              </div>
              <p className="uc-mfa-hint">
                输错通常是因为手机时间不准 —— 验证器依赖时间同步，请把手机设为自动校准时间。
              </p>
            </div>
          )}

          {/* 备用码展示（仅一次） */}
          {step === 'recovery' && recoveryCodes.length > 0 && (
            <div className="uc-mfa-panel uc-mfa-recovery">
              <h4>备用码（只显示这一次）</h4>
              <p className="uc-mfa-hint">
                手机丢失或验证器被卸载时，用其中一个备用码登录。**每个码只能用一次**，
                刷新页面后无法再次查看 —— 请现在保存到安全的地方。
              </p>
              <ul className="uc-mfa-codes">
                {recoveryCodes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <label className="uc-mfa-check">
                <input
                  type="checkbox"
                  checked={savedChecked}
                  onChange={(event) => setSavedChecked(event.target.checked)}
                />
                我已把这些备用码保存到安全的地方
              </label>
              <button
                className="btn btn-primary btn-sm"
                disabled={!savedChecked}
                onClick={resetFlow}
              >
                完成
              </button>
            </div>
          )}

          {/* 停用 */}
          {step === 'disable' && (
            <div className="uc-mfa-panel">
              <h4>停用二次验证</h4>
              <p className="uc-mfa-hint">
                需要再验证一次（验证码或备用码）。停用后账号只剩密码一道防线，
                建议只在更换手机等必要场景下临时停用。
              </p>
              <div className="uc-mfa-code-row">
                <input
                  className="uc-mfa-code uc-mfa-code-wide"
                  value={code}
                  placeholder="6 位验证码，或 XXXX-XXXXX 备用码"
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                />
                <button
                  className="btn btn-sm uc-mfa-danger"
                  disabled={saving}
                  onClick={() => void disable()}
                >
                  {saving ? '处理中…' : '确认停用'}
                </button>
                <button className="btn btn-outline btn-sm" disabled={saving} onClick={resetFlow}>
                  取消
                </button>
              </div>
            </div>
          )}

          {/* 重生成备用码 */}
          {step === 'regen' && (
            <div className="uc-mfa-panel">
              <h4>重新生成备用码</h4>
              <p className="uc-mfa-hint">
                生成后**旧的备用码立即作废**。同样需要先验证一次。
              </p>
              <div className="uc-mfa-code-row">
                <input
                  className="uc-mfa-code uc-mfa-code-wide"
                  value={code}
                  placeholder="6 位验证码，或 XXXX-XXXXX 备用码"
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                />
                <button
                  className="btn btn-primary btn-sm"
                  disabled={saving}
                  onClick={() => void regenerate()}
                >
                  {saving ? '生成中…' : '生成新备用码'}
                </button>
                <button className="btn btn-outline btn-sm" disabled={saving} onClick={resetFlow}>
                  取消
                </button>
              </div>
            </div>
          )}

          <div className="uc-mfa-note">
            <Icon name="alert" size={13} />
            <div>
              <strong>当前生效范围（不夸大）</strong>
              <p>
                二次验证已拦在**独立登录接口**：密码登录与短信登录在验证码通过前不会建立会话。
                子系统跳转的 OIDC 授权码流程**尚未接入**第二因子 —— 那条链路需要在授权码流程里
                插入一个可恢复的中间态，本轮未做。这里如实写明，不做"已全面开启 2FA"的表述。
              </p>
            </div>
          </div>

          <p className="uc-mfa-foot">
            密钥以加密形式存储（AES-GCM），明文只在设置时显示一次；备用码只存哈希。
            停用会一并清空密钥与备用码。
          </p>
        </>
      )}
    </div>
  )
}
