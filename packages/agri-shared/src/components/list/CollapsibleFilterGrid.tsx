import { useState } from 'react'
import type { ReactNode } from 'react'
import { Button, Form } from 'antd'
import type { FormProps } from 'antd'

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <span className="anticon" aria-hidden="true">
      <svg
        viewBox="64 64 896 896"
        width="1em"
        height="1em"
        fill="currentColor"
        style={{ display: 'inline-block', transform: expanded ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }}
      >
        <path d="M884 256h-75c-5.1 0-9.9 2.5-12.9 6.6L512 654.2 227.9 262.6c-3-4.1-7.8-6.6-12.9-6.6h-75c-6.5 0-10.3 7.4-6.5 12.7l352.6 486.1c12.8 17.6 39 17.6 51.7 0l352.6-486.1c3.9-5.3.1-12.7-6.4-12.7z" />
      </svg>
    </span>
  )
}

export const DEFAULT_COLLAPSE_THRESHOLD = 5

export function useFilterCollapse(fieldCount: number, threshold = DEFAULT_COLLAPSE_THRESHOLD) {
  const collapsible = fieldCount >= threshold
  const [collapsed, setCollapsed] = useState(collapsible)
  const isCollapsed = collapsible ? collapsed : false
  return {
    collapsible,
    collapsed: isCollapsed,
    toggle: () => setCollapsed((prev) => !prev),
    collapseClassName: isCollapsed ? 'agri-filter-collapsed production-filter-collapsed' : '',
  }
}

export function FilterCollapseToggle({
  collapsible,
  collapsed,
  onToggle,
}: {
  collapsible: boolean
  collapsed: boolean
  onToggle: () => void
}): JSX.Element | null {
  if (!collapsible) return null
  return (
    <Button
      type="link"
      size="small"
      className="agri-filter-collapse-btn production-filter-collapse-btn"
      onClick={onToggle}
      aria-expanded={!collapsed}
    >
      {collapsed ? '展开' : '收起'}
      <ChevronIcon expanded={!collapsed} />
    </Button>
  )
}

export interface CollapsibleFilterRenderState {
  collapsible: boolean
  collapsed: boolean
  toggleButton: JSX.Element | null
}

export function CollapsibleFilterForm<Values = any>({
  fieldCount,
  threshold = DEFAULT_COLLAPSE_THRESHOLD,
  className = '',
  children,
  ...formProps
}: Omit<FormProps<Values>, 'children'> & {
  fieldCount: number
  threshold?: number
  children: (state: CollapsibleFilterRenderState) => ReactNode
}): JSX.Element {
  const { collapsible, collapsed, toggle, collapseClassName } = useFilterCollapse(fieldCount, threshold)
  const toggleButton = <FilterCollapseToggle collapsible={collapsible} collapsed={collapsed} onToggle={toggle} />
  return (
    <Form<Values>
      {...formProps}
      className={['agri-filter-grid', className, collapseClassName].filter(Boolean).join(' ')}
    >
      {children({ collapsible, collapsed, toggleButton })}
    </Form>
  )
}

export function CollapsibleFilterDiv({
  fieldCount,
  threshold = DEFAULT_COLLAPSE_THRESHOLD,
  className = '',
  children,
}: {
  fieldCount: number
  threshold?: number
  className?: string
  children: (state: CollapsibleFilterRenderState) => ReactNode
}): JSX.Element {
  const { collapsible, collapsed, toggle, collapseClassName } = useFilterCollapse(fieldCount, threshold)
  const toggleButton = <FilterCollapseToggle collapsible={collapsible} collapsed={collapsed} onToggle={toggle} />
  return (
    <div className={['agri-filter-grid', className, collapseClassName].filter(Boolean).join(' ')}>
      {children({ collapsible, collapsed, toggleButton })}
    </div>
  )
}
