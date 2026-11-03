/**
 * 用户中心 · 授权管理
 *
 * <p>回答一个问题：**谁、用什么方式在代表我访问平台。**</p>
 *
 * <p>四类授权全部来自已有数据源，**没有单独的授权表** —— 另建一份必然与真实状态不一致：</p>
 * <ul>
 *   <li>第三方渠道 ← `platform_user_binding`（与「第三方绑定」「隐私与数据」同源）</li>
 *   <li>登录会话 ← 与「登录设备」同源</li>
 *   <li>业务身份 ← 已通过的身份申请</li>
 *   <li>主体成员身份 ← 我在各主体里是负责人还是成员</li>
 * </ul>
 *
 * <p>本页**不做细粒度权限配置**：角色 → 菜单/操作的映射属于主体 RBAC，在「我的角色与权限」维护。
 * 这里只做"对外授权清单 + 撤回"，避免出现第二套权限配置入口。</p>
 */
import { useCallback, useEffect, useState } from 'react'
import type { JSX } from 'react'
import { Icon } from '@/components/Icon'

interface Channel {
  provider: string
  label: string
  externalAccount: string | null
  displayName: string | null
  boundAt: string | null
}

interface Session {
  sessionKey: string
  device: string
  userAgent: string
  ip: string
  loginAt: number
  current: boolean
}

interface Identity {
  code: string
  label: string
  reviewTime: string | null
  reviewerName: string | null
}

interface Membership {
  merchantId: string
  merchantName: string | null
  roleInMerchant: string
  roleLabel: string
  active: boolean
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

function formatTime(value: string | null | undefined): string {
  return (value ?? '').replace('T', ' ').slice(0, 16)
}

function formatMillis(value: number | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * 授权管理页面
 *
 * @returns 页面内容
 */
export function Authorizations(): JSX.Element {
  const [channels, setChannels] = useState<Channel[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [identities, setIdentities] = useState<Identity[]>([])
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const data = await api<{
        channels?: Channel[]
        sessions?: Session[]
        identities?: Identity[]
        memberships?: Membership[]
      }>('/api/v1/sso/account/authorizations')
      setChannels(data?.channels ?? [])
      setSessions(data?.sessions ?? [])
      setIdentities(data?.identities ?? [])
      setMemberships(data?.memberships ?? [])
    } catch (e) {
      setError((e as Error).message || '授权信息加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /** 撤回第三方渠道授权（与「隐私与数据」页同一个动作） */
  const revokeChannel = async (row: Channel): Promise<void> => {
    setSaving(`ch:${row.provider}`)
    setError('')
    try {
      await api(`/api/v1/sso/account/bindings/${row.provider}`, { method: 'DELETE' })
      setNotice(`已撤回「${row.label}」的访问授权`)
      await load()
    } catch (e) {
      setError((e as Error).message || '撤回失败')
    } finally {
      setSaving('')
    }
  }

  /** 下线某个登录会话 */
  const revokeSession = async (row: Session): Promise<void> => {
    setSaving(`se:${row.sessionKey}`)
    setError('')
    try {
      await api(`/api/v1/sso/account/sessions/${row.sessionKey}`, { method: 'DELETE' })
      setNotice(`已下线「${row.device}」的登录会话`)
      await load()
    } catch (e) {
      setError((e as Error).message || '下线失败')
    } finally {
      setSaving('')
    }
  }

  const otherSessions = sessions.filter((row) => !row.current).length

  return (
    <div className="uc-au">
      <div className="uc-au-head">
        <div>
          <strong>谁在代表我访问平台</strong>
          <small>
            四类授权都来自既有数据源，本页只做汇总与撤回，不另存一份授权记录
          </small>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => void load()} disabled={loading}>
          刷新
        </button>
      </div>

      {notice && <div className="account-notice">{notice}</div>}
      {error && <div className="account-error">{error}</div>}
      {loading && <div className="card empty">正在加载授权信息…</div>}

      {!loading && !error && (
        <>
          <ul className="uc-au-stats">
            <li>
              <span>第三方渠道授权</span>
              <strong>{channels.length}</strong>
            </li>
            <li>
              <span>活跃登录会话</span>
              <strong>{sessions.length}</strong>
              {otherSessions > 0 && <small>其他设备 {otherSessions} 台</small>}
            </li>
            <li>
              <span>已开通业务身份</span>
              <strong>{identities.length}</strong>
            </li>
            <li>
              <span>主体成员身份</span>
              <strong>{memberships.length}</strong>
            </li>
          </ul>

          {/* 1) 第三方渠道 */}
          <section className="uc-au-sec">
            <div className="uc-au-sec-head">
              <h4>第三方渠道授权</h4>
              <small>授权后该渠道可识别你的账号；撤回不影响账号本身</small>
            </div>
            {channels.length === 0 ? (
              <p className="uc-au-empty">
                当前没有第三方渠道持有你的访问授权。如需绑定，去「第三方绑定」登记。
              </p>
            ) : (
              <ul className="uc-au-list">
                {channels.map((row) => (
                  <li key={row.provider}>
                    <span className="uc-au-icon">
                      <Icon name="globe" size={16} />
                    </span>
                    <div className="uc-au-body">
                      <div className="uc-au-title">
                        <strong>{row.label}</strong>
                        <span className="uc-au-tag">可撤回</span>
                      </div>
                      <small>
                        {row.displayName || row.externalAccount || '—'}
                        {row.boundAt ? `　授权于 ${formatTime(row.boundAt)}` : ''}
                      </small>
                    </div>
                    <button
                      className="btn btn-outline btn-sm"
                      disabled={saving !== ''}
                      onClick={() => void revokeChannel(row)}
                    >
                      {saving === `ch:${row.provider}` ? '撤回中…' : '撤回授权'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 2) 登录会话 */}
          <section className="uc-au-sec">
            <div className="uc-au-sec-head">
              <h4>登录会话</h4>
              <small>每个会话都是一次已建立的登录；下线后该设备需要重新登录</small>
            </div>
            <ul className="uc-au-list">
              {sessions.map((row) => (
                <li key={row.sessionKey}>
                  <span className="uc-au-icon">
                    <Icon name="cpu" size={16} />
                  </span>
                  <div className="uc-au-body">
                    <div className="uc-au-title">
                      <strong>{row.device || '未知设备'}</strong>
                      {row.current && <span className="uc-au-tag on">本机</span>}
                    </div>
                    <small>
                      {row.ip || '—'}　登录于 {formatMillis(row.loginAt)}
                    </small>
                  </div>
                  {row.current ? (
                    <span className="uc-au-muted">当前会话</span>
                  ) : (
                    <button
                      className="btn btn-outline btn-sm"
                      disabled={saving !== ''}
                      onClick={() => void revokeSession(row)}
                    >
                      {saving === `se:${row.sessionKey}` ? '下线中…' : '下线'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {/* 3) 业务身份 */}
          <section className="uc-au-sec">
            <div className="uc-au-sec-head">
              <h4>业务身份授权</h4>
              <small>身份决定你能进入哪些业务场景；具体权限由角色另行配置</small>
            </div>
            {identities.length === 0 ? (
              <p className="uc-au-empty">
                还没有已开通的业务身份。去「我的组织 → 业务身份」提交，审核通过后这里会显示。
              </p>
            ) : (
              <ul className="uc-au-chips">
                {identities.map((row) => (
                  <li key={row.code}>
                    <span className="uc-au-chip-name">{row.label}</span>
                    <small>
                      {row.reviewTime ? formatTime(row.reviewTime) : '—'}
                      {row.reviewerName ? `　${row.reviewerName}` : ''}
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 4) 主体成员身份 */}
          <section className="uc-au-sec">
            <div className="uc-au-sec-head">
              <h4>主体成员身份</h4>
              <small>你在各经营主体里以什么角色参与；负责人可管理成员与角色</small>
            </div>
            {memberships.length === 0 ? (
              <p className="uc-au-empty">
                还没有加入任何经营主体。去「身份与认证」创建或申请加入。
              </p>
            ) : (
              <ul className="uc-au-list">
                {memberships.map((row) => (
                  <li key={row.merchantId}>
                    <span className="uc-au-icon">
                      <Icon name="factory" size={16} />
                    </span>
                    <div className="uc-au-body">
                      <div className="uc-au-title">
                        <strong>{row.merchantName || row.merchantId}</strong>
                        <span className={`uc-au-tag ${row.roleInMerchant === 'owner' ? 'on' : ''}`}>
                          {row.roleLabel}
                        </span>
                        {row.active && <span className="uc-au-tag on">使用中</span>}
                      </div>
                      <small>主体 ID {row.merchantId}</small>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="uc-au-note">
            <Icon name="alert" size={13} />
            <div>
              <strong>细粒度权限不在这里配</strong>
              <p>
                角色 → 菜单/操作的映射属于经营主体的 RBAC，由主体管理员在
                <a href="#/account/roles">我的角色与权限</a> 维护。
                本页只回答"我有哪些对外授权"，不提供第二套权限配置入口 ——
                否则两处都能改，迟早不一致。
              </p>
            </div>
          </div>

          <p className="uc-au-foot">
            说明：第三方渠道的「撤回授权」与「隐私与数据」页是同一个动作（同源同接口），
            在任一页面撤回，另一页面同步生效。
          </p>
        </>
      )}
    </div>
  )
}
