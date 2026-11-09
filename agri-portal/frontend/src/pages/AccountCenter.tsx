import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Icon } from '../components/Icon'
import { AccountOverview } from './account/AccountOverview'
import { Authorizations } from './account/Authorizations'
import { Certificates } from './account/Certificates'
import { CrossModule } from './account/CrossModule'
import { Feedback } from './account/Feedback'
import { HelpCenter } from './account/HelpCenter'
import { IdentityApply } from './account/IdentityApply'
import { LoginDevices } from './account/LoginDevices'
import { Messages } from './account/Messages'
import { Mfa } from './account/Mfa'
import { NotificationSettings } from './account/NotificationSettings'
import { OperationLogs } from './account/OperationLogs'
import { Orders } from './account/Orders'
import { PersonalRealname } from './account/PersonalRealname'
import { PrivacyData } from './account/PrivacyData'
import { ThirdPartyBindings } from './account/ThirdPartyBindings'
import { NAV_GROUPS, findNavItem, navProgress } from './account/navModel'
import { childrenOf, displayCityName, loadRegionCatalog, type RegionCatalog } from '@/utils/addressRegion'
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
    legalPersonFaceUrl: string | null
    legalPersonFaceStatus: string | null
    corporateBankName: string | null
    corporateBankAccount: string | null
    corporateTransferAmount: string | null
    corporateTransferReference: string | null
    corporateTransferProofUrl: string | null
    corporateTransferStatus: string | null
    registeredCapital: string | null
    verificationChannel: string | null
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

type Tab = 'overview' | 'messages' | 'devices' | 'bindings' | 'notification' | 'logs'
  | 'certificates' | 'realname' | 'feedback' | 'privacy' | 'crossModule' | 'orders'
  | 'help' | 'authorizations' | 'mfa' | 'profile' | 'security'
  | 'addresses' | 'enterprise' | 'org'
  | 'team' | 'roles'
type SecurityPage = 'password' | 'phone'

/**
 * 视图元数据（标题/描述用）。
 *
 * <p>注意：**侧栏菜单不从这里生成** —— 侧栏按原型 IA 走 {@link NAV_GROUPS}
 * （7 个分组 23 个条目，见 `pages/account/navModel.ts`）。这里只保留
 * 内容区标题需要的文案，两者不是一回事。</p>
 */
const TABS: { key: Tab; label: string; icon: string; description: string }[] = [
  { key: 'overview', label: '账号总览', icon: 'home', description: '账号、实名、身份、待办与安全状况一览' },
  { key: 'messages', label: '消息中心', icon: 'bell', description: '站内通知：加入申请、审核结果等' },
  { key: 'devices', label: '登录设备', icon: 'cpu', description: '查看并下线当前账号的登录会话' },
  { key: 'bindings', label: '第三方绑定', icon: 'globe', description: '登记微信 / 支付宝 / 钉钉账号标识' },
  { key: 'notification', label: '通知设置', icon: 'settings', description: '配置通知类型、免打扰时段与推送频率' },
  { key: 'logs', label: '操作日志', icon: 'clipboard', description: '查看本人最近的操作记录' },
  { key: 'certificates', label: '资质证照', icon: 'file', description: '维护主体资质证照与到期预警' },
  { key: 'realname', label: '个人实名', icon: 'user', description: '身份证资料、人脸活体与公安二要素核验' },
  { key: 'feedback', label: '意见反馈', icon: 'clipboard', description: '提交建议或问题，查看平台回复' },
  { key: 'privacy', label: '隐私与数据', icon: 'file', description: '数据导出、账号注销申请与第三方授权撤回' },
  { key: 'crossModule', label: '跨模块入口', icon: 'globe', description: '各子系统入口与前置条件一览' },
  { key: 'orders', label: '订单聚合', icon: 'cart', description: '跨域订单统一视图（当前接入交易域）' },
  { key: 'help', label: '帮助中心', icon: 'alert', description: '常见问题与可查阅的资料' },
  { key: 'authorizations', label: '授权管理', icon: 'layers', description: '谁在代表我访问平台：渠道、会话、身份、主体' },
  { key: 'mfa', label: '二次验证', icon: 'check', description: '用手机验证器作为密码之外的第二道验证' },
  { key: 'profile', label: '账号资料', icon: 'user', description: '维护昵称、邮箱与账号概况' },
  { key: 'security', label: '账号安全', icon: 'shield', description: '修改密码与绑定手机号' },
  { key: 'addresses', label: '地址管理', icon: 'location', description: '维护收货地址与默认地址' },
  { key: 'enterprise', label: '企业实名', icon: 'award', description: '主体认证状态、材料与提交审核' },
  { key: 'org', label: '我的组织', icon: 'factory', description: '经营主体、主体切换与加入申请' },
  { key: 'team', label: '成员管理', icon: 'users', description: '管理当前主体的团队成员' },
  { key: 'roles', label: '我的角色与权限', icon: 'shield', description: '配置当前主体的角色与权限' },
]

const ACCOUNT_TAB_KEYS: Tab[] = ['overview', 'messages', 'devices', 'bindings', 'notification', 'logs',
  'certificates', 'realname', 'feedback', 'privacy', 'crossModule', 'orders', 'help',
  'authorizations', 'mfa', 'profile', 'security', 'addresses', 'enterprise', 'org', 'team', 'roles']

function normalizeAccountTab(value: string | null | undefined): Tab {
  // 旧的「身份与认证」页已拆成企业实名 + 我的组织，老链接回落到我的组织；
  // 「身份申请」已并入我的组织，旧链接同样回落
  if (value === 'business' || value === 'identityApply') return 'org'
  return ACCOUNT_TAB_KEYS.includes(value as Tab) ? value as Tab : 'overview'
}

function normalizeSecurityPage(value: string | null | undefined): SecurityPage {
  return value === 'security/phone' ? 'phone' : 'password'
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
  const initialProfileEdit = initialTab === 'profile/edit'
  const initialSecurityPage = normalizeSecurityPage(initialTab)
  const [tab, setTab] = useState<Tab>(() => normalizeAccountTab(initialTab))
  const [profileEditing, setProfileEditing] = useState(initialProfileEdit)
  const [securityPage, setSecurityPage] = useState<SecurityPage>(initialSecurityPage)
  /**
   * 当前点开的"待接入"菜单项。
   * 侧栏共 23 个条目，后端只支持其中一部分；点未接入的项时用它切到说明面板，
   * 而不是留在上一个 tab 让用户以为点错了。
   */
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  /**
   * 安全子页（修改密码 / 变更手机号）的展开态。
   * 侧栏改成原型 IA 后不再需要它控制展开，但 openTab/openSecurity 仍在用它复位，
   * 所以保留 setter、丢掉未使用的读取值。
   */
  const [, setSecurityMenuOpen] = useState(Boolean(initialTab?.startsWith('security')))
  const [summary, setSummary] = useState<Summary | null>(null)
  const [realnameFormSignal, setRealnameFormSignal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [profile, setProfile] = useState({ nickname: '', email: '' })
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [phoneForm, setPhoneForm] = useState({ phone: '', code: '' })
  const [codeLeft, setCodeLeft] = useState(0)
  /** 已经发过码的号码：只有它和当前输入的号码一致时才允许提交，避免"填了码但那条码根本没发给这个号" */
  const [codeSentFor, setCodeSentFor] = useState('')
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
    legalPersonFaceUrl: '', corporateBankName: '', corporateBankAccount: '',
    corporateTransferAmount: '', corporateTransferReference: '', corporateTransferProofUrl: '',
    registeredCapital: '',
  })
  const [certificationUploading, setCertificationUploading] = useState<string | null>(null)
  const [createIdentity, setCreateIdentity] = useState<'enterprise' | 'personal'>('enterprise')
  const [createBusinessForm, setCreateBusinessForm] = useState({
    companyName: '', creditCode: '', industry: INDUSTRIES[0], companySize: COMPANY_SIZES[0],
    realName: '', idCard: '', businessType: BUSINESS_TYPES[0], contactName: '',
  })
  // 注册地址：省/市/区来自主数据行政区划，详细地址手工填；提交时拼成后端接收的一个 address 字符串
  const [addressRegion, setAddressRegion] = useState({ province: '', city: '', district: '', detail: '' })
  const [regionCatalog, setRegionCatalog] = useState<RegionCatalog | null>(null)
  const [regionLoading, setRegionLoading] = useState(false)
  const [regionError, setRegionError] = useState('')
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
    if (initialTab?.startsWith('security')) {
      setTab('security')
      setSecurityPage(normalizeSecurityPage(initialTab))
      setSecurityMenuOpen(true)
      setProfileEditing(false)
      return
    }
    if (initialTab === 'profile/edit') {
      setTab('profile')
      setProfileEditing(true)
      return
    }
    setTab(normalizeAccountTab(initialTab))
    setProfileEditing(false)
  }, [initialTab])

  useEffect(() => {
    const canonical = initialProfileEdit
      ? '#/account/profile/edit'
      : initialTab?.startsWith('security')
        ? `#/account/security/${normalizeSecurityPage(initialTab)}`
        : `#/account/${normalizeAccountTab(initialTab)}`
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
    if (next === 'security') {
      openSecurity(securityPage)
      return
    }
    setProfileEditing(false)
    setSecurityMenuOpen(false)
    setTab(next)
    const target = `#/account/${next}`
    if (window.location.hash !== target) {
      window.location.hash = target
    }
  }

  const openSecurity = (next: SecurityPage): void => {
    setTab('security')
    setSecurityPage(next)
    setSecurityMenuOpen(true)
    setProfileEditing(false)
    const target = `#/account/security/${next}`
    if (window.location.hash !== target) window.location.hash = target
  }

  const openProfileEdit = (): void => {
    setTab('profile')
    setProfileEditing(true)
    const target = '#/account/profile/edit'
    if (window.location.hash !== target) window.location.hash = target
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
      openTab('profile')
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

  /** 换绑手机的三条门槛：合法号、不等于当前号、验证码位数够。页面与后端同一口径，谁先说都不算骗人。 */
  const phoneValid = /^1[3-9]\d{9}$/.test(phoneForm.phone)
  const phoneSameAsCurrent = Boolean(summary?.phone) && phoneForm.phone === summary?.phone
  const phoneCodeReady = codeSentFor === phoneForm.phone && /^\d{6}$/.test(phoneForm.code)

  const sendPhoneCode = async (): Promise<void> => {
    setError('')
    if (!phoneValid) return setError('请输入正确的 11 位手机号')
    if (phoneSameAsCurrent) return setError('新手机号与当前绑定的手机号相同，无需变更')
    const result = await api<{ hint?: string; devMode?: boolean }>('/api/v1/sso/account/phone/code', {
      method: 'POST',
      body: JSON.stringify({ phone: phoneForm.phone }),
    })
    if (result.code !== 0) return setError(result.message ?? '验证码发送失败')
    setCodeSentFor(phoneForm.phone)
    setCodeLeft(60)
    flash(result.data?.hint ?? '验证码已发送')
  }

  const changePhone = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (!phoneValid) return setError('请输入正确的 11 位手机号')
    if (!phoneCodeReady) return setError(codeSentFor !== phoneForm.phone
      ? '请先给这个号码获取验证码（换过号码要重新获取）'
      : '验证码是 6 位数字')
    setBusy(true)
    try {
      const result = await api<{ loginNameChanged?: boolean }>('/api/v1/sso/account/phone', {
        method: 'POST',
        body: JSON.stringify(phoneForm),
      })
      if (result.code !== 0) return setError(result.message ?? '手机号变更失败')
      setPhoneForm({ phone: '', code: '' })
      setCodeSentFor('')
      // 登录名可能就是旧手机号：换号后登录名一起变，不写清楚用户会拿旧号登录不上还以为账号丢了
      flash(result.data?.loginNameChanged
        ? '手机号已变更，登录名同步改为新手机号'
        : '手机号已变更')
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

  /** 行政区划只在需要时拉一次；失败可重试，不阻塞个人主体创建 */
  const ensureRegionCatalog = async (): Promise<void> => {
    if (regionCatalog || regionLoading) return
    setRegionLoading(true)
    setRegionError('')
    try {
      setRegionCatalog(await loadRegionCatalog())
    } catch (e) {
      setRegionError((e as Error).message || '行政区划加载失败')
    } finally {
      setRegionLoading(false)
    }
  }

  const openCreateBusiness = (identity: 'enterprise' | 'personal'): void => {
    setCreateIdentity(identity)
    setCreateBusinessForm((current) => ({
      ...current,
      contactName: current.contactName || summary?.nickname || '',
    }))
    if (identity === 'enterprise') {
      setAddressRegion({ province: '', city: '', district: '', detail: '' })
      void ensureRegionCatalog()
    }
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
    if (createIdentity === 'enterprise') {
      if (!addressRegion.province) return setError('请选择注册地址所在省份')
      if (!addressRegion.city) return setError('请选择注册地址所在城市')
      if (districtOptions.length > 0 && !addressRegion.district) return setError('请选择注册地址所在区县')
      if (!addressRegion.detail.trim()) return setError('请填写详细地址（街道、门牌号）')
    }
    setBusy(true)
    try {
      const result = await api('/api/v1/sso/account/businesses', {
        method: 'POST',
        body: JSON.stringify({ ...createBusinessForm, address: composedAddress || null, identity: createIdentity }),
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
      // 个人主体的实名就是账号级个人实名：直接切到「个人实名」菜单并展开资料表单
      setRealnameFormSignal((value) => value + 1)
      setTab('realname')
      return
    }
    const cert = merchant.certification
    setTab('enterprise')
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
      legalPersonFaceUrl: cert?.legalPersonFaceUrl || '',
      corporateBankName: cert?.corporateBankName || '',
      corporateBankAccount: '',
      corporateTransferAmount: cert?.corporateTransferAmount || '',
      corporateTransferReference: cert?.corporateTransferReference || '',
      corporateTransferProofUrl: cert?.corporateTransferProofUrl || '',
      registeredCapital: cert?.registeredCapital || '',
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
        legal_person_face: 'legalPersonFaceUrl',
        corporate_transfer_proof: 'corporateTransferProofUrl',
      }[kind] as 'businessLicenseUrl' | 'legalPersonIdFrontUrl' | 'legalPersonIdBackUrl'
        | 'legalPersonFaceUrl' | 'corporateTransferProofUrl' | undefined
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
    if (!certificationForm.legalPersonFaceUrl) return setError('请完成法定代表人扫脸采集')
    if (!certificationForm.corporateBankName.trim()) return setError('请填写对公账户户名')
    if (!/^\d{8,32}$/.test(certificationForm.corporateBankAccount.replace(/\s/g, ''))) {
      return setError('请填写有效的对公账户账号')
    }
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(certificationForm.corporateTransferAmount)) {
      return setError('请填写正确的对公打款金额')
    }
    if (certificationForm.corporateTransferReference.trim().length < 6) {
      return setError('请填写对公打款流水号')
    }
    if (!certificationForm.corporateTransferProofUrl) return setError('请上传对公打款凭证')
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

  /* ---------- 注册地址级联 ---------- */
  const provinceOption = regionCatalog?.provinces.find((item) => item.code === addressRegion.province)
  const cityOptions = childrenOf(regionCatalog?.cities ?? [], addressRegion.province)
  const cityOption = cityOptions.find((item) => item.code === addressRegion.city)
  const districtOptions = childrenOf(regionCatalog?.districts ?? [], addressRegion.city)
  const districtOption = districtOptions.find((item) => item.code === addressRegion.district)
  const composedAddress = [
    provinceOption?.name ?? '',
    displayCityName(cityOption, provinceOption),
    districtOption?.name ?? '',
    addressRegion.detail.trim(),
  ].filter(Boolean).join(' ')
  const activeTabMeta = TABS.find((item) => item.key === tab) ?? TABS[0]
  const navStats = navProgress()
  const pendingItem = pendingKey ? findNavItem(pendingKey) : undefined
  const securityTitle = securityPage === 'password' ? '修改密码' : '变更手机号'
  const securityDescription = securityPage === 'password'
    ? '设置新的登录密码'
    : '先验证新号码收得到短信，再换绑（登录名是手机号时会同步变更）'
  const pageTitle = pendingItem
    ? pendingItem.label
    : tab === 'profile' && profileEditing
      ? '编辑账号资料'
      : tab === 'security' ? securityTitle : activeTabMeta.label
  const pageDescription = pendingItem
    ? '该功能尚未接入后端，下面是具体缺口'
    : tab === 'profile' && profileEditing
      ? '修改昵称与邮箱，登录账号和手机号请在账号安全中维护'
      : tab === 'security' ? securityDescription : activeTabMeta.description

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
            <span>用户中心</span>
            <strong>账号 · 身份 · 认证 · 安全</strong>
          </div>
          {/*
            侧栏按原型 IA 渲染（8 组 / 20 项），而不是按"代码里现有哪些 tab"。
            每项带状态：
              ready    → 点进去有真实功能
              external → 跳认证中心或独立认证页
              pending  → 点开说明"缺哪个接口"，不给空白页也不给假数据
            进度条让"原型 20 项、已实现 7 项"这件事在界面上就看得见，不用翻文档。
          */}
          <div className="uc-nav-progress" title="原型条目已实现进度">
            <div className="uc-nav-progress-bar">
              <span style={{ width: `${Math.round(((navStats.ready + navStats.external) / navStats.total) * 100)}%` }} />
            </div>
            <small>
              已实现 {navStats.ready + navStats.external} / {navStats.total} 项
              {navStats.pending > 0 ? ` · 待接入 ${navStats.pending}` : ''}
            </small>
          </div>
          <nav className="account-menu" aria-label="用户中心菜单">
            {NAV_GROUPS.map((group) => (
              <div className="uc-nav-group" key={group.key}>
                <div className="uc-nav-group-title">
                  <Icon name={group.icon} size={13} />
                  <span>{group.label}</span>
                </div>
                {group.items.map((item) => {
                  const isActive = item.status === 'ready' && item.view === tab && !pendingKey
                  return (
                    <button
                      type="button"
                      key={item.key}
                      className={`account-menu-top uc-nav-item ${isActive ? 'on' : ''} ${item.status === 'pending' ? 'is-pending' : ''}`}
                      onClick={() => {
                        if (item.status === 'external' && item.href) {
                          window.location.href = item.href
                          return
                        }
                        if (item.status === 'pending') {
                          setPendingKey(item.key)
                          return
                        }
                        if (item.view) {
                          setPendingKey(null)
                          openTab(item.view)
                        }
                      }}
                    >
                      <span className="account-menu-icon"><Icon name={item.icon} size={16} /></span>
                      <span>{item.label}</span>
                      {item.status === 'pending' && <i className="uc-nav-tag">待接入</i>}
                      {item.status === 'external' && <i className="uc-nav-tag ext">跳转</i>}
                      {item.status === 'ready' && <i>›</i>}
                    </button>
                  )
                })}
              </div>
            ))}
          </nav>
          <div className="account-sidebar-subject">
            <span>当前登录身份</span>
            <strong>{activeMerchant?.merchantName || '暂未选择'}</strong>
            <small>{activeMerchant ? `${activeMerchant.memberType === 'personal' ? '个人主体' : '企业主体'} · ${activeMerchant.roleInMerchant}` : '请先创建经营主体'}</small>
          </div>
        </aside>

        <main className="account-content">
          <div className="account-content-head">
            <div>
              <span>
                用户中心 / {pendingItem ? pendingItem.label : activeTabMeta.label}
                {profileEditing ? ' / 编辑' : tab === 'security' && !pendingItem ? ` / ${securityTitle}` : ''}
              </span>
              <h2>{pageTitle}</h2>
            </div>
            <p>{pageDescription}</p>
          </div>
          {notice && <div className="account-notice">{notice}</div>}
          {error && <div className="account-error">{error}</div>}

      {pendingItem && (
        <div className="card uc-pending">
          <div className="uc-pending-head">
            <span className="uc-pending-icon"><Icon name="alert" size={22} /></span>
            <div>
              <h3>{pendingItem.label} · 暂未接入</h3>
              <p>原型规划了这个页面，但后端目前没有对应能力。这里如实说明缺口，不展示示例数据。</p>
            </div>
          </div>
          <dl className="uc-kv">
            <dt>缺失能力</dt>
            <dd>{pendingItem.gap ?? '待补充说明'}</dd>
          </dl>
          <p className="uc-pending-foot">
            补齐后端接口后，本页可直接接上，无需改导航结构。
          </p>
        </div>
      )}

      {!pendingItem && tab === 'overview' && (
        <AccountOverview
          summary={{
            userId: summary.userId,
            username: summary.username,
            nickname: summary.nickname,
            phone: summary.phone,
            email: summary.email,
            status: summary.status,
            createdAt: summary.createdAt,
            realName: summary.realName
              ? {
                  realName: summary.realName.realName,
                  status: summary.realName.status,
                  policeVerified: summary.realName.policeVerified,
                  livenessVerified: summary.realName.livenessVerified,
                  verificationChannel: summary.realName.verificationChannel,
                }
              : null,
            activeMerchantId: summary.activeMerchantId,
            merchants: summary.merchants.map((item) => ({
              merchantId: item.merchantId,
              merchantName: item.merchantName ?? '未命名主体',
              memberType: item.memberType,
              roleInMerchant: item.roleInMerchant,
              verifyStatus: item.verifyStatus,
            })),
            reviewInbox: summary.reviewInbox.map((item) => ({ id: item.id })),
            sentJoinRequests: summary.sentJoinRequests.map((item) => ({ id: item.id, status: item.status })),
          }}
          onNavigate={(view) => {
            setPendingKey(null)
            openTab(view)
          }}
        />
      )}

      {!pendingItem && tab === 'messages' && <Messages />}

      {!pendingItem && tab === 'devices' && <LoginDevices />}

      {!pendingItem && tab === 'bindings' && <ThirdPartyBindings />}

      {!pendingItem && tab === 'notification' && <NotificationSettings />}

      {!pendingItem && tab === 'logs' && <OperationLogs />}

      {!pendingItem && tab === 'certificates' && <Certificates />}


      {!pendingItem && tab === 'feedback' && <Feedback />}

      {!pendingItem && tab === 'privacy' && <PrivacyData />}

      {!pendingItem && tab === 'crossModule' && <CrossModule />}

      {!pendingItem && tab === 'orders' && <Orders />}

      {!pendingItem && tab === 'help' && <HelpCenter />}

      {!pendingItem && tab === 'authorizations' && <Authorizations />}

      {!pendingItem && tab === 'mfa' && <Mfa />}

      {tab === 'profile' && !profileEditing && (
        <div className="account-profile-overview">
          <div className="card account-card">
            <div className="account-card-head">
              <div><h2>账号概况</h2><small>登录账号与基础资料</small></div>
              <button className="btn btn-outline" onClick={openProfileEdit}>编辑账号资料</button>
            </div>
            <div className="account-profile-primary">
              <div className="account-profile-avatar">{(summary.nickname || summary.username || summary.phone).slice(0, 1)}</div>
              <div>
                <strong>{summary.nickname || '未设置昵称'}</strong>
                <span>{summary.username} · {summary.phone || '未绑定手机'}</span>
              </div>
              <span className="account-profile-state">
                <i className={summary.status === 1 ? 'online' : ''} />
                {summary.status === 1 ? '账号正常' : '账号停用'}
              </span>
            </div>
            <div className="account-profile-detail-grid">
              <div><span>登录账号</span><strong>{summary.username}</strong></div>
              <div><span>绑定手机</span><strong>{summary.phone || '未绑定'}</strong></div>
              <div><span>联系邮箱</span><strong>{summary.email || '未绑定'}</strong></div>
              <div><span>注册时间</span><strong>{String(summary.createdAt).slice(0, 10)}</strong></div>
            </div>
          </div>

          <div className="card account-card">
            <div className="account-card-head">
              <div><h2>账号关联概况</h2><small>实名、主体与地址使用情况</small></div>
            </div>
            <div className="account-profile-related-grid">
              <div>
                <span className={`account-status ${tone(summary.realName?.status)}`}>{statusText(summary.realName?.status)}</span>
                <strong>个人实名认证</strong>
                <small>{summary.realName?.realName || '尚未提交实名信息'}</small>
              </div>
              <div>
                <span className="account-profile-related-icon"><Icon name="factory" size={17} /></span>
                <strong>当前登录主体</strong>
                <small>{activeMerchant?.merchantName || '暂未选择经营主体'}</small>
              </div>
              <div>
                <span className="account-profile-related-icon"><Icon name="layers" size={17} /></span>
                <strong>经营主体</strong>
                <small>共 {summary.merchants.length} 个，可在主体资料中切换</small>
              </div>
              <div>
                <span className="account-profile-related-icon"><Icon name="location" size={17} /></span>
                <strong>收货地址</strong>
                <small>已维护 {addresses.length} 个收货地址</small>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'profile' && profileEditing && (
        <div className="account-profile-edit-layout">
          <form className="card account-card account-profile-edit" onSubmit={(event) => void saveProfile(event)}>
            <div className="account-card-head">
              <div><h2>编辑账号资料</h2><small>修改后点击保存立即生效</small></div>
            </div>
            <section className="account-profile-form-section">
              <div className="account-profile-form-title">
                <h3>基本资料</h3>
                <p>昵称会显示在门户和会员中心；邮箱用于接收平台通知。</p>
              </div>
              <div className="account-form-grid">
                <label>
                  <span className="account-form-label-row">昵称<span className="account-required">*</span></span>
                  <input className="input" value={profile.nickname} maxLength={64} onChange={(event) => setProfile({ ...profile, nickname: event.target.value })} />
                </label>
                <label>联系邮箱<input className="input" type="email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} /></label>
              </div>
            </section>
            <div className="account-form-actions account-profile-form-actions">
              <button className="btn btn-primary" disabled={busy}>{busy ? '保存中…' : '保存资料'}</button>
              <button type="button" className="btn btn-ghost" onClick={() => openTab('profile')}>取消</button>
            </div>
          </form>

          <div className="card account-card account-profile-readonly">
            <div className="account-card-head">
              <div><h2>账号与绑定信息</h2><small>以下信息不可在此页面修改</small></div>
            </div>
            <div className="account-info-list">
              <div><span>登录账号</span><strong>{summary.username}</strong></div>
              <div><span>绑定手机</span><strong>{summary.phone || '未绑定'}</strong></div>
            </div>
            <div className="account-profile-security-entry">
              <div>
                <strong>需要修改登录信息？</strong>
                <p>密码和手机号统一在账号安全中维护。</p>
              </div>
              <div className="account-form-actions">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => openSecurity('password')}>修改密码</button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => openSecurity('phone')}>变更手机号</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'security' && securityPage === 'password' && (
        <form className="card account-card account-security-page" onSubmit={(event) => void changePassword(event)}>
            <div className="account-card-head"><h2>修改密码</h2><span>8-20 位，包含字母和数字</span></div>
            <label>当前密码<input className="input" type="password" value={passwords.currentPassword} onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })} /></label>
            <label>新密码<input className="input" type="password" value={passwords.newPassword} onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })} /></label>
            <label>确认新密码<input className="input" type="password" value={passwords.confirmPassword} onChange={(event) => setPasswords({ ...passwords, confirmPassword: event.target.value })} /></label>
            <button className="btn btn-primary" disabled={busy}>{busy ? '提交中…' : '修改密码'}</button>
        </form>
      )}

      {tab === 'security' && securityPage === 'phone' && (
        <form className="card account-card account-security-page account-phone-form" onSubmit={(event) => void changePhone(event)}>
            <div className="account-card-head">
              <h2>变更手机号</h2>
              <span>当前绑定：{summary?.phone || '未绑定'}</span>
            </div>
            <label>新手机号<input className="input" value={phoneForm.phone} maxLength={11}
              placeholder="11 位大陆手机号"
              onChange={(event) => setPhoneForm({ ...phoneForm, phone: event.target.value.replace(/\D/g, '') })} /></label>
            {phoneSameAsCurrent && <p className="account-field-warning">这个号码就是当前绑定的号码，换绑请填新号码。</p>}
            <label>短信验证码
              <div className="account-code-row">
                <input className="input" value={phoneForm.code} maxLength={6} placeholder="6 位数字"
                  onChange={(event) => setPhoneForm({ ...phoneForm, code: event.target.value.replace(/\D/g, '') })} />
                <button type="button" className="btn btn-outline"
                  disabled={busy || codeLeft > 0 || !phoneValid || phoneSameAsCurrent}
                  onClick={() => void sendPhoneCode()}>
                  {codeLeft > 0 ? `${codeLeft}s` : '获取验证码'}
                </button>
              </div>
            </label>
            <p className="account-field-hint">
              {codeSentFor && codeSentFor !== phoneForm.phone
                ? '验证码是上一条号码的：换了号码要重新获取。'
                : '验证码 5 分钟内有效、只用一次；同一号码 60 秒内不重发，当日有发送上限（由运营端参数配置决定）。'}
            </p>
            {summary?.username === summary?.phone && (
              <p className="account-field-warning">
                这个账号的登录名就是当前手机号，换绑后<b>登录名会一起变成新号码</b>，以后请用新号码登录。
              </p>
            )}
            <button className="btn btn-primary" disabled={busy || !phoneCodeReady}>{busy ? '提交中…' : '确认变更'}</button>
        </form>
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

      {tab === 'realname' && (
        <PersonalRealname record={summary.realName} onRefresh={load} openFormSignal={realnameFormSignal} />
      )}

      {tab === 'enterprise' && (
        <div className="account-business-layout">
          <div className="card account-card uc-verify-hero">
            <div className="account-card-head">
              <h2>企业实名认证</h2>
              <span>{activeMerchant ? `当前主体：${activeMerchant.merchantName}` : '当前账号还没有经营主体'}</span>
            </div>
            {activeMerchant ? (
              <>
                <div className="uc-verify-status">
                  <span className={`account-status ${tone(activeMerchant.verifyStatus)}`}>{statusText(activeMerchant.verifyStatus)}</span>
                  <p>{activeMerchant.memberType === 'personal'
                    ? '个人主体不需要企业认证：账号完成「个人实名」后即可作为个人主体的身份依据。'
                    : activeMerchant.verifyStatus === 'approved'
                      ? '企业实名已通过，当前主体可开展交易、签约与金融申请。'
                      : activeMerchant.verifyStatus === 'pending'
                        ? '认证资料已提交平台审核，审核期间不可重复提交。'
                        : activeMerchant.verifyStatus === 'rejected'
                          ? '上次认证被驳回，请按审核意见修改资料后重新提交。'
                          : '尚未提交企业认证。补齐营业执照、法人与对公账户信息后提交审核。'}</p>
                </div>
                <div className="account-info-list">
                  <div><span>主体名称</span><strong>{activeMerchant.merchantName}</strong></div>
                  <div><span>主体类型</span><strong>{activeMerchant.memberType === 'personal' ? '个人主体' : '企业主体'}</strong></div>
                  <div><span>主体编码</span><strong>{activeMerchant.merchantCode || '—'}</strong></div>
                  <div><span>统一社会信用代码</span><strong>{activeMerchant.creditCodeMasked || '—'}</strong></div>
                  <div><span>法定代表人 / 联系人</span><strong>{activeMerchant.certification?.legalPerson || activeMerchant.contactName || '—'}</strong></div>
                  <div><span>审核意见</span><strong>{activeMerchant.verifyRemark || '—'}</strong></div>
                </div>
                {activeMerchant.certification ? (
                  <div className="certification-track">
                    <span>认证单号</span><b>{activeMerchant.certification.certNo}</b>
                    <span>提交时间</span><b>{String(activeMerchant.certification.submitTime).replace('T', ' ').slice(0, 16)}</b>
                    {activeMerchant.certification.reviewTime && (
                      <><span>审核时间</span><b>{String(activeMerchant.certification.reviewTime).replace('T', ' ').slice(0, 16)}</b></>
                    )}
                  </div>
                ) : (
                  <p className="uc-muted">还没有认证单。提交认证后会生成认证单号，审核进度以此为准。</p>
                )}
                <div className="account-form-actions">
                  {activeMerchant.memberType === 'personal' ? (
                    <button className="btn btn-outline" onClick={() => setTab('realname')}>去个人实名</button>
                  ) : activeMerchant.verifyStatus === 'approved' ? (
                    <button className="btn btn-ghost" onClick={() => setTab('certificates')}>查看主体资质证照</button>
                  ) : activeMerchant.verifyStatus === 'pending' ? (
                    <button className="btn btn-ghost" disabled>等待平台审核</button>
                  ) : (
                    <button className="btn btn-primary" disabled={busy} onClick={() => void startCertification(activeMerchant)}>
                      {activeMerchant.verifyStatus === 'rejected' ? '重新提交认证' : '开始企业认证'}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="account-business-empty">
                <p>认证挂在经营主体上。先到「我的组织」创建或加入一个企业主体，再回到本页提交认证。</p>
                <button className="btn btn-primary" onClick={() => setTab('org')}>去我的组织</button>
              </div>
            )}
          </div>

          <div className="card account-card">
            <div className="account-card-head">
              <h2>其他主体认证状态</h2>
              <span>{summary.merchants.length} 个主体</span>
            </div>
            {summary.merchants.length === 0 ? (
              <div className="empty">暂无经营主体</div>
            ) : (
              <div className="uc-verify-list">
                {summary.merchants.map((merchant) => (
                  <div className={`uc-verify-row ${merchant.merchantId === summary.activeMerchantId ? 'active' : ''}`} key={merchant.bindingId}>
                    <div className="uc-verify-row-main">
                      <strong>{merchant.merchantName}</strong>
                      <span>{merchant.memberType === 'personal' ? '个人主体' : '企业主体'} · {merchant.roleInMerchant}
                        {merchant.merchantId === summary.activeMerchantId ? ' · 当前主体' : ''}
                      </span>
                      {merchant.verifyRemark && <small>审核意见：{merchant.verifyRemark}</small>}
                    </div>
                    <div className="uc-verify-row-actions">
                      <span className={`account-status ${tone(merchant.verifyStatus)}`}>{statusText(merchant.verifyStatus)}</span>
                      {merchant.memberType === 'personal' ? (
                        <button className="btn btn-ghost btn-sm" onClick={() => setTab('realname')}>去个人实名</button>
                      ) : merchant.verifyStatus === 'approved' || merchant.verifyStatus === 'pending' ? (
                        <button className="btn btn-ghost btn-sm" disabled>{merchant.verifyStatus === 'approved' ? '已认证' : '审核中'}</button>
                      ) : (
                        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => void startCertification(merchant)}>
                          {merchant.verifyStatus === 'rejected' ? '重新认证' : '去认证'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card account-card">
            <div className="account-card-head"><h2>认证需要准备什么</h2><span>提交后 1-2 个工作日出结果</span></div>
            <ol className="uc-verify-flow">
              <li><b>营业执照</b><span>完整、清晰、在有效期内，四角无遮挡</span></li>
              <li><b>法定代表人扫脸</b><span>由法定代表人本人完成活体采集</span></li>
              <li><b>对公账户与打款凭证</b><span>户名须与企业名称一致，上传银行回单核对账户归属</span></li>
              <li><b>平台审核</b><span>审核通过后企业实名生效，可开展交易、签约与金融申请</span></li>
            </ol>
            <p className="uc-field-hint">
              认证信息仅用于身份核验与合规留痕；对公账号等敏感字段只保存掩码，前台与运营端都不展示明文。
            </p>
          </div>
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
                  <label>注册资本<input className="input" value={certificationForm.registeredCapital} placeholder="如：5000 万元" onChange={(event) => setCertificationForm({ ...certificationForm, registeredCapital: event.target.value })} /></label>
                  <label>联系人姓名<span className="account-required">*</span><input className="input" value={certificationForm.contactName} onChange={(event) => setCertificationForm({ ...certificationForm, contactName: event.target.value })} /></label>
                  <label>联系电话<span className="account-required">*</span><input className="input" maxLength={11} value={certificationForm.contactPhone} onChange={(event) => setCertificationForm({ ...certificationForm, contactPhone: event.target.value.replace(/\D/g, '') })} /></label>
                  <label>对公账户户名<span className="account-required">*</span><input className="input" value={certificationForm.corporateBankName} onChange={(event) => setCertificationForm({ ...certificationForm, corporateBankName: event.target.value })} /></label>
                  <label>对公账户账号<span className="account-required">*</span><input className="input" value={certificationForm.corporateBankAccount} placeholder="仅保存账户掩码" onChange={(event) => setCertificationForm({ ...certificationForm, corporateBankAccount: event.target.value.replace(/[^\d\s]/g, '') })} /></label>
                  <label>对公打款金额<span className="account-required">*</span><input className="input" value={certificationForm.corporateTransferAmount} placeholder="如：0.37" onChange={(event) => setCertificationForm({ ...certificationForm, corporateTransferAmount: event.target.value.replace(/[^\d.]/g, '') })} /></label>
                  <label>对公打款流水号<span className="account-required">*</span><input className="input" value={certificationForm.corporateTransferReference} onChange={(event) => setCertificationForm({ ...certificationForm, corporateTransferReference: event.target.value })} /></label>
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
                        kind: 'legal_person_face', title: '法定代表人扫脸',
                        hint: '调用摄像头采集，用于法人实名核验',
                        url: certificationForm.legalPersonFaceUrl,
                        field: 'legalPersonFaceUrl' as const,
                      },
                      {
                        kind: 'corporate_transfer_proof', title: '对公打款凭证',
                        hint: '上传银行回单，平台财务复核账户归属',
                        url: certificationForm.corporateTransferProofUrl,
                        field: 'corporateTransferProofUrl' as const,
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
                                  capture={document.kind === 'legal_person_face' ? 'user' : undefined}
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
                              capture={document.kind === 'legal_person_face' ? 'user' : undefined}
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

      {tab === 'org' && (
        <div className="account-business-layout">
          <div className="card account-card uc-org-hero">
            <div className="uc-org-hero-main">
              <span className="uc-org-hero-icon"><Icon name="factory" size={22} /></span>
              <div>
                <h2>{activeMerchant?.merchantName ?? '还没有经营主体'}</h2>
                <p>{activeMerchant
                  ? `${activeMerchant.memberType === 'personal' ? '个人主体' : '企业主体'} · 我的角色：${activeMerchant.roleInMerchant} · 主体编码 ${activeMerchant.merchantCode || '—'}`
                  : '创建企业主体后可开展交易、签约与认证；也可以直接申请加入已有主体。'}</p>
              </div>
            </div>
            <div className="uc-org-hero-actions">
              <span className={`account-status ${tone(activeMerchant?.verifyStatus ?? null)}`}>{statusText(activeMerchant?.verifyStatus ?? null)}</span>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setTab('enterprise')}>企业实名</button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setTab('team')}>成员管理</button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setTab('roles')}>角色权限</button>
            </div>
          </div>

          <div className="card account-card uc-org-identity">
            <div className="account-card-head">
              <h2>业务身份</h2>
              <span>一个账号可同时持有多个；审核通过后开通对应业务能力，但不改变主体权限</span>
            </div>
            <p className="uc-muted">
              业务身份是你在平台上对外声明的业务角色（批发商 / 零售商 / 农户等），审核通过后自动开通对应业务能力（见下方「已开通能力」），
              业务接口按能力放行；它不改变主体权限——你在主体内的角色与数据范围仍由下方主体列表与「成员管理」维护。
            </p>
            <IdentityApply />
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
          <div className="card account-card">
            <div className="account-card-head"><h2>组织协作</h2></div>
            <p className="uc-muted">成员、邀请与角色权限在「组织权限」分组里维护；本页只负责主体归属、切换和加入申请。</p>
            <div className="account-form-actions">
              <button className="btn btn-outline" onClick={() => setTab('team')}>成员管理</button>
              <button className="btn btn-outline" onClick={() => setTab('roles')}>我的角色与权限</button>
            </div>
          </div>

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
                      <label className="uc-address-field">注册地址<span className="account-required">*</span>
                        <div className="uc-address-grid">
                          <select className="select" value={addressRegion.province} aria-label="省份"
                            onChange={(event) => setAddressRegion({ province: event.target.value, city: '', district: '', detail: addressRegion.detail })}>
                            <option value="">{regionLoading ? '加载中…' : '选择省份'}</option>
                            {(regionCatalog?.provinces ?? []).map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
                          </select>
                          <select className="select" value={addressRegion.city} aria-label="城市" disabled={!addressRegion.province}
                            onChange={(event) => setAddressRegion({ ...addressRegion, city: event.target.value, district: '' })}>
                            <option value="">{addressRegion.province ? '选择城市' : '先选省份'}</option>
                            {cityOptions.map((item) => <option key={item.code} value={item.code}>{displayCityName(item, provinceOption)}</option>)}
                          </select>
                          <select className="select" value={addressRegion.district} aria-label="区县" disabled={!addressRegion.city}
                            onChange={(event) => setAddressRegion({ ...addressRegion, district: event.target.value })}>
                            <option value="">{addressRegion.city ? (districtOptions.length ? '选择区县' : '该市暂无区县数据') : '先选城市'}</option>
                            {districtOptions.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
                          </select>
                        </div>
                        <input className="input" value={addressRegion.detail} placeholder="详细地址：街道、门牌号（手工填写）"
                          onChange={(event) => setAddressRegion({ ...addressRegion, detail: event.target.value })} />
                        {regionError && (
                          <small className="uc-field-error">{regionError}
                            <button type="button" className="uc-inline-link" onClick={() => void ensureRegionCatalog()}>重试</button>
                          </small>
                        )}
                        {composedAddress && <small className="uc-field-hint">将保存为：{composedAddress}</small>}
                        {!regionLoading && !regionError && (regionCatalog?.provinces?.length ?? 0) === 0 && (
                          <small className="uc-field-error">主数据里还没有行政区划数据，请联系运营在「系统配置 → 行政区划」维护。</small>
                        )}
                      </label>
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
