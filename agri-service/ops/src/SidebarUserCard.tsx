import { Dropdown } from 'antd'
import { LogoutOutlined, SwapOutlined, UpOutlined, UserOutlined } from '@ant-design/icons'

const PERSONAL_CENTER = `${window.location.protocol}//${window.location.hostname}:8098/portal/#/account/business`

/** 侧栏底部用户区（PC UI V1 第 08 章）：头像 + 姓名 + 角色，点击展开个人中心 / 切换身份 / 退出登录。 */
export function SidebarUserCard({ name, role, collapsed, switchLabel, switchUrl, onLogout }: {
  name: string
  role: string
  collapsed: boolean
  switchLabel: string
  switchUrl: string
  onLogout: () => void
}): JSX.Element {
  const displayName = name || '平台用户'
  return (
    <div className="pc-side-user">
      <Dropdown
        trigger={['click']}
        placement={collapsed ? 'topRight' : 'topLeft'}
        menu={{
          items: [
            { key: 'personal', icon: <UserOutlined />, label: '个人中心', onClick: () => { window.open(PERSONAL_CENTER, '_blank', 'noopener') } },
            { key: 'switch', icon: <SwapOutlined />, label: switchLabel, onClick: () => { window.location.href = switchUrl } },
            { type: 'divider' },
            { key: 'logout', icon: <LogoutOutlined />, danger: true, label: '退出登录', onClick: onLogout },
          ],
        }}
      >
        <button
          type="button"
          className="pc-side-user-trigger"
          title={`${displayName} · ${role}`}
          style={collapsed ? { justifyContent: 'center', padding: '6px 0', gap: 0 } : undefined}
        >
          <span className="pc-side-user-avatar">{displayName.slice(0, 1)}</span>
          {!collapsed && (
            <>
              <span className="pc-side-user-meta">
                <strong>{displayName}</strong>
                <small>{role}</small>
              </span>
              <span className="pc-side-user-caret"><UpOutlined /></span>
            </>
          )}
        </button>
      </Dropdown>
    </div>
  )
}
