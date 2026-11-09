import { Suspense, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { matchPath, UNSAFE_LocationContext, useLocation, useNavigate, useOutlet } from 'react-router-dom'
import { Dropdown, Modal, Tabs, Button } from 'antd'
import { DownOutlined } from '@ant-design/icons'
import { ADMIN_ROUTES, USER_ROUTES } from '@/router/routes'
import PageLoading from './PageLoading'
import './ProductionWorkspaceTabs.css'

type LocationValue = React.ContextType<typeof UNSAFE_LocationContext>
interface WorkspaceTab { key: string; label: string; content: ReactNode; location: LocationValue; form: boolean }

/** 页签保留独立路由上下文，切换菜单时保留未关闭页面的本地状态。 */
export default function ProductionWorkspaceTabs({ admin = false }: { admin?: boolean }): JSX.Element {
  const location = useLocation()
  const locationContext = useContext(UNSAFE_LocationContext)
  const navigate = useNavigate()
  const outlet = useOutlet()
  const key = location.pathname + location.search
  const routes = admin ? ADMIN_ROUTES : USER_ROUTES
  const route = routes.find(item => item.meta && matchPath({ path: item.meta.path, end: true }, location.pathname))
  const label = route?.meta?.name ?? '页面'
  const current: WorkspaceTab = { key, label, content: outlet, location: locationContext, form: /新增|新建|编辑|创建/.test(label) || /\/(create|new|edit)(\/|$)/.test(location.pathname) }
  const [tabs, setTabs] = useState<WorkspaceTab[]>([current])
  const dragSource = useRef<string | null>(null)
  const [draggingKey, setDraggingKey] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ key: string; side: 'left' | 'right' } | null>(null)
  const resetDrag = (): void => {
    dragSource.current = null
    setDraggingKey(null)
    setDropTarget(null)
  }
  const reorder = (source: string, target: string, side: 'left' | 'right'): void => {
    if (source === target) return
    setTabs(previous => {
      const sourceTab = previous.find(tab => tab.key === source)
      if (!sourceTab || !previous.some(tab => tab.key === target)) return previous
      const next = previous.filter(tab => tab.key !== source)
      const index = next.findIndex(tab => tab.key === target)
      next.splice(index + (side === 'right' ? 1 : 0), 0, sourceTab)
      return next
    })
  }
  useEffect(() => {
    setTabs(previous => previous.some(tab => tab.key === key) ? previous : [...previous, current])
    // 只在地址变化时创建快照，不用后续活动页的路由上下文覆盖旧页签。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const visibleTabs = tabs.some(tab => tab.key === key) ? tabs : [...tabs, current]
  const home = admin ? '/admin/production/dashboard' : '/production/dashboard'
  const close = (keys: string[]): void => {
    const execute = (): void => {
      const remaining = visibleTabs.filter(tab => !keys.includes(tab.key))
      if (keys.includes(key)) {
        const index = visibleTabs.findIndex(tab => tab.key === key)
        navigate(remaining[Math.min(index, remaining.length - 1)]?.key ?? home)
      }
      setTabs(remaining)
    }
    if (visibleTabs.some(tab => keys.includes(tab.key) && tab.form)) {
      Modal.confirm({ title: '关闭页面？', content: '关闭后未提交的表单内容不会保留。', okText: '关闭', cancelText: '取消', onOk: execute })
    } else execute()
  }
  return <div className="production-workspace">
    <div className="production-workspace-tabbar">
      <Tabs type="editable-card" hideAdd activeKey={key} onChange={next => navigate(next)}
        onEdit={(target, action) => { if (action === 'remove') close([String(target)]) }}
        items={visibleTabs.map((tab, index) => ({
          key: tab.key,
          label: <Dropdown trigger={['contextMenu']} menu={{
            items: [
              { key: 'current', label: '关闭当前页签', disabled: visibleTabs.length < 2 },
              { key: 'others', label: '关闭其他页签', disabled: visibleTabs.length < 2 },
              { key: 'left', label: '关闭左侧页签', disabled: index === 0 },
              { key: 'right', label: '关闭右侧页签', disabled: index === visibleTabs.length - 1 },
              { type: 'divider' },
              { key: 'all', label: '关闭全部页签' },
            ],
            onClick: ({ key: action, domEvent }) => {
              domEvent.stopPropagation()
              const targets = action === 'current' ? [tab]
                : action === 'others' ? visibleTabs.filter(item => item.key !== tab.key)
                  : action === 'left' ? visibleTabs.slice(0, index)
                    : action === 'right' ? visibleTabs.slice(index + 1)
                      : visibleTabs
              close(targets.map(item => item.key))
            },
          }}><span
            className={`production-workspace-tab-label${draggingKey === tab.key ? ' is-dragging' : ''}${dropTarget?.key === tab.key ? ` is-drop-${dropTarget.side}` : ''}`}
            draggable={visibleTabs.length > 1}
            title={`${tab.label}（拖动调整顺序，Alt + 左右方向键移动）`}
            onDragStart={event => {
              dragSource.current = tab.key
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('text/plain', tab.key)
              setDraggingKey(tab.key)
            }}
            onDragOver={event => {
              if (!dragSource.current) return
              event.preventDefault()
              event.dataTransfer.dropEffect = 'move'
              const rect = event.currentTarget.getBoundingClientRect()
              const side = event.clientX < rect.left + rect.width / 2 ? 'left' : 'right'
              setDropTarget(dragSource.current === tab.key ? null : { key: tab.key, side })
            }}
            onDragLeave={() => setDropTarget(previous => previous?.key === tab.key ? null : previous)}
            onDrop={event => {
              if (!dragSource.current) return
              event.preventDefault()
              event.stopPropagation()
              const rect = event.currentTarget.getBoundingClientRect()
              reorder(dragSource.current, tab.key, event.clientX < rect.left + rect.width / 2 ? 'left' : 'right')
              resetDrag()
            }}
            onDragEnd={resetDrag}
            onKeyDown={event => {
              if (!event.altKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return
              event.preventDefault()
              event.stopPropagation()
              const target = visibleTabs[index + (event.key === 'ArrowLeft' ? -1 : 1)]
              if (target) reorder(tab.key, target.key, event.key === 'ArrowLeft' ? 'left' : 'right')
            }}
          >{tab.label}</span></Dropdown>,
          closable: visibleTabs.length > 1,
        }))} />
      <Dropdown menu={{ items: [
        { key: 'others', label: '关闭其他页签', disabled: visibleTabs.length < 2 },
        { key: 'all', label: '关闭全部页签' },
      ], onClick: ({ key: action }) => close(visibleTabs.filter(tab => action === 'all' || tab.key !== key).map(tab => tab.key)) }}>
        <Button type="text" aria-label="页签操作" icon={<DownOutlined />} />
      </Dropdown>
    </div>
    {visibleTabs.map(tab => <div key={tab.key} hidden={tab.key !== key} className="production-workspace-pane">
      <UNSAFE_LocationContext.Provider value={tab.key === key ? locationContext : tab.location}>
        <Suspense fallback={<PageLoading />}>{tab.key === key ? outlet : tab.content}</Suspense>
      </UNSAFE_LocationContext.Provider>
    </div>)}
  </div>
}
