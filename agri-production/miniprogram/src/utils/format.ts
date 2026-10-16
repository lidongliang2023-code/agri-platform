/**
 * 展示口径：状态字典与格式化。
 *
 * <p>字典与 PC 端（{@code @agri/shared}）保持一致，不在移动端另造一套值域，
 * 否则同一个任务在两端会显示成两个状态。</p>
 */

/** 任务状态 → 文案（值域见 agri-shared/types/task） */
export const TASK_STATUS_LABEL: Record<string, string> = {
  pending: '待执行',
  assigned: '已派发',
  executing: '执行中',
  doing: '执行中',
  completed: '已完成',
  done: '已完成',
  suspended: '已暂停',
  cancelled: '已取消',
  expired: '已过期',
  rejected: '已驳回',
}

/** 任务状态 → 颜色（对应样式类） */
export const TASK_STATUS_COLOR: Record<string, string> = {
  pending: '#1677ff',
  assigned: '#1677ff',
  executing: '#fa8c16',
  doing: '#fa8c16',
  completed: '#13a05a',
  done: '#13a05a',
  suspended: '#8c8c8c',
  cancelled: '#8c8c8c',
  expired: '#d4380d',
  rejected: '#d4380d',
}

/** 任务优先级：4 紧急 / 3 重要 / 2 普通 / 1 低 */
export const TASK_PRIORITY_LABEL: Record<number, string> = {
  4: '紧急',
  3: '重要',
  2: '普通',
  1: '低',
}

/** 任务优先级 → 颜色 */
export const TASK_PRIORITY_COLOR: Record<number, string> = {
  4: '#ff4d4f',
  3: '#fa8c16',
  2: '#1677ff',
  1: '#8c8c8c',
}

/** 入库状态：0 待入库 / 1 已入库 / 2 已出库 */
export const INBOUND_STATUS_LABEL: Record<number, string> = {
  0: '待入库',
  1: '已入库',
  2: '已出库',
}

/** 入库状态 → 颜色 */
export const INBOUND_STATUS_COLOR: Record<number, string> = {
  0: '#faad14',
  1: '#13a05a',
  2: '#1677ff',
}

/** 告警级别（PC 端 alerts 用 1/2/3 或 low/medium/high，两种都兜住） */
export function alertLevelLabel(level: any): string {
  const key = String(level ?? '').toLowerCase()
  if (key === '3' || key === 'high' || key === 'critical') return '高危'
  if (key === '2' || key === 'medium' || key === 'warning') return '中危'
  if (key === '1' || key === 'low') return '低危'
  return '一般'
}

/** 告警级别 → 颜色 */
export function alertLevelColor(level: any): string {
  const label = alertLevelLabel(level)
  if (label === '高危') return '#ff4d4f'
  if (label === '中危') return '#fa8c16'
  if (label === '低危') return '#faad14'
  return '#8c8c8c'
}

/** 日期时间格式化：'2026-06-01T10:00:00' → '2026-06-01 10:00' */
export function fmtDateTime(value?: string | null): string {
  if (!value) return '—'
  return String(value).replace('T', ' ').slice(0, 16)
}

/** 日期格式化：只取年月日 */
export function fmtDate(value?: string | null): string {
  if (!value) return '—'
  return String(value).replace('T', ' ').slice(0, 10)
}

/** 数字格式化：最多两位小数、千分位；空值给「—」（不补 0） */
export function fmtNumber(value?: number | string | null, unit = ''): string {
  if (value === null || value === undefined || value === '') return '—'
  const num = Number(value)
  if (Number.isNaN(num)) return '—'
  const text = num.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
  return unit ? `${text} ${unit}` : text
}

/** 两个日期相差天数（用于休药期倒计时），非法输入返回 null */
export function daysBetween(from: string, to: string): number | null {
  const a = new Date(`${fmtDate(from)}T00:00:00`).getTime()
  const b = new Date(`${fmtDate(to)}T00:00:00`).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.round((b - a) / 86400000)
}

/** 今天（YYYY-MM-DD） */
export function today(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** 日期加减天数（YYYY-MM-DD） */
export function addDays(date: string, days: number): string {
  const base = new Date(`${fmtDate(date)}T00:00:00`)
  base.setDate(base.getDate() + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}`
}
