import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { BellOutlined, LogoutOutlined, ShopOutlined, SwapOutlined } from '@ant-design/icons'
import { clearSession } from '@/utils/session'
import { ssoLogoutUrl } from '@/utils/sso'
import { BrandMark } from '@/components/BrandMark'
import './member-center.css'

export interface MemberNavItem {
  key: string
  label: string
  icon: ReactNode
}

interface Props {
  role: 'buyer' | 'seller'
  active: string
  navItems: MemberNavItem[]
  merchantName: string
  onNavigate: (key: string) => void
  children: ReactNode
}

const ROLE_TEXT = { buyer: '买家中心', seller: '卖家中心' }
const PERSONAL_CENTER = `${window.location.protocol}//${window.location.hostname}:8098/portal/#/account?tab=business`

export function MemberCenterShell({ role, active, navItems, merchantName, onNavigate, children }: Props): JSX.Element {
  const navigate = useNavigate()
  const activeLabel = navItems.find((item) => item.key === active)?.label ?? '首页概览'
  const avatar = (merchantName || (role === 'buyer' ? '买' : '卖')).slice(0, 1)

  const logout = (): void => {
    clearSession()
    window.location.href = ssoLogoutUrl('portal')
  }

  return (
    <div className="mc-shell">
      <aside className="mc-side">
        <a className="mc-brand" href="/">
          <span className="mc-brand-logo"><BrandMark size={34} /></span>
          <span>丰链云<small>FENGCHAIN · AGRI</small></span>
        </a>
        <div className="mc-side-group">{ROLE_TEXT[role]}</div>
        <nav className="mc-side-nav">
          {navItems.map((item) => (
            <button
              type="button"
              key={item.key}
              className={item.key === active ? 'on' : ''}
              onClick={() => onNavigate(item.key)}
            >
              {item.icon}<span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="mc-side-group">常用入口</div>
        <nav className="mc-side-nav">
          <a href={role === 'buyer' ? '/demand/create' : '/product/create'}>
            <span className="mc-nav-icon"><SwapOutlined /></span>
            <span>{role === 'buyer' ? '发布采购需求' : '发布供应'}</span>
          </a>
          <a href="/hall">
            <span className="mc-nav-icon"><ShopOutlined /></span>
            <span>交易大厅</span>
          </a>
          <a href={PERSONAL_CENTER} target="_blank" rel="noreferrer">
            <span className="mc-nav-icon"><SwapOutlined /></span>
            <span>个人中心</span>
          </a>
        </nav>
        <div className="mc-side-foot">
          <button type="button" className="mc-logout" onClick={logout}>
            <LogoutOutlined />退出登录
          </button>
          <span>丰链云 · 会员中心</span>
        </div>
      </aside>

      <div className="mc-main">
        <header className="mc-top">
          <div className="mc-crumb">
            <a href={role === 'buyer' ? '/member/buyer' : '/member/seller'}>{ROLE_TEXT[role]}</a>
            <span>/</span>
            <strong>{activeLabel}</strong>
          </div>
          <div className="mc-top-right">
            <div className="mc-role-switch">
              <a className={role === 'buyer' ? 'on' : ''} href="/member/buyer">买家中心</a>
              <a className={role === 'seller' ? 'on' : ''} href="/member/seller">卖家中心</a>
            </div>
            <span className="mc-avatar">{avatar}</span>
            <span className="mc-merchant-name">{merchantName || '尚未绑定经营主体'}</span>
            <button type="button" className="mc-icon-btn" title="消息通知（待接入）" onClick={() => navigate('/')}>
              <BellOutlined />
            </button>
          </div>
        </header>
        <div className="mc-body">{children}</div>
        <footer className="mc-foot">© 2026 农业产业互联网平台 · 交易撮合会员中心</footer>
      </div>
    </div>
  )
}
