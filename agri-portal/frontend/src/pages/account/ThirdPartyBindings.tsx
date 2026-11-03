/**
 * 用户中心 · 第三方绑定
 *
 * <p>数据来自 `GET /api/v1/sso/account/bindings`：接口返回**全部渠道**（含未绑定的），
 * 页面据此渲染"已绑定 / 去绑定"两种状态 —— 只返回已绑定的记录，前端就不知道还能绑什么。</p>
 *
 * <p><b>必须说清楚的一件事</b>：本部署**没有接入第三方 OAuth**。这里的"绑定"是登记
 * 外部账号标识（openid / unionid / 手机号），供后续对接登录与消息推送时对账使用，
 * **不是**"点一下就完成了微信授权"。页面上把这句话写在显眼处，避免用户误以为已联通。</p>
 */
import { useCallback, useEffect, useState } from 'react'
import type { JSX } from 'react'
import { Icon } from '@/components/Icon'

interface BindingRow {
  provider: string
  providerLabel: string
  bound: boolean
  externalAccount: string | null
  displayName: string | null
  bindAt: string | null
}

interface ApiBody<T> {
  code: number
  message?: string
  data?: T
}

/** 账号中心系列接口认 SSO 会话 Cookie */
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

/**
 * 第三方绑定页面
 *
 * @returns 页面内容
 */
export function ThirdPartyBindings(): JSX.Element {
  const [rows, setRows] = useState<BindingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  /** 正在编辑的渠道（null 表示弹窗关闭） */
  const [editing, setEditing] = useState<BindingRow | null>(null)
  const [account, setAccount] = useState('')
  const [displayName, setDisplayName] = useState('')

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const data = await api<BindingRow[]>('/api/v1/sso/account/bindings')
      setRows(data ?? [])
    } catch (e) {
      setError((e as Error).message || '绑定信息加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openEdit = (row: BindingRow): void => {
    setEditing(row)
    setAccount(row.externalAccount ?? '')
    setDisplayName(row.displayName ?? '')
    setNotice('')
  }

  const closeEdit = (): void => {
    setEditing(null)
    setAccount('')
    setDisplayName('')
  }

  /** 保存绑定 */
  const save = async (): Promise<void> => {
    if (!editing) return
    const value = account.trim()
    if (!value) {
      setError('请填写外部账号标识')
      return
    }
    setBusy(true)
    setError('')
    try {
      await api('/api/v1/sso/account/bindings', {
        method: 'POST',
        body: JSON.stringify({
          provider: editing.provider,
          externalAccount: value,
          displayName: displayName.trim() || null,
        }),
      })
      setNotice(`已登记${editing.providerLabel}账号：${value}`)
      closeEdit()
      await load()
    } catch (e) {
      setError((e as Error).message || '保存失败')
    } finally {
      setBusy(false)
    }
  }

  /** 解除绑定 */
  const unbind = async (row: BindingRow): Promise<void> => {
    setBusy(true)
    setError('')
    try {
      await api(`/api/v1/sso/account/bindings/${row.provider}`, { method: 'DELETE' })
      setNotice(`已解除${row.providerLabel}绑定`)
      await load()
    } catch (e) {
      setError((e as Error).message || '解绑失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="uc-bind">
      <div className="card uc-bind-tip">
        <Icon name="alert" size={16} />
        <div>
          <strong>本部署尚未接入第三方 OAuth</strong>
          <p>
            这里的绑定是<strong>登记外部账号标识</strong>（openid / unionid / 手机号），
            用于后续对接登录与消息推送时把两边账号对上；不会跳转微信/支付宝授权页，也不代表已完成授权。
          </p>
        </div>
      </div>

      {notice && <div className="account-notice">{notice}</div>}
      {error && <div className="account-error">{error}</div>}
      {loading && <div className="card empty">正在加载绑定信息…</div>}

      {!loading && (
        <ul className="uc-bind-list">
          {rows.map((row) => (
            <li key={row.provider} className={row.bound ? 'on' : ''}>
              <span className="uc-bind-icon">
                <Icon name={row.provider === 'dingtalk' ? 'users' : 'globe'} size={18} />
              </span>
              <div className="uc-bind-body">
                <div className="uc-bind-title">
                  <strong>{row.providerLabel}</strong>
                  {row.bound ? <span className="tag tag-tech">已绑定</span> : <span className="uc-bind-off">未绑定</span>}
                </div>
                <small>
                  {row.bound
                    ? `${row.externalAccount ?? ''}${row.displayName ? ` · ${row.displayName}` : ''}　绑定于 ${String(row.bindAt ?? '').slice(0, 16)}`
                    : '尚未登记该渠道的账号标识'}
                </small>
              </div>
              <div className="uc-bind-actions">
                <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => openEdit(row)}>
                  {row.bound ? '改绑' : '去绑定'}
                </button>
                {row.bound && (
                  <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => void unbind(row)}>
                    解绑
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <div className="uc-bind-modal-mask" onClick={closeEdit}>
          <div className="uc-bind-modal" onClick={(event) => event.stopPropagation()}>
            <h3>{editing.bound ? '改绑' : '绑定'}{editing.providerLabel}账号</h3>
            <label>
              外部账号标识
              <input
                value={account}
                placeholder="openid / unionid / 手机号"
                onChange={(event) => setAccount(event.target.value)}
              />
            </label>
            <label>
              昵称（可选）
              <input
                value={displayName}
                placeholder="该渠道上的昵称，仅用于展示"
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </label>
            <div className="uc-bind-modal-actions">
              <button className="btn btn-outline btn-sm" onClick={closeEdit} disabled={busy}>
                取消
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => void save()} disabled={busy}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
