import { useEffect, useMemo, useState } from 'react'
import { App as AntApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { AppContext, parseRoute, type RouteState } from './app-context'
import { AppShell } from './components/AppShell'
import { HomePage } from './pages/Home'
import { MarketPage } from './pages/MarketPage'
import { MarketDetailPage } from './pages/MarketDetailPage'
import { ComparePage } from './pages/ComparePage'
import { IndicesPage } from './pages/IndicesPage'
import { ForecastPage } from './pages/ForecastPage'
import { NewsPage } from './pages/NewsPage'
import { NewsDetailPage } from './pages/NewsDetailPage'
import { SearchPage } from './pages/SearchPage'
import { SupplyDemandPage } from './pages/SupplyDemandPage'
import { SupplyDemandDetailPage } from './pages/SupplyDemandDetailPage'
import { SupplyDemandPublishPage } from './pages/SupplyDemandPublishPage'
import { MatchPage } from './pages/MatchPage'
import { AiQaPage } from './pages/AiQaPage'
import { PestPage } from './pages/PestPage'
import { ExpertPage } from './pages/ExpertPage'
import { TrainingPage } from './pages/TrainingPage'
import { KnowledgePage } from './pages/KnowledgePage'
import { ReportsPage } from './pages/ReportsPage'
import { AttestPage } from './pages/AttestPage'
import { AlertsPage } from './pages/AlertsPage'
import { FavoritesPage } from './pages/FavoritesPage'
import { ExpertCertPage } from './pages/ExpertCertPage'
import type { PageKey } from './types'
import './styles.css'

function resolvePage(route: RouteState): JSX.Element {
  switch (route.page) {
    case 'market': return <MarketPage />
    case 'market-detail': return <MarketDetailPage />
    case 'compare': return <ComparePage />
    case 'indices': return <IndicesPage />
    case 'forecast': return <ForecastPage />
    case 'news': return <NewsPage />
    case 'news-detail': return <NewsDetailPage />
    case 'search': return <SearchPage />
    case 'sd': return <SupplyDemandPage />
    case 'sd-detail': return <SupplyDemandDetailPage />
    case 'sd-publish': return <SupplyDemandPublishPage />
    case 'sd-match': return <MatchPage />
    case 'ai-qa': return <AiQaPage />
    case 'pest': return <PestPage />
    case 'expert': return <ExpertPage />
    case 'training': return <TrainingPage />
    case 'knowledge': return <KnowledgePage />
    case 'reports': return <ReportsPage />
    case 'attest': return <AttestPage />
    case 'alerts': return <AlertsPage />
    case 'favorites': return <FavoritesPage />
    case 'expert-cert': return <ExpertCertPage />
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
    return {
      ...route,
      navigate,
      openSearch: (keyword: string): void => navigate('search', undefined, keyword ? { q: keyword } : undefined),
      openMarket: (id: number): void => navigate('market-detail', id),
    }
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
          Table: {
            headerBg: '#f6faf7',
            headerColor: '#53665a',
            borderColor: '#e7eee9',
            rowHoverBg: '#f3fbf6',
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
