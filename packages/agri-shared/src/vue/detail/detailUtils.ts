export type DetailStatusTone = 'green' | 'orange' | 'red' | 'blue' | 'gray'

export type DetailActionKind = 'secondary' | 'danger' | 'primary'

export interface DetailActionDescriptor {
  key: string
  kind?: DetailActionKind
}

export type DetailTimelineState = 'done' | 'current' | 'pending' | 'error'

export interface DetailTimelineStep {
  key?: string
  title: string
  description?: string
  time?: string
  state?: DetailTimelineState
}

export interface DetailRelatedDocItem {
  key?: string
  label: string
  code?: string
  text?: string
  emptyText?: string
  mono?: boolean
  clickable?: boolean
  badge?: string
  badgeTone?: DetailStatusTone
  onClick?: () => void
}

const ACTION_ORDER: Record<DetailActionKind, number> = {
  secondary: 0,
  danger: 1,
  primary: 2,
}

/**
 * 详情页页头右侧操作按钮规范顺序：次要 → 危险 → 主要。
 * 保持同级按钮原有相对顺序（稳定排序）。
 */
export function sortDetailActions<T extends DetailActionDescriptor>(actions: readonly T[]): T[] {
  return actions
    .map((action, index) => ({ action, index }))
    .sort((a, b) => {
      const diff = ACTION_ORDER[a.action.kind ?? 'secondary'] - ACTION_ORDER[b.action.kind ?? 'secondary']
      return diff !== 0 ? diff : a.index - b.index
    })
    .map(item => item.action)
}

/**
 * 将常见 Ant Design / 业务语义色名归一化为详情页规范胶囊色板。
 */
export function resolveDetailStatusTone(color?: string | null): DetailStatusTone {
  const key = String(color ?? '').trim().toLowerCase()
  if (['green', 'success', 'lime', 'cyan', 'emerald'].includes(key)) return 'green'
  if (['orange', 'gold', 'warning', 'amber', 'yellow'].includes(key)) return 'orange'
  if (['red', 'error', 'volcano', 'magenta', 'danger'].includes(key)) return 'red'
  if (['blue', 'processing', 'geekblue', 'purple', 'info'].includes(key)) return 'blue'
  return 'gray'
}

/**
 * 将时间线节点状态归一化为 done / current / pending / error。
 */
export function normalizeTimelineState(state?: string | null): DetailTimelineState {
  const key = String(state ?? '').trim().toLowerCase()
  if (['done', 'completed', 'finish', 'finished', 'success', 'green'].includes(key)) return 'done'
  if (['current', 'active', 'process', 'processing', 'in_progress', 'orange', 'blue'].includes(key)) return 'current'
  if (['error', 'failed', 'rejected', 'terminated', 'red', 'danger'].includes(key)) return 'error'
  return 'pending'
}
