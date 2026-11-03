/**
 * 用户中心 · 跨模块入口（我的服务）
 *
 * <p>列出平台各子系统的入口，并给出**三态**：</p>
 * <ul>
 *   <li>{@code available} —— 前置条件都满足，进去就能用</li>
 *   <li>{@code blocked}   —— 缺关键前置（如没有经营主体），进去也做不了事</li>
 * </ul>
 *
 * <p>判定全部由服务端根据真实数据算出（个人实名状态、主体与认证状态、已通过的身份申请），
 * 前端只负责展示，**不自己判断、也不给"看起来合理"的门槛**。缺什么就直说缺什么，
 * 并给出补的办法 —— 这比让人点进去撞一堵墙有用。</p>
 */
import { useCallback, useEffect, useState } from 'react'
import type { JSX } from 'react'
import { Icon } from '@/components/Icon'

interface ModuleRow {
  code: string
  name: string
  description: string
  entryUrl: string
  icon: string
  state: 'available' | 'blocked'
  missing: string[]
  missingLabels: string[]
}

interface ModuleProfile {
  accountName: string | null
  personalVerified: boolean
  hasMerchant: boolean
  merchantVerified: boolean
  hasBusinessIdentity: boolean
}

interface ApiBody<T> {
  code: number
  message?: string
  data?: T
}

async function api<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: 'include' })
  const body = (await response.json()) as ApiBody<T>
  if (!response.ok || body.code !== 0) {
    throw new Error(body.message || '请求失败')
  }
  return body.data as T
}

/** 缺口 → 补齐入口（点一下直接跳到对应页面，而不是只说"去认证吧"） */
const FIX_LINK: Record<string, { label: string; hash: string }> = {
  merchant: { label: '去创建/加入主体', hash: '#/account/business' },
  merchant_verified: { label: '去完成主体认证', hash: '#/account/business' },
  personal_verified: { label: '去完成个人实名', hash: '#/account/business' },
  business_identity: { label: '去申请业务身份', hash: '#/account/org' },
}

/**
 * 跨模块入口页面
 *
 * @returns 页面内容
 */
export function CrossModule(): JSX.Element {
  const [modules, setModules] = useState<ModuleRow[]>([])
  const [profile, setProfile] = useState<ModuleProfile | null>(null)
  const [availableCount, setAvailableCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const data = await api<{
        modules?: ModuleRow[]
        profile?: ModuleProfile
        availableCount?: number
      }>('/api/v1/sso/account/modules')
      setModules(data?.modules ?? [])
      setProfile(data?.profile ?? null)
      setAvailableCount(data?.availableCount ?? 0)
    } catch (e) {
      setError((e as Error).message || '模块列表加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /** 进入模块：新标签打开，不在当前页跳走（用户中心不该被冲掉） */
  const open = (row: ModuleRow): void => {
    window.open(row.entryUrl, '_blank', 'noopener')
  }

  return (
    <div className="uc-cm">
      <div className="uc-cm-head">
        <div>
          <strong>
            共 {modules.length} 个子系统 · 当前可进入 {availableCount} 个
          </strong>
          <small>
            可进入的数量由你的实名、主体与身份状态实时算出，不是写死的清单
          </small>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => void load()} disabled={loading}>
          刷新
        </button>
      </div>

      {error && <div className="account-error">{error}</div>}
      {loading && <div className="card empty">正在加载模块…</div>}

      {!loading && !error && (
        <>
          {profile && (
            <ul className="uc-cm-profile">
              <li className={profile.personalVerified ? 'on' : ''}>
                <Icon name={profile.personalVerified ? 'check' : 'close'} size={13} />
                个人实名{profile.personalVerified ? '已通过' : '未通过'}
              </li>
              <li className={profile.hasMerchant ? 'on' : ''}>
                <Icon name={profile.hasMerchant ? 'check' : 'close'} size={13} />
                经营主体{profile.hasMerchant ? '已加入' : '未加入'}
              </li>
              <li className={profile.merchantVerified ? 'on' : ''}>
                <Icon name={profile.merchantVerified ? 'check' : 'close'} size={13} />
                主体认证{profile.merchantVerified ? '已通过' : '未通过'}
              </li>
              <li className={profile.hasBusinessIdentity ? 'on' : ''}>
                <Icon name={profile.hasBusinessIdentity ? 'check' : 'close'} size={13} />
                业务身份{profile.hasBusinessIdentity ? '已开通' : '未开通'}
              </li>
            </ul>
          )}

          <ul className="uc-cm-list">
            {modules.map((row) => (
              <li key={row.code} className={row.state === 'available' ? 'on' : ''}>
                <span className="uc-cm-icon">
                  <Icon name={row.icon} size={18} />
                </span>
                <div className="uc-cm-body">
                  <div className="uc-cm-title">
                    <strong>{row.name}</strong>
                    <span className={`uc-cm-state ${row.state}`}>
                      {row.state === 'available' ? '可进入' : '待完善'}
                    </span>
                  </div>
                  <small>{row.description}</small>
                  {row.missingLabels.length > 0 && (
                    <div className="uc-cm-missing">
                      {row.missing.map((code, index) => {
                        const fix = FIX_LINK[code]
                        return (
                          <span key={code}>
                            {row.missingLabels[index]}
                            {fix && (
                              <a href={fix.hash} className="uc-cm-fix">
                                {fix.label}
                              </a>
                            )}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
                <div className="uc-cm-actions">
                  <button
                    className={`btn btn-sm ${row.state === 'available' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => open(row)}
                  >
                    进入
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <p className="uc-cm-foot">
            说明：状态为「待完善」时仍可进入，只是对应功能会被子系统自己拦下来；
            本页不代替子系统做权限判断，只把缺什么提前告诉你。
          </p>
        </>
      )}
    </div>
  )
}
