import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import WorkspaceTabs, { type WorkspaceTabItem } from './WorkspaceTabs'
import {
  DEFAULT_MAX_WORKSPACE_TABS,
  isFormWorkspaceTab,
  parseStoredWorkspaceTabs,
  upsertWorkspaceTab,
  type RouteWorkspaceTabMeta,
} from './workspaceTabsUtils'
import './WorkspaceTabs.css'

type RouteTab = WorkspaceTabItem & RouteWorkspaceTabMeta

export interface RouteWorkspaceTabsProps {
  /** 当前页签唯一键：通常是页面键，详情页再拼上记录 id（如 `user-detail/123`）。 */
  activeKey: string
  /** 当前页签标题。 */
  activeLabel: string
  /** 当前完整跳转路径（含查询参数）；切回该页签时原样传给 onNavigate。缺省等于 activeKey。 */
  activePath?: string
  /** 首页页签键：全部关闭后回落到这里，且不会被数量上限淘汰。 */
  homeKey: string
  homeLabel: string
  homePath?: string
  /** 切换页签时跳转到对应路径（由各子系统按自己的路由方式实现）。 */
  onNavigate: (path: string) => void
  /** 会话存储键：刷新页面后恢复已打开的页签；不传则不持久化。 */
  storageKey?: string
  /** 最多同时打开的页签数，默认 12。 */
  maxTabs?: number
  className?: string
}

function readStoredTabs(storageKey?: string): RouteTab[] {
  if (!storageKey || typeof window === 'undefined') return []
  try {
    return parseStoredWorkspaceTabs(window.sessionStorage.getItem(storageKey))
  } catch {
    return []
  }
}

/**
 * 路由型顶部多页签导航栏（参照生产管理用户端规范，紧贴顶栏下方、无空隙）。
 *
 * 适用于「左侧菜单 + 顶栏 + 单页内容」的子系统：左侧菜单或页内跳转改变路由后，
 * 自动把当前页面加入页签栏；点击页签回到对应路由，右键与下拉菜单支持批量关闭，
 * 拖拽或 Alt + 方向键调整顺序。页面内容仍由各子系统按当前路由渲染。
 */
export default function RouteWorkspaceTabs({
  activeKey,
  activeLabel,
  activePath,
  homeKey,
  homeLabel,
  homePath,
  onNavigate,
  storageKey,
  maxTabs = DEFAULT_MAX_WORKSPACE_TABS,
  className,
}: RouteWorkspaceTabsProps): JSX.Element {
  const currentPath = activePath || activeKey
  const makeTab = useCallback(
    (key: string, label: string, path: string): RouteTab => ({
      key,
      label,
      path,
      form: isFormWorkspaceTab(`/${path}`, label),
    }),
    [],
  )
  const homeTab = makeTab(homeKey, homeLabel, homePath || homeKey)

  const [tabs, setTabs] = useState<RouteTab[]>(() => {
    const stored = readStoredTabs(storageKey)
    return upsertWorkspaceTab(stored, makeTab(activeKey, activeLabel, currentPath), maxTabs, [homeKey])
  })

  useEffect(() => {
    setTabs(previous =>
      upsertWorkspaceTab(previous, makeTab(activeKey, activeLabel, currentPath), maxTabs, [homeKey]),
    )
  }, [activeKey, activeLabel, currentPath, homeKey, makeTab, maxTabs])

  useEffect(() => {
    if (!storageKey) return
    try {
      window.sessionStorage.setItem(
        storageKey,
        JSON.stringify(tabs.map(({ key, label, path, form }) => ({ key, label, path, form }))),
      )
    } catch {
      /* 存储空间不足或隐私模式时忽略，不影响页签使用 */
    }
  }, [storageKey, tabs])

  // 紧贴上方顶栏：实时读取前一个兄弟元素（顶栏）的高度作为粘性偏移。
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [stickyTop, setStickyTop] = useState(0)
  useLayoutEffect(() => {
    const header = wrapperRef.current?.previousElementSibling
    if (!(header instanceof HTMLElement)) return
    const sync = (): void => {
      const position = window.getComputedStyle(header).position
      setStickyTop(position === 'sticky' || position === 'fixed' ? header.offsetHeight : 0)
    }
    sync()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(sync)
    observer.observe(header)
    return () => observer.disconnect()
  }, [])

  const handleSelect = (key: string): void => {
    const target = tabs.find(tab => tab.key === key)
    onNavigate(target?.path || (key === homeKey ? homeTab.path : key))
  }

  const handleTabsChange = (next: RouteTab[]): void => {
    setTabs(next.length ? next : [homeTab])
  }

  return (
    <div
      ref={wrapperRef}
      className={['agri-route-workspace', className].filter(Boolean).join(' ')}
      style={{ top: stickyTop }}
    >
      <WorkspaceTabs<RouteTab>
        barOnly
        tabs={tabs}
        activeKey={activeKey}
        fallbackKey={homeKey}
        onSelect={handleSelect}
        onTabsChange={handleTabsChange}
      />
    </div>
  )
}
