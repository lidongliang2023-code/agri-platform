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
        <div className="aside-title">让每一笔大宗交易<br />都走向数字化</div>
        <div className="aside-sub">
          连接粮油、果蔬、畜禽、茶药、水产、农资六大产业链，智能撮合 + AI Sales Agent 在线议价，
          让采购与销售效率提升 10 倍。
        </div>
        <div className="aside-feats">
          <div className="f"><span className="ic"><Icon name="shield" /></span><div><strong>平台质检 · 资金担保</strong><small>质检担保、区块链存证，交易全程可追溯</small></div></div>
          <div className="f"><span className="ic"><Icon name="zap" /></span><div><strong>AI 智能撮合 · 7×24 议价</strong><small>智能匹配供应商，在线议价更高效</small></div></div>
          <div className="f"><span className="ic"><Icon name="money" /></span><div><strong>供应链金融 · 极速放款</strong><small>订单融资、收货融资、折扣付等多种产品</small></div></div>
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
        <div className="aside-title">免费注册<br />即刻开启数字化交易</div>
        <div className="aside-sub">
          注册成为农产云会员，享受大宗交易撮合、AI 智能议价、供应链金融与物联网溯源等全链路服务。
        </div>
        <div className="aside-feats">
          <div className="f"><span className="ic"><Icon name="cart" /></span><div><strong>免费开店 · 精准询单</strong><small>AI 智能匹配供应商，7×24 在线议价更高效</small></div></div>
          <div className="f"><span className="ic"><Icon name="box" /></span><div><strong>拓客无忧 · 订单直达</strong><small>12,800+ 认证采购商精准询单，订单直接推送</small></div></div>
          <div className="f"><span className="ic"><Icon name="money" /></span><div><strong>资金保障 · 供应链金融</strong><small>订单融资、收货融资、折扣付等多种金融产品</small></div></div>
          <div className="f"><span className="ic"><Icon name="shield" /></span><div><strong>交易安全 · 平台担保</strong><small>质检担保、区块链存证、四流核验机制</small></div></div>
        </div>
        <div className="aside-stats">
          <div><div className="n">38万+</div><div className="d">注册用户</div></div>
          <div><div className="n">12,800+</div><div className="d">认证采购商</div></div>
          <div><div className="n">96.5%</div><div className="d">认证通过率</div></div>
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
  const [identity, setIdentity] = useState<Identity>('enterprise')
  const [phone, setPhone] = useState('')
  const [smsCode, setSmsCode] = useState('')
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)

  const [reg, setReg] = useState<RegisterForm>({
    identity: 'enterprise',
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

  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [hint, setHint] = useState('')
  const [busy, setBusy] = useState(false)
  const [sending, setSending] = useState<'login' | 'register' | null>(null)
  const [loginLeft, setLoginLeft] = useState(0)
  const [registerLeft, setRegisterLeft] = useState(0)
  const [success, setSuccess] = useState<{ redirect: string | null; identity: Identity; hasIdCard: boolean } | null>(null)

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
        identity,
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

  async function submitRegister(event: FormEvent): Promise<void> {
    event.preventDefault()
    setError('')
    setNotice('')
    setHint('')
    if (reg.identity === 'enterprise') {
      if (!reg.companyName.trim()) {
        setError('请填写企业名称')
        return
      }
      if (!/^[0-9A-Za-z]{15,18}$/.test(reg.creditCode.trim())) {
        setError('请填写 15-18 位统一社会信用代码')
        return
      }
    } else if (!reg.realName.trim()) {
      setError('请填写真实姓名')
      return
    }
    if (reg.idCard.trim() && !/^\d{17}[\dXx]$/.test(reg.idCard.trim())) {
      setError('身份证号应为 18 位（末位可为 X）')
      return
    }
    if (!reg.contactName.trim()) {
      setError('请填写联系人姓名')
      return
    }
    if (!/^1[3-9]\d{9}$/.test(reg.phone)) {
      setError('请填写正确的 11 位手机号')
      return
    }
    if (!/^\d{6}$/.test(reg.code)) {
      setError('请输入 6 位短信验证码')
      return
    }
    if (reg.password.length < 8 || reg.password.length > 20) {
      setError('密码长度应为 8-20 位')
      return
    }
    if (!/[a-zA-Z]/.test(reg.password) || !/\d/.test(reg.password)) {
      setError('密码需同时包含字母和数字')
      return
    }
    if (reg.password !== reg.confirm) {
      setError('两次输入的密码不一致')
      return
    }
    if (!reg.agree) {
      setError('请先阅读并同意用户服务协议、隐私政策与企业入驻规则')
      return
    }

    setBusy(true)
    try {
      const response = await fetch('/api/v1/sso/register-by-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: reg.phone,
          code: reg.code,
          nickname: reg.identity === 'enterprise' ? reg.companyName.trim() : reg.realName.trim(),
          marketId: 1,
          password: reg.password,
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
          clientId: ctx.clientId,
          redirectUri: ctx.redirectUri,
          state: ctx.state,
          codeChallenge: ctx.codeChallenge,
          codeChallengeMethod: ctx.codeChallengeMethod,
        }),
      })
      const body = (await response.json()) as SsoBody
      if (!response.ok || body.code !== 0) {
        setError(body.message ?? '注册失败，请重试')
        return
      }
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
      <div className="form-sub">登录以查看订单、使用 AI 撮合与议价、申请供应链金融</div>

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
        <div className="auth-field">
          <span>登录身份</span>
          <div className="identity-inline">
            <label><input type="radio" name="login-identity" checked={identity === 'enterprise'}
              onChange={() => setIdentity('enterprise')} />企业会员</label>
            <label><input type="radio" name="login-identity" checked={identity === 'personal'}
              onChange={() => setIdentity('personal')} />个人会员</label>
          </div>
        </div>

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
                placeholder={identity === 'enterprise' ? '请输入账号（手机号 / 用户名）' : '请输入手机号 / 用户名'}
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
      <div className="form-title">创建账号</div>
      <div className="form-sub">加入 38 万+ 注册用户，开启产业数字化协作</div>

      <div className="steps">
        <div className="step on">① 填写信息</div>
        <div className="step">② 提交审核</div>
        <div className="step">③ 完成入驻</div>
      </div>

      <form className="auth-form" onSubmit={(event) => void submitRegister(event)}>
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
              身份证号
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

        <div className="form-section">联系人 &amp; 登录信息<small>用于账号登录、订单与审核通知</small></div>

        <div className="form-grid">
          <label className="auth-field">
            联系人姓名<span className="req">*</span>
            <input className="auth-input" value={reg.contactName} placeholder="用于接收重要通知"
              onChange={(event) => patchReg({ contactName: event.target.value })} />
          </label>
          <label className="auth-field">
            联系电话<span className="req">*</span>
            <input className="auth-input" type="tel" value={reg.phone} maxLength={11} inputMode="numeric"
              placeholder="11 位手机号"
              onChange={(event) => patchReg({ phone: event.target.value.replace(/\D/g, '') })} />
          </label>
        </div>

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
              placeholder="8-20 位字母+数字"
              onChange={(event) => patchReg({ password: event.target.value })} />
            <span className={`pwd-meter ${strength}`}><i /><i /><i /></span>
          </label>
          <label className="auth-field">
            确认密码<span className="req">*</span>
            <input className="auth-input" type="password" value={reg.confirm} maxLength={20}
              placeholder="再次输入密码"
              onChange={(event) => patchReg({ confirm: event.target.value })} />
          </label>
        </div>

        <label className="agreement">
          <input type="checkbox" checked={reg.agree} onChange={(event) => patchReg({ agree: event.target.checked })} />
          <span>
            我已阅读并同意
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

        <button type="submit" className="auth-submit" style={{ marginTop: 18 }} disabled={busy}>
          {busy ? '提交中…' : '免费注册'}
        </button>

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
