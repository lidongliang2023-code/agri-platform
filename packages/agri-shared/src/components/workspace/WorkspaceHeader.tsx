import { Fragment, type ReactNode } from 'react'
import {
  normalizeBreadcrumbItems,
  resolveSidebarToggleState,
  type WorkspaceBreadcrumbInput,
} from './workspaceHeaderUtils'
import './WorkspaceHeader.css'

export interface WorkspaceHeaderProps {
  /** 桌面态下左侧导航是否已折叠 */
  collapsed?: boolean
  /** 点击顶部栏最左侧的折叠/展开按钮时触发 */
  onToggleCollapse?: () => void
  /** 是否显示左侧折叠按钮（传入 onToggleCollapse 时默认显示） */
  showCollapseToggle?: boolean
  /** 是否处于移动端窄屏模式 */
  mobile?: boolean
  /** 移动端导航抽屉是否已展开 */
  mobileOpen?: boolean
  /** 面包屑路径列表（传入 left 时可省略） */
  breadcrumbs?: ReadonlyArray<WorkspaceBreadcrumbInput>
  /** 自定义左侧内容（紧跟在折叠按钮右侧，传入时替代默认 breadcrumbs） */
  left?: ReactNode
  /** 中间区域（如全局搜索、经营主体/农场选择器） */
  center?: ReactNode
  /** 右侧操作区（快捷入口、消息通知、用户菜单等） */
  right?: ReactNode
  /** 兼容保留各端原有 header 类名 */
  className?: string
  leftClassName?: string
  centerClassName?: string
  rightClassName?: string
  toggleButtonClassName?: string
}

function SidebarToggleIcon({ icon }: { icon: 'fold' | 'unfold' }): JSX.Element {
  return icon === 'fold' ? (
    <svg
      className="agri-sidebar-toggle-icon"
      viewBox="0 0 1024 1024"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M408 442h480c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8H408c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8zm-8 204c0 4.4 3.6 8 8 8h480c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8H408c-4.4 0-8 3.6-8 8v56zm504-486H120c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8h784c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8zm0 632H120c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8h784c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8zM115.4 518.9L271.7 642c5.8 4.6 14.4.5 14.4-6.9V388.9c0-7.4-8.5-11.5-14.4-6.9L115.4 505.1a8.74 8.74 0 0 0 0 13.8z" />
    </svg>
  ) : (
    <svg
      className="agri-sidebar-toggle-icon"
      viewBox="0 0 1024 1024"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M408 442h480c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8H408c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8zm-8 204c0 4.4 3.6 8 8 8h480c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8H408c-4.4 0-8 3.6-8 8v56zm504-486H120c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8h784c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8zm0 632H120c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8h784c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8zM142.4 642.1L298.7 519a8.84 8.84 0 0 0 0-13.9L142.4 381.9c-5.8-4.6-14.4-.5-14.4 6.9v246.3a8.9 8.9 0 0 0 14.4 7z" />
    </svg>
  )
}

/**
 * 跨子系统统一顶部栏（React 版）：
 * 左侧固定放侧栏折叠/展开按钮 + 面包屑；中间按需放搜索/上下文；右侧放通知与用户区。
 */
export default function WorkspaceHeader({
  collapsed = false,
  onToggleCollapse,
  showCollapseToggle = Boolean(onToggleCollapse),
  mobile = false,
  mobileOpen = false,
  breadcrumbs,
  left,
  center,
  right,
  className = '',
  leftClassName = '',
  centerClassName = '',
  rightClassName = '',
  toggleButtonClassName = '',
}: WorkspaceHeaderProps): JSX.Element {
  const toggleState = resolveSidebarToggleState({ collapsed, mobile, mobileOpen })
  const normalizedBreadcrumbs = normalizeBreadcrumbItems(breadcrumbs)

  return (
    <header className={`agri-workspace-header ${className}`.trim()}>
      <div className={`agri-workspace-header-left ${leftClassName}`.trim()}>
        {showCollapseToggle && onToggleCollapse && (
          <button
            type="button"
            className={`agri-sidebar-toggle-btn ${toggleButtonClassName}`.trim()}
            aria-label={toggleState.label}
            aria-expanded={toggleState.expanded}
            title={toggleState.label}
            onClick={onToggleCollapse}
          >
            <SidebarToggleIcon icon={toggleState.icon} />
          </button>
        )}
        {left !== undefined ? (
          left
        ) : normalizedBreadcrumbs.length > 0 ? (
          <nav className="agri-workspace-header-breadcrumb" aria-label="页面路径">
            {normalizedBreadcrumbs.map((item, idx) => {
              const isLast = idx === normalizedBreadcrumbs.length - 1
              return (
                <Fragment key={`${item.label}-${idx}`}>
                  {idx > 0 && <span className="agri-workspace-header-crumb-sep" aria-hidden="true">/</span>}
                  {isLast ? (
                    <strong className="agri-workspace-header-crumb-current">{item.label}</strong>
                  ) : item.onClick ? (
                    <button
                      type="button"
                      className="agri-workspace-header-crumb-link"
                      onClick={item.onClick}
                    >
                      {item.label}
                    </button>
                  ) : item.href ? (
                    <a className="agri-workspace-header-crumb-link" href={item.href}>
                      {item.label}
                    </a>
                  ) : (
                    <span className="agri-workspace-header-crumb-text">{item.label}</span>
                  )}
                </Fragment>
              )
            })}
          </nav>
        ) : null}
      </div>

      {center !== undefined && center !== null && center !== false && (
        <div className={`agri-workspace-header-center ${centerClassName}`.trim()}>
          {center}
        </div>
      )}

      {right !== undefined && right !== null && right !== false && (
        <div className={`agri-workspace-header-right ${rightClassName}`.trim()}>
          {right}
        </div>
      )}
    </header>
  )
}
