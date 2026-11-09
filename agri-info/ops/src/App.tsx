import { GreenSupplyOpsPage } from './pages/GreenSupplyOpsPage'
import { CloudFactoriesPage } from './pages/CloudFactoriesPage'
import { useEffect, useMemo, useState } from 'react'
import { App as AntApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { AppContext, parseRoute, type RouteState } from './app-context'
import { AppShell } from './components/AppShell'
import { DashboardPage } from './pages/DashboardPage'
import { ContentsPage } from './pages/ContentsPage'
import { ChannelsPage } from './pages/ChannelsPage'
import { CoursesPage } from './pages/CoursesPage'
import { QuotesPage } from './pages/QuotesPage'
import { SupplyDemandsPage } from './pages/SupplyDemandsPage'
import { RecommendPage } from './pages/RecommendPage'
import { AiPage } from './pages/AiPage'
import { ReportsPage } from './pages/ReportsPage'
import { ExpertsPage } from './pages/ExpertsPage'
import { AttestationsPage } from './pages/AttestationsPage'
import { StatsPage } from './pages/StatsPage'
import { AuditLogsPage } from './pages/AuditLogsPage'
import type { OpsPageKey } from './types'
import './styles.css'

function resolvePage(route: RouteState): JSX.Element {
  switch (route.page) {
    case 'green-supply': return <GreenSupplyOpsPage />
    case 'cloud-factories': return <CloudFactoriesPage />
    case 'contents': return <ContentsPage />
    case 'channels': return <ChannelsPage />
    case 'courses': return <CoursesPage />
    case 'quotes': return <QuotesPage />
    case 'supply-demands': return <SupplyDemandsPage />
    case 'recommend': return <RecommendPage />
    case 'ai': return <AiPage />
    case 'reports': return <ReportsPage />
    case 'experts': return <ExpertsPage />
    case 'attestations': return <AttestationsPage />
    case 'stats': return <StatsPage />
    case 'audit-logs': return <AuditLogsPage />
    default: return <DashboardPage />
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
    const navigate = (page: OpsPageKey, id?: number, query?: Record<string, string>): void => {
      const params = new URLSearchParams(query)
      const suffix = params.size ? `?${params.toString()}` : ''
      window.location.hash = `/${page}${id === undefined ? '' : `/${id}`}${suffix}`
    }
    return { ...route, navigate }
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
          Button: { borderRadius: 8, primaryShadow: '0 6px 16px rgba(18, 118, 74, .18)', fontWeight: 600 },
          Input: { activeBorderColor: '#159a5e', hoverBorderColor: '#75c596' },
          Select: { optionSelectedBg: '#e8f6ee' },
          Modal: { borderRadiusLG: 14, titleFontSize: 18 },
          Table: { headerBg: '#f6faf7', headerColor: '#53665a', borderColor: '#e7eee9', rowHoverBg: '#f3fbf6' },
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
