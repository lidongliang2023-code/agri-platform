import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

/**
 * 统一认证中心 · 登录 / 注册页（按 portal 原型重做，2026-10-20）。
 *
 * 登录页严格对齐原型：只有两个 Tab ——「手机号 + 验证码」「账号 + 密码」；
 * 微信 / 支付宝 / 国家政务服务平台收进「其他登录方式」图标，未配置凭据时如实说明，不伪造二维码。
 *
 * 注册页同样按原型：企业会员 / 个人会员两套表单、三步进度、短信验证码、密码强度与协议勾选。
 * 注册接口会把密码、身份与企业资料一起落库；企业资料同时生成经营主体与待审核认证申请。
 */

type LoginTab = 'sms' | 'pwd'
type Identity = 'enterprise' | 'personal'

interface RegisterForm {
  identity: Identity
  nickname: string
  companyName: string
  creditCode: string
  industry: string
  companySize: string
  address: string
  realName: string
  idCard: string
  businessType: string
  contactName: string
  phone: string
  code: string
  password: string
  confirm: string
  agree: boolean
}

interface SsoBody {
  code?: number
  message?: string
  data?: {
    redirect?: string
    hint?: string
    stage?: string
    phone?: string
    nickname?: string
    identity?: string
    subjectName?: string
    status?: string
  }
}

const INDUSTRIES = ['粮油产业', '果蔬产业', '畜禽产业', '茶药产业', '饲料农资', '水产产业', '流通贸易', '加工制造', '其他']
const COMPANY_SIZES = ['微型（20人以下）', '小型（20-100人）', '中型（100-500人）', '大型（500人以上）']
const BUSINESS_TYPES = ['家庭农场', '农民专业合作社', '个体采购户', '经纪人', '其他']

const IDENTITY_LABEL: Record<Identity, string> = {
  enterprise: '企业会员',
  personal: '个人会员',
}

function contextOf(): {
  clientId: string
  redirectUri: string
  state: string | null
  codeChallenge: string | null
  codeChallengeMethod: string | null
} {
  const params = new URLSearchParams(window.location.search)
  return {
    clientId: params.get('client_id') ?? '',
    redirectUri: params.get('redirect_uri') ?? '',
    state: params.get('state'),
    codeChallenge: params.get('code_challenge'),
    codeChallengeMethod: params.get('code_challenge_method'),
  }
}

function homeUrlOf(redirectUri: string): string {
  try {
    return new URL(redirectUri).origin + '/'
  } catch {
    // 直接访问认证中心时没有 redirect_uri：回平台门户根地址，而不是又回到登录页
    return window.location.origin + '/'
  }
}

/** 独立注册 / 直接登录后的默认落点：生产管理模块的用户端入口。 */
function platformEntry(): string {
  return `${window.location.protocol}//${window.location.hostname}/production/login`
}

function Icon({ name, size = 16 }: { name: string; size?: number }): JSX.Element {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  switch (name) {
    case 'back':
      return <svg {...common}><path d="m15 18-6-6 6-6" /><path d="M9 12h11" /></svg>
    case 'seed':
      return <svg {...common}><path d="M12 21c0-6 3-9 8-9 0 6-3 9-8 9Z" /><path d="M12 21c0-6-3-9-8-9 0 6 3 9 8 9Z" /><path d="M12 21v-8" /></svg>
    case 'shield':
      return <svg {...common}><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" /><path d="m9 12 2 2 4-4" /></svg>
    case 'zap':
      return <svg {...common}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /></svg>
    case 'money':
      return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M9 9h6M9 15h6M12 7v10" /></svg>
    case 'cart':
      return <svg {...common}><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /><path d="M3 4h2l2.2 10.2A2 2 0 0 0 9.2 16H18l2-8H6" /></svg>
    case 'box':
      return <svg {...common}><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="M4 7.5 12 12l8-4.5M12 12v9" /></svg>
    case 'factory':
      return <svg {...common}><path d="M3 21V10l5 3V10l5 3V7l8 5v9H3Z" /><path d="M7 17h2M12 17h2M17 17h2" /></svg>
    case 'user':
      return <svg {...common}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" /></svg>
    case 'check':
      return <svg {...common}><path d="m5 12 5 5 9-10" /></svg>
    default:
      return <svg {...common}><circle cx="12" cy="12" r="8" /></svg>
  }
}

function LoginAside(): JSX.Element {
  return (
    <aside className="auth-aside">
      <div className="aside-brand">
        <span className="logo"><Icon name="seed" size={22} /></span>
        <span>农产云<small>AGRI · CLOUD</small></span>
      </div>
      <div className="aside-body">
        <div className="aside-title">登录农产云<br />继续您的产业协作</div>
        <div className="aside-sub">
          登录后系统会自动识别您所处的环节：未创建主体将引导登记，未认证将引导提交材料，
          已认证则直接进入会员中心。
        </div>
        <div className="flow-list">
          <div className="flow-item on">
            <span className="n">1</span>
            <div><strong>注册账号 / 登录账号</strong><small>手机号 + 验证码 / 账号密码，仅用于身份登录</small></div>
          </div>
          <div className="flow-item">
            <span className="n">2</span>
            <div><strong>创建主体会员</strong><small>登录后登记企业或个人主体，取得交易身份</small></div>
          </div>
          <div className="flow-item">
            <span className="n">3</span>
            <div><strong>认证审核 · 开通权限</strong><small>审核通过后自动开通交易 / 金融 / 溯源等功能</small></div>
          </div>
        </div>
        <div className="aside-stats">
          <div><div className="n">12,800+</div><div className="d">认证企业</div></div>
          <div><div className="n">480万吨</div><div className="d">年撮合交易量</div></div>
          <div><div className="n">86%</div><div className="d">撮合成功率</div></div>
        </div>
      </div>
    </aside>
  )
}

function RegisterAside(): JSX.Element {
  return (
    <aside className="auth-aside">
      <div className="aside-brand">
        <span className="logo"><Icon name="seed" size={22} /></span>
        <span>农产云<small>AGRI · CLOUD</small></span>
      </div>
      <div className="aside-body">
        <div className="aside-title">先创建账号<br />再开通会员能力</div>
        <div className="aside-sub">
          农产云采用「账号 → 主体 → 认证」三段式开通流程。本页将一次收集账号与主体资料，
          提交后进入平台认证审核。
        </div>
        <div className="flow-list">
          <div className="flow-item on">
            <span className="n">1</span>
            <div><strong>注册账号 / 登录账号</strong><small>手机号 + 验证码 + 密码，创建登录凭证</small></div>
          </div>
          <div className="flow-item">
            <span className="n">2</span>
            <div><strong>创建主体会员</strong><small>选择企业或个人类型，登记主体信息</small></div>
          </div>
          <div className="flow-item">
            <span className="n">3</span>
            <div><strong>认证审核 · 开通权限</strong><small>材料审核通过后，自动开通交易 / 金融 / 溯源能力</small></div>
          </div>
        </div>
        <div className="aside-stats">
          <div><div className="n">38万+</div><div className="d">注册账号</div></div>
          <div><div className="n">12,800+</div><div className="d">认证主体</div></div>
          <div><div className="n">4.2h</div><div className="d">平均审核时长</div></div>
        </div>
      </div>
    </aside>
  )
}

export default function App(): JSX.Element {
  const ctx = useMemo(contextOf, [])
  const homeUrl = homeUrlOf(ctx.redirectUri)
  const isRegister = useMemo(() => {
    const path = window.location.pathname.replace(/\/+$/, '')
    return path.endsWith('/register') || new URLSearchParams(window.location.search).get('mode') === 'register'
  }, [])
  const contextMissing = ctx.clientId === '' || ctx.redirectUri === ''

  const [tab, setTab] = useState<LoginTab>('sms')
  const [phone, setPhone] = useState('')
  const [smsCode, setSmsCode] = useState('')
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)

  const [reg, setReg] = useState<RegisterForm>({
    identity: 'enterprise',
    nickname: '',
    companyName: '',
    creditCode: '',
    industry: INDUSTRIES[0],
    companySize: COMPANY_SIZES[0],
    address: '',
    realName: '',
    idCard: '',
    businessType: BUSINESS_TYPES[0],
    contactName: '',
    phone: '',
    code: '',
    password: '',
    confirm: '',
    agree: false,
  })
  const [regStep, setRegStep] = useState<1 | 2 | 3>(1)

  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [hint, setHint] = useState('')
  const [busy, setBusy] = useState(false)
  const [sending, setSending] = useState<'login' | 'register' | null>(null)
  const [loginLeft, setLoginLeft] = useState(0)
  const [registerLeft, setRegisterLeft] = useState(0)
  const [success, setSuccess] = useState<{ redirect: string | null; identity: Identity; hasIdCard: boolean } | null>(null)
  const [accountCreated, setAccountCreated] = useState(false)
  const [onboardingStage, setOnboardingStage] = useState('')

  useEffect(() => {
    if (loginLeft <= 0) return undefined
    const timer = window.setTimeout(() => setLoginLeft(loginLeft - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [loginLeft])

  useEffect(() => {
    if (registerLeft <= 0) return undefined
    const timer = window.setTimeout(() => setRegisterLeft(registerLeft - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [registerLeft])

  useEffect(() => {
    if (!isRegister) return
    let cancelled = false
    void fetch('/api/v1/sso/onboarding/status', { credentials: 'include' })
      .then(async (response) => ({ ok: response.ok, body: await response.json() as SsoBody }))
      .then(({ ok, body }) => {
        if (cancelled || !ok || body.code !== 0 || !body.data) return
        const data = body.data
        const stage = data.stage ?? ''
        setOnboardingStage(stage)
        setAccountCreated(true)
        if (stage === 'subject') setRegStep(2)
        if (stage === 'certification' || stage === 'pending' || stage === 'done') setRegStep(3)
        setReg((previous) => ({
          ...previous,
          phone: data.phone ?? previous.phone,
          nickname: data.nickname ?? previous.nickname,
          identity: data.identity === 'personal' ? 'personal' : previous.identity,
          companyName: data.identity === 'enterprise' ? (data.subjectName ?? previous.companyName) : previous.companyName,
          realName: data.identity === 'personal' ? (data.subjectName ?? previous.realName) : previous.realName,
        }))
      })
      .catch(() => { /* 无 SSO 会话：从第 1 步开始 */ })
    return () => { cancelled = true }
  }, [isRegister])

  const patchReg = (patch: Partial<RegisterForm>): void => {
    setReg((previous) => ({ ...previous, ...patch }))
    setError('')
  }

  const strength = useMemo(() => {
    const value = reg.password
    let score = 0
    if (value.length >= 8) score += 1
    if (/[a-zA-Z]/.test(value)) score += 1
    if (/\d/.test(value)) score += 1
    if (/[^a-zA-Z0-9]/.test(value)) score += 1
    if (score >= 3 && value.length >= 10) return 'strong'
    if (score >= 2 && value.length >= 8) return 'fair'
    return ''
  }, [reg.password])

  const switchView = (path: '/login' | '/register'): void => {
    window.location.href = path + (window.location.search || '')
  }

  function validateAccountStep(): boolean {
    setError('')
    if (!/^1[3-9]\d{9}$/.test(reg.phone)) {
      setError('请填写正确的 11 位手机号')
      return false
    }
    if (!/^\d{6}$/.test(reg.code)) {
      setError('请输入 6 位短信验证码')
      return false
    }
    if (reg.password.length < 8 || reg.password.length > 20) {
      setError('密码长度应为 8-20 位')
      return false
    }
    if (!/[a-zA-Z]/.test(reg.password) || !/\d/.test(reg.password)) {
      setError('密码需同时包含字母和数字')
      return false
    }
    if (reg.password !== reg.confirm) {
      setError('两次输入的密码不一致')
      return false
    }
    return true
  }

  function validateSubjectStep(): boolean {
    setError('')
    if (reg.identity === 'enterprise') {
      if (!reg.companyName.trim()) {
        setError('请填写企业名称')
        return false
      }
      if (!/^[0-9A-Za-z]{15,18}$/.test(reg.creditCode.trim())) {
        setError('请填写 15-18 位统一社会信用代码')
        return false
      }
    } else {
      if (!reg.realName.trim()) {
        setError('请填写真实姓名')
        return false
      }
      if (!reg.idCard.trim()) {
        setError('请填写身份证号，个人实名认证将随注册提交')
        return false
      }
      if (!/^\d{17}[\dXx]$/.test(reg.idCard.trim())) {
        setError('身份证号应为 18 位（末位可为 X）')
        return false
      }
    }
    if (!reg.contactName.trim()) {
      setError('请填写联系人姓名')
      return false
    }
    return true
  }

  async function requestCode(scene: 'login' | 'register', targetPhone: string, kind: 'login' | 'register'): Promise<void> {
    setError('')
    setHint('')
    setNotice('')
    if (!/^1[3-9]\d{9}$/.test(targetPhone)) {
      setError('请输入正确的 11 位手机号')
      return
    }
    setSending(kind)
    try {
      const response = await fetch('/api/v1/sso/sms/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: targetPhone, scene }),
      })
      const body = (await response.json()) as SsoBody
      if (!response.ok || body.code !== 0) {
        setError(body.message ?? '验证码发送失败')
        return
      }
      setHint(body.data?.hint ?? '验证码已发送')
      if (kind === 'login') setLoginLeft(60)
      else setRegisterLeft(60)
    } catch {
      setError('无法联系认证服务，请确认后端已启动')
    } finally {
      setSending(null)
    }
  }

  async function submitLogin(event: FormEvent): Promise<void> {
    event.preventDefault()
    setError('')
    setNotice('')
    setHint('')
    if (contextMissing) {
      setError('缺少授权上下文，请从您要访问的子系统入口重新进入')
      return
    }
    setBusy(true)
    try {
      const common = {
        marketId: 1,
        clientId: ctx.clientId,
        redirectUri: ctx.redirectUri,
        state: ctx.state,
        codeChallenge: ctx.codeChallenge,
        codeChallengeMethod: ctx.codeChallengeMethod,
        remember,
      }
      const response = await fetch(tab === 'sms' ? '/api/v1/sso/login-by-sms' : '/api/v1/sso/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tab === 'sms'
          ? { ...common, phone, code: smsCode }
          : {
              ...common,
              // 账号框既接受用户名也接受手机号：11 位手机号走 phone 字段，
              // 其余按 username 查（两个都传时服务端以 username 为准，所以只传一个）
              username: /^1[3-9]\d{9}$/.test(account.trim()) ? undefined : account.trim(),
              phone: /^1[3-9]\d{9}$/.test(account.trim()) ? account.trim() : undefined,
              password,
            }),
      })
      const body = (await response.json()) as SsoBody
      if (!response.ok || body.code !== 0) {
        setError(body.message ?? '登录失败，请重试')
        return
      }
      const stage = body.data?.stage
      if (stage && stage !== 'done') {
        const query = window.location.search || ''
        const separator = query ? '&' : '?'
        window.location.href = `/register${query}${separator}step=${stage === 'subject' ? 2 : 3}`
        return
      }
      const redirect = body.data?.redirect
      if (!redirect) {
        setError('认证中心未返回回跳地址，请联系平台运营')
        return
      }
      window.location.href = redirect
    } catch {
      setError('无法联系认证服务，请确认后端已启动')
    } finally {
      setBusy(false)
    }
  }

  async function registerAccountStep(): Promise<void> {
    if (!validateAccountStep()) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/v1/sso/register-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: reg.phone,
          code: reg.code,
          password: reg.password,
          nickname: reg.nickname.trim(),
          marketId: 1,
          remember: true,
        }),
      })
      const body = (await response.json()) as SsoBody
      if (!response.ok || body.code !== 0) {
        setError(body.message ?? '账号创建失败')
        return
      }
      setAccountCreated(true)
      setOnboardingStage(body.data?.stage ?? 'subject')
      setRegStep(2)
      setNotice('登录账号已创建，请继续登记经营主体。')
    } catch {
      setError('无法联系认证服务，请确认后端已启动')
    } finally {
      setBusy(false)
    }
  }

  async function createSubjectStep(): Promise<void> {
    if (!validateSubjectStep()) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/v1/sso/onboarding/subject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identity: reg.identity,
          companyName: reg.companyName.trim(),
          creditCode: reg.creditCode.trim(),
          industry: reg.identity === 'enterprise' ? reg.industry : '',
          companySize: reg.identity === 'enterprise' ? reg.companySize : '',
          address: reg.identity === 'enterprise' ? reg.address.trim() : '',
          realName: reg.realName.trim(),
          idCard: reg.idCard.trim(),
          businessType: reg.identity === 'personal' ? reg.businessType : '',
          contactName: reg.contactName.trim(),
        }),
      })
      const body = (await response.json()) as SsoBody
      if (!response.ok || body.code !== 0) {
        setError(body.message ?? '主体创建失败')
        return
      }
      setOnboardingStage(body.data?.stage ?? 'certification')
      setRegStep(3)
      setNotice('经营主体已创建，请确认认证资料并提交审核。')
    } catch {
      setError('无法联系认证服务，请确认后端已启动')
    } finally {
      setBusy(false)
    }
  }

  async function activateCertification(event: FormEvent): Promise<void> {
    event.preventDefault()
    setError('')
    setNotice('')
    setHint('')
    if (!reg.agree) {
      setError('请先阅读并同意用户服务协议、隐私政策与企业入驻规则')
      return
    }
    setBusy(true)
    try {
      const response = await fetch('/api/v1/sso/onboarding/certification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: ctx.clientId,
          redirectUri: ctx.redirectUri,
          state: ctx.state,
          codeChallenge: ctx.codeChallenge,
          codeChallengeMethod: ctx.codeChallengeMethod,
        }),
      })
      const body = (await response.json()) as SsoBody
      if (!response.ok || body.code !== 0) {
        setError(body.message ?? '认证提交失败')
        return
      }
      setOnboardingStage(body.data?.stage ?? 'pending')
      setSuccess({
        redirect: body.data?.redirect ?? null,
        identity: reg.identity,
        hasIdCard: reg.idCard.trim() !== '',
      })
    } catch {
      setError('无法联系认证服务，请确认后端已启动')
    } finally {
      setBusy(false)
    }
  }

  const loginView = (
    <>
      <div className="form-title">欢迎回来</div>
      <div className="form-sub">登录后将自动识别您所处的账号环节，并引导至对应页面</div>

      <div className="auth-tabs" role="tablist" aria-label="登录方式">
        <button type="button" role="tab" aria-selected={tab === 'sms'} className={tab === 'sms' ? 'on' : ''}
          onClick={() => { setTab('sms'); setError(''); setNotice('') }}>
          手机号 + 验证码
        </button>
        <button type="button" role="tab" aria-selected={tab === 'pwd'} className={tab === 'pwd' ? 'on' : ''}
          onClick={() => { setTab('pwd'); setError(''); setNotice('') }}>
          账号 + 密码
        </button>
      </div>

      <form className="auth-form" onSubmit={(event) => void submitLogin(event)}>
        {tab === 'sms' ? (
          <>
            <label className="auth-field">
              手机号
              <input className="auth-input" type="tel" value={phone} maxLength={11} inputMode="numeric"
                autoComplete="tel" placeholder="请输入 11 位手机号"
                onChange={(event) => { setPhone(event.target.value.replace(/\D/g, '')); setError('') }} />
            </label>
            <label className="auth-field">
              验证码
              <div className="code-row">
                <input className="auth-input" value={smsCode} maxLength={6} inputMode="numeric"
                  placeholder="请输入 6 位验证码"
                  onChange={(event) => { setSmsCode(event.target.value.replace(/\D/g, '')); setError('') }} />
                <button type="button" className="btn-code" disabled={sending !== null || loginLeft > 0}
                  onClick={() => void requestCode('login', phone, 'login')}>
                  {sending === 'login' ? '发送中…' : loginLeft > 0 ? `重新获取（${loginLeft}s）` : '获取验证码'}
                </button>
              </div>
            </label>
          </>
        ) : (
          <>
            <label className="auth-field">
              账号
              <input className="auth-input" value={account} autoComplete="username"
                placeholder="请输入手机号 / 用户名"
                onChange={(event) => { setAccount(event.target.value); setError('') }} />
            </label>
            <label className="auth-field">
              密码
              <input className="auth-input" type="password" value={password} autoComplete="current-password"
                placeholder="请输入登录密码"
                onChange={(event) => { setPassword(event.target.value); setError('') }} />
            </label>
          </>
        )}

        <button type="submit" className="auth-submit" disabled={busy || contextMissing}>
          {busy ? '登录中…' : '登 录'}
        </button>

        <div className="auth-row">
          <label><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />7 天内自动登录</label>
          <button type="button" onClick={() => {
            setNotice('当前未开放自助找回密码，请联系平台运营重置；也可以切到「手机号 + 验证码」直接登录。')
            setError('')
          }}>
            忘记密码？
          </button>
        </div>

        {contextMissing && <div className="auth-notice">缺少授权上下文。请从生产管理、交易撮合等子系统的登录入口进入，认证中心才能把您送回原页面。</div>}
        {error !== '' && <div className="auth-error">{error}</div>}
        {hint !== '' && <div className="auth-hint">{hint}</div>}
        {notice !== '' && <div className="auth-notice">{notice}</div>}

        <div className="third-line">其他登录方式</div>
        <div className="third-icons">
          <button type="button" className="t-wechat" title="微信扫码" onClick={() => {
            setNotice('微信扫码登录尚未接入：需要微信开放平台 AppID / AppSecret 与可公网回调的域名，配置后即可启用。')
            setError('')
          }}>微</button>
          <button type="button" className="t-alipay" title="支付宝" onClick={() => {
            setNotice('支付宝扫码登录尚未接入：需要支付宝开放平台应用与回调地址，配置后即可启用。')
            setError('')
          }}>支</button>
          <button type="button" className="t-gov" title="国家政务服务平台" onClick={() => {
            setNotice('国家政务服务平台统一登录尚未接入：需要完成平台对接与应用密钥配置。')
            setError('')
          }}>政</button>
        </div>
      </form>

      <div className="auth-foot">
        还没有账号？
        <button type="button" onClick={() => switchView('/register')}>立即免费注册 →</button>
      </div>
    </>
  )

  const registerView = (
    <>
      <div className="form-title">创建登录账号</div>
      <div className="form-sub">填写账号、短信验证码与主体会员资料，提交后进入平台认证审核</div>

      <div className="steps">
        <div className={`step${regStep >= 1 ? ' on' : ''}`}>1 注册账号</div>
        <div className={`step${regStep >= 2 ? ' on' : ''}`}>2 创建主体</div>
        <div className={`step${regStep >= 3 ? ' on' : ''}`}>3 认证开通</div>
      </div>

      <form
        className="auth-form"
        onSubmit={(event) => {
          if (regStep === 1) {
            event.preventDefault()
            void registerAccountStep()
            return
          }
          if (regStep === 2) {
            event.preventDefault()
            void createSubjectStep()
            return
          }
          void activateCertification(event)
        }}
      >
        {regStep === 1 && (
          <>
            <div className="form-section">1. 注册账号<small>手机号、验证码与登录密码</small></div>

            <label className="auth-field">
              联系电话<span className="req">*</span>
              <input className="auth-input" type="tel" value={reg.phone} maxLength={11} inputMode="numeric"
                autoComplete="tel" placeholder="请输入 11 位手机号"
                onChange={(event) => patchReg({ phone: event.target.value.replace(/\D/g, '') })} />
            </label>

            <label className="auth-field">
              短信验证码<span className="req">*</span>
              <div className="code-row">
                <input className="auth-input" value={reg.code} maxLength={6} inputMode="numeric"
                  placeholder="6 位验证码"
                  onChange={(event) => patchReg({ code: event.target.value.replace(/\D/g, '') })} />
                <button type="button" className="btn-code" disabled={sending !== null || registerLeft > 0}
                  onClick={() => void requestCode('register', reg.phone, 'register')}>
                  {sending === 'register' ? '发送中…' : registerLeft > 0 ? `重新获取（${registerLeft}s）` : '获取验证码'}
                </button>
              </div>
            </label>

            <div className="form-grid">
              <label className="auth-field">
                设置密码<span className="req">*</span>
                <input className="auth-input" type="password" value={reg.password} maxLength={20}
                  autoComplete="new-password" placeholder="8-20 位字母+数字"
                  onChange={(event) => patchReg({ password: event.target.value })} />
                <span className={`pwd-meter ${strength}`}><i /><i /><i /></span>
              </label>
              <label className="auth-field">
                确认密码<span className="req">*</span>
                <input className="auth-input" type="password" value={reg.confirm} maxLength={20}
                  autoComplete="new-password" placeholder="再次输入密码"
                  onChange={(event) => patchReg({ confirm: event.target.value })} />
              </label>
            </div>

            <label className="auth-field">
              称呼 <small className="muted">选填</small>
              <input className="auth-input" value={reg.nickname} maxLength={20}
                placeholder="如：王经理（用于平台内展示，可后续修改）"
                onChange={(event) => patchReg({ nickname: event.target.value })} />
            </label>

            <div className="auth-notice">验证码将在最终提交时校验，请及时完成主体与认证开通步骤。</div>
            <button type="submit" className="auth-submit" style={{ marginTop: 18 }}>下一步：创建主体</button>
          </>
        )}

        {regStep === 2 && (
          <>
            <div className="form-section">2. 创建主体<small>选择企业或个人会员，登记经营主体</small></div>

            <div className="auth-field">
              <span>注册身份</span>
              <div className="identity-cards">
                <label className={`identity-card${reg.identity === 'enterprise' ? ' on' : ''}`}>
                  <input type="radio" name="register-identity" checked={reg.identity === 'enterprise'}
                    onChange={() => patchReg({ identity: 'enterprise' })} />
                  <span className="ic"><Icon name="factory" size={18} /></span>
                  <span><strong>企业会员</strong><small>支持采购 / 供应 / 金融，需资质认证</small></span>
                </label>
                <label className={`identity-card${reg.identity === 'personal' ? ' on' : ''}`}>
                  <input type="radio" name="register-identity" checked={reg.identity === 'personal'}
                    onChange={() => patchReg({ identity: 'personal' })} />
                  <span className="ic"><Icon name="user" size={18} /></span>
                  <span><strong>个人会员</strong><small>合作社 / 家庭农场 / 采购个体户</small></span>
                </label>
              </div>
            </div>

            {reg.identity === 'enterprise' ? (
              <>
                <div className="form-grid">
                  <label className="auth-field">
                    企业名称<span className="req">*</span>
                    <input className="auth-input" value={reg.companyName} placeholder="与营业执照一致"
                      onChange={(event) => patchReg({ companyName: event.target.value })} />
                  </label>
                  <label className="auth-field">
                    统一社会信用代码<span className="req">*</span>
                    <input className="auth-input" value={reg.creditCode} maxLength={18}
                      placeholder="15-18 位字母数字"
                      onChange={(event) => patchReg({ creditCode: event.target.value.replace(/\s/g, '') })} />
                  </label>
                </div>
                <div className="form-grid">
                  <label className="auth-field">
                    所属行业
                    <select className="auth-input auth-select" value={reg.industry}
                      onChange={(event) => patchReg({ industry: event.target.value })}>
                      {INDUSTRIES.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>
                  <label className="auth-field">
                    企业规模
                    <select className="auth-input auth-select" value={reg.companySize}
                      onChange={(event) => patchReg({ companySize: event.target.value })}>
                      {COMPANY_SIZES.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>
                </div>
                <label className="auth-field">
                  注册地址
                  <input className="auth-input" value={reg.address} placeholder="省 / 市 / 区 / 详细地址"
                    onChange={(event) => patchReg({ address: event.target.value })} />
                </label>
              </>
            ) : (
              <>
                <label className="auth-field">
                  真实姓名<span className="req">*</span>
                  <input className="auth-input" value={reg.realName} placeholder="请输入真实姓名"
                    onChange={(event) => patchReg({ realName: event.target.value })} />
                </label>
                <label className="auth-field">
                  身份证号<span className="req">*</span>
                  <input className="auth-input" value={reg.idCard} maxLength={18}
                    placeholder="18 位身份证号（仅存掩码与摘要）"
                    onChange={(event) => patchReg({ idCard: event.target.value.replace(/\s/g, '') })} />
                </label>
                <label className="auth-field">
                  经营类型
                  <select className="auth-input auth-select" value={reg.businessType}
                    onChange={(event) => patchReg({ businessType: event.target.value })}>
                    {BUSINESS_TYPES.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
              </>
            )}

            <label className="auth-field">
              联系人姓名<span className="req">*</span>
              <input className="auth-input" value={reg.contactName} placeholder="用于接收重要通知"
                onChange={(event) => patchReg({ contactName: event.target.value })} />
            </label>

            <div className="auth-step-actions">
              {!accountCreated && <button type="button" className="auth-back" onClick={() => setRegStep(1)}>上一步</button>}
              <button type="submit" className="auth-submit">下一步：认证开通</button>
            </div>
          </>
        )}

        {regStep === 3 && (
          <>
            <div className="form-section">3. 认证开通<small>确认资料并提交平台审核</small></div>
            <div className="reg-summary">
              <div><span>登录账号</span><b>{reg.phone || '—'}</b><small>{reg.nickname || '未填写称呼'}</small></div>
              <div><span>会员主体</span><b>{reg.identity === 'enterprise' ? '企业会员' : '个人会员'}</b><small>{reg.identity === 'enterprise' ? (reg.companyName || '—') : (reg.realName || '—')}</small></div>
              <div><span>认证方式</span><b>{reg.identity === 'enterprise' ? '企业资质认证' : '个人实名认证'}</b><small>提交后进入平台审核，通过后生效</small></div>
            </div>

            {onboardingStage === 'pending' ? (
              <div className="auth-notice">认证申请已提交，平台正在审核中；审核通过后认证状态会自动生效，无需重复提交。</div>
            ) : onboardingStage === 'done' ? (
              <div className="auth-notice">
                当前账号已完成认证。
                <button type="button" className="link-button" onClick={() => switchView('/login')}>返回登录 →</button>
              </div>
            ) : (
              <>
                <label className="agreement">
                  <input type="checkbox" checked={reg.agree} onChange={(event) => patchReg({ agree: event.target.checked })} />
                  <span>
                    我确认所填账号与主体信息真实有效，并同意
                    <a href="#protocol" onClick={(event) => {
                      event.preventDefault()
                      setNotice('《农产云用户服务协议》全文尚未在本页发布，请联系平台运营获取正式文本。')
                    }}>《农产云用户服务协议》</a>、
                    <a href="#privacy" onClick={(event) => {
                      event.preventDefault()
                      setNotice('《隐私政策》全文尚未在本页发布，请联系平台运营获取正式文本。')
                    }}>《隐私政策》</a> 及
                    <a href="#rules" onClick={(event) => {
                      event.preventDefault()
                      setNotice('《企业入驻规则》全文尚未在本页发布，请联系平台运营获取正式文本。')
                    }}>《企业入驻规则》</a>
                  </span>
                </label>

                <div className="auth-step-actions">
                  <button type="button" className="auth-back" onClick={() => setRegStep(2)}>上一步</button>
                  <button type="submit" className="auth-submit" disabled={busy}>
                    {busy ? '提交中…' : '提交认证并开通'}
                  </button>
                </div>
                <div className="auth-notice">
                  第 2 步已保存主体与认证草稿；本步提交后生成待审核记录，审核通过后认证状态才会生效。
                </div>
              </>
            )}
          </>
        )}

        {contextMissing && <div className="auth-notice">当前为独立注册：账号会正常创建并登录认证中心，完成后请从子系统入口进入。</div>}
        {error !== '' && <div className="auth-error">{error}</div>}
        {hint !== '' && <div className="auth-hint">{hint}</div>}
        {notice !== '' && <div className="auth-notice">{notice}</div>}
      </form>

      <div className="auth-foot">
        已有账号？
        <button type="button" onClick={() => switchView('/login')}>直接登录 →</button>
      </div>
    </>
  )

  return (
    <div className="auth-shell">
      <div className="auth-topbar">
        <a className="tb-left" href={homeUrl}><Icon name="back" size={14} />返回首页</a>
        <span className="tb-right">统一认证中心 · {isRegister ? '账号注册' : '安全登录'}</span>
      </div>
      <div className="auth-wrap">
        <div className="auth-card">
          {isRegister ? <RegisterAside /> : <LoginAside />}
          <main className="auth-main">
            <div className="mobile-brand"><span className="logo"><Icon name="seed" size={20} /></span>农产云</div>
            {isRegister ? registerView : loginView}
          </main>
        </div>
      </div>

      {success !== null && (
        <div className="success-mask" role="dialog" aria-modal="true" aria-label="注册成功">
          <div className="success-card">
            <div className="check-icon"><Icon name="check" size={34} /></div>
            <h3>注册成功！</h3>
            <p>
              欢迎加入农产云，您的{IDENTITY_LABEL[success.identity]}账号已创建
              {success.redirect ? '并自动登录。' : '，并已登录认证中心。'}
              {success.identity === 'enterprise'
                ? '企业资质认证已随注册提交，平台审核通过后即可开展交易。'
                : success.hasIdCard
                  ? '实名认证已随注册提交，平台审核通过后即可开展交易。'
                  : '未填写身份证号，实名认证尚未提交，可联系平台运营补充。'}
            </p>
            <div className="success-actions">
              {success.redirect ? (
                <>
                  <button type="button" className="ghost" onClick={() => { window.location.href = success.redirect ?? homeUrl }}>
                    查看认证进度
                  </button>
                  <button type="button" className="primary" onClick={() => { window.location.href = success.redirect ?? homeUrl }}>
                    进入首页
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="ghost" onClick={() => switchView('/login')}>
                    返回登录
                  </button>
                  <button type="button" className="primary" onClick={() => { window.location.href = platformEntry() }}>
                    进入生产管理
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
