import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Icon } from '../components/Icon'
import './account-center.css'

interface MerchantRow {
  bindingId: string
  merchantId: string
  merchantName: string | null
  memberType: string | null
  industry: string | null
  verifyStatus: string | null
  roleInMerchant: string
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

type Tab = 'profile' | 'security' | 'addresses' | 'business'

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'profile', label: '账号资料', icon: 'user' },
  { key: 'security', label: '账号安全', icon: 'shield' },
  { key: 'addresses', label: '地址管理', icon: 'location' },
  { key: 'business', label: '实名与主体', icon: 'factory' },
]

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

export function AccountCenter(): JSX.Element {
  const [tab, setTab] = useState<Tab>('profile')
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
  const [busy, setBusy] = useState(false)

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
    if (codeLeft <= 0) return undefined
    const timer = window.setTimeout(() => setCodeLeft(codeLeft - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [codeLeft])

  const flash = (message: string): void => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3500)
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
          <small>{summary.merchants.length} 个经营主体</small>
        </div>
      </div>

      {notice && <div className="account-notice">{notice}</div>}
      {error && <div className="account-error">{error}</div>}

      <div className="account-tabs">
        {TABS.map((item) => (
          <button type="button" key={item.key} className={tab === item.key ? 'on' : ''} onClick={() => setTab(item.key)}>
            <Icon name={item.icon} size={15} />{item.label}
          </button>
        ))}
      </div>

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
            <div className="account-card-head"><h2>我的经营主体</h2><span>{summary.merchants.length} 个</span></div>
            {summary.merchants.length === 0 ? (
              <div className="account-business-empty">
                <p>当前账号还没有经营主体，可注册个人或企业主体，也可以申请加入已有主体。</p>
                <div><a className="btn btn-primary" href="http://localhost:8090/register?step=2&identity=personal">创建个人主体</a><a className="btn btn-outline" href="http://localhost:8090/register?step=2&identity=enterprise">创建企业主体</a></div>
              </div>
            ) : (
              <div className="merchant-list">
                {summary.merchants.map((merchant) => (
                  <div className="merchant-row" key={merchant.bindingId}>
                    <div><strong>{merchant.merchantName}</strong><span>{merchant.memberType === 'personal' ? '个人主体' : '企业主体'} · {merchant.roleInMerchant}</span></div>
                    <span className={`account-status ${tone(merchant.verifyStatus)}`}>{statusText(merchant.verifyStatus)}</span>
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
        </div>
      )}
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
