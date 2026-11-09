import type { ReactNode } from 'react'

type PortalPageHeroProps = {
  title: string
  description: string
  badge?: string
  children?: ReactNode
}

/** 官网频道统一标题区；新增频道复用此组件及 portal-channel-page 内容容器。 */
export function PortalPageHero({ title, description, badge, children }: PortalPageHeroProps): JSX.Element {
  return (
    <section className="portal-page-hero">
      <div className="container portal-page-hero-inner">
        {badge && <span className="portal-page-hero-badge">{badge}</span>}
        <h1>{title}</h1>
        <p>{description}</p>
        {children}
      </div>
    </section>
  )
}
