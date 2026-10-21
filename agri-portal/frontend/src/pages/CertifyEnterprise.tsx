import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { activateCertification, saveSubject } from '../utils/onboarding'

const INDUSTRIES = ['粮油产业', '果蔬产业', '畜禽产业', '茶药产业', '饲料农资', '水产产业', '流通贸易', '加工制造', '其他']
const KINDS = ['有限责任公司', '股份有限公司', '农民专业合作社', '合伙企业', '个体工商户', '其他']

interface EnterpriseForm {
  companyName: string
  creditCode: string
  companyKind: string
  industry: string
  foundDate: string
  capital: string
  address: string
  scope: string
  contactName: string
  contactPhone: string
  email: string
  legalPerson: string
  agree: boolean
}

const EMPTY: EnterpriseForm = {
  companyName: '', creditCode: '', companyKind: KINDS[0], industry: INDUSTRIES[0],
  foundDate: '', capital: '', address: '', scope: '',
  contactName: '', contactPhone: '', email: '', legalPerson: '', agree: false,
}

export function CertifyEnterprise(): JSX.Element {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<EnterpriseForm>(EMPTY)
  const [error, setError] = useState('')
  const [savedAt, setSavedAt] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step])

  const patch = (next: Partial<EnterpriseForm>): void => {
    setForm((previous) => ({ ...previous, ...next }))
    setError('')
  }

  const profile = () => ({
    identity: 'enterprise' as const,
    companyName: form.companyName.trim(),
    creditCode: form.creditCode.trim(),
    industry: form.industry,
    address: form.address.trim(),
    contactName: form.contactName.trim(),
    contactPhone: form.contactPhone.trim(),
    legalPerson: form.legalPerson.trim(),
    attachNote: [
      `企业类型：${form.companyKind}`,
      form.foundDate ? `成立日期：${form.foundDate}` : '',
      form.capital ? `注册资本：${form.capital} 万元` : '',
      form.scope ? `经营范围：${form.scope}` : '',
      form.email ? `联系邮箱：${form.email}` : '',
      '门户企业认证表单提交',
    ].filter(Boolean).join('；'),
  })

  const saveDraft = async (): Promise<boolean> => {
    if (!validate(step)) return false
    setBusy(true)
    setError('')
    try {
      const result = await saveSubject(profile())
      if (result.code !== 0) {
        setError(result.message ?? '主体草稿保存失败，请先登录后重试')
        return false
      }
      setSavedAt(new Date().toLocaleTimeString('zh-CN', { hour12: false }))
      return true
    } catch {
      setError('无法连接平台接口，请确认后端已启动')
      return false
    } finally {
      setBusy(false)
    }
  }

  const validate = (target: number): boolean => {
    if (target >= 1) {
      if (!form.companyName.trim()) { setError('请填写企业名称'); return false }
      if (!/^[0-9A-Za-z]{15,18}$/.test(form.creditCode.trim())) { setError('统一社会信用代码应为 15-18 位字母数字'); return false }
      if (!form.address.trim()) { setError('请填写注册地址'); return false }
    }
    if (target >= 2) {
      if (!form.legalPerson.trim()) { setError('请填写法定代表人'); return false }
      if (!form.contactName.trim()) { setError('请填写联系人姓名'); return false }
      if (!/^1[3-9]\d{9}$/.test(form.contactPhone.trim())) { setError('请填写正确的 11 位手机号'); return false }
    }
    if (target >= 3 && !form.agree) {
      setError('请先确认资料真实有效并同意认证规则')
      return false
    }
    return true
  }

  const next = (): void => {
    if (!validate(step)) return
    setStep(Math.min(3, step + 1))
  }

  const submit = async (): Promise<void> => {
    if (!validate(3)) return
    if (!await saveDraft()) return
    setBusy(true)
    try {
      const result = await activateCertification()
      if (result.code !== 0) {
        setError(result.message ?? '认证提交失败，请稍后重试')
        return
      }
      setDone(true)
    } catch {
      setError('无法连接平台接口，请确认后端已启动')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <section className="portal-cert-hero portal-cert-hero-small">
        <div className="container">
          <div className="tag tag-tech"><Icon name="factory" size={13} />企业认证</div>
          <h1>企业认证办理</h1>
          <p>先登记主体与联系人资料；证件上传、人脸核验与对公打款验证需登录后在认证中心完成。</p>
        </div>
      </section>

      <section className="container portal-cert-body portal-wizard-layout">
        <div className="card portal-wizard-card">
          <div className="card-h">
            <h3><Icon name="factory" size={18} />企业认证资料登记</h3>
            <span className="tag tag-ghost">第 {step} / 3 步</span>
          </div>
          <div className="portal-wizard-steps">
            {['主体信息', '联系人信息', '确认资料'].map((label, index) => (
              <div key={label} className={`portal-wizard-step${step === index + 1 ? ' on' : step > index + 1 ? ' done' : ''}`}>
                <span>{step > index + 1 ? <Icon name="check" size={13} /> : index + 1}</span>{label}
              </div>
            ))}
          </div>
          <div className="card-b">
            {step === 1 && (
              <div className="portal-form-body">
                <div className="form-grid">
                  <div className="form-item">
                    <label>企业名称 <span className="req" /></label>
                    <input className="input" value={form.companyName} placeholder="与营业执照一致"
                      onChange={(event) => patch({ companyName: event.target.value })} />
                  </div>
                  <div className="form-item">
                    <label>统一社会信用代码 <span className="req" /></label>
                    <input className="input" value={form.creditCode} maxLength={18} placeholder="15-18 位字母数字"
                      onChange={(event) => patch({ creditCode: event.target.value.replace(/\s/g, '') })} />
                  </div>
                </div>
                <div className="form-grid">
                  <div className="form-item">
                    <label>企业类型</label>
                    <select className="select" value={form.companyKind} onChange={(event) => patch({ companyKind: event.target.value })}>
                      {KINDS.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </div>
                  <div className="form-item">
                    <label>所属行业</label>
                    <select className="select" value={form.industry} onChange={(event) => patch({ industry: event.target.value })}>
                      {INDUSTRIES.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-grid">
                  <div className="form-item">
                    <label>成立日期</label>
                    <input className="input" type="date" value={form.foundDate}
                      onChange={(event) => patch({ foundDate: event.target.value })} />
                  </div>
                  <div className="form-item">
                    <label>注册资本（万元）</label>
                    <input className="input" inputMode="decimal" value={form.capital} placeholder="请输入数字"
                      onChange={(event) => patch({ capital: event.target.value.replace(/[^\d.]/g, '') })} />
                  </div>
                </div>
                <div className="form-item">
                  <label>注册地址 <span className="req" /></label>
                  <input className="input" value={form.address} placeholder="省 / 市 / 区 / 详细地址"
                    onChange={(event) => patch({ address: event.target.value })} />
                </div>
                <div className="form-item">
                  <label>经营范围</label>
                  <textarea className="textarea" value={form.scope} placeholder="请填写营业执照登记的经营范围"
                    onChange={(event) => patch({ scope: event.target.value })} />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="portal-form-body">
                <div className="form-grid">
                  <div className="form-item">
                    <label>法定代表人 <span className="req" /></label>
                    <input className="input" value={form.legalPerson} placeholder="与营业执照一致"
                      onChange={(event) => patch({ legalPerson: event.target.value })} />
                  </div>
                  <div className="form-item">
                    <label>联系人姓名 <span className="req" /></label>
                    <input className="input" value={form.contactName} placeholder="用于接收审核通知"
                      onChange={(event) => patch({ contactName: event.target.value })} />
                  </div>
                </div>
                <div className="form-grid">
                  <div className="form-item">
                    <label>联系电话 <span className="req" /></label>
                    <input className="input" type="tel" value={form.contactPhone} maxLength={11} placeholder="11 位手机号"
                      onChange={(event) => patch({ contactPhone: event.target.value.replace(/\D/g, '') })} />
                  </div>
                  <div className="form-item">
                    <label>联系邮箱</label>
                    <input className="input" type="email" value={form.email} placeholder="用于接收审核结果"
                      onChange={(event) => patch({ email: event.target.value })} />
                  </div>
                </div>
                <div className="portal-info-box">
                  <Icon name="alert" size={16} />
                  <div>
                    <strong>下一步的材料核验需要登录</strong>
                    <p>营业执照、法人身份证、开户许可证上传，以及人脸核验与对公打款验证，均在登录后的认证中心完成。</p>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="portal-form-body">
                <dl className="portal-summary">
                  <div><dt>企业名称</dt><dd>{form.companyName || '—'}</dd></div>
                  <div><dt>统一信用代码</dt><dd className="mono">{form.creditCode || '—'}</dd></div>
                  <div><dt>企业类型</dt><dd>{form.companyKind}</dd></div>
                  <div><dt>所属行业</dt><dd>{form.industry}</dd></div>
                  <div><dt>注册地址</dt><dd>{form.address || '—'}</dd></div>
                  <div><dt>法定代表人</dt><dd>{form.legalPerson || '—'}</dd></div>
                  <div><dt>联系人</dt><dd>{form.contactName || '—'} · {form.contactPhone || '—'}</dd></div>
                  <div><dt>经营范围</dt><dd>{form.scope || '—'}</dd></div>
                </dl>
                <label className="portal-agree">
                  <input type="checkbox" checked={form.agree} onChange={(event) => patch({ agree: event.target.checked })} />
                  我确认以上资料真实有效，并同意平台按《企业入驻规则》进行资质审核。
                </label>
                {done && (
                  <div className="portal-draft-result">
                    <div className="row center gap-8"><Icon name="check" size={18} /><strong>认证申请已提交平台审核</strong></div>
                    <p>企业主体与认证草稿已落库并激活为待审核状态。营业执照、法人证件等补充材料可在后续审核环节按运营要求补交。</p>
                    <div className="row gap-8 portal-wrap">
                      <a className="btn btn-primary" href={`${window.location.protocol}//${window.location.hostname}:8090/register?step=3`}>查看认证进度</a>
                      <a className="btn btn-ghost" href="#/certify">返回认证中心</a>
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && <div className="portal-form-error">{error}</div>}
            {savedAt && !done && <div className="portal-save-hint">平台草稿已保存 · {savedAt}</div>}

            <div className="row between center mt-24">
              <button type="button" className="btn btn-ghost" disabled={step === 1} onClick={() => setStep(step - 1)}>
                <Icon name="arrow" size={14} />上一步
              </button>
              <div className="row center gap-8">
                <button type="button" className="btn btn-outline" disabled={busy} onClick={() => void saveDraft()}>保存到平台</button>
                {step < 3
                  ? <button type="button" className="btn btn-primary" onClick={next}>下一步<Icon name="arrow" size={14} /></button>
                  : <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={done || busy}>{busy ? '提交中…' : '提交认证审核'}</button>}
              </div>
            </div>
          </div>
        </div>

        <aside className="portal-wizard-aside">
          <div className="card">
            <div className="card-h"><h3><Icon name="clipboard" size={18} />所需材料与要点</h3></div>
            <div className="card-b">
              <ul className="portal-material-list">
                <li><Icon name="check" size={13} />营业执照副本清晰照片</li>
                <li><Icon name="check" size={13} />法定代表人身份证正反面</li>
                <li><Icon name="check" size={13} />对公账户开户许可证</li>
                <li><Icon name="check" size={13} />食品生产/经营许可证（涉及食品类目）</li>
              </ul>
            </div>
          </div>
          <div className="card">
            <div className="card-h"><h3><Icon name="activity" size={18} />审核规则与时效</h3></div>
            <div className="card-b muted t-sm">
              <p>资料齐全时通常 1-3 个工作日完成审核。同一主体同时只保留一条待审核申请。</p>
              <p className="mt-8">驳回时会给出具体原因，补充或更正材料后可重新提交。</p>
            </div>
          </div>
          <div className="card">
            <div className="card-h"><h3><Icon name="phone" size={18} />需要协助？</h3></div>
            <div className="card-b muted t-sm">
              <p>工作日 09:00-18:00 联系平台运营，获取认证材料清单与办理指引。</p>
              <p className="mt-8">客服电话：400-000-0000（示例）</p>
            </div>
          </div>
        </aside>
      </section>
    </>
  )
}
