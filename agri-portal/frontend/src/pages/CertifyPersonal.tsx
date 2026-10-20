import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { productionLogin, ssoRegister } from '../utils'

const DRAFT_KEY = 'agri.portal.cert.personal'
const BUSINESS_TYPES = ['家庭农场', '农民专业合作社成员', '个体采购户', '农产品经纪人', '其他']

interface PersonalForm {
  realName: string
  idNo: string
  phone: string
  address: string
  businessType: string
  validStart: string
  validEnd: string
  agree: boolean
}

const EMPTY: PersonalForm = {
  realName: '', idNo: '', phone: '', address: '', businessType: BUSINESS_TYPES[0],
  validStart: '', validEnd: '', agree: false,
}

function loadDraft(): PersonalForm {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY)
    if (!raw) return EMPTY
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<PersonalForm>) }
  } catch {
    return EMPTY
  }
}

/** 18 位身份证号校验（含校验位），与平台 IdNumberUtil 的口径一致。 */
function validIdNo(value: string): boolean {
  const id = value.trim().toUpperCase()
  if (!/^\d{17}[\dX]$/.test(id)) return false
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
  const codes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']
  let sum = 0
  for (let i = 0; i < 17; i += 1) sum += Number(id[i]) * weights[i]
  return codes[sum % 11] === id[17]
}

function maskId(value: string): string {
  const id = value.trim().toUpperCase()
  if (id.length < 8) return value
  return `${id.slice(0, 3)}***********${id.slice(-4)}`
}

export function CertifyPersonal(): JSX.Element {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<PersonalForm>(loadDraft)
  const [error, setError] = useState('')
  const [savedAt, setSavedAt] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step])

  const patch = (next: Partial<PersonalForm>): void => {
    setForm((previous) => ({ ...previous, ...next }))
    setError('')
  }

  const saveDraft = (): void => {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(form))
    setSavedAt(new Date().toLocaleTimeString('zh-CN', { hour12: false }))
  }

  const validate = (target: number): boolean => {
    if (target >= 1) {
      if (!form.realName.trim()) { setError('请填写真实姓名'); return false }
      if (!validIdNo(form.idNo)) { setError('身份证号应为 18 位且校验位正确'); return false }
    }
    if (target >= 2) {
      if (!/^1[3-9]\d{9}$/.test(form.phone.trim())) { setError('请填写正确的 11 位手机号'); return false }
      if (!form.address.trim()) { setError('请填写常住地址'); return false }
    }
    if (target >= 3 && !form.agree) {
      setError('请先确认真实有效并同意实名认证规则')
      return false
    }
    return true
  }

  const next = (): void => {
    if (!validate(step)) return
    saveDraft()
    setStep(Math.min(3, step + 1))
  }

  const submit = (): void => {
    if (!validate(3)) return
    saveDraft()
    setDone(true)
  }

  return (
    <>
      <section className="portal-cert-hero portal-cert-hero-small">
        <div className="container">
          <div className="tag tag-tech"><Icon name="user" size={13} />个人实名认证</div>
          <h1>实名认证办理</h1>
          <p>先登记身份与联系方式；证件上传与人脸核验需登录后在认证中心完成。</p>
        </div>
      </section>

      <section className="container portal-cert-body portal-wizard-layout">
        <div className="card portal-wizard-card">
          <div className="card-h">
            <h3><Icon name="user" size={18} />实名认证资料登记</h3>
            <span className="tag tag-ghost">第 {step} / 3 步</span>
          </div>
          <div className="portal-wizard-steps">
            {['身份信息', '联系方式', '确认资料'].map((label, index) => (
              <div key={label} className={`portal-wizard-step${step === index + 1 ? ' on' : step > index + 1 ? ' done' : ''}`}>
                <span>{step > index + 1 ? <Icon name="check" size={13} /> : index + 1}</span>{label}
              </div>
            ))}
          </div>
          <div className="card-b">
            {step === 1 && (
              <div className="portal-form-body">
                <div className="form-item">
                  <label>真实姓名 <span className="req" /></label>
                  <input className="input" value={form.realName} placeholder="与身份证一致"
                    onChange={(event) => patch({ realName: event.target.value })} />
                </div>
                <div className="form-item">
                  <label>身份证号 <span className="req" /></label>
                  <input className="input mono" value={form.idNo} maxLength={18} placeholder="18 位身份证号"
                    onChange={(event) => patch({ idNo: event.target.value.replace(/\s/g, '').toUpperCase() })} />
                  <div className="form-hint">身份证号仅用于实名核验，平台只保存掩码与加盐摘要。</div>
                </div>
                <div className="form-grid">
                  <div className="form-item">
                    <label>证件有效期起</label>
                    <input className="input" type="date" value={form.validStart}
                      onChange={(event) => patch({ validStart: event.target.value })} />
                  </div>
                  <div className="form-item">
                    <label>证件有效期止</label>
                    <input className="input" type="date" value={form.validEnd}
                      onChange={(event) => patch({ validEnd: event.target.value })} />
                  </div>
                </div>
                <div className="form-item">
                  <label>经营类型</label>
                  <select className="select" value={form.businessType} onChange={(event) => patch({ businessType: event.target.value })}>
                    {BUSINESS_TYPES.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="portal-form-body">
                <div className="form-item">
                  <label>手机号 <span className="req" /></label>
                  <input className="input" type="tel" value={form.phone} maxLength={11} placeholder="11 位手机号"
                    onChange={(event) => patch({ phone: event.target.value.replace(/\D/g, '') })} />
                  <div className="form-hint">短信验证码与人脸核验需登录后在认证中心完成。</div>
                </div>
                <div className="form-item">
                  <label>常住地址 <span className="req" /></label>
                  <input className="input" value={form.address} placeholder="省 / 市 / 区 / 详细地址"
                    onChange={(event) => patch({ address: event.target.value })} />
                </div>
                <div className="portal-info-box">
                  <Icon name="shield" size={16} />
                  <div>
                    <strong>信息加密说明</strong>
                    <p>身份证号明文只在提交时短暂使用，平台入库前转为掩码与加盐 SHA-256 摘要，运营端也看不到明文。</p>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="portal-form-body">
                <dl className="portal-summary">
                  <div><dt>真实姓名</dt><dd>{form.realName || '—'}</dd></div>
                  <div><dt>身份证号</dt><dd className="mono">{maskId(form.idNo)}</dd></div>
                  <div><dt>证件有效期</dt><dd>{form.validStart || '—'} 至 {form.validEnd || '—'}</dd></div>
                  <div><dt>手机号</dt><dd className="mono">{form.phone || '—'}</dd></div>
                  <div><dt>经营类型</dt><dd>{form.businessType}</dd></div>
                  <div><dt>常住地址</dt><dd>{form.address || '—'}</dd></div>
                </dl>
                <label className="portal-agree">
                  <input type="checkbox" checked={form.agree} onChange={(event) => patch({ agree: event.target.checked })} />
                  我确认以上信息真实有效，并同意平台按实名认证规则进行核验。
                </label>
                {done && (
                  <div className="portal-draft-result">
                    <div className="row center gap-8"><Icon name="check" size={18} /><strong>资料已保存到本机浏览器</strong></div>
                    <p>尚未提交至平台。正式实名认证需要登录后上传身份证正反面并完成人脸核验。</p>
                    <div className="row gap-8 portal-wrap">
                      <a className="btn btn-primary" href={productionLogin()}>登录后继续办理</a>
                      <a className="btn btn-outline" href={ssoRegister()}>没有账号，先注册</a>
                      <a className="btn btn-ghost" href="#/certify">返回认证中心</a>
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && <div className="portal-form-error">{error}</div>}
            {savedAt && !done && <div className="portal-save-hint">草稿已保存到本机 · {savedAt}</div>}

            <div className="row between center mt-24">
              <button type="button" className="btn btn-ghost" disabled={step === 1} onClick={() => setStep(step - 1)}>
                <Icon name="arrow" size={14} />上一步
              </button>
              <div className="row center gap-8">
                <button type="button" className="btn btn-outline" onClick={saveDraft}>保存草稿</button>
                {step < 3
                  ? <button type="button" className="btn btn-primary" onClick={next}>下一步<Icon name="arrow" size={14} /></button>
                  : <button type="button" className="btn btn-primary" onClick={submit} disabled={done}>保存并去登录提交</button>}
              </div>
            </div>
          </div>
        </div>

        <aside className="portal-wizard-aside">
          <div className="card">
            <div className="card-h"><h3><Icon name="shield" size={18} />为什么需要实名认证</h3></div>
            <div className="card-b muted t-sm">
              <p>实名认证用于确认交易主体身份，是参与大宗交易、在线签约与申请供应链金融的前提。</p>
              <p className="mt-8">认证信息仅用于身份核验与合规留痕，不会对外展示身份证号。</p>
            </div>
          </div>
          <div className="card">
            <div className="card-h"><h3><Icon name="file" size={18} />证件拍摄要求</h3></div>
            <div className="card-b">
              <ul className="portal-material-list">
                <li><Icon name="check" size={13} />证件四角完整、文字清晰</li>
                <li><Icon name="check" size={13} />避免反光、遮挡与水印</li>
                <li><Icon name="check" size={13} />身份证需上传人像面与国徽面</li>
                <li><Icon name="check" size={13} />证件须在有效期内</li>
              </ul>
            </div>
          </div>
          <div className="card">
            <div className="card-h"><h3><Icon name="phone" size={18} />需要协助？</h3></div>
            <div className="card-b muted t-sm">
              <p>工作日 09:00-18:00 联系平台运营，获取实名认证办理指引。</p>
              <p className="mt-8">客服电话：400-000-0000（示例）</p>
            </div>
          </div>
        </aside>
      </section>
    </>
  )
}
