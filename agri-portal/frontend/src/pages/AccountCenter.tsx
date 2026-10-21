import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Icon } from '../components/Icon'
import { RolesPermissions } from './account/RolesPermissions'
import { TeamMembers } from './account/TeamMembers'
import './account-center.css'

interface MerchantRow {
  bindingId: string
  merchantId: string
  merchantName: string | null
  merchantCode: string | null
  memberType: string | null
  industry: string | null
  companySize: string | null
  businessType: string | null
  creditCode: string | null
  creditCodeMasked: string | null
  contactName: string | null
  contactPhone: string | null
  address: string | null
  status: number | null
  verifyStatus: string | null
  verifyTime: string | null
  verifyRemark: string | null
  roleInMerchant: string
  certification: {
    id: string
    certNo: string
    companyName: string
    creditCode: string
    legalPerson: string | null
    licenseNo: string | null
    contactName: string
    contactPhone: string
    attachNote: string | null
    businessLicenseUrl: string | null
    legalPersonIdFrontUrl: string | null
    legalPersonIdBackUrl: string | null
    status: string
    submitTime: string
    reviewer: string | null
    reviewTime: string | null
    reviewRemark: string | null
  } | null
}

interface AddressRow {
  id: string
  receiverName: string
  contactPhone: string
  province: string
  city: string
  district: string | null
  detailAddress: string
  postalCode: string | null
  isDefault: number
}

interface JoinRow {
  id: string
  merchantId: string
  merchantName: string | null
  applicantName: string
  requestedRole: string
  message: string | null
  status: string
  createdAt: string
  reviewRemark: string | null
}

interface Summary {
  userId: string
  username: string
  nickname: string
  phone: string
  email: string | null
  status: number
  createdAt: string
  realName: {
    identityNo: string
    realName: string
    idNoMasked: string
    validStart: string | null
    validEnd: string | null
    contactPhone: string | null
    address: string | null
    status: string
    submitTime: string
    reviewRemark: string | null
  } | null
  activeMerchantId: string | null
  merchants: MerchantRow[]
  addresses: AddressRow[]
  sentJoinRequests: JoinRow[]
  reviewInbox: JoinRow[]
}

interface BusinessResult {
  merchantId: string
  name: string
  type: string
  memberType: string | null
  industry: string | null
  verifyStatus: string | null
  creditCodeMasked: string | null
  alreadyJoined: boolean
}

type Tab = 'profile' | 'security' | 'addresses' | 'business' | 'team' | 'roles'

const TABS: { key: Tab; label: string; icon: string; description: string }[] = [
  { key: 'profile', label: '账号资料', icon: 'user', description: '维护昵称、邮箱与账号概况' },
  { key: 'security', label: '账号安全', icon: 'shield', description: '修改密码与绑定手机号' },
  { key: 'addresses', label: '地址管理', icon: 'location', description: '维护收货地址与默认地址' },
  { key: 'business', label: '主体资料与认证', icon: 'factory', description: '创建、认证并切换经营主体' },
  { key: 'team', label: '团队与成员', icon: 'users', description: '管理当前主体的团队成员' },
  { key: 'roles', label: '角色与权限', icon: 'shield', description: '配置当前主体的角色与权限' },
]

const ACCOUNT_TAB_KEYS: Tab[] = ['profile', 'security', 'addresses', 'business', 'team', 'roles']

function normalizeAccountTab(value: string | null | undefined): Tab {
  return ACCOUNT_TAB_KEYS.includes(value as Tab) ? value as Tab : 'profile'
}

const INDUSTRIES = ['粮油产业', '果蔬产业', '畜禽产业', '茶药产业', '饲料农资', '水产产业', '流通贸易', '加工制造', '其他']
const COMPANY_SIZES = ['微型（20人以下）', '小型（20-100人）', '中型（100-500人）', '大型（500人以上）']
const BUSINESS_TYPES = ['家庭农场', '农民专业合作社', '个体采购户', '经纪人', '其他']

const emptyAddress = {
  receiverName: '',
  contactPhone: '',
  province: '',
  city: '',
  district: '',
  detailAddress: '',
  postalCode: '',
  isDefault: false,
}

async function api<T>(path: string, init?: RequestInit): Promise<{ code: number; message?: string; data?: T }> {
  const response = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  return await response.json() as { code: number; message?: string; data?: T }
}

function statusText(value: string | null | undefined): string {
  return ({
    approved: '已认证',
    verified: '已认证',
    pending: '审核中',
    rejected: '已驳回',
    unverified: '未认证',
    draft: '草稿',
  } as Record<string, string>)[value ?? ''] ?? '未开通'
}

function tone(value: string | null | undefined): string {
  if (value === 'approved' || value === 'verified') return 'green'
  if (value === 'pending') return 'amber'
  if (value === 'rejected') return 'red'
  return 'ghost'
}

export function AccountCenter({ initialTab }: { initialTab?: string | null }): JSX.Element {
  const [tab, setTab] = useState<Tab>(() => normalizeAccountTab(initialTab))
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [profile, setProfile] = useState({ nickname: '', email: '' })
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [phoneForm, setPhoneForm] = useState({ phone: '', code: '' })
  const [realNameOpen, setRealNameOpen] = useState(false)
  const [realNameForm, setRealNameForm] = useState({
    realName: '', idCard: '', contactPhone: '', address: '',
    validStart: '', validEnd: '', businessType: '', email: '',
  })
  const [codeLeft, setCodeLeft] = useState(0)
  const [addresses, setAddresses] = useState<AddressRow[]>([])
  const [addressEditing, setAddressEditing] = useState<string | null>(null)
  const [addressForm, setAddressForm] = useState({ ...emptyAddress })
  const [businessKeyword, setBusinessKeyword] = useState('')
  const [businessResults, setBusinessResults] = useState<BusinessResult[]>([])
  const [joinRole, setJoinRole] = useState('buyer')
  const [joinMessage, setJoinMessage] = useState('')
  const [createBusinessOpen, setCreateBusinessOpen] = useState(false)
  const [certificationTarget, setCertificationTarget] = useState<MerchantRow | null>(null)
  const [certificationForm, setCertificationForm] = useState({
    companyName: '', creditCode: '', legalPerson: '', licenseNo: '',
    contactName: '', contactPhone: '', attachNote: '',
    businessLicenseUrl: '', legalPersonIdFrontUrl: '', legalPersonIdBackUrl: '',
  })
  const [certificationUploading, setCertificationUploading] = useState<string | null>(null)
  const [createIdentity, setCreateIdentity] = useState<'enterprise' | 'personal'>('enterprise')
  const [createBusinessForm, setCreateBusinessForm] = useState({
    companyName: '', creditCode: '', industry: INDUSTRIES[0], companySize: COMPANY_SIZES[0],
    realName: '', idCard: '', businessType: BUSINESS_TYPES[0], address: '', contactName: '',
  })
  const [busy, setBusy] = useState(false)
  const [switchingMerchantId, setSwitchingMerchantId] = useState<string | null>(null)

  const load = async (): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const result = await api<Summary>('/api/v1/sso/account/summary')
      if (result.code !== 0 || !result.data) {
        setError(result.message ?? '请先登录后访问个人中心')
        setSummary(null)
        return
      }
      const data = result.data
      setSummary(data)
      setProfile({ nickname: data.nickname ?? '', email: data.email ?? '' })
      setAddresses(data.addresses ?? [])
      setRealNameForm((current) => ({
        ...current,
        realName: data.realName?.realName ?? current.realName,
        contactPhone: data.realName?.contactPhone ?? data.phone ?? current.contactPhone,
        address: data.realName?.address ?? current.address,
        validStart: data.realName?.validStart ?? current.validStart,
        validEnd: data.realName?.validEnd ?? current.validEnd,
      }))
    } catch {
      setError('无法连接账号服务')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    setTab(normalizeAccountTab(initialTab))
  }, [initialTab])

  useEffect(() => {
    const canonical = `#/account/${tab}`
    if (window.location.hash !== canonical) {
      window.history.replaceState(null, '', canonical)
    }
  }, [])

  useEffect(() => {
    if (codeLeft <= 0) return undefined
    const timer = window.setTimeout(() => setCodeLeft(codeLeft - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [codeLeft])

  const flash = (message: string): void => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3500)
  }

  const openTab = (next: Tab): void => {
    setTab(next)
    const target = `#/account/${next}`
    if (window.location.hash !== target) {
      window.location.hash = target
    }
  }

  const saveProfile = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    setBusy(true)
    try {
      const result = await api('/api/v1/sso/account/profile', {
        method: 'PUT',
        body: JSON.stringify(profile),
      })
      if (result.code !== 0) return setError(result.message ?? '资料保存失败')
      flash('账号资料已保存')
      await load()
    } finally {
      setBusy(false)
    }
  }

  const changePassword = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (passwords.newPassword !== passwords.confirmPassword) {
      return setError('两次输入的新密码不一致')
    }
    setBusy(true)
    try {
      const result = await api('/api/v1/sso/account/password', {
        method: 'POST',
        body: JSON.stringify(passwords),
      })
      if (result.code !== 0) return setError(result.message ?? '密码修改失败')
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' })
      flash('密码修改成功')
    } finally {
      setBusy(false)
    }
  }

  const sendPhoneCode = async (): Promise<void> => {
    if (!/^1[3-9]\d{9}$/.test(phoneForm.phone)) return setError('请输入正确的手机号')
    const result = await api<{ hint?: string }>('/api/v1/sso/sms/code', {
      method: 'POST',
      body: JSON.stringify({ phone: phoneForm.phone, scene: 'change_phone' }),
    })
    if (result.code !== 0) return setError(result.message ?? '验证码发送失败')
    setCodeLeft(60)
    flash(result.data?.hint ?? '验证码已发送')
  }

  const changePhone = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    setBusy(true)
    try {
      const result = await api('/api/v1/sso/account/phone', {
        method: 'POST',
        body: JSON.stringify(phoneForm),
      })
      if (result.code !== 0) return setError(result.message ?? '手机号变更失败')
      setPhoneForm({ phone: '', code: '' })
      flash('手机号已变更')
      await load()
    } finally {
      setBusy(false)
    }
  }

  const submitRealName = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    setBusy(true)
    try {
      const result = await api('/api/v1/sso/account/real-name', {
        method: 'POST',
        body: JSON.stringify(realNameForm),
      })
      if (result.code !== 0) return setError(result.message ?? '实名认证提交失败')
      setRealNameOpen(false)
      flash('个人实名认证已提交审核')
      await load()
    } finally {
      setBusy(false)
    }
  }

  const editAddress = (row?: AddressRow): void => {
    if (!row) {
      setAddressEditing('new')
      setAddressForm({ ...emptyAddress, receiverName: summary?.nickname ?? '', contactPhone: summary?.phone ?? '' })
      return
    }
    setAddressEditing(row.id)
    setAddressForm({
      receiverName: row.receiverName,
      contactPhone: row.contactPhone,
      province: row.province,
      city: row.city,
      district: row.district ?? '',
      detailAddress: row.detailAddress,
      postalCode: row.postalCode ?? '',
      isDefault: row.isDefault === 1,
    })
  }

  const saveAddress = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    setBusy(true)
    try {
      const isNew = addressEditing === 'new'
      const path = isNew ? '/api/v1/sso/account/addresses' : `/api/v1/sso/account/addresses/${addressEditing}`
      const result = await api(path, {
        method: isNew ? 'POST' : 'PUT',
        body: JSON.stringify({ ...addressForm, isDefault: Boolean(addressForm.isDefault) }),
      })
      if (result.code !== 0) return setError(result.message ?? '地址保存失败')
      setAddressEditing(null)
      flash(isNew ? '地址已添加' : '地址已更新')
      await load()
    } finally {
      setBusy(false)
    }
  }

  const setDefault = async (id: string): Promise<void> => {
    const result = await api(`/api/v1/sso/account/addresses/${id}/default`, { method: 'POST' })
    if (result.code !== 0) return setError(result.message ?? '设置失败')
    flash('已设为默认地址')
    await load()
  }

  const deleteAddress = async (id: string): Promise<void> => {
    if (!window.confirm('确认删除该地址？')) return
    const result = await api(`/api/v1/sso/account/addresses/${id}`, { method: 'DELETE' })
    if (result.code !== 0) return setError(result.message ?? '删除失败')
    flash('地址已删除')
    await load()
  }

  const searchBusiness = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (businessKeyword.trim().length < 2) return setError('请输入至少 2 个字符')
    const result = await api<BusinessResult[]>(
      `/api/v1/sso/account/businesses/search?keyword=${encodeURIComponent(businessKeyword.trim())}`,
    )
    if (result.code !== 0) return setError(result.message ?? '搜索失败')
    setBusinessResults(result.data ?? [])
  }

  const requestJoin = async (business: BusinessResult): Promise<void> => {
    const result = await api('/api/v1/sso/account/businesses/join-requests', {
      method: 'POST',
      body: JSON.stringify({
        merchantId: business.merchantId,
        roleInMerchant: joinRole,
        message: joinMessage,
      }),
    })
    if (result.code !== 0) return setError(result.message ?? '申请提交失败')
    flash(`已提交加入「${business.name}」的申请`)
    setBusinessResults((rows) => rows.map((row) => row.merchantId === business.merchantId
      ? { ...row, alreadyJoined: true } : row))
    await load()
  }

  const openCreateBusiness = (identity: 'enterprise' | 'personal'): void => {
    setCreateIdentity(identity)
    setCreateBusinessForm((current) => ({
      ...current,
      contactName: current.contactName || summary?.nickname || '',
    }))
    setCreateBusinessOpen(true)
  }

  const createBusiness = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (createIdentity === 'enterprise') {
      if (!createBusinessForm.companyName.trim()) return setError('请填写企业名称')
      if (!/^[0-9A-Za-z]{15,18}$/.test(createBusinessForm.creditCode.trim())) {
        return setError('请填写 15-18 位统一社会信用代码')
      }
    } else {
      if (!createBusinessForm.realName.trim()) return setError('请填写真实姓名')
      if (!/^\d{17}[\dXx]$/.test(createBusinessForm.idCard.trim())) {
        return setError('身份证号应为 18 位（末位可为 X）')
      }
    }
    if (!createBusinessForm.contactName.trim()) return setError('请填写联系人姓名')
    setBusy(true)
    try {
      const result = await api('/api/v1/sso/account/businesses', {
        method: 'POST',
        body: JSON.stringify({ ...createBusinessForm, identity: createIdentity }),
      })
      if (result.code !== 0) return setError(result.message ?? '主体创建失败')
      setCreateBusinessOpen(false)
      flash(createIdentity === 'enterprise' ? '企业主体已创建' : '个人主体已创建')
      await load()
    } finally {
      setBusy(false)
    }
  }

  const activateMerchant = async (merchant: MerchantRow): Promise<void> => {
    if (merchant.merchantId === summary?.activeMerchantId) return
    setSwitchingMerchantId(merchant.merchantId)
    setError('')
    try {
      const result = await api<{ activeMerchantId: string; merchantName: string }>(
        `/api/v1/sso/account/businesses/${merchant.merchantId}/activate`,
        { method: 'POST' },
      )
      if (result.code !== 0) return setError(result.message ?? '主体切换失败')
      flash(`已切换为「${result.data?.merchantName || merchant.merchantName || '当前主体'}」`)
      await load()
    } finally {
      setSwitchingMerchantId(null)
    }
  }

  const startCertification = (merchant: MerchantRow): void => {
    if (merchant.memberType === 'personal') {
      setRealNameOpen(true)
      setTab('business')
      window.setTimeout(() => window.scrollTo({ top: 260, behavior: 'smooth' }), 50)
      return
    }
    const cert = merchant.certification
    setCertificationTarget(merchant)
    setCertificationForm({
      companyName: cert?.companyName || merchant.merchantName || '',
      creditCode: cert?.creditCode || merchant.creditCode || '',
      legalPerson: cert?.legalPerson || '',
      licenseNo: cert?.licenseNo || '',
      contactName: cert?.contactName || merchant.contactName || '',
      contactPhone: cert?.contactPhone || merchant.contactPhone || '',
      attachNote: cert?.attachNote || '',
      businessLicenseUrl: cert?.businessLicenseUrl || '',
      legalPersonIdFrontUrl: cert?.legalPersonIdFrontUrl || '',
      legalPersonIdBackUrl: cert?.legalPersonIdBackUrl || '',
    })
  }

  const uploadCertificationDocument = async (kind: string, file: File): Promise<void> => {
    if (!certificationTarget) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('仅支持 JPG、PNG、WEBP 图片')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('单张图片不能超过 5MB')
      return
    }
    setCertificationUploading(kind)
    setError('')
    try {
      const body = new FormData()
      body.append('file', file)
      const response = await fetch(
        `/api/v1/sso/account/businesses/${certificationTarget.merchantId}/certification-files?kind=${encodeURIComponent(kind)}`,
        { method: 'POST', credentials: 'include', body },
      )
      const result = await response.json() as {
        code: number
        message?: string
        data?: { url: string }
      }
      if (!response.ok || result.code !== 0 || !result.data?.url) {
        setError(result.message ?? '图片上传失败，请重试')
        return
      }
      const field = {
        business_license: 'businessLicenseUrl',
        legal_person_id_front: 'legalPersonIdFrontUrl',
        legal_person_id_back: 'legalPersonIdBackUrl',
      }[kind] as 'businessLicenseUrl' | 'legalPersonIdFrontUrl' | 'legalPersonIdBackUrl' | undefined
      if (field) setCertificationForm((current) => ({ ...current, [field]: result.data!.url }))
    } catch {
      setError('图片上传失败，请检查网络后重试')
    } finally {
      setCertificationUploading(null)
    }
  }

  const submitEnterpriseCertification = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (!certificationTarget) return
    if (!certificationForm.companyName.trim()) return setError('请填写企业名称')
    if (!/^[0-9A-Za-z]{15,18}$/.test(certificationForm.creditCode.trim())) {
      return setError('统一社会信用代码应为 15-18 位字母数字')
    }
    if (!certificationForm.legalPerson.trim()) return setError('请填写法定代表人')
    if (!certificationForm.contactName.trim()) return setError('请填写联系人姓名')
    if (!/^1[3-9]\d{9}$/.test(certificationForm.contactPhone.trim())) {
      return setError('请填写正确的 11 位联系电话')
    }
    if (!certificationForm.businessLicenseUrl) return setError('请上传营业执照照片')
    if (!certificationForm.legalPersonIdFrontUrl) return setError('请上传法人身份证人像面照片')
    if (!certificationForm.legalPersonIdBackUrl) return setError('请上传法人身份证国徽面照片')
    setBusy(true)
    try {
      const result = await api(`/api/v1/sso/account/businesses/${certificationTarget.merchantId}/submit-certification`, {
        method: 'POST',
        body: JSON.stringify(certificationForm),
      })
      if (result.code !== 0) return setError(result.message ?? '认证提交失败')
      setCertificationTarget(null)
      flash('企业认证已提交平台审核')
      await load()
    } finally {
      setBusy(false)
    }
  }

  const reviewJoin = async (id: string, approved: boolean): Promise<void> => {
    const result = await api(`/api/v1/sso/account/businesses/join-requests/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ approved, remark: approved ? '负责人已同意' : '负责人已拒绝' }),
    })
    if (result.code !== 0) return setError(result.message ?? '审批失败')
    flash(approved ? '已同意加入申请' : '已拒绝加入申请')
    await load()
  }

  const cancelJoin = async (id: string): Promise<void> => {
    const result = await api(`/api/v1/sso/account/businesses/join-requests/${id}`, { method: 'DELETE' })
    if (result.code !== 0) return setError(result.message ?? '撤回申请失败')
    flash('加入申请已撤回')
    await load()
  }

  if (loading) {
    return <section className="section account-page"><div className="card empty">正在加载个人中心…</div></section>
  }
  if (!summary) {
    return (
      <section className="section account-page">
        <div className="card account-login-required">
          <Icon name="user" size={36} />
          <h2>请先登录</h2>
          <p>{error || '登录后可维护账号资料、安全设置、地址和经营主体。'}</p>
          <a className="btn btn-primary" href="http://localhost:8090/login">前往登录</a>
        </div>
      </section>
    )
  }

  const activeMerchant = summary.merchants.find((merchant) =>
    merchant.merchantId === summary.activeMerchantId) ?? null
  const activeTabMeta = TABS.find((item) => item.key === tab) ?? TABS[0]

  return (
    <section className="section account-page">
      <div className="account-hero">
        <div className="account-avatar">{(summary.nickname || summary.username || summary.phone).slice(0, 1)}</div>
        <div>
          <span className="tag tag-tech">个人中心</span>
          <h1>{summary.nickname || summary.username}</h1>
          <p>{summary.username} · {summary.phone || '未绑定手机'} · 注册于 {String(summary.createdAt).slice(0, 10)}</p>
        </div>
        <div className="account-hero-status">
          <span className={`account-status ${tone(summary.realName?.status)}`}>{statusText(summary.realName?.status)}</span>
          <small>
            {activeMerchant ? `当前主体：${activeMerchant.merchantName}` : '当前无登录主体'}
            {' · '}共 {summary.merchants.length} 个
          </small>
        </div>
      </div>

      <div className="account-shell">
        <aside className="account-sidebar">
          <div className="account-sidebar-head">
            <span>个人中心</span>
            <strong>账号与主体管理</strong>
          </div>
          <nav className="account-menu" aria-label="个人中心菜单">
            {TABS.map((item) => (
              <button type="button" key={item.key} className={tab === item.key ? 'on' : ''} onClick={() => openTab(item.key)}>
                <span className="account-menu-icon"><Icon name={item.icon} size={16} /></span>
                <span>{item.label}</span>
                <i>›</i>
              </button>
            ))}
          </nav>
          <div className="account-sidebar-subject">
            <span>当前登录主体</span>
            <strong>{activeMerchant?.merchantName || '暂未选择'}</strong>
            <small>{activeMerchant ? `${activeMerchant.memberType === 'personal' ? '个人主体' : '企业主体'} · ${activeMerchant.roleInMerchant}` : '请先创建经营主体'}</small>
          </div>
        </aside>

        <main className="account-content">
          <div className="account-content-head">
            <div>
              <span>个人中心 / {activeTabMeta.label}</span>
              <h2>{activeTabMeta.label}</h2>
            </div>
            <p>{activeTabMeta.description}</p>
          </div>
          {notice && <div className="account-notice">{notice}</div>}
          {error && <div className="account-error">{error}</div>}

      {tab === 'profile' && (
        <div className="account-grid">
          <form className="card account-card" onSubmit={(event) => void saveProfile(event)}>
            <div className="account-card-head"><h2>账号资料</h2><span>登录账号不可修改</span></div>
            <label>登录账号<input className="input" value={summary.username} disabled /></label>
            <label>手机号<input className="input" value={summary.phone || ''} disabled /></label>
            <label>昵称<input className="input" value={profile.nickname} maxLength={64} onChange={(event) => setProfile({ ...profile, nickname: event.target.value })} /></label>
            <label>邮箱<input className="input" type="email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} /></label>
            <button className="btn btn-primary" disabled={busy}>{busy ? '保存中…' : '保存资料'}</button>
          </form>
          <div className="card account-card">
            <div className="account-card-head"><h2>账号概况</h2></div>
            <div className="account-info-list">
              <div><span>账号状态</span><strong>{summary.status === 1 ? '正常' : '停用'}</strong></div>
              <div><span>个人实名</span><strong>{statusText(summary.realName?.status)}</strong></div>
              <div><span>经营主体</span><strong>{summary.merchants.length} 个</strong></div>
              <div><span>当前登录主体</span><strong>{activeMerchant?.merchantName || '未选择'}</strong></div>
              <div><span>收货地址</span><strong>{addresses.length} 个</strong></div>
            </div>
          </div>
        </div>
      )}

      {tab === 'security' && (
        <div className="account-grid">
          <form className="card account-card" onSubmit={(event) => void changePassword(event)}>
            <div className="account-card-head"><h2>修改密码</h2><span>8-20 位，包含字母和数字</span></div>
            <label>当前密码<input className="input" type="password" value={passwords.currentPassword} onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })} /></label>
            <label>新密码<input className="input" type="password" value={passwords.newPassword} onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })} /></label>
            <label>确认新密码<input className="input" type="password" value={passwords.confirmPassword} onChange={(event) => setPasswords({ ...passwords, confirmPassword: event.target.value })} /></label>
            <button className="btn btn-primary" disabled={busy}>{busy ? '提交中…' : '修改密码'}</button>
          </form>
          <form className="card account-card" onSubmit={(event) => void changePhone(event)}>
            <div className="account-card-head"><h2>变更手机号</h2><span>当前：{summary.phone || '未绑定'}</span></div>
            <label>新手机号<input className="input" value={phoneForm.phone} maxLength={11} onChange={(event) => setPhoneForm({ ...phoneForm, phone: event.target.value.replace(/\D/g, '') })} /></label>
            <label>短信验证码
              <div className="account-code-row">
                <input className="input" value={phoneForm.code} maxLength={6} onChange={(event) => setPhoneForm({ ...phoneForm, code: event.target.value.replace(/\D/g, '') })} />
                <button type="button" className="btn btn-outline" disabled={codeLeft > 0} onClick={() => void sendPhoneCode()}>
                  {codeLeft > 0 ? `${codeLeft}s` : '获取验证码'}
                </button>
              </div>
            </label>
            <button className="btn btn-primary" disabled={busy}>{busy ? '提交中…' : '确认变更'}</button>
          </form>
        </div>
      )}

      {tab === 'addresses' && (
        <div className="card account-card account-address-card">
          <div className="account-card-head">
            <h2>收货地址</h2>
            <button className="btn btn-primary" onClick={() => editAddress()}>新增地址</button>
          </div>
          <div className="account-address-list">
            {addresses.length === 0 && <div className="empty">暂无收货地址</div>}
            {addresses.map((row) => (
              <div className={`account-address ${row.isDefault === 1 ? 'default' : ''}`} key={row.id}>
                <div>
                  <strong>{row.receiverName}</strong><span>{row.contactPhone}</span>
                  {row.isDefault === 1 && <span className="tag tag-tech">默认</span>}
                  <p>{[row.province, row.city, row.district, row.detailAddress].filter(Boolean).join(' ')}</p>
                </div>
                <div className="account-address-actions">
                  {row.isDefault !== 1 && <button type="button" onClick={() => void setDefault(row.id)}>设为默认</button>}
                  <button type="button" onClick={() => editAddress(row)}>编辑</button>
                  <button type="button" className="danger" onClick={() => void deleteAddress(row.id)}>删除</button>
                </div>
              </div>
            ))}
          </div>
          {addressEditing && (
            <form className="account-address-form" onSubmit={(event) => void saveAddress(event)}>
              <h3>{addressEditing === 'new' ? '新增地址' : '编辑地址'}</h3>
              <div className="account-form-grid">
                <label>收货人<input className="input" value={addressForm.receiverName} onChange={(event) => setAddressForm({ ...addressForm, receiverName: event.target.value })} /></label>
                <label>联系电话<input className="input" value={addressForm.contactPhone} onChange={(event) => setAddressForm({ ...addressForm, contactPhone: event.target.value })} /></label>
                <label>省份<input className="input" value={addressForm.province} onChange={(event) => setAddressForm({ ...addressForm, province: event.target.value })} /></label>
                <label>城市<input className="input" value={addressForm.city} onChange={(event) => setAddressForm({ ...addressForm, city: event.target.value })} /></label>
                <label>区县<input className="input" value={addressForm.district} onChange={(event) => setAddressForm({ ...addressForm, district: event.target.value })} /></label>
                <label>邮编<input className="input" value={addressForm.postalCode} onChange={(event) => setAddressForm({ ...addressForm, postalCode: event.target.value })} /></label>
              </div>
              <label>详细地址<input className="input" value={addressForm.detailAddress} onChange={(event) => setAddressForm({ ...addressForm, detailAddress: event.target.value })} /></label>
              <label className="account-check"><input type="checkbox" checked={addressForm.isDefault} onChange={(event) => setAddressForm({ ...addressForm, isDefault: event.target.checked })} />设为默认地址</label>
              <div className="account-form-actions">
                <button type="submit" className="btn btn-primary" disabled={busy}>保存地址</button>
                <button type="button" className="btn btn-ghost" onClick={() => setAddressEditing(null)}>取消</button>
              </div>
            </form>
          )}
        </div>
      )}

      {tab === 'business' && (
        <div className="account-business-layout">
          <div className="card account-card">
            <div className="account-card-head"><h2>实名认证</h2><span className={`account-status ${tone(summary.realName?.status)}`}>{statusText(summary.realName?.status)}</span></div>
            {summary.realName ? (
              <div className="account-info-list">
                <div><span>姓名</span><strong>{summary.realName.realName}</strong></div>
                <div><span>证件号码</span><strong>{summary.realName.idNoMasked}</strong></div>
                <div><span>有效期</span><strong>{summary.realName.validStart || '—'} 至 {summary.realName.validEnd || '—'}</strong></div>
                <div><span>联系电话</span><strong>{summary.realName.contactPhone || '—'}</strong></div>
                {summary.realName.reviewRemark && <div><span>审核意见</span><strong>{summary.realName.reviewRemark}</strong></div>}
              </div>
            ) : <p className="muted">尚未提交个人实名认证。</p>}
            {summary.realName?.status !== 'verified' && (
              <button className="btn btn-primary" onClick={() => setRealNameOpen(!realNameOpen)}>
                {summary.realName ? '重新提交实名认证' : '办理个人实名认证'}
              </button>
            )}
            {realNameOpen && summary.realName?.status !== 'verified' && (
              <form className="account-realname-form" onSubmit={(event) => void submitRealName(event)}>
                <div className="account-form-grid">
                  <label>真实姓名<input className="input" value={realNameForm.realName} onChange={(event) => setRealNameForm({ ...realNameForm, realName: event.target.value })} /></label>
                  <label>身份证号<input className="input" value={realNameForm.idCard} onChange={(event) => setRealNameForm({ ...realNameForm, idCard: event.target.value.toUpperCase() })} /></label>
                  <label>联系电话<input className="input" value={realNameForm.contactPhone} onChange={(event) => setRealNameForm({ ...realNameForm, contactPhone: event.target.value })} /></label>
                  <label>经营类型<input className="input" value={realNameForm.businessType} placeholder="家庭农场 / 个体采购户等" onChange={(event) => setRealNameForm({ ...realNameForm, businessType: event.target.value })} /></label>
                  <label>证件有效期起<input className="input" type="date" value={realNameForm.validStart} onChange={(event) => setRealNameForm({ ...realNameForm, validStart: event.target.value })} /></label>
                  <label>证件有效期止<input className="input" type="date" value={realNameForm.validEnd} onChange={(event) => setRealNameForm({ ...realNameForm, validEnd: event.target.value })} /></label>
                </div>
                <label>常住地址<input className="input" value={realNameForm.address} onChange={(event) => setRealNameForm({ ...realNameForm, address: event.target.value })} /></label>
                <label>联系邮箱<input className="input" type="email" value={realNameForm.email} onChange={(event) => setRealNameForm({ ...realNameForm, email: event.target.value })} /></label>
                <div className="account-form-actions">
                  <button className="btn btn-primary" disabled={busy}>{busy ? '提交中…' : '提交实名审核'}</button>
                  <button type="button" className="btn btn-ghost" onClick={() => setRealNameOpen(false)}>取消</button>
                </div>
              </form>
            )}
          </div>

          <div className="card account-card">
            <div className="account-card-head">
              <h2>我的经营主体</h2>
              <div className="account-form-actions">
                <span>{summary.merchants.length} 个</span>
                <button className="btn btn-outline btn-sm" onClick={() => openCreateBusiness('enterprise')}>创建企业主体</button>
                <button className="btn btn-outline btn-sm" onClick={() => openCreateBusiness('personal')}>创建个人主体</button>
              </div>
            </div>
            {summary.merchants.length === 0 ? (
              <div className="account-business-empty">
                <p>当前账号还没有经营主体，可注册个人或企业主体，也可以申请加入已有主体。</p>
                <div><button className="btn btn-primary" onClick={() => openCreateBusiness('personal')}>创建个人主体</button><button className="btn btn-outline" onClick={() => openCreateBusiness('enterprise')}>创建企业主体</button></div>
              </div>
            ) : (
              <div className="merchant-list">
                <p className="merchant-active-note">
                  同一时间仅有一个主体处于登录状态；切换后交易、生产管理等业务数据范围同步切换。
                </p>
                {summary.merchants.map((merchant) => (
                  <div
                    className={`merchant-row ${merchant.merchantId === summary.activeMerchantId ? 'active' : ''}`}
                    key={merchant.bindingId}
                  >
                    <div className="merchant-main">
                      <div className="merchant-title">
                        <strong>{merchant.merchantName}</strong>
                        <span>{merchant.memberType === 'personal' ? '个人主体' : '企业主体'} · {merchant.roleInMerchant}</span>
                        {merchant.merchantId === summary.activeMerchantId && (
                          <span className="merchant-active-badge">当前登录主体</span>
                        )}
                      </div>
                      <div className="merchant-detail-grid">
                        <div><span>主体编码</span><b>{merchant.merchantCode || '—'}</b></div>
                        <div><span>经营主体 ID</span><b>{merchant.merchantId}</b></div>
                        <div><span>{merchant.memberType === 'personal' ? '经营类型' : '所属行业'}</span><b>{merchant.memberType === 'personal' ? (merchant.businessType || '—') : (merchant.industry || '—')}</b></div>
                        <div><span>{merchant.memberType === 'personal' ? '身份证号' : '统一社会信用代码'}</span><b>{merchant.creditCodeMasked || '—'}</b></div>
                        <div><span>联系人</span><b>{merchant.contactName || '—'}</b></div>
                        <div><span>联系电话</span><b>{merchant.contactPhone || '—'}</b></div>
                        {merchant.memberType !== 'personal' && <div><span>企业规模</span><b>{merchant.companySize || '—'}</b></div>}
                        <div><span>主体状态</span><b>{merchant.status === 0 ? '停用' : '正常'}</b></div>
                      </div>
                      {merchant.address && <p className="merchant-address">注册地址：{merchant.address}</p>}
                      {merchant.verifyRemark && <p className="merchant-review">审核意见：{merchant.verifyRemark}</p>}
                      {merchant.certification && (
                        <div className="certification-track">
                          <span>认证单号</span><b>{merchant.certification.certNo}</b>
                          <span>提交时间</span><b>{String(merchant.certification.submitTime).replace('T', ' ').slice(0, 16)}</b>
                          {merchant.certification.legalPerson && <><span>法定代表人</span><b>{merchant.certification.legalPerson}</b></>}
                          {merchant.certification.reviewTime && <><span>审核时间</span><b>{String(merchant.certification.reviewTime).replace('T', ' ').slice(0, 16)}</b></>}
                        </div>
                      )}
                    </div>
                    <div className="merchant-row-actions">
                      <span className={`account-status ${tone(merchant.verifyStatus)}`}>{statusText(merchant.verifyStatus)}</span>
                      {merchant.merchantId !== summary.activeMerchantId && (
                        <button
                          className="btn btn-outline btn-sm"
                          disabled={busy || Boolean(switchingMerchantId) || merchant.status === 0}
                          onClick={() => void activateMerchant(merchant)}
                        >
                          {switchingMerchantId === merchant.merchantId ? '切换中…' : '切换为此主体'}
                        </button>
                      )}
                      {merchant.verifyStatus !== 'approved' && merchant.verifyStatus !== 'pending' && (
                        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => void startCertification(merchant)}>
                          {merchant.memberType === 'personal' ? '去实名认证' : merchant.verifyStatus === 'rejected' ? '重新认证' : '去认证'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card account-card account-join-card">
            <div className="account-card-head"><h2>申请加入经营主体</h2><span>需要主体负责人审批</span></div>
            <form className="account-business-search" onSubmit={(event) => void searchBusiness(event)}>
              <input className="input" value={businessKeyword} placeholder="输入企业名称、编码或信用代码" onChange={(event) => setBusinessKeyword(event.target.value)} />
              <button className="btn btn-primary">搜索</button>
            </form>
            <div className="account-form-grid">
              <label>申请角色<select className="select" value={joinRole} onChange={(event) => setJoinRole(event.target.value)}><option value="buyer">采购</option><option value="seller">销售</option><option value="finance">财务</option></select></label>
              <label>申请说明<input className="input" value={joinMessage} onChange={(event) => setJoinMessage(event.target.value)} placeholder="职位、负责业务等" /></label>
            </div>
            <div className="business-results">
              {businessResults.map((business) => (
                <div className="business-result" key={business.merchantId}>
                  <div><strong>{business.name}</strong><span>{business.memberType === 'personal' ? '个人主体' : '企业主体'} · {business.industry || '行业未填写'} · {business.creditCodeMasked || '证件未公开'}</span></div>
                  <button className="btn btn-outline" disabled={business.alreadyJoined || busy} onClick={() => void requestJoin(business)}>
                    {business.alreadyJoined ? '已加入/已申请' : '申请加入'}
                  </button>
                </div>
              ))}
              {!businessResults.length && <p className="muted">搜索后显示可申请加入的主体。</p>}
            </div>
          </div>

          <div className="card account-card">
            <div className="account-card-head"><h2>我发出的加入申请</h2><span>{summary.sentJoinRequests.length} 条</span></div>
            <JoinList rows={summary.sentJoinRequests} onCancel={(id) => void cancelJoin(id)} />
          </div>

          {summary.reviewInbox.length > 0 && (
            <div className="card account-card">
              <div className="account-card-head"><h2>待我审批</h2><span>{summary.reviewInbox.length} 条</span></div>
              <div className="join-list">
                {summary.reviewInbox.map((row) => (
                  <div className="join-row" key={row.id}>
                    <div><strong>{row.applicantName}</strong><span>申请加入 {row.merchantName} · {row.requestedRole}</span><p>{row.message || '未填写说明'}</p></div>
                    <div><button className="btn btn-primary btn-sm" onClick={() => void reviewJoin(row.id, true)}>同意</button><button className="btn btn-ghost btn-sm" onClick={() => void reviewJoin(row.id, false)}>拒绝</button></div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {createBusinessOpen && (
            <div className="account-modal-mask" onClick={() => setCreateBusinessOpen(false)}>
              <form className="account-modal" onClick={(event) => event.stopPropagation()} onSubmit={(event) => void createBusiness(event)}>
                <div className="account-card-head">
                  <h2>{createIdentity === 'enterprise' ? '创建企业主体' : '创建个人主体'}</h2>
                  <button type="button" className="account-modal-close" onClick={() => setCreateBusinessOpen(false)}>×</button>
                </div>
                <div className="account-form-grid">
                  {createIdentity === 'enterprise' ? (
                    <>
                      <label>企业名称<span className="account-required">*</span><input className="input" value={createBusinessForm.companyName} placeholder="与营业执照一致" onChange={(event) => setCreateBusinessForm({ ...createBusinessForm, companyName: event.target.value })} /></label>
                      <label>统一社会信用代码<span className="account-required">*</span><input className="input" value={createBusinessForm.creditCode} maxLength={18} placeholder="15-18 位字母数字" onChange={(event) => setCreateBusinessForm({ ...createBusinessForm, creditCode: event.target.value.replace(/\s/g, '').toUpperCase() })} /></label>
                      <label>所属行业<select className="select" value={createBusinessForm.industry} onChange={(event) => setCreateBusinessForm({ ...createBusinessForm, industry: event.target.value })}>{INDUSTRIES.map((item) => <option key={item}>{item}</option>)}</select></label>
                      <label>企业规模<select className="select" value={createBusinessForm.companySize} onChange={(event) => setCreateBusinessForm({ ...createBusinessForm, companySize: event.target.value })}>{COMPANY_SIZES.map((item) => <option key={item}>{item}</option>)}</select></label>
                      <label>注册地址<input className="input" value={createBusinessForm.address} placeholder="省 / 市 / 区 / 详细地址" onChange={(event) => setCreateBusinessForm({ ...createBusinessForm, address: event.target.value })} /></label>
                    </>
                  ) : (
                    <>
                      <label>真实姓名<span className="account-required">*</span><input className="input" value={createBusinessForm.realName} placeholder="请输入真实姓名" onChange={(event) => setCreateBusinessForm({ ...createBusinessForm, realName: event.target.value })} /></label>
                      <label>身份证号<span className="account-required">*</span><input className="input" value={createBusinessForm.idCard} maxLength={18} placeholder="18 位身份证号（仅存掩码与摘要）" onChange={(event) => setCreateBusinessForm({ ...createBusinessForm, idCard: event.target.value.replace(/\s/g, '').toUpperCase() })} /></label>
                      <label>经营类型<select className="select" value={createBusinessForm.businessType} onChange={(event) => setCreateBusinessForm({ ...createBusinessForm, businessType: event.target.value })}>{BUSINESS_TYPES.map((item) => <option key={item}>{item}</option>)}</select></label>
                    </>
                  )}
                  <label>联系人姓名<span className="account-required">*</span><input className="input" value={createBusinessForm.contactName} placeholder="用于接收重要通知" onChange={(event) => setCreateBusinessForm({ ...createBusinessForm, contactName: event.target.value })} /></label>
                </div>
                <p className="muted">创建后主体会出现在“我的经营主体”中；企业主体还需进入认证流程提交审核。</p>
                <div className="account-form-actions">
                  <button className="btn btn-primary" disabled={busy}>{busy ? '创建中…' : '创建主体'}</button>
                  <button type="button" className="btn btn-ghost" onClick={() => setCreateBusinessOpen(false)}>取消</button>
                </div>
              </form>
            </div>
          )}
          {certificationTarget && (
            <div className="account-modal-mask" onClick={() => setCertificationTarget(null)}>
              <form className="account-modal" onClick={(event) => event.stopPropagation()}
                onSubmit={(event) => void submitEnterpriseCertification(event)}>
                <div className="account-card-head">
                  <h2>企业主体认证</h2>
                  <button type="button" className="account-modal-close" onClick={() => setCertificationTarget(null)}>×</button>
                </div>
                {certificationTarget.verifyStatus === 'rejected' && (
                  <div className="account-error">上次认证被驳回，请根据审核意见修改后重新提交。</div>
                )}
                <div className="account-form-grid">
                  <label>企业名称<span className="account-required">*</span><input className="input" value={certificationForm.companyName} onChange={(event) => setCertificationForm({ ...certificationForm, companyName: event.target.value })} /></label>
                  <label>统一社会信用代码<span className="account-required">*</span><input className="input" maxLength={18} value={certificationForm.creditCode} onChange={(event) => setCertificationForm({ ...certificationForm, creditCode: event.target.value.replace(/\s/g, '').toUpperCase() })} /></label>
                  <label>法定代表人<span className="account-required">*</span><input className="input" value={certificationForm.legalPerson} placeholder="请输入法定代表人或经营者姓名" onChange={(event) => setCertificationForm({ ...certificationForm, legalPerson: event.target.value })} /></label>
                  <label>营业执照号<input className="input" value={certificationForm.licenseNo} placeholder="如与统一社会信用代码相同可留空" onChange={(event) => setCertificationForm({ ...certificationForm, licenseNo: event.target.value })} /></label>
                  <label>联系人姓名<span className="account-required">*</span><input className="input" value={certificationForm.contactName} onChange={(event) => setCertificationForm({ ...certificationForm, contactName: event.target.value })} /></label>
                  <label>联系电话<span className="account-required">*</span><input className="input" maxLength={11} value={certificationForm.contactPhone} onChange={(event) => setCertificationForm({ ...certificationForm, contactPhone: event.target.value.replace(/\D/g, '') })} /></label>
                </div>
                  <div className="certification-documents">
                    {[
                      {
                        kind: 'business_license', title: '营业执照照片',
                        hint: '请上传完整、清晰且在有效期内的营业执照',
                        url: certificationForm.businessLicenseUrl,
                        field: 'businessLicenseUrl' as const,
                      },
                      {
                        kind: 'legal_person_id_front', title: '法人身份证人像面',
                        hint: '证件信息清晰可见，仅用于主体实名认证',
                        url: certificationForm.legalPersonIdFrontUrl,
                        field: 'legalPersonIdFrontUrl' as const,
                      },
                      {
                        kind: 'legal_person_id_back', title: '法人身份证国徽面',
                        hint: '请上传身份证背面，确保有效期限清晰',
                        url: certificationForm.legalPersonIdBackUrl,
                        field: 'legalPersonIdBackUrl' as const,
                      },
                    ].map((document) => (
                      <div className="certification-document" key={document.kind}>
                        <div className="certification-document-head">
                          <strong>{document.title}<span className="account-required">*</span></strong>
                          <small>{document.hint}</small>
                        </div>
                        {document.url ? (
                          <div className="certification-document-preview">
                            <img src={document.url} alt={document.title} />
                            <div>
                              <span>已上传</span>
                              <label className="certification-replace">
                                {certificationUploading === document.kind ? '上传中…' : '重新上传'}
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp"
                                  disabled={busy || Boolean(certificationUploading)}
                                  onChange={(event) => {
                                    const file = event.target.files?.[0]
                                    if (file) void uploadCertificationDocument(document.kind, file)
                                    event.currentTarget.value = ''
                                  }}
                                />
                              </label>
                            </div>
                          </div>
                        ) : (
                          <label className="certification-upload">
                            <span>{certificationUploading === document.kind ? '正在上传…' : '选择图片'}</span>
                            <small>JPG / PNG / WEBP，不超过 5MB</small>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              disabled={busy || Boolean(certificationUploading)}
                              onChange={(event) => {
                                const file = event.target.files?.[0]
                                if (file) void uploadCertificationDocument(document.kind, file)
                                event.currentTarget.value = ''
                              }}
                            />
                          </label>
                        )}
                      </div>
                    ))}
                  </div>
                  <label>认证材料说明<textarea className="input account-textarea" value={certificationForm.attachNote} placeholder="可填写经营范围、资质说明及需平台核验的其他信息" onChange={(event) => setCertificationForm({ ...certificationForm, attachNote: event.target.value })} /></label>
                <p className="muted">提交后进入平台审核；审核通过前不会改变主体已有业务权限。</p>
                <div className="account-form-actions">
                  <button className="btn btn-primary" disabled={busy || Boolean(certificationUploading)}>{busy ? '提交中…' : certificationUploading ? '图片上传中…' : '提交认证审核'}</button>
                  <button type="button" className="btn btn-ghost" onClick={() => setCertificationTarget(null)}>取消</button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {tab === 'team' && (
        <TeamMembers
          merchantId={activeMerchant?.merchantId ?? null}
          merchantName={activeMerchant?.merchantName ?? null}
          onNotice={flash}
          onError={setError}
        />
      )}

      {tab === 'roles' && (
        <RolesPermissions
          merchantId={activeMerchant?.merchantId ?? null}
          merchantName={activeMerchant?.merchantName ?? null}
          onNotice={flash}
          onError={setError}
        />
      )}
        </main>
      </div>
    </section>
  )
}

function JoinList({ rows, onCancel }: { rows: JoinRow[]; onCancel: (id: string) => void }): JSX.Element {
  if (!rows.length) return <div className="empty">暂无申请记录</div>
  return (
    <div className="join-list">
      {rows.map((row) => (
        <div className="join-row" key={row.id}>
          <div><strong>{row.merchantName}</strong><span>{row.requestedRole} · {String(row.createdAt).slice(0, 16).replace('T', ' ')}</span><p>{row.message || '未填写说明'}</p></div>
          <div className="join-row-status">
            <span className={`account-status ${tone(row.status)}`}>{row.status === 'pending' ? '待审批' : row.status === 'approved' ? '已同意' : row.status === 'rejected' ? '已拒绝' : row.status}</span>
            {row.status === 'pending' && <button type="button" className="btn btn-ghost btn-sm" onClick={() => onCancel(row.id)}>撤回</button>}
          </div>
        </div>
      ))}
    </div>
  )
}
