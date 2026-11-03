/**
 * 用户中心 · 个人实名认证（独立菜单）
 *
 * <p>2026-10-30 从「身份与认证」页拆出：个人实名是账号级动作，和主体创建 / 企业认证不是一回事，
 * 混在同一页里既看不清进度，也容易误点。本页只做个人实名这一条链路：</p>
 *
 * <ol>
 *   <li>登记身份证 OCR 资料（姓名 / 证件号 / 有效期 / 联系方式）</li>
 *   <li>人脸活体检测</li>
 *   <li>公安二要素核验（姓名 + 身份证号与草稿比对）</li>
 *   <li>提交平台运营审核</li>
 * </ol>
 *
 * <p><b>数据口径</b>：全部来自父级已经拉取的 {@code GET /api/v1/sso/account/summary} 的
 * {@code realName} 字段，不在前端另造状态；每次写操作后调用 {@code onRefresh} 重新读一遍，
 * 页面显示的是服务端真实状态。</p>
 */
import { useEffect, useState } from 'react'
import type { FormEvent, JSX } from 'react'
import { Icon } from '@/components/Icon'

/** summary.realName 的字段子集（与 SsoAccountController#identityView 对齐） */
export interface RealnameRecord {
  identityNo?: string
  realName: string
  idNoMasked: string
  validStart: string | null
  validEnd: string | null
  contactPhone: string | null
  address: string | null
  businessType: string | null
  email: string | null
  policeVerified: boolean
  livenessVerified: boolean
  verificationChannel: string | null
  policeVerifiedAt: string | null
  livenessVerifiedAt: string | null
  status: string
  submitTime: string
  reviewRemark: string | null
}

interface Props {
  /** 父级 summary 里的 realName；null 表示尚未办理 */
  record: RealnameRecord | null
  /** 写操作成功后重新拉取 summary */
  onRefresh: () => Promise<void> | void
  /** 外部（如从主体卡片点「去认证」）要求展开资料表单时递增，0 表示不触发 */
  openFormSignal?: number
}

interface ApiBody<T> {
  code: number
  message?: string
  data?: T
}

async function api<T>(path: string, init?: RequestInit): Promise<ApiBody<T>> {
  const response = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  return (await response.json()) as ApiBody<T>
}

const BUSINESS_TYPES = ['家庭农场', '农民专业合作社成员', '个体采购户', '农产品经纪人', '其他']

const STATUS_META: Record<string, { label: string; tone: string; desc: string }> = {
  draft: { label: '草稿待核验', tone: 'ghost', desc: '资料已保存，还需完成人脸活体与公安二要素核验后才能提交审核。' },
  rejected: { label: '审核驳回', tone: 'red', desc: '平台审核未通过，请按驳回意见修改资料后重新完成核验。' },
  pending: { label: '审核中', tone: 'amber', desc: '资料已提交平台运营审核，审核通过后实名状态自动生效。' },
  verified: { label: '已认证', tone: 'green', desc: '个人实名认证已通过，可作为交易、签约与金融申请的主体身份依据。' },
}

const EMPTY_FORM = {
  realName: '',
  idCard: '',
  contactPhone: '',
  address: '',
  businessType: BUSINESS_TYPES[0],
  validStart: '',
  validEnd: '',
  email: '',
}

/** 18 位身份证校验位，与后端 IdNumberUtil 同口径 */
function validIdNo(value: string): boolean {
  const id = value.trim().toUpperCase()
  if (!/^\d{17}[\dX]$/.test(id)) return false
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
  const codes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']
  let sum = 0
  for (let i = 0; i < 17; i += 1) sum += Number(id[i]) * weights[i]
  return codes[sum % 11] === id[17]
}

const fmtTime = (value: string | null | undefined): string =>
  value ? String(value).replace('T', ' ').slice(0, 16) : '—'

/**
 * 个人实名认证页面
 *
 * @param props 父级 summary 中的实名记录与刷新回调
 * @returns 页面内容
 */
export function PersonalRealname({ record, onRefresh, openFormSignal = 0 }: Props): JSX.Element {
  const [formOpen, setFormOpen] = useState(false)
  const [policeOpen, setPoliceOpen] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [policeForm, setPoliceForm] = useState({ realName: '', idCard: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const status = record?.status ?? ''
  const meta = STATUS_META[status] ?? {
    label: '未办理',
    tone: 'ghost',
    desc: '尚未办理个人实名认证。登记身份证资料并完成活体与公安核验后提交审核即可。',
  }
  const editable = !record || status === 'draft' || status === 'rejected'

  useEffect(() => {
    if (openFormSignal > 0) setFormOpen(true)
  }, [openFormSignal])

  // 换账号或刷新后把已有资料带进表单，避免"看着有资料、点编辑却是空表单"
  useEffect(() => {
    if (!record) return
    setForm((current) => ({
      realName: record.realName || current.realName,
      idCard: current.idCard,
      contactPhone: record.contactPhone ?? current.contactPhone,
      address: record.address ?? current.address,
      businessType: record.businessType || current.businessType,
      validStart: record.validStart ?? current.validStart,
      validEnd: record.validEnd ?? current.validEnd,
      email: record.email ?? current.email,
    }))
    setPoliceForm((current) => ({ ...current, realName: record.realName || current.realName }))
  }, [record])

  const patch = (next: Partial<typeof EMPTY_FORM>): void => {
    setForm((previous) => ({ ...previous, ...next }))
    setError('')
    setFieldErrors({})
  }

  const validate = (): boolean => {
    const errors: Record<string, string> = {}
    const name = form.realName.trim()
    if (!name) errors.realName = '请填写真实姓名'
    else if (name.length < 2 || name.length > 20) errors.realName = '姓名应为 2-20 个字符'
    if (!validIdNo(form.idCard)) errors.idCard = '身份证号应为 18 位且校验位正确'
    if (!/^1[3-9]\d{9}$/.test(form.contactPhone.trim())) errors.contactPhone = '请填写正确的 11 位手机号'
    if (!form.address.trim()) errors.address = '请填写常住地址'
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = '邮箱格式不正确'
    if (form.validStart && form.validEnd && form.validStart > form.validEnd) {
      errors.validEnd = '有效期止不能早于有效期起'
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      setError('请先修正表单中标红的字段')
      return false
    }
    return true
  }

  const run = async (action: () => Promise<void>): Promise<void> => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await action()
    } catch (e) {
      setError((e as Error).message || '操作失败，请稍后重试')
    } finally {
      setBusy(false)
    }
  }

  const saveDraft = (event: FormEvent): void => {
    event.preventDefault()
    if (!validate()) return
    void run(async () => {
      const result = await api('/api/v1/sso/account/real-name', {
        method: 'POST',
        body: JSON.stringify({
          realName: form.realName.trim(),
          idCard: form.idCard.trim().toUpperCase(),
          contactPhone: form.contactPhone.trim(),
          address: form.address.trim(),
          businessType: form.businessType,
          validStart: form.validStart,
          validEnd: form.validEnd,
          email: form.email.trim(),
        }),
      })
      if (result.code !== 0) throw new Error(result.message ?? '实名资料保存失败')
      await onRefresh()
      setFormOpen(false)
      setNotice('身份证资料已保存，请继续完成人脸活体与公安二要素核验')
    })
  }

  const doLiveness = (): void => {
    void run(async () => {
      const result = await api('/api/v1/sso/account/real-name/liveness', { method: 'POST' })
      if (result.code !== 0) throw new Error(result.message ?? '人脸活体检测失败')
      await onRefresh()
      setNotice('人脸活体检测已通过')
    })
  }

  const doPolice = (event: FormEvent): void => {
    event.preventDefault()
    if (!policeForm.realName.trim() || !validIdNo(policeForm.idCard)) {
      setError('请输入与证件一致的姓名和 18 位身份证号')
      return
    }
    void run(async () => {
      const result = await api('/api/v1/sso/account/real-name/police', {
        method: 'POST',
        body: JSON.stringify({ realName: policeForm.realName.trim(), idCard: policeForm.idCard.trim().toUpperCase() }),
      })
      if (result.code !== 0) throw new Error(result.message ?? '公安二要素核验失败')
      await onRefresh()
      setPoliceOpen(false)
      setPoliceForm((current) => ({ ...current, idCard: '' }))
      setNotice('公安二要素核验已通过，可提交实名审核')
    })
  }

  const submitReview = (): void => {
    void run(async () => {
      const result = await api('/api/v1/sso/account/real-name/submit', { method: 'POST' })
      if (result.code !== 0) throw new Error(result.message ?? '提交审核失败')
      await onRefresh()
      setNotice('实名认证已提交平台审核')
    })
  }

  const steps = [
    { label: '资料登记', done: Boolean(record) },
    { label: '人脸活体', done: Boolean(record?.livenessVerified) },
    { label: '公安比对', done: Boolean(record?.policeVerified) },
    { label: '提交审核', done: ['pending', 'verified'].includes(status) },
  ]

  const canLiveness = editable && Boolean(record) && !record?.livenessVerified
  const canPolice = editable && Boolean(record?.livenessVerified) && !record?.policeVerified
  const canSubmit = editable && Boolean(record?.livenessVerified) && Boolean(record?.policeVerified)
  const rejectedRemark = record?.reviewRemark ?? ''

  return (
    <div className="uc-realname">
      <section className={`card account-card uc-realname-hero tone-${meta.tone}`}>
        <div className="uc-realname-hero-main">
          <span className="uc-realname-hero-icon"><Icon name="shield" size={22} /></span>
          <div>
            <h2>个人实名认证 <span className={`account-status ${meta.tone}`}>{meta.label}</span></h2>
            <p>{meta.desc}</p>
          </div>
        </div>
        <div className="realname-progress">
          {steps.map((step, index) => (
            <div className={`realname-progress-step ${step.done ? 'done' : ''}`} key={step.label}>
              <span>{step.done ? '✓' : index + 1}</span>
              <small>{step.label}</small>
            </div>
          ))}
        </div>
      </section>

      {error !== '' && <div className="account-error">{error}</div>}
      {notice !== '' && <div className="account-notice">{notice}</div>}

      {status === 'verified' && record && (
        <section className="card account-card">
          <div className="account-card-head">
            <h2>认证信息</h2>
            <span>如需变更请联系平台运营发起信息变更</span>
          </div>
          <div className="account-info-list">
            <div><span>姓名</span><strong>{record.realName}</strong></div>
            <div><span>证件类型</span><strong>居民身份证</strong></div>
            <div><span>证件号码</span><strong>{record.idNoMasked}</strong></div>
            <div><span>有效期</span><strong>{record.validStart || '—'} 至 {record.validEnd || '—'}</strong></div>
            <div><span>联系电话</span><strong>{record.contactPhone || '—'}</strong></div>
            <div><span>常住地址</span><strong>{record.address || '—'}</strong></div>
            <div><span>认证渠道</span><strong>{record.verificationChannel || '公安二要素 + 活体'}</strong></div>
            <div><span>审核通过时间</span><strong>{fmtTime(record.submitTime)}</strong></div>
          </div>
        </section>
      )}

      {status === 'pending' && record && (
        <section className="card account-card">
          <div className="account-card-head"><h2>已提交审核</h2><span>{fmtTime(record.submitTime)}</span></div>
          <p className="uc-muted">
            平台运营正在核验资料，通常 1-2 个工作日内出结果；审核结果会以站内信通知。
            审核期间资料不可修改，如填错请联系平台运营驳回后重新提交。
          </p>
          <div className="uc-realname-summary">
            <div><span>姓名</span><strong>{record.realName}</strong></div>
            <div><span>证件号码</span><strong>{record.idNoMasked}</strong></div>
            <div><span>人脸活体</span><strong>{record.livenessVerified ? '已通过' : '待检测'}</strong></div>
            <div><span>公安二要素</span><strong>{record.policeVerified ? '已通过' : '待核验'}</strong></div>
          </div>
        </section>
      )}

      {editable && (
        <section className="card account-card">
          <div className="account-card-head">
            <h2>{record ? '继续完成核验' : '办理实名认证'}</h2>
            <span>{record ? `资料提交于 ${fmtTime(record.submitTime)}` : '约需 3 分钟'}</span>
          </div>

          {status === 'rejected' && rejectedRemark !== '' && (
            <div className="account-error">审核驳回：{rejectedRemark}</div>
          )}

          {record && (
            <div className="uc-realname-record">
              <div><span>姓名</span><strong>{record.realName}</strong></div>
              <div><span>证件号码</span><strong>{record.idNoMasked}</strong></div>
              <div><span>有效期</span><strong>{record.validStart || '—'} 至 {record.validEnd || '—'}</strong></div>
              <div><span>联系电话</span><strong>{record.contactPhone || '—'}</strong></div>
            </div>
          )}

          <div className="realname-action-grid">
            <button type="button" className={`realname-action ${record?.livenessVerified ? 'done' : ''}`}
              disabled={busy || !canLiveness} onClick={doLiveness}>
              <span>{record?.livenessVerified ? '✓' : '1'}</span>
              <div>
                <strong>{record?.livenessVerified ? '人脸活体已通过' : '人脸活体检测'}</strong>
                <small>{record?.livenessVerified ? '通过时间 ' + fmtTime(record.livenessVerifiedAt) : '按提示完成眨眼、转头等动作'}</small>
              </div>
            </button>
            <button type="button" className={`realname-action ${record?.policeVerified ? 'done' : ''}`}
              disabled={busy || !canPolice} onClick={() => {
                setPoliceOpen(true)
                setError('')
                setPoliceForm({ realName: record?.realName ?? form.realName, idCard: '' })
              }}>
              <span>{record?.policeVerified ? '✓' : '2'}</span>
              <div>
                <strong>{record?.policeVerified ? '公安二要素已通过' : '公安二要素核验'}</strong>
                <small>{record?.policeVerified
                  ? '通过时间 ' + fmtTime(record.policeVerifiedAt)
                  : record?.livenessVerified ? '输入姓名与身份证号与草稿比对' : '需先通过人脸活体检测'}</small>
              </div>
            </button>
          </div>

          {policeOpen && (
            <form className="uc-realname-police" onSubmit={doPolice}>
              <div className="realname-form-head">
                <strong>公安二要素核验</strong>
                <span>与已保存的证件资料比对，号码只用于本次核验，不会回显</span>
              </div>
              <div className="account-form-grid">
                <label>姓名
                  <input className="input" value={policeForm.realName}
                    onChange={(event) => setPoliceForm({ ...policeForm, realName: event.target.value })} />
                </label>
                <label>身份证号
                  <input className="input" value={policeForm.idCard} maxLength={18}
                    placeholder="18 位身份证号"
                    onChange={(event) => setPoliceForm({ ...policeForm, idCard: event.target.value.replace(/\s/g, '').toUpperCase() })} />
                </label>
              </div>
              <div className="account-form-actions">
                <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? '核验中…' : '提交核验'}</button>
                <button type="button" className="btn btn-ghost" onClick={() => setPoliceOpen(false)}>取消</button>
              </div>
            </form>
          )}

          <div className="realname-action-footer">
            <button type="button" className={record ? 'btn btn-ghost' : 'btn btn-primary'} disabled={busy}
              onClick={() => { setFormOpen(!formOpen); setError('') }}>
              {formOpen ? '收起资料' : record ? '修改证件资料' : '填写身份证资料'}
            </button>
            {record && (
              <button type="button" className="btn btn-primary"
                disabled={busy || !canSubmit} onClick={submitReview}>
                {busy ? '提交中…' : '提交实名审核'}
              </button>
            )}
          </div>
          {record && !canSubmit && (
            <p className="uc-field-hint">
              提交前需依次完成：人脸活体 → 公安二要素核验。
            </p>
          )}

          {formOpen && (
            <form className="account-realname-form" onSubmit={saveDraft}>
              <div className="realname-form-head">
                <strong>身份证资料</strong>
                <span>姓名、证件号与有效期将用于公安二要素比对</span>
              </div>
              <div className="account-form-grid">
                <label>真实姓名
                  <input className="input" value={form.realName} placeholder="与身份证一致"
                    onChange={(event) => patch({ realName: event.target.value })} />
                  {fieldErrors.realName && <small className="uc-field-error">{fieldErrors.realName}</small>}
                </label>
                <label>身份证号
                  <input className="input" value={form.idCard} maxLength={18} placeholder="18 位身份证号"
                    onChange={(event) => patch({ idCard: event.target.value.replace(/\s/g, '').toUpperCase() })} />
                  {fieldErrors.idCard && <small className="uc-field-error">{fieldErrors.idCard}</small>}
                </label>
                <label>证件有效期起
                  <input className="input" type="date" value={form.validStart}
                    onChange={(event) => patch({ validStart: event.target.value })} />
                </label>
                <label>证件有效期止
                  <input className="input" type="date" value={form.validEnd}
                    onChange={(event) => patch({ validEnd: event.target.value })} />
                  {fieldErrors.validEnd && <small className="uc-field-error">{fieldErrors.validEnd}</small>}
                </label>
                <label>联系电话
                  <input className="input" type="tel" value={form.contactPhone} maxLength={11}
                    onChange={(event) => patch({ contactPhone: event.target.value.replace(/\D/g, '') })} />
                  {fieldErrors.contactPhone && <small className="uc-field-error">{fieldErrors.contactPhone}</small>}
                </label>
                <label>经营类型
                  <select className="select" value={form.businessType}
                    onChange={(event) => patch({ businessType: event.target.value })}>
                    {BUSINESS_TYPES.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
              </div>
              <label>常住地址
                <input className="input" value={form.address} placeholder="省 / 市 / 区 / 详细地址"
                  onChange={(event) => patch({ address: event.target.value })} />
                {fieldErrors.address && <small className="uc-field-error">{fieldErrors.address}</small>}
              </label>
              <label>联系邮箱 <small className="uc-muted">选填</small>
                <input className="input" type="email" value={form.email}
                  onChange={(event) => patch({ email: event.target.value })} />
                {fieldErrors.email && <small className="uc-field-error">{fieldErrors.email}</small>}
              </label>
              <div className="account-form-actions">
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? '保存中…' : '保存资料并进入核验'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setFormOpen(false)}>取消</button>
              </div>
              <p className="uc-field-hint">
                身份证号明文只在提交时短暂使用，入库前转为掩码与加盐摘要，运营端也看不到明文。
              </p>
            </form>
          )}
        </section>
      )}

      {(status === 'pending' || status === 'verified') && record && (
        <section className="card account-card">
          <div className="account-card-head"><h2>办理记录</h2></div>
          <ul className="uc-realname-timeline">
            <li className="done">
              <span>资料登记</span>
              <small>{fmtTime(record.submitTime)}</small>
            </li>
            <li className={record.livenessVerified ? 'done' : ''}>
              <span>人脸活体</span>
              <small>{record.livenessVerified ? fmtTime(record.livenessVerifiedAt) : '待检测'}</small>
            </li>
            <li className={record.policeVerified ? 'done' : ''}>
              <span>公安二要素</span>
              <small>{record.policeVerified ? fmtTime(record.policeVerifiedAt) : '待核验'}</small>
            </li>
            <li className={status === 'verified' ? 'done' : ''}>
              <span>平台审核</span>
              <small>{status === 'verified' ? '已通过' : '审核中'}</small>
            </li>
          </ul>
        </section>
      )}

      <section className="uc-realname-tips">
        <div className="card">
          <div className="account-card-head"><h2>为什么需要实名认证</h2></div>
          <p className="uc-muted">实名认证用于确认交易主体身份，是参与大宗交易、在线签约与申请供应链金融的前提。</p>
        </div>
        <div className="card">
          <div className="account-card-head"><h2>信息如何保护</h2></div>
          <p className="uc-muted">身份证号仅用于核验与合规留痕，平台只保存掩码与加盐摘要，前台与运营端都不展示明文。</p>
        </div>
        <div className="card">
          <div className="account-card-head"><h2>办理须知</h2></div>
          <ul className="uc-realname-rules">
            <li>姓名、身份证号须与证件完全一致</li>
            <li>一个身份证号只能绑定一个平台账号</li>
            <li>审核中或已认证的资料不能自行修改</li>
          </ul>
        </div>
      </section>
    </div>
  )
}
