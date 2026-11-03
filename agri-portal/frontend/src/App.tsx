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
import { InfoHome } from './pages/info/InfoHome'
import { InfoNewsDetail } from './pages/info/InfoNews'
import { InfoMarket } from './pages/info/InfoMarket'
import { InfoSupplyDemand } from './pages/info/InfoSupplyDemand'
import { InfoService, type InfoTab } from './pages/info/InfoService'
import { InfoSearch } from './pages/info/InfoSearch'
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
  } else if (route.path === '/account' || route.path.startsWith('/account/')) {
    const tab = route.path.startsWith('/account/')
      ? route.path.slice('/account/'.length)
      : route.query.get('tab')
    page = <AccountCenter initialTab={tab} />
  } else if (route.path === '/info') {
    page = <InfoHome />
    active = '/info'
  } else if (route.path === '/info/news') {
    // 列表已并入资讯首页；旧地址直接回首页，避免收藏的链接失效
    page = <InfoHome />
    active = '/info'
  } else if (route.path.startsWith('/info/news/')) {
    page = <InfoNewsDetail id={Number(route.path.split('/')[3])} />
    active = '/info'
  } else if (route.path === '/info/market') {
    page = <InfoMarket />
    active = '/info/market'
  } else if (route.path.startsWith('/info/market/')) {
    page = <InfoMarket id={Number(route.path.split('/')[3])} />
    active = '/info/market'
  } else if (route.path === '/info/supply-demand') {
    page = <InfoSupplyDemand />
    active = '/info'
  } else if (route.path.startsWith('/info/supply-demand/')) {
    page = (
      <InfoSupplyDemand
        id={Number(route.path.split('/')[3])}
        type={route.query.get('type') ?? 'supply'}
      />
    )
    active = '/info'
  } else if (['/info/training', '/info/experts', '/info/reports', '/info/knowledge'].includes(route.path)) {
    page = <InfoService tab={route.path.slice('/info/'.length) as InfoTab} />
    active = '/info'
  } else if (route.path === '/info/search') {
    page = <InfoSearch keyword={route.query.get('keyword') ?? ''} />
    active = '/info'
  } else {
    page = <NotFound />
  }

  return <PortalLayout active={active}>{page}</PortalLayout>
}
