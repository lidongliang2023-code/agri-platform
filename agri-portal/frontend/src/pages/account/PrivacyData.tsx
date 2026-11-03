/**
 * 用户中心 · 隐私与数据
 *
 * <p>三块内容，**只有第三块是点一下就生效的**：</p>
 * <ol>
 *   <li>数据导出 —— 提交申请，运营跨库打包后交付（系统内只流转状态，不生成文件）</li>
 *   <li>账号注销 —— 提交申请，运营核对无未结清事项后人工办理（**不会**点一下就删号）</li>
 *   <li>第三方授权撤回 —— 真实动作，直接调 `DELETE /sso/account/bindings/{provider}` 立刻生效</li>
 * </ol>
 *
 * <p>把"能立刻做的"和"要人工办的"分开放，是因为混在一起最容易让人误以为
 * 点了注销按钮账号就没了。页面上的文案必须说清楚，宁可显得啰嗦。</p>
 */
import { useCallback, useEffect, useState } from 'react'
import type { JSX } from 'react'
import { Icon } from '@/components/Icon'

interface PrivacyType {
  code: string
  label: string
  description: string
}

interface PrivacyRow {
  id: string
  requestType: string
  reason: string | null
  scope: string | null
  status: string
  handlerName: string | null
  handleRemark: string | null
  submitTime: string | null
  handleTime: string | null
}

interface GrantRow {
  provider: string
  externalAccount: string | null
  displayName: string | null
  boundAt: string | null
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

const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: '待处理', className: 'pending' },
  processing: { label: '处理中', className: 'processing' },
  completed: { label: '已办结', className: 'completed' },
  rejected: { label: '未通过', className: 'rejected' },
  cancelled: { label: '已撤回', className: 'cancelled' },
}

const PROVIDER_LABEL: Record<string, string> = {
  wechat: '微信',
  alipay: '支付宝',
  dingtalk: '钉钉',
}

interface RequestForm {
  requestType: string
  reason: string
  scope: string
}

/**
 * 隐私与数据页面
 *
 * @returns 页面内容
 */
export function PrivacyData(): JSX.Element {
  const [types, setTypes] = useState<PrivacyType[]>([])
  const [rows, setRows] = useState<PrivacyRow[]>([])
  const [grants, setGrants] = useState<GrantRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState<RequestForm | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const data = await api<{
        types?: PrivacyType[]
        records?: PrivacyRow[]
        grants?: GrantRow[]
      }>('/api/v1/sso/account/privacy-requests')
      setTypes(data?.types ?? [])
      setRows(data?.records ?? [])
      setGrants(data?.grants ?? [])
    } catch (e) {
      setError((e as Error).message || '隐私与数据加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openForm = (type: string): void => {
    setForm({ requestType: type, reason: '', scope: '' })
    setNotice('')
    setError('')
  }

  const submit = async (): Promise<void> => {
    if (!form) return
    if (form.requestType === 'deletion' && !form.reason.trim()) {
      setError('注销申请请填写理由')
      return
    }
    setSaving(true)
    setError('')
    try {
      await api('/api/v1/sso/account/privacy-requests', {
        method: 'POST',
        body: JSON.stringify({
          requestType: form.requestType,
          reason: form.reason.trim() || null,
          scope: form.scope.trim() || null,
        }),
      })
      setNotice(
        form.requestType === 'deletion'
          ? '注销申请已提交，运营会先与你确认未结清事项，办结前账号仍可正常使用'
          : '数据导出申请已提交，运营会在 5 个工作日内处理',
      )
      setForm(null)
      await load()
    } catch (e) {
      setError((e as Error).message || '提交失败')
    } finally {
      setSaving(false)
    }
  }

  const cancel = async (row: PrivacyRow): Promise<void> => {
    setSaving(true)
    setError('')
    try {
      await api(`/api/v1/sso/account/privacy-requests/${row.id}`, { method: 'DELETE' })
      setNotice('申请已撤回')
      await load()
    } catch (e) {
      setError((e as Error).message || '撤回失败')
    } finally {
      setSaving(false)
    }
  }

  /** 撤回第三方授权：立刻生效，不需要审批 */
  const revokeGrant = async (grant: GrantRow): Promise<void> => {
    setSaving(true)
    setError('')
    try {
      await api(`/api/v1/sso/account/bindings/${grant.provider}`, { method: 'DELETE' })
      setNotice(`已撤回「${PROVIDER_LABEL[grant.provider] ?? grant.provider}」授权`)
      await load()
    } catch (e) {
      setError((e as Error).message || '撤回授权失败')
    } finally {
      setSaving(false)
    }
  }

  const openType = (code: string): PrivacyRow | undefined =>
    rows.find((row) => row.requestType === code && (row.status === 'pending' || row.status === 'processing'))

  const typeLabel = (code: string): string =>
    types.find((type) => type.code === code)?.label ?? code

  return (
    <div className="uc-pv">
      <div className="uc-pv-head">
        <div>
          <strong>隐私与数据</strong>
          <small>
            数据导出与账号注销需要平台人工处理；第三方授权撤回是立刻生效的
          </small>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => void load()} disabled={loading}>
          刷新
        </button>
      </div>

      {notice && <div className="account-notice">{notice}</div>}
      {error && <div className="account-error">{error}</div>}
      {loading && <div className="card empty">正在加载…</div>}

      {!loading && (
        <>
          <ul className="uc-pv-list">
            {types.map((type) => {
              const open = openType(type.code)
              const meta = open ? STATUS_META[open.status] ?? STATUS_META.pending : null
              return (
                <li key={type.code}>
                  <span className="uc-pv-icon">
                    <Icon name={type.code === 'deletion' ? 'alert' : 'file'} size={18} />
                  </span>
                  <div className="uc-pv-body">
                    <div className="uc-pv-title">
                      <strong>{type.label}</strong>
                      {meta && <span className={`uc-pv-status ${meta.className}`}>{meta.label}</span>}
                    </div>
                    <small>{type.description}</small>
                  </div>
                  <div className="uc-pv-actions">
                    {open ? (
                      <button
                        className="btn btn-outline btn-sm"
                        disabled={saving}
                        onClick={() => void cancel(open)}
                      >
                        撤回申请
                      </button>
                    ) : (
                      <button
                        className={`btn btn-sm ${type.code === 'deletion' ? 'uc-pv-danger' : 'btn-primary'}`}
                        disabled={saving}
                        onClick={() => openForm(type.code)}
                      >
                        {type.code === 'deletion' ? '申请注销' : '申请导出'}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>

          <div className="uc-pv-section">
            <div className="uc-pv-section-head">
              <strong>第三方授权</strong>
              <small>撤回后该渠道将无法登录本平台，不影响账号本身</small>
            </div>
            {grants.length === 0 ? (
              <p className="uc-pv-empty">
                当前没有已授权的第三方渠道。如需绑定，请到「第三方绑定」页登记。
              </p>
            ) : (
              <ul className="uc-pv-grants">
                {grants.map((grant) => (
                  <li key={grant.provider}>
                    <span className="uc-pv-grant-name">
                      {PROVIDER_LABEL[grant.provider] ?? grant.provider}
                    </span>
                    <span className="uc-pv-grant-account">
                      {grant.displayName || grant.externalAccount || '—'}
                    </span>
                    <button
                      className="btn btn-outline btn-sm"
                      disabled={saving}
                      onClick={() => void revokeGrant(grant)}
                    >
                      撤回授权
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="uc-pv-section">
            <div className="uc-pv-section-head">
              <strong>申请记录</strong>
              <small>共 {rows.length} 条</small>
            </div>
            {rows.length === 0 ? (
              <p className="uc-pv-empty">还没有提交过数据导出或账号注销申请。</p>
            ) : (
              <ul className="uc-pv-records">
                {rows.map((row) => {
                  const meta = STATUS_META[row.status] ?? STATUS_META.pending
                  return (
                    <li key={row.id}>
                      <div className="uc-pv-record-top">
                        <span className="uc-pv-record-type">{typeLabel(row.requestType)}</span>
                        <span className={`uc-pv-status ${meta.className}`}>{meta.label}</span>
                        <span className="uc-pv-record-time">
                          {(row.submitTime ?? '').replace('T', ' ').slice(0, 16)}
                        </span>
                      </div>
                      {row.reason && <p className="uc-pv-record-reason">理由：{row.reason}</p>}
                      {row.scope && <p className="uc-pv-record-reason">范围：{row.scope}</p>}
                      {row.handleRemark && (
                        <div className="uc-pv-reply">
                          <span>
                            {row.handlerName || '平台运营'} 处理
                            {row.handleTime ? `　${row.handleTime.replace('T', ' ').slice(0, 16)}` : ''}
                          </span>
                          <p>{row.handleRemark}</p>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <p className="uc-pv-foot">
            说明：数据导出与账号注销由运营在系统外执行，办结后本页显示处理说明；
            系统不会在提交时自动导出或删除任何数据。
          </p>
        </>
      )}

      {form && (
        <div className="uc-pv-mask" onClick={() => !saving && setForm(null)}>
          <div className="uc-pv-modal" onClick={(event) => event.stopPropagation()}>
            <h3>{form.requestType === 'deletion' ? '申请注销账号' : '申请数据导出'}</h3>
            {form.requestType === 'deletion' && (
              <p className="uc-pv-warn">
                注销后账号将无法登录。存在未结清交易、未到期合同或主体负责人身份时，
                运营会先与你确认再办理 —— 提交本申请**不会**立即删除账号。
              </p>
            )}
            <label>
              {form.requestType === 'deletion' ? '注销理由（必填）' : '申请理由（选填）'}
              <textarea
                value={form.reason}
                maxLength={500}
                rows={3}
                placeholder={
                  form.requestType === 'deletion'
                    ? '例如：不再使用本平台，请协助注销'
                    : '例如：需要留存历史交易记录'
                }
                onChange={(event) => setForm({ ...form, reason: event.target.value })}
              />
            </label>
            {form.requestType === 'export' && (
              <label>
                导出范围（选填）
                <input
                  value={form.scope}
                  maxLength={255}
                  placeholder="例如：账号资料 + 近一年订单；留空表示全部"
                  onChange={(event) => setForm({ ...form, scope: event.target.value })}
                />
              </label>
            )}
            <div className="uc-pv-modal-actions">
              <button className="btn btn-outline btn-sm" onClick={() => setForm(null)} disabled={saving}>
                取消
              </button>
              <button
                className={`btn btn-sm ${form.requestType === 'deletion' ? 'uc-pv-danger' : 'btn-primary'}`}
                onClick={() => void submit()}
                disabled={saving}
              >
                {saving ? '提交中…' : '提交申请'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
