import type { ReactNode } from 'react'
import { ArrowRightOutlined, EyeOutlined, MessageOutlined, StarOutlined } from '@ant-design/icons'
import { Button, Tag } from 'antd'
import { useApp } from '../app-context'
import type { Article, Quote, SeriesPoint } from '../types'

/** 涨跌配色遵循国内习惯：涨=红，跌=绿。 */
export function toneOf(value: number): 'up' | 'down' | 'flat' {
  if (value > 0) return 'up'
  if (value < 0) return 'down'
  return 'flat'
}

export function ChangePct({ value, digits = 2 }: { value: number; digits?: number }): JSX.Element {
  const tone = toneOf(value)
  const prefix = tone === 'up' ? '+' : ''
  return <span className={`change-pct ${tone}`}>{prefix}{Number(value).toFixed(digits)}%</span>
}

export function Price({ value, unit }: { value: number; unit?: string }): JSX.Element {
  return <span className="price-value">{Number(value).toFixed(2)}{unit && <small>{unit}</small>}</span>
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
  tone?: 'default' | 'up' | 'down' | 'warn'
}): JSX.Element {
  return (
    <div className={`stat-tile tone-${tone}`}>
      <span className="stat-label">{label}</span>
      <b className="stat-value">{value}{unit && <small>{unit}</small>}</b>
      {note && <span className="stat-note">{note}</span>}
    </div>
  )
}

export function ToneTag({ tone, children }: { tone: string; children: ReactNode }): JSX.Element {
  return <Tag className={`soft-tag tone-${tone}`}>{children}</Tag>
}

/** 迷你走势图：只画折线，用于表格与卡片。 */
export function Sparkline({
  points,
  width = 96,
  height = 28,
  tone,
}: {
  points: number[]
  width?: number
  height?: number
  tone?: 'up' | 'down' | 'flat'
}): JSX.Element {
  if (!points.length) return <span className="spark-empty">—</span>
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  const step = width / Math.max(points.length - 1, 1)
  const path = points
    .map((value, index) => `${(index * step).toFixed(1)},${(height - ((value - min) / span) * (height - 4) - 2).toFixed(1)}`)
    .join(' ')
  const resolved = tone ?? toneOf(points[points.length - 1] - points[0])
  return (
    <svg className={`sparkline ${resolved}`} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="近期走势">
      <polyline points={path} fill="none" strokeWidth="1.8" />
    </svg>
  )
}

/** 30 日价格走势 + 7 日 AI 预测区间（预测段虚线、区间半透明填充）。 */
export function TrendChart({
  series,
  height = 260,
}: {
  series: SeriesPoint[]
  height?: number
}): JSX.Element {
  if (!series.length) return <div className="chart-empty">暂无走势数据</div>
  const width = 720
  const padding = { top: 18, right: 16, bottom: 26, left: 44 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const prices = series.flatMap((point) => [point.price ?? 0, point.low ?? point.price ?? 0, point.high ?? point.price ?? 0])
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const span = max - min || 1
  const stepX = plotWidth / Math.max(series.length - 1, 1)
  const x = (index: number): number => padding.left + index * stepX
  const y = (value: number): number => padding.top + plotHeight - ((value - min) / span) * plotHeight

  const history = series.filter((point) => !point.forecast)
  const forecast = series.filter((point) => point.forecast)
  const historyPath = history.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(point.price ?? 0).toFixed(1)}`).join(' ')
  const offset = history.length
  const forecastPoints = [history[history.length - 1], ...forecast].filter(Boolean)
  const forecastPath = forecastPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${x(offset - 1 + index).toFixed(1)},${y(point.price ?? 0).toFixed(1)}`)
    .join(' ')
  const bandPoints = forecast.map((point, index) => `${x(offset + index).toFixed(1)},${y(point.high ?? point.price ?? 0).toFixed(1)}`)
  const bandBack = forecast
    .map((point, index) => `${x(offset + index).toFixed(1)},${y(point.low ?? point.price ?? 0).toFixed(1)}`)
    .reverse()
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((ratio) => min + span * (1 - ratio))

  return (
    <svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="价格走势与预测区间">
      {gridLines.map((value) => (
        <g key={value}>
          <line x1={padding.left} x2={width - padding.right} y1={y(value)} y2={y(value)} className="chart-grid" />
          <text x={8} y={y(value) + 4} className="chart-axis">{value.toFixed(2)}</text>
        </g>
      ))}
      {forecast.length > 0 && (
        <>
          <line
            x1={x(offset - 1)}
            x2={x(offset - 1)}
            y1={padding.top}
            y2={padding.top + plotHeight}
            className="chart-divider"
          />
          <polygon
            className="chart-band"
            points={[...bandPoints, ...bandBack].join(' ')}
          />
        </>
      )}
      <path d={historyPath} className="chart-line history" />
      {forecast.length > 0 && <path d={forecastPath} className="chart-line forecast" />}
      {series.map((point, index) =>
        index === 0 || index === series.length - 1 ? (
          <text key={point.date} x={x(index)} y={height - 8} textAnchor={index === 0 ? 'start' : 'end'} className="chart-axis">
            {point.date.slice(5)}
          </text>
        ) : null,
      )}
    </svg>
  )
}

export function ArticleCard({ article, compact }: { article: Article; compact?: boolean }): JSX.Element {
  const { navigate } = useApp()
  return (
    <article className={`article-card${compact ? ' compact' : ''}`} onClick={() => navigate('news-detail', article.id)}>
      <div className={`article-cover type-${article.contentType}`}>
        <span>{article.coverIcon || '📰'}</span>
        {article.contentType === '短视频' && <i className="play-badge">▶</i>}
        {article.contentType === '直播' && <i className="play-badge live">●</i>}
      </div>
      <div className="article-body">
        <h3>
          {article.title}
          {article.aiGenerated && <em className="ai-chip">✦ AI 简报</em>}
          {article.isTop && <em className="top-chip">置顶</em>}
        </h3>
        {!compact && <p>{article.summary}</p>}
        <div className="article-meta">
          <span>{article.author}</span>
          <span>{article.publishedAt}</span>
          <span><EyeOutlined /> {formatCount(article.readCount)}</span>
          <span><MessageOutlined /> {article.commentCount}</span>
          <span><StarOutlined /> {article.favoriteCount}</span>
        </div>
      </div>
    </article>
  )
}

export function QuoteRow({ quote, onOpen }: { quote: Quote; onOpen: () => void }): JSX.Element {
  const tone = toneOf(quote.changePct)
  return (
    <tr onClick={onOpen}>
      <td>
        <b className="quote-name">{quote.icon} {quote.name}</b>
        {quote.monitorLevel === 'abnormal' && <em className="abnormal-chip">异动</em>}
      </td>
      <td>{quote.origin}</td>
      <td className="num"><b>{Number(quote.price).toFixed(2)}</b></td>
      <td className={`num ${tone}`}>{quote.changeAmount > 0 ? '+' : ''}{Number(quote.changeAmount).toFixed(2)}</td>
      <td className="num"><ChangePct value={quote.changePct} /></td>
      <td><Sparkline points={quote.trend} tone={tone} /></td>
      <td><button type="button" className="link-button" onClick={(event) => { event.stopPropagation(); onOpen() }}>详情</button></td>
    </tr>
  )
}

export function EmptyState({
  icon = '🌱',
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

export function AiCard({
  title,
  children,
  confidence,
  actions,
}: {
  title: string
  children: ReactNode
  confidence?: number
  actions?: ReactNode
}): JSX.Element {
  return (
    <section className="ai-card">
      <div className="ai-card-head"><span>✦</span>{title}</div>
      <div className="ai-card-body">{children}</div>
      {typeof confidence === 'number' && (
        <div className="ai-confidence">
          <span>结论置信度</span>
          <span className="confidence-bar"><i style={{ width: `${confidence}%` }} /></span>
          <b>{confidence}%</b>
        </div>
      )}
      {actions && <div className="ai-card-actions">{actions}</div>}
    </section>
  )
}

export function formatCount(value: number): string {
  if (value >= 10000) return `${(value / 10000).toFixed(1)}万`
  return String(value)
}
