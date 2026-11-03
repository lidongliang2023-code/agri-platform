/**
 * 用户中心 · 身份申请
 *
 * <p>数据来自 `GET /api/v1/sso/account/identity-applications`：接口返回**全部 6 类身份**
 * 及其当前状态（available / pending / approved / rejected / cancelled），
 * 页面据此渲染"去申请 / 审核中 / 已开通 / 已驳回"。</p>
 *
 * <p><b>审核通过只是单据状态变化</b>：不改主体绑定、不改权限。页面上把这点写明，
 * 避免用户以为"通过就能立刻用全部功能"。</p>
 */
import { useCallback, useEffect, useState } from 'react'
import type { JSX } from 'react'
import { Icon } from '@/components/Icon'

interface IdentityRow {
  code: string
  label: string
  status: string
  applicationId: string | null
  applyNote: string | null
  reviewRemark: string | null
  applyTime: string | null
  reviewTime: string | null
}

/** 业务能力：身份审核通过后 granted=true */
interface CapabilityRow {
  code: string
  label: string
  identityLabel: string
  description: string
  granted: boolean
  identityStatus: string
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

/** 身份状态展示元数据 */
const STATUS_META: Record<string, { label: string; color: string }> = {
  available: { label: '可申请', color: 'default' },
  pending: { label: '审核中', color: 'orange' },
  approved: { label: '已开通', color: 'green' },
  rejected: { label: '已驳回', color: 'red' },
  cancelled: { label: '已撤回', color: 'default' },
}

/** 身份图标 */
const IDENTITY_ICON: Record<string, string> = {
  wholesaler: 'cart',
  retailer: 'box',
  farmer: 'seed',
  coop_admin: 'users',
  service_provider: 'tool',
  government: 'shield',
}

interface ApplyForm {
  identityType: string
  subjectName: string
  creditCode: string
  businessPlace: string
  businessCategory: string
  annualVolume: string
  contactName: string
  contactPhone: string
  applyNote: string
}

const EMPTY_FORM: ApplyForm = {
  identityType: '',
  subjectName: '',
  creditCode: '',
  businessPlace: '',
  businessCategory: '',
  annualVolume: '',
  contactName: '',
  contactPhone: '',
  applyNote: '',
}

/**
 * 身份申请页面
 *
 * @returns 页面内容
 */
export function IdentityApply(): JSX.Element {
  const [rows, setRows] = useState<IdentityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState<ApplyForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [capabilities, setCapabilities] = useState<CapabilityRow[]>([])

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const [data, capabilityData] = await Promise.all([
        api<{ identities?: IdentityRow[] }>('/api/v1/sso/account/identity-applications'),
        api<{ capabilities?: CapabilityRow[] }>('/api/v1/sso/account/capabilities'),
      ])
      setRows(data?.identities ?? [])
      setCapabilities(capabilityData?.capabilities ?? [])
    } catch (e) {
      setError((e as Error).message || '身份申请加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openApply = (row: IdentityRow): void => {
    setForm({ ...EMPTY_FORM, identityType: row.code })
    setNotice('')
  }

  const submit = async (): Promise<void> => {
    if (!form) return
    if (!form.subjectName.trim()) {
      setError('请填写主体名称')
      return
    }
    setSaving(true)
    setError('')
    try {
      await api('/api/v1/sso/account/identity-applications', {
        method: 'POST',
        body: JSON.stringify({
          identityType: form.identityType,
          subjectName: form.subjectName.trim(),
          creditCode: form.creditCode.trim() || null,
          businessPlace: form.businessPlace.trim() || null,
          businessCategory: form.businessCategory.trim() || null,
          annualVolume: form.annualVolume.trim() || null,
          contactName: form.contactName.trim() || null,
          contactPhone: form.contactPhone.trim() || null,
          applyNote: form.applyNote.trim() || null,
        }),
      })
      setNotice('身份申请已提交，等待平台审核')
      setForm(null)
      await load()
    } catch (e) {
      setError((e as Error).message || '提交失败')
    } finally {
      setSaving(false)
    }
  }

  const cancel = async (row: IdentityRow): Promise<void> => {
    if (!row.applicationId) return
    setSaving(true)
    setError('')
    try {
      await api(`/api/v1/sso/account/identity-applications/${row.applicationId}`, { method: 'DELETE' })
      setNotice(`已撤回「${row.label}」申请`)
      await load()
    } catch (e) {
      setError((e as Error).message || '撤回失败')
    } finally {
      setSaving(false)
    }
  }

  const approvedCount = rows.filter((row) => row.status === 'approved').length

  return (
    <div className="uc-id">
      <div className="uc-id-head">
        <div>
          <strong>可申请身份 {rows.length} 类 · 已开通 {approvedCount} 类</strong>
          <small>一个账号可以同时持有多个身份，切换身份即切换可用的业务能力</small>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => void load()} disabled={loading}>
          刷新
        </button>
      </div>

      {!loading && (
        <div className="uc-cap-strip">
          <span className="uc-cap-strip-label">已开通能力</span>
          {capabilities.some((item) => item.granted) ? (
            capabilities.filter((item) => item.granted).map((item) => (
              <b key={item.code} className="uc-cap-chip" title={item.description}>{item.label}</b>
            ))
          ) : (
            <small className="uc-muted">暂无 —— 对应业务身份审核通过后自动生效</small>
          )}
        </div>
      )}

      {notice && <div className="account-notice">{notice}</div>}
      {error && <div className="account-error">{error}</div>}
      {loading && <div className="card empty">正在加载身份…</div>}

      {!loading && !error && (
        <ul className="uc-id-list">
          {rows.map((row) => {
            const meta = STATUS_META[row.status] ?? STATUS_META.available
            const canApply = row.status === 'available' || row.status === 'rejected' || row.status === 'cancelled'
            return (
              <li key={row.code} className={row.status === 'approved' ? 'on' : ''}>
                <span className="uc-id-icon">
                  <Icon name={IDENTITY_ICON[row.code] ?? 'user'} size={18} />
                </span>
                <div className="uc-id-body">
                  <div className="uc-id-title">
                    <strong>{row.label}</strong>
                    <span className={`uc-status ${meta.color}`}>{meta.label}</span>
                  </div>
                  <small>
                    {row.status === 'pending'
                      ? `提交于 ${String(row.applyTime ?? '').replace('T', ' ').slice(0, 16)}，等待平台审核`
                      : row.status === 'approved'
                        ? `开通于 ${String(row.reviewTime ?? '').replace('T', ' ').slice(0, 16)}`
                        : row.status === 'rejected'
                          ? `驳回原因：${row.reviewRemark || '未填写'}`
                          : '尚未申请'}
                  </small>
                </div>
                <div className="uc-id-actions">
                  {canApply && (
                    <button className="btn btn-outline btn-sm" disabled={saving} onClick={() => openApply(row)}>
                      {row.status === 'available' ? '去申请' : '重新申请'}
                    </button>
                  )}
                  {row.status === 'pending' && (
                    <button className="btn btn-outline btn-sm" disabled={saving} onClick={() => void cancel(row)}>
                      撤回
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {form && (
        <div className="uc-id-mask" onClick={() => setForm(null)}>
          <div className="uc-id-modal" onClick={(event) => event.stopPropagation()}>
            <h3>申请身份：{rows.find((row) => row.code === form.identityType)?.label ?? form.identityType}</h3>
            <label>
              主体名称 <span className="uc-id-req">*</span>
              <input
                value={form.subjectName}
                placeholder="如 金乡县金穗大蒜专业合作社"
                onChange={(event) => setForm({ ...form, subjectName: event.target.value })}
              />
            </label>
            <div className="uc-id-row">
              <label>
                统一社会信用代码
                <input
                  value={form.creditCode}
                  placeholder="选填"
                  onChange={(event) => setForm({ ...form, creditCode: event.target.value })}
                />
              </label>
              <label>
                经营场所
                <input
                  value={form.businessPlace}
                  placeholder="选填"
                  onChange={(event) => setForm({ ...form, businessPlace: event.target.value })}
                />
              </label>
            </div>
            <div className="uc-id-row">
              <label>
                经营品类
                <input
                  value={form.businessCategory}
                  placeholder="选填"
                  onChange={(event) => setForm({ ...form, businessCategory: event.target.value })}
                />
              </label>
              <label>
                年交易量
                <input
                  value={form.annualVolume}
                  placeholder="选填，如 800 吨"
                  onChange={(event) => setForm({ ...form, annualVolume: event.target.value })}
                />
              </label>
            </div>
            <div className="uc-id-row">
              <label>
                联系人
                <input
                  value={form.contactName}
                  placeholder="选填"
                  onChange={(event) => setForm({ ...form, contactName: event.target.value })}
                />
              </label>
              <label>
                联系电话
                <input
                  value={form.contactPhone}
                  placeholder="选填"
                  onChange={(event) => setForm({ ...form, contactPhone: event.target.value })}
                />
              </label>
            </div>
            <label>
              申请说明
              <textarea
                rows={3}
                value={form.applyNote}
                placeholder="简要说明经营情况与申请用途"
                onChange={(event) => setForm({ ...form, applyNote: event.target.value })}
              />
            </label>
            <div className="uc-id-modal-actions">
              <button className="btn btn-outline btn-sm" onClick={() => setForm(null)} disabled={saving}>
                取消
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => void submit()} disabled={saving}>
                提交申请
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="uc-msg-foot">
        <Icon name="alert" size={13} />
        <span>
          审核通过只代表身份申请单已批准；对应的业务权限由平台按角色另行开通，可能需要一点时间。
        </span>
      </p>
    </div>
  )
}
