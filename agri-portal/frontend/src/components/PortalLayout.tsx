import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Icon } from './Icon'
import { PortalLoginModal } from './PortalLoginModal'
import type { PortalUser } from './PortalLoginModal'
import { BrandMark } from './BrandMark'
import { go, productionLogin, ssoRegister, tradeUrl } from '../utils'
import { clearPlatformAccessToken } from '../utils/platformToken'

const CHANNELS = ['粮油产业', '果蔬产业', '畜禽产业', '茶药产业', '饲料农资', '水产产业', '预制菜', '冷链物流']

export function PortalLayout({ children, active = '/' }: { children: ReactNode; active?: string }): JSX.Element {
  const [keyword, setKeyword] = useState('')
  const [user, setUser] = useState<PortalUser | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)

  async function sessionUser(): Promise<PortalUser | null> {
    try {
      const response = await fetch('/api/v1/sso/onboarding/status', { credentials: 'include' })
      const body = await response.json() as {
        code?: number
        data?: {
          phone?: string
          nickname?: string
          stage?: string
          identity?: string
          subjectName?: string
          certificationStatus?: string
        }
      }
      if (!response.ok || body.code !== 0 || !body.data) return null
      return {
        nickname: body.data.nickname,
        phone: body.data.phone,
        stage: body.data.stage,
        identity: body.data.identity,
        subjectName: body.data.subjectName,
        certificationStatus: body.data.certificationStatus,
      }
    } catch {
      return null
    }
  }

  useEffect(() => {
    let cancelled = false
    void sessionUser()
      .then((nextUser) => {
        if (!cancelled && nextUser) setUser(nextUser)
      })
    return () => { cancelled = true }
  }, [])

  async function logout(): Promise<void> {
    try {
      await fetch('/api/v1/sso/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
    } finally {
      clearPlatformAccessToken()
      setUser(null)
      setAccountMenuOpen(false)
    }
  }

  const registerBase = `${window.location.protocol}//${window.location.hostname}:8090/register`
  const identityEntry = (identity: 'enterprise' | 'personal'): string =>
    `${registerBase}?step=2&identity=${identity}`

  const search = (event: FormEvent): void => {
    event.preventDefault()
    const value = keyword.trim()
    go(value ? `/chains?q=${encodeURIComponent(value)}` : '/chains')
  }

  return (
    <div className="portal-root">
      <div className="topbar">
        <div className="container">
          <span>您好，欢迎来到丰链云！一站式农业产业链交易与服务平台</span>
          <span className="portal-top-actions">
            <a href={tradeUrl('/member/buyer')} target="_blank" rel="noreferrer">我是买家</a><span className="sep">·</span>
            <a href={tradeUrl('/member/seller')} target="_blank" rel="noreferrer">我是卖家</a><span className="sep">·</span>
            <a href={tradeUrl('/member/buyer')} target="_blank" rel="noreferrer">会员中心</a><span className="sep">·</span>
            {user && <><a href="#/account">个人中心</a><span className="sep">·</span></>}
            {user ? (
              <span className="portal-logged-user">
                <span className="portal-user-avatar">{(user.nickname || user.username || user.phone || '用').slice(0, 1)}</span>
                <button className="portal-user-menu-trigger" type="button" onClick={() => setAccountMenuOpen(!accountMenuOpen)}>
                  <span className="portal-user-status">已登录</span>
                  <b>{user.nickname || user.username || user.phone || '丰链云用户'}</b>
                  <i>▾</i>
                </button>
                <button className="portal-user-logout" type="button" onClick={() => void logout()}>退出</button>
                {accountMenuOpen && (
                  <div className="portal-account-menu">
                    <a href="#/account" onClick={() => setAccountMenuOpen(false)}>
                      <Icon name="user" size={15} /><span><b>个人中心</b><small>资料、安全、实名、地址与经营主体</small></span>
                    </a>
                    <div className="portal-account-head">
                      <span>主体与认证</span>
                      <small>
                        {user.stage === 'done' ? '已完成认证'
                          : user.stage === 'pending' ? '认证审核中'
                            : user.stage === 'certification' ? '待提交认证'
                              : '待创建主体'}
                      </small>
                    </div>
                    {(!user.stage || user.stage === 'subject') && (
                      <>
                        <p>请选择主体类型，完成主体注册与认证。</p>
                        <a href={identityEntry('enterprise')} onClick={(event) => { event.preventDefault(); window.location.href = identityEntry('enterprise') }}>
                          <Icon name="factory" size={15} /><span><b>企业主体</b><small>企业、合作社、加工厂、贸易商</small></span>
                        </a>
                        <a href={identityEntry('personal')} onClick={(event) => { event.preventDefault(); window.location.href = identityEntry('personal') }}>
                          <Icon name="user" size={15} /><span><b>个人主体</b><small>家庭农场、个体户、经纪人</small></span>
                        </a>
                      </>
                    )}
                    {user.stage === 'certification' && (
                      <a href={`${registerBase}?step=3`}>
                        <Icon name="shield" size={15} /><span><b>继续提交认证</b><small>主体已创建，等待认证开通</small></span>
                      </a>
                    )}
                    {user.stage === 'pending' && (
                      <a href={`${registerBase}?step=3`}>
                        <Icon name="activity" size={15} /><span><b>查看认证进度</b><small>资料已提交，平台审核中</small></span>
                      </a>
                    )}
                    {user.stage === 'done' && (
                      <div className="portal-account-done">
                        <Icon name="check" size={16} />
                        <span><b>{user.identity === 'personal' ? '个人主体' : '企业主体'}已认证</b><small>{user.subjectName || '认证状态已生效'}</small></span>
                      </div>
                    )}
                  </div>
                )}
              </span>
            ) : (
              <button className="portal-login-trigger" type="button" onClick={() => setLoginOpen(true)}>
                <Icon name="user" size={12} />登录
              </button>
            )}
            {!user && (
              <>
                <span className="sep">·</span>
                <a href={ssoRegister()}><Icon name="plus" size={12} />免费注册</a>
              </>
            )}
          </span>
        </div>
      </div>

      <header className="site-header">
        <div className="container">
          <a className="brand" href="#/">
            <span className="logo"><BrandMark size={36} /></span>
            <span>丰链云<small>FENGCHAIN · AGRI</small></span>
          </a>
          <nav className="main-nav">
            <a href="#/" className={active === '/' ? 'active' : ''}>首页</a>
            <a href="#/chains" className={active === '/chains' ? 'active' : ''}>产业链</a>
            <a href="#/hall" className={active === '/hall' ? 'active' : ''}>交易大厅</a>
            <a href="#/?scroll=price">价格指数</a>
            <a href="#/?scroll=news">产业资讯</a>
            <a href="#/finance" className={active === '/finance' ? 'active' : ''}>供应链金融</a>
            <a href="#/logistics" className={active === '/logistics' ? 'active' : ''}>物流服务</a>
          </nav>
          <form className="header-search" onSubmit={search}>
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索商品 / 供应商 / 需求"
              aria-label="搜索商品、供应商或需求"
            />
            <button type="submit">搜索</button>
          </form>
        </div>
      </header>

      <div className="portal-channelbar">
        <div className="container">
          <a className="tag portal-all-channel" href="#/chains"><Icon name="layers" size={14} />全部频道</a>
          {CHANNELS.map((channel) => (
            <a className="chip" key={channel} href={`#/chains?l1=${encodeURIComponent(channel)}`}>{channel}</a>
          ))}
        </div>
      </div>

      <main>{children}</main>

      <footer className="site-footer">
        <div className="container">
          <div className="grid portal-footer-grid">
            <div>
              <div className="brand portal-footer-brand">
                <span className="logo"><BrandMark size={36} /></span><span>丰链云</span>
              </div>
              <p className="portal-footer-desc">农业产业互联网平台，连接生产、加工、流通、销售全环节。</p>
            </div>
            <div>
              <h4>关于平台</h4>
              <a href="#/certify">认证中心</a>
              <a href="#/chains">产业链频道</a>
              <a href="#/hall">交易大厅</a>
              <a href="#/logistics">物流服务</a>
              <a href="#/finance">供应链金融</a>
              <a href={productionLogin()}>生产管理</a>
            </div>
            <div>
              <h4>买家服务</h4>
              <a href="#/hall">采购大厅</a>
              <a href={tradeUrl('/demand/create')} target="_blank" rel="noreferrer">发布询价</a>
              <a href={tradeUrl('/member/buyer?tab=purchase')} target="_blank" rel="noreferrer">订单管理</a>
              <a href={tradeUrl('/member/buyer?tab=fund')} target="_blank" rel="noreferrer">资金管理</a>
            </div>
            <div>
              <h4>卖家服务</h4>
              <a href={tradeUrl('/product/create')} target="_blank" rel="noreferrer">发布供应</a>
              <a href={tradeUrl('/member/seller?tab=profile')} target="_blank" rel="noreferrer">店铺管理</a>
              <a href={productionLogin()}>物联网接入</a>
              <a href="#/certify/enterprise">企业认证</a>
            </div>
          </div>
          <div className="bottom">
            <span>© 2026 农业产业互联网平台 · 丰链云官网门户</span>
            <span>生产、交易、金融、溯源一体化服务</span>
          </div>
        </div>
      </footer>
      <PortalLoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={(nextUser) => {
          setUser(nextUser)
          setLoginOpen(false)
          void sessionUser().then((fresh) => {
            if (fresh) setUser(fresh)
          })
        }}
      />
    </div>
  )
}
