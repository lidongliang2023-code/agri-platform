/**
 * 用户中心 · 资质证照
 *
 * <p>数据来自 `GET /api/v1/sso/account/certificates`：返回**我名下全部主体**的证照，
 * 每条带服务端现算的到期状态（`valid` / `expiring` / `expired` / `permanent`）。</p>
 *
 * <p><b>为什么到期状态不在前端算</b>：前端算一次、后端算一次，两边迟早对不上；
 * 也不落库 —— 存下来的状态今天对、明天就错了。</p>
 *
 * <p><b>影像件走受控上传</b>：图片统一传到
 * `POST /api/v1/sso/account/businesses/{merchantId}/certification-files?kind=certificate`，
 * 后端返回受控地址并校验归属；页面不再让用户手填 URL。
 * 服务端保存证照时也会校验地址必须是本服务生成的，任意外链会被拒绝。</p>
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { JSX } from 'react'
import { Icon } from '@/components/Icon'

interface CertType {
  code: string
  label: string
}

interface CertRow {
  id: string
  merchantId: string
  merchantName: string | null
  certType: string
  certName: string
  certNo: string | null
  issueOrg: string | null
  issueDate: string | null
  expireDate: string | null
  expireState: string
  daysToExpire: number | null
  fileUrl: string | null
  remark: string | null
}

interface CertPayload {
  records?: CertRow[]
  types?: CertType[]
  expiringCount?: number
  expiredCount?: number
}

interface MerchantOption {
  merchantId: string
  merchantName: string
  memberType?: string | null
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
  let body: ApiBody<T>
  try {
    body = (await response.json()) as ApiBody<T>
  } catch {
    throw new Error('服务返回异常，请稍后重试')
  }
  if (!response.ok || body.code !== 0) {
    throw new Error(body.message || '请求失败')
  }
  return body.data as T
}

/** 图片上传（multipart，不能带 Content-Type，交给浏览器生成 boundary） */
async function uploadCertImage(merchantId: string, file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  const response = await fetch(
    `/api/v1/sso/account/businesses/${merchantId}/certification-files?kind=certificate`,
    { method: 'POST', credentials: 'include', body: form },
  )
  const body = (await response.json()) as ApiBody<{ url?: string }>
  if (!response.ok || body.code !== 0 || !body.data?.url) {
    throw new Error(body.message || '图片上传失败')
  }
  return body.data.url
}

/** 到期状态展示元数据 */
const STATE_META: Record<string, { label: string; color: string }> = {
  valid: { label: '有效', color: 'green' },
  expiring: { label: '即将到期', color: 'orange' },
  expired: { label: '已过期', color: 'red' },
  permanent: { label: '长期有效', color: 'blue' },
}

interface CertForm {
  id?: string
  merchantId: string
  certType: string
  certName: string
  certNo: string
  issueOrg: string
  issueDate: string
  expireDate: string
  permanent: boolean
  fileUrl: string
  remark: string
}

const EMPTY_FORM: CertForm = {
  merchantId: '',
  certType: 'business_license',
  certName: '',
  certNo: '',
  issueOrg: '',
  issueDate: '',
  expireDate: '',
  permanent: false,
  fileUrl: '',
  remark: '',
}

const fmtDate = (value: string | null): string => (value ? value.slice(0, 10) : '—')

/**
 * 资质证照页面
 *
 * @returns 页面内容
 */
export function Certificates(): JSX.Element {
  const [rows, setRows] = useState<CertRow[]>([])
  const [types, setTypes] = useState<CertType[]>([])
  const [merchants, setMerchants] = useState<MerchantOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState<CertForm | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<CertRow | null>(null)
  const [pendingDelete, setPendingDelete] = useState<CertRow | null>(null)

  const [subjectFilter, setSubjectFilter] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [keyword, setKeyword] = useState('')

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const [certs, summary] = await Promise.all([
        api<CertPayload>('/api/v1/sso/account/certificates'),
        api<{ merchants?: MerchantOption[] }>('/api/v1/sso/account/summary'),
      ])
      setRows(certs?.records ?? [])
      setTypes(certs?.types ?? [])
      setMerchants(
        (summary?.merchants ?? []).map((item) => ({
          merchantId: String(item.merchantId ?? ''),
          merchantName: String(item.merchantName ?? '未命名主体'),
          memberType: item.memberType ?? null,
        })),
      )
    } catch (e) {
      setError((e as Error).message || '证照加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const typeLabel = useMemo(() => {
    const map = new Map<string, string>()
    types.forEach((item) => map.set(item.code, item.label))
    return map
  }, [types])

  const stats = useMemo(() => {
    const counter = { valid: 0, expiring: 0, expired: 0, permanent: 0 }
    rows.forEach((row) => {
      const key = row.expireState as keyof typeof counter
      if (key in counter) counter[key] += 1
    })
    return counter
  }, [rows])

  const visibleRows = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return rows.filter((row) => {
      if (subjectFilter && row.merchantId !== subjectFilter) return false
      if (stateFilter && row.expireState !== stateFilter) return false
      if (!kw) return true
      return [row.certName, row.certNo, row.issueOrg, row.merchantName]
        .filter(Boolean)
        .some((text) => String(text).toLowerCase().includes(kw))
    })
  }, [rows, subjectFilter, stateFilter, keyword])

  const openCreate = (): void => {
    // 名称默认跟随第一个证照类型，减少一次手输；用户可随时改
    setForm({
      ...EMPTY_FORM,
      merchantId: merchants[0]?.merchantId ?? '',
      certName: types[0]?.label ?? '营业执照',
    })
    setFieldErrors({})
    setError('')
    setNotice('')
  }

  const openEdit = (row: CertRow): void => {
    setForm({
      id: row.id,
      merchantId: row.merchantId,
      certType: row.certType,
      certName: row.certName,
      certNo: row.certNo ?? '',
      issueOrg: row.issueOrg ?? '',
      issueDate: row.issueDate ?? '',
      expireDate: row.expireDate ?? '',
      permanent: !row.expireDate,
      fileUrl: row.fileUrl ?? '',
      remark: row.remark ?? '',
    })
    setFieldErrors({})
    setError('')
    setNotice('')
  }

  const patch = (next: Partial<CertForm>): void => {
    setForm((current) => (current ? { ...current, ...next } : current))
    setError('')
    setFieldErrors({})
  }

  const validate = (target: CertForm): boolean => {
    const errors: Record<string, string> = {}
    if (!target.merchantId) errors.merchantId = '请选择所属主体'
    if (!target.certName.trim()) errors.certName = '请填写证照名称'
    if (!target.permanent && !target.expireDate) errors.expireDate = '请填写有效期至，或勾选长期有效'
    if (target.issueDate && target.expireDate && target.expireDate < target.issueDate) {
      errors.expireDate = '有效期不能早于发证日期'
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      setError('请先修正表单中标红的字段')
      return false
    }
    return true
  }

  const save = async (): Promise<void> => {
    if (!form) return
    if (!validate(form)) return
    setSaving(true)
    setError('')
    try {
      const payload = {
        merchantId: form.merchantId,
        certType: form.certType,
        certName: form.certName.trim(),
        certNo: form.certNo.trim() || null,
        issueOrg: form.issueOrg.trim() || null,
        issueDate: form.issueDate || null,
        expireDate: form.permanent ? null : form.expireDate,
        fileUrl: form.fileUrl || null,
        remark: form.remark.trim() || null,
      }
      if (form.id) {
        await api(`/api/v1/sso/account/certificates/${form.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
        setNotice('证照已更新')
      } else {
        await api('/api/v1/sso/account/certificates', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        setNotice('证照已新增')
      }
      setForm(null)
      await load()
    } catch (e) {
      setError((e as Error).message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const uploadImage = async (file: File): Promise<void> => {
    if (!form) return
    if (!form.merchantId) {
      setError('请先选择所属主体，再上传影像件')
      return
    }
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setError('仅支持 JPG / PNG / WEBP 图片')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('单张图片不能超过 5MB')
      return
    }
    setUploading(true)
    setError('')
    try {
      const url = await uploadCertImage(form.merchantId, file)
      patch({ fileUrl: url })
    } catch (e) {
      setError((e as Error).message || '图片上传失败')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const remove = async (): Promise<void> => {
    if (!pendingDelete) return
    const target = pendingDelete
    setSaving(true)
    setError('')
    try {
      await api(`/api/v1/sso/account/certificates/${target.id}`, { method: 'DELETE' })
      setPendingDelete(null)
      setNotice(`已删除：${target.certName}`)
      await load()
    } catch (e) {
      setError((e as Error).message || '删除失败')
    } finally {
      setSaving(false)
    }
  }

  const typeOptions = types.length > 0 ? types : [
    { code: 'business_license', label: '营业执照' },
    { code: 'food_production', label: '食品生产许可证' },
    { code: 'food_business', label: '食品经营许可证' },
    { code: 'organic', label: '有机认证' },
    { code: 'gmo_free', label: '非转基因证明' },
    { code: 'other', label: '其他资质' },
  ]

  return (
    <div className="uc-cert">
      <div className="uc-cert-stats">
        <div><span>证照总数</span><strong>{rows.length}</strong></div>
        <div className="warn"><span>即将到期</span><strong>{stats.expiring}</strong></div>
        <div className="danger"><span>已过期</span><strong>{stats.expired}</strong></div>
        <div><span>长期有效</span><strong>{stats.permanent}</strong></div>
      </div>

      {(stats.expired > 0 || stats.expiring > 0) && (
        <div className="uc-cert-alert">
          <Icon name="alert" size={16} />
          <span>
            {stats.expired > 0 ? `${stats.expired} 张证照已过期，` : ''}
            {stats.expiring > 0 ? `${stats.expiring} 张将在 30 天内到期，` : ''}
            请及时换证并在下方更新有效期。
          </span>
        </div>
      )}

      {notice && <div className="account-notice">{notice}</div>}
      {error && <div className="account-error">{error}</div>}

      <div className="uc-cert-toolbar">
        <div className="uc-cert-filters">
          <select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)} aria-label="按主体筛选">
            <option value="">全部主体</option>
            {merchants.map((item) => (
              <option key={item.merchantId} value={item.merchantId}>{item.merchantName}</option>
            ))}
          </select>
          <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)} aria-label="按状态筛选">
            <option value="">全部状态</option>
            <option value="valid">有效</option>
            <option value="expiring">即将到期</option>
            <option value="expired">已过期</option>
            <option value="permanent">长期有效</option>
          </select>
          <input
            value={keyword}
            placeholder="搜索证照名称 / 编号 / 发证机关"
            aria-label="搜索证照"
            onChange={(event) => setKeyword(event.target.value)}
          />
        </div>
        <div className="uc-cert-actions">
          <button className="btn btn-outline btn-sm" onClick={() => void load()} disabled={loading}>刷新</button>
          <button className="btn btn-primary btn-sm" onClick={openCreate} disabled={merchants.length === 0}>
            新增证照
          </button>
        </div>
      </div>

      {loading && <div className="card empty">正在加载证照…</div>}

      {!loading && !error && merchants.length === 0 && (
        <div className="card empty">
          还没有经营主体，先到「我的组织」创建主体后再维护资质证照。
        </div>
      )}

      {!loading && merchants.length > 0 && visibleRows.length === 0 && (
        <div className="card empty">
          {rows.length === 0
            ? '暂无证照。营业执照、食品生产/经营许可等都可以在这里登记。'
            : '没有符合筛选条件的证照，换个条件试试。'}
        </div>
      )}

      {!loading && visibleRows.length > 0 && (
        <div className="uc-cert-wrap">
          <table className="uc-cert-table">
            <thead>
              <tr>
                <th>证照</th>
                <th>所属主体</th>
                <th>有效期</th>
                <th>状态</th>
                <th>影像件</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const meta = STATE_META[row.expireState] ?? STATE_META.valid
                return (
                  <tr key={row.id}>
                    <td>
                      <div className="uc-cert-name">{row.certName}</div>
                      <div className="uc-cert-sub">
                        {typeLabel.get(row.certType) ?? row.certType}
                        {row.certNo ? ` · ${row.certNo}` : ''}
                      </div>
                      {row.issueOrg && <div className="uc-cert-sub">发证：{row.issueOrg}</div>}
                    </td>
                    <td>{row.merchantName || '—'}</td>
                    <td className="uc-cert-mono">
                      {row.expireState === 'permanent' ? '长期有效' : fmtDate(row.expireDate)}
                      <div className="uc-cert-sub">
                        {row.issueDate ? `发证 ${fmtDate(row.issueDate)}` : '发证日期未填'}
                      </div>
                    </td>
                    <td>
                      <span className={`uc-status ${meta.color}`}>{meta.label}</span>
                      {row.expireState === 'expiring' && row.daysToExpire !== null && (
                        <div className="uc-cert-days">剩 {row.daysToExpire} 天</div>
                      )}
                    </td>
                    <td>
                      {row.fileUrl ? (
                        <button type="button" className="uc-cert-thumb" onClick={() => setPreview(row)} title="查看影像件">
                          <img src={row.fileUrl} alt={`${row.certName} 影像件`} loading="lazy" />
                        </button>
                      ) : (
                        <span className="uc-cert-sub">未上传</span>
                      )}
                    </td>
                    <td>
                      <div className="uc-cert-row-actions">
                        <button className="btn btn-outline btn-sm" disabled={saving} onClick={() => openEdit(row)}>
                          编辑
                        </button>
                        <button className="btn btn-outline btn-sm uc-danger" disabled={saving} onClick={() => setPendingDelete(row)}>
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <div className="uc-cert-mask" onClick={() => !saving && setForm(null)}>
          <form className="uc-cert-modal" onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => { event.preventDefault(); void save() }}>
            <h3>{form.id ? '编辑证照' : '新增证照'}</h3>
            <div className="uc-cert-row">
              <label>
                所属主体
                <select
                  value={form.merchantId}
                  disabled={Boolean(form.id)}
                  onChange={(event) => patch({ merchantId: event.target.value, fileUrl: '' })}
                >
                  {merchants.map((item) => (
                    <option key={item.merchantId} value={item.merchantId}>{item.merchantName}</option>
                  ))}
                </select>
                {form.id && <small className="uc-field-hint">证照挂在主体上，创建后不能换主体。</small>}
                {fieldErrors.merchantId && <small className="uc-field-error">{fieldErrors.merchantId}</small>}
              </label>
              <label>
                证照类型
                <select
                  value={form.certType}
                  onChange={(event) => {
                    const code = event.target.value
                    const label = typeOptions.find((item) => item.code === code)?.label ?? ''
                    // 名称还是默认值/空值时随类型自动带出，避免每张都手输
                    const autoName = !form.certName.trim()
                      || typeOptions.some((item) => item.label === form.certName.trim())
                    patch({ certType: code, certName: autoName ? label : form.certName })
                  }}
                >
                  {typeOptions.map((item) => (
                    <option key={item.code} value={item.code}>{item.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="uc-cert-row">
              <label>
                证照名称
                <input value={form.certName} placeholder="如 营业执照"
                  onChange={(event) => patch({ certName: event.target.value })} />
                {fieldErrors.certName && <small className="uc-field-error">{fieldErrors.certName}</small>}
              </label>
              <label>
                证照编号
                <input value={form.certNo} placeholder="选填"
                  onChange={(event) => patch({ certNo: event.target.value })} />
              </label>
            </div>
            <div className="uc-cert-row">
              <label>
                发证机关
                <input value={form.issueOrg} placeholder="选填"
                  onChange={(event) => patch({ issueOrg: event.target.value })} />
              </label>
              <label>
                发证日期
                <input type="date" value={form.issueDate}
                  onChange={(event) => patch({ issueDate: event.target.value })} />
              </label>
            </div>
            <label>
              有效期至
              <input type="date" value={form.permanent ? '' : form.expireDate} disabled={form.permanent}
                onChange={(event) => patch({ expireDate: event.target.value })} />
              <span className="uc-cert-check">
                <input type="checkbox" checked={form.permanent}
                  onChange={(event) => patch({ permanent: event.target.checked, expireDate: '' })} />
                长期有效（无到期日）
              </span>
              {fieldErrors.expireDate && <small className="uc-field-error">{fieldErrors.expireDate}</small>}
            </label>

            <div className="uc-cert-field">
              <span>影像件 <small className="uc-field-hint">选填 · JPG/PNG/WEBP · ≤5MB</small></span>
              <div className="uc-cert-upload">
                {form.fileUrl ? (
                  <div className="uc-cert-upload-preview">
                    <img src={form.fileUrl} alt="证照影像件预览" />
                    <div>
                      <button type="button" className="btn btn-outline btn-sm" disabled={uploading || saving}
                        onClick={() => fileInputRef.current?.click()}>
                        {uploading ? '上传中…' : '重新上传'}
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={uploading || saving}
                        onClick={() => patch({ fileUrl: '' })}>移除</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="uc-cert-upload-btn" disabled={uploading || saving}
                    onClick={() => fileInputRef.current?.click()}>
                    <Icon name="file" size={16} />
                    {uploading ? '上传中…' : '选择图片上传'}
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void uploadImage(file)
                  }}
                />
              </div>
            </div>

            <label>
              备注
              <input value={form.remark} placeholder="选填"
                onChange={(event) => patch({ remark: event.target.value })} />
            </label>

            <p className="uc-cert-hint">有效期留空表示长期有效；30 天内到期会在列表里标「即将到期」。</p>
            <div className="uc-cert-modal-actions">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setForm(null)} disabled={saving || uploading}>
                取消
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving || uploading}>
                {saving ? '保存中…' : uploading ? '图片上传中…' : '保存'}
              </button>
            </div>
          </form>
        </div>
      )}

      {pendingDelete && (
        <div className="uc-cert-mask" onClick={() => !saving && setPendingDelete(null)}>
          <div className="uc-cert-modal uc-cert-confirm" onClick={(event) => event.stopPropagation()}>
            <h3>删除证照</h3>
            <p>
              确定删除「{pendingDelete.certName}」吗？删除后该证照不再出现在列表和到期提醒里，
              已上传的影像件也不会再展示。
            </p>
            <div className="uc-cert-modal-actions">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setPendingDelete(null)} disabled={saving}>
                取消
              </button>
              <button type="button" className="btn btn-primary btn-sm uc-btn-danger" onClick={() => void remove()} disabled={saving}>
                {saving ? '删除中…' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div className="uc-cert-mask" onClick={() => setPreview(null)}>
          <div className="uc-cert-viewer" onClick={(event) => event.stopPropagation()}>
            <div className="uc-cert-viewer-head">
              <div>
                <strong>{preview.certName}</strong>
                <small>{typeLabel.get(preview.certType) ?? preview.certType}{preview.certNo ? ` · ${preview.certNo}` : ''}</small>
              </div>
              <button type="button" className="account-modal-close" onClick={() => setPreview(null)}>×</button>
            </div>
            {preview.fileUrl && <img src={preview.fileUrl} alt={`${preview.certName} 影像件`} />}
          </div>
        </div>
      )}

      <p className="uc-msg-foot">
        <Icon name="alert" size={13} />
        <span>
          证照挂在经营主体上（不属于个人），同一主体的成员都能看到；到期状态由服务端按当天日期现算，
          影像件存放于平台受控目录，不对外公开直链。
        </span>
      </p>
    </div>
  )
}
