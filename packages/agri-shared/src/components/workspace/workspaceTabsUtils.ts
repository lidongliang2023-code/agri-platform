export interface WorkspaceTabMeta {
  key: string
  label: string
  form?: boolean
}

const DEFAULT_FORM_LABEL_RE = /新增|新建|编辑|创建|发布|申请/
const DEFAULT_FORM_KEY_RE = /\/(create|new|edit|publish|apply|product-add|activity-create|loan-apply)(\/|\?|$)|[?&]tab=publish(&|$)/i

/** 识别可能包含未提交表单内容的页签，关闭前用于弹出二次确认。 */
export function isFormWorkspaceTab(key: string, label: string): boolean {
  return DEFAULT_FORM_LABEL_RE.test(label) || DEFAULT_FORM_KEY_RE.test(key)
}

/** 将源页签移动到目标页签左侧或右侧；任一页签不存在或相同则保持原序。 */
export function reorderWorkspaceTabs<T extends { key: string }>(
  tabs: readonly T[],
  sourceKey: string,
  targetKey: string,
  side: 'left' | 'right',
): T[] {
  if (sourceKey === targetKey) return [...tabs]
  const sourceTab = tabs.find(tab => tab.key === sourceKey)
  if (!sourceTab || !tabs.some(tab => tab.key === targetKey)) return [...tabs]
  const next = tabs.filter(tab => tab.key !== sourceKey)
  const index = next.findIndex(tab => tab.key === targetKey)
  next.splice(index + (side === 'right' ? 1 : 0), 0, sourceTab)
  return next
}

export type WorkspaceTabCloseAction = 'current' | 'others' | 'left' | 'right' | 'all'

/** 按菜单动作计算待关闭的页签键列表。 */
export function resolveCloseTargetKeys<T extends { key: string }>(
  tabs: readonly T[],
  anchorKey: string,
  action: WorkspaceTabCloseAction,
): string[] {
  const index = tabs.findIndex(tab => tab.key === anchorKey)
  if (action === 'all') return tabs.map(tab => tab.key)
  if (index < 0) return []
  if (action === 'current') return [tabs[index].key]
  if (action === 'others') return tabs.filter(tab => tab.key !== anchorKey).map(tab => tab.key)
  if (action === 'left') return tabs.slice(0, index).map(tab => tab.key)
  return tabs.slice(index + 1).map(tab => tab.key)
}

/** 计算关闭一批页签后应当保留的列表及新的激活键。 */
export function computeCloseResult<T extends { key: string }>(
  tabs: readonly T[],
  activeKey: string,
  closingKeys: readonly string[],
  fallbackKey: string,
): { remaining: T[]; nextActiveKey: string | null } {
  const closingSet = new Set(closingKeys)
  const remaining = tabs.filter(tab => !closingSet.has(tab.key))
  if (!closingSet.has(activeKey)) {
    return { remaining, nextActiveKey: null }
  }
  const activeIndex = tabs.findIndex(tab => tab.key === activeKey)
  const next = remaining[Math.min(Math.max(activeIndex, 0), remaining.length - 1)]?.key ?? fallbackKey
  return { remaining, nextActiveKey: next }
}

/** 路由型页签：在基础元信息之外记录完整跳转路径（含查询参数）。 */
export interface RouteWorkspaceTabMeta extends WorkspaceTabMeta {
  path: string
}

export const DEFAULT_MAX_WORKSPACE_TABS = 12

/**
 * 打开或刷新一个页签：已存在则原位更新标题与路径，不存在则追加到末尾；
 * 超过上限时从最左侧开始淘汰，但不会淘汰当前页签和保留页签（如首页）。
 */
export function upsertWorkspaceTab<T extends WorkspaceTabMeta>(
  tabs: readonly T[],
  tab: T,
  maxTabs: number = DEFAULT_MAX_WORKSPACE_TABS,
  pinnedKeys: readonly string[] = [],
): T[] {
  const exists = tabs.some(item => item.key === tab.key)
  const next = exists ? tabs.map(item => (item.key === tab.key ? { ...item, ...tab } : item)) : [...tabs, tab]
  const limit = Math.max(1, Math.floor(maxTabs))
  if (next.length <= limit) return next
  const protectedKeys = new Set([tab.key, ...pinnedKeys])
  const result = [...next]
  for (let index = 0; index < result.length && result.length > limit; ) {
    if (protectedKeys.has(result[index].key)) {
      index += 1
    } else {
      result.splice(index, 1)
    }
  }
  return result
}

/** 解析会话中保存的路由页签，过滤掉结构不合法或重复的项。 */
export function parseStoredWorkspaceTabs(raw: string | null | undefined): RouteWorkspaceTabMeta[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const seen = new Set<string>()
    const result: RouteWorkspaceTabMeta[] = []
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue
      const { key, label, path, form } = item as Record<string, unknown>
      if (typeof key !== 'string' || !key || typeof label !== 'string' || seen.has(key)) continue
      seen.add(key)
      result.push({
        key,
        label,
        path: typeof path === 'string' && path ? path : key,
        ...(form === true ? { form: true } : {}),
      })
    }
    return result
  } catch {
    return []
  }
}
