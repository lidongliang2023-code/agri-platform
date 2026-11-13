import { useEffect, useState, type ReactNode } from 'react'
import { App, Drawer, Dropdown, Menu } from 'antd'
import { DownOutlined, LogoutOutlined, MenuOutlined } from '@ant-design/icons'
import { logoutUnified, useUnifiedUser } from './sso'
import './workspace-navigation.css'

export interface NavigationGroup {
  group: string
  items: Array<{ page: string; label: string; icon: ReactNode }>
}

/** 两端统一的二级导航，菜单与原业务路由共用同一份配置。 */
export function WorkspaceNavigation({ groups, selected, collapsed, onNavigate, mobileOpen, onMobileClose }: {
  groups: NavigationGroup[]; selected: string; collapsed: boolean
  onNavigate: (page: string) => void; mobileOpen: boolean; onMobileClose: () => void
}) {
  const activeGroup = groups.find(group => group.items.some(item => item.page === selected))?.group
  const [openKeys, setOpenKeys] = useState<string[]>(activeGroup ? [activeGroup] : [])
  useEffect(() => {
    if (activeGroup) setOpenKeys(keys => keys.includes(activeGroup) ? keys : [...keys, activeGroup])
  }, [activeGroup])
  const items = groups.map(group => ({
    key: group.group, label: group.group, icon: group.items[0]?.icon,
    children: group.items.map(item => ({ key: item.page, label: item.label, icon: item.icon })),
  }))
  const menu = (mobile: boolean) => <Menu
    theme="dark" mode="inline" inlineCollapsed={mobile ? false : collapsed}
    selectedKeys={[selected]} {...(!collapsed || mobile ? { openKeys, onOpenChange: setOpenKeys } : {})}
    items={items} onClick={({ key }) => { onNavigate(key); onMobileClose() }}
  />
  return <>
    <div className="iot-level-nav">{menu(false)}</div>
    <Drawer title="物联网功能导航" placement="left" width={272} open={mobileOpen} onClose={onMobileClose} className="iot-nav-drawer">
      <div className="iot-level-nav">{menu(true)}</div>
    </Drawer>
  </>
}

export function MobileNavigationButton({ onClick }: { onClick: () => void }) {
  return <button type="button" className="iot-mobile-nav-button" aria-label="打开功能导航" onClick={onClick}><MenuOutlined /></button>
}

export function AccountMenu({ clientId, onLogs }: { clientId: string; onLogs?: () => void }) {
  const { user } = useUnifiedUser()
  const { message } = App.useApp()
  const [exiting, setExiting] = useState(false)
  const name = user.nickname || user.username
  return <Dropdown trigger={['click']} menu={{ items: [
    ...(onLogs ? [{ key: 'logs', label: '操作审计', onClick: onLogs }, { type: 'divider' as const }] : []),
    { key: 'logout', icon: <LogoutOutlined />, label: exiting ? '正在退出…' : '退出登录', disabled: exiting,
      onClick: async () => {
        setExiting(true)
        try { await logoutUnified(clientId) }
        catch (error) { message.error(error instanceof Error ? error.message : '退出失败，请重试'); setExiting(false) }
      } },
  ] }}>
    <button type="button" className="iot-account-menu" aria-label="账号菜单" aria-haspopup="menu" disabled={exiting}>
      <span className="iot-account-avatar">{name.slice(0, 1)}</span>
      <span className="iot-account-name"><b>{name}</b><small>统一平台账号</small></span>
      <DownOutlined />
    </button>
  </Dropdown>
}
