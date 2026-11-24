import { useState } from 'react'
import type { ReactNode } from 'react'
import { Button, Form } from 'antd'
import type { FormProps } from 'antd'
import { DownOutlined, UpOutlined } from '@ant-design/icons'

export const DEFAULT_COLLAPSE_THRESHOLD = 5

export function useFilterCollapse(fieldCount: number, threshold = DEFAULT_COLLAPSE_THRESHOLD) {
  const collapsible = fieldCount >= threshold
  const [collapsed, setCollapsed] = useState(collapsible)
  return {
    collapsible,
    collapsed: collapsible ? collapsed : false,
    toggle: () => setCollapsed((prev) => !prev),
    collapseClassName: collapsible && collapsed ? 'production-filter-collapsed' : '',
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
      className="production-filter-collapse-btn"
      onClick={onToggle}
      aria-expanded={!collapsed}
    >
      {collapsed ? '展开' : '收起'}
      {collapsed ? <DownOutlined /> : <UpOutlined />}
    </Button>
  )
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
  children: (state: {
    collapsible: boolean
    collapsed: boolean
    toggleButton: JSX.Element | null
  }) => ReactNode
}): JSX.Element {
  const { collapsible, collapsed, toggle, collapseClassName } = useFilterCollapse(fieldCount, threshold)
  const toggleButton = <FilterCollapseToggle collapsible={collapsible} collapsed={collapsed} onToggle={toggle} />
  return (
    <Form<Values>
      {...formProps}
      className={[className, collapseClassName].filter(Boolean).join(' ')}
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
  children: (state: {
    collapsible: boolean
    collapsed: boolean
    toggleButton: JSX.Element | null
  }) => ReactNode
}): JSX.Element {
  const { collapsible, collapsed, toggle, collapseClassName } = useFilterCollapse(fieldCount, threshold)
  const toggleButton = <FilterCollapseToggle collapsible={collapsible} collapsed={collapsed} onToggle={toggle} />
  return (
    <div className={[className, collapseClassName].filter(Boolean).join(' ')}>
      {children({ collapsible, collapsed, toggleButton })}
    </div>
  )
}
