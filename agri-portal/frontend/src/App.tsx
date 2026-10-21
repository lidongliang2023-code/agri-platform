import { useEffect } from 'react'
import { PortalLayout } from './components/PortalLayout'
import { Home } from './pages/Home'
import { Chains } from './pages/Chains'
import { Certify } from './pages/Certify'
import { CertifyEnterprise } from './pages/CertifyEnterprise'
import { CertifyPersonal } from './pages/CertifyPersonal'
import { Finance } from './pages/Finance'
import { Hall } from './pages/Hall'
import { Logistics } from './pages/Logistics'
import { AccountCenter } from './pages/AccountCenter'
import { useHashRoute } from './utils'

function NotFound(): JSX.Element {
  return (
    <section className="section container">
      <div className="card empty">
        <div className="strong t-xl">页面不存在</div>
        <div className="muted t-sm mt-8">请从首页或产业链频道继续浏览。</div>
        <a className="btn btn-primary mt-16" href="#/">回到首页</a>
      </div>
    </section>
  )
}

export default function App(): JSX.Element {
  const route = useHashRoute()

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [route.path])

  let page: JSX.Element
  let active = '/'
  if (route.path === '/' || route.path === '') {
    page = <Home />
  } else if (route.path === '/chains') {
    page = <Chains />
    active = '/chains'
  } else if (route.path === '/certify') {
    page = <Certify />
  } else if (route.path === '/logistics') {
    page = <Logistics />
    active = '/logistics'
  } else if (route.path === '/finance') {
    page = <Finance />
    active = '/finance'
  } else if (route.path === '/hall') {
    page = <Hall />
    active = '/hall'
  } else if (route.path === '/certify/enterprise') {
    page = <CertifyEnterprise />
  } else if (route.path === '/certify/personal') {
    page = <CertifyPersonal />
  } else if (route.path === '/account') {
    page = <AccountCenter initialTab={route.query.get('tab')} />
  } else {
    page = <NotFound />
  }

  return <PortalLayout active={active}>{page}</PortalLayout>
}
