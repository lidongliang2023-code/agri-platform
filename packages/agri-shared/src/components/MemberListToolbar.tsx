import type { MouseEventHandler, ReactNode } from 'react'
import './MemberListToolbar.css'

// 返回原生按钮，让两种表格的弹层都能直接绑定事件和焦点。
export function columnSettingsTrigger() {
  return <button className="agri-list-tool" type="button" aria-haspopup="dialog">列设置</button>
}

interface MemberListToolbarProps {
  columnSettings: ReactNode
  onRefresh?: MouseEventHandler<HTMLButtonElement>
  refreshing?: boolean
}

/** 表格提供自己的列设置面板和查询回调，工具栏统一按钮顺序与交互样式。 */
export default function MemberListToolbar({ columnSettings, onRefresh, refreshing }: MemberListToolbarProps) {
  return <span className="agri-member-list-tools" role="group" aria-label="列表工具">
    {columnSettings}
    {onRefresh && <button className="agri-list-tool" type="button" disabled={refreshing} aria-busy={!!refreshing} onClick={onRefresh}>刷新</button>}
  </span>
}
