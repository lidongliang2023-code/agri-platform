import type { ReactNode } from 'react'
import { ArrowRightOutlined } from '@ant-design/icons'
import { Button, Tag } from 'antd'
import type { DistributionItem, TrendPoint } from '../types'

/** 涨跌配色遵循国内习惯：涨=红，跌=绿。 */
export function toneOf(value: number): 'up' | 'down' | 'flat' {
  if (value > 0) return 'up'
  if (value < 0) return 'down'
  return 'flat'
}

export function ChangePct({ value, digits = 2 }: { value: number; digits?: number }): JSX.Element {
  const tone = toneOf(value)
  return <span className={`change-pct ${tone}`}>{tone === 'up' ? '+' : ''}{Number(value).toFixed(digits)}%</span>
}

export function PageTitle({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}): JSX.Element {
  return (
    <div className="page-title-row">
      <div>
        {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  )
}

export function SectionHeading({
  kicker,
  title,
  action,
  onAction,
}: {
  kicker?: string
  title: string
  action?: string
  onAction?: () => void
}): JSX.Element {
  return (
    <div className="section-heading compact">
      <div>
        {kicker && <span className="section-kicker">{kicker}</span>}
        <h2>{title}</h2>
      </div>
      {action && onAction && <button type="button" onClick={onAction}>{action} <ArrowRightOutlined /></button>}
    </div>
  )
}

export function StatTile({
  label,
  value,
  unit,
  note,
  tone = 'default',
}: {
  label: string
  value: string | number
  unit?: string
  note?: string
  tone?: string
}): JSX.Element {
  return (
    <div className={`stat-tile tone-${tone}`}>
      <span className="stat-label">{label}</span>
      <b className="stat-value">{value}{unit && <small>{unit}</small>}</b>
      {note && <span className="stat-note">{note}</span>}
    </div>
  )
}

/**
 * 状态文案的唯一映射（运营端各页面共用）。
 * `draft` 原先没有 —— 「退回修改」写入的就是这个状态，于是不但页签里没有，标签上也只显示英文原值。
 */
const STATUS_META: Record<string, { label: string; tone: string }> = {
  draft: { label: '草稿', tone: 'default' },
  published: { label: '已发布', tone: 'green' },
  pending: { label: '待审核', tone: 'amber' },
  reviewing: { label: '审核中', tone: 'amber' },
  offline: { label: '已下架', tone: 'default' },
  rejected: { label: '未通过', tone: 'up' },
  approved: { label: '已通过', tone: 'green' },
  online: { label: '在线', tone: 'green' },
  enabled: { label: '启用', tone: 'green' },
  disabled: { label: '停用', tone: 'default' },
  confirmed: { label: '已确认', tone: 'purple' },
  normal: { label: '正常', tone: 'green' },
  abnormal: { label: '异动', tone: 'up' },
  success: { label: '成功', tone: 'green' },
  failed: { label: '失败', tone: 'up' },
}

/** 状态中文文案（未知状态原样显示，不猜一个看起来合理的词） */
export function statusLabel(status: string): string {
  return STATUS_META[status]?.label ?? status ?? ''
}

export function StatusTag({ status }: { status: string }): JSX.Element {
  const hit = STATUS_META[status] ?? { label: status || '—', tone: 'default' }
  return <Tag className={`soft-tag tone-${hit.tone}`}>{hit.label}</Tag>
}

/** 运营大盘趋势：产量柱 + PV 折线，双轴归一化到同一坐标系。 */
export function OpsTrendChart({ points, height = 220 }: { points: TrendPoint[]; height?: number }): JSX.Element {
  if (!points.length) return <div className="chart-empty">暂无趋势数据</div>
  const width = 720
  const padding = { top: 16, right: 16, bottom: 26, left: 40 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const maxProduced = Math.max(...points.map((point) => point.produced), 1)
  const maxPv = Math.max(...points.map((point) => point.pv), 1)
  const stepX = plotWidth / Math.max(points.length, 1)
  const barWidth = Math.max(stepX * 0.5, 4)
  const labelStep = Math.ceil(points.length / 8)
  const pvPath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${(padding.left + stepX * index + stepX / 2).toFixed(1)},${(padding.top + plotHeight - (point.pv / maxPv) * plotHeight).toFixed(1)}`)
    .join(' ')

  return (
    <svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="内容产量与阅读量趋势">
      {[0, 0.5, 1].map((ratio) => (
        <line
          key={ratio}
          x1={padding.left}
          x2={width - padding.right}
          y1={padding.top + plotHeight * ratio}
          y2={padding.top + plotHeight * ratio}
          className="chart-grid"
        />
      ))}
      {points.map((point, index) => {
        const barHeight = (point.produced / maxProduced) * plotHeight
        return (
          <rect
            key={point.date}
            x={padding.left + stepX * index + (stepX - barWidth) / 2}
            y={padding.top + plotHeight - barHeight}
            width={barWidth}
            height={barHeight}
            rx={2}
            className="chart-bar"
          />
        )
      })}
      <path d={pvPath} className="chart-line history" />
      {points.map((point, index) =>
        (index % labelStep === 0 && index < points.length - Math.max(1, Math.floor(labelStep / 2)))
          || index === points.length - 1 ? (
          <text
            key={`label-${point.date}`}
            x={padding.left + stepX * index + stepX / 2}
            y={height - 8}
            textAnchor="middle"
            className="chart-axis"
          >
            {point.date.slice(5)}
          </text>
        ) : null,
      )}
    </svg>
  )
}

/** 内容分布环形图：用 stroke-dasharray 画多段圆环，避免引入图表库。 */
export function DistributionDonut({ items }: { items: DistributionItem[] }): JSX.Element {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  let offset = 0
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 140 140" className="donut" role="img" aria-label="内容渠道分布">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#eef3ef" strokeWidth="16" />
        {items.map((item) => {
          const length = (item.percent / 100) * circumference
          const dash = `${length} ${circumference - length}`
          const element = (
            <circle
              key={item.name}
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth="16"
              strokeDasharray={dash}
              strokeDashoffset={-offset}
              transform="rotate(-90 70 70)"
            />
          )
          offset += length
          return element
        })}
      </svg>
      <div className="donut-legend">
        {items.map((item) => (
          <div className="donut-legend-row" key={item.name}>
            <i style={{ background: item.color }} />
            <span>{item.name}</span>
            <b>{item.count}</b>
            <small>{item.percent}%</small>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Sparkline({ points, width = 88, height = 26 }: { points: number[]; width?: number; height?: number }): JSX.Element {
  if (!points.length) return <span className="spark-empty">—</span>
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  const step = width / Math.max(points.length - 1, 1)
  const path = points
    .map((value, index) => `${(index * step).toFixed(1)},${(height - ((value - min) / span) * (height - 4) - 2).toFixed(1)}`)
    .join(' ')
  return (
    <svg className={`sparkline ${toneOf(points[points.length - 1] - points[0])}`} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="近期走势">
      <polyline points={path} fill="none" strokeWidth="1.8" />
    </svg>
  )
}

export function EmptyState({
  icon = '🗂️',
  title,
  description,
  action,
}: {
  icon?: string
  title: string
  description?: string
  action?: ReactNode
}): JSX.Element {
  return (
    <div className="empty-state">
      <span>{icon}</span>
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {action}
    </div>
  )
}

export function LoadingBlock({ rows = 3 }: { rows?: number }): JSX.Element {
  return (
    <div className="loading-list">
      {Array.from({ length: rows }, (_, index) => (
        <div className="skeleton-card" key={index}><i /><span /><span /></div>
      ))}
    </div>
  )
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }): JSX.Element {
  return (
    <EmptyState
      icon="🛠️"
      title="数据暂时未加载"
      description={message}
      action={<Button type="primary" onClick={onRetry ?? (() => window.location.reload())}>重新加载</Button>}
    />
  )
}

export function formatCount(value: number): string {
  if (value >= 10000) return `${(value / 10000).toFixed(1)}万`
  return String(value)
}

export function riskLabel(level: string): { label: string; tone: string } {
  if (level === 'high') return { label: '高风险', tone: 'up' }
  if (level === 'medium') return { label: '中风险', tone: 'amber' }
  if (level === 'low') return { label: '低风险', tone: 'purple' }
  return { label: '无风险', tone: 'green' }
}
