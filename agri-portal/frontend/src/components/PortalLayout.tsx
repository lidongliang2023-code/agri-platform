import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Icon } from './Icon'
import { PortalLoginModal } from './PortalLoginModal'
import type { PortalUser } from './PortalLoginModal'
import { go, hallUrl, productionLogin, ssoRegister, tradeUrl } from '../utils'

const CHANNELS = ['粮油产业', '果蔬产业', '畜禽产业', '茶药产业', '饲料农资', '水产产业', '预制菜', '冷链物流']

export function PortalLayout({ children, active = '/' }: { children: ReactNode; active?: string }): JSX.Element {
  const [keyword, setKeyword] = useState('')
  const [user, setUser] = useState<PortalUser | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetch('/api/v1/sso/onboarding/status', { credentials: 'include' })
      .then(async (response) => ({ ok: response.ok, body: await response.json() as {
        code?: number
        data?: { phone?: string; nickname?: string; stage?: string }
      } }))
      .then(({ ok, body }) => {
        if (cancelled || !ok || body.code !== 0 || !body.data) return
        setUser({
          nickname: body.data.nickname,
          phone: body.data.phone,
        })
      })
      .catch(() => { /* 未登录门户是正常状态 */ })
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
      setUser(null)
    }
  }

  const search = (event: FormEvent): void => {
    event.preventDefault()
    const value = keyword.trim()
    go(value ? `/chains?q=${encodeURIComponent(value)}` : '/chains')
  }

  return (
    <div className="portal-root">
      <div className="topbar">
        <div className="container">
          <span>您好，欢迎来到农产云！一站式农业产业链交易与服务平台</span>
          <span className="portal-top-actions">
            <a href={tradeUrl('/member/buyer')} target="_blank" rel="noreferrer">我是买家</a><span className="sep">·</span>
            <a href={tradeUrl('/member/seller')} target="_blank" rel="noreferrer">我是卖家</a><span className="sep">·</span>
            <a href={tradeUrl('/member/buyer')} target="_blank" rel="noreferrer">会员中心</a><span className="sep">·</span>
            {user ? (
              <span className="portal-logged-user">
                <span className="portal-user-avatar">{(user.nickname || user.username || user.phone || '用').slice(0, 1)}</span>
                <span className="portal-user-status">已登录</span>
                <b>{user.nickname || user.username || user.phone || '农产云用户'}</b>
                <button type="button" onClick={() => void logout()}>退出</button>
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
            <span className="logo"><Icon name="seed" size={20} /></span>
            <span>农产云<small>AGRI · CLOUD</small></span>
          </a>
          <nav className="main-nav">
            <a href="#/" className={active === '/' ? 'active' : ''}>首页</a>
            <a href="#/chains" className={active === '/chains' ? 'active' : ''}>产业链</a>
            <a href={hallUrl()} target="_blank" rel="noreferrer">交易大厅</a>
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
                <span className="logo"><Icon name="seed" size={20} /></span><span>农产云</span>
              </div>
              <p className="portal-footer-desc">农业产业互联网平台，连接生产、加工、流通、销售全环节。</p>
            </div>
            <div>
              <h4>关于平台</h4>
              <a href="#/certify">认证中心</a>
              <a href="#/chains">产业链频道</a>
              <a href={hallUrl()} target="_blank" rel="noreferrer">交易大厅</a>
              <a href="#/logistics">物流服务</a>
              <a href="#/finance">供应链金融</a>
              <a href={productionLogin()}>生产管理</a>
            </div>
            <div>
              <h4>买家服务</h4>
              <a href={hallUrl()} target="_blank" rel="noreferrer">采购大厅</a>
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
            <span>© 2026 农业产业互联网平台 · 农产云官网门户</span>
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
        }}
      />
    </div>
  )
}
