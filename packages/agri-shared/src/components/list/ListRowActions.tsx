import { Children } from 'react'
import type { ReactNode } from 'react'
import { Button, Popover, Space } from 'antd'

export interface ListRowActionsProps {
  children: ReactNode
  /** 直接平铺显示的最大操作数，默认 2（超出部分保留第 1 项并收拢进「更多」弹层）。 */
  maxVisible?: number
  size?: number
  moreLabel?: string
}

/** 表格行操作收拢组件：保留原操作节点的禁用态、权限判断与二次确认。 */
export default function ListRowActions({
  children,
  maxVisible = 2,
  size = 10,
  moreLabel = '更多',
}: ListRowActionsProps) {
  const actions = Children.toArray(children).filter(Boolean)
  const limit = Math.max(1, maxVisible)
  return (
    <Space size={size}>
      {actions.length <= limit ? (
        actions
      ) : (
        <>
          {actions.slice(0, limit - 1)}
          <Popover
            trigger="click"
            placement="bottomRight"
            content={
              <Space direction="vertical" align="start" size={4}>
                {actions.slice(limit - 1)}
              </Space>
            }
          >
            <Button type="link" size="small">
              {moreLabel}
            </Button>
          </Popover>
        </>
      )}
    </Space>
  )
}
