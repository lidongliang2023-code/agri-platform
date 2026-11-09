import { Card } from 'antd'
import { useState } from 'react'
import { SectionToolbarContext } from './SectionToolbarContext'
import type { CardProps } from 'antd'
import './SectionCard.css'

/** 生产业务分区：沿用农事详情的信息栅格与圆角卡片。 */
export default function SectionCard({ className = '', title, extra, children, ...props }: CardProps): JSX.Element {
  const [toolbarHost, setToolbarHost] = useState<HTMLDivElement | null>(null)
  const hasTitle = title !== undefined && title !== null && title !== false && title !== ''
  return <SectionToolbarContext.Provider value={hasTitle ? toolbarHost : null}>
    <Card {...props} title={title} extra={hasTitle ? <div className="production-section-heading-tools">
      {extra}
      <div ref={setToolbarHost} className="production-section-toolbar-host" />
    </div> : extra} className={`production-section-card ${className}`.trim()}>{children}</Card>
  </SectionToolbarContext.Provider>
}

