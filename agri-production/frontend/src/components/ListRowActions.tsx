import { Children } from 'react'
import type { ReactNode } from 'react'
import { Button, Popover, Space } from 'antd'

/** 保留原操作组件，以便禁用态、权限判断与二次确认继续生效。 */
export default function ListRowActions({ children }: { children: ReactNode }) {
  const actions = Children.toArray(children)
  return <Space size={10}>
    {actions.length <= 2 ? actions : <>
      {actions[0]}
      <Popover trigger="click" placement="bottomRight" content={<Space direction="vertical" align="start">{actions.slice(1)}</Space>}>
        <Button type="link" size="small">更多</Button>
      </Popover>
    </>}
  </Space>
}
