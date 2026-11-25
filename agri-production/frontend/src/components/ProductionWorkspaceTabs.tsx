import { Suspense, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { matchPath, UNSAFE_LocationContext, useLocation, useNavigate, useOutlet } from 'react-router-dom'
import { WorkspaceTabs, isFormWorkspaceTab, type WorkspaceTabItem } from '@agri/shared'
import { ADMIN_ROUTES, USER_ROUTES } from '@/router/routes'
import PageLoading from './PageLoading'
import { mobileWorkspace } from '@/utils/mobile-workspace'
import './ProductionWorkspaceTabs.css'

type LocationValue = React.ContextType<typeof UNSAFE_LocationContext>
interface ProductionTab extends WorkspaceTabItem {
  content: ReactNode
  location: LocationValue
}

/** 页签保留独立路由上下文，切换菜单时保留未关闭页面的本地状态。 */
export default function ProductionWorkspaceTabs({ admin = false }: { admin?: boolean }): JSX.Element {
  const embeddedMobile = mobileWorkspace()
  const location = useLocation()
  const locationContext = useContext(UNSAFE_LocationContext)
  const navigate = useNavigate()
  const outlet = useOutlet()
  const key = location.pathname + location.search
  const routes = admin ? ADMIN_ROUTES : USER_ROUTES
  const route = routes.find(item => item.meta && matchPath({ path: item.meta.path, end: true }, location.pathname))
  const label = route?.meta?.name ?? '页面'
  const current: ProductionTab = {
    key,
    label,
    content: outlet,
    location: locationContext,
    form: isFormWorkspaceTab(location.pathname, label),
  }
  const [tabs, setTabs] = useState<ProductionTab[]>([current])

  useEffect(() => {
    setTabs(previous => (previous.some(tab => tab.key === key) ? previous : [...previous, current]))
    // 只在地址变化时创建快照，不用后续活动页的路由上下文覆盖旧页签。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const visibleTabs = tabs.some(tab => tab.key === key) ? tabs : [...tabs, current]
  const home = admin ? '/admin/production/dashboard' : '/production/dashboard'

  return (
    <WorkspaceTabs<ProductionTab>
      tabs={visibleTabs}
      activeKey={key}
      fallbackKey={home}
      hideTabBar={embeddedMobile}
      onSelect={next => navigate(next)}
      onTabsChange={setTabs}
      className="production-workspace"
      tabBarClassName="production-workspace-tabbar"
      paneClassName="production-workspace-pane"
      renderMobile={() => <Suspense fallback={<PageLoading />}>{outlet}</Suspense>}
      renderPane={(tab, isActive) => (
        <UNSAFE_LocationContext.Provider value={isActive ? locationContext : tab.location}>
          <Suspense fallback={<PageLoading />}>{isActive ? outlet : tab.content}</Suspense>
        </UNSAFE_LocationContext.Provider>
      )}
    />
  )
}
