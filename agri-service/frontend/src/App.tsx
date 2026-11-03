import { useEffect, useMemo, useState } from 'react'
import { App as AntApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { AppContext, parseRoute, type RouteState } from './app-context'
import { AppShell } from './components/AppShell'
import { HomePage } from './pages/Home'
import { ServicesPage } from './pages/ServicesPage'
import { ProviderPage } from './pages/ProviderPage'
import { OrdersPage } from './pages/OrdersPage'
import { OrderDetailPage } from './pages/OrderDetailPage'
import { DemandPage } from './pages/DemandPage'
import { InsurancePage } from './pages/InsurancePage'
import { PoliciesPage } from './pages/PoliciesPage'
import { TrainingPage } from './pages/TrainingPage'
import { ConsultPage } from './pages/ConsultPage'
import { AiDiagnosePage } from './pages/AiDiagnosePage'
import { ResourcesPage } from './pages/ResourcesPage'
import { MessagesPage } from './pages/MessagesPage'
import { JoinPage } from './pages/JoinPage'
import { ContractsPage } from './pages/ContractsPage'
import { ComplaintsPage } from './pages/ComplaintsPage'
import type { PageKey } from './types'
import './styles.css'

function resolvePage(route: RouteState): JSX.Element {
  switch (route.page) {
    case 'services': return <ServicesPage />
    case 'provider': return <ProviderPage />
    case 'orders': return <OrdersPage />
    case 'order-detail': return <OrderDetailPage />
    case 'demand': return <DemandPage />
    case 'insurance': return <InsurancePage />
    case 'policies': return <PoliciesPage />
    case 'training': return <TrainingPage />
    case 'consult': return <ConsultPage />
    case 'ai-diagnose': return <AiDiagnosePage />
    case 'resources': return <ResourcesPage />
    case 'messages': return <MessagesPage />
    case 'join': return <JoinPage />
    case 'contracts': return <ContractsPage />
    case 'complaints': return <ComplaintsPage />
    default: return <HomePage />
  }
}

export default function App(): JSX.Element {
  const [route, setRoute] = useState<RouteState>(() => parseRoute(window.location.hash))

  useEffect(() => {
    const handleHashChange = (): void => {
      setRoute(parseRoute(window.location.hash))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const contextValue = useMemo(() => {
    const navigate = (page: PageKey, id?: number, query?: Record<string, string>): void => {
      const params = new URLSearchParams(query)
      const suffix = params.size ? `?${params.toString()}` : ''
      window.location.hash = `/${page}${id === undefined ? '' : `/${id}`}${suffix}`
    }
    const openServices = (keyword?: string, category?: string): void => {
      const query: Record<string, string> = {}
      if (keyword) query.q = keyword
      if (category) query.category = category
      navigate('services', undefined, query)
    }
    return { ...route, navigate, openServices }
  }, [route])

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#12764a',
          colorLink: '#12764a',
          colorLinkHover: '#159a5e',
          colorSuccess: '#159a5e',
          colorWarning: '#d88718',
          colorError: '#c94b4b',
          colorText: '#0b1a12',
          colorTextSecondary: '#6b7c72',
          colorBorder: '#e1e9e3',
          colorBorderSecondary: '#edf2ee',
          colorBgLayout: '#f4f7f5',
          colorBgContainer: '#ffffff',
          borderRadius: 10,
          controlHeight: 36,
          fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
          boxShadowSecondary: '0 12px 38px rgba(17, 62, 41, .1)',
        },
        components: {
          Button: {
            borderRadius: 8,
            primaryShadow: '0 6px 16px rgba(18, 118, 74, .18)',
            fontWeight: 600,
          },
          Input: {
            activeBorderColor: '#159a5e',
            hoverBorderColor: '#75c596',
          },
          Select: {
            optionSelectedBg: '#e8f6ee',
          },
          Modal: {
            borderRadiusLG: 14,
            titleFontSize: 18,
          },
        },
      }}
    >
      <AntApp>
        <AppContext.Provider value={contextValue}>
          <AppShell>{resolvePage(route)}</AppShell>
        </AppContext.Provider>
      </AntApp>
    </ConfigProvider>
  )
}
