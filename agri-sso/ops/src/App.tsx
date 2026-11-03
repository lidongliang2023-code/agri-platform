import { useEffect, useMemo, useState } from 'react'
import { App as AntApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { AppContext, parseRoute, type RouteState } from './app-context'
import { AppShell } from './components/AppShell'
import { DashboardPage } from './pages/DashboardPage'
import { UserListPage, UserDetailPage, IdentityPage } from './pages/UsersPages'
import {
  IdentityAuditPage,
  RealnameAuditPage,
  QualificationAuditPage,
  OrgAuditPage,
} from './pages/AuditPages'
import { OrgListPage, OrgDetailPage } from './pages/OrgPages'
import { RoleListPage, PermMatrixPage } from './pages/RolePages'
import { AuthAppPage, AuthRecordPage } from './pages/AuthPages'
import { MessagePushPage, MessageTemplatePage } from './pages/MessagePages'
import { SecurityRiskPage, DeviceLogPage, AccountFreezePage } from './pages/SecurityPages'
import { PrivacyRequestPage, FeedbackPage } from './pages/CompliancePages'
import { StatsPage, ConfigPage, AuditLogPage } from './pages/SystemPages'
import type { OpsPageKey } from './types'
import './styles.css'

function resolvePage(route: RouteState): JSX.Element {
  switch (route.page) {
    case 'user-list': return <UserListPage />
    case 'user-detail': return <UserDetailPage id={route.id ?? ''} />
    case 'user-identity': return <IdentityPage />
    case 'identity-audit': return <IdentityAuditPage />
    case 'realname-audit': return <RealnameAuditPage />
    case 'qualification-audit': return <QualificationAuditPage />
    case 'org-list': return <OrgListPage />
    case 'org-detail': return <OrgDetailPage id={route.id ?? ''} />
    case 'org-audit': return <OrgAuditPage />
    case 'role-list': return <RoleListPage />
    case 'perm-matrix': return <PermMatrixPage code={route.query.get('code') ?? undefined} />
    case 'auth-app': return <AuthAppPage />
    case 'auth-record': return <AuthRecordPage />
    case 'message-push': return <MessagePushPage />
    case 'message-template': return <MessageTemplatePage />
    case 'security-risk': return <SecurityRiskPage />
    case 'device-log': return <DeviceLogPage />
    case 'account-freeze': return <AccountFreezePage />
    case 'privacy-request': return <PrivacyRequestPage />
    case 'feedback-manage': return <FeedbackPage />
    case 'stats': return <StatsPage />
    case 'config': return <ConfigPage />
    case 'audit-log': return <AuditLogPage />
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
    const navigate = (page: OpsPageKey, id?: string, query?: Record<string, string>): void => {
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
