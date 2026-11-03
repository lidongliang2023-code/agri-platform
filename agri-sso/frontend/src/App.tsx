import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { BrandMark } from './BrandMark'
import { AlipayIcon, GovernmentServiceIcon, WechatIcon } from './ThirdPartyIcons'

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
  legalPerson: string
  contactPhone: string
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
    merchantId?: number | string
    /** 二次验证：true 时其余字段为空，必须走第二步提交验证码 */
    mfaRequired?: boolean
    challengeToken?: string
    verification?: {
      channel?: string
      policeVerified?: boolean
      livenessVerified?: boolean
      businessLicenseUrl?: string
      legalPersonFaceUrl?: string
      legalPersonFaceStatus?: string
      corporateBankName?: string
      corporateBankAccount?: string
      corporateTransferAmount?: string
      corporateTransferReference?: string
      corporateTransferProofUrl?: string
      corporateTransferStatus?: string
      registeredCapital?: string
      idNoMasked?: string
      creditCode?: string
      legalPerson?: string
    }
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

function homeUrlOf(_redirectUri: string): string {
  // “返回首页”统一回官网门户，不从 redirect_uri 推导（它通常指向 /sso/callback，
  // 推导出来只会回到业务入口或认证中心，不是用户理解的官网首页）。
  return `${window.location.protocol}//${window.location.hostname}:8098/portal/#/`
}

/** 独立注册 / 直接登录后的默认落点：生产管理模块的用户端入口。 */
function platformEntry(): string {
  return `${window.location.protocol}//${window.location.hostname}/production/login`
}

/**
 * 找回密码的发送冷却记在 localStorage 里，按手机号区分。
 *
 * <p>只放内存的话，刷新页面倒计时就归零，但服务端冷却还在 —— 用户看到的是可点的
 * 「获取验证码」，点下去却报"发送过于频繁"。这里把到期时间戳落下来，刷新后按真实剩余秒数恢复。</p>
 */
const RESET_COOLDOWN_KEY = 'agri_sso_reset_cooldown'

function readResetCooldown(phone: string): number {
  if (!/^1[3-9]\d{9}$/.test(phone)) return 0
  try {
    const raw = window.localStorage.getItem(RESET_COOLDOWN_KEY)
    if (!raw) return 0
    const saved = JSON.parse(raw) as { phone?: string; until?: number }
    if (saved.phone !== phone || !saved.until) return 0
    return Math.max(0, Math.ceil((saved.until - Date.now()) / 1000))
  } catch {
    return 0
  }
}

function writeResetCooldown(phone: string, seconds: number): void {
  try {
    window.localStorage.setItem(RESET_COOLDOWN_KEY, JSON.stringify({ phone, until: Date.now() + seconds * 1000 }))
  } catch {
    // 隐私模式下 localStorage 可能不可写，降级为仅内存倒计时
  }
}

/** 手机号脱敏：138****8000（找回密码全程只展示脱敏号，避免肩窥带走完整号码） */
function maskPhone(value: string): string {
  return /^\d{11}$/.test(value) ? `${value.slice(0, 3)}****${value.slice(7)}` : value
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
    case 'eye':
      return <svg {...common}><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.8" /></svg>
    case 'eye-off':
      return <svg {...common}><path d="m3 3 18 18" /><path d="M10.6 6.2A11 11 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-2.1 2.8M6.2 6.5C3.8 8.2 2.5 12 2.5 12s3.5 6 9.5 6c1.3 0 2.5-.3 3.6-.7" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
    default:
      return <svg {...common}><circle cx="12" cy="12" r="8" /></svg>
  }
}

function LoginAside(): JSX.Element {
  return (
    <aside className="auth-aside">
      <div className="aside-brand">
        <span className="logo"><BrandMark size={44} /></span>
        <span>丰链云<small>FENGCHAIN · AGRI</small></span>
      </div>
      <div className="aside-body">
        <div className="aside-title">登录丰链云<br />继续您的产业协作</div>
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

function ResetAside(): JSX.Element {
  return (
    <aside className="auth-aside">
      <div className="aside-brand">
        <span className="logo"><BrandMark size={44} /></span>
        <span>丰链云<small>FENGCHAIN · AGRI</small></span>
      </div>
      <div className="aside-body">
        <div className="aside-title">找回密码<br />安全地重新进入</div>
        <div className="aside-sub">
          通过注册手机号验证身份后设置新密码。整个过程不需要旧密码，也不会把验证码回显在页面上。
        </div>
        <div className="flow-list">
          <div className="flow-item on">
            <span className="n">1</span>
            <div><strong>验证本人身份</strong><small>验证码只发送到注册手机号，5 分钟内有效</small></div>
          </div>
          <div className="flow-item">
            <span className="n">2</span>
            <div><strong>设置新密码</strong><small>8-20 位，同时包含字母和数字，避开连续数字与生日</small></div>
          </div>
          <div className="flow-item">
            <span className="n">3</span>
            <div><strong>全端退出</strong><small>重置成功后，该账号在所有设备上的登录立即失效</small></div>
          </div>
        </div>
      </div>
    </aside>
  )
}

function RegisterAside(): JSX.Element {
  return (
    <aside className="auth-aside">
      <div className="aside-brand">
        <span className="logo"><BrandMark size={44} /></span>
        <span>丰链云<small>FENGCHAIN · AGRI</small></span>
      </div>
      <div className="aside-body">
        <div className="aside-title">先创建账号<br />再开通会员能力</div>
        <div className="aside-sub">
          丰链云采用「账号 → 主体 → 认证」三段式开通流程。本页将一次收集账号与主体资料，
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
  // ?mode=forgot 让用户中心「找回密码」一点直达，而不是落在登录页还要再点一次。
  const initialQuery = useMemo(() => new URLSearchParams(window.location.search), [])
  const isRegister = useMemo(() => {
    const path = window.location.pathname.replace(/\/+$/, '')
    return path.endsWith('/register') || initialQuery.get('mode') === 'register'
  }, [initialQuery])
  const contextMissing = ctx.clientId === '' || ctx.redirectUri === ''
  const [tab, setTab] = useState<LoginTab>('sms')
  const [phone, setPhone] = useState('')
  const [smsCode, setSmsCode] = useState('')
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [forgotOpen, setForgotOpen] = useState(initialQuery.get('mode') === 'forgot')
  // 冻结申诉：账号被冻结时登不进来，所以这个表单不需要密码，只凭手机号 + 理由
  const [appealOpen, setAppealOpen] = useState(false)
  const [appealForm, setAppealForm] = useState({ phone: '', reason: '' })
  const [appealBusy, setAppealBusy] = useState(false)
  const [appealDone, setAppealDone] = useState('')
  const [resetForm, setResetForm] = useState({
    phone: initialQuery.get('mode') === 'forgot'
      ? (initialQuery.get('phone') ?? '').replace(/\D/g, '').slice(0, 11)
      : '',
    code: '',
    password: '',
    confirm: '',
  })
  const [resetStep, setResetStep] = useState<1 | 2 | 3>(1)
  // 验证码发给的是哪个号：手机号改过之后必须重新获取，不能拿旧码往下走
  const [resetSentPhone, setResetSentPhone] = useState('')
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const [reg, setReg] = useState<RegisterForm>({
    identity: new URLSearchParams(window.location.search).get('identity') === 'personal'
      ? 'personal' : 'enterprise',
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
    legalPerson: '',
    contactPhone: '',
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
  // 二次验证：密码通过后停在这一步，拿到一次性 challenge 再换真正的登录态
  const [mfaChallenge, setMfaChallenge] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [sending, setSending] = useState<'login' | 'register' | 'reset' | null>(null)
  const [loginLeft, setLoginLeft] = useState(0)
  const [registerLeft, setRegisterLeft] = useState(0)
  const [resetLeft, setResetLeft] = useState(0)
  const [success, setSuccess] = useState<{ redirect: string | null; identity: Identity; hasIdCard: boolean } | null>(null)
  const [accountCreated, setAccountCreated] = useState(false)
  const [onboardingStage, setOnboardingStage] = useState('')
  const [onboardingMerchantId, setOnboardingMerchantId] = useState<string | null>(null)
  const [identityIdMasked, setIdentityIdMasked] = useState('')
  const [verificationUploading, setVerificationUploading] = useState('')
  const [verificationSubmitting, setVerificationSubmitting] = useState(false)
  const [personalVerification, setPersonalVerification] = useState({
    policeVerified: false,
    livenessVerified: false,
    channel: '',
  })
  const [enterpriseVerification, setEnterpriseVerification] = useState({
    businessLicenseUrl: '',
    legalPersonFaceUrl: '',
    legalPersonFaceStatus: '',
    corporateBankName: '',
    corporateBankAccount: '',
    corporateTransferAmount: '',
    corporateTransferReference: '',
    corporateTransferProofUrl: '',
    corporateTransferStatus: '',
    registeredCapital: '',
    channel: '',
  })

  const applyOnboardingData = (data: NonNullable<SsoBody['data']>): void => {
    const stage = data.stage ?? ''
    setOnboardingStage(stage)
    setOnboardingMerchantId(data.merchantId == null ? null : String(data.merchantId))
    setAccountCreated(true)
    const evidence = data.verification
    if (evidence) {
      setIdentityIdMasked(evidence.idNoMasked ?? '')
      setPersonalVerification({
        policeVerified: Boolean(evidence.policeVerified),
        livenessVerified: Boolean(evidence.livenessVerified),
        channel: evidence.channel ?? '',
      })
      setEnterpriseVerification({
        businessLicenseUrl: evidence.businessLicenseUrl ?? '',
        legalPersonFaceUrl: evidence.legalPersonFaceUrl ?? '',
        legalPersonFaceStatus: evidence.legalPersonFaceStatus ?? '',
        corporateBankName: evidence.corporateBankName ?? '',
        corporateBankAccount: evidence.corporateBankAccount ?? '',
        corporateTransferAmount: evidence.corporateTransferAmount ?? '',
        corporateTransferReference: evidence.corporateTransferReference ?? '',
        corporateTransferProofUrl: evidence.corporateTransferProofUrl ?? '',
        corporateTransferStatus: evidence.corporateTransferStatus ?? '',
        registeredCapital: evidence.registeredCapital ?? '',
        channel: evidence.channel ?? '',
      })
    }
    setReg((previous) => ({
      ...previous,
      phone: data.phone ?? previous.phone,
      nickname: data.nickname ?? previous.nickname,
      identity: data.identity === 'personal' ? 'personal' : previous.identity,
      companyName: data.identity === 'enterprise' ? (data.subjectName ?? previous.companyName) : previous.companyName,
      realName: data.identity === 'personal' ? (data.subjectName ?? previous.realName) : previous.realName,
      creditCode: data.identity === 'enterprise' ? (evidence?.creditCode ?? previous.creditCode) : previous.creditCode,
      legalPerson: data.identity === 'enterprise' ? (evidence?.legalPerson ?? previous.legalPerson) : previous.legalPerson,
      contactName: previous.contactName || data.subjectName || '',
    }))
  }

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
    if (resetLeft <= 0) return undefined
    const timer = window.setTimeout(() => setResetLeft(resetLeft - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [resetLeft])

  // 打开找回密码或更换手机号时，按 localStorage 里的到期时间恢复真实剩余秒数
  useEffect(() => {
    if (!forgotOpen) return
    setResetLeft(readResetCooldown(resetForm.phone))
  }, [forgotOpen, resetForm.phone])

  useEffect(() => {
    if (!isRegister) return
    let cancelled = false
    void fetch('/api/v1/sso/onboarding/status', { credentials: 'include' })
      .then(async (response) => ({ ok: response.ok, body: await response.json() as SsoBody }))
      .then(({ ok, body }) => {
        if (cancelled || !ok || body.code !== 0 || !body.data) return
        const data = body.data
        const stage = data.stage ?? ''
        const requestedStep = Number(new URLSearchParams(window.location.search).get('step'))
        if (stage === 'subject') setRegStep(requestedStep === 2 ? 2 : 1)
        if (stage === 'certification' || stage === 'pending' || stage === 'done') {
          setRegStep(requestedStep === 1 || requestedStep === 2 ? requestedStep as 1 | 2 : 3)
        }
        applyOnboardingData(data)
      })
      .catch(() => { /* 无 SSO 会话：从第 1 步开始 */ })
    return () => { cancelled = true }
  }, [isRegister])

  const patchReg = (patch: Partial<RegisterForm>): void => {
    setReg((previous) => ({ ...previous, ...patch }))
    setError('')
  }

  const goToStep = (step: 1 | 2 | 3): void => {
    const url = new URL(window.location.href)
    url.searchParams.set('step', String(step))
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
    setRegStep(step)
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

  // 找回密码的强度与规则清单：与后端 AccountPolicyService 的默认策略（8-20 位、字母+数字）对齐，
  // 更严的策略由后端兜底并在提交时回显它自己的报错文案。
  const resetStrength = useMemo(() => {
    const value = resetForm.password
    let score = 0
    if (value.length >= 8) score += 1
    if (/[a-zA-Z]/.test(value)) score += 1
    if (/\d/.test(value)) score += 1
    if (/[^a-zA-Z0-9]/.test(value)) score += 1
    if (score >= 3 && value.length >= 10) return 'strong'
    if (score >= 2 && value.length >= 8) return 'fair'
    return ''
  }, [resetForm.password])

  const resetRules = useMemo(() => ({
    length: resetForm.password.length >= 8 && resetForm.password.length <= 20,
    letter: /[a-zA-Z]/.test(resetForm.password),
    digit: /\d/.test(resetForm.password),
    match: resetForm.password !== '' && resetForm.password === resetForm.confirm,
  }), [resetForm.password, resetForm.confirm])

  const certificationReady = useMemo(() => reg.identity === 'personal'
    ? personalVerification.policeVerified && personalVerification.livenessVerified
    : enterpriseVerification.legalPersonFaceStatus === 'verified'
      && ['submitted', 'verified'].includes(enterpriseVerification.corporateTransferStatus),
    [reg.identity, personalVerification, enterpriseVerification])

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
      if (!reg.legalPerson.trim()) {
        setError('请填写法定代表人姓名')
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
    if (reg.contactPhone.trim() && !/^1[3-9]\d{9}$/.test(reg.contactPhone.trim())) {
      setError('请填写正确的 11 位联系电话')
      return false
    }
    return true
  }

  async function requestCode(
    scene: 'login' | 'register' | 'reset_password',
    targetPhone: string,
    kind: 'login' | 'register' | 'reset',
  ): Promise<void> {
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
      else if (kind === 'register') setRegisterLeft(60)
      else {
        setResetSentPhone(targetPhone)
        writeResetCooldown(targetPhone, 60)
        setResetLeft(60)
        setHint(`验证码已发送至 ${maskPhone(targetPhone)}，5 分钟内有效。${body.data?.hint ? ` ${body.data.hint}` : ''}`)
      }
    } catch {
      setError('无法联系认证服务，请确认后端已启动')
    } finally {
      setSending(null)
    }
  }

  /** 提交冻结申诉（免登录接口，见 FreezeAppealController） */
  async function submitAppeal(event: FormEvent): Promise<void> {
    event.preventDefault()
    setError('')
    setNotice('')
    setHint('')
    if (!/^1[3-9]\d{9}$/.test(appealForm.phone)) {
      setError('请输入正确的 11 位手机号')
      return
    }
    if (appealForm.reason.trim().length < 5) {
      setError('请把申诉理由写清楚（至少 5 个字），便于运营复核')
      return
    }
    setAppealBusy(true)
    try {
      const response = await fetch('/api/v1/sso/freeze-appeal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: appealForm.phone, reason: appealForm.reason.trim() }),
      })
      const body = (await response.json()) as SsoBody
      if (!response.ok || body.code !== 0) {
        setError(body.message ?? '申诉提交失败，请重试')
        return
      }
      setAppealDone(body.message ?? '申诉已提交，请等待运营复核')
    } catch {
      setError('无法联系认证服务，请确认后端已启动')
    } finally {
      setAppealBusy(false)
    }
  }

  /** 第一步：只校验"手机号 + 该手机号已收到验证码"，真正核对验证码在最终提交时做。 */
  function goResetStep2(event: FormEvent): void {
    event.preventDefault()
    setError('')
    setNotice('')
    if (!/^1[3-9]\d{9}$/.test(resetForm.phone)) {
      setError('请输入正确的 11 位注册手机号')
      return
    }
    if (resetSentPhone !== resetForm.phone) {
      setError('请先获取该手机号的验证码')
      return
    }
    if (!/^\d{6}$/.test(resetForm.code)) {
      setError('请输入 6 位短信验证码')
      return
    }
    setError('')
    setResetStep(2)
  }

  async function submitPasswordReset(event: FormEvent): Promise<void> {
    event.preventDefault()
    setError('')
    setNotice('')
    if (resetForm.password.length < 8 || resetForm.password.length > 20
      || !/[a-zA-Z]/.test(resetForm.password) || !/\d/.test(resetForm.password)) {
      setError('密码应为 8-20 位，且同时包含字母和数字')
      return
    }
    if (resetForm.password !== resetForm.confirm) {
      setError('两次输入的密码不一致')
      return
    }
    setBusy(true)
    try {
      const response = await fetch('/api/v1/sso/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: resetForm.phone,
          code: resetForm.code,
          newPassword: resetForm.password,
          confirmPassword: resetForm.confirm,
        }),
      })
      const body = (await response.json()) as SsoBody
      if (!response.ok || body.code !== 0) {
        const message = body.message ?? '密码重置失败，请重试'
        // 验证码错/过期只能回到第一步重填，停在第二步只会让用户反复点提交
        if (message.includes('验证码')) {
          setResetStep(1)
          setResetForm((previous) => ({ ...previous, code: '' }))
        }
        setError(message)
        return
      }
      setResetStep(3)
      setResetForm((previous) => ({
        phone: previous.phone,
        code: '',
        password: '',
        confirm: '',
      }))
      setResetSentPhone('')
      setShowResetPassword(false)
      setShowResetConfirm(false)
    } catch {
      setError('无法联系认证服务，请确认后端已启动')
    } finally {
      setBusy(false)
    }
  }

  /** 完成页「返回登录」：带回手机号，只差输入新密码。 */
  function backToLoginAfterReset(): void {
    setForgotOpen(false)
    setResetStep(1)
    setTab('pwd')
    setAccount(resetForm.phone)
    setPhone(resetForm.phone)
    setPassword('')
    setError('')
    setHint('')
    setNotice('密码已重置，请使用新密码登录')
  }

  /** 关闭找回密码（返回登录）：保留已填手机号，清掉验证码与错误。 */
  function closeForgot(): void {
    setForgotOpen(false)
    setResetStep(1)
    setResetForm({ phone: resetForm.phone, code: '', password: '', confirm: '' })
    setResetSentPhone('')
    setError('')
    setHint('')
  }

  async function submitLogin(event: FormEvent): Promise<void> {
    event.preventDefault()
    setError('')
    setNotice('')
    setHint('')
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
      const loginUrl = contextMissing
        ? (tab === 'sms' ? '/api/v1/sso/login-standalone-by-sms' : '/api/v1/sso/login-standalone')
        : (tab === 'sms' ? '/api/v1/sso/login-by-sms' : '/api/v1/sso/login')
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tab === 'sms'
          ? (contextMissing
              ? { phone, code: smsCode, marketId: 1, remember }
              : { ...common, phone, code: smsCode })
          : (contextMissing
              ? {
                  username: /^1[3-9]\d{9}$/.test(account.trim()) ? undefined : account.trim(),
                  phone: /^1[3-9]\d{9}$/.test(account.trim()) ? account.trim() : undefined,
                  password,
                  marketId: 1,
                  remember,
                }
              : {
              ...common,
              // 账号框既接受用户名也接受手机号：11 位手机号走 phone 字段，
              // 其余按 username 查（两个都传时服务端以 username 为准，所以只传一个）
              username: /^1[3-9]\d{9}$/.test(account.trim()) ? undefined : account.trim(),
              phone: /^1[3-9]\d{9}$/.test(account.trim()) ? account.trim() : undefined,
              password,
            })),
      })
      const body = (await response.json()) as SsoBody
      if (!response.ok || body.code !== 0) {
        setError(body.message ?? '登录失败，请重试')
        return
      }
      // 二次验证：密码对了但还不能登录，切到验证码这一步。
      // 服务端此时**没有建会话**，只给了一个 5 分钟有效的一次性 challenge。
      if (body.data?.mfaRequired) {
        setMfaChallenge(body.data.challengeToken ?? '')
        setMfaCode('')
        setNotice('该账号已开启二次验证，请输入验证器上的 6 位动态码')
        return
      }
      finishLogin(body.data)
    } catch {
      setError('无法联系认证服务，请确认后端已启动')
    } finally {
      setBusy(false)
    }
  }

  /** 登录成功后的统一出口：分步注册 / 回跳 */
  function finishLogin(data: SsoBody['data']): void {
    const stage = data?.stage
    if (stage && stage !== 'done') {
      const query = window.location.search || ''
      const separator = query ? '&' : '?'
      window.location.href = `/register${query}${separator}step=${stage === 'subject' ? 2 : 3}`
      return
    }
    const redirect = data?.redirect
    if (!redirect) {
      setError('认证中心未返回回跳地址，请联系平台运营')
      return
    }
    // 独立登录返回的是站内路径（/production/... 或 /admin/...），
    // 必须切到平台根域，不能留在 :8090 的认证中心 origin 下。
    window.location.href = contextMissing && redirect.startsWith('/')
      ? `${window.location.protocol}//${window.location.hostname}${redirect}`
      : redirect
  }

  /** 登录第二步：提交二次验证码 */
  async function submitMfa(event: FormEvent): Promise<void> {
    event.preventDefault()
    setError('')
    setNotice('')
    if (mfaCode.replace(/\s/g, '').length < 6) {
      setError('请输入验证器上的 6 位动态码，或一个备用码')
      return
    }
    setBusy(true)
    try {
      const response = await fetch('/api/v1/sso/login-standalone-mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeToken: mfaChallenge,
          code: mfaCode.trim(),
          marketId: 1,
          remember,
        }),
      })
      const body = (await response.json()) as SsoBody
      if (!response.ok || body.code !== 0) {
        // challenge 是一次性的：校验失败后必须重新走密码登录
        setError(body.message ?? '验证码不正确')
        setMfaChallenge('')
        setMfaCode('')
        return
      }
      finishLogin(body.data)
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
      if (body.data) applyOnboardingData(body.data)
      else {
        setAccountCreated(true)
        setOnboardingStage('subject')
      }
      patchReg({ code: '' })
      setNotice('登录账号已创建。你可以现在创建一个经营主体，也可以稍后继续。')
    } catch {
      setError('无法联系认证服务，请确认后端已启动')
    } finally {
      setBusy(false)
    }
  }

  async function createSubjectStep(continueToCertification = true): Promise<void> {
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
          contactPhone: reg.contactPhone.trim() || reg.phone,
          legalPerson: reg.identity === 'enterprise' ? reg.legalPerson.trim() : reg.realName.trim(),
          licenseNo: reg.identity === 'enterprise' ? reg.creditCode.trim() : '',
        }),
      })
      const body = (await response.json()) as SsoBody
      if (!response.ok || body.code !== 0) {
        setError(body.message ?? '主体创建失败')
        return
      }
      if (body.data) applyOnboardingData(body.data)
      else {
        setOnboardingStage('certification')
      }
      goToStep(continueToCertification ? 3 : 2)
      setNotice(continueToCertification
        ? '经营主体已创建，请完成认证资料后提交审核。'
        : '经营主体已保存。你可以稍后回到认证中心继续完成认证开通。')
    } catch {
      setError('无法联系认证服务，请确认后端已启动')
    } finally {
      setBusy(false)
    }
  }

  function finishOnboardingForNow(): void {
    if (contextMissing) {
      switchView('/login')
      return
    }
    window.location.href = homeUrl
  }

  async function verifyPersonalEvidence(kind: 'police' | 'liveness'): Promise<void> {
    setError('')
    setNotice('')
    setHint('')
    if (kind === 'police' && (!reg.realName.trim() || !reg.idCard.trim())) {
      setError('公安二要素核验需要真实姓名和身份证号，请先补充')
      return
    }
    setVerificationSubmitting(true)
    try {
      const response = await fetch(`/api/v1/sso/onboarding/verification/personal/${kind}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: kind === 'police'
          ? JSON.stringify({ realName: reg.realName.trim(), idCard: reg.idCard.trim() })
          : undefined,
      })
      const body = (await response.json()) as SsoBody
      if (!response.ok || body.code !== 0 || !body.data) {
        setError(body.message ?? (kind === 'police' ? '公安二要素核验失败' : '活体检测失败'))
        return
      }
      applyOnboardingData(body.data)
      setNotice(kind === 'police' ? '公安二要素核验通过。' : '人脸活体检测通过。')
    } catch {
      setError('无法联系实名核验服务，请确认后端已启动')
    } finally {
      setVerificationSubmitting(false)
    }
  }

  async function uploadEnterpriseEvidence(
    kind: 'business_license' | 'legal_person_face' | 'corporate_transfer_proof',
    file: File,
  ): Promise<void> {
    if (!onboardingMerchantId) {
      setError('经营主体尚未创建，无法上传认证材料')
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('仅支持 JPG、PNG、WEBP 图片')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('单张图片不能超过 5MB')
      return
    }
    setError('')
    setVerificationUploading(kind)
    try {
      const form = new FormData()
      form.append('file', file)
      const response = await fetch(
        `/api/v1/sso/account/businesses/${onboardingMerchantId}/certification-files?kind=${kind}`,
        { method: 'POST', credentials: 'include', body: form },
      )
      const body = (await response.json()) as SsoBody & { data?: { url?: string } }
      if (!response.ok || body.code !== 0 || !body.data?.url) {
        setError(body.message ?? '认证材料上传失败')
        return
      }
      setEnterpriseVerification((current) => ({
        ...current,
        ...(kind === 'business_license' ? { businessLicenseUrl: body.data!.url! } : {}),
        ...(kind === 'legal_person_face' ? {
          legalPersonFaceUrl: body.data!.url!,
          legalPersonFaceStatus: 'uploaded',
        } : {}),
        ...(kind === 'corporate_transfer_proof' ? {
          corporateTransferProofUrl: body.data!.url!,
          corporateTransferStatus: 'uploaded',
        } : {}),
      }))
      setNotice(kind === 'legal_person_face' ? '法人扫脸材料已采集。' : '认证材料上传成功。')
    } catch {
      setError('认证材料上传失败，请检查网络后重试')
    } finally {
      setVerificationUploading('')
    }
  }

  async function prepareEnterpriseEvidence(): Promise<void> {
    setError('')
    setNotice('')
    if (!reg.legalPerson.trim()) return setError('请填写法定代表人姓名')
    if (!enterpriseVerification.businessLicenseUrl) return setError('请上传营业执照照片')
    if (!enterpriseVerification.legalPersonFaceUrl) return setError('请完成法人扫脸材料采集')
    if (!enterpriseVerification.corporateBankName.trim()) return setError('请填写对公账户户名')
    if (!/^\d{8,32}$/.test(enterpriseVerification.corporateBankAccount.replace(/\s/g, ''))) {
      return setError('请填写有效的对公账户账号')
    }
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(enterpriseVerification.corporateTransferAmount)) {
      return setError('请填写正确的对公打款金额')
    }
    if (enterpriseVerification.corporateTransferReference.trim().length < 6) {
      return setError('请填写至少 6 位的对公打款流水号')
    }
    if (!enterpriseVerification.corporateTransferProofUrl) return setError('请上传对公打款凭证')
    setVerificationSubmitting(true)
    try {
      const response = await fetch('/api/v1/sso/onboarding/verification/enterprise/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          legalPerson: reg.legalPerson.trim(),
          registeredCapital: enterpriseVerification.registeredCapital.trim(),
          businessLicenseUrl: enterpriseVerification.businessLicenseUrl,
          legalPersonFaceUrl: enterpriseVerification.legalPersonFaceUrl,
          corporateBankName: enterpriseVerification.corporateBankName.trim(),
          corporateBankAccount: enterpriseVerification.corporateBankAccount,
          corporateTransferAmount: enterpriseVerification.corporateTransferAmount,
          corporateTransferReference: enterpriseVerification.corporateTransferReference.trim(),
          corporateTransferProofUrl: enterpriseVerification.corporateTransferProofUrl,
        }),
      })
      const body = (await response.json()) as SsoBody
      if (!response.ok || body.code !== 0 || !body.data) {
        setError(body.message ?? '企业认证材料校验失败')
        return
      }
      applyOnboardingData(body.data)
      setNotice('营业执照、法人扫脸和对公打款材料已通过前置校验，可以提交审核。')
    } catch {
      setError('无法联系企业核验服务，请确认后端已启动')
    } finally {
      setVerificationSubmitting(false)
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

  const loginView = appealOpen ? (
    <>
      <div className="form-title">提交冻结申诉</div>
      <div className="form-sub">账号被冻结后无法登录，因此这里不需要密码。填写注册手机号与申诉理由，运营会人工复核。</div>
      <button type="button" className="auth-reset-back"
        onClick={() => { setAppealOpen(false); setError(''); setNotice(''); setAppealDone('') }}>
        ← 返回登录
      </button>
      {appealDone !== '' ? (
        <>
          <div className="auth-notice">{appealDone}</div>
          <div className="auth-hint">
            申诉不会自动解封，需运营复核后处理。结果会以站内信通知，也可稍后重新尝试登录查看是否已解除。
          </div>
        </>
      ) : (
        <form className="auth-form" onSubmit={(event) => void submitAppeal(event)}>
          <label className="auth-field">
            注册手机号
            <input className="auth-input" type="tel" value={appealForm.phone} maxLength={11} inputMode="numeric"
              autoComplete="tel" placeholder="请输入 11 位手机号"
              onChange={(event) => {
                setAppealForm({ ...appealForm, phone: event.target.value.replace(/\D/g, '') })
                setError('')
              }} />
          </label>
          <label className="auth-field">
            申诉理由
            <textarea className="auth-input" rows={4} value={appealForm.reason} maxLength={500}
              placeholder="请说明情况，例如：账号因异常登录被冻结，本人可提供身份证明配合核实"
              style={{ resize: 'vertical', minHeight: 96, lineHeight: 1.7 }}
              onChange={(event) => {
                setAppealForm({ ...appealForm, reason: event.target.value })
                setError('')
              }} />
          </label>
          <button type="submit" className="auth-submit" disabled={appealBusy}>
            {appealBusy ? '提交中…' : '提交申诉'}
          </button>
          {error !== '' && <div className="auth-error">{error}</div>}
          <div className="auth-hint">
            同一账号只能有一条待处理申诉；驳回后可补充说明重新提交。
          </div>
        </form>
      )}
    </>
  ) : forgotOpen ? (
    <>
      <div className="form-title">{resetStep === 3 ? '密码已重置' : '找回密码'}</div>
      <div className="form-sub">
        {resetStep === 1 && '验证注册手机号，确认是本人在操作；验证码 5 分钟内有效。'}
        {resetStep === 2 && '设置新密码。提交成功后，该账号在所有设备上的登录会立即失效。'}
        {resetStep === 3 && '新密码已生效，旧密码与已登录的会话都不能再使用。'}
      </div>
      {resetStep < 3 && (
        <button type="button" className="auth-reset-back" onClick={closeForgot}>← 返回登录</button>
      )}

      <ol className="reset-steps" aria-label="找回密码步骤">
        {([[1, '验证手机号'], [2, '设置新密码'], [3, '完成']] as const).map(([step, label]) => (
          <li
            key={step}
            className={resetStep === step ? 'on' : resetStep > step ? 'done' : ''}
            aria-current={resetStep === step ? 'step' : undefined}
          >
            <i>{resetStep > step ? '✓' : step}</i>
            <span>{label}</span>
          </li>
        ))}
      </ol>

      {resetStep === 1 && (
        <form className="auth-form" onSubmit={goResetStep2}>
          <label className="auth-field">
            注册手机号<span className="req">*</span>
            <input className="auth-input" type="tel" value={resetForm.phone} maxLength={11} inputMode="numeric"
              autoComplete="tel" autoFocus placeholder="请输入 11 位手机号"
              onChange={(event) => {
                const next = event.target.value.replace(/\D/g, '')
                setResetForm({ ...resetForm, phone: next, code: '' })
                // 换号即作废旧验证码：验证码只对该手机号有效，留着只会让人白提交一次
                setResetSentPhone((sent) => (sent === next ? sent : ''))
                setError('')
                setHint('')
              }} />
          </label>
          <label className="auth-field">
            短信验证码<span className="req">*</span>
            <div className="code-row">
              <input className="auth-input" value={resetForm.code} maxLength={6} inputMode="numeric"
                autoComplete="one-time-code" placeholder="6 位验证码"
                onChange={(event) => {
                  setResetForm({ ...resetForm, code: event.target.value.replace(/\D/g, '') })
                  setError('')
                }} />
              <button type="button" className="btn-code" disabled={sending !== null || resetLeft > 0}
                onClick={() => void requestCode('reset_password', resetForm.phone, 'reset')}>
                {sending === 'reset' ? '发送中…'
                  : resetLeft > 0 ? `重新获取（${resetLeft}s）`
                    : resetSentPhone !== '' && resetSentPhone === resetForm.phone ? '重新获取' : '获取验证码'}
              </button>
            </div>
          </label>
          <button type="submit" className="auth-submit" disabled={busy}>下一步</button>
          {error !== '' && <div className="auth-error" role="alert">{error}</div>}
          {hint !== '' && <div className="auth-hint">{hint}</div>}
          <div className="auth-hint">
            没收到验证码？先确认手机号填写正确，60 秒后可重新获取。同一验证码连续输错会被作废，需要重新获取。
          </div>
        </form>
      )}

      {resetStep === 2 && (
        <form className="auth-form" onSubmit={(event) => void submitPasswordReset(event)}>
          <div className="reset-target">
            <span>正在重置 <strong>{maskPhone(resetForm.phone)}</strong> 的登录密码</span>
            <button type="button" onClick={() => { setResetStep(1); setError('') }}>更换手机号</button>
          </div>
          <label className="auth-field">
            新密码<span className="req">*</span>
            <div className="password-row">
              <input className="auth-input" type={showResetPassword ? 'text' : 'password'}
                value={resetForm.password} maxLength={20} autoComplete="new-password" autoFocus
                placeholder="8-20 位，同时包含字母和数字"
                onChange={(event) => { setResetForm({ ...resetForm, password: event.target.value }); setError('') }} />
              <button type="button" className="password-toggle"
                aria-label={showResetPassword ? '隐藏新密码' : '显示新密码'}
                title={showResetPassword ? '隐藏新密码' : '显示新密码'}
                aria-pressed={showResetPassword}
                onClick={() => setShowResetPassword((visible) => !visible)}>
                <Icon name={showResetPassword ? 'eye-off' : 'eye'} size={19} />
              </button>
            </div>
            <span className={`pwd-meter ${resetStrength}`} aria-hidden="true"><i /><i /><i /></span>
          </label>
          <label className="auth-field">
            确认新密码<span className="req">*</span>
            <div className="password-row">
              <input className="auth-input" type={showResetConfirm ? 'text' : 'password'}
                value={resetForm.confirm} maxLength={20} autoComplete="new-password"
                placeholder="请再次输入新密码"
                onChange={(event) => { setResetForm({ ...resetForm, confirm: event.target.value }); setError('') }} />
              <button type="button" className="password-toggle"
                aria-label={showResetConfirm ? '隐藏确认密码' : '显示确认密码'}
                title={showResetConfirm ? '隐藏确认密码' : '显示确认密码'}
                aria-pressed={showResetConfirm}
                onClick={() => setShowResetConfirm((visible) => !visible)}>
                <Icon name={showResetConfirm ? 'eye-off' : 'eye'} size={19} />
              </button>
            </div>
          </label>
          <ul className="pwd-rules" aria-label="密码规则">
            <li className={resetRules.length ? 'ok' : ''}>8-20 位</li>
            <li className={resetRules.letter ? 'ok' : ''}>含字母</li>
            <li className={resetRules.digit ? 'ok' : ''}>含数字</li>
            <li className={resetRules.match ? 'ok' : ''}>两次一致</li>
          </ul>
          <button type="submit" className="auth-submit" disabled={busy}>
            {busy ? '重置中…' : '确认重置密码'}
          </button>
          {error !== '' && <div className="auth-error" role="alert">{error}</div>}
          <div className="auth-hint">
            建议使用与其他网站不同的密码；手机号、生日、连续数字等易猜内容会被服务端拒绝。
          </div>
        </form>
      )}

      {resetStep === 3 && (
        <div className="reset-done">
          <div className="reset-done-icon" aria-hidden="true">✓</div>
          <p className="reset-done-text">
            手机号 <strong>{maskPhone(resetForm.phone)}</strong> 的登录密码已更新，该账号在其它设备上的登录已全部退出。
          </p>
          <ul className="reset-done-tips">
            <li>请使用新密码重新登录；再次忘记时可重复本次流程。</li>
            <li>如果这不是你本人的操作，请立即联系平台客服冻结账号。</li>
          </ul>
          <button type="button" className="auth-submit" onClick={backToLoginAfterReset}>返回登录</button>
        </div>
      )}
    </>
  ) : (
    <>
      <div className="form-title">欢迎回来</div>
      <div className="form-sub">登录后将自动识别您所处的账号环节，并引导至对应页面</div>

      {mfaChallenge === '' && <div className="auth-tabs" role="tablist" aria-label="登录方式">
        <button type="button" role="tab" aria-selected={tab === 'sms'} className={tab === 'sms' ? 'on' : ''}
          onClick={() => { setTab('sms'); setError(''); setNotice('') }}>
          手机号 + 验证码
        </button>
        <button type="button" role="tab" aria-selected={tab === 'pwd'} className={tab === 'pwd' ? 'on' : ''}
          onClick={() => { setTab('pwd'); setError(''); setNotice('') }}>
          账号 + 密码
        </button>
      </div>}

      <form className="auth-form"
        onSubmit={(event) => void (mfaChallenge ? submitMfa(event) : submitLogin(event))}>
        {mfaChallenge !== '' ? (
          <>
            <div className="auth-notice">
              该账号已开启二次验证。请输入验证器（Google / 微软 Authenticator 等）上的 6 位动态码；
              手机不在身边时，可用一个备用码登录（每个只能用一次）。
            </div>
            <label className="auth-field">
              动态码 / 备用码
              <input className="auth-input" value={mfaCode} maxLength={11} inputMode="numeric"
                autoComplete="one-time-code" placeholder="6 位动态码，或 XXXX-XXXXX 备用码"
                onChange={(event) => { setMfaCode(event.target.value.toUpperCase()); setError('') }} />
            </label>
          </>
        ) : tab === 'sms' ? (
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
            <div className="auth-field">
              <label htmlFor="login-password">密码</label>
              <div className="password-row">
                <input
                  id="login-password"
                  className="auth-input"
                  type={showLoginPassword ? 'text' : 'password'}
                  value={password}
                  autoComplete="current-password"
                  placeholder="请输入登录密码"
                  onChange={(event) => { setPassword(event.target.value); setError('') }}
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={showLoginPassword ? '隐藏密码' : '显示密码'}
                  title={showLoginPassword ? '隐藏密码' : '显示密码'}
                  aria-pressed={showLoginPassword}
                  onClick={() => setShowLoginPassword((visible) => !visible)}
                >
                  <Icon name={showLoginPassword ? 'eye-off' : 'eye'} size={19} />
                </button>
              </div>
            </div>
          </>
        )}

        <button type="submit" className="auth-submit" disabled={busy}>
          {busy ? '处理中…' : mfaChallenge !== '' ? '验 证' : '登 录'}
        </button>

        {mfaChallenge !== '' && (
          <div className="auth-row">
            <button type="button" onClick={() => {
              setMfaChallenge('')
              setMfaCode('')
              setNotice('')
              setError('')
            }}>
              返回重新输入账号密码
            </button>
          </div>
        )}

        <div className="auth-row">
          <label><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />7 天内自动登录</label>
          <span style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <button type="button" onClick={() => {
              setForgotOpen(true)
              setResetStep(1)
              setResetSentPhone('')
              setResetForm({
                phone: /^1[3-9]\d{9}$/.test(account.trim()) ? account.trim() : phone,
                code: '',
                password: '',
                confirm: '',
              })
              setError('')
              setHint('')
              setNotice('')
            }}>
              忘记密码？
            </button>
            <button type="button" onClick={() => {
              setAppealOpen(true)
              setAppealForm({
                phone: /^1[3-9]\d{9}$/.test(account.trim()) ? account.trim() : phone,
                reason: '',
              })
              setAppealDone('')
              setError('')
              setHint('')
              setNotice('')
            }}>
              账号被冻结？提交申诉
            </button>
          </span>
        </div>

        {contextMissing && <div className="auth-notice">当前为独立登录：登录后会按账号开通阶段进入对应页面；如需返回原子系统，请从子系统入口登录。</div>}
        {error !== '' && <div className="auth-error">{error}</div>}
        {hint !== '' && <div className="auth-hint">{hint}</div>}
        {notice !== '' && <div className="auth-notice">{notice}</div>}

        {mfaChallenge === '' && <div className="third-line">其他登录方式</div>}
        <div className="third-icons">
          <button type="button" className="t-wechat" title="微信扫码" onClick={() => {
            setNotice('微信扫码登录尚未接入：需要微信开放平台 AppID / AppSecret 与可公网回调的域名，配置后即可启用。')
            setError('')
          }}><WechatIcon /></button>
          <button type="button" className="t-alipay" title="支付宝" onClick={() => {
            setNotice('支付宝扫码登录尚未接入：需要支付宝开放平台应用与回调地址，配置后即可启用。')
            setError('')
          }}><AlipayIcon /></button>
          <button type="button" className="t-gov" title="国家政务服务平台" onClick={() => {
            setNotice('国家政务服务平台统一登录尚未接入：需要完成平台对接与应用密钥配置。')
            setError('')
          }}><GovernmentServiceIcon /></button>
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
      <div className="form-title">注册与认证</div>
      <div className="form-sub">注册账号、创建主体、认证开通可分步完成，也可暂时保存后继续</div>

      <div className="steps">
        <button type="button" className={`step${regStep >= 1 ? ' on' : ''}`}
          onClick={() => goToStep(1)}>1 注册账号</button>
        <button type="button" className={`step${regStep >= 2 ? ' on' : ''}`}
          disabled={!accountCreated} onClick={() => goToStep(2)}>2 创建主体</button>
        <button type="button" className={`step${regStep >= 3 ? ' on' : ''}`}
          disabled={!onboardingMerchantId} onClick={() => goToStep(3)}>3 认证开通</button>
      </div>

      <form
        className="auth-form"
        onSubmit={(event) => {
          if (regStep === 1) {
            event.preventDefault()
            if (!accountCreated) void registerAccountStep()
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

            <div className="auth-notice">
              注册账号、创建主体、认证开通可分步完成。账号创建成功后即可暂时退出，稍后从认证中心继续。
            </div>
            {accountCreated ? (
              <div className="auth-step-actions">
                <button type="button" className="auth-submit" onClick={() => goToStep(2)}>创建经营主体</button>
                <button type="button" className="auth-back" onClick={finishOnboardingForNow}>稍后继续</button>
              </div>
            ) : (
              <button type="submit" className="auth-submit" style={{ marginTop: 18 }} disabled={busy}>
                {busy ? '创建中…' : '创建登录账号'}
              </button>
            )}
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
                <label className="auth-field">
                  法定代表人<span className="req">*</span>
                  <input className="auth-input" value={reg.legalPerson} placeholder="请输入法定代表人或经营者姓名"
                    onChange={(event) => patchReg({ legalPerson: event.target.value })} />
                </label>
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
            <label className="auth-field">
              联系电话
              <input className="auth-input" type="tel" value={reg.contactPhone} maxLength={11}
                placeholder={reg.phone || '默认使用登录手机号'}
                onChange={(event) => patchReg({ contactPhone: event.target.value.replace(/\D/g, '') })} />
            </label>

            <div className="auth-step-actions">
              {!accountCreated && <button type="button" className="auth-back" onClick={() => goToStep(1)}>上一步</button>}
              <button type="submit" className="auth-submit">保存并继续认证</button>
              <button type="button" className="auth-back" disabled={busy}
                onClick={() => void createSubjectStep(false)}>仅保存主体</button>
            </div>
          </>
        )}

        {regStep === 3 && (
          <>
            <div className="form-section">3. 认证开通<small>前置核验通过后提交平台审核</small></div>

            <section className={`verification-card ${reg.identity}`}>
              <div className="verification-card-head">
                <div>
                  <span className="verification-eyebrow">{reg.identity === 'enterprise' ? '企业实名（当前主体）' : '个人实名'}</span>
                  <b>{reg.identity === 'enterprise' ? (reg.companyName || '企业主体') : (reg.realName || reg.nickname || '个人主体')}</b>
                </div>
                <span className={`verification-status ${onboardingStage}`}>
                  {onboardingStage === 'done' ? '✓ 已认证'
                    : onboardingStage === 'pending' ? '审核中'
                      : onboardingStage === 'rejected' ? '需重新认证' : '待认证'}
                </span>
              </div>

              <div className="verification-timeline">
                {(reg.identity === 'enterprise'
                  ? [
                      ['信息填写', Boolean(onboardingMerchantId)],
                      ['执照 OCR', Boolean(enterpriseVerification.businessLicenseUrl)],
                      ['工商比对', Boolean(reg.creditCode && reg.legalPerson)],
                      ['法人验证', enterpriseVerification.legalPersonFaceStatus === 'verified'
                        && ['submitted', 'verified'].includes(enterpriseVerification.corporateTransferStatus)],
                    ]
                  : [
                      ['证件 OCR', Boolean(reg.realName && (reg.idCard || onboardingMerchantId))],
                      ['人脸活体', personalVerification.livenessVerified],
                      ['公安比对', personalVerification.policeVerified],
                      ['完成', onboardingStage === 'pending' || onboardingStage === 'done'],
                    ]).map(([label, done], index) => (
                      <div className={`verification-step ${done ? 'done' : ''}`} key={String(label)}>
                        <span>{done ? '✓' : index + 1}</span>
                        <small>{label}</small>
                      </div>
                    ))}
              </div>

              <div className="verification-facts">
                {reg.identity === 'enterprise' ? (
                  <>
                    <div><span>企业名称</span><b>{reg.companyName || '—'}</b></div>
                    <div><span>统一信用代码</span><b>{reg.creditCode || '—'}</b></div>
                    <div><span>法定代表人</span><b>{reg.legalPerson || '—'}</b></div>
                    <div><span>注册资本</span><b>{enterpriseVerification.registeredCapital || '—'}</b></div>
                    <div><span>认证方式</span><b>法人扫脸 + 对公打款</b></div>
                    <div><span>核验状态</span><b>{enterpriseVerification.legalPersonFaceStatus === 'verified' ? '法人扫脸已通过' : '待法人扫脸'}</b></div>
                  </>
                ) : (
                  <>
                    <div><span>姓名</span><b>{reg.realName || '—'}</b></div>
                    <div><span>证件类型</span><b>居民身份证</b></div>
                    <div><span>证件号码</span><b>{reg.idCard.length === 18
                      ? `${reg.idCard.slice(0, 3)}***********${reg.idCard.slice(-4)}`
                      : (identityIdMasked || '已安全保存')}</b></div>
                    <div><span>认证渠道</span><b>公安二要素 + 活体</b></div>
                    <div><span>活体检测</span><b>{personalVerification.livenessVerified ? '已通过' : '待检测'}</b></div>
                    <div><span>公安比对</span><b>{personalVerification.policeVerified ? '已通过' : '待核验'}</b></div>
                  </>
                )}
              </div>

              {onboardingStage === 'pending' ? (
                <div className="auth-notice">认证申请已提交，平台正在审核；审核通过后认证状态自动生效。</div>
              ) : onboardingStage === 'done' ? (
                <div className="auth-notice">
                  当前主体已完成认证。
                  <button type="button" className="link-button" onClick={finishOnboardingForNow}>进入平台 →</button>
                </div>
              ) : reg.identity === 'personal' ? (
                <>
                  {!reg.idCard && (
                    <label className="auth-field verification-inline-field">
                      身份证号<span className="req">*</span>
                      <input className="auth-input" value={reg.idCard} maxLength={18}
                        placeholder="请重新输入 18 位身份证号用于公安核验"
                        onChange={(event) => patchReg({ idCard: event.target.value.replace(/\s/g, '').toUpperCase() })} />
                    </label>
                  )}
                  <div className="verification-actions-grid">
                    <button type="button" className={`verification-action ${personalVerification.policeVerified ? 'done' : ''}`}
                      disabled={verificationSubmitting || onboardingStage === 'pending'}
                      onClick={() => void verifyPersonalEvidence('police')}>
                      <strong>{personalVerification.policeVerified ? '✓ 公安二要素已通过' : '公安二要素核验'}</strong>
                      <small>校验证件姓名与号码是否一致</small>
                    </button>
                    <button type="button" className={`verification-action ${personalVerification.livenessVerified ? 'done' : ''}`}
                      disabled={verificationSubmitting || onboardingStage === 'pending'}
                      onClick={() => void verifyPersonalEvidence('liveness')}>
                      <strong>{personalVerification.livenessVerified ? '✓ 人脸活体已通过' : '开始人脸活体检测'}</strong>
                      <small>完成活体动作后进行公安库比对</small>
                    </button>
                  </div>
                  <div className="verification-tip">
                    <b>AI 认证加速</b>
                    本地联调环境使用模拟核验通道；生产环境将接入合规公安二要素和活体服务。
                  </div>
                </>
              ) : (
                <>
                  <div className="verification-form-grid">
                    <label className="auth-field">
                      法定代表人<span className="req">*</span>
                      <input className="auth-input" value={reg.legalPerson}
                        onChange={(event) => patchReg({ legalPerson: event.target.value })} />
                    </label>
                    <label className="auth-field">
                      注册资本
                      <input className="auth-input" value={enterpriseVerification.registeredCapital}
                        placeholder="如：5000 万元"
                        onChange={(event) => setEnterpriseVerification((current) => ({
                          ...current, registeredCapital: event.target.value,
                        }))} />
                    </label>
                    <label className="auth-field">
                      对公账户户名<span className="req">*</span>
                      <input className="auth-input" value={enterpriseVerification.corporateBankName}
                        placeholder="与营业执照企业名称一致"
                        onChange={(event) => setEnterpriseVerification((current) => ({
                          ...current, corporateBankName: event.target.value,
                        }))} />
                    </label>
                    <label className="auth-field">
                      对公账户账号<span className="req">*</span>
                      <input className="auth-input" value={enterpriseVerification.corporateBankAccount}
                        placeholder="仅保存账户掩码"
                        onChange={(event) => setEnterpriseVerification((current) => ({
                          ...current, corporateBankAccount: event.target.value.replace(/[^\d\s]/g, ''),
                        }))} />
                    </label>
                    <label className="auth-field">
                      打款验证金额<span className="req">*</span>
                      <input className="auth-input" value={enterpriseVerification.corporateTransferAmount}
                        placeholder="如：0.37"
                        onChange={(event) => setEnterpriseVerification((current) => ({
                          ...current, corporateTransferAmount: event.target.value.replace(/[^\d.]/g, ''),
                        }))} />
                    </label>
                    <label className="auth-field">
                      打款流水号<span className="req">*</span>
                      <input className="auth-input" value={enterpriseVerification.corporateTransferReference}
                        placeholder="银行回单流水号"
                        onChange={(event) => setEnterpriseVerification((current) => ({
                          ...current, corporateTransferReference: event.target.value,
                        }))} />
                    </label>
                  </div>

                  <div className="verification-uploads">
                    {[
                      { kind: 'business_license' as const, label: '营业执照', hint: '完整清晰、在有效期内', url: enterpriseVerification.businessLicenseUrl },
                      { kind: 'legal_person_face' as const, label: '法人扫脸', hint: '调用摄像头采集法人面部', url: enterpriseVerification.legalPersonFaceUrl, capture: true },
                      { kind: 'corporate_transfer_proof' as const, label: '对公打款凭证', hint: '银行回单或转账凭证', url: enterpriseVerification.corporateTransferProofUrl },
                    ].map((item) => (
                      <label className={`verification-upload ${item.url ? 'done' : ''}`} key={item.kind}>
                        <span className="verification-upload-icon">{item.url ? '✓' : '+'}</span>
                        <strong>{item.url ? `${item.label}已上传` : `上传${item.label}`}</strong>
                        <small>{verificationUploading === item.kind ? '上传中…' : item.hint}</small>
                        <input type="file" accept="image/jpeg,image/png,image/webp"
                          {...(item.capture ? { capture: 'user' as const } : {})}
                          disabled={Boolean(verificationUploading) || verificationSubmitting}
                          onChange={(event) => {
                            const file = event.target.files?.[0]
                            if (file) void uploadEnterpriseEvidence(item.kind, file)
                            event.currentTarget.value = ''
                          }} />
                      </label>
                    ))}
                  </div>
                  <button type="button" className="verification-verify-button"
                    disabled={verificationSubmitting || verificationUploading !== ''}
                    onClick={() => void prepareEnterpriseEvidence()}>
                    {verificationSubmitting ? '校验中…'
                      : enterpriseVerification.legalPersonFaceStatus === 'verified'
                        ? '✓ 前置核验已通过，可提交审核' : '校验法人扫脸与对公打款材料'}
                  </button>
                  <div className="verification-tip">
                    <b>AI 认证加速</b>
                    执照 OCR、工商信息比对通过后自动通过法人扫脸；对公打款凭证由平台财务复核。
                  </div>
                </>
              )}
            </section>

            {onboardingStage !== 'pending' && onboardingStage !== 'done' && (
              <>
                <label className="agreement">
                  <input type="checkbox" checked={reg.agree} onChange={(event) => patchReg({ agree: event.target.checked })} />
                  <span>
                    我确认资料真实有效并同意
                    <a href="#protocol" onClick={(event) => {
                      event.preventDefault()
                      setNotice('《丰链云用户服务协议》全文尚未在本页发布，请联系平台运营获取正式文本。')
                    }}>《丰链云用户服务协议》</a>、
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
                  <button type="button" className="auth-back" onClick={() => goToStep(2)}>上一步</button>
                  <button type="submit" className="auth-submit"
                    disabled={busy || verificationSubmitting || !certificationReady}>
                    {busy ? '提交中…'
                      : !certificationReady ? '请先完成前置核验'
                        : '提交认证并开通'}
                  </button>
                  <button type="button" className="auth-back" onClick={finishOnboardingForNow}>稍后完成</button>
                </div>
                <div className="auth-notice">
                  主体资料已保存。认证开通可以稍后继续，认证通过前不会获得交易、签约和金融权限。
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
        <span className="tb-right">统一认证中心 · {isRegister ? '账号注册' : forgotOpen ? '找回密码' : '安全登录'}</span>
      </div>
      <div className="auth-wrap">
        <div className="auth-card">
          {isRegister ? <RegisterAside /> : forgotOpen ? <ResetAside /> : <LoginAside />}
          <main className="auth-main">
            <div className="mobile-brand"><span className="logo"><BrandMark size={30} /></span>丰链云</div>
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
              欢迎加入丰链云，您的{IDENTITY_LABEL[success.identity]}账号已创建
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
