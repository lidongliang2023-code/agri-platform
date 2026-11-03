/**
 * 用户中心 · 用户端导航模型
 *
 * <p>结构对齐原型《用户中心_用户端原型_V1》：7 个分组、23 个条目
 * （原型里的登录 / 注册 / 找回密码已从侧栏移除 —— 那是未登录场景，登录后的用户中心不再挂这些入口）。
 * 每个条目必须标明**当前能不能用**，不允许"点进去是空白页"或"用假数据撑场面"：</p>
 *
 * <ul>
 *   <li>{@code ready}   —— 已有实现，指向账号中心内的 tab（或本模型内的独立视图）</li>
 *   <li>{@code external}—— 实现位于独立认证页，跳转过去</li>
 *   <li>{@code pending} —— 后端还没有对应能力，页面显式说明"缺哪个接口"，不编数据</li>
 * </ul>
 *
 * <p>为什么要单独抽这个文件：原型 IA 是产品口径，代码里各 tab 是历史演进的结果，
 * 两者对不齐时**以原型为准**，但差异必须能一眼看出来 —— 否则下次又有人问
 * "为什么原型有这么多菜单、系统只有几个"。</p>
 */

/** 账号中心内已实现的视图 key（与 AccountCenter 的 tab 一一对应） */
export type AccountView =
  | 'overview'
  | 'messages'
  | 'devices'
  | 'bindings'
  | 'notification'
  | 'logs'
  | 'certificates'
  | 'realname'
  | 'feedback'
  | 'privacy'
  | 'crossModule'
  | 'orders'
  | 'help'
  | 'authorizations'
  | 'mfa'
  | 'profile'
  | 'security'
  | 'addresses'
  | 'enterprise'
  | 'org'
  | 'team'
  | 'roles'

/** 条目可用状态 */
export type NavStatus = 'ready' | 'external' | 'pending'

export interface NavItem {
  key: string
  label: string
  icon: string
  status: NavStatus
  /** status=ready 时对应的视图 */
  view?: AccountView
  /** status=external 时的跳转地址（同源路由或认证中心地址） */
  href?: string
  /** status=pending 时说明缺什么（要具体到接口/表，便于排期） */
  gap?: string
  /** 右上角角标文案（原型里有数量提示的条目） */
  badge?: string
}

export interface NavGroup {
  key: string
  label: string
  icon: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    key: 'account',
    label: '账号',
    icon: 'user',
    items: [
      { key: 'overview', label: '账号总览', icon: 'home', status: 'ready', view: 'overview' },
      // 登录 / 注册 / 找回密码 已从侧栏移除：它们属于未登录场景，登录后的用户中心再放入口只会误导。
      // 认证中心本身仍可从门户顶栏「登录」和账号失效跳转进入。
      // 表 platform_user_binding + GET/POST/DELETE /sso/account/bindings
      { key: 'third-party', label: '第三方绑定', icon: 'globe', status: 'ready', view: 'bindings' },
    ],
  },
  // 「身份」分组已取消：身份申请并入「我的组织 → 业务身份」，
  // 身份切换/身份管理也已并入「我的组织」——它们描述的都是"我是谁/我属于哪个主体"，分三处只会互相打架。
  {
    key: 'certify',
    label: '认证',
    icon: 'award',
    items: [
      { key: 'real-name-personal', label: '个人实名', icon: 'user', status: 'ready', view: 'realname' },
      { key: 'real-name-enterprise', label: '企业实名', icon: 'factory', status: 'ready', view: 'enterprise' },
      // 表 platform_merchant_certificate + /sso/account/certificates（到期状态现算）
      { key: 'qualification', label: '资质证照', icon: 'file', status: 'ready', view: 'certificates' },
    ],
  },
  {
    key: 'org',
    label: '组织权限',
    icon: 'factory',
    items: [
      { key: 'my-org', label: '我的组织', icon: 'home', status: 'ready', view: 'org' },
      { key: 'members', label: '成员管理', icon: 'users', status: 'ready', view: 'team' },
      { key: 'invite', label: '邀请成员', icon: 'plus', status: 'ready', view: 'team' },
      { key: 'my-roles', label: '我的角色与权限', icon: 'shield', status: 'ready', view: 'roles' },
    ],
  },
  {
    key: 'security',
    label: '安全',
    icon: 'shield',
    items: [
      { key: 'account-security', label: '账号安全', icon: 'shield', status: 'ready', view: 'security' },
      { key: 'mfa', label: '二次验证', icon: 'check', status: 'ready', view: 'mfa' },
      // 会话真身在 Redis；已补 GET/DELETE /api/v1/sso/account/sessions
      { key: 'devices', label: '登录设备', icon: 'cpu', status: 'ready', view: 'devices' },
      {
        key: 'grants',
        label: '授权管理',
        icon: 'layers',
        status: 'ready',
        view: 'authorizations',
      },
      // 表 platform_user_operation_log + GET /sso/account/operation-logs
      { key: 'op-log', label: '操作日志', icon: 'clipboard', status: 'ready', view: 'logs' },
    ],
  },
  {
    key: 'message',
    label: '消息',
    icon: 'bell',
    items: [
      // 平台侧早就有站内信（agri_core.platform_message + MessageFacade），
      // 直接复用 /api/v1/messages，不新建消息表
      { key: 'messages', label: '消息中心', icon: 'bell', status: 'ready', view: 'messages' },
      // 表 platform_notification_setting + GET/PUT /sso/account/notification-settings
      { key: 'notify-settings', label: '通知设置', icon: 'settings', status: 'ready', view: 'notification' },
    ],
  },
  {
    key: 'service',
    label: '我的服务',
    icon: 'box',
    items: [
      {
        key: 'cross-module',
        label: '跨模块入口',
        icon: 'globe',
        status: 'ready',
        view: 'crossModule',
      },
      {
        key: 'orders',
        label: '订单聚合',
        icon: 'cart',
        status: 'ready',
        view: 'orders',
      },
    ],
  },
  {
    key: 'settings',
    label: '设置',
    icon: 'settings',
    items: [
      { key: 'profile', label: '个人资料', icon: 'user', status: 'ready', view: 'profile' },
      // 地址管理不在原型 IA 里，但功能已实现且有真实数据，挂在设置下比丢掉合理
      { key: 'addresses', label: '收货地址', icon: 'location', status: 'ready', view: 'addresses' },
      {
        key: 'privacy',
        label: '隐私与数据',
        icon: 'file',
        status: 'ready',
        view: 'privacy',
      },
      {
        key: 'help',
        label: '帮助中心',
        icon: 'alert',
        status: 'ready',
        view: 'help',
      },
      {
        key: 'feedback',
        label: '意见反馈',
        icon: 'clipboard',
        status: 'ready',
        view: 'feedback',
      },
    ],
  },
]

/** 展平后的条目（便于按 key 查找） */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items)

/** 按 key 找条目 */
export function findNavItem(key: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => item.key === key)
}

/**
 * 统计各状态的条目数，用于在页面上给出"已完成 X / 共 Y"的进度。
 *
 * @returns 三个状态的计数与总数
 */
export function navProgress(): { ready: number; external: number; pending: number; total: number } {
  const counts = { ready: 0, external: 0, pending: 0 }
  for (const item of NAV_ITEMS) {
    counts[item.status] += 1
  }
  return { ...counts, total: NAV_ITEMS.length }
}
