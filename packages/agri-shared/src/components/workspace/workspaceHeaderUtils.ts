export interface WorkspaceBreadcrumbItem {
  label: string
  href?: string
  onClick?: () => void
}

export type WorkspaceBreadcrumbInput = string | WorkspaceBreadcrumbItem | null | undefined

export interface SidebarToggleStateInput {
  collapsed?: boolean
  mobile?: boolean
  mobileOpen?: boolean
}

export interface SidebarToggleState {
  icon: 'fold' | 'unfold'
  label: string
  expanded: boolean
}

/** 统一计算顶部栏左侧折叠/展开按钮的图标方向、无障碍文案与展开态。 */
export function resolveSidebarToggleState({
  collapsed = false,
  mobile = false,
  mobileOpen = false,
}: SidebarToggleStateInput): SidebarToggleState {
  if (mobile) {
    return {
      icon: mobileOpen ? 'fold' : 'unfold',
      label: mobileOpen ? '关闭导航菜单' : '打开导航菜单',
      expanded: Boolean(mobileOpen),
    }
  }
  return {
    icon: collapsed ? 'unfold' : 'fold',
    label: collapsed ? '展开侧边栏' : '收起侧边栏',
    expanded: !collapsed,
  }
}

/** 归一化面包屑列表：过滤空项并将纯字符串转为标准对象。 */
export function normalizeBreadcrumbItems(
  items?: ReadonlyArray<WorkspaceBreadcrumbInput>,
): WorkspaceBreadcrumbItem[] {
  if (!items || items.length === 0) return []
  const result: WorkspaceBreadcrumbItem[] = []
  for (const item of items) {
    if (!item) continue
    if (typeof item === 'string') {
      const trimmed = item.trim()
      if (trimmed) result.push({ label: trimmed })
      continue
    }
    const trimmed = item.label.trim()
    if (trimmed) {
      result.push({
        label: trimmed,
        href: item.href,
        onClick: item.onClick,
      })
    }
  }
  return result
}

/** 安全读取本地持久化的侧栏折叠状态。 */
export function readSidebarCollapsed(storageKey: string, fallback: boolean): boolean {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (raw === '1' || raw === 'true') return true
    if (raw === '0' || raw === 'false') return false
    return fallback
  } catch {
    return fallback
  }
}

/** 安全写入本地持久化的侧栏折叠状态。 */
export function writeSidebarCollapsed(storageKey: string, collapsed: boolean): void {
  try {
    window.localStorage.setItem(storageKey, collapsed ? '1' : '0')
  } catch {
    // 存储受限时忽略，不阻断侧栏切换。
  }
}
