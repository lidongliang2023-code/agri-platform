import type { ReactNode } from 'react'
import { Progress as AntProgress, Tag } from 'antd'
import { ArrowRightOutlined, ClockCircleOutlined, EnvironmentOutlined, StarFilled } from '@ant-design/icons'
import { useApp } from '../app-context'
import type { Provider } from '../types'

export const ORDER_STATUS: Record<string, { label: string; tone: string }> = {
  pending_payment: { label: '待支付', tone: 'orange' },
  confirmed: { label: '已确认', tone: 'blue' },
  in_progress: { label: '服务中', tone: 'green' },
  completed: { label: '已完成', tone: 'gray' },
  cancelled: { label: '已取消', tone: 'red' },
}

export const POLICY_STATUS: Record<string, { label: string; tone: string }> = {
  submitted: { label: '已提交', tone: 'blue' },
  town_review: { label: '乡镇审核中', tone: 'orange' },
  county_review: { label: '区县审核中', tone: 'orange' },
  paid: { label: '已兑付', tone: 'green' },
}

export const INSURANCE_STATUS: Record<string, { label: string; tone: string }> = {
  effective: { label: '保障生效', tone: 'green' },
  claiming: { label: '理赔中', tone: 'orange' },
  expired: { label: '已到期', tone: 'gray' },
  submitted: { label: '已报案', tone: 'blue' },
  surveying: { label: '查勘中', tone: 'orange' },
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

export function StatusTag({
  status,
  labels = ORDER_STATUS,
}: {
  status: string
  labels?: Record<string, { label: string; tone: string }>
}): JSX.Element {
  const item = labels[status] ?? { label: status, tone: 'gray' }
  return <Tag className={`status-tag tone-${item.tone}`}>{item.label}</Tag>
}

export function Money({ value, suffix = '元' }: { value: number | string; suffix?: string }): JSX.Element {
  const amount = typeof value === 'number' ? value.toLocaleString('zh-CN') : value
  return <span className="money">¥{amount}<small>{suffix}</small></span>
}

export function MiniProgress({ value }: { value: number }): JSX.Element {
  return <AntProgress percent={value} size="small" showInfo={false} strokeColor="#159a5e" trailColor="#e9f0eb" />
}

export function ProviderCard({ provider }: { provider: Provider }): JSX.Element {
  const { navigate } = useApp()
  return (
    <article className="provider-card card-hover" onClick={() => navigate('provider', provider.id)}>
      <div className="provider-cover">
        <span className="provider-cover-icon">{provider.categoryIcon}</span>
        <span className="provider-badge">{provider.badge}</span>
        <span className="provider-distance"><EnvironmentOutlined /> {provider.distanceKm}km</span>
      </div>
      <div className="provider-body">
        <div className="provider-heading">
          <div>
            <h3>{provider.name}</h3>
            <div className="provider-meta">
              <span><StarFilled /> {provider.rating}</span>
              <span>已服务 {provider.orderCount} 单</span>
              <span><ClockCircleOutlined /> {provider.responseMinutes} 分钟响应</span>
            </div>
          </div>
          <Money value={provider.price} />
        </div>
        <p className="provider-desc">{provider.description}</p>
        <div className="tag-row">
          {provider.tags.slice(0, 3).map((tag) => <span className="soft-tag" key={tag}>{tag}</span>)}
          <span className="soft-tag muted">{provider.category}</span>
          {provider.favorited && <span className="soft-tag">已收藏</span>}
        </div>
        <div className="provider-foot">
          <span><EnvironmentOutlined /> {provider.region}</span>
          <button type="button" onClick={(event) => { event.stopPropagation(); navigate('provider', provider.id) }}>
            查看与预约 <ArrowRightOutlined />
          </button>
        </div>
      </div>
    </article>
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
        <div className="skeleton-card" key={index}>
          <i />
          <span />
          <span />
        </div>
      ))}
    </div>
  )
}

export function formatMoney(value: number): string {
  return value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}
