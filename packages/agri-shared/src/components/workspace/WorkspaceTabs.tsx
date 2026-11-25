import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Button, Dropdown, Grid, Modal, Tabs } from 'antd'
import {
  computeCloseResult,
  reorderWorkspaceTabs,
  resolveCloseTargetKeys,
  type WorkspaceTabCloseAction,
  type WorkspaceTabMeta,
} from './workspaceTabsUtils'
import './WorkspaceTabs.css'

export interface WorkspaceTabItem extends WorkspaceTabMeta {
  content?: ReactNode
}

export interface WorkspaceTabsProps<T extends WorkspaceTabItem = WorkspaceTabItem> {
  tabs: readonly T[]
  activeKey: string
  fallbackKey: string
  onSelect: (key: string) => void
  onTabsChange: (nextTabs: T[]) => void
  /** 传入后使用组件内置面板容器渲染（支持多面板保活）。 */
  renderPane?: (tab: T, isActive: boolean) => ReactNode
  /** 移动端或隐藏页签栏时的兜底渲染。 */
  renderMobile?: () => ReactNode
  /** 强制隐藏页签栏（如移动端内嵌工作区）。 */
  hideTabBar?: boolean
  className?: string
  tabBarClassName?: string
  paneClassName?: string
  /** 仅渲染顶部页签栏，由外部自行渲染内容区（保留页签顺序、右键菜单和关闭交互）。 */
  barOnly?: boolean
  /** 在页签栏内部下方追加自定义底部内容（如页脚），位于滚动面板内或下方。 */
  footer?: ReactNode
}

function ChevronDownIcon(): JSX.Element {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M2.5 4.25L6 7.75L9.5 4.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * 跨子系统通用顶部多页签工作区组件（参照生产管理用户端规范）。
 * 支持右键菜单（关闭当前/其他/左侧/右侧/全部）、拖拽排序、Alt+方向键排序与表单关闭确认。
 */
export default function WorkspaceTabs<T extends WorkspaceTabItem = WorkspaceTabItem>({
  tabs,
  activeKey,
  fallbackKey,
  onSelect,
  onTabsChange,
  renderPane,
  renderMobile,
  hideTabBar = false,
  className,
  tabBarClassName,
  paneClassName,
  barOnly = false,
  footer,
}: WorkspaceTabsProps<T>): JSX.Element {
  const breakpoint = Grid.useBreakpoint()
  const mobile = breakpoint.md === false || hideTabBar
  const dragSource = useRef<string | null>(null)
  const [draggingKey, setDraggingKey] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ key: string; side: 'left' | 'right' } | null>(null)

  const resetDrag = (): void => {
    dragSource.current = null
    setDraggingKey(null)
    setDropTarget(null)
  }

  const reorder = (source: string, target: string, side: 'left' | 'right'): void => {
    const next = reorderWorkspaceTabs(tabs, source, target, side)
    if (next.length === tabs.length && next.every((tab, idx) => tab.key === tabs[idx]?.key)) return
    onTabsChange(next)
  }

  const closeKeys = (keys: string[]): void => {
    if (keys.length === 0) return
    const execute = (): void => {
      const { remaining, nextActiveKey } = computeCloseResult(tabs, activeKey, keys, fallbackKey)
      onTabsChange(remaining)
      if (nextActiveKey && nextActiveKey !== activeKey) {
        onSelect(nextActiveKey)
      }
    }
    if (tabs.some(tab => keys.includes(tab.key) && tab.form)) {
      Modal.confirm({
        title: '关闭页面？',
        content: '关闭后未提交的表单内容不会保留。',
        okText: '关闭',
        cancelText: '取消',
        onOk: execute,
      })
    } else {
      execute()
    }
  }

  const handleMenuAction = (anchorKey: string, action: WorkspaceTabCloseAction): void => {
    closeKeys(resolveCloseTargetKeys(tabs, anchorKey, action))
  }

  const rootCls = ['agri-workspace', className].filter(Boolean).join(' ')
  const barCls = ['agri-workspace-tabbar', tabBarClassName].filter(Boolean).join(' ')
  const paneCls = ['agri-workspace-pane', paneClassName].filter(Boolean).join(' ')

  if (mobile) {
    if (barOnly) return <></>
    const activeTab = tabs.find(tab => tab.key === activeKey) ?? tabs[tabs.length - 1]
    return (
      <div className={rootCls}>
        <div className={paneCls}>
          {renderMobile ? renderMobile() : activeTab && renderPane ? renderPane(activeTab, true) : activeTab?.content}
        </div>
        {footer}
      </div>
    )
  }

  const tabBar = (
    <div className={barCls}>
      <Tabs
        type="editable-card"
        hideAdd
        activeKey={activeKey}
        onChange={onSelect}
        onEdit={(target, action) => {
          if (action === 'remove') closeKeys([String(target)])
        }}
        items={tabs.map((tab, index) => ({
          key: tab.key,
          closable: tabs.length > 1,
          label: (
            <Dropdown
              trigger={['contextMenu']}
              menu={{
                items: [
                  { key: 'current', label: '关闭当前页签', disabled: tabs.length < 2 },
                  { key: 'others', label: '关闭其他页签', disabled: tabs.length < 2 },
                  { key: 'left', label: '关闭左侧页签', disabled: index === 0 },
                  { key: 'right', label: '关闭右侧页签', disabled: index === tabs.length - 1 },
                  { type: 'divider' },
                  { key: 'all', label: '关闭全部页签' },
                ],
                onClick: ({ key: action, domEvent }) => {
                  domEvent.stopPropagation()
                  handleMenuAction(tab.key, action as WorkspaceTabCloseAction)
                },
              }}
            >
              <span
                className={`agri-workspace-tab-label${draggingKey === tab.key ? ' is-dragging' : ''}${dropTarget?.key === tab.key ? ` is-drop-${dropTarget.side}` : ''}`}
                draggable={tabs.length > 1}
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
                onDragLeave={() => setDropTarget(previous => (previous?.key === tab.key ? null : previous))}
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
                  const target = tabs[index + (event.key === 'ArrowLeft' ? -1 : 1)]
                  if (target) reorder(tab.key, target.key, event.key === 'ArrowLeft' ? 'left' : 'right')
                }}
              >
                {tab.label}
              </span>
            </Dropdown>
          ),
        }))}
      />
      <Dropdown
        menu={{
          items: [
            { key: 'others', label: '关闭其他页签', disabled: tabs.length < 2 },
            { key: 'all', label: '关闭全部页签' },
          ],
          onClick: ({ key: action }) => {
            handleMenuAction(activeKey, action as WorkspaceTabCloseAction)
          },
        }}
      >
        <Button
          type="text"
          className="agri-workspace-actions-btn"
          aria-label="页签操作"
          icon={<ChevronDownIcon />}
        />
      </Dropdown>
    </div>
  )

  if (barOnly) return tabBar

  return (
    <div className={rootCls}>
      {tabBar}
      {tabs.map(tab => {
        const isActive = tab.key === activeKey
        return (
          <div key={tab.key} hidden={!isActive} className={paneCls}>
            {renderPane ? renderPane(tab, isActive) : tab.content}
          </div>
        )
      })}
      {footer}
    </div>
  )
}
