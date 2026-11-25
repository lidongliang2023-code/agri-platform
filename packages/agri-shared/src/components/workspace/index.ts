export { default as WorkspaceHeader, type WorkspaceHeaderProps } from './WorkspaceHeader'
export {
  normalizeBreadcrumbItems,
  readSidebarCollapsed,
  resolveSidebarToggleState,
  writeSidebarCollapsed,
  type SidebarToggleState,
  type SidebarToggleStateInput,
  type WorkspaceBreadcrumbInput,
  type WorkspaceBreadcrumbItem,
} from './workspaceHeaderUtils'
export { default as WorkspaceTabs, type WorkspaceTabItem, type WorkspaceTabsProps } from './WorkspaceTabs'
export { default as RouteWorkspaceTabs, type RouteWorkspaceTabsProps } from './RouteWorkspaceTabs'
export {
  isFormWorkspaceTab,
  reorderWorkspaceTabs,
  resolveCloseTargetKeys,
  computeCloseResult,
  upsertWorkspaceTab,
  parseStoredWorkspaceTabs,
  DEFAULT_MAX_WORKSPACE_TABS,
  type RouteWorkspaceTabMeta,
  type WorkspaceTabCloseAction,
  type WorkspaceTabMeta,
} from './workspaceTabsUtils'
